// src/components/school/gallery/PhotoLightbox.tsx
'use client';

import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { GalleryPhoto } from '@/types/gallery';

interface PhotoLightboxProps {
  photos: GalleryPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onImageError: () => void;
}

export default function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
  onImageError,
}: PhotoLightboxProps) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1);
      if (event.key === 'ArrowRight' && index < photos.length - 1) onIndexChange(index + 1);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, photos.length, onClose, onIndexChange]);

  // Preload the two neighbours each way so arrowing through feels instant.
  useEffect(() => {
    [index - 2, index - 1, index + 1, index + 2]
      .filter((neighbour) => neighbour >= 0 && neighbour < photos.length)
      .forEach((neighbour) => {
        const image = new Image();
        image.src = photos[neighbour].url;
      });
  }, [index, photos]);

  const photo = photos[index];
  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo viewer"
        className="absolute inset-0 cursor-default"
      />

      <div className="relative flex items-center justify-between px-4 py-3">
        <span className="text-sm text-white/80">
          {index + 1} of {photos.length}
        </span>
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
        <button
          type="button"
          onClick={() => onIndexChange(index - 1)}
          disabled={index === 0}
          aria-label="Previous photo"
          className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30 flex-shrink-0"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption ?? photo.filename}
          onError={onImageError}
          className="max-h-full max-w-full object-contain"
        />

        <button
          type="button"
          onClick={() => onIndexChange(index + 1)}
          disabled={index === photos.length - 1}
          aria-label="Next photo"
          className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30 flex-shrink-0"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      <div className="relative px-4 py-4 text-center">
        {photo.caption ? (
          <p className="text-sm text-white/90">{photo.caption}</p>
        ) : (
          <p className="text-sm text-white/40">No caption</p>
        )}
        <p className="text-xs text-white/40 mt-1">{photo.filename}</p>
      </div>
    </div>
  );
}
