# Body check — photo count (`dependable-admin`)

> Work items for a Claude Code session in the `dependable-admin` repo. The
> attendance calendar payload gains photos on each body check; the portal shows
> **how many** and says where to view them. It does not render the images.
>
> **Blocked on `dependable-api/docs/body-check-photo-prompt.md` landing first** —
> the field does not exist until then. If `AttendanceBodyCheck` has no `photos`
> in the API response, stop and say so.
>
> **Revised again 2026-10-11 — marker-linked photos.** `BodyCheckView` numbers markers
> front-then-back (pins and notes, matching the app), shows each marker's photos as
> thumbnails in its note row and the general photos in a strip below; clicking any
> thumbnail opens `BodyCheckPhotoViewer` on that photo. The classroom drill-down now
> receives `photos` (not `photo_count`) and refetches the day when a thumbnail fails
> (300s URLs); the student modal refetches just the open check. Supersedes the "View N
> photos" button below.
>
> **Revised 2026-10-11, after Ideon's testing — supersedes "Do not render the images"
> below.** The portal now shows the photos: a "View N photos" button on the student
> modal and on each classroom drill-down entry opens `body-check/BodyCheckPhotoViewer`.
> It fetches the check's photos fresh from the student's attendance calendar on open
> (the held payload may be hours old, and the drill-down has no URLs), refetches once on
> an image error, uses a plain `<img>` (never `next/image`), offers no download, and shows
> the JPEG thumbnail for HEIC/HEIF originals, which most browsers cannot render.
>
> **Revised 2026-10-10:** the classroom drill-down (already shipped) now also
> shows a photo count, from a new `photo_count` field on
> `ClassroomBodyCheckEntry` — see "Coordination" below, which supersedes the
> original instruction to leave it alone.
>
> This is a small task. Verify with `npx tsc --noEmit` against the pre-change
> baseline (capture the count first and diff it) and `npm run lint`. Show the
> output. Do not commit.

---

## How to run this task

1. **`superpowers:verification-before-completion`** — the two commands above,
   output shown, before claiming done.

Read `CLAUDE.md`. No plan document needed; this is under an hour of work.

**No new dependencies.**

---

## What and why

Body check photos are shipping to the mobile app: staff attach up to five photos
of an injury during capture, and parents see them in the app's body check
viewer. The portal already renders body checks — the marker dots over the front
and back figures, the notes, the performing staff member — in
`src/components/school/StudentManage.tsx`, driven by `AttendanceBodyCheck` in
`src/lib/schools.ts`.

Once the API ships, that payload carries a `photos` array the portal ignores. A
school admin looking at a body check on a laptop would see markers and notes and
have no indication that two photos of the injury exist. That is the actual
failure mode this task prevents: not a missing feature, a **misleading screen**.

So the portal reports the count and points at the app.

### This is deliberately half a feature

Rendering the photos here was considered and deferred. It needs presigned-URL
handling the portal does not do today, and 300-second expiry behaves badly in a
long-lived desktop tab in a way the mobile client's refetch-on-focus does not.
The admin investigating an incident on a laptop is arguably the person who most
needs to see the image, so this **will** come back as a request.

Write that in the code as a comment, not just here. A screen that says "2
photos" without showing them reads as an unfinished bug to whoever opens the
file next, and they need to find the reason rather than "fix" it by wiring up an
`<img>` against an expiring URL.

---

## Coordination with the classroom body check task

`docs/classroom-body-check-prompt.md` landed in this repo alongside this one. It
added a classroom-tab drill-down listing a day's body checks for a whole class
(`src/components/school/ClassroomBodyChecks.tsx`). That has shipped.

**Revised 2026-10-10 — decided:** the classroom drill-down shows a count too.
The API adds `photo_count: number` (not a `photos` array — no URLs) to each
`ClassroomBodyCheckEntry`. Show it per check in the expanded student row, in the
same wording and zero-suppression as the student modal, and read it as
`check.photo_count ?? 0` for the deploy-window reason in Silent breakage 1. Leaving
it blank would reintroduce the misleading screen on the surface built precisely
for "a parent phoned about a mark on their child's arm".

