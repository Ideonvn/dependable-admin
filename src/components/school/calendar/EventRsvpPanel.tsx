'use client';

import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { RsvpEntry, RsvpSummary } from '@/types/calendar';
import { fetchEventRsvps } from './calendarApi';

interface EventRsvpPanelProps {
  schoolId: string;
  eventId: string;
  occurrenceDate: string; // the occurrence's UTC date, YYYY-MM-DD
}

const STATE_STYLES: Record<RsvpEntry['state'], { label: string; className: string }> = {
  YES: {
    label: 'going',
    className: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200',
  },
  MAYBE: {
    label: 'maybe',
    className: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
  },
  NO: {
    label: 'not going',
    className: 'bg-slate-200 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200',
  },
  NOTIFIED: {
    label: 'no reply',
    className: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Same shape as the Acknowledgements panel in NoticeDetailModal.
export default function EventRsvpPanel({ schoolId, eventId, occurrenceDate }: EventRsvpPanelProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<RsvpSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchEventRsvps(schoolId, eventId, occurrenceDate));
    } catch {
      setError('Failed to load responses');
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    if (!open && !data && !loading) load();
    setOpen((prev) => !prev);
  }

  const counts = data
    ? [
        { label: 'Going', value: data.yes_count, bar: 'bg-emerald-500' },
        { label: 'Maybe', value: data.maybe_count, bar: 'bg-amber-500' },
        { label: 'Not going', value: data.no_count, bar: 'bg-[#7A8899]' },
      ]
    : [];
  const replied = data ? data.yes_count + data.maybe_count + data.no_count : 0;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <span>Responses</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {open && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <div className="w-6 h-6 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-800 dark:text-red-300 flex-1">{error}</span>
              <button
                type="button"
                onClick={load}
                className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          )}

          {data && !loading && (
            <>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {replied} / {data.total_recipients} replied
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {counts.map((c) => `${c.value} ${c.label.toLowerCase()}`).join(' · ')}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 flex overflow-hidden">
                  {data.total_recipients > 0 &&
                    counts.map((c) => (
                      <div
                        key={c.label}
                        className={`${c.bar} h-2 transition-all`}
                        style={{ width: `${(c.value / data.total_recipients) * 100}%` }}
                      />
                    ))}
                </div>
              </div>

              {data.entries.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2 font-medium">Name</th>
                        <th className="pb-2 font-medium">Reply</th>
                        <th className="pb-2 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {data.entries.map((entry) => (
                        <tr key={entry.user_id}>
                          <td className="py-2 text-gray-900 dark:text-gray-100">{entry.name}</td>
                          <td className="py-2">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATE_STYLES[entry.state].className}`}
                            >
                              {STATE_STYLES[entry.state].label}
                            </span>
                          </td>
                          <td className="py-2 text-gray-500 dark:text-gray-400">{formatDate(entry.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No one has been notified yet.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
