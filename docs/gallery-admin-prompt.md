# Gallery — feature prompt for `dependable-admin`

> Work items for a Claude Code session in the `dependable-admin` repo. The API
> side is built and merged-ready; this is the admin portal client for it.

---

## How to run this task

1. **`superpowers:brainstorming`** — only if something below is genuinely
   ambiguous. The API contract is fixed and is not open for negotiation; if a
   requirement here appears to contradict the endpoint list, the endpoint list
   wins and you should say so rather than inventing an endpoint.
2. **`superpowers:writing-plans`** — a phased plan at
   `docs/superpowers/plans/<today>-admin-gallery-tab.md`, following the shape of
   the existing `2026-04-30-school-notice-board.md` and
   `2026-04-23-admin-calendar-tab.md` in that folder.
3. Implement against the plan.
4. **`superpowers:verification-before-completion`** — `npm run lint` and
   `npm run build` must both pass and you must show the output before claiming
   done. There is no test suite in this repo; the build is the type check.

Read `CLAUDE.md` first. Every convention in it applies — in particular: match
the existing Tailwind-heavy style, reuse the modal/tab patterns rather than
inventing abstractions, and do not introduce new dependencies.

---

## What we are building

Schools share photos with parents — sports day, a class outing, a craft morning,
a single child's first steps. The mobile app is where parents view them and
where a teacher can snap-and-upload. **This portal is the desktop workbench**:
where an admin sits down after an event with 60 photos on their laptop, drags
them all in at once, culls and reorders them, writes captions, and publishes.

Assume a real person doing a real job: one school administrator, doing all the
admin herself, on a laptop, once a week. The interaction model should be closer
to Google Photos or a Dropbox album than to a form with a file input.

Model it as a new tab in the school detail page, `src/components/school/gallery/`,
mirroring the layout of `src/components/school/notices/`.

---

## Domain model

An **album** belongs to a school and is addressed at exactly one **scope**:

| Scope | Audience | Required field |
|---|---|---|
| `SCHOOL` | every parent at the school | — |
| `CLASSROOM` | parents of currently-enrolled children in that classroom | `classroom_id` |
| `STUDENT` | that child's guardians | `student_id` |

Identical semantics to `NoticeScope`. Reuse the badge colours and scope-picker
interaction from `NoticeFormModal.tsx` so the two tabs feel like one product.

An album is a **draft** until published. Drafts are invisible to parents.
Publishing stamps `published_at`, makes it parent-visible, and queues a push +
email to every recipient via a batch job that runs every 5 minutes.

---

## API contract — this is exact, do not guess

Base: `/schools/{school_id}/galleries`. All calls go through `apiClient` from
`@/lib/api` (bearer token injected there). Errors go through
`parseApiError` from `@/lib/apiError`.

### Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/schools/{sid}/galleries?page=1` | — | `PaginatedAlbumsResponse` 200 |
| `POST` | `/schools/{sid}/galleries` | `CreateAlbumPayload` | `AlbumSummary` 201 |
| `GET` | `/schools/{sid}/galleries/{aid}?photo_page=1` | — | `AlbumDetail` 200 |
| `PUT` | `/schools/{sid}/galleries/{aid}` | `UpdateAlbumPayload` | `AlbumSummary` 200 |
| `DELETE` | `/schools/{sid}/galleries/{aid}` | — | 204 |
| `POST` | `/schools/{sid}/galleries/{aid}/publish` | — | `AlbumSummary` 200 |
| `POST` | `/schools/{sid}/galleries/{aid}/photos` | multipart, field name `file` | `Photo` 201 |
| `PUT` | `/schools/{sid}/galleries/{aid}/photos/order` | `{ photo_ids: string[] }` | 204 |
| `PATCH` | `/schools/{sid}/galleries/{aid}/photos/{pid}` | `{ caption: string \| null }` | `Photo` 200 |
| `DELETE` | `/schools/{sid}/galleries/{aid}/photos/{pid}` | — | 204 |

### Response shapes