If you touch `StudentManage.tsx` and that task has already landed, expect a
textual merge conflict, not a semantic one.

---

## Changes

| File | Change |
|---|---|
| `src/lib/schools.ts` | `BodyCheckPhoto` type; `photos` on `AttendanceBodyCheck` |
| `src/components/school/StudentManage.tsx` | Count on the timeline row and in the modal |
| `src/lib/schools.ts` | `photo_count: number` on `ClassroomBodyCheckEntry` |
| `src/components/school/ClassroomBodyChecks.tsx` | Count per check in the expanded row |

### Types

```ts
// src/lib/schools.ts — alongside the existing BodyCheckMarker

export interface BodyCheckPhoto {
  id: string;
  thumbnail_url: string;   // presigned, 300s TTL — not rendered by this portal
  url: string;             // presigned, 300s TTL — not rendered by this portal
  filename: string;
  content_type: string;
  size_bytes: number;
  width: number;
  height: number;
  created_at: string;
}

export interface AttendanceBodyCheck {
  id: string;
  checked_at: string;
  performed_by: string;
  front: BodyCheckMarker[];
  back: BodyCheckMarker[];
  photos: BodyCheckPhoto[];
}
```

Type the URL fields even though nothing renders them — if someone later adds
display, the shape is already correct and documented.

### Display

Two places, both in `StudentManage.tsx`:

1. **The timeline row** (the `<button onClick={() => setSelectedBodyCheck(b)}>`
   block, near the existing `markerCount` line). Add a photo count line beside
   the note count, in the same `text-xs opacity-80` treatment.
2. **The modal**, under the `By {performed_by} · {time}` line: when photos
   exist, a single line saying how many and that they are viewable in the
   Dependable mobile app.

Both suppress entirely at zero. Pluralise properly — the existing
`{markerCount} note{markerCount !== 1 ? 's' : ''}` is the pattern to match.

---

## Silent breakages

### 1. `photos` will be absent on cached and older responses

The API declares `photos: List[...] = []`, so a fresh response always carries an
array. But this portal will run against a deployed API for the window between
the two deploys, and Next's own fetch caching can hand back a body captured
before the API shipped.

Read it as `(b.photos ?? []).length`, exactly the way the file already reads
`(ev?.body_checks ?? [])` at the timeline construction just above. Do not declare the field
optional in the interface to achieve this — the API contract is non-nullable and
weakening the type hides a genuine regression if the field ever really goes
missing.

### 2. Do not render the images

`thumbnail_url` and `url` are presigned bearer credentials with a 300-second
lifetime, pointing at photographs of injuries on children. Dropping an `<img>`
against them in a portal tab that stays open all afternoon produces broken
images with no explanation, and a `next/image` loader would proxy or cache them,
which is worse.

If you find yourself adding image rendering, you have gone outside the scope of
this task. Revert it.

### 3. Do not touch the marker rendering

The front/back figures, the normalised `x_marker`/`y_marker` percentage
positioning, and the note list are all working and out of scope. `git diff`
should show changes to the count lines and the type file, nothing else.

---

## Acceptance criteria

- `AttendanceBodyCheck.photos` is typed non-optional as `BodyCheckPhoto[]`, and
  read defensively at the two call sites.
- A body check with photos shows the count on the timeline row and in the modal;
  pluralisation is correct at one and at more than one.
- A body check with zero photos, or with `photos` absent from the response,
  renders exactly as it does today — no count line, no empty state, no error.
- No `<img>`, `next/image`, or fetch is added against `url` or `thumbnail_url`.
- The comment explaining why images are not rendered is in
  `StudentManage.tsx`, at the count line.
- Marker rendering is unmodified.
- The classroom drill-down shows the same count line per check from
  `photo_count`, suppressed at zero, with the same not-rendered comment.
- `npx tsc --noEmit` introduces no new errors against the captured baseline; the
  baseline count is quoted in the report.
- `npm run lint` is clean on touched files.
- Nothing committed.
