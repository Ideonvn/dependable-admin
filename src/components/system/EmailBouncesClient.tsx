'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { ArrowLeft, MailX, RefreshCw, Search, ShieldOff } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { emailBouncesApi, EmailHardBounce } from '@/lib/emailBounces';
import { parseApiError } from '@/lib/apiError';

const PAGE_SIZE = 50;

type BlockedFilter = 'blocked' | 'unblocked' | 'all';

const FILTERS: { value: BlockedFilter; label: string }[] = [
  { value: 'blocked', label: 'Blocked' },
  { value: 'unblocked', label: 'Unblocked' },
  { value: 'all', label: 'All' },
];

const EMPTY_MESSAGE: Record<BlockedFilter, string> = {
  blocked: 'No blocked addresses.',
  unblocked: 'No addresses have been unblocked.',
  all: 'No bounced addresses.',
};

// Backend sends UTC ISO-8601; render in the admin's local time.
const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function EmailBouncesClient() {
  const [bounces, setBounces] = useState<EmailHardBounce[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [blockedFilter, setBlockedFilter] = useState<BlockedFilter>('blocked');
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unblockTarget, setUnblockTarget] = useState<EmailHardBounce | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Search is only sent at 3+ characters - shorter values are a 422 on the backend.
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchTerm.trim();
      setDebouncedSearch(trimmed.length >= 3 ? trimmed : '');
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadBounces = async (page: number = 1) => {
    setLoading(true);
    setError(null);
    try {
      const response = await emailBouncesApi.getHardBounces({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        blocked: blockedFilter === 'all' ? undefined : blockedFilter === 'blocked',
      });
      setBounces(response.hard_bounces);
      setTotal(response.total);
      setCurrentPage(response.page);
    } catch (err) {
      console.error('Failed to load email hard bounces:', err);
      setError('Failed to load the email blocklist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadBounces(1);
  }, [debouncedSearch, blockedFilter]);

  const confirmUnblock = async () => {
    if (!unblockTarget) return;

    const target = unblockTarget;
    setActionLoading(true);
    setError(null);
    try {
      await emailBouncesApi.unblock(target.id);
      // Flip in place rather than removing the row, so the admin sees the change land.
      setBounces((current) =>
        current.map((bounce) =>
          bounce.id === target.id
            ? { ...bounce, blocked: false, unblocked_at: bounce.unblocked_at ?? new Date().toISOString() }
            : bounce
        )
      );
    } catch (err) {
      console.error('Failed to unblock address:', err);
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setError('That address is no longer on the blocklist. The list has been refreshed.');
        await loadBounces(currentPage);
      } else {
        setError(parseApiError(err).message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-[#0F1115]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <MailX className="w-8 h-8 text-[#1A1A6D] dark:text-[#20B2AA]" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Email Blocklist</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Addresses that permanently rejected our mail. We stop sending to them to protect delivery for
              everyone else. Unblocking applies across all schools.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadBounces(currentPage)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Schools
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm mb-6">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 dark:text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by email address (3 characters or more)"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
            />
          </div>

          <div className="flex items-center rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden self-start">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setBlockedFilter(filter.value)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  blockedFilter === filter.value
                    ? 'bg-[#1A1A6D] dark:bg-[#20B2AA] text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full">
                <thead className="bg-gray-100 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Email Address</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Last Bounce</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase" title="Sends suppressed since the first bounce">Attempts</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {bounces.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors align-top">
                      <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                        <div>{row.email_address}</div>
                        {row.message && (
                          <details className="mt-1 max-w-md">
                            <summary className="cursor-pointer text-xs font-normal text-[#1A1A6D] dark:text-[#20B2AA] hover:underline">
                              Provider message
                            </summary>
                            <p className="mt-1 text-xs font-normal text-gray-600 dark:text-gray-400 break-words">
                              {row.message}
                            </p>
                          </details>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatDateTime(row.bounced_at)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{row.reason || '-'}</td>
                      <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{row.attempts}</td>
                      <td className="px-4 py-4 text-sm whitespace-nowrap">
                        {row.blocked ? (
                          <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            Blocked
                          </span>
                        ) : (
                          <span
                            className="inline-flex rounded-full px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            title={row.unblocked_at ? `Unblocked ${formatDateTime(row.unblocked_at)}` : undefined}
                          >
                            Unblocked
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-right">
                        {row.blocked && (
                          <button
                            onClick={() => setUnblockTarget(row)}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ShieldOff className="w-4 h-4" />
                            Unblock
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {bounces.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-600 dark:text-gray-400">
                        {debouncedSearch ? 'No addresses match your search.' : EMPTY_MESSAGE[blockedFilter]}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {total > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, total)} of {total} addresses
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadBounces(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <div className="text-sm text-gray-600 dark:text-gray-400 px-3">
                    Page {currentPage} of {totalPages}
                  </div>
                  <button
                    onClick={() => loadBounces(currentPage + 1)}
                    disabled={currentPage >= totalPages || loading}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={unblockTarget !== null}
        onClose={() => setUnblockTarget(null)}
        onConfirm={confirmUnblock}
        title="Unblock this address?"
        message={`${unblockTarget?.email_address ?? ''} will receive mail from the platform again, for every school. If it hard bounces again it will be blocked automatically.`}
        confirmText="Unblock"
        variant="warning"
      />
    </main>
  );
}
