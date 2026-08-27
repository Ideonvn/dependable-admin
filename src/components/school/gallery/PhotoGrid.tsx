// src/components/school/gallery/PhotoGrid.tsx
'use client';

import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Maximize2, Pencil, Star, Trash2 } from 'lucide-react';
import { GalleryPhoto } from '@/types/gallery';

interface PhotoGridProps {
  photos: GalleryPhoto[];
  selectedIds: Set<string>;
  reorderEnabled: boolean;
  reorderDisabledReason: string;
  busy: boolean;
  onToggleSelect: (index: number, shiftKey: boolean) => void;
  onOpenLightbox: (index: number) => void;
  onReorder: (photoIds: string[]) => void;
  onSaveCaption: (photoId: string, caption: string | null) => void;
  onDeletePhoto: (photoId: string) => void;
  onImageError: () => void;
}

export default function PhotoGrid({
  photos,
  selectedIds,
  reorderEnabled,
  reorderDisabledReason,
  busy,
  onToggleSelect,
  onOpenLightbox,
  onReorder,
  onSaveCaption,
  onDeletePhoto,
  onImageError,
}: PhotoGridProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftCaption, setDraftCaption] = useState('');

  // Always emits the complete order — the API rejects deltas and subsets.
  function moveTo(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= photos.length) return;
    const ids = photos.map((photo) => photo.id);
    const [moved] = ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, moved);
    onReorder(ids);
  }

  function handleDragStart(event: React.DragEvent, index: number) {
    if (!reorderEnabled) return;
    setDragIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    // Firefox refuses to start a drag unless something is on the transfer.
    event.dataTransfer.setData('text/plain', photos[index].id);
  }

  function handleDragOver(event: React.DragEvent, index: number) {
    if (!reorderEnabled || dragIndex === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }

  function handleDrop(event: React.DragEvent, index: number) {
    if (!reorderEnabled || dragIndex === null) return;
    event.preventDefault();
    moveTo(dragIndex, index);
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function startCaptionEdit(photo: GalleryPhoto) {
    setEditingId(photo.id);
    setDraftCaption(photo.caption ?? '');
  }

  function commitCaption(photo: GalleryPhoto) {
    setEditingId(null);
    const trimmed = draftCaption.trim();
    const next = trimmed.length > 0 ? trimmed : null;
    if (next !== (photo.caption ?? null)) onSaveCaption(photo.id, next);
  }

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {photos.map((photo, index) => {
        const selected = selectedIds.has(photo.id);
        const isDragOver = dragOverIndex === index && dragIndex !== index;

        return (
          <div
            key={photo.id}
            draggable={reorderEnabled && !busy}
            onDragStart={(event) => handleDragStart(event, index)}
            onDragOver={(event) => handleDragOver(event, index)}
            onDrop={(event) => handleDrop(event, index)}
            onDragEnd={handleDragEnd}
            className={`group relative rounded-lg overflow-hidden border transition-colors ${
              selected
                ? 'border-[#1A1A6D] dark:border-[#20B2AA] ring-2 ring-[#1A1A6D] dark:ring-[#20B2AA]'
                : 'border-gray-200 dark:border-gray-800'
            } ${isDragOver ? 'ring-2 ring-amber-400' : ''} ${
              dragIndex === index ? 'opacity-40' : ''
            } ${reorderEnabled && !busy ? 'cursor-grab' : ''}`}
          >
            <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbnail_url}
                alt={photo.caption ?? photo.filename}
                width={photo.width}
                height={photo.height}
                draggable={false}
                onError={onImageError}
                className="w-full h-full object-cover"
              />

              <button
                type="button"
                onClick={(event) => onToggleSelect(index, event.shiftKey)}
                aria-label={selected ? `Deselect ${photo.filename}` : `Select ${photo.filename}`}
                className={`absolute top-1.5 left-1.5 z-20 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  selected
                    ? 'bg-[#1A1A6D] dark:bg-[#20B2AA] border-transparent text-white'
                    : 'bg-white/80 dark:bg-black/50 border-gray-300 dark:border-gray-600'
                }`}
              >
                {selected && <Check className="w-3 h-3" />}
              </button>

              {index === 0 && (
                <span className="absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-black/60 text-white">
                  Cover
                </span>
              )}

              <div className="absolute inset-0 z-10 flex items-center justify-center gap-1 bg-black/45 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto">
                <button
                  type="button"
                  onClick={() => onOpenLightbox(index)}
                  title="Open full size"
                  aria-label={`Open ${photo.filename} full size`}
                  className="p-1.5 rounded bg-white/90 text-gray-800 hover:bg-white transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveTo(index, 0)}
                  disabled={!reorderEnabled || busy || index === 0}
                  title={
                    reorderEnabled
                      ? 'Make cover — moves this photo to the front of the album, which is what the cover is'
                      : reorderDisabledReason
                  }
                  aria-label={`Make ${photo.filename} the album cover`}
                  className="p-1.5 rounded bg-white/90 text-gray-800 hover:bg-white transition-colors disabled:opacity-40"
                >
                  <Star className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => startCaptionEdit(photo)}
                  title="Edit caption"
                  aria-label={`Edit caption for ${photo.filename}`}
                  className="p-1.5 rounded bg-white/90 text-gray-800 hover:bg-white transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePhoto(photo.id)}
                  disabled={busy}
                  title="Delete photo"
                  aria-label={`Delete ${photo.filename}`}
                  className="p-1.5 rounded bg-white/90 text-red-600 hover:bg-white transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 px-2 py-1.5 border-t border-gray-200 dark:border-gray-800">
              {editingId === photo.id ? (
                <input
                  type="text"
                  value={draftCaption}
                  autoFocus
                  onChange={(event) => setDraftCaption(event.target.value)}
                  onBlur={() => commitCaption(photo)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                    if (event.key === 'Escape') setEditingId(null);
                  }}
                  placeholder="Add a caption…"
                  className="flex-1 min-w-0 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startCaptionEdit(photo)}
                  className="flex-1 min-w-0 text-left text-xs truncate text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  {photo.caption ?? <span className="text-gray-400 dark:text-gray-600">Add a caption…</span>}
                </button>
              )}

              <button
                type="button"
                onClick={() => moveTo(index, index - 1)}
                disabled={!reorderEnabled || busy || index === 0}
                title={reorderEnabled ? 'Move left' : reorderDisabledReason}
                aria-label={`Move ${photo.filename} left`}
                className="p-0.5 rounded text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveTo(index, index + 1)}
                disabled={!reorderEnabled || busy || index === photos.length - 1}
                title={reorderEnabled ? 'Move right' : reorderDisabledReason}
                aria-label={`Move ${photo.filename} right`}
                className="p-0.5 rounded text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors disabled:opacity-30"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