```ts
// snake_case on the wire — keep it, per CLAUDE.md
interface GalleryPhoto {
  id: string;
  thumbnail_url: string;   // presigned, 512px longest edge, always JPEG
  url: string;             // presigned, full-size original
  filename: string;
  content_type: string;
  width: number;           // ORIGINAL dimensions, not the thumbnail's
  height: number;
  caption: string | null;
  position: number;
  created_at: string;      // ISO
}

interface GalleryAlbumSummary {
  id: string;
  school_id: string;
  title: string;
  description: string | null;
  scope: 'SCHOOL' | 'CLASSROOM' | 'STUDENT';
  classroom_id: string | null;
  classroom_name: string | null;
  student_id: string | null;
  student_name: string | null;
  cover_thumbnail_url: string | null;  // null when the album has no photos
  photo_count: number;
  is_draft: boolean;                   // there is no status enum — this is it
  created_by: string | null;
  created_at: string;
  published_at: string | null;
}

interface GalleryAlbumDetail extends GalleryAlbumSummary {
  photos: GalleryPhoto[];
  photo_page: number;
  photo_total: number;
  photo_next_page: number | null;
}

interface PaginatedAlbumsResponse {
  data: GalleryAlbumSummary[];
  page: number;
  total: number;
  next_page: number | null;
}
```

### Request shapes

```ts
interface CreateAlbumPayload {   // and UpdateAlbumPayload — identical
  title: string;                 // min length 1
  description: string | null;
  scope: 'SCHOOL' | 'CLASSROOM' | 'STUDENT';
  classroom_id: string | null;
  student_id: string | null;
}
```

Page sizes are fixed server-side: **20 albums** per page, **60 photos** per page.

---

## Behaviour the API enforces — design the UI around these, don't fight them

**1. Reorder takes a full permutation.** `PUT .../photos/order` rejects anything
that is not exactly the album's live photo set, once each. Sending a delta, a
subset, or a duplicate returns *"The photo order must list every photo in the
album exactly once"*. Every reorder sends every photo ID in the new order.

**2. There is no "set as cover" endpoint.** The cover is whichever photo sits at
position 0. "Make cover" in the UI is a reorder that moves that photo to the
front. Say so in the button's tooltip so it isn't mysterious that the grid order
changes.

**3. Publish is terminal.** There is no unpublish and no scheduled publish. Once
published, the album is permanently visible and parents have been mailed. The
publish control must be a confirmation dialog, not a toggle, and must state
plainly: *this notifies every parent in scope and cannot be undone*. Show the
recipient scope in that dialog (`"Every parent at Kleinekosmossies"` /
`"Parents of Sonnetjies"` / `"Emma Botha's guardians"`).

**4. Audience is locked after publish.** `PUT` with a changed `scope`,
`classroom_id` or `student_id` on a published album returns *"An album's audience
cannot be changed after it has been published"*. Disable the scope picker in edit
mode when `is_draft === false`, with a one-line reason next to it. Title,
description and the photo set all stay editable.

**5. Editing a published album does not re-notify.** So adding photos to a
published album is safe and should not warn. Only the initial publish notifies.

**6. Presigned URLs expire after 900 seconds.** Every `thumbnail_url` and `url`
is a signed S3 link with a 15-minute life. An admin who leaves the detail modal
open through a phone call comes back to broken images. Handle it deliberately:
re-fetch the album on `window` focus if the data is older than ~10 minutes, and
add an `onError` on the image that triggers a single re-fetch rather than
rendering a broken-image glyph. Do not build a refresh-token scheme; re-fetching
the album *is* the refresh mechanism, and the list endpoint was optimised
specifically so this is cheap.

**7. Upload is one HTTP request per photo.** There is no batch endpoint. Cap
concurrency at 3–4 in flight; every photo's bytes traverse the API workers, and
concurrent inserts into the same album serialise on a row lock at the tail.
Firing 60 at once will look fast and behave badly.

**8. Limits.** 200 photos per album, 20MB per photo, and only
`image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`.

---

## Desktop gotchas that will bite if you don't plan for them

**HEIC cannot be previewed in the browser.** The API accepts it — a Mac-native
export or an iPhone AirDrop is the most likely thing this admin will drag in —
but no browser can render HEIC in an `<img>` or via `URL.createObjectURL`. So:

- Local pre-upload previews must fall back to a filename-and-icon tile for
  `image/heic` / `image/heif` rather than a broken thumbnail.
- After upload it resolves itself: the server-generated `thumbnail_url` is always
  JPEG, so the photo displays normally once the POST returns.
