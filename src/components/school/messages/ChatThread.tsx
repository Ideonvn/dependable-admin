// src/components/school/messages/ChatThread.tsx
'use client';

import { KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, CheckCheck, Clock, Moon, SmilePlus, UserPlus } from 'lucide-react';
import { ChatMessage, PendingChatMessage } from '@/types/chat';
import { useChatThread } from './useChatThread';
import { errorCode, fetchChatRecipients } from './messagesApi';
import {
  chatErrorMessage,
  closedReasonText,
  dayLabel,
  disclosureText,
  formatQuietUntil,
  groupReactions,
  joinNames,
  myReaction,
  QUICK_REACTIONS,
  startsDay,
  tickState,
  TickState,
} from './chatUtils';
import ChatInviteModal from './ChatInviteModal';
import VoiceNote from './VoiceNote';

// The day is on the separator above; the bubble only needs the time.
const time = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

function Tick({ tick }: { tick: TickState }) {
  switch (tick) {
    case 'sending':
      return <Clock className="w-3.5 h-3.5 opacity-80" aria-label="Sending" />;
    case 'failed':
      return <AlertCircle className="w-3.5 h-3.5 text-red-300" aria-label="Not sent" />;
    case 'sent':
      return <Check className="w-3.5 h-3.5 opacity-80" aria-label="Sent" />;
    case 'delivered':
      return <CheckCheck className="w-3.5 h-3.5 opacity-80" aria-label="Delivered" />;
    case 'seen':
      return <CheckCheck className="w-3.5 h-3.5 text-sky-300" aria-label="Seen" />;
  }
}

type Row = { kind: 'message'; item: ChatMessage } | { kind: 'pending'; item: PendingChatMessage };

const NEAR_BOTTOM_PX = 80;
// The pinned date hides this long after scrolling stops, as in WhatsApp.
const PINNED_DAY_HIDE_MS = 1500;
// A scroll this soon after a wheel, touch or pointer event is the user's; others
// (loading, following new messages) don't show the pinned date.
const USER_SCROLL_MS = 600;
// The pin's height plus a little: a separator this close to the top would sit
// under it.
const PINNED_CLEARANCE_PX = 44;

