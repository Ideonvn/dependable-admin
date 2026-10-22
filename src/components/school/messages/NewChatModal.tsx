// src/components/school/messages/NewChatModal.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import ModalOverlay from '@/components/ModalOverlay';
import StudentProfileImage from '@/components/StudentProfileImage';
import { schoolsApi, Student } from '@/lib/schools';
import { ChatConversationDetail, ChatRecipients } from '@/types/chat';
import { errorCode, fetchChatRecipients, startChat } from './messagesApi';
import { disclosureText } from './chatUtils';

const START_ERRORS: Record<string, string> = {
  CHAT_INVALID_RECIPIENTS: "You can't start a chat with the selected people.",
  CHAT_FORBIDDEN: "You can't start a chat for this child.",
};

/**
 * Pick a child, then the guardian(s) to message. Who can be messaged comes from
 * the server (/chats/recipients); this never works it out from roles.
 */
export default function NewChatModal({
  schoolId,
  schoolName,
  initialStudentId,
  onStarted,
  onClose,
}: {
  schoolId: string;
  schoolName: string;
  initialStudentId?: string;
  onStarted: (conversation: ChatConversationDetail) => void;
  onClose: () => void;
}) {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [studentsError, setStudentsError] = useState(false);
  const [query, setQuery] = useState('');
  const [studentId, setStudentId] = useState<string | undefined>(initialStudentId);
  const [recipients, setRecipients] = useState<ChatRecipients | null>(null);
  const [recipientsError, setRecipientsError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Current children only (include_inactive=false). getStudents returns [] on failure.
    schoolsApi
      .getStudents(schoolId)
      .then(setStudents)
      .catch(() => setStudentsError(true));
  }, [schoolId]);

  useEffect(() => {
    setRecipients(null);
    setRecipientsError(false);
    setSelected(new Set());
    setError(null);
    if (!studentId) return;
    let cancelled = false;
    fetchChatRecipients(schoolId, studentId)
      .then((r) => {
        if (cancelled) return;
        setRecipients(r);
        // Preselect when there's only one choice.
        if (r.guardians.length === 1) setSelected(new Set([r.guardians[0].user_id]));
      })
      .catch(() => !cancelled && setRecipientsError(true));
    return () => {
      cancelled = true;
    };
  }, [schoolId, studentId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (students ?? [])
      .filter((s) => !q || s.full_name.toLowerCase().includes(q))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [students, query]);
  const student = students?.find((s) => s.id === studentId);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const start = async () => {
    if (!studentId || !selected.size) return;
    setStarting(true);
    setError(null);
    try {
      onStarted(await startChat(schoolId, studentId, Array.from(selected)));
    } catch (e) {
      setError(START_ERRORS[errorCode(e) ?? ''] ?? "Couldn't start the chat. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <ModalOverlay>
      <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-lg w-full">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          {studentId && !initialStudentId && (
            <button onClick={() => setStudentId(undefined)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="flex-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {studentId ? `Message about ${student?.full_name ?? 'this child'}` : 'New chat: pick a child'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
            {disclosureText(schoolName)}
          </p>

          {!studentId && (
            <>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search children"
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA]"
                />
              </div>
              {studentsError && <p className="text-sm text-red-600 dark:text-red-400">Couldn&apos;t load the children.</p>}
              {!students && !studentsError && <p className="text-sm text-gray-500">Loading…</p>}
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStudentId(s.id)}
                    className="w-full flex items-center gap-3 py-2 px-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg"
                  >
                    <StudentProfileImage
                      schoolId={schoolId}
                      studentId={s.id}
                      imageFilename={s.image_filename}
                      alt={s.full_name}
                      className="w-8 h-8 rounded-full object-cover"
                      fallbackClassName="w-8 h-8 rounded-full bg-[#1A1A6D] dark:bg-[#20B2AA] flex items-center justify-center"
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-100">{s.full_name}</span>
                  </button>
                ))}
                {students && filtered.length === 0 && <p className="text-sm text-gray-500 py-2">No matching children.</p>}
              </div>
            </>
          )}

          {studentId && (
            <>
              {recipientsError && <p className="text-sm text-red-600 dark:text-red-400">Couldn&apos;t load who you can message.</p>}
              {!recipients && !recipientsError && <p className="text-sm text-gray-500">Loading…</p>}
              {recipients && recipients.guardians.length === 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  There&apos;s no one you can message about this child: they have no guardians linked to
                  their profile.
                </p>
              )}
              {recipients &&
                recipients.guardians.map((g) => (
                  <label key={g.user_id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(g.user_id)}
                      onChange={() => toggle(g.user_id)}
                      className="w-4 h-4 accent-[#1A1A6D] dark:accent-[#20B2AA]"
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-100">{g.display_name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{g.primary ? 'Primary guardian' : 'Guardian'}</span>
                  </label>
                ))}
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex justify-end">
                <button
                  onClick={start}
                  disabled={!selected.size || starting}
                  className="px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 text-sm font-medium disabled:opacity-50"
                >
                  {starting ? 'Starting…' : 'Start chat'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
