# Classroom body checks — move to a dedicated page (`dependable-admin`)

> Work items for a Claude Code session in the `dependable-admin` repo.
> Replaces the body-check **modal** with a **page**, restructures the roster rows,
> adds links to student profiles, and folds in one counting fix.
>
> **No API change.** Every endpoint and client method this needs already exists.
> Follows `docs/classroom-body-check-prompt.md` and
> `docs/classroom-body-check-denominator-prompt.md`, both already built.
>
> Do not commit.

---

## How to run this task

1. **`superpowers:writing-plans`** — a phased plan at
   `docs/superpowers/plans/<today>-classroom-body-checks-page.md`, following
   `2026-09-16-classroom-body-checks.md` in that folder.
2. Implement against the plan.
3. **`superpowers:verification-before-completion`** — output shown.

**Baseline**, on a clean tree at 2026-09-17: `npm run lint` → **0 errors, 57
warnings**. Passing means no new errors *and no new warnings*; diff against 57 and
do not clean up pre-existing ones. `./node_modules/.bin/tsc --noEmit` → clean, and
needs no network. `npm run build` must run natively — the first build on a fresh
machine fetches a platform-specific SWC binary from `registry.npmjs.org`.

Read `CLAUDE.md`. Do not commit.

---

## Why this is changing

The modal shipped and was reviewed against real data. Three problems:

**1. Its top is unreachable.** The overlay is
`fixed inset-0 … flex items-center justify-center … overflow-y-auto`. When content
is taller than the viewport, `items-center` centres it so the overflow runs in both
directions, but scrolling only reaches downward — the top is clipped and cannot be
scrolled to. **13 components in this repo share that exact overlay string**; they
are short forms that never exceed the viewport, so this is the first to expose it.

**2. Two scrollbars.** The overlay scrolls internally while the page behind keeps
its own. There is no scroll lock anywhere in the repo.

**3. It is too dense**, because a body check is ~400px tall and every checked child
renders one inline.

A page fixes all three without touching the shared modal pattern, and gives a
shareable URL for a classroom and a date — which is the fourth thing wanted here.

**Not in scope: fixing the shared overlay.** The `items-center` bug is real and
affects twelve other modals. Leave them; record it as a follow-up.

---

## Decisions already made

| Decision | Reasoning | Rejected alternative |
|---|---|---|
| A dedicated page, not a fixed modal | Removes both layout bugs by construction rather than patching an overlay 13 components share, and makes the surface linkable | Keeping the modal with `items-start` + a scroll lock — cheaper, but no deep link, still cramped, and it either forks the house pattern or becomes a repo-wide change |
| Date lives in the URL as `?date=` | A link to a classroom **and a day** is the point of moving to a page | Date in component state only |
| Compact rows, click a checked row to expand inline | Every child stays visible and scannable; the body map appears only when asked for | A nested modal (reintroduces the thing being escaped); a checked-only default (inverts the purpose — the misses are what matters) |
| Name and avatar link to the student page | Matches the rest of the portal and costs no row width | A separate "View profile" control on every row |
| Presence counts a body check as proof of attendance | See *The counting fix* | Leaving the numerator and denominator over different sets |

---

## The counting fix

Live data currently renders **"1 of 0 present children checked"**.

`create_body_check` requires only that the student and classroom are active
(`ensure_enrollment_prereqs`) — **it does not require a check-in**. So a child can
have a body check with no `last_checkin_at` today. The numerator counts roster
children *with checks*; the denominator counts roster children *who checked in*.
Different sets, so the sentence can be false even when the numbers look ordinary:

| Class | Renders now | Should read |
|---|---|---|
| Ana✓✓ Ben✓✓ Cara✓✗ Dan✗✓ Eve✗✗ | `3 of 3` — but Cara was present and unchecked, Dan checked and uncounted | `3 of 4` |
| attendance round not done yet | `3 of 1` | `3 of 3` |
| nobody checked in at all | `2 of 0` | `2 of 2` |

Change the presence predicate to treat a body check as evidence of presence:

```ts
const present = checkedInOn(student, date) || student.body_checks.length > 0;
```

A body check is a physical observation of the child, so it is stronger evidence of
attendance than a check-in tap. This makes the numerator a subset of the
denominator by construction, and fixes the badge: a child with a check but no
check-in currently shows green `Checked` while being counted absent.

Apply it at **both** sites — the `presentCount` filter and the `present={…}` prop.

---

## Changes

| File | Change |
|---|---|
| `src/app/schools/[id]/classrooms/[classroomId]/body-checks/page.tsx` | **New.** Server component: back-link + card wrapper around the client component, mirroring `src/app/schools/[id]/students/[studentId]/page.tsx` exactly. `params` and `searchParams` are Promises in Next 16 — await them, as that page awaits `params`. |
| `src/components/school/ClassroomBodyChecks.tsx` | **New**, adapted from `ClassroomBodyChecksModal.tsx`: same data loading, date tagging, roster/departed split, badges and totals. Loses the overlay, the header chrome and the close button; gains compact rows, expansion and the classroom name. |
| `src/components/school/ClassroomBodyChecksModal.tsx` | **Delete.** |
| `src/components/school/ClassroomsTab.tsx` | The body-check block becomes a `<Link>` to the new page. Remove `bodyCheckClassroom` state, the modal import and the modal render. |

