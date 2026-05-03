# Admin Calendar Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully custom, interactive Calendar tab to the school detail page, allowing admins to view, create, edit, and delete school events across three scopes with full recurring event support (all data mocked).

**Architecture:** Fully custom React components — no third-party calendar library. `CalendarTab` owns all state and fetches from `calendarMock.ts`. View components (`CalendarMonthView`, `TimeGrid`, etc.) are display-only and fire callbacks up. A shared `TimeGrid` engine powers the week, day, and 3-day views. All mock functions mirror the backend API contract exactly for easy swap-in later.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, `next-themes` (for dark mode colour resolution), Lucide React icons.

---

## Execution Order

Tasks 1 must complete first. Tasks 2, 3, 4, 5 can run **in parallel** (all depend on types from Task 1). Task 6 must wait for all of 2–5.

```
Task 1 (types + mock)
    ↓
Tasks 2, 3, 4, 5  ← parallel
    ↓
Task 6 (wiring)
```

---

## File Map

| File | Create / Modify | Responsibility |
|---|---|---|
| `src/types/calendar.ts` | Create | All calendar types |
| `src/components/school/calendar/calendarMock.ts` | Create | Mock data + API functions |
| `src/components/school/calendar/calendarColors.ts` | Create | Scope colour helper |
| `src/components/school/calendar/EventChip.tsx` | Create | Coloured event pill |
| `src/components/school/calendar/CalendarMonthView.tsx` | Create | 6×7 date grid |
| `src/components/school/calendar/TimeGrid.tsx` | Create | Shared time-grid engine |
| `src/components/school/calendar/CalendarWeekView.tsx` | Create | 7-column week view |
| `src/components/school/calendar/CalendarDayView.tsx` | Create | Single-column day view |
| `src/components/school/calendar/Calendar3DayView.tsx` | Create | 3-column view |
| `src/components/school/calendar/CalendarScheduleView.tsx` | Create | Scrollable schedule list |
| `src/components/school/calendar/RecurringEditPrompt.tsx` | Create | THIS/THIS_AND_FUTURE/ALL edit prompt |
| `src/components/school/calendar/RecurringDeletePrompt.tsx` | Create | THIS/THIS_AND_FUTURE/ALL delete prompt |
| `src/components/school/calendar/EventFormModal.tsx` | Create | Create & edit event modal |
| `src/components/school/calendar/CalendarToolbar.tsx` | Create | Nav + view switcher + New Event |
| `src/components/school/calendar/CalendarTab.tsx` | Create | Top-level tab, owns all state |
| `src/app/schools/[id]/page.tsx` | Modify | Register calendar tab |

---

## Task 1: Types and Mock Layer

**Files:**
- Create: `src/types/calendar.ts`
- Create: `src/components/school/calendar/calendarMock.ts`

### Step 1: Create the types file

- [ ] Create `src/types/calendar.ts`:

```ts
export type CalendarView = 'month' | 'week' | 'day' | '3day' | 'schedule';

export type CalendarEventScope = 'SCHOOL' | 'CLASSROOM' | 'STUDENT';

export type EditMode = 'THIS' | 'THIS_AND_FUTURE' | 'ALL';

export interface CalendarEvent {
  id: string;
  school_id: string;
  classroom_id?: string;
  student_id?: string;
  scope: CalendarEventScope;
  title: string;
  description?: string;
  location?: string;
  all_day: boolean;
  start_dt: string;            // ISO datetime string
  end_dt: string;              // ISO datetime string
  duration_mins?: number;      // absent when all_day is true
  rrule?: string;              // iCal RRULE string; absent = one-off event
  series_end_dt?: string;      // ISO datetime string; absent = no end
  occurrence_start_dt?: string; // set on expanded occurrences returned by month fetch
  occurrence_end_dt?: string;
  is_recurring: boolean;
}

export type CreateCalendarEventPayload = {
  classroom_id?: string;
  student_id?: string;
  scope: CalendarEventScope;
  title: string;
  description?: string;
  location?: string;
  all_day: boolean;
  start_dt: string;
  end_dt: string;
  duration_mins?: number;
  rrule?: string;
  series_end_dt?: string;
};

export type UpdateCalendarEventPayload = Partial<CreateCalendarEventPayload>;
```

### Step 2: Create the mock directory and mock file

- [ ] Create the directory: `src/components/school/calendar/`
- [ ] Create `src/components/school/calendar/calendarMock.ts`:

