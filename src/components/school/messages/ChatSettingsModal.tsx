// src/components/school/messages/ChatSettingsModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import ModalOverlay from '@/components/ModalOverlay';
import { errorCode, fetchChatSettings, updateChatSettings } from './messagesApi';

/** School admins: quiet hours for staff chat notifications (spec D16). */
export default function ChatSettingsModal({ schoolId, onClose }: { schoolId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [hoursOn, setHoursOn] = useState(true);
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('07:00');
  const [weekends, setWeekends] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetchChatSettings(schoolId)
      .then((data) => {
        setHoursOn(data.quiet_start !== null && data.quiet_end !== null);
        if (data.quiet_start) setStart(data.quiet_start);
        if (data.quiet_end) setEnd(data.quiet_end);
        setWeekends(data.quiet_weekends);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateChatSettings(schoolId, {
        quiet_start: hoursOn ? start : null,
        quiet_end: hoursOn ? end : null,
        quiet_weekends: weekends,
      });
      setMessage({ ok: true, text: 'Quiet hours saved.' });
    } catch (e) {
      setMessage({
        ok: false,
        text: errorCode(e) === 'CHAT_FORBIDDEN' ? 'Only school admins can change quiet hours.' : "Couldn't save quiet hours.",
      });
    } finally {
      setSaving(false);
    }
  };

  const input =
    'px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 disabled:opacity-50';

  return (
    <ModalOverlay>
      <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-md w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Quiet hours</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Staff aren&apos;t notified of new messages during these times. Messages still arrive, and staff get one
            reminder when quiet hours end. Parents are always notified.
          </p>
          {loading && <p className="text-sm text-gray-500">Loading…</p>}
          {loadError && <p className="text-sm text-red-600 dark:text-red-400">Couldn&apos;t load chat settings.</p>}
          {!loading && !loadError && (
            <>
              <label className="flex items-center gap-3 text-sm text-gray-900 dark:text-gray-100">
                <input type="checkbox" checked={hoursOn} onChange={(e) => setHoursOn(e.target.checked)} className="w-4 h-4 accent-[#1A1A6D] dark:accent-[#20B2AA]" />
                Weekday evenings
              </label>
              <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                <span>From</span>
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} disabled={!hoursOn} className={input} />
                <span>until</span>
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} disabled={!hoursOn} className={input} />
              </div>
              <label className="flex items-center gap-3 text-sm text-gray-900 dark:text-gray-100">
                <input type="checkbox" checked={weekends} onChange={(e) => setWeekends(e.target.checked)} className="w-4 h-4 accent-[#1A1A6D] dark:accent-[#20B2AA]" />
                Weekends
              </label>
              {message && (
                <p className={`text-sm ${message.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{message.text}</p>
              )}
              <div className="flex justify-end">
                <button
                  onClick={save}
                  disabled={saving || (hoursOn && (!start || !end))}
                  className="px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 text-sm font-medium disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