### The page

Route: `/schools/[id]/classrooms/[classroomId]/body-checks?date=YYYY-MM-DD`.
`date` absent → today (UTC), as now.

Back-link: **`/schools/${id}#classrooms`**. The school page reads the tab from
`window.location.hash` (`getInitialTab`, `src/app/schools/[id]/page.tsx:22-30`) and
`classrooms` is a valid tab id, so this returns the user to the tab they left. Do
not copy the student page's bare `/schools/${id}`, which lands on Details.

### The classroom name

`schoolsApi.getClassroom(schoolId, classroomId)` already exists
(`src/lib/schools.ts:853`) and the endpoint already exists
(`GET /{school_id}/classrooms/{classroom_id}`). Use it for the heading — a deep
link has no other way to know the name.

**Read only `name` (and `is_active` if useful) from that call.** It is typed
`Promise<Classroom>`, but the endpoint returns `ClassroomSchema`, which has **no
`students_overview`** — that field only comes from the list endpoint's
`ClassroomWithOverviewSchema`. Touching `classroom.students_overview` from this
call type-checks and throws at runtime. Do not "fix" the type as part of this task;
record it as a follow-up.

### Rows

One line per child: avatar, name, badge, and an expand control for checked
children. The body map appears below the row when expanded, rendered by the
existing `BodyCheckView` — unchanged.

- Expanded state is per-child and local. Nothing needs to persist.
- A child with several checks expands to all of them, as now.
- Departed children keep their own "No longer enrolled" group, still excluded from
  the counts, still never badged `Absent`.
- The summary line, the muted `· N enrolled`, and the badge vocabulary
  (`Checked` / `Checked ×N` green, `Not checked` amber for a real miss, `Absent`
  grey, plain `Not checked` on past dates) all carry over unchanged apart from the
  counting fix above.

---

## Silent breakages

### 1. A link nested inside a button

The name and avatar link to the student page, and the row also expands. Putting an
`<a>` inside a `<button>` (or vice versa) is invalid HTML and behaves
unpredictably — clicks land on the wrong target, keyboard navigation breaks.

Make them **siblings**: the `<Link>` on the left, a separate expand `<button>` as
its own element. Do not wrap the whole row in one interactive element.

### 2. The card link still fires the card's own click

`ClassroomsTab`'s card has an `onClick` that opens `EditClassroomModal`. The
current body-check `<button>` calls `e.stopPropagation()`; a `<Link>` needs it just
the same, or clicking it opens the edit modal *and* navigates.

### 3. The date must round-trip through the URL

Changing the date has to update `?date=` — otherwise the address bar lies and the
link a user copies points at a different day than their screen. Use a client-side
replace so it does not push a history entry per keystroke.

Read the initial date from `searchParams`, not from component state alone, or a
pasted link opens on today.

### 4. `toISOString()` on a `Date` built from a local date string

The UTC-day handling is correct today (`todayUtc`, `formatDay` with
`timeZone: 'UTC'`, and `checkedInOn` comparing UTC date strings). Carry it across
verbatim. Reconstructing any of it with local-timezone parsing puts SAST users two
hours out.

### 5. Losing the request's date tag

The existing component tags each result with the date it was for, so a slow
response never renders under a newer date. That logic must survive the move.

---

## Acceptance criteria

- `/schools/{id}/classrooms/{classroomId}/body-checks` renders the roster for
  today; `?date=2026-08-12` renders that day; changing the date updates the URL;
  pasting a URL with `?date=` opens on that date.
- The page scrolls normally, has one scrollbar, and its heading is reachable with
  any number of children and any number of expanded checks.
- The classroom name is in the heading on a cold load with no client-side state.
- Back-link returns to the school page **on the Classrooms tab**.
- Rows are one line until expanded; expanding a checked child shows its body
  map(s) via `BodyCheckView`; unchecked and absent children have no expand control.
- Clicking a name or avatar navigates to that student's page; clicking it does not
  also expand the row.
- Clicking the card's body-check block navigates to the page and does **not** open
  `EditClassroomModal`.
- With a child who has a body check and no check-in today, the summary reads
  `1 of 1`, never `1 of 0`, and that child is not badged `Absent`.
- Departed children remain grouped, uncounted and never badged `Absent`.
- `ClassroomBodyChecksModal.tsx` is deleted and nothing imports it.
- `BodyCheckView.tsx`, `StudentManage.tsx` and `src/lib/schools.ts` are
  byte-identical.
- `npm run lint` → 0 errors, 57 warnings. `tsc --noEmit` clean. `npm run build`
  passes. No change to `package.json`, `package-lock.json` or `public/`.
- Nothing committed.

---

## Follow-ups, not for this card

- The shared modal overlay: `items-center` with `overflow-y-auto` clips the top of
  any modal taller than the viewport, and nothing locks background scroll. 13
  components, including `EditClassroomModal` and `ConfirmDialog`.
- `schoolsApi.getClassroom` is typed `Promise<Classroom>` but the endpoint omits
  `students_overview`.
- A past date still badges an absent child `Not checked`, because presence that day
  is unknowable from a latest-only `last_checkin_at`. Closing it needs per-day
  attendance from the API.
