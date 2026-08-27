// src/components/school/gallery/UploadDropzone.tsx
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { FileImage, ImageUp, RotateCcw, XCircle } from 'lucide-react';
import { ACCEPTED_PHOTO_TYPES, GalleryPhoto, MAX_PHOTO_BYTES } from '@/types/gallery';
import { parseApiError } from '@/lib/apiError';
import { resolveUploadType, uploadPhoto } from './galleryApi';

// Upload is one HTTP request per photo — there is no batch endpoint. Every
// photo's bytes traverse the API workers and concurrent inserts into the same
// album serialise on a row lock, so keep only a handful in flight.
const MAX_CONCURRENT_UPLOADS = 4;

const DROPZONE_ACCEPT: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],
};

const TOO_LARGE = 'This photo is larger than the 20MB limit';
const WRONG_TYPE = 'Only JPEG, PNG, WebP and HEIC images can be uploaded';
const ALBUM_FULL = 'This album already has the maximum number of photos';

type UploadStatus = 'queued' | 'uploading' | 'done' | 'error';

interface UploadItem {
  id: string;
  file: File;
  previewUrl: string | null; // null for HEIC/HEIF — no browser can render them
  status: UploadStatus;
  progress: number;
  error?: string;
}

interface UploadDropzoneProps {
  schoolId: string;
  albumId: string;
  remainingSlots: number;
  disabled?: boolean;
  onUploaded: (photo: GalleryPhoto) => void;
  children: ReactNode;
}

function canPreviewInBrowser(file: File): boolean {
  const type = resolveUploadType(file);
  return type !== 'image/heic' && type !== 'image/heif';
}

