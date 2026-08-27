// src/components/school/gallery/AlbumDetailModal.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import posthog from 'posthog-js';
import {
  AlertCircle,
  CloudCheck,
  Images,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { Classroom, Student } from '@/lib/schools';
import { parseApiError } from '@/lib/apiError';
import {
  GalleryAlbumDetail,
  GalleryPhoto,
  GalleryScope,
  MAX_PHOTOS_PER_ALBUM,
} from '@/types/gallery';
import {
  deleteAlbum,
  deletePhoto,
  fetchAlbum,
  publishAlbum,
  reorderPhotos,
  updatePhotoCaption,
} from './galleryApi';
import AlbumFormModal from './AlbumFormModal';
import PhotoGrid from './PhotoGrid';
import PhotoLightbox from './PhotoLightbox';
import UploadDropzone from './UploadDropzone';

// Presigned URLs live for 900s. Anything older than this gets refreshed the
// moment the admin comes back to the window.
const URL_STALE_MS = 10 * 60 * 1000;
// Same budget as MAX_CONCURRENT_UPLOADS in UploadDropzone, for the same
// reason: these all hit one album, so keep only a handful in flight.
const MAX_CONCURRENT_DELETES = 4;

interface AlbumDetailModalProps {
  schoolId: string;
  schoolName: string;
  albumId: string;
  classrooms: Classroom[];
  students: Student[];
  onClose: () => void;
}

function scopeBadgeStyle(scope: GalleryScope): { bg: string; text: string } {
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

export default function AlbumDetailModal({
  schoolId,
  schoolName,
  albumId,
  classrooms,
  students,
  onClose,
}: AlbumDetailModalProps) {
  const [album, setAlbum] = useState<GalleryAlbumDetail | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [photoTotal, setPhotoTotal] = useState(0);
  const [nextPhotoPage, setNextPhotoPage] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDeleteAlbum, setConfirmDeleteAlbum] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const anchorRef = useRef<number | null>(null);
  const fetchedAtRef = useRef(0);
  const refreshingRef = useRef(false);
  // At most one image-error-driven refetch per data load, so an album whose
  // images are genuinely broken cannot turn into a background poll.
  const errorRefreshedRef = useRef(false);
  const loadedPagesRef = useRef(1);

  const loadAlbum = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchAlbum(schoolId, albumId, 1);
      setAlbum(detail);
      setPhotos(detail.photos);
      setPhotoTotal(detail.photo_total);
      setNextPhotoPage(detail.photo_next_page);
      loadedPagesRef.current = 1;
      fetchedAtRef.current = Date.now();
      errorRefreshedRef.current = false;
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [schoolId, albumId]);

  useEffect(() => {
    loadAlbum();
  }, [loadAlbum]);

  // Re-fetching the album IS the presigned-URL refresh mechanism; the list
  // endpoint was optimised so this is cheap.
  const refreshUrls = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const collected: GalleryPhoto[] = [];
      let latest: GalleryAlbumDetail | null = null;
      for (let page = 1; page <= loadedPagesRef.current; page += 1) {
        const detail = await fetchAlbum(schoolId, albumId, page);
        collected.push(...detail.photos);
        latest = detail;
      }
      if (latest) {
        setAlbum(latest);
        setPhotos(collected);
        setPhotoTotal(latest.photo_total);
        setNextPhotoPage(latest.photo_next_page);
      }
      fetchedAtRef.current = Date.now();
    } catch {
      // Leave the existing URLs in place; the next focus or image error retries.
    } finally {
      refreshingRef.current = false;
    }
  }, [schoolId, albumId]);

  useEffect(() => {
    function handleFocus() {
      if (Date.now() - fetchedAtRef.current <= URL_STALE_MS) return;
      errorRefreshedRef.current = false;
      refreshUrls();
    }
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshUrls]);

  // One refresh for the whole grid, not one per broken tile.
  const handleImageError = useCallback(() => {
    if (errorRefreshedRef.current) return;
    errorRefreshedRef.current = true;
    refreshUrls();
  }, [refreshUrls]);

  async function loadMorePhotos() {
    if (nextPhotoPage === null || loadingMore) return;
    setLoadingMore(true);
    setActionError(null);
    try {
      const detail = await fetchAlbum(schoolId, albumId, nextPhotoPage);
      setPhotos((prev) => [...prev, ...detail.photos]);
      setPhotoTotal(detail.photo_total);
      setNextPhotoPage(detail.photo_next_page);
      loadedPagesRef.current = detail.photo_page;
      fetchedAtRef.current = Date.now();
      errorRefreshedRef.current = false;
    } catch (err) {
      setActionError(parseApiError(err).message);
    } finally {
      setLoadingMore(false);
    }
  }

  function handlePhotoUploaded(photo: GalleryPhoto) {
    setPhotos((prev) => (prev.some((entry) => entry.id === photo.id) ? prev : [...prev, photo]));
    setPhotoTotal((prev) => prev + 1);
  }

  function handleToggleSelect(index: number, shiftKey: boolean) {
    const photo = photos[index];
    if (!photo) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && anchorRef.current !== null) {
        const [from, to] =
          anchorRef.current <= index ? [anchorRef.current, index] : [index, anchorRef.current];
        for (let i = from; i <= to; i += 1) next.add(photos[i].id);
        return next;
      }
      if (next.has(photo.id)) next.delete(photo.id);
      else next.add(photo.id);
      return next;
    });
    anchorRef.current = index;
  }

  async function handleReorder(photoIds: string[]) {
    const previous = photos;
    const byId = new Map(previous.map((photo) => [photo.id, photo]));
    setPhotos(
      photoIds.map((id, position) => ({ ...(byId.get(id) as GalleryPhoto), position })),
    );
    setBusy(true);
    setActionError(null);
    try {
      await reorderPhotos(schoolId, albumId, photoIds);
    } catch (err) {
      setPhotos(previous);
      setActionError(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveCaption(photoId: string, caption: string | null) {
    const previous = photos;
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, caption } : p)));
    setActionError(null);
    try {
      const updated = await updatePhotoCaption(schoolId, albumId, photoId, caption);
      setPhotos((prev) => prev.map((p) => (p.id === photoId ? updated : p)));
    } catch (err) {
      setPhotos(previous);
      setActionError(parseApiError(err).message);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    const previous = photos;
    setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
    setPhotoTotal((prev) => Math.max(0, prev - 1));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(photoId);
      return next;
    });
    setActionError(null);
    try {
      await deletePhoto(schoolId, albumId, photoId);
    } catch (err) {
      setPhotos(previous);
      setPhotoTotal((prev) => prev + 1);
      setActionError(parseApiError(err).message);
    }
  }

  // Culling 20 bad shots one confirmation at a time is the single most tedious
  // thing this screen could get wrong — one confirmation, one pass, and the
  // ones that failed stay selected so they can be retried. Deletes run a few
  // wide so culling a selection is not 20 sequential round trips behind a
  // spinner; a failure records the id and the pass carries on.
  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    setConfirmBulkDelete(false);
    setBusy(true);
    setActionError(null);

    const failed: string[] = [];
    let cursor = 0;

    async function worker() {
      while (cursor < ids.length) {
        const id = ids[cursor];
        cursor += 1;
        try {
          await deletePhoto(schoolId, albumId, id);
          setPhotos((prev) => prev.filter((photo) => photo.id !== id));
          setPhotoTotal((prev) => Math.max(0, prev - 1));
        } catch (err) {
          failed.push(id);
          setActionError(parseApiError(err).message);
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(MAX_CONCURRENT_DELETES, ids.length) }, () => worker()),
    );

    setSelectedIds(new Set(failed));
    setBusy(false);
  }

  async function handlePublish() {
    setBusy(true);
    setActionError(null);
    try {
      const published = await publishAlbum(schoolId, albumId);
      setAlbum((prev) => (prev ? { ...prev, ...published } : prev));
      posthog.capture('album_published', {
        school_id: schoolId,
        album_id: albumId,
        scope: published.scope,
      });
      setShowPublish(false);
    } catch (err) {
      setActionError(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAlbum() {
    if (!album) return;
    setBusy(true);
    try {
      await deleteAlbum(schoolId, albumId);
      posthog.capture('album_deleted', {
        school_id: schoolId,
        album_id: albumId,
        scope: album.scope,
      });
      onClose();
    } catch (err) {
      setActionError(parseApiError(err).message);
      setBusy(false);
    }
  }

  function audienceLabel(): string {
    if (!album) return '';
    if (album.scope === 'CLASSROOM') {
      return `Parents of ${album.classroom_name ?? 'this classroom'}`;
    }
    if (album.scope === 'STUDENT') {
      return `${album.student_name ?? 'this child'}'s guardians`;
    }
    return `Every parent at ${schoolName}`;
  }

  const allPhotosLoaded = nextPhotoPage === null;
  const reorderEnabled = allPhotosLoaded && !busy && photos.length > 1;
  const reorderDisabledReason = !allPhotosLoaded
    ? 'Load every photo before reordering — the API needs the album order in full.'
    : 'Reordering needs at least two photos.';
  const badge = album ? scopeBadgeStyle(album.scope) : null;
  const scopeTarget =
    album?.scope === 'CLASSROOM'
      ? album.classroom_name
      : album?.scope === 'STUDENT'
        ? album.student_name
        : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-6xl w-full my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {album && badge && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}
                >
                  {album.scope}
                </span>
              )}
              {scopeTarget && (
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {scopeTarget}
                </span>
              )}
              {album?.is_draft ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                  Draft
                </span>
              ) : album ? (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Published {album.published_at ? formatDate(album.published_at) : ''}
                </span>
              ) : null}
              {album && !album.allow_download && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                  Downloads off
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 break-words">
              {album?.title ?? 'Album'}
            </h2>
            {album?.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">
                {album.description}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {photoTotal} {photoTotal === 1 ? 'photo' : 'photos'}
              {photos.length < photoTotal ? ` · ${photos.length} loaded` : ''}
            </p>
            {/* This modal has no save button because it does not need one. Say so,
                or the admin has no way to know her work is safe before closing. */}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5">
              <CloudCheck className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              Photos, captions and order save automatically - there is no save button.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {album && (
              <button
                onClick={() => setShowEdit(true)}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit details
              </button>
            )}
            {album?.is_draft && (
              <button
                onClick={() => setShowPublish(true)}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Publish
              </button>
            )}
            {album && (
              <button
                onClick={() => setConfirmDeleteAlbum(true)}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              aria-label="Close album"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-800 dark:text-red-300 flex-1">{error}</span>
              <button
                onClick={loadAlbum}
                className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          )}

          {album && !loading && !error && (
            <UploadDropzone
              schoolId={schoolId}
              albumId={albumId}
              remainingSlots={MAX_PHOTOS_PER_ALBUM - photoTotal}
              disabled={busy}
              onUploaded={handlePhotoUploaded}
            >
              {actionError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 dark:text-red-300 flex-1">{actionError}</p>
                  <button
                    onClick={() => setActionError(null)}
                    className="text-red-600 dark:text-red-400"
                    aria-label="Dismiss error"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {!allPhotosLoaded && photos.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                  Reordering is off until all {photoTotal} photos are loaded — the album order has
                  to be sent complete, so a partial page cannot be reordered safely.
                </div>
              )}

              {selectedIds.size > 0 && (
                <div className="mb-4 flex items-center gap-3 flex-wrap p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {selectedIds.size} selected
                  </span>
                  <button
                    onClick={() => setSelectedIds(new Set(photos.map((photo) => photo.id)))}
                    className="text-sm text-[#1A1A6D] dark:text-[#20B2AA] hover:underline"
                  >
                    Select all loaded
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:underline"
                  >
                    Clear
                  </button>
                  <div className="flex-1" />
                  {confirmBulkDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-red-600 dark:text-red-400">
                        Delete {selectedIds.size} {selectedIds.size === 1 ? 'photo' : 'photos'}?
                      </span>
                      <button
                        onClick={handleBulkDelete}
                        disabled={busy}
                        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmBulkDelete(false)}
                        disabled={busy}
                        className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmBulkDelete(true)}
                      disabled={busy}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete selected
                    </button>
                  )}
                </div>
              )}

              {photos.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
                  <Images className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No photos yet. Drop them anywhere in this window, or use Add photos.
                  </p>
                </div>
              ) : (
                <PhotoGrid
                  photos={photos}
                  selectedIds={selectedIds}
                  reorderEnabled={reorderEnabled}
                  reorderDisabledReason={reorderDisabledReason}
                  busy={busy}
                  onToggleSelect={handleToggleSelect}
                  onOpenLightbox={setLightboxIndex}
                  onReorder={handleReorder}
                  onSaveCaption={handleSaveCaption}
                  onDeletePhoto={handleDeletePhoto}
                  onImageError={handleImageError}
                />
              )}

              {nextPhotoPage !== null && (
                <div className="mt-6 text-center">
                  <button
                    onClick={loadMorePhotos}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Loading…
                      </>
                    ) : (
                      `Load more (${photos.length} of ${photoTotal})`
                    )}
                  </button>
                </div>
              )}
            </UploadDropzone>
          )}
        </div>
      </div>

      {/* Publish confirmation — terminal, so never a toggle */}
      {showPublish && album && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[55] p-4">
          <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Publish “{album.title}”?
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              This sends a push notification and an email to{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {audienceLabel()}
              </span>
              , and makes the album visible to them in the app.
            </p>
            <p className="text-sm text-red-700 dark:text-red-400 mb-4">
              This cannot be undone — there is no unpublish.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              Notifications go out with the next batch, which runs every 5 minutes. You can still
              add, remove and reorder photos afterwards without notifying anyone again.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPublish(false)}
                disabled={busy}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={busy}
                className="px-6 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {busy ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Publishing…
                  </>
                ) : (
                  'Publish and notify'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Album delete confirmation */}
      {confirmDeleteAlbum && album && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[55] p-4">
          <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Delete “{album.title}”?
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
              The album and its {photoTotal} {photoTotal === 1 ? 'photo' : 'photos'} are removed for
              everyone. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteAlbum(false)}
                disabled={busy}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAlbum}
                disabled={busy}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Delete album
              </button>
            </div>
          </div>
        </div>
      )}

      {showEdit && album && (
        <AlbumFormModal
          mode="edit"
          schoolId={schoolId}
          album={album}
          classrooms={classrooms}
          students={students}
          onSuccess={(updated) => setAlbum((prev) => (prev ? { ...prev, ...updated } : prev))}
          onDeleted={onClose}
          onClose={() => setShowEdit(false)}
        />
      )}

      {lightboxIndex !== null && photos.length > 0 && (
        <PhotoLightbox
          photos={photos}
          index={Math.min(lightboxIndex, photos.length - 1)}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onImageError={handleImageError}
        />
      )}
    </div>
  );
}
