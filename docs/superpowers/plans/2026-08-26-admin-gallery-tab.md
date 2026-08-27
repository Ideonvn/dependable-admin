# Admin Gallery Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Gallery tab to the school detail page — a desktop photo workbench where an admin bulk-drops photos into an album, culls/reorders/captions them, and publishes the album to a scoped parent audience.

**Architecture:** Mirror `src/components/school/notices/` exactly — a `gallery/` feature folder under `src/components/school/` holding an API module, the tab shell, a metadata form modal, and a wide detail modal that composes three presentational children (upload dropzone, photo grid, lightbox). Data fetching is `useEffect` + local state with parent-refresh-after-mutation, as in every other tab. No global cache, no new dependencies.

**Tech Stack:** Next.js 16 App Router, React 19 (React Compiler on), TypeScript 5, Tailwind CSS 4, Axios via `apiClient` from `@/lib/api`, `react-dropzone@14` (already a dependency), `lucide-react`, `posthog-js`.

---

## Ground rules for this plan

1. **No new dependencies.** `react-dropzone@14.3.8` is already in `package.json` and is the only drag-and-drop library used. Reordering uses native HTML5 drag events — do not add a reorder library.
2. **No `@/lib/imageCache`.** Gallery URLs are presigned and fetched directly by the browser; caching them defeats expiry handling.
3. **There is no test suite in this repo.** Verification per task is `npm run lint`; `npx tsc --noEmit` is the type check during development and `npm run build` is the authoritative gate at the end.
4. **Do not commit.** The requesting user asked for no commits in this session. Each task therefore ends with a verification checkpoint instead of a `git commit` step. Leave the work in the working tree.
5. **snake_case stays snake_case** on the wire, per `CLAUDE.md`.

## Non-goals (explicitly out of scope)

- Video of any kind — phase 2, needs its own design.
- Linking an album to a calendar event or a notice — confirmed phase 2.
- Per-photo child tagging or per-photo visibility. Audience is the album's scope, full stop.
- Unpublish, scheduled publish, album expiry. Publish is terminal.
- Any parent-facing view — that is the mobile app.
- Read receipts / acknowledgements. Notices have them; the gallery deliberately does not.
- Client-side image compression or resizing before upload.
- Zip download of an album.

## API facts this plan is built around

- Base path `/schools/{school_id}/galleries`. Page sizes are fixed server-side: **20 albums**, **60 photos**.
- `PUT .../photos/order` takes a **full permutation** — every live photo id, once each. Deltas and subsets are rejected.
- **There is no "set as cover" endpoint.** The cover is position 0, so "Make cover" is a reorder.
- **Publish is terminal** — no unpublish, no schedule. It notifies every parent in scope via a 5-minute batch job.
- **Audience is locked after publish** — `PUT` with a changed `scope`/`classroom_id`/`student_id` on a published album is rejected.
- Editing a published album does **not** re-notify, so adding photos later is safe and must not warn.
- Presigned URLs expire after **900s**. Re-fetching the album *is* the refresh mechanism.
- One HTTP request per photo, **max 3–4 in flight**. Limits: 200 photos/album, 20MB/photo, `image/jpeg|png|webp|heic|heif`.

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/types/gallery.ts` | Wire types + the three server-enforced limits |
| Create | `src/components/school/gallery/galleryApi.ts` | One function per endpoint + HEIC MIME resolution |
| Create | `src/components/school/gallery/UploadDropzone.tsx` | Drop target wrapper, bounded-concurrency queue, per-file progress/retry |
| Create | `src/components/school/gallery/PhotoLightbox.tsx` | Full-size viewer, keyboard nav, neighbour preload |
| Create | `src/components/school/gallery/PhotoGrid.tsx` | Reorderable tile grid, selection, inline captions |
| Create | `src/components/school/gallery/AlbumFormModal.tsx` | Create/edit metadata + delete, audience lock after publish |
| Create | `src/components/school/gallery/AlbumDetailModal.tsx` | The workbench: orchestrates the three above + publish/delete |
| Create | `src/components/school/gallery/GalleryTab.tsx` | Album card grid, filters, pagination, modal orchestration |
| Modify | `src/app/schools/[id]/page.tsx` | Register the tab after Notices |

**Prop-drilling decision:** `GalleryTab` takes `schoolName` in addition to `schoolId`, because the publish confirmation must name the audience (`"Every parent at Kleinekosmossies"`) and the gallery API does not return the school name. `SchoolDetailsTab` already takes the whole `school` object, so passing one extra field is consistent with the page.

**Duplication decision:** `scopeBadgeStyle` and `formatDate` are defined independently in `GalleryTab.tsx` and `AlbumDetailModal.tsx`, exactly as `NoticesTab.tsx` and `NoticeDetailModal.tsx` already do. Two ~12-line pure functions do not justify a new shared module, and the notice-board plan set this precedent deliberately.

> **Extraction markers:** every code block that *is* a whole file is preceded by an
> `<!-- extract: <path> -->` comment. Task 10 includes a script that regenerates the
> source tree from this plan, so the plan and the code cannot drift.

---

## Task 1: Define the gallery wire types

**Files:**
- Create: `src/types/gallery.ts`

- [ ] **Step 1: Create the types file**

Mirrors `src/types/notices.ts` — snake_case preserved, one interface per wire shape. The three limit constants live here too so that `UploadDropzone` and `AlbumDetailModal` share one definition.

<!-- extract: src/types/gallery.ts -->
```typescript
// src/types/gallery.ts

