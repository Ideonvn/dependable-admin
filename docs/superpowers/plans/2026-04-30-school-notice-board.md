# School Notice Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Notice Board tab to the school detail page, letting admins create/edit/delete scoped notices with file attachments, and view parent acknowledgement status per notice.

**Architecture:** Mirror the Calendar tab pattern exactly — a `notices/` subfolder under `src/components/school/` with a dedicated API module, list tab component, create/edit form modal, and detail/acknowledgement modal. All users of the admin portal have full access (no school-level role enforcement). Data fetching uses `useEffect` + local state, matching every other tab.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Axios (`apiClient` from `@/lib/api`), `react-markdown` (new dependency), lucide-react icons.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/types/notices.ts` | TypeScript types for notices, payloads, and acknowledgements |
| Create | `src/components/school/notices/noticesApi.ts` | All API calls for notices |
| Create | `src/components/school/notices/NoticesTab.tsx` | List view, page state, opens modals |
| Create | `src/components/school/notices/NoticeFormModal.tsx` | Create / edit form with attachment upload |
| Create | `src/components/school/notices/NoticeDetailModal.tsx` | Read-only detail + lazy-loaded ack panel |
| Modify | `src/app/schools/[id]/page.tsx` | Add Notices tab |
| Modify | `package.json` + lock file | Add `react-markdown` dependency |

---

## Task 1: Install `react-markdown`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install react-markdown
```

Expected output: `added 1 package` (or similar — no errors).

- [ ] **Step 2: Verify it resolves**

```bash
node -e "require('react-markdown'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-markdown dependency"
```

---

## Task 2: Define notice types

**Files:**
- Create: `src/types/notices.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/types/notices.ts

export type NoticeScope = 'SCHOOL' | 'CLASSROOM' | 'STUDENT';

export interface NoticeAttachment {
  s3_key: string;
  name: string;
  content_type: string;
  url: string; // presigned S3 URL — present on read, never sent in payloads
}

export interface Notice {
  id: string;
  school_id: string;
  title: string;
  content: string; // Markdown
  scope: NoticeScope;
  classroom_id: string | null;
  student_id: string | null;
  attachments: NoticeAttachment[];
  created_by: string | null;
  created_at: string; // ISO
  published_at: string | null;
  ack_state: null; // always null for admin — ignored
}

export interface AttachmentPayload {
  s3_key: string;
  name: string;
  content_type: string;
  // url is intentionally excluded — backend does not accept it
}

export interface NoticePayload {
  title: string;
  content: string;
  scope: NoticeScope;
  classroom_id: string | null;
  student_id: string | null;
  attachments: AttachmentPayload[];
}

export interface PaginatedNoticesResponse {
  data: Notice[];
  page: number;
  total: number;
  next_page: number | null;
}

export interface UploadedAttachment {
  s3_key: string;
  name: string;
  content_type: string;
}

export interface AcknowledgementEntry {
  user_id: string;
  name: string;
  state: 'seen' | 'acknowledged';
  timestamp: string;
}

export interface AcknowledgementSummary {
  total_recipients: number;
  acknowledged_count: number;
  entries: AcknowledgementEntry[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: no errors in `src/types/notices.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/types/notices.ts
git commit -m "feat: add notice board TypeScript types"
```

---

## Task 3: Build the notices API module

**Files:**
- Create: `src/components/school/notices/noticesApi.ts`

- [ ] **Step 1: Create the API module**

```typescript
// src/components/school/notices/noticesApi.ts

import apiClient from '@/lib/api';
import {
  Notice,
  NoticePayload,
  PaginatedNoticesResponse,
  AcknowledgementSummary,
  UploadedAttachment,
} from '@/types/notices';

const base = (schoolId: string) => `/schools/${schoolId}/notices`;

export async function fetchNotices(schoolId: string): Promise<Notice[]> {
  const response = await apiClient.get<PaginatedNoticesResponse>(base(schoolId), {
    params: { page: 1 },
  });
  return response.data.data;
}

export async function fetchNotice(schoolId: string, noticeId: string): Promise<Notice> {
  const response = await apiClient.get<Notice>(`${base(schoolId)}/${noticeId}`);
  return response.data;
}

export async function createNotice(schoolId: string, payload: NoticePayload): Promise<Notice> {
  const response = await apiClient.post<Notice>(base(schoolId), payload);
  return response.data;
}

