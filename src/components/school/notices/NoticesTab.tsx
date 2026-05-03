// src/components/school/notices/NoticesTab.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { Notice, NoticeScope } from '@/types/notices';
import { schoolsApi, Classroom, Student } from '@/lib/schools';
import { fetchNotices } from './noticesApi';
import NoticeFormModal from './NoticeFormModal';
import NoticeDetailModal from './NoticeDetailModal';

interface NoticesTabProps {
  schoolId: string;
}

function scopeBadgeStyle(scope: NoticeScope): { bg: string; text: string } {
  switch (scope) {
    case 'SCHOOL':
      return { bg: 'bg-[#1A1A6D] dark:bg-[#20B2AA]', text: 'text-white' };
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

export default function NoticesTab({ schoolId }: NoticesTabProps) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [formDataLoaded, setFormDataLoaded] = useState(false);

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  const loadNotices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotices(schoolId);
      setNotices(data);
    } catch {
      setError('Failed to load notices');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    loadNotices();
  }, [loadNotices]);

  function loadFormData() {
    if (formDataLoaded) return;
    Promise.all([
      schoolsApi.getClassrooms(schoolId).then(setClassrooms),
      schoolsApi.getStudents(schoolId).then(setStudents),
    ])
      .then(() => setFormDataLoaded(true))
      .catch(console.error);
  }

  function handleNewNotice() {
    loadFormData();
    setEditingNotice(null);
    setFormMode('create');
    setShowForm(true);
  }

  function handleRowClick(notice: Notice) {
    setSelectedNotice(notice);
  }

  function handleEditFromDetail() {
    if (!selectedNotice) return;
    loadFormData();
    setEditingNotice(selectedNotice);
    setFormMode('edit');
    setSelectedNotice(null);
    setShowForm(true);
  }

  function handleSuccess() {
    loadNotices();
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notices</h2>
        <button
          onClick={handleNewNotice}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Notice
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-800 dark:text-red-300 flex-1">{error}</span>
          <button
            onClick={loadNotices}
            className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && notices.length === 0 && (
        <div className="text-center py-20">
          <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No notices yet. Create the first one.
          </p>
        </div>
      )}

      {/* List */}
      {!loading && !error && notices.length > 0 && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {notices.map((notice) => {
            const badge = scopeBadgeStyle(notice.scope);
            const scopeTarget =
              notice.scope === 'CLASSROOM'
                ? notice.classroom_name
                : notice.scope === 'STUDENT'
                ? notice.student_name
                : null;

            return (
              <button
                key={notice.id}
                onClick={() => handleRowClick(notice)}
                className="w-full flex items-center gap-4 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-lg px-2 -mx-2"
              >
                {/* Scope badge */}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${badge.bg} ${badge.text}`}
                >
                  {notice.scope}
                </span>

                {/* Title + scope target */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {notice.title}
                  </p>
                  {scopeTarget && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {scopeTarget}
                    </p>
                  )}
                </div>

                {/* Date */}
                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                  {formatDate(notice.created_at)}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-600 flex-shrink-0">
                  — ack
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <NoticeFormModal
          mode={formMode}
          schoolId={schoolId}
          notice={editingNotice ?? undefined}
          classrooms={classrooms}
          students={students}
          onSuccess={handleSuccess}
          onClose={() => {
            setShowForm(false);
            setEditingNotice(null);
          }}
        />
      )}

      {/* Detail modal */}
      {selectedNotice && (
        <NoticeDetailModal
          notice={selectedNotice}
          schoolId={schoolId}
          onEdit={handleEditFromDetail}
          onClose={() => setSelectedNotice(null)}
        />
      )}
    </div>
  );
}
