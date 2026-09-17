# Classroom body checks — honest denominator (`dependable-admin`)

> Work items for a Claude Code session in the `dependable-admin` repo.
> A follow-up to `docs/classroom-body-check-prompt.md`, which shipped the
> drill-down. **One file changes. No API change, no new data, no new types.**
>
> That work order deliberately deferred the compliance view, but the modal's
> summary line and row badges ended up implying one — using the denominator the
> design explicitly rejected. This corrects the framing only.
>
> Do not commit.

---

## How to run this task

1. **`superpowers:verification-before-completion`** — `npm run lint` and
   `npm run build` must both pass, output shown.

**Baseline**, measured on a clean tree on 2026-09-16: `npm run lint` → **0 errors,
57 warnings**. "Passing" means no new errors *and no new warnings* — diff against
57, and do not clean up pre-existing warnings here.

`npm run build` must be run natively: the first build on a fresh machine fetches a
platform-specific SWC binary from `registry.npmjs.org`, so it fails in any
environment without npm registry access. `./node_modules/.bin/tsc --noEmit` is the
type check and needs no network — run it too.

Read `CLAUDE.md`. Do not commit.

---

## What and why

`ClassroomBodyChecksModal` currently reads:

> On this day: **3 of 20** children checked · **5** markers across all checks

where 20 is everyone enrolled in the classroom that day, and every child without a
check gets a **"Not checked"** badge.

If five of those twenty were absent, the honest figure is 3 of 15, and those five
children are not misses — they were never there. A body check is a physical
observation; a child who did not arrive cannot be checked. As the design spec puts
it, counting them produces permanent false positives, and an admin who is shown
permanent false positives on a safeguarding screen learns to ignore the screen.

The response already carries what is needed: `last_checkin_at`, which the modal
currently ignores.

---

## The constraint that shapes this

`Student.last_checkin_at` is a **latest-only snapshot** — `create_attendance_event`
overwrites it on every check-in (`dependable-api/app/school/service.py:1992`). It
answers "did this child check in today", and says **nothing** about any earlier
day.

So presence is knowable for today and unknowable for a past date, and the fix is
asymmetric by date. That asymmetry is the point of this task, not an oversight in
it.

---

## Decisions already made

| Decision | Reasoning | Rejected alternative |
|---|---|---|
| **Today**: denominator is children who checked in today | A child who never arrived cannot be body-checked; including them makes the number permanently wrong in the same direction | All enrolled (what ships today) |
| **Past dates**: no denominator — a count only | Presence on that day cannot be recovered from a latest-only snapshot, and a guess on a safeguarding screen is worse than an absent number | Inferring presence; or adding per-day attendance to the API (a real option, its own card) |
| Presence test is `last_checkin_at` **within the UTC day**, never `presence_status` | `presence_status` is current state: a child collected at 14:00 reads `out` but *was* present. `cls_agg` draws exactly this line — `checked_in_today` uses `last_checkin_at`; only `in_now` adds `presence_status` | `presence_status === 'in'`, which by mid-afternoon undercounts most of the class |
| Three badge states today, two for a past date | The third state only exists where the data supports it | One set of states for all dates |
| Departed children stay out of numerator and denominator | Already true; this task must not regress it | Counting them now that the roster maths is being touched |

---

## What this is not

- **No API change.** No new field, no new request, no contract change. If you find
  yourself editing `src/lib/schools.ts`, stop — the data is already there.
- **No compliance filter.** Still no "show only unchecked" toggle. This is the
  summary line and the badges, nothing more.
- **Do not touch `BodyCheckView.tsx` or `StudentManage.tsx`.** Neither is involved.
- **Do not sort markers client-side.** A separate API card is making that order
  deterministic.

---

## Changes

| File | Change |
|---|---|
| `src/components/school/ClassroomBodyChecksModal.tsx` | The `checkedCount` / summary line and `StudentRow`'s badge. Everything else stays. |

### Copy

**Today:**

```
On this day: {checked} of {present} present children checked · {markers} marker(s) across all checks
```

A muted `· {roster.length} enrolled` suffix is optional and welcome; a third
prominent number is not.

**A past date:**

```
On this day: {checked} children checked · {markers} marker(s) across all checks
```

### Badges

| State | When | Style |
|---|---|---|
| `Checked` / `Checked ×N` | has checks | green, as now |
| `Not checked` | **today only**, present but no check — a real miss | amber. Not orange: the classroom card already uses orange for its own absent count, and these two must not read as the same thing |
| `Absent` | **today only**, no check-in today | neutral grey, as the current "Not checked" is |
| `Not checked` | a past date, no check | the existing grey badge, unchanged |

---

## Silent breakages

### 1. Applying the presence test to a past date

The single most likely mistake. `last_checkin_at` is today's snapshot, so on a
12 August view every child who happened to check in *today* would count as
"present on 12 August", and every child who has since left the school would count
as absent. The result is a confident, wrong denominator on historical data.

Gate the whole presence branch on `date === todayUtc()`, using the same
`todayUtc()` the component already has. Do not compare against a locally-derived
date.

### 2. Reaching for `presence_status`

It is a current-state snapshot with values `in | out | unknown`. `out` means the
child has been collected — they were present. Using it as the presence test
silently shrinks the denominator through the afternoon, which makes the compliance
number *look better* as the day goes on. `cls_agg` avoids exactly this.

### 3. A local-midnight window

The day window must be the UTC day matching `date`, the same basis as the API and
the classroom card. A window built from local midnight is two hours out in SAST and
will misclassify early check-ins.

### 4. Losing the departed-children exclusion

`roster` / `departed` already split on `no_longer_enrolled`, and the totals use
`roster`. Adding a presence filter on top must narrow the roster, not replace the
split — a departed child with a check must still appear in its own group and still
be outside both counts.

---

## Accepted gap, not a bug

On a past date a child who was absent still shows `Not checked`, because presence
that day is unknowable. This is a deliberate tradeoff, recorded here so it is not
rediscovered as a defect: the alternative was to guess. Closing it properly means
returning per-day attendance from the endpoint — noted as a follow-up in
`dependable-api/docs/superpowers/specs/2026-09-08-classroom-body-check-design.md`.

---

## Acceptance criteria

- Viewing **today**: the denominator is children who checked in today; a present
  child with no check badges as a miss; a child with no check-in today badges
  `Absent` and is in neither the numerator nor the denominator.
- Viewing **a past date**: no denominator is shown, the count of checked children
  and the marker total are, and no child is badged `Absent`.
- A child collected earlier today (`presence_status: 'out'`, `last_checkin_at`
  today) counts as **present**.
- Departed children remain in their own group, excluded from both counts, on every
  date.
- The marker total still says "across all checks" and is not presented as the
  classroom card's number.
- `src/lib/schools.ts`, `BodyCheckView.tsx` and `StudentManage.tsx` are
  byte-identical.
- `npm run lint` → 0 errors, 57 warnings. `tsc --noEmit` clean. `npm run build`
  passes, output shown.
- No change to `package.json`, `package-lock.json` or `public/`.
- Nothing committed.