```ts
import {
  CalendarEvent,
  CalendarEventScope,
  CreateCalendarEventPayload,
  UpdateCalendarEventPayload,
  EditMode,
} from '@/types/calendar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoDate(year: number, month: number, day: number, hour = 0, minute = 0): string {
  const d = new Date(year, month - 1, day, hour, minute);
  return d.toISOString();
}

function uuid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------------------------------------------------------------------------
// Seed data – covers current month + next month
// ---------------------------------------------------------------------------

const now = new Date();
const Y = now.getFullYear();
const M = now.getMonth() + 1; // 1-based
const nextM = M === 12 ? 1 : M + 1;
const nextY = M === 12 ? Y + 1 : Y;

// Build weekly Monday occurrences for the current month (SCHOOL scope)
function weeklyMondayOccurrences(
  schoolId: string,
  seriesId: string,
  year: number,
  month: number,
): CalendarEvent[] {
  const results: CalendarEvent[] = [];
  const d = new Date(year, month - 1, 1);
  // advance to first Monday
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  while (d.getMonth() === month - 1) {
    const start = new Date(d);
    start.setHours(8, 0, 0, 0);
    const end = new Date(d);
    end.setHours(8, 30, 0, 0);
    results.push({
      id: seriesId,
      school_id: schoolId,
      scope: 'SCHOOL',
      title: 'Morning Assembly',
      description: 'Weekly school assembly for all grades.',
      location: 'Main Hall',
      all_day: false,
      start_dt: new Date(year, month - 1, 1, 8, 0).toISOString(),
      end_dt: new Date(year, month - 1, 1, 8, 30).toISOString(),
      duration_mins: 30,
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
      is_recurring: true,
      occurrence_start_dt: start.toISOString(),
      occurrence_end_dt: end.toISOString(),
    });
    d.setDate(d.getDate() + 7);
  }
  return results;
}

const SERIES_ID = 'series-assembly-001';

// One-off events (not recurring)
const SEED_EVENTS: CalendarEvent[] = [
  {
    id: 'evt-sports-day',
    school_id: '__SCHOOL_ID__',
    scope: 'SCHOOL',
    title: 'Sports Day',
    description: 'Annual school sports day. All students participate.',
    location: 'School Grounds',
    all_day: true,
    start_dt: isoDate(Y, M, 18),
    end_dt: isoDate(Y, M, 18),
    is_recurring: false,
    occurrence_start_dt: isoDate(Y, M, 18),
    occurrence_end_dt: isoDate(Y, M, 18),
  },
  {
    id: 'evt-class-picnic',
    school_id: '__SCHOOL_ID__',
    scope: 'CLASSROOM',
    classroom_id: 'classroom-001',
    title: 'Class Picnic',
    description: 'End of term class picnic at the park.',
    location: 'Riverside Park',
    all_day: false,
    start_dt: isoDate(Y, M, 12, 10, 0),
    end_dt: isoDate(Y, M, 12, 13, 0),
    duration_mins: 180,
    is_recurring: false,
    occurrence_start_dt: isoDate(Y, M, 12, 10, 0),
    occurrence_end_dt: isoDate(Y, M, 12, 13, 0),
  },
  {
    id: 'evt-show-and-tell',
    school_id: '__SCHOOL_ID__',
    scope: 'CLASSROOM',
    classroom_id: 'classroom-001',
    title: 'Show & Tell',
    description: 'Students bring an item from home to share with the class.',
    all_day: false,
    start_dt: isoDate(Y, M, 19, 9, 0),
    end_dt: isoDate(Y, M, 19, 10, 0),
    duration_mins: 60,
    is_recurring: false,
    occurrence_start_dt: isoDate(Y, M, 19, 9, 0),
    occurrence_end_dt: isoDate(Y, M, 19, 10, 0),
  },
  // Day with 3+ events (day 18): Sports Day + Parent Meeting + Reading (overflow test)
  {
    id: 'evt-parent-meeting',
    school_id: '__SCHOOL_ID__',
    scope: 'STUDENT',
    student_id: 'student-001',
    title: 'Parent–Teacher Meeting',
    description: 'Scheduled meeting to discuss academic progress.',
    location: 'Room 4B',
    all_day: false,
    start_dt: isoDate(Y, M, 18, 14, 0),
    end_dt: isoDate(Y, M, 18, 14, 30),
    duration_mins: 30,
    is_recurring: false,
    occurrence_start_dt: isoDate(Y, M, 18, 14, 0),
    occurrence_end_dt: isoDate(Y, M, 18, 14, 30),
  },
  {
    id: 'evt-reading',
    school_id: '__SCHOOL_ID__',
    scope: 'STUDENT',
    student_id: 'student-001',
    title: 'Reading Assessment',
    description: 'Quarterly reading level assessment.',
    all_day: false,
    start_dt: isoDate(Y, M, 22, 9, 0),
    end_dt: isoDate(Y, M, 22, 9, 45),
    duration_mins: 45,
    is_recurring: false,
    occurrence_start_dt: isoDate(Y, M, 22, 9, 0),
    occurrence_end_dt: isoDate(Y, M, 22, 9, 45),
  },
  {
    id: 'evt-end-of-term',
    school_id: '__SCHOOL_ID__',
    scope: 'SCHOOL',
    title: 'End of Term Assembly',
    description: 'Closing assembly for the term.',
    location: 'Main Hall',
    all_day: false,
    start_dt: isoDate(Y, M, 28, 10, 0),
    end_dt: isoDate(Y, M, 28, 11, 30),
    duration_mins: 90,
    is_recurring: false,
    occurrence_start_dt: isoDate(Y, M, 28, 10, 0),
    occurrence_end_dt: isoDate(Y, M, 28, 11, 30),
  },
  // Next month
  {
    id: 'evt-science-fair',
    school_id: '__SCHOOL_ID__',
    scope: 'CLASSROOM',
    classroom_id: 'classroom-001',
    title: 'Science Fair',
    description: 'Students present their science projects.',
    location: 'Science Lab',
    all_day: false,
    start_dt: isoDate(nextY, nextM, 14, 9, 0),
    end_dt: isoDate(nextY, nextM, 14, 15, 0),
    duration_mins: 360,
    is_recurring: false,
    occurrence_start_dt: isoDate(nextY, nextM, 14, 9, 0),
    occurrence_end_dt: isoDate(nextY, nextM, 14, 15, 0),
  },
  {
    id: 'evt-open-day',
    school_id: '__SCHOOL_ID__',
    scope: 'SCHOOL',
    title: 'Open Day',
    description: 'School open day for prospective parents.',
    all_day: true,
    start_dt: isoDate(nextY, nextM, 20),
    end_dt: isoDate(nextY, nextM, 20),
    is_recurring: false,
    occurrence_start_dt: isoDate(nextY, nextM, 20),
    occurrence_end_dt: isoDate(nextY, nextM, 20),
  },
];

// In-memory store (mutated by create/update/delete)
let store: CalendarEvent[] = [];
let storeSchoolId = '';

function initStore(schoolId: string) {
  if (storeSchoolId === schoolId && store.length > 0) return;
  storeSchoolId = schoolId;
  store = [
    ...SEED_EVENTS.map((e) => ({ ...e, school_id: schoolId })),
    ...weeklyMondayOccurrences(schoolId, SERIES_ID, Y, M),
    ...weeklyMondayOccurrences(schoolId, SERIES_ID, nextY, nextM),
  ];
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function fetchCalendarEvents(
  schoolId: string,
  year: number,
  month: number,
): Promise<CalendarEvent[]> {
  initStore(schoolId);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59);

  return store.filter((e) => {
    const occStart = new Date(e.occurrence_start_dt ?? e.start_dt);
    return occStart >= monthStart && occStart <= monthEnd;
  });
}

export async function createCalendarEvent(
  schoolId: string,
  payload: CreateCalendarEventPayload,
): Promise<CalendarEvent> {
  initStore(schoolId);
  const event: CalendarEvent = {
    ...payload,
    id: uuid(),
    school_id: schoolId,
    is_recurring: !!payload.rrule,
    occurrence_start_dt: payload.start_dt,
    occurrence_end_dt: payload.end_dt,
  };
  store.push(event);
  return event;
}

export async function updateCalendarEvent(
  schoolId: string,
  eventId: string,
  payload: UpdateCalendarEventPayload,
  editMode: EditMode,
  occurrenceDate?: string,
): Promise<CalendarEvent> {
  initStore(schoolId);
  const idx = store.findIndex((e) => e.id === eventId);
  if (idx === -1) throw new Error('Event not found');

  if (editMode === 'ALL') {
    store[idx] = {
      ...store[idx],
      ...payload,
      is_recurring: payload.rrule !== undefined ? !!payload.rrule : store[idx].is_recurring,
    };
    return store[idx];
  }

  if (editMode === 'THIS' && occurrenceDate) {
    // Mark this occurrence deleted on the series, create a one-off replacement
    const orig = store[idx];
    const newEvent: CalendarEvent = {
      ...orig,
      ...payload,
      id: uuid(),
      rrule: undefined,
      is_recurring: false,
      start_dt: payload.start_dt ?? orig.occurrence_start_dt ?? orig.start_dt,
      end_dt: payload.end_dt ?? orig.occurrence_end_dt ?? orig.end_dt,
      occurrence_start_dt: payload.start_dt ?? orig.occurrence_start_dt,
      occurrence_end_dt: payload.end_dt ?? orig.occurrence_end_dt,
    };
    // Remove this occurrence from store (simplification: remove the matching occurrence entry)
    store.splice(idx, 1);
    store.push(newEvent);
    return newEvent;
  }

  if (editMode === 'THIS_AND_FUTURE' && occurrenceDate) {
    // Truncate the original series and create a new series from occurrenceDate
    store.splice(idx, 1);
    const newStart = payload.start_dt ?? occurrenceDate;
    const newEvent: CalendarEvent = {
      ...store[idx] ?? SEED_EVENTS[0],
      ...payload,
      id: uuid(),
      school_id: schoolId,
      start_dt: newStart,
      is_recurring: !!payload.rrule,
      occurrence_start_dt: newStart,
      occurrence_end_dt: payload.end_dt ?? newStart,
    };
    store.push(newEvent);
    return newEvent;
  }

  return store[idx];
}

export async function deleteCalendarEvent(
  schoolId: string,
  eventId: string,
  editMode: EditMode,
  occurrenceDate?: string,
): Promise<void> {
  initStore(schoolId);

  if (editMode === 'ALL') {
    store = store.filter((e) => e.id !== eventId);
    return;
  }

  if (editMode === 'THIS' && occurrenceDate) {
    // Remove the specific occurrence entry from store
    const idx = store.findIndex(
      (e) => e.id === eventId && e.occurrence_start_dt?.startsWith(occurrenceDate),
    );
    if (idx !== -1) store.splice(idx, 1);
    return;
  }

  if (editMode === 'THIS_AND_FUTURE' && occurrenceDate) {
    store = store.filter(
      (e) =>
        !(
          e.id === eventId &&
          e.occurrence_start_dt &&
          e.occurrence_start_dt >= occurrenceDate
        ),
    );
    return;
  }
}
```