export async function updateNotice(
  schoolId: string,
  noticeId: string,
  payload: NoticePayload,
): Promise<Notice> {
  const response = await apiClient.put<Notice>(`${base(schoolId)}/${noticeId}`, payload);
  return response.data;
}

export async function deleteNotice(schoolId: string, noticeId: string): Promise<void> {
  await apiClient.delete(`${base(schoolId)}/${noticeId}`);
}

export async function fetchAcknowledgements(
  schoolId: string,
  noticeId: string,
): Promise<AcknowledgementSummary> {
  const response = await apiClient.get<AcknowledgementSummary>(
    `${base(schoolId)}/${noticeId}/acknowledgements`,
  );
  return response.data;
}

export async function uploadAttachment(
  schoolId: string,
  file: File,
): Promise<UploadedAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<UploadedAttachment>(
    `${base(schoolId)}/attachments/upload`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data;
}
```

- [ ] **Step 2: Verify lint**

```bash
npm run lint
```

Expected: no errors in `src/components/school/notices/noticesApi.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/components/school/notices/noticesApi.ts
git commit -m "feat: add notices API module"
```

---

## Task 4: Build `NoticeFormModal`

**Files:**
- Create: `src/components/school/notices/NoticeFormModal.tsx`

This mirrors `EventFormModal.tsx`. It handles create and edit modes, scope-conditional pickers, and per-file attachment upload with progress.

- [ ] **Step 1: Create the component**

```typescript
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
```

- [ ] **Step 2: Verify lint**

```bash
npm run lint
```

Expected: no errors in `src/components/school/notices/NoticeFormModal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/school/notices/NoticeFormModal.tsx
git commit -m "feat: add NoticeFormModal component"
```

---

## Task 5: Build `NoticeDetailModal`

**Files:**
- Create: `src/components/school/notices/NoticeDetailModal.tsx`

- [ ] **Step 1: Create the component**

```typescript
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
import { Classroom, Student } from '@/lib/schools';
import { fetchAcknowledgements } from './noticesApi';

