// src/components/school/notices/NoticeDetailModal.tsx
'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  X,
  Pencil,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Paperclip,
  RefreshCw,
} from 'lucide-react';
import { Notice, NoticeScope, AcknowledgementSummary } from '@/types/notices';
import { fetchAcknowledgements } from './noticesApi';

interface NoticeDetailModalProps {
  notice: Notice;
  schoolId: string;
  onEdit: () => void;
  onClose: () => void;
}

function scopeBadgeStyle(scope: NoticeScope): { bg: string; text: string } {
  switch (scope) {
    case 'SCHOOL':
      return {
        bg: 'bg-[#1A1A6D] dark:bg-[#20B2AA]',
        text: 'text-white',
      };
    case 'CLASSROOM':
      return {
        bg: 'bg-blue-100 dark:bg-blue-900/40',
        text: 'text-blue-800 dark:text-blue-200',
      };
    case 'STUDENT':
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-900/40',
        text: 'text-emerald-800 dark:text-emerald-200',
      };
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isImage(contentType: string): boolean {
  return contentType.startsWith('image/');
}

export default function NoticeDetailModal({
  notice,
  schoolId,
  onEdit,
  onClose,
}: NoticeDetailModalProps) {
  const [ackOpen, setAckOpen] = useState(false);
  const [ackData, setAckData] = useState<AcknowledgementSummary | null>(null);
  const [ackLoading, setAckLoading] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);

  const badge = scopeBadgeStyle(notice.scope);

  const scopeTargetName =
    notice.scope === 'CLASSROOM'
      ? (notice.classroom_name ?? notice.classroom_id)
      : notice.scope === 'STUDENT'
      ? (notice.student_name ?? notice.student_id)
      : null;

  async function loadAcknowledgements() {
    setAckLoading(true);
    setAckError(null);
    try {
      const data = await fetchAcknowledgements(schoolId, notice.id);
      setAckData(data);
    } catch {
      setAckError('Failed to load acknowledgements');
    } finally {
      setAckLoading(false);
    }
  }

  function handleToggleAck() {
    if (!ackOpen && !ackData && !ackLoading) {
      loadAcknowledgements();
    }
    setAckOpen((prev) => !prev);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-2xl w-full my-8">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}
              >
                {notice.scope}
              </span>
              {scopeTargetName && (
                <span className="text-xs text-gray-500 dark:text-gray-400">{scopeTargetName}</span>
              )}
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 break-words">
              {notice.title}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatDate(notice.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          {/* Content */}
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200">
            <ReactMarkdown>{notice.content}</ReactMarkdown>
          </div>

          {/* Attachments */}
          {notice.attachments.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Attachments
              </h3>
              <div className="space-y-2">
                {notice.attachments.map((a) =>
                  isImage(a.content_type) ? (
                    <a
                      key={a.s3_key}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mr-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.url}
                        alt={a.name}
                        className="max-h-[120px] rounded border border-gray-200 dark:border-gray-700 object-cover hover:opacity-90 transition-opacity"
                      />
                    </a>
                  ) : (
                    <a
                      key={a.s3_key}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-[#1A1A6D] dark:text-[#20B2AA] hover:underline"
                    >
                      <Paperclip className="w-4 h-4 flex-shrink-0" />
                      {a.name}
                    </a>
                  ),
                )}
              </div>
            </div>
          )}

          {/* Acknowledgements panel */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={handleToggleAck}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <span>Acknowledgements</span>
              {ackOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {ackOpen && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                {ackLoading && (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-6 h-6 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {ackError && !ackLoading && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <span className="text-sm text-red-800 dark:text-red-300 flex-1">{ackError}</span>
                    <button
                      onClick={loadAcknowledgements}
                      className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 hover:underline"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Retry
                    </button>
                  </div>
                )}

                {ackData && !ackLoading && (
                  <>
                    {/* Summary */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {ackData.acknowledged_count} / {ackData.total_recipients} acknowledged
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {ackData.total_recipients > 0
                            ? Math.round(
                                (ackData.acknowledged_count / ackData.total_recipients) * 100,
                              )
                            : 0}
                          %
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-[#1A1A6D] dark:bg-[#20B2AA] h-2 rounded-full transition-all"
                          style={{
                            width:
                              ackData.total_recipients > 0
                                ? `${(ackData.acknowledged_count / ackData.total_recipients) * 100}%`
                                : '0%',
                          }}
                        />
                      </div>
                    </div>

                    {/* Entries table */}
                    {ackData.entries.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                              <th className="pb-2 font-medium">Name</th>
                              <th className="pb-2 font-medium">State</th>
                              <th className="pb-2 font-medium">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {ackData.entries.map((entry) => (
                              <tr key={entry.user_id}>
                                <td className="py-2 text-gray-900 dark:text-gray-100">
                                  {entry.name}
                                </td>
                                <td className="py-2">
                                  {entry.state === 'acknowledged' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200">
                                      acknowledged
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">
                                      seen
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 text-gray-500 dark:text-gray-400">
                                  {formatDate(entry.timestamp)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        No acknowledgements yet.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
