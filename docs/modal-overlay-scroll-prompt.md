# Modals — unreachable tops and double scrollbars (`dependable-admin`)

> Work items for a Claude Code session in the `dependable-admin` repo.
> A shared overlay component plus 13 mechanical migrations. **No API change, no
> new dependency, no behaviour change for content that already fits.**
>
> Found while reviewing the classroom body-check work: the body-check modal was
> the first in the portal with content taller than a viewport, and it exposed a
> bug that 13 modals share. That modal has since become a page, so this is about
> the other thirteen.
>
> Do not commit.

---

## How to run this task

1. **`superpowers:writing-plans`** — a phased plan at
   `docs/superpowers/plans/<today>-modal-overlay-scroll.md`.
2. Implement against the plan.
3. **`superpowers:verification-before-completion`** — output shown.

**Baseline**, on a clean tree at 2026-09-17: `npm run lint` → **0 errors, 57
warnings**. Passing means no new errors *and no new warnings*; diff against 57.
`./node_modules/.bin/tsc --noEmit` → clean, no network needed. `npm run build`
must run natively — the first build fetches a platform-specific SWC binary from
`registry.npmjs.org`.

Read `CLAUDE.md`. Do not commit.

---

## The bug

Every affected overlay is some variant of:

```jsx
<div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
  <div className="bg-white … max-w-lg w-full">…</div>
</div>
```

`align-items: center` on a scroll container centres the panel, so when the panel
is taller than the viewport the overflow runs in **both** directions — but
scrolling only reaches downward. The top of the panel is pushed above the scroll
origin and cannot be reached at all. Its header, and often its close button, are
simply gone.

Second problem: the overlay scrolls internally while the page behind it keeps its
own scrollbar. Two scrollbars, and the background moves under the modal.

Nothing in the repo locks background scroll — there is no such hook or effect
anywhere in `src/`.

---

## Scope

**In scope — the 13 overlays that declare `overflow-y-auto`**, i.e. the ones whose
authors already expected them to grow:

```
src/components/AddMemberModal.tsx
src/components/BulkAddModal.tsx
src/components/CreateClassroomModal.tsx
src/components/CreateSchoolYearModal.tsx
src/components/EditClassroomModal.tsx
src/components/EditMemberModal.tsx
src/components/EditSchoolYearModal.tsx
src/components/EnrollStudentModal.tsx
src/components/OnboardStudentModal.tsx
src/components/school/calendar/EventFormModal.tsx
src/components/school/gallery/AlbumFormModal.tsx      ← z-[55], not z-50
src/components/school/notices/NoticeDetailModal.tsx
src/components/school/notices/NoticeFormModal.tsx
```

**Out of scope — do not touch:**

- **The 10 overlays with no `overflow-y-auto`**, across 8 files:
  `ConfirmDialog.tsx:55`, `AlertDialog.tsx:51`,
  `school/calendar/RecurringEditPrompt.tsx:13`,
  `school/calendar/RecurringDeletePrompt.tsx:13`,
  `system/SystemUsersClient.tsx:712`, `system/SystemUserDetail.tsx:862`,
  `system/LogConfigClient.tsx:767`, `school/LoggingTab.tsx:648`,
  `school/gallery/AlbumDetailModal.tsx:613` and `:661`. They are short confirm
  dialogs that do not overflow in practice, and they have a *different* failure
  mode — no scrolling at all. Migrating them is a follow-up, not this card.
  (`gallery/PhotoLightbox.tsx:50` is a lightbox, not a dialog; leave it entirely.)
- **`school/StudentManage.tsx` and `school/BillingTab.tsx`.** Between them they
  hold 9 overlays, 7 of which cap their panel with `max-h-[90vh] overflow-y-auto`
  so the overlay never overflows. The remaining two — `StudentManage.tsx:1220`
  (Upload Report) and `BillingTab.tsx:1328` (Update Invoice Status) — have neither
  a cap nor `overflow-y-auto`, so they belong to the 10 above, not to this card.
  Leave both files alone.
- **`school/gallery/AlbumDetailModal.tsx:369`**, which already uses `items-start`.
- Anything about `bg-opacity-*` vs `bg-black/50`. Both spellings exist in the
  codebase; that is a styling inconsistency, not this bug. Preserve whatever each
  file already has.

---

## The fix

### A shared overlay component

`src/components/ModalOverlay.tsx` — new. The duplication is the root cause: 13
copies of a subtly wrong string is why one modal being tall broke thirteen.