export default function UploadDropzone({
  schoolId,
  albumId,
  remainingSlots,
  disabled = false,
  onUploaded,
  children,
}: UploadDropzoneProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const pendingRef = useRef<UploadItem[]>([]);
  const activeRef = useRef(0);
  const previewUrlsRef = useRef<string[]>([]);
  // Local id counter — a module-level `let` would be a render-time side effect.
  const seqRef = useRef(0);

  // Release every object URL this component minted when the modal unmounts.
  // This closes over the array captured at mount, so releasePreview must
  // mutate that array in place and never reassign the ref — otherwise the
  // cleanup drains a stale array and every later preview leaks its blob.
  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function runUpload(item: UploadItem) {
    updateItem(item.id, { status: 'uploading', progress: 0, error: undefined });
    try {
      const photo = await uploadPhoto(schoolId, albumId, item.file, (percent) =>
        updateItem(item.id, { progress: percent }),
      );
      updateItem(item.id, { status: 'done', progress: 100 });
      onUploaded(photo);
    } catch (err) {
      updateItem(item.id, { status: 'error', error: parseApiError(err).message });
    }
  }

  // Pull from the queue until the concurrency budget is spent; each finished
  // upload frees its slot and pumps again. runUpload never rejects.
  function pump() {
    while (activeRef.current < MAX_CONCURRENT_UPLOADS && pendingRef.current.length > 0) {
      const next = pendingRef.current.shift() as UploadItem;
      activeRef.current += 1;
      runUpload(next).finally(() => {
        activeRef.current -= 1;
        pump();
      });
    }
  }

  function validate(file: File, slotsLeft: number): string | null {
    if (slotsLeft <= 0) return ALBUM_FULL;
    if (file.size > MAX_PHOTO_BYTES) return TOO_LARGE;
    if (!ACCEPTED_PHOTO_TYPES.includes(resolveUploadType(file))) return WRONG_TYPE;
    return null;
  }

  function makeItem(file: File, problem: string | null): UploadItem {
    seqRef.current += 1;
    const previewUrl =
      !problem && canPreviewInBrowser(file) ? URL.createObjectURL(file) : null;
    if (previewUrl) previewUrlsRef.current.push(previewUrl);
    return {
      id: `${file.name}-${file.size}-${seqRef.current}`,
      file,
      previewUrl,
      status: problem ? 'error' : 'queued',
      progress: 0,
      error: problem ?? undefined,
    };
  }

  function handleDrop(accepted: File[], rejections: FileRejection[]) {
    // Photos already queued or in flight have not landed in the album yet, so
    // they still consume slots.
    let slotsLeft = remainingSlots - (pendingRef.current.length + activeRef.current);
    const newItems: UploadItem[] = [];

    for (const file of accepted) {
      const problem = validate(file, slotsLeft);
      if (!problem) slotsLeft -= 1;
      newItems.push(makeItem(file, problem));
    }

    // Files react-dropzone filtered out still get a row, so a 60-file drop
    // never silently loses one.
    for (const rejection of rejections) {
      const tooLarge = rejection.errors.some((e) => e.code === 'file-too-large');
      newItems.push(makeItem(rejection.file, tooLarge ? TOO_LARGE : WRONG_TYPE));
    }

    if (!newItems.length) return;
    setItems((prev) => [...prev, ...newItems]);
    pendingRef.current.push(...newItems.filter((item) => item.status === 'queued'));
    pump();
  }

  function retry(item: UploadItem) {
    updateItem(item.id, { status: 'queued', progress: 0, error: undefined });
    pendingRef.current.push({ ...item, status: 'queued', error: undefined });
    pump();
  }

  function releasePreview(item: UploadItem) {
    if (!item.previewUrl) return;
    URL.revokeObjectURL(item.previewUrl);
    // Splice in place — reassigning the ref would detach it from the array the
    // unmount cleanup holds.
    const index = previewUrlsRef.current.indexOf(item.previewUrl);
    if (index !== -1) previewUrlsRef.current.splice(index, 1);
  }

  function dismiss(item: UploadItem) {
    releasePreview(item);
    setItems((prev) => prev.filter((entry) => entry.id !== item.id));
  }

  function clearFinished() {
    const finished = items.filter((item) => item.status === 'done');
    finished.forEach(releasePreview);
    setItems((prev) => prev.filter((item) => item.status !== 'done'));
  }

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: handleDrop,
    accept: DROPZONE_ACCEPT,
    noClick: true,
    noKeyboard: true,
    disabled,
  });

  const doneCount = items.filter((item) => item.status === 'done').length;
  const failedCount = items.filter((item) => item.status === 'error').length;

  return (
    <div {...getRootProps()} className="relative">
      <input {...getInputProps()} />

      {isDragActive && !disabled && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-[#1A1A6D] dark:border-[#20B2AA] bg-[#1A1A6D]/10 dark:bg-[#20B2AA]/10 pointer-events-none">
          <div className="text-center">
            <ImageUp className="w-10 h-10 mx-auto mb-2 text-[#1A1A6D] dark:text-[#20B2AA]" />
            <p className="text-sm font-medium text-[#1A1A6D] dark:text-[#20B2AA]">
              Drop photos to add them to this album
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <button
          type="button"
          onClick={open}
          disabled={disabled}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          <ImageUp className="w-4 h-4" />
          Add photos
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Or drop them anywhere in this window. JPEG, PNG, WebP or HEIC, up to 20MB each —{' '}
          {Math.max(0, remainingSlots)} of 200 slots left.
        </span>
      </div>

      {items.length > 0 && (
        <div className="mb-4 border border-gray-200 dark:border-gray-800 rounded-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-800">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {doneCount} of {items.length} uploaded
              {failedCount > 0 ? ` · ${failedCount} failed` : ''}
            </span>
            {doneCount > 0 && (
              <button
                type="button"
                onClick={clearFinished}
                className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
              >
                Clear finished
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-3 py-2">
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="w-10 h-10 rounded object-cover flex-shrink-0 border border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded flex-shrink-0 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center"
                    title="HEIC photos cannot be previewed in a browser — the thumbnail appears once it has uploaded"
                  >
                    <FileImage className="w-4 h-4 text-gray-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate text-gray-700 dark:text-gray-300">
                    {item.file.name}
                  </p>
                  {item.status === 'error' ? (
                    <p className="text-xs text-red-600 dark:text-red-400 truncate">{item.error}</p>
                  ) : (
                    <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-1.5 rounded-full bg-[#1A1A6D] dark:bg-[#20B2AA] transition-all"
                        style={{ width: `${item.status === 'done' ? 100 : item.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {item.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => retry(item)}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Retry
                  </button>
                )}
                {item.status !== 'uploading' && (
                  <button
                    type="button"
                    onClick={() => dismiss(item)}
                    className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    aria-label={`Dismiss ${item.file.name}`}
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
