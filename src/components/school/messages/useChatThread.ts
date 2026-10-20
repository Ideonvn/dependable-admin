// src/components/school/messages/useChatThread.ts
// Ported from dependable-app hooks/useChatThread.ts (same cursor rules); keep the two in step.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatConversationDetail, ChatMessage, PendingChatMessage } from '@/types/chat';
import {
  clearChatReaction,
  errorCode,
  fetchChat,
  fetchChatChanges,
  fetchChatHistory,
  markChatRead,
  sendChatMessage,
  setChatReaction,
} from './messagesApi';
import { maxRev, maxSeq, mergeMessages, myReaction, unconfirmedPending } from './chatUtils';
import { realtime } from './realtime';

const POLL_MS = 4000;
// With the socket up, polling is only a safety net for a silently dead socket.
const POLL_WITH_SOCKET_MS = 30000;
const TYPING_SEND_INTERVAL_MS = 3000;
const TYPING_SHOW_MS = 5000;
const DETAIL_POLL_MS = 15000;
const PAGE = 50;
const SYNC_PAGE_MAX = 200; // the API's per-call cap on after_rev
const READ_DEBOUNCE_MS = 600;

const minSeq = (messages: ChatMessage[]): number =>
  messages.reduce((min, m) => (m.seq < min ? m.seq : min), Infinity);

/** crypto.randomUUID exists only in secure contexts (HTTPS or localhost): a
 * staging host over plain HTTP would make every send throw. */
export const newClientMsgId = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

const visibleNow = () => typeof document === 'undefined' || document.visibilityState === 'visible';

/**
 * Everything the thread pane needs. Messages live in local state, merged by id;
 * the sync cursor is the highest rev seen through sync (or the first page).
 * `onChanged` tells the list to refresh (sent, read).
 *
 * Mount once per conversation (key={conversationId}): requests still in flight
 * from the previous chat must not land in this one's state.
 */
