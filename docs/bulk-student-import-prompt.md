# Bulk CSV import into an existing school (`dependable-admin`)

> Work items for a Claude Code session in the `dependable-admin` repo. Kanban #13.
> The UI half of the bulk-import feature: a split **Add** button on the school
> onboarding screen whose dropdown opens a CSV upload modal.
>
> **Depends on `dependable-api/docs/bulk-student-import-prompt.md` being merged
> first.** It adds the endpoint this calls and the two response fields the
> duplicate badge reads. Do not start until
> `POST /admin/onboarding/schools/{school_id}/records/import` exists.
>
> This repo has no test suite. Verify with `npm run lint` and `npm run build`
> (the build typechecks). Do not commit.

---

## How to run this task

1. **`superpowers:verification-before-completion`** — `npm run lint` and
   `npm run build`, output shown. Do not commit.

Read `CLAUDE.md`. Prefer the code in `src/` over the older docs, which still
describe a retired CSV-batch product shape.

**Four components in `src/components/` are orphaned legacy and must not be
revived, extended or imported:** `CSVUpload.tsx`, `BatchList.tsx`,
`BatchValidator.tsx`, `InviteManager.tsx`. Nothing in `src/` imports any of
them, and `CSVUpload.tsx` calls an `api.uploadCSV` that no longer exists. A grep
for "CSV upload" will find `CSVUpload.tsx` first — it is not the thing to reuse.
Leave all four alone; deleting them is not in scope either.

---

## What and why

A school already live on the platform has handed us 60 more students. The only
CSV upload in the portal is on `/onboarding/create`, which creates a new school
as part of the same submit, so it cannot be used. The operator is adding the 60
children one row at a time with the **Add** button on
`/onboarding/[id]`.

The API work order adds an import endpoint for an existing school. This work
order puts it on the screen.

---

## Decisions already made

### 1. A split button, not a fourth button

The **Student Records** header on `/onboarding/[id]` already carries Add /
Validate / Submit, and Submit is already a split button with a caret opening the
auto-submit menu. A fourth top-level button makes a row that already wraps on
narrow viewports wrap worse.

So **Add** becomes a split button in the same pattern as Submit:

- clicking **Add** does exactly what it does now — inserts an inline blank row
  in `EditableTable` via `handleAdd`;
- the caret opens a one-item menu: **Bulk add from CSV**;
- that item opens a modal with an upload screen.

Match the existing split button's markup: left half `rounded-l-lg`, caret
`rounded-r-lg` with `border-l`, and the same
`<div className="fixed inset-0 z-40" onClick={close} />` click-outside overlay
the refresh and auto-submit menus on this page already use. Keep Add's green;
this is the same action, not a new one.

**Both halves are disabled while `newRecordId !== null`** — i.e. while an
unsaved manual row is open. Importing reloads the record list and would discard
that half-typed row without warning. The existing `disabled` on Add already
covers its half; apply the same condition to the caret, with a `title`
explaining why.

### 2. The modal mirrors `/onboarding/create`'s CSV field, and does not introduce a new file-picker pattern

Same hidden `<input type="file" accept=".csv">` inside a dashed-border label,
same `.csv` extension guard, same helper line listing the required and optional
columns, same `Download sample CSV` link to `/sample-onboarding.csv`. An
operator who has onboarded a school recognises it immediately.

`react-dropzone` is in `package.json` (left over from the orphaned
`CSVUpload.tsx`). Do not use it. `/onboarding/create` does not, and a
drag-and-drop zone in one place and a file input in the other is a worse
outcome than either alone.

### 3. The modal has a result screen, and does not auto-close

Three states in one modal:

| State | Shows |
|---|---|
| Idle | File picker, helper text, sample link, Cancel / Import |
| Importing | Spinner on the Import button, both buttons disabled, picker disabled |
| Result | Counts, per-row failures, a single **Done** |

Result screen content, from `CSVImportResultSchema`:

- `successful_imports` — "60 students imported."
- `failed_imports`, when non-zero — a small scrollable table of the `errors`
  array: `row` and `error`. This is the reason the modal does not auto-close on
  success; a partial import is the case the operator most needs to read.
- `duplicate_count`, when non-zero — "4 of these look like children already on
  this school's list. They are marked in the table." Not "already at this
  school": the count covers both a match against an enrolled student *and* a
  match against another onboarding row, so the wording has to cover both. No
  list in the modal; the badge in the table is where the operator acts.

  The number counts only this import's rows, but measures them against every
  live onboarding row for the school, so it equals the number of badges that
  appear on the new rows. It will not match a count of *all* badges in the
  table — an earlier row flagged as the other half of a pair carries a badge
  too.

**Done** closes the modal and calls the parent's `loadOnboardingData(false)`, so
the new rows and the school statistics both refresh. Closing from the result
state must reload even when `successful_imports` is 0 — a rejected file may
still have changed nothing, but the operator expects a fresh view.

A request that fails outright stays on the idle state and renders the API
`detail` in the same red error box `/onboarding/create` uses. It is not a result
screen — there is no per-row detail to show. The API returns one of three 400
details here, and they are specific on purpose — render them verbatim, do not
replace them with a generic message of your own:

- `"CSV missing required fields"` — a required column header is absent
- `"CSV file is empty"` — no header row at all
- `"Invalid CSV file format"` — not UTF-8, or otherwise unparseable

### 4. The duplicate flag is a badge on the row, and there is no filter for it

`GET /records` now returns `possible_duplicate` and `duplicate_reason` per
record. Render an amber `AlertTriangle` beside the **student's name** in
`EditableTable` — beside the name, not beside the status pill, because it is a
statement about the child and not about where the row is in its lifecycle — with
`title={duplicate_reason}` for the tooltip.

**Do not add a "possible duplicates" option to the status filter.** It is not a
status, and conflating the two makes the filter mean two different things. The
existing search box and a 60-row table are enough to find four amber triangles.

### 5. No batch filter, no batch concept in the UI at all

`batch_id` is not surfaced, not filtered on, and not displayed. The API sorts
newest-first, so a fresh import lands at the top of the table on reload. The
Validate and Submit buttons remain school-wide and their confirm dialogs keep
their current wording.

---

## Changes

| File | Change |
|---|---|
| `src/lib/schoolOnboarding.ts` | `SchoolOnboardingRecord` gains `possible_duplicate?: boolean` and `duplicate_reason?: string \| null`. New `CSVImportResult` interface. New `schoolOnboardingApi.importRecords(schoolId, csvFile)` |
| `src/lib/schools.ts` | `onboardingApi.getRecords` — carry the two new fields through the field-by-field mapper |
| `src/components/BulkAddModal.tsx` | New. The three-state modal |
| `src/app/onboarding/[id]/page.tsx` | Add becomes a split button; menu state; modal mount and wiring |
| `src/components/EditableTable.tsx` | Duplicate badge beside the student name |
| `CSV_FORMAT.md` | Note the second entry point — same format, same file, now also usable on an existing school |

### `importRecords`

```ts
importRecords: async (schoolId: string, csvFile: File): Promise<CSVImportResult> => {
  const form = new FormData();
  form.append('csv_file', csvFile);
  const response = await apiClient.post(
    `/admin/onboarding/schools/${schoolId}/records/import`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return response.data as CSVImportResult;
}
```

**No trailing slash on that URL.** `createRecord` in this file posts to
`/records/` with one and relies on a 307 redirect; for a multipart POST that
means uploading the file twice. Do not copy that.

---

## Silent breakages

### 6. `getRecords` maps field by field — new fields are dropped by default

`onboardingApi.getRecords` in `src/lib/schools.ts` builds its return objects
key by key rather than spreading the response. `possible_duplicate` and
`duplicate_reason` will arrive from the API, typecheck fine everywhere, and
simply never reach the table — no error, no warning, just a badge that never
renders. This is the single most likely way to "finish" this task with a feature
that does nothing.

### 7. The onboarding screen holds records in local state

`/onboarding/[id]` keeps records in a `SchoolOnboarding` object in `useState`
and mutates it locally on add/update/delete. After an import, that object is
stale in a way local mutation cannot fix — there are 60 new rows and the
statistics header has changed. Reload via `loadOnboardingData(false)`; do not
try to merge the import result into local state.

### 8. `school.statistics` drives the completion bar, and it is school-wide

The header's Total / Validated / Pending / Submitted tiles and the completion
percentage come from `onboardingApi.getSchool`, which has no batch filter. After
an import the completion bar drops — 60 new `PENDING` rows against an unchanged
`submitted_count`. That is correct and expected. Do not "fix" it by filtering
the statistics, and do not add a batch param to `getSchool`.

### 9. `<input type="file">` keeps its value across modal opens

Reset the file state and the error state when the modal opens, the way
`OnboardStudentModal` resets its form in a `useEffect` on `isOpen`. Otherwise
reopening the modal after an import shows the previous filename as if it were
staged again.

---

## Acceptance criteria

- The Student Records header shows three controls, not four: Add (split),
  Validate, Submit (split). Nothing else in that header moves or restyles.
- Clicking **Add** still inserts an inline blank row, unchanged.
- Clicking the caret opens a one-item menu; clicking anywhere else closes it.
- Both halves of Add are disabled while an unsaved manual row is open.
- **Bulk add from CSV** opens a modal with the same CSV picker, helper text and
  sample-CSV link as `/onboarding/create`.
- A clean 60-row file: modal shows "60 students imported", Done closes it, the
  table shows the 60 new rows at the top and the header statistics have moved.
- A file with one bad row: modal shows the success count *and* a table with that
  row's number and message, and does not close on its own.
- A file missing a required column: the red error box on the idle state carries
  the API's `detail`, and the modal stays on the picker.
- A row the API flags carries an amber badge beside the student's name whose
  tooltip is the API's `duplicate_reason`.
- Deleting the other half of a flagged pair and refreshing clears the badge,
  with no client-side bookkeeping.
- No batch filter, no duplicate filter, no change to the Validate or Submit
  confirm dialogs.
- `CSVUpload.tsx`, `BatchList.tsx`, `BatchValidator.tsx` and `InviteManager.tsx`
  are untouched and still unimported.
- `npm run lint` and `npm run build` both clean, with output shown.
- Nothing committed.