### Step 3: Lint

- [ ] Run: `npm run lint`
- [ ] Expected: no errors

### Step 4: Commit

- [ ] Run:
```bash
git add src/types/calendar.ts src/components/school/calendar/calendarMock.ts
git commit -m "feat: add calendar types and mock layer"
```

---

## Task 2: Scope Colour Helper + EventChip + CalendarMonthView

**Files:**
- Create: `src/components/school/calendar/calendarColors.ts`
- Create: `src/components/school/calendar/EventChip.tsx`
- Create: `src/components/school/calendar/CalendarMonthView.tsx`

> **Dependency:** Task 1 must be complete before starting this task.

### Step 1: Create the colour helper

- [ ] Create `src/components/school/calendar/calendarColors.ts`:

```ts
import { CalendarEventScope } from '@/types/calendar';

// Returns bg colour string for a given scope and theme
export function scopeBgColor(scope: CalendarEventScope, isDark: boolean): string {
  switch (scope) {
    case 'SCHOOL':
      return isDark ? '#20B2AA' : '#1A1A6D';
    case 'CLASSROOM':
      return isDark ? 'rgba(70, 130, 180, 1)' : 'rgba(135, 206, 250, 1)';
    case 'STUDENT':
      return isDark ? '#4CAF50' : '#10B981';
  }
}

// Returns text colour for reading on top of the bg colour above
export function scopeTextColor(scope: CalendarEventScope, isDark: boolean): string {
  if (scope === 'CLASSROOM' && !isDark) return '#1A1A6D'; // dark text on light blue
  return '#ffffff';
}

export function scopeLabel(scope: CalendarEventScope): string {
  switch (scope) {
    case 'SCHOOL': return 'School';
    case 'CLASSROOM': return 'Classroom';
    case 'STUDENT': return 'Student';
  }
}
```

### Step 2: Create EventChip

- [ ] Create `src/components/school/calendar/EventChip.tsx`:

```tsx
'use client';

import { useTheme } from 'next-themes';
import { CalendarEvent } from '@/types/calendar';
import { scopeBgColor, scopeTextColor } from './calendarColors';

interface EventChipProps {
  event: CalendarEvent;
  onClick: (event: CalendarEvent) => void;
}

export default function EventChip({ event, onClick }: EventChipProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const bg = scopeBgColor(event.scope, isDark);
  const color = scopeTextColor(event.scope, isDark);

  const label = event.all_day
    ? event.title
    : (() => {
        const d = new Date(event.occurrence_start_dt ?? event.start_dt);
        const h = d.getHours().toString().padStart(2, '0');
        const m = d.getMinutes().toString().padStart(2, '0');
        return `${h}:${m} ${event.title}`;
      })();

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
      className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate font-medium"
      style={{ backgroundColor: bg, color }}
      title={event.title}
    >
      {label}
    </button>
  );
}
```

### Step 3: Create CalendarMonthView

- [ ] Create `src/components/school/calendar/CalendarMonthView.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { CalendarEvent } from '@/types/calendar';
import EventChip from './EventChip';

interface CalendarMonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onEmptyCellClick: (date: Date) => void;
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CHIPS = 3;

function buildGrid(currentDate: Date): Date[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startSunday = new Date(firstDay);
  startSunday.setDate(firstDay.getDate() - firstDay.getDay());

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startSunday);
    d.setDate(startSunday.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isCurrentMonth(date: Date, currentDate: Date): boolean {
  return (
    date.getFullYear() === currentDate.getFullYear() &&
    date.getMonth() === currentDate.getMonth()
  );
}

export default function CalendarMonthView({
  currentDate,
  events,
  onEventClick,
  onEmptyCellClick,
}: CalendarMonthViewProps) {
  const [popoverDate, setPopoverDate] = useState<Date | null>(null);
  const today = new Date();
  const cells = buildGrid(currentDate);

  function eventsForDay(date: Date): CalendarEvent[] {
    return events
      .filter((e) => {
        const d = new Date(e.occurrence_start_dt ?? e.start_dt);
        return isSameDay(d, date);
      })
      .sort((a, b) => {
        // all-day first, then by time
        if (a.all_day && !b.all_day) return -1;
        if (!a.all_day && b.all_day) return 1;
        return (
          new Date(a.occurrence_start_dt ?? a.start_dt).getTime() -
          new Date(b.occurrence_start_dt ?? b.start_dt).getTime()
        );
      });
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day of week headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800">
        {DOW_LABELS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6">
        {cells.map((cell, idx) => {
          const dayEvents = eventsForDay(cell);
          const overflow = dayEvents.length - MAX_CHIPS;
          const isToday = isSameDay(cell, today);
          const inMonth = isCurrentMonth(cell, currentDate);

          return (
            <div
              key={idx}
              onClick={() => onEmptyCellClick(cell)}
              className={`border-b border-r border-gray-100 dark:border-gray-800 p-1 flex flex-col gap-0.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 min-h-[100px] ${
                !inMonth ? 'bg-gray-50 dark:bg-gray-900/50' : ''
              }`}
            >
              {/* Date number */}
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className={`text-sm w-6 h-6 flex items-center justify-center rounded-full font-medium ${
                    isToday
                      ? 'bg-[#1A1A6D] dark:bg-[#20B2AA] text-white'
                      : inMonth
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-gray-400 dark:text-gray-600'
                  }`}
                >
                  {cell.getDate()}
                </span>
              </div>

              {/* Event chips */}
              {dayEvents.slice(0, MAX_CHIPS).map((ev) => (
                <EventChip key={ev.id + (ev.occurrence_start_dt ?? '')} event={ev} onClick={onEventClick} />
              ))}

              {/* Overflow */}
              {overflow > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPopoverDate(cell);
                  }}
                  className="text-xs text-[#1A1A6D] dark:text-[#20B2AA] hover:underline text-left px-1"
                >
                  +{overflow} more
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Overflow popover */}
      {popoverDate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center" onClick={() => setPopoverDate(null)}>
          <div
            className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 p-4 w-64 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                {popoverDate.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
              <button
                onClick={() => setPopoverDate(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {eventsForDay(popoverDate).map((ev) => (
                <EventChip
                  key={ev.id + (ev.occurrence_start_dt ?? '')}
                  event={ev}
                  onClick={(e) => {
                    setPopoverDate(null);
                    onEventClick(e);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 4: Lint

- [ ] Run: `npm run lint`
- [ ] Expected: no errors

### Step 5: Commit

- [ ] Run:
```bash
git add src/components/school/calendar/calendarColors.ts src/components/school/calendar/EventChip.tsx src/components/school/calendar/CalendarMonthView.tsx
git commit -m "feat: add scope colour helper, EventChip, and CalendarMonthView"
```

---

## Task 3: TimeGrid + Week / Day / 3-Day Views

**Files:**
- Create: `src/components/school/calendar/TimeGrid.tsx`
- Create: `src/components/school/calendar/CalendarWeekView.tsx`
- Create: `src/components/school/calendar/CalendarDayView.tsx`
- Create: `src/components/school/calendar/Calendar3DayView.tsx`

> **Dependency:** Task 1 must be complete before starting this task.

### Step 1: Create TimeGrid (shared engine)

- [ ] Create `src/components/school/calendar/TimeGrid.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { CalendarEvent } from '@/types/calendar';
import { scopeBgColor, scopeTextColor } from './calendarColors';

