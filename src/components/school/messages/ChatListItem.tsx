// src/components/school/messages/ChatListItem.tsx
'use client';

import { ChatConversationSummary } from '@/types/chat';
import { chatListHeading, messagePreviewText } from './chatUtils';
import ChatAvatar from './ChatAvatar';

const when = (iso: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
};

/** Who you're talking to first; the child and their role underneath (see chatListHeading). */
export default function ChatListItem({
  chat,
  schoolId,
  viewerId,
  selected,
  onSelect,
}: {
  chat: ChatConversationSummary;
  schoolId: string;
  viewerId?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { title, subtitle, avatar, more } = chatListHeading(chat, viewerId);
  const last = chat.last_message;
  const preview = last
    ? `${last.sender_id === viewerId ? 'You' : last.sender_display_name}: ${messagePreviewText(last)}`
    : 'No messages yet';
  const unread = chat.unread_count;

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-3 py-3 text-left rounded-lg transition-colors ${
        selected ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
      }`}
    >
      <ChatAvatar schoolId={schoolId} conversationId={chat.id} participant={avatar} more={more} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{title}</p>
          {!!chat.closed_at && (
            <span className="text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-400 border border-gray-400 dark:border-gray-600 rounded px-1 flex-shrink-0">
              Closed
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>
        <p
          className={`text-xs truncate ${
            unread > 0 ? 'text-gray-900 dark:text-gray-100 font-semibold' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {preview}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 self-stretch justify-between flex-shrink-0">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">{when(chat.last_message_at)}</span>
        {unread > 0 && (
          <span
            className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center"
            aria-label={`${unread} unread`}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </div>
    </button>
  );
}
