// src/components/school/messages/MessagesTab.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, MessageSquare, Plus, RefreshCw, Settings } from 'lucide-react';
import { userSetupService } from '@/lib/userSetupService';
import { ChatConversationDetail, ChatConversationSummary } from '@/types/chat';
import { fetchChatOversight, fetchChats, fetchChatUnreadCount } from './messagesApi';
import { realtime } from './realtime';
import ChatListItem from './ChatListItem';
import ChatThread from './ChatThread';
import NewChatModal from './NewChatModal';
import ChatSettingsModal from './ChatSettingsModal';

type Scope = 'mine' | 'all';
type State = 'open' | 'closed';

const LIST_POLL_MS = 30000;
const EVENT_DEBOUNCE_MS = 400;

/**
 * Parent–staff chat for school admins (the tab is hidden from teachers).
 * "Mine" is the admin's own chats; "Whole school" is every chat at the school,
 * read-only unless they're in it. Platform admins are never participants
 * (spec D12), so they only get "Whole school".
 */
export default function MessagesTab({
  schoolId,
  schoolName,
  onUnreadChange,
}: {
  schoolId: string;
  schoolName: string;
  onUnreadChange: (count: number) => void;
}) {
  const setup = userSetupService.getSetupData();
  const viewerId = setup?.id;
  // A real ADMIN membership, not the platform-admin bypass.
  const isMember = !!setup?.school_memberships.some(
    (m) => m.school_id === schoolId && m.role === 'ADMIN' && m.status === 'active',
  );

  const [scope, setScope] = useState<Scope>(isMember ? 'mine' : 'all');
  const [state, setState] = useState<State>('open');
  const [chats, setChats] = useState<ChatConversationSummary[]>([]);
  const [pages, setPages] = useState(1);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newChat, setNewChat] = useState<{ studentId?: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Reload every page shown so far, so a refresh doesn't collapse "load more".
  const loadSeq = useRef(0);
  const load = useCallback(
    async (pageCount: number, quiet = false) => {
      const seq = ++loadSeq.current;
      if (!quiet) setLoading(true);
      try {
        const fetchPage = scope === 'all' ? fetchChatOversight : fetchChats;
        const all: ChatConversationSummary[] = [];
        let next: number | null = null;
        for (let page = 1; page <= pageCount; page++) {
          const res = await fetchPage(schoolId, { state, page });
          all.push(...res.data);
          next = res.next_page;
          if (!next) break;
        }
        if (seq !== loadSeq.current) return; // a newer load (scope/state change) won
        // Offset paging over last_message_at: a chat that gets a message while
        // pages load moves up and comes back on the next page. Keep the first.
        const seen = new Set<string>();
        setChats(all.filter((chat) => (seen.has(chat.id) ? false : (seen.add(chat.id), true))));
        setNextPage(next);
        setError(false);
      } catch {
        if (seq === loadSeq.current && !quiet) setError(true);
      } finally {
        if (seq === loadSeq.current) setLoading(false);
      }
    },
    [schoolId, scope, state],
  );

  const refreshUnread = useCallback(() => {
    fetchChatUnreadCount(schoolId).then(onUnreadChange).catch(() => undefined);
  }, [schoolId, onUnreadChange]);

  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const refreshAll = useCallback(() => {
    load(pagesRef.current, true);
    refreshUnread();
  }, [load, refreshUnread]);

  // Scope or state changed: back to page 1.
  useEffect(() => {
    setPages(1);
    setChats([]);
    load(1);
  }, [load]);

  // The socket runs while this tab is open; polling is the fallback.
  useEffect(() => {
    realtime.start();
    return () => realtime.stop();
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = realtime.subscribe((event) => {
      const relevant =
        event.type === 'connected' ||
        event.type === 'resync' ||
        ((event.type === 'chat.message' || event.type === 'chat.updated') && event.school_id === schoolId);
      if (!relevant || timer) return;
      // Batch bursts into one refresh.
      timer = setTimeout(() => {
        timer = null;
        refreshAll();
      }, EVENT_DEBOUNCE_MS);
    });
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') refreshAll();
    }, LIST_POLL_MS);
    return () => {
      unsubscribe();
      clearInterval(poll);
      if (timer) clearTimeout(timer);
    };
  }, [schoolId, refreshAll]);

  const loadMore = () => {
    if (!nextPage) return;
    const count = pages + 1;
    setPages(count);
    load(count, true);
  };

  const onStarted = (conversation: ChatConversationDetail) => {
    setNewChat(null);
    setState('open');
    if (isMember) setScope('mine');
    setSelectedId(conversation.id);
    refreshAll();
  };

  const tabButton = (active: boolean) =>
    `px-3 py-1.5 text-sm rounded-md transition-colors ${
      active
        ? 'bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 shadow-sm font-medium'
        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
    }`;

  return (
    <div className="flex h-[calc(100vh-16rem)] min-h-[520px]">
      {/* List */}
      <div
        className={`w-full md:w-96 flex-shrink-0 flex-col border-r border-gray-200 dark:border-gray-800 ${
          selectedId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-4 space-y-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Messages</h2>
            <div className="flex items-center gap-2">
              {isMember && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Chat settings"
                  title="Quiet hours"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
              {isMember && (
                <button
                  onClick={() => setNewChat({})}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  New
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            {isMember ? (
              <div className="inline-flex p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
                <button className={tabButton(scope === 'mine')} onClick={() => setScope('mine')}>Mine</button>
                <button className={tabButton(scope === 'all')} onClick={() => setScope('all')}>Whole school</button>
              </div>
            ) : (
              <span className="text-xs text-gray-500 dark:text-gray-400">Whole school (read-only)</span>
            )}
            <select
              value={state}
              onChange={(e) => setState(e.target.value as State)}
              className="text-sm px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] text-gray-700 dark:text-gray-300"
              aria-label="Open or closed chats"
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading && (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && !loading && (
            <div className="flex items-center gap-2 m-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-800 dark:text-red-300 flex-1">Couldn&apos;t load chats.</span>
              <button onClick={() => load(pages)} className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 hover:underline">
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          )}
          {!loading && !error && chats.length === 0 && (
            <div className="text-center py-16 px-4">
              <MessageSquare className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {state === 'closed'
                  ? 'No closed chats.'
                  : scope === 'mine'
                  ? 'No chats yet. Start one with New.'
                  : 'No chats at this school yet.'}
              </p>
            </div>
          )}
          {!loading &&
            chats.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                schoolId={schoolId}
                viewerId={viewerId}
                selected={chat.id === selectedId}
                onSelect={() => setSelectedId(chat.id)}
              />
            ))}
          {!loading && nextPage && (
            <div className="flex justify-center py-2">
              <button onClick={loadMore} className="text-sm text-[#1A1A6D] dark:text-[#20B2AA] hover:underline">
                Load more
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Thread */}
      <div className={`flex-1 min-w-0 flex-col ${selectedId ? 'flex' : 'hidden md:flex'}`}>
        {selectedId ? (
          <>
            <button
              onClick={() => setSelectedId(null)}
              className="md:hidden flex items-center gap-1 px-4 pt-3 text-sm text-gray-600 dark:text-gray-400"
            >
              <ArrowLeft className="w-4 h-4" /> All chats
            </button>
            <ChatThread
              key={selectedId}
              schoolId={schoolId}
              conversationId={selectedId}
              viewerId={viewerId}
              onChanged={refreshAll}
              onStartNew={(studentId) => setNewChat({ studentId })}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            Select a chat to read it.
          </div>
        )}
      </div>

      {newChat && (
        <NewChatModal
          schoolId={schoolId}
          schoolName={schoolName}
          initialStudentId={newChat.studentId}
          onStarted={onStarted}
          onClose={() => setNewChat(null)}
        />
      )}
      {showSettings && <ChatSettingsModal schoolId={schoolId} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