export const HOUR_HEIGHT = 64; // px per hour
export const TIME_LABEL_WIDTH = 56; // px

interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  colIndex: number;
  colCount: number;
}

function toMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function layoutEvents(dayEvents: CalendarEvent[]): PositionedEvent[] {
  // Sort by start
  const sorted = [...dayEvents].sort(
    (a, b) =>
      new Date(a.occurrence_start_dt ?? a.start_dt).getTime() -
      new Date(b.occurrence_start_dt ?? b.start_dt).getTime(),
  );

  const positioned: PositionedEvent[] = [];
  // Simple column assignment: group overlapping events
  const cols: number[] = []; // end-minute of last event in each column

  sorted.forEach((ev) => {
    const start = new Date(ev.occurrence_start_dt ?? ev.start_dt);
    const end = new Date(ev.occurrence_end_dt ?? ev.end_dt);
    const startMin = toMinutes(start);
    const endMin = Math.max(toMinutes(end), startMin + 30);
    const top = (startMin / 60) * HOUR_HEIGHT;
    const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 24);

    let col = cols.findIndex((endM) => endM <= startMin);
    if (col === -1) col = cols.length;
    cols[col] = endMin;

    positioned.push({ event: ev, top, height, colIndex: col, colCount: 0 });
  });

  // Second pass: set colCount for each event (max col used in its time range)
  positioned.forEach((p) => {
    const startMin = toMinutes(new Date(p.event.occurrence_start_dt ?? p.event.start_dt));
    const endMin = toMinutes(new Date(p.event.occurrence_end_dt ?? p.event.end_dt));
    let maxCol = p.colIndex;
    positioned.forEach((q) => {
      if (q === p) return;
      const qStart = toMinutes(new Date(q.event.occurrence_start_dt ?? q.event.start_dt));
      const qEnd = toMinutes(new Date(q.event.occurrence_end_dt ?? q.event.end_dt));
      if (qStart < endMin && qEnd > startMin) {
        maxCol = Math.max(maxCol, q.colIndex);
      }
    });
    p.colCount = maxCol + 1;
  });

  return positioned;
}

interface TimeGridProps {
  columns: Date[]; // one Date per column (the calendar day)
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent, columnDate: Date) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

