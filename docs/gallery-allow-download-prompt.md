# Gallery — album download permission (`dependable-admin`)

> Work items for a Claude Code session in the `dependable-admin` repo. Small
> change to the existing Gallery tab. The API side is already built.

---

## How to run this task

Implement directly — this is too small for a plan. Verify with `npm run lint`
and `npm run build`, both of which must pass, and show the output. The lint
baseline is **56 problems / 0 errors**; do not move it. Do not commit.

Read `CLAUDE.md`. Do not add dependencies.

---

## Why this is urgent, not optional

The API now has an `allow_download` boolean on every album. `PUT` is a **full
replace** — `update_album` assigns every field unconditionally — and the payload
defaults `allow_download` to `true` when omitted.

`AlbumPayload` in `src/types/gallery.ts` does not currently include the field.
So as things stand, **an admin editing an album's title silently re-enables
downloads on an album where a school turned them off.** Nothing can turn it off
yet, so nothing is broken today — but this change and the mobile toggle must
land before any school gets that switch.

---

## Changes

### `src/types/gallery.ts`

- `allow_download: boolean` on `GalleryAlbumSummary` (inherited by Detail).
- `cover_photo_id: string | null` on `GalleryAlbumSummary` — the API added it for
  the mobile thumbnail cache. The portal has no use for it, but the type should
  match the wire.
- `allow_download: boolean` on `AlbumPayload`. **Required, not optional.** The
  API's default exists to protect older clients; this client must always state
  its intent explicitly so a title edit can never flip the setting.

### `src/components/school/gallery/AlbumFormModal.tsx`

Add a toggle below the audience block, above the action row.

- Label: **Allow parents to download photos**
- Helper text underneath, and get this wording right because it is the school's
  only chance to understand what they are agreeing to:
  *"Parents can save photos from this album to their phone. Turning this off
  hides the save buttons in the app — it does not prevent a determined person
  from keeping a copy."*
- Default **on** for a new album.
- **Stays editable after publish**, unlike the audience picker. Do not include it
  in whatever `audienceLocked` disables. If turning it off on a published album,
  a short note: *"Photos parents have already saved stay on their phones."*
- Style it with the existing Tailwind vocabulary in this file — a simple
  checkbox or a switch built from divs. No new dependency.

### `src/components/school/gallery/GalleryTab.tsx` and `AlbumDetailModal.tsx`

- Show download state where an admin can see it without opening the edit form: a
  small "Downloads off" pill on the album card and in the detail header, shown
  only when `allow_download` is false. Reuse the muted pill styling from the
  Draft badge; do not add a positive badge for the normal case, it is noise.

---

## Acceptance criteria

- Creating an album with the toggle on and off both persist correctly.
- Editing a **published** album's title leaves `allow_download` at whatever it
  was — verify by toggling it off, saving, reopening, and saving a title change.
- The toggle is enabled while editing a published album, while the audience
  picker stays disabled.
- An album with downloads off shows the pill on the card and in the detail header.
- `npm run lint` still reports exactly 56 problems / 0 errors, with no finding
  naming a gallery file.
- `npm run build` passes.