export type GalleryScope = 'SCHOOL' | 'CLASSROOM' | 'STUDENT';

export interface GalleryPhoto {
  id: string;
  thumbnail_url: string; // presigned, 512px longest edge, always JPEG
  url: string; // presigned, full-size original
  filename: string;
  content_type: string;
  width: number; // ORIGINAL dimensions, not the thumbnail's
  height: number;
  caption: string | null;
  position: number;
  created_at: string; // ISO
}

export interface GalleryAlbumSummary {
  id: string;
  school_id: string;
  title: string;
  description: string | null;
  scope: GalleryScope;
  classroom_id: string | null;
  classroom_name: string | null;
  student_id: string | null;
  student_name: string | null;
  cover_photo_id: string | null; // for the mobile thumbnail cache — unused here
  cover_thumbnail_url: string | null; // null when the album has no photos
  photo_count: number;
  allow_download: boolean;
  is_draft: boolean; // there is no status enum — this is it
  created_by: string | null;
  created_at: string; // ISO
  published_at: string | null; // ISO, stamped by publish
}

export interface GalleryAlbumDetail extends GalleryAlbumSummary {
  photos: GalleryPhoto[];
  photo_page: number;
  photo_total: number;
  photo_next_page: number | null;
}

export interface PaginatedAlbumsResponse {
  data: GalleryAlbumSummary[];
  page: number;
  total: number;
  next_page: number | null;
}

// The create and update payloads are identical, so they share one type.
export interface AlbumPayload {
  title: string; // min length 1
  description: string | null;
  scope: GalleryScope;
  classroom_id: string | null;
  student_id: string | null;
  // Required, never optional. PUT is a full replace and the API defaults this
  // to true when it is omitted, so an optional field here would mean a title
  // edit silently re-enabled downloads on an album where the school had turned
  // them off. This client always states its intent.
  allow_download: boolean;
}

// Server-enforced limits, mirrored client-side so the common rejections never
// cost a round trip. The server stays authoritative — see the error handling in
// UploadDropzone.
export const MAX_PHOTOS_PER_ALBUM = 200;
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_PHOTO_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];
```

- [ ] **Step 2: Verify**

```bash
npm run lint
```

Expected: no errors mentioning `src/types/gallery.ts`.

---

## Task 2: Build the gallery API module

**Files:**
- Create: `src/components/school/gallery/galleryApi.ts`

One exported function per endpoint from the contract, mirroring `noticesApi.ts`. Two things beyond plumbing live here:

- `resolveUploadType()` — some browsers report an **empty** `File.type` for HEIC. An empty content type is rejected server-side with the *wrong* error (*"Only JPEG, PNG, WebP and HEIC images can be uploaded"*), so we sniff the extension and re-wrap the `File` with an explicit type before it goes into the `FormData`.
- `onUploadProgress` is threaded through so `UploadDropzone` can draw a real per-file progress bar without any extra dependency.

- [ ] **Step 1: Create the API module**

<!-- extract: src/components/school/gallery/galleryApi.ts -->
```typescript
// src/components/school/gallery/galleryApi.ts

import apiClient from '@/lib/api';
import {
  AlbumPayload,
  GalleryAlbumDetail,
  GalleryAlbumSummary,
  GalleryPhoto,
  PaginatedAlbumsResponse,
} from '@/types/gallery';

const base = (schoolId: string) => `/schools/${schoolId}/galleries`;

// Some browsers hand us an empty File.type for HEIC/HEIF (and occasionally for
// files dragged out of odd sources). An empty content type is rejected
// server-side with a misleading message, so fall back to the extension.
const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

export function resolveUploadType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TYPES[extension] ?? '';
}

export async function fetchAlbums(
  schoolId: string,
  page = 1,
): Promise<PaginatedAlbumsResponse> {
  const response = await apiClient.get<PaginatedAlbumsResponse>(base(schoolId), {
    params: { page },
  });
  return response.data;
}

