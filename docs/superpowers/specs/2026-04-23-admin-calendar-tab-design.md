# Admin Calendar Tab — Design Spec

**Date:** 2026-04-23
**Status:** Approved
**Feature:** School Calendar management tab in the admin portal

---

## Overview

A fully custom, interactive school calendar tab added to the school detail page (`/schools/[id]`). School admins can view, create, edit, and delete calendar events across three scopes (school-wide, classroom, student-specific) with full recurring event support. All data is mocked initially; the mock layer mirrors the backend API contract exactly so swapping in real endpoints requires only changing `calendarMock.ts`.

---

## 1. Tab Integration

- Add `'calendar'` to the `TabType` union in [src/app/schools/[id]/page.tsx](src/app/schools/[id]/page.tsx)
- Add a Calendar tab entry to the `tabs` array (using `CalendarDays` icon from lucide-react)
- Render `<CalendarTab schoolId={school.id} />` when `activeTab === 'calendar'`
- Update the hash guard to include `'calendar'`

---

## 2. File Structure

```
src/components/school/calendar/
  CalendarTab.tsx              — top-level tab, owns all state
  CalendarToolbar.tsx          — nav buttons, period label, view switcher, New Event button
  CalendarMonthView.tsx        — 6×7 date grid
  CalendarWeekView.tsx         — 7-column time grid
  CalendarDayView.tsx          — single-column time grid
  Calendar3DayView.tsx         — 3-column time grid (centred on currentDate)
  CalendarScheduleView.tsx     — scrollable list, 90-day lookahead
  TimeGrid.tsx                 — shared engine used by week/day/3day views
  EventChip.tsx                — coloured event pill used in month cells and week columns
  EventFormModal.tsx           — create & edit modal (mode prop: 'create' | 'edit')
  RecurringEditPrompt.tsx      — THIS / THIS_AND_FUTURE / ALL prompt before opening edit form
  RecurringDeletePrompt.tsx    — THIS / THIS_AND_FUTURE / ALL prompt for delete
  calendarMock.ts              — mock fetch/create/update/delete matching backend contract

src/types/calendar.ts          — shared types
```

---

## 3. Data Model

```ts
// src/types/calendar.ts

export type CalendarView = 'month' | 'week' | 'day' | '3day' | 'schedule';

export type CalendarEventScope = 'SCHOOL' | 'CLASSROOM' | 'STUDENT';

export type EditMode = 'THIS' | 'THIS_AND_FUTURE' | 'ALL';

export type CalendarEvent = {
  id: string;
  school_id: string;
  classroom_id?: string;
  student_id?: string;
  scope: CalendarEventScope;
  title: string;
  description?: string;
  location?: string;
  all_day: boolean;
  start_dt: string;             // ISO datetime string
  end_dt: string;               // ISO datetime string
  duration_mins?: number;       // null when all_day
  rrule?: string;               // iCal RRULE string; absent = one-off event
  series_end_dt?: string;
  occurrence_start_dt?: string; // set on expanded occurrences returned by month fetch
  occurrence_end_dt?: string;
  is_recurring: boolean;
};

export type CreateCalendarEventPayload = Omit<CalendarEvent, 'id' | 'school_id' | 'is_recurring' | 'occurrence_start_dt' | 'occurrence_end_dt'>;

export type UpdateCalendarEventPayload = Partial<CreateCalendarEventPayload>;
```

---

## 4. Mock Layer (`calendarMock.ts`)

Functions mirror the backend API contract:

```ts
fetchCalendarEvents(schoolId: string, year: number, month: number): Promise<CalendarEvent[]>
createCalendarEvent(schoolId: string, payload: CreateCalendarEventPayload): Promise<CalendarEvent>
updateCalendarEvent(schoolId: string, eventId: string, payload: UpdateCalendarEventPayload, editMode: EditMode, occurrenceDate?: string): Promise<CalendarEvent>
deleteCalendarEvent(schoolId: string, eventId: string, editMode: EditMode, occurrenceDate?: string): Promise<void>
```

Mock data covers:
- At least one SCHOOL, one CLASSROOM, and one STUDENT scoped event
- One weekly recurring event (spans multiple weeks in the current month)
- A day with 3+ events to verify overflow rendering in month view
- Events in the current and next month

---

## 5. State (`CalendarTab.tsx`)

| State | Type | Notes |
|---|---|---|
| `activeView` | `CalendarView` | Default `'month'` |
| `currentDate` | `Date` | Default today |
| `events` | `CalendarEvent[]` | Fetched for visible month |
| `loading` | `boolean` | |
| `selectedEvent` | `CalendarEvent \| null` | Event clicked for edit/delete |
| `editMode` | `EditMode \| null` | Set after recurring prompt |
| `showEventForm` | `boolean` | |
| `showRecurringEditPrompt` | `boolean` | |
| `showRecurringDeletePrompt` | `boolean` | |
| `formInitialDate` | `Date \| null` | Pre-fills date when clicking empty cell |

Re-fetch events whenever `currentDate` month changes.

---

## 6. Toolbar (`CalendarToolbar.tsx`)

**Left zone:** `<` prev · `Today` · `>` next · Period label (e.g. "April 2026", "19–25 Apr", "Thu 23 Apr")

**Right zone:** View switcher (Month / Week / Day / 3 Day / Schedule) · "New Event" primary button

Period label format by view:
- `month` → "Month YYYY"
- `week` → "D Mon – D Mon"
- `day` → "Day D Month"
- `3day` → "Day D – Day D Mon"
- `schedule` → "Schedule"

