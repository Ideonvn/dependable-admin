# Classroom body checks — drill-down on the classroom tab (`dependable-admin`)

> Work items for a Claude Code session in the `dependable-admin` repo.
> The API side is specified in `dependable-api/docs/classroom-body-check-prompt.md`
> and **must be built and merged first, in its own session**; this is the portal
> client for it. If the endpoint is not live when you start, stop and say so —
> do not stub it, and do not infer a different response shape from what you find.
> The design spec is
> `dependable-api/docs/superpowers/specs/2026-09-08-classroom-body-check-design.md`.
>
> **Revised 2026-09-16.** The API contract gained `no_longer_enrolled` after
> Kanban #19 changed how departed students are handled. Nothing else in this repo
> moved — `ClassroomsTab.tsx`, `StudentManage.tsx` and every line number cited
> below are unchanged.
> Do not commit.

---

## How to run this task

1. **`superpowers:brainstorming`** — only if something below is genuinely
   ambiguous. The API contract is fixed; if a requirement here appears to
   contradict it, the contract wins and you should say so rather than inventing
   an endpoint or a field.
2. **`superpowers:writing-plans`** — a phased plan at
   `docs/superpowers/plans/<today>-classroom-body-checks.md`, following the shape
   of the existing plans in that folder.
3. Implement against the plan.
4. **`superpowers:verification-before-completion`** — `npm run lint` and
   `npm run build` must both pass and you must show the output. There is no test
   suite in this repo; the build is the type check.

**Capture the baseline first.** On a clean tree as of 2026-09-16, `npm run lint`
reports **0 errors and 57 warnings** (unused vars and `any`s across existing
components, including four in `src/lib/schools.ts`). "Passing" means **no new
errors and no new warnings** — diff against 57, never chase the absolute number,
and do not clean up pre-existing warnings as part of this task.

`npm run build` was not verified on 2026-09-16 and must be run locally: the first
build on a fresh machine downloads a platform-specific SWC binary from
`registry.npmjs.org`, so it fails in any environment without npm registry
access.

Read `CLAUDE.md` first. Match the existing Tailwind-heavy style, reuse the
existing modal and tab patterns, and **do not introduce new dependencies**.

---

## What we are building

Every classroom card in the classroom tab already shows two body-check numbers —
`Checked` and `Markers` (`ClassroomsTab.tsx` lines 163-177). They are dead ends.
An administrator can see that 12 children were checked and has no way to find out
which ones, by whom, or what the markers were.

This adds the drill-down: click the body-check block on a card, get that
classroom's roster for the day, each child showing their check(s) with the body
map and markers rendered, or nothing if they were not checked.

Assume the real user: one school administrator, on a laptop, taking a phone call
from a parent about a mark on their child.

---

## Decisions already made

| Decision | Reasoning | Rejected alternative |
|---|---|---|
| Entry point is the card's existing body-check block, made clickable | The aggregate and its detail belong together; no new navigation | A new `/schools/[id]/classrooms/[classroomId]` route — a proper classroom page is real scope beyond body checks |
| A modal, following the existing portal patterns | Cheapest, consistent with `StudentManage`'s body-check modal | A route — would give deep-linking, but needs the page shell above |
| Read-only | Capture from the browser is its own card, with edit/void, notification and backdating decisions in scope | Marker placement in the browser |
| The response's unchecked children are rendered too | The endpoint is roster-first so a compliance filter is a later client-side change; rendering only the checked ones would throw that away | Filtering to checked-only in the client |
| **No** compliance filter UI in this card | Deferred deliberately. When it lands, the denominator is children who checked in today (`last_checkin_at` in the day window) **and** `!no_longer_enrolled` — a child who never arrived, or who has left, cannot be chased | Building the toggle now |
| `no_longer_enrolled` children render as history, visually separated | They are in the response so a past day's safeguarding record cannot disappear; mixing them into the roster would imply they are still chaseable | Hiding them (loses the record) or listing them inline (implies they are current) |

---

## API contract (fixed)

```
GET /schools/{schoolId}/classrooms/{classroomId}/body-checks?date=YYYY-MM-DD
```

