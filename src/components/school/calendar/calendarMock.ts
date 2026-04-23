import {
  CalendarEvent,
  CreateCalendarEventPayload,
  UpdateCalendarEventPayload,
  EditMode,
} from '@/types/calendar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoDate(year: number, month: number, day: number, hour = 0, minute = 0): string {
  return new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString();
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
  // Use UTC throughout to avoid local-timezone day drift
  const d = new Date(Date.UTC(year, month - 1, 1));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCMonth() === month - 1) {
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 0));
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 30));
    results.push({
      id: seriesId,
      school_id: schoolId,
      scope: 'SCHOOL',
      title: 'Morning Assembly',
      description: 'Weekly school assembly for all grades.',
      location: 'Main Hall',
      all_day: false,
      start_dt: new Date(Date.UTC(year, month - 1, 1, 8, 0)).toISOString(),
      end_dt: new Date(Date.UTC(year, month - 1, 1, 8, 30)).toISOString(),
      duration_mins: 30,
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
      is_recurring: true,
      occurrence_start_dt: start.toISOString(),
      occurrence_end_dt: end.toISOString(),
    });
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return results;
}

const SERIES_ID = 'series-assembly-001';

// school_id sentinel '__SCHOOL_ID__' is replaced with the real schoolId in initStore
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

// NOTE: Only returns events whose occurrence_start_dt falls within the requested
// month. Events that span a month boundary are not returned for the earlier month.
// This is an intentional mock simplification.
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
    const thisIdx = store.findIndex(
      (e) => e.id === eventId && e.occurrence_start_dt?.startsWith(occurrenceDate),
    );
    if (thisIdx === -1) throw new Error('Occurrence not found');
    const orig = store[thisIdx];
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
    store.splice(thisIdx, 1);
    store.push(newEvent);
    return newEvent;
  }

  if (editMode === 'THIS_AND_FUTURE' && occurrenceDate) {
    // Find the original event to use as the base (before any removals)
    const orig = store.find((e) => e.id === eventId);
    if (!orig) throw new Error('Event not found');
    // Remove all occurrences of this series from occurrenceDate forward
    store = store.filter(
      (e) =>
        !(
          e.id === eventId &&
          e.occurrence_start_dt &&
          e.occurrence_start_dt >= occurrenceDate
        ),
    );
    const newStart = payload.start_dt ?? occurrenceDate;
    const newEvent: CalendarEvent = {
      ...orig,
      ...payload,
      id: uuid(),
      school_id: schoolId,
      start_dt: newStart,
      is_recurring: payload.rrule !== undefined ? !!payload.rrule : orig.is_recurring,
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
