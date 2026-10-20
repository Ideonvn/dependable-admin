// src/components/school/messages/ChatInviteModal.tsx
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import ModalOverlay from '@/components/ModalOverlay';
import { ChatConversationDetail } from '@/types/chat';
import { errorCode, inviteToChat } from './messagesApi';
import { chatErrorMessage } from './chatUtils';

/** Add another of the child's guardians; they see the whole history. */
export default function ChatInviteModal({
  schoolId,
  conversationId,
  guardians,
  onInvited,
  onClose,
}: {
  schoolId: string;
  conversationId: string;
  guardians: { user_id: string; display_name: string }[];
  onInvited: (updated: ChatConversationDetail) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invite = async (userId: string) => {
    setBusy(userId);
    setError(null);
    try {
      onInvited(await inviteToChat(schoolId, conversationId, userId));
    } catch (e) {
      setError(chatErrorMessage(errorCode(e)));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ModalOverlay>
      <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-md w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add a parent</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">They will see the whole conversation, including earlier messages.</p>
          {guardians.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">There is no one else to add.</p>
          )}
          {guardians.map((g) => (
            <div key={g.user_id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-900 dark:text-gray-100">{g.display_name}</span>
              <button
                onClick={() => invite(g.user_id)}
                disabled={busy !== null}
                className="px-3 py-1.5 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 text-sm font-medium disabled:opacity-50"
              >
                {busy === g.user_id ? 'Adding…' : 'Add'}
              </button>
            </div>
          ))}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>
    </ModalOverlay>
  );
}