```jsx
<div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 overflow-y-auto z-50">
  <div className="flex min-h-full items-center justify-center p-4">
    {children}
  </div>
</div>
```

The scroll container no longer centres anything; an inner wrapper does, and
`min-h-full` makes it fill the viewport when the content is short (so short modals
still centre) and grow past it when the content is tall (so the top stays
reachable). This is the standard pattern and needs no new Tailwind utility.

Props: `children`, and a `zClassName` (default `'z-50'`) for `AlbumFormModal`,
which needs `z-[55]`.

**Deliberately not used: `items-safe-center`.** Tailwind 4.1 ships safe-alignment
utilities and one class would fix the centring — but not the scroll lock, and it
could not be verified here (Tailwind's native `oxide`/`lightningcss` binaries in
this repo are darwin-only, so no compile check was possible from Linux). The
structural pattern above works regardless of Tailwind version and browser support.
If you prefer the one-class version, compile it first and prove the CSS emits
`align-items: safe center`.

### Scroll lock

In the same component, one effect: set `document.body.style.overflow = 'hidden'`
on mount, restore the previous value on unmount. Restore the **previous value**,
not a hardcoded `''` — nesting a confirm dialog over a form modal would otherwise
unlock the background when the inner one closes.

### Migration

Each of the 13: replace the overlay `<div>` with `<ModalOverlay>`, keeping the
panel and everything inside it untouched. Most are a two-line change.

---

## Silent breakages

### 1. Restoring `overflow` to `''` instead of what it was

`AlbumDetailModal` renders `AlbumFormModal` over itself (`AlbumDetailModal.tsx:691`)
— the real nesting case in this repo, and the reason `z-[55]` exists. If the inner
modal restores `''` on close, the page scrolls behind the still-open outer one.
Capture `document.body.style.overflow` before setting it and restore that value.

Note `AlbumDetailModal`'s own overlay is `items-start` and **out of scope**, so
only the inner one gets `ModalOverlay` in this card — which is exactly the case
where a naive restore shows up.

### 2. Scroll lock that runs while closed

Most of these modals return `null` when `!isOpen`, but some render conditionally at
the call site instead. If `ModalOverlay` is mounted while the modal is closed, it
locks the page permanently. The effect must live in the component that only exists
while open — verify per file which pattern each uses.

### 3. Losing `z-[55]` on `AlbumFormModal`

It sits above the album detail modal. Defaulting it to `z-50` puts it behind, and
the form becomes unreachable while looking fine in isolation.

### 4. Moving `p-4` to the outer div

The padding belongs on the **inner** flex wrapper. On the scroll container it
collapses against the scroll origin and the top gap disappears when scrolled.

### 5. Assuming the panel needs no width class

These panels rely on `w-full max-w-lg` resolving against the flex parent. The inner
wrapper is still a flex container of the same width, so this holds — but if you
restructure further, check one wide modal (`OnboardStudentModal`) and one narrow
one.

---

## Acceptance criteria

- A modal taller than the viewport can be scrolled to its **top**, its header and
  close button reachable, in all 13.
- A modal shorter than the viewport is still vertically centred, unchanged.
- While any migrated modal is open, the page behind does not scroll and there is
  **one** scrollbar.
- Opening `AlbumFormModal` from inside `AlbumDetailModal` and closing it again
  leaves the background still locked.
- `AlbumFormModal` still renders above `AlbumDetailModal`.
- Each migrated file's panel markup is unchanged — only the overlay wrapper moved.
- The 10 non-`overflow-y-auto` overlays, `StudentManage.tsx`, `BillingTab.tsx`,
  `AlbumDetailModal.tsx` and `PhotoLightbox.tsx` are byte-identical.
- `npm run lint` → 0 errors, 57 warnings. `tsc --noEmit` clean. `npm run build`
  passes. No change to `package.json`, `package-lock.json` or `public/`.
- Nothing committed.

---

## Follow-ups, not for this card

- The 10 short dialogs with no `overflow-y-auto`, plus the two uncapped panels in
  `StudentManage.tsx` and `BillingTab.tsx`: no scrolling at all if they ever grow.
  Migrating them to `ModalOverlay` would make the portal uniform.
- No modal in the portal closes on `Escape` or on a backdrop click.
- Two backdrop spellings coexist: `bg-black bg-opacity-50 dark:bg-opacity-75` and
  `bg-black/50`.
