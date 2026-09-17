# Classroom body checks — presence on any date (`dependable-admin`)

> Work items for a Claude Code session in the `dependable-admin` repo.
> Uses one new API field so presence works on past dates, not only today.
> **One component and one type change.** Mostly deletion.
>
> **Depends on `dependable-api/docs/body-check-attendance-per-day-prompt.md`**,
> which adds `checked_in`. That must be built and merged first — if the field is
> not in the response when you start, stop and say so rather than inferring it.
>
> Do not commit.

---

## How to run this task

1. **`superpowers:verification-before-completion`** — `npm run lint` and
   `npm run build` pass, output shown.

**Baseline**, on a clean tree at 2026-09-17: `npm run lint` → **0 errors, 57
warnings**. Passing means no new errors *and no new warnings*.
`./node_modules/.bin/tsc --noEmit` → clean, no network needed. `npm run build`
must run natively — the first build fetches a platform-specific SWC binary from
`registry.npmjs.org`.

Read `CLAUDE.md`. Do not commit.

---

## What and why

`ClassroomBodyChecks` currently derives presence from `last_checkin_at`, a
latest-only snapshot. It is only meaningful for today, so the component gates the
whole presence branch on `date === todayUtc()`:

- **today** — "X of Y present children checked", and badges `Absent`
- **any past date** — no denominator, and an absent child reads `Not checked`,
  indistinguishable from a real miss

The API now returns `checked_in: boolean` per student: whether that child had a
check-in **on the requested day**. That makes presence knowable for every date, and
the date-gating goes away.

---

## Decisions already made

| Decision | Reasoning | Rejected alternative |
|---|---|---|
| Presence is `checked_in \|\| body_checks.length > 0` | Unchanged rule, better input. A body check is a physical observation, so it is proof of attendance in its own right — this is what keeps the numerator inside the denominator | Using `checked_in` alone, which reintroduces "1 of 0" |
| The `isToday` gate is **deleted**, not extended | Its only purpose was hiding an unanswerable question. The question is now answerable on every date | Keeping it and adding a second path |
| `last_checkin_at` stops being read | It is the snapshot this task exists to stop relying on | Keeping it as a fallback — two sources of truth that disagree on past dates |
| Same copy and badges on every date | The distinction was a limitation, not a design | A different summary line for history |

---

## Changes

| File | Change |
|---|---|
| `src/lib/schools.ts` | Add `checked_in: boolean;` to `ClassroomBodyCheckStudent`. |
| `src/components/school/ClassroomBodyChecks.tsx` | Replace `checkedInOn(...)` with `student.checked_in`; delete `checkedInOn` and the `isToday` gate; `present` becomes non-nullable. |

After this the component should be **shorter**. If it grew, something was added
that this task did not ask for.

### What each site becomes

- `presentCount` — no longer conditional on the date; always
  `roster.filter(s => s.checked_in || s.body_checks.length > 0).length`.
- The `present={…}` prop — same expression per student. Its type goes from
  `boolean | null` to `boolean`, and the `present === false ? 'Absent' : 'Not checked'`
  fallback collapses to `'Absent'`.
- Departed children currently get a hardcoded `present={null}` (`:230`). Give them
  the **same expression** as the roster rows. This is a deliberate behaviour
  change: a departed child who was genuinely absent that day will badge `Absent`
  rather than `Not checked`, which is now knowable and correct. They stay excluded
  from the counts and stay in their own group.
- The summary line always shows the denominator and the muted `· N enrolled`.

---

## Silent breakages

### 1. Leaving `todayUtc()` behind as dead code

`todayUtc` has exactly two call sites, both in this component: `:115`
(`useState(() => initialDate ?? todayUtc())`, the date the picker opens on when
the page passes no `?date=`) and `:163` (the `isToday` gate). Deleting the gate
leaves `:115`, which is still needed. Delete `checkedInOn` and the `isToday`
**branch**, not `todayUtc` itself.

### 2. Dropping the body-check clause from the presence rule

`checked_in || body_checks.length > 0` is not belt-and-braces. `create_body_check`
requires no check-in, so a child can be body-checked with no attendance event and
`checked_in: false`. Using `checked_in` alone brings back "1 of 0 present children
checked" — the exact bug this surface already had once.

### 3. Trusting `checked_in` on an older API

If the portal is deployed against an API without the field, `checked_in` is
`undefined`, which is falsy — so every child reads absent and the denominator
collapses to only body-checked children. The API must merge first. Do not add a
client-side fallback to `last_checkin_at`: two rules that disagree on past dates is
worse than one deployment ordering constraint.

### 4. Changing the numerator

`checkedCount` stays `roster.filter(s => s.body_checks.length > 0).length`. It is
already correct and is not what this task touches.

---

## Acceptance criteria

- On a **past date**, the summary shows a denominator, and a child with no check-in
  and no body check that day badges `Absent`.
- On **today**, behaviour is unchanged from before this task.
- A child with a body check and no check-in counts as present on every date, and is
  never badged `Absent`.
- A child collected earlier in the day still counts as present.
- Departed children remain grouped and excluded from both counts.
- `checkedInOn` and the `isToday` gate no longer exist; `todayUtc` still does.
- `src/components/school/body-check/BodyCheckView.tsx`,
  `src/components/school/StudentManage.tsx`,
  `src/components/school/ClassroomsTab.tsx` and the page at
  `src/app/schools/[id]/classrooms/[classroomId]/body-checks/page.tsx` are
  byte-identical.
- `npm run lint` → 0 errors, 57 warnings. `tsc --noEmit` clean. `npm run build`
  passes. No change to `package.json`, `package-lock.json` or `public/`.
- Nothing committed.