export async function createAlbum(
  schoolId: string,
  payload: AlbumPayload,
): Promise<GalleryAlbumSummary> {
  const response = await apiClient.post<GalleryAlbumSummary>(base(schoolId), payload);
  return response.data;
}

export async function fetchAlbum(
  schoolId: string,
  albumId: string,
  photoPage = 1,
): Promise<GalleryAlbumDetail> {
  const response = await apiClient.get<GalleryAlbumDetail>(
    `${base(schoolId)}/${albumId}`,
    { params: { photo_page: photoPage } },
  );
  return response.data;
}

export async function updateAlbum(
  schoolId: string,
  albumId: string,
  payload: AlbumPayload,
): Promise<GalleryAlbumSummary> {
  const response = await apiClient.put<GalleryAlbumSummary>(
    `${base(schoolId)}/${albumId}`,
    payload,
  );
  return response.data;
}

export async function deleteAlbum(schoolId: string, albumId: string): Promise<void> {
  await apiClient.delete(`${base(schoolId)}/${albumId}`);
}

// Terminal: there is no unpublish endpoint. Guard this behind a confirmation.
export async function publishAlbum(
  schoolId: string,
  albumId: string,
): Promise<GalleryAlbumSummary> {
  const response = await apiClient.post<GalleryAlbumSummary>(
    `${base(schoolId)}/${albumId}/publish`,
  );
  return response.data;
}

export async function uploadPhoto(
  schoolId: string,
  albumId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<GalleryPhoto> {
  const contentType = resolveUploadType(file);
  // Re-wrap only when the browser gave us nothing useful, so the multipart part
  // carries a content type the API accepts.
  const upload =
    contentType && contentType !== file.type
      ? new File([file], file.name, { type: contentType })
      : file;

  const formData = new FormData();
  formData.append('file', upload, upload.name);

  const response = await apiClient.post<GalleryPhoto>(
    `${base(schoolId)}/${albumId}/photos`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (!onProgress) return;
        const total = event.total ?? 0;
        onProgress(total > 0 ? Math.round((event.loaded / total) * 100) : 0);
      },
    },
  );
  return response.data;
}

// The API rejects anything that is not the album's live photo set, once each —
// always send the complete permutation, never a delta.
export async function reorderPhotos(
  schoolId: string,
  albumId: string,
  photoIds: string[],
): Promise<void> {
  await apiClient.put(`${base(schoolId)}/${albumId}/photos/order`, {
    photo_ids: photoIds,
  });
}

export async function updatePhotoCaption(
  schoolId: string,
  albumId: string,
  photoId: string,
  caption: string | null,
): Promise<GalleryPhoto> {
  const response = await apiClient.patch<GalleryPhoto>(
    `${base(schoolId)}/${albumId}/photos/${photoId}`,
    { caption },
  );
  return response.data;
}

