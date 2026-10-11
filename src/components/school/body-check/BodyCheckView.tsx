import { useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { BodyCheckMarker, BodyCheckPhoto } from '@/lib/schools';

interface BodyCheckViewProps {
  front: BodyCheckMarker[];
  back: BodyCheckMarker[];
  // Optional: callers that show photos pass all of the check's photos. Marker photos render in
  // their note row; the rest in a strip below.
  photos?: BodyCheckPhoto[];
  onOpenPhoto?: (photoId: string) => void;
  // Thumbnail URLs are presigned for 300s; a tab left open outlives them. Called once per mount
  // on the first failed thumbnail so the caller can refetch and mint fresh ones.
  onPhotosExpired?: () => void;
}

// Front + back body map with marker overlay and numbered notes list.
// Numbering runs front then back, in the API's order (top to bottom, then left to right), so a
// marker has the same number here, in the parent app and on the teacher's capture screen.
// Marker % positions are relative to the <img> box: keep the width on the <img>, not the wrapper.
export default function BodyCheckView({ front, back, photos = [], onOpenPhoto, onPhotosExpired }: BodyCheckViewProps) {
  const sides = { front, back };
  const offset = { front: 0, back: front.length };

  // Keyed by URL, so a refetch that mints a new one clears the failure by itself.
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const askedForFresh = useRef(false);
  const onThumbError = (url: string) => {
    setFailed((prev) => new Set(prev).add(url));
    if (askedForFresh.current) return;
    askedForFresh.current = true;
    onPhotosExpired?.();
  };

  const markerIds = useMemo(() => new Set([...front, ...back].map((m) => m.id)), [front, back]);
  // A photo whose marker is not on this check falls back to the strip rather than disappearing.
  const generalPhotos = photos.filter((p) => !p.marker_id || !markerIds.has(p.marker_id));

  const thumb = (photo: BodyCheckPhoto, sizeClass: string) =>
    failed.has(photo.thumbnail_url) ? (
      <button
        key={photo.id}
        type="button"
        onClick={() => onPhotosExpired?.()}
        aria-label="Reload photo"
        className={`${sizeClass} flex items-center justify-center rounded-md bg-gray-200 dark:bg-gray-700 text-gray-500`}
      >
        <RefreshCw className="w-4 h-4" />
      </button>
    ) : (
      <button
        key={photo.id}
        type="button"
        onClick={() => onOpenPhoto?.(photo.id)}
        aria-label="View photo"
        className={`${sizeClass} rounded-md overflow-hidden bg-gray-200 dark:bg-gray-700 hover:opacity-90 transition-opacity`}
      >
        {/* Plain <img>, not next/image: a loader would proxy or cache a bearer URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.thumbnail_url}
          alt=""
          onError={() => onThumbError(photo.thumbnail_url)}
          className="w-full h-full object-cover"
        />
      </button>
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-6">
        {(['front', 'back'] as const).map((side) => {
          const markers = sides[side];
          const imgSrc = side === 'front'
            ? '/assets/images/body-check/baby-front.png'
            : '/assets/images/body-check/baby-back.png';
          return (
            <div key={side} className="flex flex-col items-center gap-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {side}
              </p>
              {/* Image with overlaid numbered markers — wrapper is exactly image size */}
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgSrc}
                  alt={side}
                  className="block w-40 object-contain"
                />
                {markers.map((m, i) => (
                  <div
                    key={m.id}
                    title={m.note || undefined}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-[#1A1A6D] dark:border-[#20B2AA] flex items-center justify-center z-10 cursor-default text-[10px] font-bold text-[#1A1A6D] dark:text-[#20B2AA]"
                    style={{ left: `${m.x_marker * 100}%`, top: `${m.y_marker * 100}%` }}
                  >
                    {offset[side] + i + 1}
                  </div>
                ))}
              </div>
              {/* Notes list, each with its marker's photos */}
              {markers.length > 0 ? (
                <div className="w-full space-y-1">
                  {markers.map((m, i) => {
                    const linked = photos.filter((p) => p.marker_id === m.id);
                    return (
                      <div key={m.id} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs text-gray-800 dark:text-gray-200">
                        <span className="font-semibold text-[#1A1A6D] dark:text-[#20B2AA]">#{offset[side] + i + 1}</span>
                        {m.note ? ` — ${m.note}` : ' — no note'}
                        {linked.length > 0 && (
                          <div className="flex gap-1.5 mt-1.5">{linked.map((p) => thumb(p, 'w-10 h-10'))}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-600 text-center">No markers</p>
              )}
            </div>
          );
        })}
      </div>
      {generalPhotos.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Photos</p>
          <div className="flex gap-2 flex-wrap">{generalPhotos.map((p) => thumb(p, 'w-16 h-16'))}</div>
        </div>
      )}
    </div>
  );
}