`date` optional, defaults to today. Response:

```ts
interface ClassroomBodyCheckEntry {
  id: string;
  checked_at: string;              // ISO datetime, UTC
  performed_by: string | null;     // null when the staff account is gone
  front: BodyCheckMarker[];
  back: BodyCheckMarker[];
}

interface ClassroomBodyCheckStudent {
  id: string;
  dependant_id: string;
  full_name: string | null;
  image_filename: string | null;
  presence_status: 'in' | 'out' | 'unknown';
  last_checkin_at: string | null;
  body_checks: ClassroomBodyCheckEntry[];   // empty === not checked
  // true when this child has a check on `date` but is no longer enrolled in this
  // classroom (they left, or were moved). History, not a compliance miss.
  // Almost always false; non-empty only when someone has left since that date.
  no_longer_enrolled: boolean;
}

interface ClassroomBodyCheckDay {
  classroom_id: string;
  date: string;
  students: ClassroomBodyCheckStudent[];    // full roster, ordered by name
}
```

`BodyCheckMarker` already exists in `src/lib/schools.ts:163`. Reuse it; do not
declare a second one. Note that `:173` is `AttendanceBodyCheck` — the type warned
about below; do not copy that one.

`performed_by` is **nullable** — the existing `AttendanceBodyCheck` type has it as
`string`, so do not copy that type and widen it silently. Render a fallback
("Unknown staff member"), not `null`.

---

## What this is not

- No capture, no marker placement, no edit, no delete.
- No compliance filter, no "not checked" toggle, no percentages.
- No change to `StudentManage.tsx`'s **behaviour** — the extraction below must be
  a pure refactor.
- No new dependencies. No charting library. No date library — the portal formats
  dates with `toLocaleDateString` / `toLocaleTimeString` today; follow it.
- Do not re-add the body-map PNGs. `public/assets/images/body-check/baby-front.png`
  and `baby-back.png` are **already there**.

---

## Changes

| File | Change |
|---|---|
| `src/lib/schools.ts` | Add the three interfaces above and `schoolsApi.getClassroomBodyChecks(schoolId, classroomId, date?)`. Follow the existing `apiClient.get<T>` + try/catch shape used by `getClassrooms`. |
| `src/components/school/body-check/BodyCheckView.tsx` | **New.** The front/back body map with marker overlay and the notes list — extracted verbatim from `StudentManage.tsx` lines **1141-1188** (1189 closes the
   enclosing `px-6 pb-6` wrapper opened at 1134 — taking it gives unbalanced JSX). Props: `{ front: BodyCheckMarker[]; back: BodyCheckMarker[] }`. |
| `src/components/school/StudentManage.tsx` | Replace the inlined render with `<BodyCheckView />`. **Nothing else changes.** The modal chrome, the header, the `performed_by` line and the state all stay where they are. |
| `src/components/school/ClassroomBodyChecksModal.tsx` | **New.** Date picker (defaults to today), roster list, per-child checked/unchecked state, `BodyCheckView` per check. |
| `src/components/school/ClassroomsTab.tsx` | Make the body-check block a `<button>` that opens the modal. Add the modal at the bottom alongside the two existing ones. |

### The extraction

`StudentManage.tsx` is 1,899 lines and the body-check render is inline inside it.
Extract the **image + markers + notes list** only — the grid of front and back
with the overlay dots and the numbered note list. Leave the modal wrapper, the
close button and the `By {performed_by} · {time}` line in `StudentManage`, because
the new modal composes them differently.

Verify the refactor by loading a student who has a body check and confirming the
render is pixel-identical to before. This is the one place in this task where a
regression would be invisible in the build output.

---

## Silent breakages

### 1. The marker overlay's geometry is load-bearing on two CSS properties

The current markup works because the wrapper is `relative inline-block` and
shrink-wraps the image, so `left: ${m.x_marker * 100}%` is a percentage of the
**image box**:

```jsx
<div className="relative inline-block">
  <img src={imgSrc} className="block w-40 object-contain" />
  <div className="absolute ..." style={{ left: `${m.x_marker * 100}%`, ... }} />
</div>
```