---

## 7. Month View (`CalendarMonthView.tsx`)

- 6-row × 7-column grid with day-of-week headers (S M T W T F S)
- Each cell shows the date number top-left
- Up to 3 `EventChip` pills per cell, then `+n more` overflow that shows a small popover listing all events for that day
- Today's date highlighted with navy circle
- Days outside the current month shown in muted colour
- Clicking an empty cell → open create modal with that date pre-filled
- Clicking an event chip → if recurring, show `RecurringEditPrompt` first; then open edit form

---

## 8. Time Grid Views (Week / Day / 3-Day)

Shared engine in `TimeGrid.tsx`. Each view passes the relevant column dates.

- `HOUR_HEIGHT = 64px`, `TIME_LABEL_WIDTH = 56px`
- Hours 00:00–23:00 rendered as rows; 30-min dashed half-dividers at 40% opacity
- Auto-scroll to 07:00 on mount
- Red current-time indicator line on today's column
- Events: absolute-positioned coloured blocks with title + time text
- Overlapping events: split into sub-columns within the same time slot
- Clicking an event → recurring prompt if needed, then edit form
- Clicking empty slot → create modal with time pre-filled

**Week view:** 7 columns, date numbers in column headers, today highlighted

**Day view:** 1 column, date shown in header

**3-Day view:** 3 columns centred on `currentDate` (day-1, day, day+1)

---

## 9. Schedule View (`CalendarScheduleView.tsx`)

- Events from `currentDate` forward, 90-day window
- Grouped by date; date header format: "TUE  28  Apr"
- Each event row: scope-coloured left border (4px) · title · time range · location if present
- Clicking an event → recurring prompt if needed, then edit form
- Empty state when no upcoming events

---

## 10. Scope Colours

| Scope | Light mode | Dark mode |
|---|---|---|
| SCHOOL (`PRIMARY_COLOR`) | `#1A1A6D` | `#20B2AA` |
| CLASSROOM (`SECONDARY_COLOR`) | `rgba(135, 206, 250, 1)` | `rgba(70, 130, 180, 1)` |
| STUDENT (`PRIMARY_RECORD_COLOR`) | `#10B981` | `#4CAF50` |

Use the existing Tailwind dark-mode pattern (`dark:`) to switch between light and dark values.

Applied consistently across chips, time-grid blocks, schedule left borders, and the form modal scope badge.

---

## 11. Event Form Modal (`EventFormModal.tsx`)

Props: `mode: 'create' | 'edit'`, `event?: CalendarEvent`, `initialDate?: Date`, `schoolId: string`, `editMode?: EditMode`, `onSuccess`, `onClose`

**Fields:**

| Field | Type | Notes |
|---|---|---|
| Title | text input | Required |
| Scope | dropdown | SCHOOL / CLASSROOM / STUDENT |
| Classroom | dropdown | Shown when scope = CLASSROOM; loaded via `schoolsApi.getClassrooms` |
| Student | dropdown | Shown when scope = STUDENT; loaded via `schoolsApi.getStudents` |
| All day | toggle | When on: date-only pickers. When off: datetime pickers |
| Start | datetime / date | Required |
| End | datetime / date | Required |
| Location | text input | Optional |
| Description | textarea | Optional |
| Recurring | toggle | When on: shows recurrence sub-form |

**Recurrence sub-form (when Recurring is on):**
- Frequency: Daily / Weekly / Monthly / Yearly
- End: Never / On date (date picker) / After N occurrences
- Builds the `rrule` string on submit

**Behaviour:**
- Create: calls `createCalendarEvent`, then refreshes events and closes
- Edit: calls `updateCalendarEvent` with the `editMode` from the recurring prompt (or `'ALL'` for non-recurring), then refreshes and closes

---

## 12. Recurring Prompts

**`RecurringEditPrompt.tsx`** — shown when clicking a recurring event before opening the edit form:
- "Edit this event" → sets `editMode = 'THIS'`
- "Edit this and following events" → `THIS_AND_FUTURE`
- "Edit all events" → `ALL`
- Cancel → closes prompt, nothing opens

**`RecurringDeletePrompt.tsx`** — shown when deleting a recurring event:
- "Delete this event" → `THIS`
- "Delete this and following events" → `THIS_AND_FUTURE`
- "Delete all events" → `ALL`
- Cancel → closes prompt

Both are small centered modal dialogs. After selection, the parent proceeds with the chosen `editMode`.

---

## 13. Subagent Strategy

Implementation will be parallelised across subagents where work is independent:

1. **Types + mock layer** — `src/types/calendar.ts` + `calendarMock.ts`
2. **Month view** — `CalendarMonthView.tsx` + `EventChip.tsx`
3. **Time grid** — `TimeGrid.tsx` + `CalendarWeekView.tsx` + `CalendarDayView.tsx` + `Calendar3DayView.tsx`
4. **Schedule view** — `CalendarScheduleView.tsx`
5. **Forms + prompts** — `EventFormModal.tsx` + `RecurringEditPrompt.tsx` + `RecurringDeletePrompt.tsx`
6. **Wiring** — `CalendarTab.tsx` + `CalendarToolbar.tsx` + tab registration in school page

Steps 1–5 can run in parallel. Step 6 depends on all of them.

---

## 14. Out of Scope (v1)

- Real API calls (all mocked)
- Push notification / reminder management
- Drag-to-reschedule
- Event search/filter
- Contextually driven scope selection (e.g. pre-filling classroom from Classrooms tab)
- Export to `.ics`
