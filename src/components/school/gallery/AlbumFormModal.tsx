// src/components/school/gallery/AlbumFormModal.tsx
'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import posthog from 'posthog-js';
import { AlertCircle, Info, Lock, Trash2, X } from 'lucide-react';
import { AlbumPayload, GalleryAlbumSummary, GalleryScope } from '@/types/gallery';
import { Classroom, Student } from '@/lib/schools';
import { parseApiError } from '@/lib/apiError';
import { createAlbum, deleteAlbum, updateAlbum } from './galleryApi';

interface AlbumFormModalProps {
  mode: 'create' | 'edit';
  schoolId: string;
  album?: GalleryAlbumSummary;
  classrooms: Classroom[];
  students: Student[];
  onSuccess: (album: GalleryAlbumSummary) => void;
  onDeleted?: () => void;
  onClose: () => void;
}

function scopeColor(scope: GalleryScope, isDark: boolean): string {
  switch (scope) {
    case 'SCHOOL':
      return isDark ? '#20B2AA' : '#1A1A6D';
    case 'CLASSROOM':
      return isDark ? 'rgba(70,130,180,1)' : 'rgba(135,206,250,1)';
    case 'STUDENT':
      return isDark ? '#4CAF50' : '#10B981';
  }
}

export default function AlbumFormModal({
  mode,
  schoolId,
  album,
  classrooms,
  students,
  onSuccess,
  onDeleted,
  onClose,
}: AlbumFormModalProps) {
  const [title, setTitle] = useState(album?.title ?? '');
  const [description, setDescription] = useState(album?.description ?? '');
  const [scope, setScope] = useState<GalleryScope>(album?.scope ?? 'SCHOOL');
  const [classroomId, setClassroomId] = useState(album?.classroom_id ?? '');
  const [studentId, setStudentId] = useState(album?.student_id ?? '');
  // Defaults on for a new album; on edit it is seeded from the album so saving
  // a title change cannot flip it.
  const [allowDownload, setAllowDownload] = useState(album?.allow_download ?? true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // An album's audience cannot be changed after it has been published. Note
  // that allow_download deliberately is NOT covered by this — it stays editable.
  const audienceLocked = mode === 'edit' && !!album && !album.is_draft;
  const downloadsOffAfterPublish = audienceLocked && !allowDownload;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!audienceLocked && scope === 'CLASSROOM' && !classroomId) {
      setError('classroom_id is required when scope is CLASSROOM');
      return;
    }
    if (!audienceLocked && scope === 'STUDENT' && !studentId) {
      setError('student_id is required when scope is STUDENT');
      return;
    }

    const payload: AlbumPayload = {
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      scope,
      classroom_id: scope === 'CLASSROOM' ? classroomId : null,
      student_id: scope === 'STUDENT' ? studentId : null,
      allow_download: allowDownload,
    };

    setSubmitting(true);
    try {
      if (mode === 'create') {
        const created = await createAlbum(schoolId, payload);
        posthog.capture('album_created', {
          school_id: schoolId,
          album_id: created.id,
          scope: created.scope,
        });
        onSuccess(created);
      } else if (album) {
        const updated = await updateAlbum(schoolId, album.id, payload);
        onSuccess(updated);
      }
      onClose();
    } catch (err) {
      const parsed = parseApiError(err);
      setError(parsed.message);
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!album) return;
    setSubmitting(true);
    try {
      await deleteAlbum(schoolId, album.id);
      posthog.capture('album_deleted', {
        school_id: schoolId,
        album_id: album.id,
        scope: album.scope,
      });
      onDeleted?.();
      onClose();
    } catch (err) {
      setError(parseApiError(err).message);
      setSubmitting(false);
    }
  }

  const color = scopeColor(scope, isDark);
  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-60';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-[55] p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-lg w-full my-8">
        <div className="h-1.5 rounded-t-lg" style={{ backgroundColor: color }} />

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {mode === 'create' ? 'New Album' : 'Edit Album'}
          </h2>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Sports day, Grade R outing…"
              disabled={submitting}
              autoFocus
              className={inputClass}
            />
            {fieldErrors.title && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.title}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional - a line of context for parents."
              rows={3}
              disabled={submitting}
              className={`${inputClass} resize-y`}
            />
            {fieldErrors.description && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.description}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Audience <span className="text-red-500">*</span>
            </label>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as GalleryScope)}
              disabled={submitting || audienceLocked}
              className={inputClass}
            >
              <option value="SCHOOL">School</option>
              <option value="CLASSROOM">Classroom</option>
              <option value="STUDENT">Student</option>
            </select>
            {audienceLocked && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <Lock className="w-3 h-3 flex-shrink-0" />
                An album&apos;s audience cannot be changed after it has been published.
              </p>
            )}
          </div>

          {scope === 'CLASSROOM' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Classroom <span className="text-red-500">*</span>
              </label>
              <select
                value={classroomId}
                onChange={(event) => setClassroomId(event.target.value)}
                disabled={submitting || audienceLocked}
                className={inputClass}
              >
                <option value="">Select classroom…</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </option>
                ))}
              </select>
              {fieldErrors.classroom_id && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {fieldErrors.classroom_id}
                </p>
              )}
            </div>
          )}

          {scope === 'STUDENT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Student <span className="text-red-500">*</span>
              </label>
              <select
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                disabled={submitting || audienceLocked}
                className={inputClass}
              >
                <option value="">Select student…</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name}
                  </option>
                ))}
              </select>
              {fieldErrors.student_id && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {fieldErrors.student_id}
                </p>
              )}
            </div>
          )}

          {/* Downloads stay editable after publish, unlike the audience. */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowDownload}
                onChange={(event) => setAllowDownload(event.target.checked)}
                disabled={submitting}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-700 accent-[#1A1A6D] dark:accent-[#20B2AA] disabled:opacity-60"
              />
              <span>
                <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Allow parents to download photos
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Parents can save photos from this album to their phone. Turning this off hides
                  the save buttons in the app — it does not prevent a determined person from
                  keeping a copy.
                </span>
              </span>
            </label>
            {downloadsOffAfterPublish && (
              <p className="mt-2 ml-7 text-xs text-amber-700 dark:text-amber-300">
                Photos parents have already saved stay on their phones.
              </p>
            )}
          </div>

          {/* The album workbench autosaves; this form does not. The two sit one
              click apart, so the difference has to be stated in both places. */}
          <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              {mode === 'create'
                ? 'These details save when you create the album. Photos, captions and order then save automatically as you work on it.'
                : 'These details save when you click Save Changes. Photos, captions and order in the album save automatically as you work.'}
            </span>
          </p>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
            {mode === 'edit' ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-600 dark:text-red-400">Delete this album?</span>
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
                ) : mode === 'create' ? (
                  'Create Album'
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