export async function deletePhoto(
  schoolId: string,
  albumId: string,
  photoId: string,
): Promise<void> {
  await apiClient.delete(`${base(schoolId)}/${albumId}/photos/${photoId}`);
}
```

- [ ] **Step 2: Verify**

```bash
npm run lint && npx tsc --noEmit
```

Expected: no errors mentioning `galleryApi.ts`.

---

## Task 3: Build `UploadDropzone`

**Files:**
- Create: `src/components/school/gallery/UploadDropzone.tsx`

This component **wraps** the detail modal's body (`children`) so that the entire body is a drop target, and renders the upload queue above it. Design notes:

- **Concurrency is capped at 4.** Every photo's bytes traverse the API workers and concurrent inserts into the same album serialise on a row lock at the tail; firing 60 at once looks fast and behaves badly. A `pendingRef` + `activeRef` pump is used rather than `Promise.all`, so a slot frees the instant a file finishes.
- **Per-file retry.** A 60-photo drop where photo 43 fails must not lose the other 59, so failures stay as their own row with a Retry button and never abort the queue.
- **HEIC previews.** No browser can render HEIC in an `<img>` or through `URL.createObjectURL`, so HEIC/HEIF get a filename-and-icon tile instead of a broken thumbnail. This resolves itself after upload: the server thumbnail is always JPEG.
- **Client-side validation first** for size, type and remaining slots, using the exact wording the API returns, so the common cases never cost a round trip. Server errors still flow through `parseApiError` because client-side type sniffing is not authoritative.
- `noClick` is set on the dropzone because the root wraps the whole modal body — clicking a photo tile must not open a file dialog. The visible **Add photos** button calls `open()`.

- [ ] **Step 1: Create the component**

<!-- extract: src/components/school/gallery/UploadDropzone.tsx -->
```typescript
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
```

- [ ] **Step 2: Verify**

```bash
npm run lint && npx tsc --noEmit
```

Expected: no errors mentioning `UploadDropzone.tsx`.

---

## Task 4: Build `PhotoLightbox`

**Files:**
- Create: `src/components/school/gallery/PhotoLightbox.tsx`

Full-size viewer over the detail modal (`z-[60]`, above the modal's `z-50`). `Esc` closes, arrow keys navigate, a counter reads "14 of 62", and the two neighbours in each direction are preloaded so arrowing through an album is instant. The backdrop close target is a real `<button>` rather than a click handler on a `<div>`, which keeps it keyboard-reachable.

`onImageError` is wired to the same single-refetch handler the grid uses — a presigned URL that expired while the lightbox was open refreshes the album instead of rendering a broken-image glyph.

- [ ] **Step 1: Create the component**

<!-- extract: src/components/school/gallery/PhotoLightbox.tsx -->
```typescript
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
```

- [ ] **Step 2: Verify**

```bash
npm run lint && npx tsc --noEmit
```

Expected: no errors mentioning `PhotoLightbox.tsx`.

---

## Task 5: Build `PhotoGrid`

**Files:**
- Create: `src/components/school/gallery/PhotoGrid.tsx`

The tile grid. Design notes that matter:

- **Reorder emits a full permutation.** Both the drag-drop handler and the keyboard move buttons funnel through `moveTo()`, which produces the complete `photo_ids` array; the parent sends it as-is. There is no delta path to get wrong.
- **"Make cover" is `moveTo(index, 0)`** because there is no set-cover endpoint. The button's `title` says so, otherwise it is mysterious that the grid order changes.
- **Keyboard move controls exist because native HTML5 DnD is not accessible on its own,** and this is a tool someone uses for an hour at a time. They live in the always-visible caption strip, not the hover overlay.
- **The tile is a fixed `aspect-square` box** so the grid never reflows as thumbnails load, and the `<img>` still carries the original `width`/`height` so the browser knows the true intrinsic ratio.
- Captions `PATCH` **on blur**, never per keystroke. `Enter` blurs, `Escape` abandons the edit.
- The tile is a `<div>` rather than a `<button>` because it contains buttons; opening the lightbox is its own explicit control.

- [ ] **Step 1: Create the component**

<!-- extract: src/components/school/gallery/PhotoGrid.tsx -->
```typescript
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
```

- [ ] **Step 2: Verify**

```bash
npm run lint && npx tsc --noEmit
```

Expected: no errors mentioning `PhotoGrid.tsx`.

---

## Task 6: Build `AlbumFormModal`

**Files:**
- Create: `src/components/school/gallery/AlbumFormModal.tsx`

Modelled directly on `NoticeFormModal.tsx`: same shell, same coloured scope bar, same `<select>` scope picker with conditional classroom/student pickers, same inline delete-confirmation footer. Differences:

- **The scope picker is disabled when editing a published album** (`is_draft === false`), with a one-line reason next to it, because `PUT` with a changed audience is rejected. Title, description and the download toggle stay editable, and so does the photo set (handled in the detail modal).
- **The download toggle is always sent explicitly.** `PUT` is a full replace and the API defaults `allow_download` to `true` when the field is absent, so an omitted field would mean editing a title silently re-enabled downloads on an album where the school had turned them off.
- Errors go through `parseApiError`, which surfaces the backend's `friendly_message` as-is and maps `validation_errors` onto field names — `title`, `classroom_id`, `student_id` are rendered under their inputs.
- `onSuccess` hands the created/updated `GalleryAlbumSummary` back, so `GalleryTab` can drop the admin straight into the detail modal after creating.

- [ ] **Step 1: Create the component**

<!-- extract: src/components/school/gallery/AlbumFormModal.tsx -->
```typescript
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
```

- [ ] **Step 2: Verify**

```bash
npm run lint && npx tsc --noEmit
```

Expected: no errors mentioning `AlbumFormModal.tsx`.

---

## Task 7: Build `AlbumDetailModal`

**Files:**
- Create: `src/components/school/gallery/AlbumDetailModal.tsx`

The main working surface — a wide modal (`max-w-6xl`), not a side panel. It owns all album and photo state and composes `UploadDropzone` (wrapping the whole body), `PhotoGrid` and `PhotoLightbox`. Design notes:

- **Presigned URL expiry (900s) is handled by re-fetching the album, not by a refresh-token scheme.** Two triggers: a `window` `focus` listener that refreshes when the loaded data is older than 10 minutes, and a single shared `onError` handler on the images. The error handler is bounded by `errorRefreshedRef` and guarded by `refreshingRef`, so a grid of 60 expired thumbnails causes **one** re-fetch, not 60 — and an album whose images are genuinely broken cannot turn into a background poll, because the bound only lifts on a real data load or a deliberate return to the window.
- **Reorder is disabled until every photo page is loaded**, with the reason stated on screen. Sending a permutation of a partial page would be rejected — *"The photo order must list every photo in the album exactly once"* — and worse, could look like it worked.
- **Reorder, caption, delete and bulk-delete are optimistic and revert on failure**, surfacing the backend's `friendly_message`. Bulk delete runs 4-wide against the same album, matching the upload cap, and one failure never aborts the batch.
- **Publish is a confirmation dialog, not a toggle.** It names the audience, says plainly that it notifies every parent in scope, and that it cannot be undone.
- **Adding photos to a published album shows no warning** — editing does not re-notify; only the initial publish does.
- **The header states that the workbench autosaves.** Every photo action here commits immediately — upload on drop, caption on blur, order on drop, delete on click — so there is no save button. An admin who has just dragged in 60 photos needs to be told that before she closes the modal, not after.
- Uploads do **not** call back into `GalleryTab` per photo. The tab reloads its card grid when this modal closes, which is one request instead of sixty.

- [ ] **Step 1: Create the component**

<!-- extract: src/components/school/gallery/AlbumDetailModal.tsx -->
```typescript
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
```

The render half follows in Step 2 — it is the same file, continued.

- [ ] **Step 2: Append the render half of the same file**

Append this directly onto `AlbumDetailModal.tsx` — it closes the component opened in Step 1. (The extraction script in Task 10 concatenates every block sharing an `extract` path, in document order.)

<!-- extract: src/components/school/gallery/AlbumDetailModal.tsx -->
```typescript

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
              Photos, captions and order save automatically — there is no save button.
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
```

- [ ] **Step 3: Verify**

```bash
npm run lint && npx tsc --noEmit
```

Expected: no errors mentioning `AlbumDetailModal.tsx`.

---

## Task 8: Build `GalleryTab`

**Files:**
- Create: `src/components/school/gallery/GalleryTab.tsx`

The tab shell. A grid of cards rather than a list — this is the one tab where the content is visual. Loading spinner, red error panel with retry, and centred empty state are copied from `NoticesTab.tsx` so the two tabs read as one product.

- **Drafts are visually distinct**: a Draft pill, a dashed muted border and a slightly faded cover, so an admin can tell at a glance what has and has not gone out.
- **Albums are rendered in API order** — newest published first, drafts by creation. Nothing is re-sorted client-side; the filter chips only *hide* rows.
- **Pagination is an explicit "Load more"** using the `next_page` cursor. Infinite scroll inside a tab is not acceptable.
- A cover thumbnail whose presigned URL has expired triggers **one** silent reload of the list, guarded by a ref.
- Creating an album closes the form and opens the detail modal for the new album, so the admin lands ready to add photos rather than back on the grid. The card grid reloads when the detail modal closes, which is when photo counts and covers will have changed.

- [ ] **Step 1: Create the component**

<!-- extract: src/components/school/gallery/GalleryTab.tsx -->
```typescript
// src/components/school/gallery/GalleryTab.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Images, Plus, RefreshCw } from 'lucide-react';
import { GalleryAlbumSummary, GalleryScope } from '@/types/gallery';
import { schoolsApi, Classroom, Student } from '@/lib/schools';
import { fetchAlbums } from './galleryApi';
import AlbumFormModal from './AlbumFormModal';
import AlbumDetailModal from './AlbumDetailModal';

