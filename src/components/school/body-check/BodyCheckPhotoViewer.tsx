// src/components/school/body-check/BodyCheckPhotoViewer.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AttendanceBodyCheck, BodyCheckPhoto, schoolsApi } from '@/lib/schools';

// Body check photo URLs are presigned bearer links valid for 300s, and the payload the caller
// holds may be hours old. So the viewer fetches this check's photos fresh on open, from the
// student's attendance calendar for the check's month, and refetches when an image fails — the
// usual cause is expiry. A photo that still fails after a fresh fetch shows its thumbnail.
//
// No download control, deliberately: these are photos of injuries on children. A browser can
// always save what it displays; the portal just does not invite it.

interface BodyCheckPhotoViewerProps {
  schoolId: string;
  studentId: string;
  bodyCheckId: string;
  checkedAt: string; // ISO; picks the calendar month (UTC, as the API buckets it)
  initialPhotoId?: string; // the thumbnail that was clicked; the viewer still pages through all
  onClose: () => void;
}

// Browsers other than Safari cannot render HEIC. The thumbnail is always a JPEG.
const BROWSER_SAFE = new Set(['image/jpeg', 'image/png', 'image/webp']);

// One body check, freshly fetched (so with fresh URLs), via the student's attendance calendar
// for the check's month. Also used to refresh expired thumbnails in the student modal.
export async function fetchBodyCheck(
  schoolId: string,
  studentId: string,
  bodyCheckId: string,
  checkedAt: string
): Promise<AttendanceBodyCheck | null> {
  const at = new Date(checkedAt);
  const calendar = await schoolsApi.getStudentAttendanceCalendar(
    schoolId,
    studentId,
    at.getUTCFullYear(),
    at.getUTCMonth() + 1
  );
  for (const day of calendar.events) {
    const check = (day.body_checks ?? []).find((b) => b.id === bodyCheckId);
    if (check) return check;
  }
  return null;
}

export default function BodyCheckPhotoViewer({
  schoolId,
  studentId,
  bodyCheckId,
  checkedAt,
  initialPhotoId,
  onClose,
}: BodyCheckPhotoViewerProps) {
  const [photos, setPhotos] = useState<BodyCheckPhoto[] | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Bumped to refetch; every fetch mints fresh URLs.
  const [attempt, setAttempt] = useState(0);
  // Set when an image error triggered a refetch; cleared when that refetch lands, so a later
  // expiry (the viewer open past another 300s) refetches again rather than giving up.
  const refetchPending = useRef(false);
  // Photos whose original failed even with fresh URLs: shown as their thumbnail instead.
  const [fallbackIds, setFallbackIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let alive = true;
    fetchBodyCheck(schoolId, studentId, bodyCheckId, checkedAt)
      .then((check) => {
        if (!alive) return;
        const fresh = check?.photos ?? [];
        refetchPending.current = false;
        setPhotos(fresh);
        setIndex((i) => Math.min(i, Math.max(fresh.length - 1, 0)));
        // Open on the clicked photo the first time; a refetch keeps the current page.
        if (attempt === 0 && initialPhotoId) {
          setIndex(Math.max(fresh.findIndex((p) => p.id === initialPhotoId), 0));
        }
      })
      .catch(() => {
        if (alive) setError('The photos could not be loaded.');
      });
    return () => {
      alive = false;
    };
  }, [schoolId, studentId, bodyCheckId, checkedAt, attempt, initialPhotoId]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  // First failure: refetch (expiry). A photo that fails again before any refetch is pending
  // falls back to its thumbnail on its own page, without blocking the others.
  const onImageError = useCallback(
    (photoId: string) => {
      if (!refetchPending.current && !fallbackIds.has(photoId)) {
        refetchPending.current = true;
        setAttempt((n) => n + 1);
        return;
      }
      setFallbackIds((prev) => new Set(prev).add(photoId));
    },
    [fallbackIds]
  );

  const count = photos?.length ?? 0;
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, Math.max(count - 1, 0)));
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [count, onClose]);

  // Clamped: a refetch can return fewer photos than the page we were on.
  const photo = photos?.[Math.min(index, Math.max(count - 1, 0))];
  const showOriginal = photo
    ? BROWSER_SAFE.has(photo.content_type.toLowerCase()) && !fallbackIds.has(photo.id)
    : false;

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo viewer"
        className="absolute inset-0 cursor-default"
      />

      <div className="relative flex items-center justify-between px-4 py-3">
        <span className="text-sm text-white/80">{count > 0 ? `${index + 1} of ${count}` : ''}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo viewer"
          className="p-1 rounded text-white/80 hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="relative flex-1 flex items-center justify-center gap-4 px-4 min-h-0">
        {error ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-white/80">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : photos === null ? (
          <p className="text-sm text-white/60">Loading photos…</p>
        ) : !photo ? (
          <p className="text-sm text-white/60">No photos are attached to this body check.</p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setIndex(index - 1)}
              disabled={index === 0}
              aria-label="Previous photo"
              className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30 flex-shrink-0"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Plain <img>, not next/image: a loader would proxy or cache a bearer URL. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={photo.id}
              src={showOriginal ? photo.url : photo.thumbnail_url}
              alt={`Body check photo ${index + 1} of ${count}`}
              onError={() => onImageError(photo.id)}
              className="max-h-full max-w-full object-contain"
            />

            <button
              type="button"
              onClick={() => setIndex(index + 1)}
              disabled={index === count - 1}
              aria-label="Next photo"
              className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30 flex-shrink-0"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      <div className="relative px-4 py-4 text-center min-h-[3rem]">
        {photo && !showOriginal && !error && (
          <p className="text-xs text-white/50">
            {fallbackIds.has(photo.id)
              ? 'Preview size — the full-size photo could not be loaded.'
              : `Preview size — the original is ${photo.content_type.replace('image/', '').toUpperCase()}, which this browser may not display.`}{' '}
            Full resolution is in the Dependable mobile app.
          </p>
        )}
      </div>
    </div>
  );
}
