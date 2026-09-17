# Modal Overlay Scroll Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Source brief: `docs/modal-overlay-scroll-prompt.md`.

**Goal:** Make the top of any tall modal reachable and stop the page scrolling behind an open modal, for the 13 overlays that declare `overflow-y-auto`.

**Architecture:** One new `src/components/ModalOverlay.tsx`: an outer `fixed inset-0 overflow-y-auto` scroll container and an inner `flex min-h-full items-center justify-center p-4` wrapper, plus a body scroll lock that restores the previous `overflow` value. Each of the 13 files swaps its overlay `<div>` open/close tags for `<ModalOverlay>`; panel markup is untouched.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4.

---

## Ground rules for this plan

1. **No API change, no new dependency, no new Tailwind utility.**
2. **Byte-identical:** `ConfirmDialog`, `AlertDialog`, `RecurringEditPrompt`, `RecurringDeletePrompt`, `SystemUsersClient`, `SystemUserDetail`, `LogConfigClient`, `LoggingTab`, `AlbumDetailModal`, `PhotoLightbox`, `StudentManage`, `BillingTab` — hashed before starting.
3. **No test suite.** `./node_modules/.bin/tsc --noEmit` and `npm run lint` (baseline **0 errors, 57 warnings**); `npm run build` at the end.
4. **Do not commit.**

## Non-goals

- The 10 overlays without `overflow-y-auto`, and the two uncapped panels in `StudentManage`/`BillingTab`.
- Escape-to-close, backdrop-click-to-close.
- Unifying `bg-opacity-*` and `bg-black/50` — all 13 in scope already use `bg-black bg-opacity-50 dark:bg-opacity-75`, so one backdrop in the component preserves each.
- `items-safe-center` — cannot fix the scroll lock on its own.

## Facts this plan is built around

- All 13 overlays are the identical string `fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto`, except `AlbumFormModal` with `z-[55]`.
- Mount pattern — the lock is only safe if the overlay exists only while open:
  - `if (!isOpen) return null` before render: `AddMemberModal`, `BulkAddModal`, `CreateClassroomModal`, `CreateSchoolYearModal`, `EditClassroomModal`, `EditMemberModal`, `EditSchoolYearModal`, `EnrollStudentModal`, `OnboardStudentModal`.
  - Conditionally mounted at the call site: `EventFormModal` (`CalendarTab`), `AlbumFormModal` (`GalleryTab`, `AlbumDetailModal`), `NoticeFormModal` and `NoticeDetailModal` (`NoticesTab`).
- `AlbumFormModal` nests over `AlbumDetailModal` (`items-start`, out of scope) — the case that needs restore-previous-value.

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/components/ModalOverlay.tsx` | Scroll container, centring wrapper, body scroll lock |
| Modify | the 13 in-scope modals | Overlay `<div>` → `<ModalOverlay>` |

---

## Task 1: `ModalOverlay`

- [ ] Props `{ children: ReactNode; zClassName?: string }`, `zClassName` default `'z-50'`.
- [ ] Outer: `fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 overflow-y-auto ${zClassName}`. Inner: `flex min-h-full items-center justify-center p-4` — padding on the inner wrapper.
- [ ] `useEffect`: capture `document.body.style.overflow`, set `'hidden'`, restore the captured value on cleanup.
- [ ] `tsc --noEmit` + `npm run lint`.

## Task 2: Migrate the 13

- [ ] Scripted per file: assert the opening line is exactly the known overlay string, replace it with `<ModalOverlay>` (`zClassName="z-[55]"` for `AlbumFormModal`), and replace the first `</div>` at the same indentation with `</ModalOverlay>`. Add the import.
- [ ] Review `git diff` per file: exactly the two tag lines plus the import.
- [ ] `tsc --noEmit` (mismatched tags fail here) + `npm run lint`.

## Task 3: Full verification

- [ ] `npm run lint` — 0 errors, 57 warnings. `tsc --noEmit` clean. `npm run build` passes.
- [ ] Protected-file hashes unchanged; no diff in `package.json`, `package-lock.json`, `public/`.
- [ ] `grep` shows no remaining `items-center justify-center z-50 p-4 overflow-y-auto` outside out-of-scope files.
- [ ] Manual: shrink the window below `OnboardStudentModal`'s height and scroll to its header; a short modal (`EditMemberModal`) still centres; background does not scroll with a modal open; open and close edit-album inside an album and confirm the edit form sat above it.

## Acceptance criteria → task map

| Criterion | Task |
|---|---|
| Tall modal top reachable | 1, 2 |
| Short modal still centred | 1 |
| Background locked, one scrollbar | 1 |
| Nested close keeps previous overflow | 1 |
| `AlbumFormModal` above `AlbumDetailModal` | 2 |
| Panel markup unchanged | 2 |
| Out-of-scope files byte-identical; lint/tsc/build; no deps | 3 |

## Follow-ups

- Migrate the 10 short dialogs and the two uncapped panels to `ModalOverlay`.
- No modal closes on `Escape` or backdrop click.
- Two backdrop spellings coexist.
- Restore-previous-value assumes overlays close in reverse order of opening (true for every nesting in the repo today); a lock counter would lift that assumption.
