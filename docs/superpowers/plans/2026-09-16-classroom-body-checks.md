# Classroom Body Checks Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Source brief: `docs/classroom-body-check-prompt.md`.

**Goal:** Make the body-check block on each classroom card open a read-only modal listing that classroom's roster for a chosen day, with each child's body check(s) rendered on the front/back body map.

**Architecture:** Extract the body map + marker overlay + notes list out of `StudentManage.tsx` into `src/components/school/body-check/BodyCheckView.tsx` as a pure refactor, then compose it in a new `ClassroomBodyChecksModal.tsx` opened from `ClassroomsTab.tsx`. Data fetching is `useEffect` + local state, as in every other tab. No new dependencies, no new files in `public/`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Axios via `apiClient`, `lucide-react`.

---

## Ground rules for this plan

1. **No new dependencies.** Dates via `toLocaleDateString` / `toLocaleTimeString`.
2. **No test suite.** Per task: `npm run lint` (baseline **0 errors, 57 warnings** on 2026-09-16 — no new ones) and `npx tsc --noEmit`. `npm run build` is the gate at the end.
3. **Do not commit.**
4. **Do not clean up pre-existing lint warnings.**

## Non-goals

- Capture, marker placement, edit, delete.
- Compliance filter, "not checked" toggle, percentages.
- Any behaviour change in `StudentManage.tsx`.
- Client-side marker sorting — array order is the `#n` numbering.

## API facts this plan is built around

- `GET /schools/{schoolId}/classrooms/{classroomId}/body-checks?date=YYYY-MM-DD` — verified live on `localhost:8000` and matching `ClassroomBodyCheckDaySchema` in `dependable-api/app/school/schemas.py`.
- `date` is a **UTC** day and defaults to UTC today, matching the card's counts. The picker therefore defaults to `new Date().toISOString().split('T')[0]` (the `EnrollStudentModal` pattern).
- `students` is the full roster ordered by name, **plus** `no_longer_enrolled` children who have a check that day.
- `performed_by` is `string | null`. `presence_status` is `'in' | 'out' | 'unknown'`. `checked_at` is UTC.

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/lib/schools.ts` | Three interfaces + `schoolsApi.getClassroomBodyChecks` |
| Create | `src/components/school/body-check/BodyCheckView.tsx` | Front/back map, marker overlay, notes list (verbatim from `StudentManage.tsx` 1141-1188) |
| Modify | `src/components/school/StudentManage.tsx` | Render `<BodyCheckView />` in place of the inline block |
| Create | `src/components/school/ClassroomBodyChecksModal.tsx` | Date picker, roster, per-child checks, departed-children group |
| Modify | `src/components/school/ClassroomsTab.tsx` | Body-check block becomes a `<button>` with `stopPropagation`; mount modal |

---

## Task 1: Wire types and API call

**Files:** Modify `src/lib/schools.ts`

- [ ] After `AttendanceCalendarMonth`, add `ClassroomBodyCheckEntry` (`performed_by: string | null`, reusing `BodyCheckMarker`), `ClassroomBodyCheckStudent` (`presence_status: 'in' | 'out' | 'unknown'`, `no_longer_enrolled: boolean`) and `ClassroomBodyCheckDay`. Do **not** derive from `AttendanceBodyCheck`.
- [ ] Add `getClassroomBodyChecks(schoolId, classroomId, date?)` next to `getClassrooms`, with the `apiClient.get<T>` + try/catch shape. Unlike `getClassrooms` it **rethrows**: an empty roster must not be indistinguishable from a failed request on a safeguarding screen.
- [ ] `npm run lint && npx tsc --noEmit`

## Task 2: Extract `BodyCheckView`

**Files:** Create `src/components/school/body-check/BodyCheckView.tsx`; modify `src/components/school/StudentManage.tsx`

- [ ] Move lines 1141-1188 verbatim into the component. Props `{ front: BodyCheckMarker[]; back: BodyCheckMarker[] }`; `selectedBodyCheck[side]` becomes a lookup on props.
- [ ] Width stays on the `<img>` (`w-40`); the wrapper stays `relative inline-block`. No size prop — nothing needs one yet.
- [ ] In `StudentManage`, replace the block with `<BodyCheckView front={selectedBodyCheck.front} back={selectedBodyCheck.back} />`. Modal chrome, header and `By {performed_by}` line are untouched.
- [ ] `npm run lint && npx tsc --noEmit`
- [ ] Manual: open a student with a marker near an edge; render must match pre-refactor.

## Task 3: Build `ClassroomBodyChecksModal`

**Files:** Create `src/components/school/ClassroomBodyChecksModal.tsx`

- [ ] Props `{ isOpen, onClose, schoolId, classroom: Classroom }`. `if (!isOpen) return null`, `fixed inset-0` overlay as in `EditClassroomModal`.
- [ ] Header: classroom name + selected date formatted prominently (`toLocaleDateString` with `timeZone: 'UTC'` so the YYYY-MM-DD does not shift), `<input type="date">` defaulting to UTC today.
- [ ] Fetch in `useEffect` on `[isOpen, date]`; explicit loading / error / empty states.
- [ ] Split `students` into `roster` (`!no_longer_enrolled`) and `departed`. Counts — "`n` of `m` checked", "`k` markers" — come from `roster` only and are labelled as this modal's totals.
- [ ] Each child: profile image, name, checked/not-checked badge. Each check: `toLocaleTimeString` time, `performed_by ?? 'Unknown staff member'`, `<BodyCheckView />`. Markers rendered in API order.
- [ ] `departed` renders under a labelled "No longer enrolled" group, only when non-empty.
- [ ] Dark-mode classes throughout.
- [ ] `npm run lint && npx tsc --noEmit`

## Task 4: Wire into `ClassroomsTab`

**Files:** Modify `src/components/school/ClassroomsTab.tsx`

- [ ] Turn the body-check block (lines 163-177) into a `<button type="button">` with `onClick={(e) => { e.stopPropagation(); ... }}`, keeping its layout.
- [ ] Add `bodyCheckClassroom` state and mount the modal beside the two existing ones.
- [ ] `npm run lint && npx tsc --noEmit`

## Task 5: Full verification

- [ ] `npm run lint` — 0 errors, 57 warnings.
- [ ] `npm run build` — passes.
- [ ] `git diff --stat package.json public/` — empty.
- [ ] Manual: card click still opens edit modal only; body-check block opens body-check modal only; past date shows date in header; student page body-check render unchanged.

## Acceptance criteria → task map

| Criterion | Task |
|---|---|
| Clickable block, no stacked edit modal | 4 |
| Full roster ordered by name, checked vs unchecked | 3 |
| Check shows time, performer, maps, notes | 2, 3 |
| Unchecked child rendered | 3 |
| `no_longer_enrolled` separated and uncounted | 3 |
| `performed_by: null` fallback | 1, 3 |
| Date defaults to today, visible in header | 3 |
| `BodyCheckView` shared, student page unchanged | 2 |
| Marker geometry preserved | 2 |
| Dark mode | 3, 4 |
| No new deps / public files; lint + build pass | 5 |