Move the width to the wrapper, give the wrapper `w-full`, or drop the component
into a flex or grid child that stretches it, and **every marker shifts** — no
error, no type failure, artwork that still looks fine, dots in the wrong place on
a safeguarding record.

The width must stay on the `<img>`. If the new modal needs a different size, pass
it as a prop that lands on the `<img>` className, not on the wrapper.

### 2. The card's click handler already has an owner

The classroom card's `onClick` opens `EditClassroomModal`. A new click target
inside it without `e.stopPropagation()` opens **both** modals stacked. The card's
existing edit button already does this correctly — copy that pattern:

```jsx
onClick={(e) => { e.stopPropagation(); /* open body checks */ }}
```

### 3. `presence_status` is lowercase and has three members

The API serialises `PresenceStatus` as `"in"` / `"out"` / `"unknown"`
(`dependable-api/app/school/models.py:69-72`), and `src/lib/schools.ts:81` already
types it correctly as `'in' | 'out' | 'unknown'`. Uppercase or a two-member union
will type-check against a hand-written interface and then fail to match at
runtime. `"unknown"` is the legacy-data default and is reachable.

### 4. `performed_by` is nullable here and non-nullable on the existing type

Copying `AttendanceBodyCheck` and adding fields will give you `performed_by: string`,
which type-checks and renders the literal string "null" when a staff account has
been deleted. Declare it `string | null` and handle it.

### 5. Times are UTC; the portal must convert

`checked_at` is UTC, as every API datetime in this platform is. The portal
converts at render time — `toLocaleTimeString` — exactly as `StudentManage` does
today. Do not print the raw string, and do not add a timezone library.

### 6. `no_longer_enrolled` children skew any count the modal shows

They are in `students` like everyone else, so `students.length` is the roster plus
departed children with records. Any count the modal renders — "12 of 20 checked" —
must exclude them, or a past date reads as though the class were larger than it
was. This type-checks and looks plausible.

### 7. Do not sort markers client-side

Render `front` and `back` in the order the API returns them. The numbering in the
notes list is array position (`#{i + 1}`, as `StudentManage` does today), and a
separate API change is making that order deterministic — a client-side sort would
fight it and make the two screens disagree about which marker is `#1`.

### 8. The date picker and the card's counts

The card's `Checked` number is always **today**. If the modal's date picker is
moved to a past day, the two no longer describe the same thing. The modal must
show the selected date prominently in its header so this is obvious.

Related, and worth knowing rather than fixing: for a child checked **twice** in a
day, the card counts one child and shows only the latest check's markers (it reads
denormalised columns), while this modal shows both checks and all markers. So the
modal's marker total can exceed the card's. Label the modal's own totals; do not
present them as an explanation of the card's number.

---

## Acceptance criteria

- The body-check block on a classroom card is clickable and opens the modal;
  clicking it does **not** also open `EditClassroomModal`.
- The modal lists the classroom's full roster for the selected date, ordered by
  name, with a clear visual distinction between checked and unchecked children.
- A checked child shows each check with time, who performed it, the front and back
  body maps with markers positioned correctly, and the notes list.
- An unchecked child renders as such — not omitted, not an error state.
- A child with `no_longer_enrolled: true` is visually separated from the roster
  (a labelled group, not an inline row) and is never counted or presented as an
  un-checked child. On a date where nobody has left, no such group appears at all.
- A check with `performed_by: null` renders a readable fallback.
- The date defaults to today and can be changed; the selected date is visible in
  the header.
- `BodyCheckView` is used by both `StudentManage` and the new modal, and the
  student page's body-check render is unchanged from before the refactor
  (verified by eye against a student with markers).
- Marker positions in the extracted component match the student page exactly —
  check one marker near an edge, where a geometry regression is most visible.
- Dark mode is handled throughout, matching the surrounding components.
- No new dependency in `package.json`. No new file in `public/`.
- `npm run lint` and `npm run build` both pass, with output shown.
- Nothing committed.
