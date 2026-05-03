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