interface GalleryTabProps {
  schoolId: string;
  schoolName: string;
}

type StatusFilter = 'all' | 'draft' | 'published';
type ScopeFilter = 'ALL' | GalleryScope;

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

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'published', label: 'Published' },
];

const SCOPE_FILTERS: { value: ScopeFilter; label: string }[] = [
  { value: 'ALL', label: 'All audiences' },
  { value: 'SCHOOL', label: 'School' },
  { value: 'CLASSROOM', label: 'Classroom' },
  { value: 'STUDENT', label: 'Student' },
];

export default function GalleryTab({ schoolId, schoolName }: GalleryTabProps) {
  const [albums, setAlbums] = useState<GalleryAlbumSummary[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('ALL');

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [detailAlbumId, setDetailAlbumId] = useState<string | null>(null);

  // A single silent reload when a presigned cover URL has expired.
  const coverRetriedRef = useRef(false);

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAlbums(schoolId, 1);
      setAlbums(response.data);
      setNextPage(response.next_page);
      coverRetriedRef.current = false;
    } catch {
      setError('Failed to load albums');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  useEffect(() => {
    schoolsApi.getClassrooms(schoolId).then(setClassrooms).catch(console.error);
    schoolsApi.getStudents(schoolId).then(setStudents).catch(console.error);
  }, [schoolId]);

  async function loadMore() {
    if (nextPage === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetchAlbums(schoolId, nextPage);
      setAlbums((prev) => [...prev, ...response.data]);
      setNextPage(response.next_page);
    } catch {
      setError('Failed to load more albums');
    } finally {
      setLoadingMore(false);
    }
  }

  function handleCoverError() {
    if (coverRetriedRef.current) return;
    coverRetriedRef.current = true;
    loadAlbums();
  }

  function handleAlbumCreated(album: GalleryAlbumSummary) {
    // Land straight in the workbench, ready to add photos.
    setShowForm(false);
    setDetailAlbumId(album.id);
  }

  function handleDetailClosed() {
    setDetailAlbumId(null);
    // Covers, photo counts and draft state all change inside the detail modal.
    loadAlbums();
  }

  // Filters hide rows; they never re-sort. The API order is newest published
  // first, then drafts by creation, and that order is meaningful.
  const visibleAlbums = albums.filter((album) => {
    if (statusFilter === 'draft' && !album.is_draft) return false;
    if (statusFilter === 'published' && album.is_draft) return false;
    if (scopeFilter !== 'ALL' && album.scope !== scopeFilter) return false;
    return true;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Gallery</h2>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Album
        </button>
      </div>

      {!loading && !error && albums.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap mb-6">
          <div className="flex items-center gap-1">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === filter.value
                    ? 'bg-[#1A1A6D] dark:bg-[#20B2AA] text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <select
            value={scopeFilter}
            onChange={(event) => setScopeFilter(event.target.value as ScopeFilter)}
            className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            {SCOPE_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
      )}

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
            onClick={loadAlbums}
            className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {!loading && !error && albums.length === 0 && (
        <div className="text-center py-20">
          <Images className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No albums yet. Create the first one.
          </p>
        </div>
      )}

      {!loading && !error && albums.length > 0 && visibleAlbums.length === 0 && (
        <div className="text-center py-20">
          <Images className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No albums match these filters.
          </p>
        </div>
      )}

      {!loading && !error && visibleAlbums.length > 0 && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {visibleAlbums.map((album) => {
            const badge = scopeBadgeStyle(album.scope);
            const scopeTarget =
              album.scope === 'CLASSROOM'
                ? album.classroom_name
                : album.scope === 'STUDENT'
                  ? album.student_name
                  : null;

            return (
              <button
                key={album.id}
                onClick={() => setDetailAlbumId(album.id)}
                className={`text-left rounded-lg overflow-hidden border transition-colors hover:border-[#1A1A6D] dark:hover:border-[#20B2AA] ${
                  album.is_draft
                    ? 'border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212]'
                }`}
              >
                <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-800">
                  {album.cover_thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={album.cover_thumbnail_url}
                      alt=""
                      onError={handleCoverError}
                      className={`w-full h-full object-cover ${album.is_draft ? 'opacity-75' : ''}`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Images className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                    </div>
                  )}
                  {album.is_draft && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/70 dark:text-amber-200">
                      Draft
                    </span>
                  )}
                  {!album.allow_download && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                      Downloads off
                    </span>
                  )}
                </div>

                <div className="p-3">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}
                    >
                      {album.scope}
                    </span>
                    {scopeTarget && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {scopeTarget}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {album.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {album.photo_count} {album.photo_count === 1 ? 'photo' : 'photos'} ·{' '}
                    {formatDate(album.published_at ?? album.created_at)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!loading && !error && nextPage !== null && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Loading…
              </>
            ) : (
              'Load more albums'
            )}
          </button>
        </div>
      )}

      {showForm && (
        <AlbumFormModal
          mode="create"
          schoolId={schoolId}
          classrooms={classrooms}
          students={students}
          onSuccess={handleAlbumCreated}
          onClose={() => setShowForm(false)}
        />
      )}

      {detailAlbumId && (
        <AlbumDetailModal
          schoolId={schoolId}
          schoolName={schoolName}
          albumId={detailAlbumId}
          classrooms={classrooms}
          students={students}
          onClose={handleDetailClosed}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npm run lint && npx tsc --noEmit
```

Expected: no errors mentioning `GalleryTab.tsx`.

---

## Task 9: Register the Gallery tab

**Files:**
- Modify: `src/app/schools/[id]/page.tsx`

- [ ] **Step 1: Add `Images` to the lucide-react import**

Find:
```typescript
import { ArrowLeft, Building2, Users, BookOpen, UserCog, ClipboardCheck, Receipt, Calendar, CalendarDays, Bell, Download, RefreshCw, Loader2, FileText } from 'lucide-react';
```
Replace with:
```typescript
import { ArrowLeft, Building2, Users, BookOpen, UserCog, ClipboardCheck, Receipt, Calendar, CalendarDays, Bell, Images, Download, RefreshCw, Loader2, FileText } from 'lucide-react';
```

- [ ] **Step 2: Add the component import**

After the `NoticesTab` import line, add:
```typescript
import GalleryTab from '@/components/school/gallery/GalleryTab';
```

- [ ] **Step 3: Add `'gallery'` to `TabType`**

Find:
```typescript
type TabType = 'details' | 'students' | 'membership' | 'classrooms' | 'enrollments' | 'schoolYears' | 'billing' | 'calendar' | 'notices' | 'logging';
```
Replace with:
```typescript
type TabType = 'details' | 'students' | 'membership' | 'classrooms' | 'enrollments' | 'schoolYears' | 'billing' | 'calendar' | 'notices' | 'gallery' | 'logging';
```

- [ ] **Step 4: Add `'gallery'` to the hash whitelist in `getInitialTab()`**

Find:
```typescript
    if (['details', 'students', 'membership', 'classrooms', 'enrollments', 'schoolYears', 'billing', 'calendar', 'notices', 'logging'].includes(hash)) {
```
Replace with:
```typescript
    if (['details', 'students', 'membership', 'classrooms', 'enrollments', 'schoolYears', 'billing', 'calendar', 'notices', 'gallery', 'logging'].includes(hash)) {
```

This is what makes `#gallery` survive a reload.

- [ ] **Step 5: Add the tab entry directly after `notices`**

Find:
```typescript
    { id: 'notices' as TabType, label: 'Notices', icon: Bell },
    { id: 'logging' as TabType, label: 'Logging', icon: FileText },
```
Replace with:
```typescript
    { id: 'notices' as TabType, label: 'Notices', icon: Bell },
    { id: 'gallery' as TabType, label: 'Gallery', icon: Images },
    { id: 'logging' as TabType, label: 'Logging', icon: FileText },
```

- [ ] **Step 6: Render the tab**

Find:
```typescript
        {activeTab === 'notices' && <NoticesTab schoolId={school.id} />}
```
Replace with:
```typescript
        {activeTab === 'notices' && <NoticesTab schoolId={school.id} />}
        {activeTab === 'gallery' && <GalleryTab schoolId={school.id} schoolName={school.name} />}
```

`school.name` is passed because the publish confirmation must name the audience (`"Every parent at Kleinekosmossies"`) and the gallery API does not return the school name.

- [ ] **Step 7: Verify**

```bash
npm run lint && npm run build
```

Expected: lint clean, build completes with `/schools/[id]` in the route table.

---

## Task 10: Full verification

- [ ] **Step 1: Confirm the source tree matches this plan**

Each whole-file code block above is preceded by `<!-- extract: <path> -->`. This regenerates the tree from the plan and diffs it against what is on disk — blocks sharing a path are concatenated in document order:

```bash
awk '
  /^<!-- extract: /  { path = $3; getline; if ($0 ~ /^```/) { infence = 1; seen[path] ? printf("") : ""; next } }
  infence && /^```$/ { infence = 0; next }
  infence           { print >> ("/tmp/gallery-extract/" gensub(/\//, "_", "g", path)) }
' docs/superpowers/plans/2026-08-26-admin-gallery-tab.md
```

If the `awk` above is awkward in your shell, a plain visual diff of each file against its block in the plan is equally acceptable — the point is that plan and code do not drift.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no output beyond the eslint summary; no warnings or errors in `src/components/school/gallery/` or `src/types/gallery.ts`.

- [ ] **Step 3: Build (this repo's type check — there is no test suite)**

```bash
npm run build
```

Expected: `✓ Compiled successfully`, no type errors, `/schools/[id]` present in the route table.

- [ ] **Step 4: Do not commit**

The requesting user asked for no commits. Leave the changes in the working tree and report `git status --short`.

---

## Acceptance criteria → task map

| Criterion | Covered by |
|---|---|
| Gallery tab appears after Notices, deep-links via `#gallery`, survives reload | Task 9 (steps 4, 5) |
| Creating an album lands in the detail modal, not back on the grid | Task 8 (`handleAlbumCreated`) |
| 60-file drop, per-file progress, ≤4 concurrent, one failure retried alone | Task 3 (`pump`, `MAX_CONCURRENT_UPLOADS`, `retry`) |
| `.heic` shows a placeholder before upload, a real thumbnail after, never rejected for an empty MIME type | Task 2 (`resolveUploadType`, File re-wrap), Task 3 (`canPreviewInBrowser`) |
| Dragging a photo to the front makes it the cover; the tab grid reflects it | Task 5 (`moveTo`), Task 7 (`handleReorder`), Task 8 (`handleDetailClosed`) |
| Publish confirmation names the audience, states it cannot be undone, Draft pill clears | Task 7 (publish dialog, `audienceLabel`) |
| Scope picker disabled when editing a published album, with a visible reason | Task 6 (`audienceLocked`) |
| Reorder disabled on a 200-photo album until all pages load | Task 7 (`allPhotosLoaded`, `reorderEnabled`, amber banner) |
| 20 minutes idle then return shows images, not broken links | Task 7 (`URL_STALE_MS` focus listener, `handleImageError`) |
| `npm run lint` and `npm run build` both pass | Task 10 |
| Multi-select + shift-range + bulk delete | Task 7 (`handleToggleSelect`, `handleBulkDelete`), Task 5 (checkbox) |
| Captions PATCH on blur | Task 5 (`commitCaption`) |
| Lightbox: full size, arrows, Esc, counter, ±2 preload | Task 4 |
| Filter chips + scope filter, no client-side re-sorting | Task 8 (`visibleAlbums`) |
| Album pagination via `next_page`, "Load more", no infinite scroll | Task 8 (`loadMore`) |
| Analytics on album created / published / deleted | Task 6 (created, deleted), Task 7 (published, deleted) |
| All errors via `parseApiError` | Tasks 3, 6, 7 |

## Self-review notes

**Spec coverage:** every row of the prompt's "Files to create" table has a task; every numbered API behaviour (1–8) and every desktop gotcha maps to a named mechanism above; all nine out-of-scope items are stated as non-goals.

**Placeholder scan:** no TBDs, no "similar to Task N", no "add appropriate error handling" — every code step contains the file in full.

**Type consistency:** `GalleryScope`, `GalleryPhoto`, `GalleryAlbumSummary`, `GalleryAlbumDetail`, `PaginatedAlbumsResponse`, `AlbumPayload`, `MAX_PHOTOS_PER_ALBUM`, `MAX_PHOTO_BYTES`, `ACCEPTED_PHOTO_TYPES` are defined once in Task 1 and used under those names in Tasks 2–8. `resolveUploadType` (Task 2) is imported by Task 3. `fetchAlbums`/`createAlbum`/`fetchAlbum`/`updateAlbum`/`deleteAlbum`/`publishAlbum`/`uploadPhoto`/`reorderPhotos`/`updatePhotoCaption`/`deletePhoto` are defined once in Task 2 and imported by name thereafter. `scopeBadgeStyle` and `formatDate` are deliberately duplicated in `GalleryTab` and `AlbumDetailModal`, matching the notices precedent.

**Known deviation from the prompt, stated deliberately:** `GalleryTab` takes a `schoolName` prop. Behaviour 3 requires the publish dialog to name the audience as *"Every parent at Kleinekosmossies"*, and no gallery endpoint returns the school name. The school detail page already holds it, so it is passed down rather than fetched again or invented.

---

## Amendment — 2026-08-27: album download permission

Folded into the blocks above rather than appended as a new task, so the extraction
in Task 10 stays truthful. Scope of the change:

- `GalleryAlbumSummary` gained `allow_download: boolean` and `cover_photo_id: string | null`
  (the latter exists only so the type matches the wire — the portal has no use for it).
- `AlbumPayload` gained **required** `allow_download: boolean`. Required rather than
  optional is the whole point: `PUT` is a full replace and the API defaults the field to
  `true` when omitted, so an optional field would let a title edit re-enable downloads on
  an album where a school had turned them off.
- `AlbumFormModal` grew a checkbox below the audience block, defaulting on for new albums
  and seeded from the album on edit. It is deliberately **outside** `audienceLocked` —
  downloads stay editable after publish even though the audience does not — and shows
  *"Photos parents have already saved stay on their phones."* when it is off on a
  published album.
- `GalleryTab` and `AlbumDetailModal` show a muted **Downloads off** pill only in the
  negative case. There is no positive badge for the normal case; it would be noise.

## Amendment — 2026-08-27: autosave messaging

`AlbumDetailModal` commits every photo action immediately and has no save button;
`AlbumFormModal` is submit-driven and does not save until Create Album / Save Changes.
The two are one click apart, so each now states its own behaviour: a persistent line in
the detail modal's (non-scrolling) header saying photos, captions and order save
automatically, and a matching line in the form modal saying the opposite about its own
fields. Putting a single "everything is saved automatically" message on the form would
have been false.