interface NoticeDetailModalProps {
  notice: Notice;
  schoolId: string;
  classrooms: Classroom[];
  students: Student[];
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
  classrooms,
  students,
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
      ? classrooms.find((c) => c.id === notice.classroom_id)?.name ?? notice.classroom_id
      : notice.scope === 'STUDENT'
      ? students.find((s) => s.id === notice.student_id)?.full_name ?? notice.student_id
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
```

- [ ] **Step 2: Verify lint**

```bash
npm run lint
```

Expected: no errors in `src/components/school/notices/NoticeDetailModal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/school/notices/NoticeDetailModal.tsx
git commit -m "feat: add NoticeDetailModal with acknowledgement panel"
```

---

## Task 6: Build `NoticesTab`

**Files:**
- Create: `src/components/school/notices/NoticesTab.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/school/notices/NoticesTab.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { Notice, NoticeScope } from '@/types/notices';
import { Classroom, Student } from '@/lib/schools';
import { schoolsApi } from '@/lib/schools';
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
    schoolsApi.getClassrooms(schoolId).then(setClassrooms).catch(console.error);
    schoolsApi.getStudents(schoolId).then(setStudents).catch(console.error);
  }, [schoolId, loadNotices]);

  function handleNewNotice() {
    setEditingNotice(null);
    setFormMode('create');
    setShowForm(true);
  }

  function handleRowClick(notice: Notice) {
    setSelectedNotice(notice);
  }

  function handleEditFromDetail() {
    if (!selectedNotice) return;
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
                ? classrooms.find((c) => c.id === notice.classroom_id)?.name
                : notice.scope === 'STUDENT'
                ? students.find((s) => s.id === notice.student_id)?.full_name
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
          classrooms={classrooms}
          students={students}
          onEdit={handleEditFromDetail}
          onClose={() => setSelectedNotice(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/school/notices/NoticesTab.tsx
git commit -m "feat: add NoticesTab list component"
```

---

## Task 7: Wire up the Notices tab in the school page

**Files:**
- Modify: `src/app/schools/[id]/page.tsx`

- [ ] **Step 1: Add the import**

At the top of `src/app/schools/[id]/page.tsx`, after the existing `CalendarTab` import, add:

```typescript
import NoticesTab from '@/components/school/notices/NoticesTab';
```

Also add `Bell` to the lucide-react import line. The current import is:
```typescript
import { ArrowLeft, Building2, Users, BookOpen, UserCog, ClipboardCheck, Receipt, Calendar, CalendarDays, Download, RefreshCw, Loader2 } from 'lucide-react';
```
Change it to:
```typescript
import { ArrowLeft, Building2, Users, BookOpen, UserCog, ClipboardCheck, Receipt, Calendar, CalendarDays, Bell, Download, RefreshCw, Loader2 } from 'lucide-react';
```

- [ ] **Step 2: Add `'notices'` to the `TabType` union**

Find:
```typescript
type TabType = 'details' | 'students' | 'membership' | 'classrooms' | 'enrollments' | 'schoolYears' | 'billing' | 'calendar';
```
Replace with:
```typescript
type TabType = 'details' | 'students' | 'membership' | 'classrooms' | 'enrollments' | 'schoolYears' | 'billing' | 'calendar' | 'notices';
```

- [ ] **Step 3: Add `'notices'` to the hash guard**

Find:
```typescript
if (['details', 'students', 'membership', 'classrooms', 'enrollments', 'schoolYears', 'billing', 'calendar'].includes(hash)) {
```
Replace with:
```typescript
if (['details', 'students', 'membership', 'classrooms', 'enrollments', 'schoolYears', 'billing', 'calendar', 'notices'].includes(hash)) {
```

- [ ] **Step 4: Add the tab entry**

In the `tabs` array, after the `calendar` entry and before the `billing` entry:
```typescript
{ id: 'notices' as TabType, label: 'Notices', icon: Bell },
```

The tabs array should look like:
```typescript
const tabs = [
  { id: 'details' as TabType, label: 'Details', icon: Building2 },
  { id: 'students' as TabType, label: 'Students', icon: Users },
  { id: 'membership' as TabType, label: 'Membership', icon: UserCog },
  { id: 'classrooms' as TabType, label: 'Classrooms', icon: BookOpen },
  { id: 'enrollments' as TabType, label: 'Enrollments', icon: ClipboardCheck },
  { id: 'schoolYears' as TabType, label: 'School Years', icon: Calendar },
  { id: 'calendar' as TabType, label: 'Calendar', icon: CalendarDays },
  { id: 'notices' as TabType, label: 'Notices', icon: Bell },
  { id: 'billing' as TabType, label: 'Billing', icon: Receipt },
];
```

- [ ] **Step 5: Add the tab content renderer**

In the tab content section, after `{activeTab === 'calendar' && <CalendarTab schoolId={school.id} />}`, add:
```typescript
{activeTab === 'notices' && <NoticesTab schoolId={school.id} />}
```

- [ ] **Step 6: Verify lint and build**

```bash
npm run lint && npm run build
```

Expected: no errors, build completes successfully.

- [ ] **Step 7: Commit**

```bash
git add src/app/schools/[id]/page.tsx
git commit -m "feat: add Notices tab to school detail page"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Notice list with scope badge, title, date | Task 6 |
| Empty state | Task 6 |
| "New Notice" button | Task 6 |
| Create/edit form (title, content, scope, pickers, attachments) | Task 4 |
| Attachment upload-first flow with per-file progress | Task 4 |
| Edit pre-populates fields; existing attachments kept by s3_key | Task 4 |
| Delete with confirmation | Task 4 |
| Detail modal: scope badge, meta, markdown content | Task 5 |
| Attachments: images as thumbnails, others as download links | Task 5 |
| Acknowledgements panel: lazy-load, summary, progress bar, table | Task 5 |
| Ack state badges (seen/acknowledged) | Task 5 |
| Notices tab wired into school page with Bell icon | Task 7 |
| react-markdown installed | Task 1 |
| TypeScript types | Task 2 |
| API module | Task 3 |

**Placeholder scan:** No TBDs, no "similar to task N" references, no "add appropriate error handling" — each step has complete code.

**Type consistency:**
- `NoticeScope`, `Notice`, `NoticePayload`, `AttachmentPayload`, `AcknowledgementSummary`, `UploadedAttachment` defined in Task 2, used consistently across Tasks 3–6.
- `scopeBadgeStyle` defined independently in both `NoticesTab` and `NoticeDetailModal` (no shared import needed — both are small self-contained functions).
- `formatDate` defined independently in both `NoticesTab` and `NoticeDetailModal` (same reason).
- `fetchNotices`, `createNotice`, `updateNotice`, `deleteNotice`, `uploadAttachment`, `fetchAcknowledgements` all defined in Task 3, imported by name in Tasks 4–6. ✓
