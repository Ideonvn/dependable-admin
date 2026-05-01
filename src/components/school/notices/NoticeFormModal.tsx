// src/components/school/notices/NoticeFormModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Trash2, Paperclip, Upload, XCircle } from 'lucide-react';
import { Notice, NoticeScope, NoticePayload, AttachmentPayload, NoticeAttachment } from '@/types/notices';
import { schoolsApi, Classroom, Student } from '@/lib/schools';
import { createNotice, updateNotice, deleteNotice, uploadAttachment } from './noticesApi';

interface NoticeFormModalProps {
  mode: 'create' | 'edit';
  schoolId: string;
  notice?: Notice;
  onSuccess: () => void;
  onClose: () => void;
}

type UploadingFile = {
  id: string; // local id for keying
  file: File;
  status: 'uploading' | 'done' | 'error';
  result?: AttachmentPayload;
  error?: string;
};

function scopeColor(scope: NoticeScope, isDark: boolean): string {
  switch (scope) {
    case 'SCHOOL':
      return isDark ? '#20B2AA' : '#1A1A6D';
    case 'CLASSROOM':
      return isDark ? 'rgba(70,130,180,1)' : 'rgba(135,206,250,1)';
    case 'STUDENT':
      return isDark ? '#4CAF50' : '#10B981';
  }
}

function attachmentToPayload(a: NoticeAttachment): AttachmentPayload {
  return { s3_key: a.s3_key, name: a.name, content_type: a.content_type };
}

export default function NoticeFormModal({
  mode,
  schoolId,
  notice,
  onSuccess,
  onClose,
}: NoticeFormModalProps) {
  const [title, setTitle] = useState(notice?.title ?? '');
  const [content, setContent] = useState(notice?.content ?? '');
  const [scope, setScope] = useState<NoticeScope>(notice?.scope ?? 'SCHOOL');
  const [classroomId, setClassroomId] = useState(notice?.classroom_id ?? '');
  const [studentId, setStudentId] = useState(notice?.student_id ?? '');

  // Existing attachments (from notice on edit) that the user has not removed
  const [existingAttachments, setExistingAttachments] = useState<NoticeAttachment[]>(
    notice?.attachments ?? [],
  );
  // New files being uploaded or already uploaded this session
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use next-themes via CSS class detection (matches existing EventFormModal pattern)
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');

  useEffect(() => {
    schoolsApi.getClassrooms(schoolId).then(setClassrooms).catch(console.error);
    schoolsApi.getStudents(schoolId).then(setStudents).catch(console.error);
  }, [schoolId]);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    // Reset input so the same file can be re-selected after error
    e.target.value = '';

    const newEntries: UploadingFile[] = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      status: 'uploading',
    }));

    setUploadingFiles((prev) => [...prev, ...newEntries]);

    for (const entry of newEntries) {
      try {
        const result = await uploadAttachment(schoolId, entry.file);
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id ? { ...f, status: 'done', result } : f,
          ),
        );
      } catch {
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? { ...f, status: 'error', error: 'Upload failed' }
              : f,
          ),
        );
      }
    }
  }

  function removeExistingAttachment(s3Key: string) {
    setExistingAttachments((prev) => prev.filter((a) => a.s3_key !== s3Key));
  }

  function removeUploadingFile(id: string) {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function buildAttachmentsPayload(): AttachmentPayload[] {
    const existing = existingAttachments.map(attachmentToPayload);
    const uploaded = uploadingFiles
      .filter((f) => f.status === 'done' && f.result)
      .map((f) => f.result!);
    return [...existing, ...uploaded];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) { setError('Title is required'); return; }
    if (!content.trim()) { setError('Content is required'); return; }
    if (scope === 'CLASSROOM' && !classroomId) { setError('Please select a classroom'); return; }
    if (scope === 'STUDENT' && !studentId) { setError('Please select a student'); return; }

    const anyUploading = uploadingFiles.some((f) => f.status === 'uploading');
    if (anyUploading) { setError('Please wait for all uploads to complete'); return; }

    const payload: NoticePayload = {
      title: title.trim(),
      content: content.trim(),
      scope,
      classroom_id: scope === 'CLASSROOM' ? classroomId : null,
      student_id: scope === 'STUDENT' ? studentId : null,
      attachments: buildAttachmentsPayload(),
    };

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createNotice(schoolId, payload);
      } else if (notice) {
        await updateNotice(schoolId, notice.id, payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!notice) return;
    setSubmitting(true);
    try {
      await deleteNotice(schoolId, notice.id);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete notice');
    } finally {
      setSubmitting(false);
    }
  }

  const color = scopeColor(scope, isDark);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-lg w-full my-8">
        {/* Coloured top bar */}
        <div className="h-1.5 rounded-t-lg" style={{ backgroundColor: color }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {mode === 'create' ? 'New Notice' : 'Edit Notice'}
          </h2>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notice title"
              disabled={submitting}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your notice here… Markdown is supported."
              rows={6}
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-y font-mono text-sm"
            />
          </div>

          {/* Scope */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Scope <span className="text-red-500">*</span>
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as NoticeScope)}
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="SCHOOL">School</option>
              <option value="CLASSROOM">Classroom</option>
              <option value="STUDENT">Student</option>
            </select>
          </div>

          {/* Classroom picker */}
          {scope === 'CLASSROOM' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Classroom <span className="text-red-500">*</span>
              </label>
              <select
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">Select classroom…</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Student picker */}
          {scope === 'STUDENT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Student <span className="text-red-500">*</span>
              </label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">Select student…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Attachments
            </label>

            {/* Existing attachments (edit mode) */}
            {existingAttachments.map((a) => (
              <div
                key={a.s3_key}
                className="flex items-center gap-2 mb-1 text-sm text-gray-700 dark:text-gray-300"
              >
                <Paperclip className="w-4 h-4 flex-shrink-0 text-gray-400" />
                <span className="truncate flex-1">{a.name}</span>
                <button
                  type="button"
                  onClick={() => removeExistingAttachment(a.s3_key)}
                  disabled={submitting}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* New files being uploaded */}
            {uploadingFiles.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 mb-1 text-sm"
              >
                {f.status === 'uploading' && (
                  <div className="w-4 h-4 border-2 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
                {f.status === 'done' && (
                  <Paperclip className="w-4 h-4 flex-shrink-0 text-green-500" />
                )}
                {f.status === 'error' && (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                )}
                <span
                  className={`truncate flex-1 ${
                    f.status === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {f.file.name}
                  {f.status === 'error' && ` — ${f.error}`}
                </span>
                {f.status !== 'uploading' && (
                  <button
                    type="button"
                    onClick={() => removeUploadingFile(f.id)}
                    disabled={submitting}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {/* File picker button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              Add files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFilesSelected}
              className="hidden"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
            {mode === 'edit' ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-600 dark:text-red-400">Are you sure?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={submitting}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={submitting}
                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={submitting}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </>
                ) : mode === 'create' ? 'Create Notice' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
