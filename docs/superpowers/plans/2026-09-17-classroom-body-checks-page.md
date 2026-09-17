# Classroom Body Checks Page Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Source brief: `docs/classroom-body-check-page-prompt.md`. Follows `2026-09-16-classroom-body-checks.md`.

**Goal:** Replace the classroom body-check modal with a linkable page at `/schools/[id]/classrooms/[classroomId]/body-checks?date=YYYY-MM-DD`, with compact expandable rows, student-profile links, and a presence count whose numerator is a subset of its denominator.

**Architecture:** A thin server page (mirroring `src/app/schools/[id]/students/[studentId]/page.tsx`) awaits `params`/`searchParams` and renders a client component `ClassroomBodyChecks` adapted from `ClassroomBodyChecksModal`. The date is seeded from `?date=` and written back with `router.replace`. The classroom name comes from the existing `schoolsApi.getClassroom`. The modal is deleted; the card's body-check block becomes a `<Link>`.

**Tech Stack:** Next.js 16 App Router, React 19 (React Compiler lint rules), TypeScript 5, Tailwind CSS 4, `lucide-react`.

---

## Ground rules for this plan

1. **No API change, no new dependencies.**
2. **Byte-identical:** `src/lib/schools.ts`, `BodyCheckView.tsx`, `StudentManage.tsx` — hashed before starting.
3. **No test suite.** Per task: `./node_modules/.bin/tsc --noEmit` and `npm run lint` (baseline **0 errors, 57 warnings**). `npm run build` at the end.
4. **Do not commit.** Do not clean up pre-existing warnings. Do not touch the shared modal overlay.

## Non-goals

- Fixing the shared `items-center` + `overflow-y-auto` overlay (13 components).
- Correcting `getClassroom`'s return type.
- Per-day attendance for past dates.

## Facts this plan is built around

- `params` and `searchParams` are Promises in Next 16.
- The school page picks its tab from `window.location.hash`; `classrooms` is valid, so the back-link is `/schools/${id}#classrooms`.
- `getClassroom` is typed `Classroom` but the endpoint omits `students_overview` — read `name` only.
- `create_body_check` does not require a check-in, so a body check is evidence of presence.

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/app/schools/[id]/classrooms/[classroomId]/body-checks/page.tsx` | Server wrapper: await params, validate `?date=`, back-link, card |
| Create | `src/components/school/ClassroomBodyChecks.tsx` | Heading, date ↔ URL, fetch with date tag, summary, compact rows |
| Delete | `src/components/school/ClassroomBodyChecksModal.tsx` | Replaced by the page |
| Modify | `src/components/school/ClassroomsTab.tsx` | Body-check block → `<Link>` with `stopPropagation`; drop modal state/import/render |

---

## Task 1: Server page

- [ ] Mirror the student page's wrapper exactly; back-link `/schools/${id}#classrooms`, "Back to classrooms".
- [ ] `const { date } = await searchParams`; pass it through only if it matches `^\d{4}-\d{2}-\d{2}$`, else `undefined` (→ today UTC in the client).

## Task 2: `ClassroomBodyChecks`

- [ ] Carry over verbatim: `todayUtc`, `formatDay` (`timeZone: 'UTC'`), `checkedInOn`, `formatTime`, the date-tagged `result` state and `ignore` guard, the roster/departed split, badges and summary copy.
- [ ] Counting fix at both sites: `isPresent = checkedInOn(s, date) || s.body_checks.length > 0`, used by `presentCount` and the `present` prop.
- [ ] Props `{ schoolId, classroomId, initialDate? }`. `date` state seeded from `initialDate ?? todayUtc()`; on change `setDate` + `router.replace(\`?date=…\`, { scroll: false })`.
- [ ] Classroom name: `getClassroom` in its own effect, `name` only, set from callbacks; fallback heading "Classroom" while loading or on failure.
- [ ] Row: `<Link>` (avatar + name) → `/schools/${schoolId}/students/${student.id}`, as a sibling of the expand `<button>` (badge + chevron, `aria-expanded`). Unchecked children render the badge as a plain `<span>`, no button. Expanded body maps below the row via `BodyCheckView`.
- [ ] `tsc --noEmit` + `npm run lint`.

## Task 3: `ClassroomsTab` + delete modal

- [ ] Replace the body-check `<button>` with `<Link href=… onClick={(e) => e.stopPropagation()}>`, same classes.
- [ ] Remove `bodyCheckClassroom` state, modal import and render. Delete `ClassroomBodyChecksModal.tsx`; `grep` confirms no importers.
- [ ] `tsc --noEmit` + `npm run lint`.

## Task 4: Full verification

- [ ] `npm run lint` — 0 errors, 57 warnings. `tsc --noEmit` clean. `npm run build` passes and lists the new route.
- [ ] Protected-file hashes unchanged; no diff in `package.json`, `package-lock.json`, `public/`.
- [ ] Manual: cold-load a `?date=` URL; change the date and watch the URL; back-link lands on Classrooms; card block navigates without opening the edit modal; name click navigates without expanding; child with a check and no check-in reads `1 of 1`.

## Acceptance criteria → task map

| Criterion | Task |
|---|---|
| Route, `?date=` round-trip, pasted link | 1, 2 |
| Normal page scroll, heading reachable | 1 |
| Classroom name on cold load | 2 |
| Back-link to Classrooms tab | 1 |
| Compact rows, expand only when checked | 2 |
| Name/avatar link, sibling of expand | 2 |
| Card link doesn't open edit modal | 3 |
| `1 of 1`, not `1 of 0`; not `Absent` | 2 |
| Departed grouped, uncounted | 2 |
| Modal deleted, no importers | 3 |
| Byte-identical files, lint/tsc/build, no deps | 4 |

## Follow-ups

- Shared modal overlay clips the top of tall modals and has no scroll lock (13 components).
- `schoolsApi.getClassroom` typed `Promise<Classroom>`; endpoint omits `students_overview`.
- Past dates badge absent children `Not checked`; needs per-day attendance from the API.