export default function TimeGrid({ columns, events, onEventClick, onSlotClick }: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const today = new Date();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT;

  // Auto-scroll to 07:00 on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT - 32;
    }
  }, []);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Column headers */}
      <div
        className="flex border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
        style={{ paddingLeft: TIME_LABEL_WIDTH }}
      >
        {columns.map((col, i) => {
          const isToday = isSameDay(col, today);
          return (
            <div key={i} className="flex-1 flex flex-col items-center py-2 border-l border-gray-100 dark:border-gray-800">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                {col.toLocaleDateString('en-GB', { weekday: 'short' })}
              </span>
              <span
                className={`text-lg font-semibold w-8 h-8 flex items-center justify-center rounded-full ${
                  isToday
                    ? 'bg-[#1A1A6D] dark:bg-[#20B2AA] text-white'
                    : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {col.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
        <div className="relative flex" style={{ height: 24 * HOUR_HEIGHT }}>
          {/* Time labels */}
          <div
            className="flex-shrink-0 flex flex-col"
            style={{ width: TIME_LABEL_WIDTH }}
          >
            {hours.map((h) => (
              <div
                key={h}
                className="flex-shrink-0 flex items-start justify-end pr-2 text-xs text-gray-400"
                style={{ height: HOUR_HEIGHT }}
              >
                {h === 0 ? '' : `${h.toString().padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Column grid */}
          <div className="flex flex-1">
            {columns.map((col, colIdx) => {
              const colEvents = events.filter((e) => {
                const d = new Date(e.occurrence_start_dt ?? e.start_dt);
                return isSameDay(d, col) && !e.all_day;
              });
              const positioned = layoutEvents(colEvents);
              const isToday = isSameDay(col, today);

              return (
                <div
                  key={colIdx}
                  className={`flex-1 relative border-l border-gray-100 dark:border-gray-800 ${
                    isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                  }`}
                  style={{ height: 24 * HOUR_HEIGHT }}
                >
                  {/* Hour rows */}
                  {hours.map((h) => (
                    <div key={h} className="absolute left-0 right-0 border-b border-gray-100 dark:border-gray-800" style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
                      {/* Half-hour dashed divider */}
                      <div
                        className="absolute left-0 right-0 border-b border-dashed border-gray-100 dark:border-gray-800 opacity-40"
                        style={{ top: HOUR_HEIGHT / 2 }}
                      />
                      {/* Click target */}
                      <button
                        className="absolute inset-0 w-full h-full opacity-0"
                        onClick={() => onSlotClick(col, h)}
                        aria-label={`${col.toDateString()} ${h}:00`}
                      />
                    </div>
                  ))}

                  {/* Events */}
                  {positioned.map((p, pi) => {
                    const bg = scopeBgColor(p.event.scope, isDark);
                    const color = scopeTextColor(p.event.scope, isDark);
                    const width = `${100 / p.colCount}%`;
                    const left = `${(p.colIndex / p.colCount) * 100}%`;
                    const startDt = new Date(p.event.occurrence_start_dt ?? p.event.start_dt);
                    const endDt = new Date(p.event.occurrence_end_dt ?? p.event.end_dt);
                    const timeLabel = `${startDt.getHours().toString().padStart(2, '0')}:${startDt.getMinutes().toString().padStart(2, '0')} – ${endDt.getHours().toString().padStart(2, '0')}:${endDt.getMinutes().toString().padStart(2, '0')}`;

                    return (
                      <button
                        key={pi}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(p.event, col);
                        }}
                        className="absolute rounded px-1 py-0.5 text-left overflow-hidden hover:opacity-90 transition-opacity z-10"
                        style={{
                          top: p.top,
                          height: p.height,
                          left,
                          width,
                          backgroundColor: bg,
                          color,
                        }}
                      >
                        <div className="text-xs font-semibold truncate">{p.event.title}</div>
                        {p.height > 36 && (
                          <div className="text-xs opacity-80 truncate">{timeLabel}</div>
                        )}
                      </button>
                    );
                  })}

                  {/* Current time line (only on today's column) */}
                  {isToday && (
                    <div
                      className="absolute left-0 right-0 z-20 flex items-center"
                      style={{ top: nowTop }}
                    >
                      <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 -ml-1" />
                      <div className="flex-1 border-t border-red-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Create CalendarWeekView

- [ ] Create `src/components/school/calendar/CalendarWeekView.tsx`:

```tsx
'use client';

import { CalendarEvent } from '@/types/calendar';
import TimeGrid from './TimeGrid';

interface CalendarWeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

function getWeekDays(date: Date): Date[] {
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

export default function CalendarWeekView({
  currentDate,
  events,
  onEventClick,
  onSlotClick,
}: CalendarWeekViewProps) {
  const columns = getWeekDays(currentDate);
  return (
    <TimeGrid
      columns={columns}
      events={events}
      onEventClick={(ev) => onEventClick(ev)}
      onSlotClick={onSlotClick}
    />
  );
}
```

### Step 3: Create CalendarDayView

- [ ] Create `src/components/school/calendar/CalendarDayView.tsx`:

```tsx
'use client';

import { CalendarEvent } from '@/types/calendar';
import TimeGrid from './TimeGrid';

interface CalendarDayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

export default function CalendarDayView({
  currentDate,
  events,
  onEventClick,
  onSlotClick,
}: CalendarDayViewProps) {
  return (
    <TimeGrid
      columns={[currentDate]}
      events={events}
      onEventClick={(ev) => onEventClick(ev)}
      onSlotClick={onSlotClick}
    />
  );
}
```

### Step 4: Create Calendar3DayView

- [ ] Create `src/components/school/calendar/Calendar3DayView.tsx`:

```tsx
'use client';

import { CalendarEvent } from '@/types/calendar';
import TimeGrid from './TimeGrid';

interface Calendar3DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

export default function Calendar3DayView({
  currentDate,
  events,
  onEventClick,
  onSlotClick,
}: Calendar3DayViewProps) {
  const prev = new Date(currentDate);
  prev.setDate(currentDate.getDate() - 1);
  const next = new Date(currentDate);
  next.setDate(currentDate.getDate() + 1);

  return (
    <TimeGrid
      columns={[prev, currentDate, next]}
      events={events}
      onEventClick={(ev) => onEventClick(ev)}
      onSlotClick={onSlotClick}
    />
  );
}
```

### Step 5: Lint

- [ ] Run: `npm run lint`
- [ ] Expected: no errors

### Step 6: Commit

- [ ] Run:
```bash
git add src/components/school/calendar/TimeGrid.tsx src/components/school/calendar/CalendarWeekView.tsx src/components/school/calendar/CalendarDayView.tsx src/components/school/calendar/Calendar3DayView.tsx
git commit -m "feat: add TimeGrid engine and week/day/3-day views"
```

---

## Task 4: CalendarScheduleView

**Files:**
- Create: `src/components/school/calendar/CalendarScheduleView.tsx`

> **Dependency:** Task 1 must be complete before starting this task.

### Step 1: Create CalendarScheduleView

- [ ] Create `src/components/school/calendar/CalendarScheduleView.tsx`:

```tsx
'use client';

import { useTheme } from 'next-themes';
import { CalendarEvent } from '@/types/calendar';
import { scopeBgColor } from './calendarColors';
import { CalendarDays } from 'lucide-react';

interface CalendarScheduleViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

interface DayGroup {
  date: Date;
  events: CalendarEvent[];
}

function groupByDay(events: CalendarEvent[], from: Date, days: number): DayGroup[] {
  const groups: DayGroup[] = [];
  const map = new Map<string, CalendarEvent[]>();

  events.forEach((ev) => {
    const d = new Date(ev.occurrence_start_dt ?? ev.start_dt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  });

  // Walk 90 days from `from`
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (map.has(key)) {
      groups.push({ date: d, events: map.get(key)!.sort((a, b) =>
        new Date(a.occurrence_start_dt ?? a.start_dt).getTime() -
        new Date(b.occurrence_start_dt ?? b.start_dt).getTime()
      )});
    }
  }
  return groups;
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function CalendarScheduleView({
  currentDate,
  events,
  onEventClick,
}: CalendarScheduleViewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const groups = groupByDay(events, currentDate, 90);

  if (groups.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 gap-3 py-24">
        <CalendarDays className="w-12 h-12 opacity-40" />
        <p className="text-sm">No upcoming events in the next 90 days</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {groups.map((group, gi) => (
        <div key={gi} className="border-b border-gray-100 dark:border-gray-800">
          {/* Date header */}
          <div className="flex items-baseline gap-3 px-6 py-3 bg-gray-50 dark:bg-gray-900/50">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-8">
              {group.date.toLocaleDateString('en-GB', { weekday: 'short' })}
            </span>
            <span className="text-3xl font-light text-gray-900 dark:text-gray-100">
              {group.date.getDate()}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {group.date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          {/* Events */}
          {group.events.map((ev, ei) => {
            const borderColor = scopeBgColor(ev.scope, isDark);
            const startDt = ev.occurrence_start_dt ?? ev.start_dt;
            const endDt = ev.occurrence_end_dt ?? ev.end_dt;

            return (
              <button
                key={ei}
                onClick={() => onEventClick(ev)}
                className="w-full text-left px-6 py-3 flex gap-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors border-b border-gray-50 dark:border-gray-900"
              >
                {/* Scope colour bar */}
                <div
                  className="w-1 rounded-full flex-shrink-0 self-stretch"
                  style={{ backgroundColor: borderColor }}
                />

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                    {ev.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {ev.all_day
                      ? 'All day'
                      : `${formatTime(startDt)} – ${formatTime(endDt)}`}
                    {ev.location && (
                      <span className="ml-2">· {ev.location}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

### Step 2: Lint

- [ ] Run: `npm run lint`
- [ ] Expected: no errors

### Step 3: Commit

- [ ] Run:
```bash
git add src/components/school/calendar/CalendarScheduleView.tsx
git commit -m "feat: add CalendarScheduleView"
```

---

## Task 5: RecurringEditPrompt + RecurringDeletePrompt + EventFormModal

**Files:**
- Create: `src/components/school/calendar/RecurringEditPrompt.tsx`
- Create: `src/components/school/calendar/RecurringDeletePrompt.tsx`
- Create: `src/components/school/calendar/EventFormModal.tsx`

> **Dependency:** Task 1 must be complete before starting this task.

### Step 1: Create RecurringEditPrompt

- [ ] Create `src/components/school/calendar/RecurringEditPrompt.tsx`:

```tsx
'use client';

import { EditMode } from '@/types/calendar';
import { X } from 'lucide-react';

interface RecurringEditPromptProps {
  onSelect: (mode: EditMode) => void;
  onCancel: () => void;
}

export default function RecurringEditPrompt({ onSelect, onCancel }: RecurringEditPromptProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-sm w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Edit recurring event
          </h2>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <div className="p-2">
          {(
            [
              { mode: 'THIS' as EditMode, label: 'This event' },
              { mode: 'THIS_AND_FUTURE' as EditMode, label: 'This and following events' },
              { mode: 'ALL' as EditMode, label: 'All events' },
            ] as { mode: EditMode; label: string }[]
          ).map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => onSelect(mode)}
              className="w-full text-left px-4 py-3 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="p-4 pt-2 flex justify-end border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Create RecurringDeletePrompt

- [ ] Create `src/components/school/calendar/RecurringDeletePrompt.tsx`:

```tsx
'use client';

import { EditMode } from '@/types/calendar';
import { X } from 'lucide-react';

interface RecurringDeletePromptProps {
  onSelect: (mode: EditMode) => void;
  onCancel: () => void;
}

export default function RecurringDeletePrompt({ onSelect, onCancel }: RecurringDeletePromptProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-sm w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Delete recurring event
          </h2>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <div className="p-2">
          {(
            [
              { mode: 'THIS' as EditMode, label: 'This event' },
              { mode: 'THIS_AND_FUTURE' as EditMode, label: 'This and following events' },
              { mode: 'ALL' as EditMode, label: 'All events' },
            ] as { mode: EditMode; label: string }[]
          ).map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => onSelect(mode)}
              className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="p-4 pt-2 flex justify-end border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 3: Create EventFormModal

- [ ] Create `src/components/school/calendar/EventFormModal.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle, Trash2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  CalendarEvent,
  CalendarEventScope,
  CreateCalendarEventPayload,
  EditMode,
} from '@/types/calendar';
import { schoolsApi, Classroom, Student } from '@/lib/schools';
import { scopeBgColor, scopeLabel } from './calendarColors';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from './calendarMock';
import RecurringDeletePrompt from './RecurringDeletePrompt';

interface EventFormModalProps {
  mode: 'create' | 'edit';
  schoolId: string;
  event?: CalendarEvent;           // required when mode = 'edit'
  editMode?: EditMode;             // set when editing a recurring event
  initialDate?: Date;              // pre-fills date when creating from empty cell
  onSuccess: () => void;
  onClose: () => void;
}

type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
type RecurEndType = 'never' | 'on_date' | 'after_n';

function toLocalDateTimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalDateValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildRRule(freq: Frequency, endType: RecurEndType, endDate: string, afterN: number): string {
  let rule = `FREQ=${freq}`;
  if (endType === 'on_date' && endDate) {
    const d = new Date(endDate);
    const pad = (n: number) => n.toString().padStart(2, '0');
    rule += `;UNTIL=${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T000000Z`;
  } else if (endType === 'after_n' && afterN > 0) {
    rule += `;COUNT=${afterN}`;
  }
  return rule;
}

export default function EventFormModal({
  mode,
  schoolId,
  event,
  editMode,
  initialDate,
  onSuccess,
  onClose,
}: EventFormModalProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const defaultStart = initialDate ?? new Date();
  const defaultStartIso = new Date(defaultStart.getFullYear(), defaultStart.getMonth(), defaultStart.getDate(), 9, 0).toISOString();
  const defaultEndIso = new Date(defaultStart.getFullYear(), defaultStart.getMonth(), defaultStart.getDate(), 10, 0).toISOString();

  // Form state
  const [title, setTitle] = useState(event?.title ?? '');
  const [scope, setScope] = useState<CalendarEventScope>(event?.scope ?? 'SCHOOL');
  const [classroomId, setClassroomId] = useState(event?.classroom_id ?? '');
  const [studentId, setStudentId] = useState(event?.student_id ?? '');
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [startDt, setStartDt] = useState(event ? toLocalDateTimeValue(event.occurrence_start_dt ?? event.start_dt) : toLocalDateTimeValue(defaultStartIso));
  const [endDt, setEndDt] = useState(event ? toLocalDateTimeValue(event.occurrence_end_dt ?? event.end_dt) : toLocalDateTimeValue(defaultEndIso));
  const [location, setLocation] = useState(event?.location ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [recurring, setRecurring] = useState(event?.is_recurring ?? false);
  const [freq, setFreq] = useState<Frequency>('WEEKLY');
  const [recurEndType, setRecurEndType] = useState<RecurEndType>('never');
  const [recurEndDate, setRecurEndDate] = useState('');
  const [recurAfterN, setRecurAfterN] = useState(10);

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);

  // Load classrooms and students on mount
  useEffect(() => {
    schoolsApi.getClassrooms(schoolId).then(setClassrooms).catch(console.error);
    schoolsApi.getStudents(schoolId).then(setStudents).catch(console.error);
  }, [schoolId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (scope === 'CLASSROOM' && !classroomId) {
      setError('Please select a classroom');
      return;
    }
    if (scope === 'STUDENT' && !studentId) {
      setError('Please select a student');
      return;
    }

    const startIso = allDay ? new Date(startDt).toISOString() : new Date(startDt).toISOString();
    const endIso = allDay ? new Date(endDt).toISOString() : new Date(endDt).toISOString();

    const payload: CreateCalendarEventPayload = {
      scope,
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      all_day: allDay,
      start_dt: startIso,
      end_dt: endIso,
      duration_mins: allDay ? undefined : Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000),
      rrule: recurring ? buildRRule(freq, recurEndType, recurEndDate, recurAfterN) : undefined,
      series_end_dt: undefined,
      classroom_id: scope === 'CLASSROOM' ? classroomId : undefined,
      student_id: scope === 'STUDENT' ? studentId : undefined,
    };

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createCalendarEvent(schoolId, payload);
      } else if (event) {
        const em = editMode ?? 'ALL';
        const occDate = event.occurrence_start_dt
          ? toLocalDateValue(event.occurrence_start_dt)
          : undefined;
        await updateCalendarEvent(schoolId, event.id, payload, em, occDate);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(mode: EditMode) {
    if (!event) return;
    setSubmitting(true);
    try {
      const occDate = event.occurrence_start_dt
        ? toLocalDateValue(event.occurrence_start_dt)
        : undefined;
      await deleteCalendarEvent(schoolId, event.id, mode, occDate);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setSubmitting(false);
      setShowDeletePrompt(false);
    }
  }

  const scopeColor = scopeBgColor(scope, isDark);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-lg w-full my-8">
          {/* Coloured top bar */}
          <div className="h-1.5 rounded-t-lg" style={{ backgroundColor: scopeColor }} />

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {mode === 'create' ? 'New Event' : 'Edit Event'}
            </h2>
            <button
              onClick={onClose}
              disabled={submitting}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title"
                disabled={submitting}
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Scope */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Scope <span className="text-red-500">*</span>
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as CalendarEventScope)}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="SCHOOL">{scopeLabel('SCHOOL')}</option>
                <option value="CLASSROOM">{scopeLabel('CLASSROOM')}</option>
                <option value="STUDENT">{scopeLabel('STUDENT')}</option>
              </select>
            </div>

            {/* Classroom picker */}
            {scope === 'CLASSROOM' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Classroom <span className="text-red-500">*</span>
                </label>
                <select
                  value={classroomId}
                  onChange={(e) => setClassroomId(e.target.value)}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select classroom…</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Student picker */}
            {scope === 'STUDENT' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Student <span className="text-red-500">*</span>
                </label>
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select student…</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* All day toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAllDay(!allDay)}
                disabled={submitting}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  allDay ? 'bg-[#1A1A6D] dark:bg-[#20B2AA]' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    allDay ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">All day</span>
            </div>

            {/* Start / End */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start <span className="text-red-500">*</span>
                </label>
                <input
                  type={allDay ? 'date' : 'datetime-local'}
                  value={allDay ? startDt.slice(0, 10) : startDt}
                  onChange={(e) => setStartDt(e.target.value)}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End <span className="text-red-500">*</span>
                </label>
                <input
                  type={allDay ? 'date' : 'datetime-local'}
                  value={allDay ? endDt.slice(0, 10) : endDt}
                  onChange={(e) => setEndDt(e.target.value)}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Optional"
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                rows={3}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
              />
            </div>

            {/* Recurring toggle */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => setRecurring(!recurring)}
                  disabled={submitting}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    recurring ? 'bg-[#1A1A6D] dark:bg-[#20B2AA]' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      recurring ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-300">Recurring</span>
              </div>

              {recurring && (
                <div className="pl-4 border-l-2 border-gray-200 dark:border-gray-700 space-y-3">
                  {/* Frequency */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Repeats
                    </label>
                    <select
                      value={freq}
                      onChange={(e) => setFreq(e.target.value as Frequency)}
                      disabled={submitting}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                    >
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  </div>

                  {/* End type */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Ends
                    </label>
                    <div className="flex flex-col gap-2">
                      {[
                        { value: 'never', label: 'Never' },
                        { value: 'on_date', label: 'On date' },
                        { value: 'after_n', label: 'After N occurrences' },
                      ].map(({ value, label }) => (
                        <label key={value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <input
                            type="radio"
                            name="recurEnd"
                            value={value}
                            checked={recurEndType === value}
                            onChange={() => setRecurEndType(value as RecurEndType)}
                            disabled={submitting}
                          />
                          {label}
                        </label>
                      ))}
                    </div>

                    {recurEndType === 'on_date' && (
                      <input
                        type="date"
                        value={recurEndDate}
                        onChange={(e) => setRecurEndDate(e.target.value)}
                        disabled={submitting}
                        className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                      />
                    )}

                    {recurEndType === 'after_n' && (
                      <input
                        type="number"
                        min={1}
                        value={recurAfterN}
                        onChange={(e) => setRecurAfterN(parseInt(e.target.value) || 1)}
                        disabled={submitting}
                        className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                        placeholder="Number of occurrences"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
              {mode === 'edit' ? (
                <button
                  type="button"
                  onClick={() => setShowDeletePrompt(true)}
                  disabled={submitting}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              ) : (
                <div />
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : mode === 'create' ? 'Create Event' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Delete prompt (for recurring events shown on top of the form) */}
      {showDeletePrompt && (
        <RecurringDeletePrompt
          onSelect={handleDelete}
          onCancel={() => setShowDeletePrompt(false)}
        />
      )}
    </>
  );
}
```

### Step 4: Lint

- [ ] Run: `npm run lint`
- [ ] Expected: no errors

### Step 5: Commit

- [ ] Run:
```bash
git add src/components/school/calendar/RecurringEditPrompt.tsx src/components/school/calendar/RecurringDeletePrompt.tsx src/components/school/calendar/EventFormModal.tsx
git commit -m "feat: add recurring prompts and EventFormModal"
```

---

## Task 6: CalendarToolbar + CalendarTab + Tab Registration

> **Dependency:** Tasks 2, 3, 4, and 5 must all be complete before starting this task.

**Files:**
- Create: `src/components/school/calendar/CalendarToolbar.tsx`
- Create: `src/components/school/calendar/CalendarTab.tsx`
- Modify: `src/app/schools/[id]/page.tsx`

### Step 1: Create CalendarToolbar

- [ ] Create `src/components/school/calendar/CalendarToolbar.tsx`:

```tsx
'use client';

import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { CalendarView } from '@/types/calendar';

interface CalendarToolbarProps {
  currentDate: Date;
  activeView: CalendarView;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
  onNewEvent: () => void;
}

const VIEW_LABELS: Record<CalendarView, string> = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
  '3day': '3 Day',
  schedule: 'Schedule',
};

function periodLabel(date: Date, view: CalendarView): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  switch (view) {
    case 'month':
      return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    case 'week': {
      const sun = new Date(date);
      sun.setDate(date.getDate() - date.getDay());
      const sat = new Date(sun);
      sat.setDate(sun.getDate() + 6);
      const startStr = sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const endStr = sat.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      return `${startStr} – ${endStr}`;
    }
    case 'day':
      return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    case '3day': {
      const prev = new Date(date);
      prev.setDate(date.getDate() - 1);
      const next = new Date(date);
      next.setDate(date.getDate() + 1);
      const startStr = prev.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
      const endStr = next.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      return `${startStr} – ${endStr}`;
    }
    case 'schedule':
      return 'Schedule';
    default:
      return '';
  }
}

export default function CalendarToolbar({
  currentDate,
  activeView,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onNewEvent,
}: CalendarToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
      {/* Left: nav */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToday}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Today
        </button>
        <button
          onClick={onPrev}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={onNext}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <span className="text-base font-semibold text-gray-900 dark:text-gray-100 ml-2">
          {periodLabel(currentDate, activeView)}
        </span>
      </div>

      {/* Right: view switcher + new event */}
      <div className="flex items-center gap-2">
        {/* View switcher */}
        <div className="flex border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
          {(Object.keys(VIEW_LABELS) as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                activeView === v
                  ? 'bg-[#1A1A6D] dark:bg-[#20B2AA] text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        <button
          onClick={onNewEvent}
          className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Event
        </button>
      </div>
    </div>
  );
}
```

### Step 2: Create CalendarTab

- [ ] Create `src/components/school/calendar/CalendarTab.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { CalendarEvent, CalendarView, EditMode } from '@/types/calendar';
import { fetchCalendarEvents } from './calendarMock';
import CalendarToolbar from './CalendarToolbar';
import CalendarMonthView from './CalendarMonthView';
import CalendarWeekView from './CalendarWeekView';
import CalendarDayView from './CalendarDayView';
import Calendar3DayView from './Calendar3DayView';
import CalendarScheduleView from './CalendarScheduleView';
import EventFormModal from './EventFormModal';
import RecurringEditPrompt from './RecurringEditPrompt';

interface CalendarTabProps {
  schoolId: string;
}

export default function CalendarTab({ schoolId }: CalendarTabProps) {
  const [activeView, setActiveView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showEventForm, setShowEventForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedEditMode, setSelectedEditMode] = useState<EditMode | null>(null);
  const [formInitialDate, setFormInitialDate] = useState<Date | null>(null);
  const [showRecurringEditPrompt, setShowRecurringEditPrompt] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCalendarEvents(
        schoolId,
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
      );
      setEvents(data);
    } catch (err) {
      console.error('Failed to load calendar events', err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, currentDate]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Navigation
  function navigate(direction: 1 | -1) {
    const d = new Date(currentDate);
    switch (activeView) {
      case 'month':
        d.setMonth(d.getMonth() + direction);
        break;
      case 'week':
        d.setDate(d.getDate() + direction * 7);
        break;
      case 'day':
        d.setDate(d.getDate() + direction);
        break;
      case '3day':
        d.setDate(d.getDate() + direction * 3);
        break;
      case 'schedule':
        d.setDate(d.getDate() + direction * 7);
        break;
    }
    setCurrentDate(d);
  }

  function handleEventClick(event: CalendarEvent) {
    setSelectedEvent(event);
    if (event.is_recurring) {
      setShowRecurringEditPrompt(true);
    } else {
      setSelectedEditMode('ALL');
      setFormMode('edit');
      setShowEventForm(true);
    }
  }

  function handleEmptyCellClick(date: Date) {
    setFormInitialDate(date);
    setFormMode('create');
    setSelectedEvent(null);
    setSelectedEditMode(null);
    setShowEventForm(true);
  }

  function handleSlotClick(date: Date, hour: number) {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    handleEmptyCellClick(d);
  }

  function handleNewEvent() {
    setFormInitialDate(new Date());
    setFormMode('create');
    setSelectedEvent(null);
    setSelectedEditMode(null);
    setShowEventForm(true);
  }

  function handleRecurringEditSelect(mode: EditMode) {
    setSelectedEditMode(mode);
    setShowRecurringEditPrompt(false);
    setFormMode('edit');
    setShowEventForm(true);
  }

  function handleSuccess() {
    loadEvents();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[600px]">
      <CalendarToolbar
        currentDate={currentDate}
        activeView={activeView}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        onToday={() => setCurrentDate(new Date())}
        onViewChange={setActiveView}
        onNewEvent={handleNewEvent}
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeView === 'month' && (
            <CalendarMonthView
              currentDate={currentDate}
              events={events}
              onEventClick={handleEventClick}
              onEmptyCellClick={handleEmptyCellClick}
            />
          )}
          {activeView === 'week' && (
            <CalendarWeekView
              currentDate={currentDate}
              events={events}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
            />
          )}
          {activeView === 'day' && (
            <CalendarDayView
              currentDate={currentDate}
              events={events}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
            />
          )}
          {activeView === '3day' && (
            <Calendar3DayView
              currentDate={currentDate}
              events={events}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
            />
          )}
          {activeView === 'schedule' && (
            <CalendarScheduleView
              currentDate={currentDate}
              events={events}
              onEventClick={handleEventClick}
            />
          )}
        </>
      )}

      {/* Recurring edit prompt */}
      {showRecurringEditPrompt && (
        <RecurringEditPrompt
          onSelect={handleRecurringEditSelect}
          onCancel={() => {
            setShowRecurringEditPrompt(false);
            setSelectedEvent(null);
          }}
        />
      )}

      {/* Event form */}
      {showEventForm && (
        <EventFormModal
          mode={formMode}
          schoolId={schoolId}
          event={selectedEvent ?? undefined}
          editMode={selectedEditMode ?? undefined}
          initialDate={formInitialDate ?? undefined}
          onSuccess={handleSuccess}
          onClose={() => {
            setShowEventForm(false);
            setSelectedEvent(null);
            setSelectedEditMode(null);
            setFormInitialDate(null);
          }}
        />
      )}
    </div>
  );
}
```

### Step 3: Register the Calendar tab in the school page

- [ ] Open `src/app/schools/[id]/page.tsx`
- [ ] Add `CalendarTab` import:

```ts
import CalendarTab from '@/components/school/calendar/CalendarTab';
```

- [ ] Update the `TabType` union (add `'calendar'`):

```ts
type TabType = 'details' | 'students' | 'membership' | 'classrooms' | 'enrollments' | 'schoolYears' | 'billing' | 'calendar';
```

- [ ] Update `getInitialTab()` guard array:

```ts
if (['details', 'students', 'membership', 'classrooms', 'enrollments', 'schoolYears', 'billing', 'calendar'].includes(hash)) {
```

- [ ] Add the Calendar entry to the `tabs` array (after `billing`). First add `CalendarDays` to the lucide import at the top of the file:

```ts
import { ArrowLeft, Building2, Users, BookOpen, UserCog, ClipboardCheck, Receipt, Calendar, CalendarDays, Download, RefreshCw, Loader2 } from 'lucide-react';
```

Then add to the `tabs` array:

```ts
{ id: 'calendar' as TabType, label: 'Calendar', icon: CalendarDays },
```

- [ ] Add the tab content render (inside `{/* Tab Content */}`):

```tsx
{activeTab === 'calendar' && <CalendarTab schoolId={school.id} />}
```

### Step 4: Lint

- [ ] Run: `npm run lint`
- [ ] Expected: no errors

### Step 5: Build check

- [ ] Run: `npm run build`
- [ ] Expected: successful build with no TypeScript or Next.js errors

### Step 6: Manual verification

- [ ] Run `npm run dev` and navigate to any school detail page
- [ ] Verify the Calendar tab appears in the tab strip
- [ ] Verify the month view loads with mock events visible as coloured chips
- [ ] Verify clicking "New Event" opens the form modal
- [ ] Verify clicking a non-recurring event chip opens the edit form directly
- [ ] Verify clicking a recurring event chip (Morning Assembly) shows the THIS/THIS_AND_FUTURE/ALL prompt first
- [ ] Verify the view switcher changes between all five views
- [ ] Verify the prev/next/today navigation works in each view

### Step 7: Commit

- [ ] Run:
```bash
git add src/components/school/calendar/CalendarToolbar.tsx src/components/school/calendar/CalendarTab.tsx src/app/schools/[id]/page.tsx
git commit -m "feat: wire up CalendarTab and register Calendar tab on school page"
```