- Some browsers report an **empty** `File.type` for HEIC. An empty content type
  is rejected server-side as *"Only JPEG, PNG, WebP and HEIC images can be
  uploaded"*. Sniff the extension (`.heic` / `.heif`) and set the type explicitly
  when constructing the `FormData` entry, rather than letting an empty string
  through and confusing the user with a wrong error.

**`react-dropzone@14` is already a dependency.** Use it. Do not add a new upload
or drag-and-drop library.

**There is no drag-and-drop reorder library and you should not add one.** Use
native HTML5 drag events (`draggable`, `onDragStart`, `onDragOver`,
`onDrop`) on the photo grid tiles. Keep it simple: drag a tile onto another and
the dragged tile takes that index. Also provide keyboard-accessible
"move left / move right" controls, because native HTML5 DnD is not accessible on
its own and this is a tool someone uses for an hour at a time.

**Don't use `@/lib/imageCache`.** That exists for profile images fetched with a
bearer token. Gallery URLs are presigned and are fetched by the browser directly;
caching them defeats the expiry handling in point 6 above.

---

## Files to create

| Action | Path | Purpose |
|---|---|---|
| Create | `src/types/gallery.ts` | The interfaces above, mirroring `src/types/notices.ts` |
| Create | `src/components/school/gallery/galleryApi.ts` | One function per endpoint, mirroring `noticesApi.ts` |
| Create | `src/components/school/gallery/GalleryTab.tsx` | Album grid, empty/loading/error states, "New Album" |
| Create | `src/components/school/gallery/AlbumFormModal.tsx` | Create / edit metadata + delete, modelled on `NoticeFormModal.tsx` |
| Create | `src/components/school/gallery/AlbumDetailModal.tsx` | The workbench: photo grid, upload, reorder, captions, publish |
| Create | `src/components/school/gallery/PhotoGrid.tsx` | Reorderable tile grid with selection |
| Create | `src/components/school/gallery/PhotoLightbox.tsx` | Full-size viewer with keyboard nav |
| Create | `src/components/school/gallery/UploadDropzone.tsx` | `react-dropzone` + bounded-concurrency queue with per-file progress |
| Modify | `src/app/schools/[id]/page.tsx` | Register the tab |

Tab registration: add `'gallery'` to `TabType`, to the hash whitelist in
`getInitialTab()`, and to the `tabs` array — label `Gallery`, icon `Images` from
`lucide-react`, positioned directly after `notices`.

---

## UX specification

### Album grid (`GalleryTab`)

A grid of cards, not a list — this is the one tab where the content is visual.

- Card: `cover_thumbnail_url` as a 4:3 cover image, title, scope badge (reuse
  `scopeBadgeStyle` colours from `NoticesTab.tsx`), scope target name,
  `photo_count`, and the date.
- Albums with no photos get a neutral placeholder tile, not a broken image.
- **Drafts are visually distinct** — a "Draft" pill and a muted/dashed treatment.
  An admin must be able to tell at a glance what has and has not gone out.
- Sorted as the API returns them: newest published first, drafts by creation.
  Do not re-sort client-side.
- Filter chips for All / Drafts / Published, and a scope filter. Client-side over
  the loaded page is fine.
- Paginate with the `next_page` cursor. "Load more" is acceptable; infinite
  scroll inside a tab is not.
- Loading, error-with-retry and empty states copied from `NoticesTab.tsx` — same
  spinner, same red error panel, same centred empty state.

### Album detail (`AlbumDetailModal`)

The main working surface. Wide modal, not a side panel.

- Header: title, scope badge and target, draft/published state, photo count.
  Actions: Edit details, Publish (drafts only), Delete.
- The **entire modal body is a drop target**. Dropping files anywhere begins
  upload. Also a visible "Add photos" button for people who don't drag.
- Upload queue shows a row per file with a thumbnail (or the HEIC fallback
  tile), a progress bar, and per-file success/failure with **retry on the
  individual file** — a 60-photo drop where photo 43 fails must not lose the
  other 59. Reuse the `UploadingFile` state pattern from `NoticeFormModal.tsx`.
- Photo grid: square thumbnails from `thumbnail_url`. Use the `width`/`height`
  fields to set an aspect-ratio box so the grid does not reflow as images load.