export default function ChatThread({
  schoolId,
  conversationId,
  viewerId,
  onChanged,
  onStartNew,
}: {
  schoolId: string;
  conversationId: string;
  viewerId?: string;
  onChanged: () => void;
  onStartNew: (studentId: string) => void;
}) {
  const thread = useChatThread(schoolId, conversationId, viewerId, onChanged);
  const detail = thread.detail;
  const participants = useMemo(() => detail?.participants ?? [], [detail]);
  const me = participants.find((p) => p.user_id === viewerId);
  const others = participants.filter((p) => p.user_id !== viewerId);
  const multiParty = participants.length > 2 || !detail?.viewer_is_participant;
  const isClosed = !!detail?.closed_at;
  const canPost = !!detail?.can_post;

  const [draft, setDraft] = useState('');
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [reactError, setReactError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [canStartNew, setCanStartNew] = useState(false);

  // On a chat closed because staff moved on, offer a fresh one if the server
  // says the viewer can start one for this child.
  const offerNew = isClosed && detail?.closed_reason === 'STAFF_INELIGIBLE' && !!detail?.viewer_is_participant;
  const studentId = detail?.student_id;
  useEffect(() => {
    if (!offerNew || !studentId) return;
    let cancelled = false;
    fetchChatRecipients(schoolId, studentId)
      .then((r) => !cancelled && setCanStartNew(r.staff.length + r.guardians.length > 0))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [offerNew, schoolId, studentId]);

  // Oldest first for reading top to bottom; unconfirmed sends last.
  const rows: Row[] = useMemo(
    () => [
      ...[...thread.messages].reverse().map((item) => ({ kind: 'message' as const, item })),
      ...[...thread.pending].reverse().map((item) => ({ kind: 'pending' as const, item })),
    ],
    [thread.messages, thread.pending],
  );

  // Scrolling: start at the bottom, follow new messages only when already near
  // the bottom, and keep the position steady when older ones load above.
  const scroller = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  // Set while an older page is on its way: the height before it, and the oldest
  // row then. Applied only when the oldest row changes (the page landed), so a
  // sync arriving first doesn't consume it and shift the view.
  const olderAnchor = useRef<{ height: number; oldestKey: string | undefined } | null>(null);
  // A separator above the first message of each day; none above the oldest
  // loaded message while older history remains, or it would sit mid-day.
  const display = useMemo(() => {
    const now = new Date();
    return rows.flatMap((row, i) => {
      const at = row.item.created_at;
      return startsDay(at, rows[i - 1]?.item.created_at, !thread.hasOlder)
        ? [{ kind: 'day' as const, key: `day-${i}-${at}`, label: dayLabel(at, now) }, row]
        : [row];
    });
  }, [rows, thread.hasOlder]);

  // The day pinned at the top while the user scrolls: the last separator above
  // the top edge, or the first message's day when none is (older not loaded).
  const [pinnedDay, setPinnedDay] = useState<string | null>(null);
  const [pinnedVisible, setPinnedVisible] = useState(false);
  const lastUserInput = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);
  const markUserInput = () => {
    lastUserInput.current = Date.now();
  };
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (Date.now() - lastUserInput.current > USER_SCROLL_MS) return;
    let label: string | null = rows[0] ? dayLabel(rows[0].item.created_at) : null;
    // A separator sitting at the top edge already says the day: hide the pin
    // there rather than drawing it over the same words.
    let separatorAtTop = false;
    el.querySelectorAll<HTMLElement>('[data-day]').forEach((sep) => {
      const top = sep.offsetTop - el.scrollTop;
      if (top <= 8) label = sep.dataset.day ?? label;
      if (top > -sep.offsetHeight && top < PINNED_CLEARANCE_PX) separatorAtTop = true;
    });
    setPinnedDay(label);
    setPinnedVisible(!separatorAtTop);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setPinnedVisible(false), PINNED_DAY_HIDE_MS);
  };
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const anchor = olderAnchor.current;
    const oldestKey = rows[0]?.kind === 'message' ? rows[0].item.id : undefined;
    if (anchor && anchor.oldestKey !== oldestKey) {
      el.scrollTop += el.scrollHeight - anchor.height;
      olderAnchor.current = null;
    } else if (!anchor && nearBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [rows, thread.typingNames.length]);

  const loadOlder = async () => {
    const el = scroller.current;
    if (!el) return;
    olderAnchor.current = {
      height: el.scrollHeight,
      oldestKey: rows[0]?.kind === 'message' ? rows[0].item.id : undefined,
    };
    // Nothing arrived (failed or empty): drop the anchor, or the next change
    // would apply it.
    if (!(await thread.loadOlder())) olderAnchor.current = null;
  };

  const send = () => {
    if (!draft.trim()) return;
    nearBottom.current = true; // your own message: always follow it
    thread.send(draft);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const react = async (message: ChatMessage, emoji: string) => {
    setReactingTo(null);
    setReactError(null);
    try {
      await thread.react(message, emoji);
    } catch (error) {
      setReactError(chatErrorMessage(errorCode(error)));
    }
  };

  if (thread.loadError || (thread.detailError && !detail)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-sm text-gray-500 dark:text-gray-400 text-center">
        {thread.loadError === 'gone' ? (
          'This chat is no longer available to you.'
        ) : (
          <>
            This chat could not be loaded.
            <button onClick={thread.retryLoad} className="text-[#1A1A6D] dark:text-[#20B2AA] font-medium hover:underline">
              Retry
            </button>
          </>
        )}
      </div>
    );
  }

  const title = detail
    ? detail.viewer_is_participant
      ? joinNames(others.map((p) => p.display_name))
      : `${detail.student_first_name}'s chat`
    : '';
  const staffNames = participants.filter((p) => p.side === 'STAFF').map((p) => p.display_name);
  const showQuiet = !!detail?.staff_quiet_until && me?.side === 'GUARDIAN' && canPost;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{title}</p>
          {detail && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">About {detail.student_first_name}</p>
          )}
        </div>
        {detail?.can_invite && (
          <button
            onClick={() => setInviting(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add parent
          </button>
        )}
      </div>

      {/* Disclosure (D13) */}
      {detail && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
          {disclosureText(detail.school_name)}
          {!detail.viewer_is_participant && (
            <span className="font-semibold"> You are viewing as school management.</span>
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scroller}
        onScroll={onScroll}
        onWheel={markUserInput}
        onTouchMove={markUserInput}
        onPointerDown={markUserInput}
        onKeyDown={markUserInput}
        className="relative flex-1 overflow-y-auto px-4 py-3 space-y-1.5"
      >
        {pinnedDay && (
          // items-start: in an h-0 flex row the default stretch squashes the
          // pill to zero height and its text spills out below the border.
          <div className="sticky top-0 z-10 h-0 flex items-start justify-center pointer-events-none" aria-hidden>
            <span
              data-testid="pinned-day"
              className={`mt-1 rounded-full px-3 py-0.5 text-xs font-semibold shadow-sm bg-white/95 dark:bg-gray-800/95 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-opacity duration-300 ${
                pinnedVisible ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {pinnedDay}
            </span>
          </div>
        )}
        {!thread.loaded ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {thread.hasOlder && (
              <div className="flex justify-center pb-2">
                <button
                  onClick={loadOlder}
                  disabled={thread.loadingOlder}
                  className="text-xs text-[#1A1A6D] dark:text-[#20B2AA] hover:underline disabled:opacity-50"
                >
                  {thread.loadingOlder
                    ? 'Loading…'
                    : thread.olderError
                      ? "Couldn't load older messages. Try again"
                      : 'Load older messages'}
                </button>
              </div>
            )}
            {rows.length === 0 && (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                {canPost ? 'Say hello 👋' : 'No messages in this chat.'}
              </p>
            )}
            {display.map((row) => {
              if (row.kind === 'day') {
                return (
                  <div key={row.key} data-day={row.label} className="flex justify-center py-2" role="separator">
                    <span className="rounded-full px-3 py-0.5 text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      {row.label}
                    </span>
                  </div>
                );
              }
              if (row.kind === 'pending') {
                const p = row.item;
                return (
                  <div key={`p-${p.client_msg_id}`} className="flex flex-col items-end">
                    <div className="max-w-[75%] rounded-2xl rounded-br-sm px-3.5 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white">
                      <p className="text-sm whitespace-pre-wrap break-words">{p.body}</p>
                      <div className="flex items-center justify-end gap-1 mt-0.5 text-[11px] text-white/80">
                        {time(p.created_at)}
                        <Tick tick={p.failed ? 'failed' : 'sending'} />
                      </div>
                    </div>
                    {p.failed && (
                      <div className="flex gap-3 mt-1 text-xs">
                        <button onClick={() => thread.retry(p.client_msg_id)} className="text-red-600 dark:text-red-400 font-medium hover:underline">
                          Not sent. Retry
                        </button>
                        <button onClick={() => thread.discard(p.client_msg_id)} className="text-gray-500 hover:underline">
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              }
              const m = row.item;
              const mine = !!viewerId && m.sender_id === viewerId;
              const tick = tickState(m, participants, viewerId);
              const reactions = groupReactions(m, viewerId);
              const current = myReaction(m, viewerId);
              return (
                <div key={m.id} className={`group flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-center gap-1 max-w-[75%] ${mine ? 'flex-row-reverse' : ''}`}>
                    <div
                      className={`rounded-2xl px-3.5 py-2 ${
                        mine
                          ? 'rounded-br-sm bg-[#1A1A6D] dark:bg-[#20B2AA] text-white'
                          : 'rounded-bl-sm bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {multiParty && !mine && (
                        <p className="text-xs font-semibold text-[#1A1A6D] dark:text-[#20B2AA] mb-0.5">{m.sender_display_name}</p>
                      )}
                      {m.kind === 'VOICE' ? (
                        <VoiceNote
                          schoolId={schoolId}
                          conversationId={conversationId}
                          messageId={m.id}
                          durationMs={m.voice_duration_ms}
                          waveform={m.voice_waveform}
                          mine={mine}
                        />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                      )}
                      <div
                        className={`flex items-center justify-end gap-1 mt-0.5 text-[11px] ${
                          mine ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {time(m.created_at)}
                        {tick && <Tick tick={tick} />}
                      </div>
                    </div>
                    {canPost && (
                      <div className="relative">
                        <button
                          onClick={() => setReactingTo(reactingTo === m.id ? null : m.id)}
                          className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                          aria-label="React"
                        >
                          <SmilePlus className="w-4 h-4" />
                        </button>
                        {reactingTo === m.id && (
                          <div
                            className={`absolute z-10 bottom-full mb-1 flex gap-1 p-1.5 rounded-full bg-white dark:bg-[#1E1E1E] shadow-lg border border-gray-200 dark:border-gray-700 ${
                              mine ? 'right-0' : 'left-0'
                            }`}
                          >
                            {QUICK_REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => react(m, emoji)}
                                className={`w-8 h-8 rounded-full text-lg hover:bg-gray-100 dark:hover:bg-gray-800 ${
                                  current === emoji ? 'bg-gray-200 dark:bg-gray-700' : ''
                                }`}
                                aria-label={current === emoji ? `Remove ${emoji}` : `React ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {reactions.length > 0 && (
                    <div className="flex gap-1 -mt-1 mx-2">
                      {reactions.map((r) => (
                        <button
                          key={r.emoji}
                          onClick={canPost ? () => react(m, r.emoji) : undefined}
                          disabled={!canPost}
                          className={`px-1.5 py-0.5 rounded-full text-xs border bg-white dark:bg-[#121212] ${
                            r.mine ? 'border-[#1A1A6D] dark:border-[#20B2AA]' : 'border-gray-200 dark:border-gray-700'
                          }`}
                          aria-label={`${r.emoji} ${r.count}${r.mine ? ', including you' : ''}`}
                        >
                          {r.emoji}
                          {r.count > 1 ? ` ${r.count}` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-2 space-y-2">
        {thread.typingNames.length > 0 && !isClosed && (
          <p className="text-xs italic text-gray-500 dark:text-gray-400" aria-live="polite">
            {joinNames(thread.typingNames)} {thread.typingNames.length > 1 ? 'are' : 'is'} typing…
          </p>
        )}
        {showQuiet && (
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 justify-center">
            <Moon className="w-3.5 h-3.5" /> {joinNames(staffNames)} will be notified at{' '}
            {formatQuietUntil(detail!.staff_quiet_until!)}.
          </p>
        )}
        {(thread.sendError || reactError) && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {reactError ?? chatErrorMessage(thread.sendError)}
          </p>
        )}
        {detail && isClosed && (
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">This chat is closed</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {closedReasonText(detail.closed_reason, detail.student_first_name)}
            </p>
            {canStartNew && (
              <button
                onClick={() => onStartNew(detail.student_id)}
                className="mt-1 text-sm font-medium text-[#1A1A6D] dark:text-[#20B2AA] hover:underline"
              >
                Start a new chat
              </button>
            )}
          </div>
        )}
        {detail && !isClosed && canPost && (
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (e.target.value) thread.notifyTyping();
              }}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={4000}
              placeholder="Type a message"
              className="flex-1 resize-none max-h-40 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA]"
            />
            <button
              onClick={send}
              disabled={!draft.trim()}
              className="px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50"
            >
              Send
            </button>
          </div>
        )}
        {detail && !detail.viewer_is_participant && (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Read-only: you are not part of this chat.</p>
        )}
      </div>

      {inviting && detail && (
        <ChatInviteModal
          schoolId={schoolId}
          conversationId={conversationId}
          guardians={detail.invitable_guardians}
          onInvited={(updated) => {
            thread.setDetail(updated);
            setInviting(false);
            onChanged();
          }}
          onClose={() => setInviting(false)}
        />
      )}
    </div>
  );
}