export function useChatThread(
  schoolId: string,
  conversationId: string,
  viewerId: string | undefined,
  onChanged: () => void,
) {
  const [visible, setVisible] = useState(visibleNow());
  const [detail, setDetail] = useState<ChatConversationDetail | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<PendingChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  // 'gone': 403/404, not available to this user. 'failed': anything else
  // (network); the pane offers a retry.
  const [loadError, setLoadError] = useState<'gone' | 'failed' | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>(undefined);
  const [socketOpen, setSocketOpen] = useState(realtime.isOpen());
  const [typing, setTyping] = useState<Record<string, { name: string; until: number }>>({});

  // Highest rev received through sync (or the first page). Only those advance it:
  // a send response, a reaction response or an older page can carry a higher rev
  // than something not yet synced, and jumping to it would skip that message.
  const cursor = useRef(0);
  // Lowest seq received through history (first page, older pages). Older pages
  // page from here, never from the oldest message in state: a reaction on an
  // old message brings it in through sync, and paging below it skipped
  // everything in between.
  const historyFloor = useRef<number | null>(null);
  // Highest seq the viewer can actually have seen in order — what mark-read may claim.
  const readableSeq = useRef(0);
  const syncing = useRef(false);
  const syncAgain = useRef(false);
  const loadedRef = useRef(false);
  const lastReadSent = useRef(0);
  const lastTypingSent = useRef(0);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const refreshDetail = useCallback(async () => {
    try {
      setDetail(await fetchChat(schoolId, conversationId));
      setDetailError(false);
    } catch {
      // Keep what's on screen; only an empty pane shows the error.
      setDetailError(true);
    }
  }, [schoolId, conversationId]);

  const absorb = useCallback((incoming: ChatMessage[], fromSync = false) => {
    if (!incoming.length) return;
    if (fromSync) {
      cursor.current = maxRev(incoming, cursor.current);
      readableSeq.current = Math.max(readableSeq.current, maxSeq(incoming));
    }
    setMessages((current) => mergeMessages(current, incoming));
    setPending((current) => unconfirmedPending(current, incoming));
  }, []);

  useEffect(() => {
    const onVisibility = () => setVisible(visibleNow());
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // First page and the detail.
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    refreshDetail();
    fetchChatHistory(schoolId, conversationId, undefined, PAGE)
      .then((page) => {
        if (cancelled) return;
        absorb(page, true);
        historyFloor.current = page.length ? minSeq(page) : null;
        setHasOlder(page.length === PAGE);
        loadedRef.current = true;
        setLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        const status = (error as { response?: { status?: number } })?.response?.status;
        setLoadError(status === 403 || status === 404 ? 'gone' : 'failed');
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId, conversationId, absorb, refreshDetail, loadAttempt]);

  const retryLoad = useCallback(() => setLoadAttempt((n) => n + 1), []);

  const syncNow = useCallback(async () => {
    // Before the first page the cursor is 0 and a sync would page the whole history.
    if (!loadedRef.current) return;
    if (syncing.current) {
      syncAgain.current = true;
      return;
    }
    syncing.current = true;
    try {
      do {
        syncAgain.current = false;
        for (;;) {
          const changes = await fetchChatChanges(schoolId, conversationId, cursor.current);
          absorb(changes, true);
          if (changes.length < SYNC_PAGE_MAX) break;
        }
      } while (syncAgain.current);
    } catch {
      // Transient: the next tick retries from the same cursor.
    } finally {
      syncing.current = false;
    }
  }, [schoolId, conversationId, absorb]);

  // Poll while visible (slowly when the socket is up); sync at once on becoming visible.
  useEffect(() => {
    if (!visible || !loaded) return;
    syncNow();
    const sync = setInterval(syncNow, socketOpen ? POLL_WITH_SOCKET_MS : POLL_MS);
    const det = setInterval(refreshDetail, DETAIL_POLL_MS);
    return () => {
      clearInterval(sync);
      clearInterval(det);
    };
  }, [visible, loaded, syncNow, socketOpen, refreshDetail]);

  // Realtime: a message syncs now; receipts/closing refetch the detail (ticks);
  // a reconnect may have missed events, so both.
  useEffect(
    () =>
      realtime.subscribe((event) => {
        if (event.type === 'connected' || event.type === 'disconnected') {
          setSocketOpen(event.type === 'connected');
        }
        if (event.type === 'connected' || event.type === 'resync') {
          syncNow();
          refreshDetail();
          return;
        }
        if (!('conversation_id' in event) || event.conversation_id !== conversationId) return;
        if (event.type === 'chat.message') {
          syncNow();
          setTyping({});
        } else if (event.type === 'chat.updated') {
          refreshDetail();
        } else if (event.type === 'chat.typing' && event.user_id !== viewerId) {
          const until = Date.now() + TYPING_SHOW_MS;
          setTyping((current) => ({ ...current, [event.user_id]: { name: event.display_name, until } }));
        }
      }),
    [conversationId, syncNow, refreshDetail, viewerId],
  );

  // Expire typing indicators.
  useEffect(() => {
    const ids = Object.keys(typing);
    if (!ids.length) return;
    const next = Math.min(...ids.map((id) => typing[id].until)) - Date.now();
    const timer = setTimeout(() => {
      const now = Date.now();
      setTyping((current) => Object.fromEntries(Object.entries(current).filter(([, t]) => t.until > now)));
    }, Math.max(next, 0) + 50);
    return () => clearTimeout(timer);
  }, [typing]);

  // Mark read: participants only, while visible, debounced. Oversight readers never.
  const isParticipant = detail?.viewer_is_participant === true;
  useEffect(() => {
    if (!visible || !isParticipant || !messages.length) return;
    const newest = readableSeq.current;
    if (newest <= lastReadSent.current) return;
    const timer = setTimeout(() => {
      lastReadSent.current = newest;
      markChatRead(schoolId, conversationId, newest)
        .then(() => onChangedRef.current())
        .catch(() => {
          lastReadSent.current = 0;
        });
    }, READ_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [visible, isParticipant, messages, schoolId, conversationId]);

  /** True when a page arrived; false when there was nothing to do or it failed. */
  const loadOlder = useCallback(async (): Promise<boolean> => {
    if (loadingOlder || !hasOlder) return false;
    const floor = historyFloor.current;
    if (floor === null) return false;
    setLoadingOlder(true);
    setOlderError(false);
    try {
      const page = await fetchChatHistory(schoolId, conversationId, floor, PAGE);
      absorb(page);
      if (page.length) historyFloor.current = Math.min(floor, minSeq(page));
      setHasOlder(page.length === PAGE);
      return page.length > 0;
    } catch {
      setOlderError(true);
      return false;
    } finally {
      setLoadingOlder(false);
    }
  }, [schoolId, conversationId, absorb, hasOlder, loadingOlder]);

  /** Send, or resend a failed bubble. A retry reuses its client_msg_id. */
  const deliver = useCallback(
    async (clientMsgId: string, body: string) => {
      setSendError(undefined);
      setPending((current) =>
        current.map((p) => (p.client_msg_id === clientMsgId ? { ...p, failed: false } : p)),
      );
      try {
        const stored = await sendChatMessage(schoolId, conversationId, clientMsgId, body);
        absorb([stored]);
        syncNow();
        onChangedRef.current();
      } catch (error) {
        setPending((current) =>
          current.map((p) => (p.client_msg_id === clientMsgId ? { ...p, failed: true } : p)),
        );
        const code = errorCode(error);
        if (code === 'CHAT_CONVERSATION_CLOSED' || code === 'CHAT_FORBIDDEN') refreshDetail();
        setSendError(code);
      }
    },
    [schoolId, conversationId, absorb, syncNow, refreshDetail],
  );

  const send = useCallback(
    (body: string) => {
      const text = body.trim();
      if (!text) return;
      const clientMsgId = newClientMsgId();
      setPending((current) => [
        { client_msg_id: clientMsgId, body: text, created_at: new Date().toISOString(), failed: false },
        ...current,
      ]);
      deliver(clientMsgId, text);
    },
    [deliver],
  );

  const retry = useCallback(
    (clientMsgId: string) => {
      const bubble = pending.find((p) => p.client_msg_id === clientMsgId);
      if (bubble) deliver(clientMsgId, bubble.body);
    },
    [pending, deliver],
  );

  const discard = useCallback((clientMsgId: string) => {
    setPending((current) => current.filter((p) => p.client_msg_id !== clientMsgId));
  }, []);

  /** Choosing your current reaction removes it; anything else sets it. Throws on API errors. */
  const react = useCallback(
    async (message: ChatMessage, emoji: string) => {
      const updated =
        myReaction(message, viewerId) === emoji
          ? await clearChatReaction(schoolId, conversationId, message.id)
          : await setChatReaction(schoolId, conversationId, message.id, emoji);
      absorb([updated]);
    },
    [schoolId, conversationId, viewerId, absorb],
  );

  /** Call on every keystroke; sends at most one typing frame per 3 s. */
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_SEND_INTERVAL_MS) return;
    lastTypingSent.current = now;
    realtime.sendTyping(conversationId);
  }, [conversationId]);

  return {
    detail,
    detailError,
    refreshDetail,
    setDetail,
    typingNames: Object.values(typing).map((t) => t.name),
    notifyTyping,
    messages,
    pending,
    loaded,
    loadError,
    retryLoad,
    olderError,
    hasOlder,
    loadingOlder,
    loadOlder,
    send,
    sendError,
    retry,
    discard,
    react,
  };
}