- Per-tile hover actions: make cover, edit caption, delete, open in lightbox.
- Multi-select with checkboxes plus shift-click range select, and a bulk delete
  for the selection. Culling 20 bad shots one confirmation at a time is the
  single most tedious thing this screen could get wrong.
- Caption editing inline on the tile or in the lightbox; `PATCH` on blur, not on
  every keystroke.
- Reorder: drag tiles, plus keyboard move controls. Send the full permutation on
  drop, optimistically reorder the local state, and revert on failure.
- Photo pagination at 60 — for a 200-photo album, "Load more" appends. Reordering
  while only a partial page is loaded is a correctness trap: **disable reorder
  until every page is loaded**, and say why.

### Lightbox

Full-size `url`, caption, left/right arrows, `Esc` to close, keyboard arrows to
navigate, and a counter ("14 of 62"). Preload the neighbouring two images.

---

## Error handling

Everything flows through `parseApiError`, which surfaces the backend's
`friendly_message`. Show them as-is — they are already written for humans:

| Situation | Message the API returns |
|---|---|
| Missing scope target | `classroom_id is required when scope is CLASSROOM` / `...STUDENT` |
| Publishing twice | `This album has already been published` |
| Changing audience after publish | `An album's audience cannot be changed after it has been published` |
| Bad reorder payload | `The photo order must list every photo in the album exactly once` |
| 201st photo | `This album already has the maximum number of photos` |
| Oversize file | `This photo is larger than the 20MB limit` |
| Wrong file type | `Only JPEG, PNG, WebP and HEIC images can be uploaded` |
| Corrupt file | `This file could not be read as an image` |

Validate size and type **client-side before uploading** so the common cases never
cost a round trip — but still handle the server error, since client-side type
sniffing is not authoritative.

---

## Out of scope

State these as non-goals in the plan:

- Video. Phase 2, and it needs its own design.
- Linking an album to a calendar event or notice. Confirmed phase 2.
- Per-photo child tagging or per-photo visibility. Audience is the album's scope.
- Unpublish, scheduled publish, album expiry.
- Parent-facing views of any kind — that is the mobile app.
- Read receipts. Notices have acknowledgements; the gallery deliberately does not.
- Client-side image compression or resizing before upload.
- Zip download of an album.

---

## Codebase anchors — read these before planning

| Path | Why |
|---|---|
| `src/components/school/notices/NoticesTab.tsx` | Tab shell, loading/error/empty states, scope badges, modal orchestration |
| `src/components/school/notices/NoticeFormModal.tsx` | Modal shell, scope picker, the `UploadingFile` upload-queue pattern, delete confirmation |
| `src/components/school/notices/noticesApi.ts` | API module shape, multipart upload with `FormData` |
| `src/types/notices.ts` | Type file conventions, snake_case preservation |
| `src/components/school/calendar/CalendarTab.tsx` | The other multi-file feature folder — how a bigger feature is organised here |
| `src/app/schools/[id]/page.tsx` | Tab registration, hash routing, PostHog `school_tab_viewed` |
| `src/lib/apiError.ts` | `parseApiError` — the only error path to use |
| `src/lib/schools.ts` | `schoolsApi.getClassrooms` / `getStudents` for the scope picker |

Analytics: `posthog.capture` on album created, published and deleted, matching
the property shape used elsewhere (`school_id`, plus `album_id` and `scope`).

---

## Acceptance criteria

- The Gallery tab appears after Notices, deep-links via `#gallery`, and survives
  a reload on that hash.
- Creating an album lands you straight in the detail modal ready to add photos —
  not back on the grid.
- Dragging 60 files onto the detail modal uploads them all with visible
  per-file progress, at most 4 concurrently, and one deliberately-failed file can
  be retried without touching the rest.
- A `.heic` file shows a sensible placeholder before upload and a real thumbnail
  after, and is never rejected because the browser reported an empty MIME type.
- Dragging a photo to the front makes it the album cover, and the grid on the tab
  behind reflects that after refresh.
- Publishing shows a confirmation naming the audience, states it cannot be
  undone, and the album loses its Draft pill afterwards.
- The scope picker is disabled when editing a published album, with a visible
  reason.
- Reorder is disabled on a 200-photo album until all pages are loaded.
- Leaving the detail modal open for 20 minutes and returning shows images, not
  broken links.
- `npm run lint` and `npm run build` both pass.
