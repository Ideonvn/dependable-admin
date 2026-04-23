import apiClient from '@/lib/api';
import {
  CalendarEvent,
  CalendarEventScope,
  CreateCalendarEventPayload,
  EditMode,
  UpdateCalendarEventPayload,
} from '@/types/calendar';

// Shape returned by GET /schools/:id/calendar/events (expanded occurrences)
interface CalendarEventOccurrenceResponse {
  event_id: string;
  occurrence_start_dt: string;
  occurrence_end_dt: string;
  title: string;
  scope: CalendarEventScope;
  description: string | null;
  location: string | null;
  all_day: boolean;
  is_recurring: boolean;
  classroom_id: string | null;
  student_id: string | null;
}

// Shape returned by POST/PUT (series record)
interface CalendarEventSeriesResponse {
  id: string;
  school_id: string;
  classroom_id: string | null;
  student_id: string | null;
  scope: CalendarEventScope;
  title: string;
  description: string | null;
  location: string | null;
  all_day: boolean;
  start_dt: string;
  end_dt: string;
  duration_mins: number | null;
  rrule: string | null;
  series_end_dt: string | null;
}

function mapOccurrence(schoolId: string, o: CalendarEventOccurrenceResponse): CalendarEvent {
  return {
    id: o.event_id,
    school_id: schoolId,
    classroom_id: o.classroom_id ?? undefined,
    student_id: o.student_id ?? undefined,
    scope: o.scope,
    title: o.title,
    description: o.description ?? undefined,
    location: o.location ?? undefined,
    all_day: o.all_day,
    start_dt: o.occurrence_start_dt,
    end_dt: o.occurrence_end_dt,
    occurrence_start_dt: o.occurrence_start_dt,
    occurrence_end_dt: o.occurrence_end_dt,
    is_recurring: o.is_recurring,
  };
}

function mapSeries(s: CalendarEventSeriesResponse): CalendarEvent {
  return {
    id: s.id,
    school_id: s.school_id,
    classroom_id: s.classroom_id ?? undefined,
    student_id: s.student_id ?? undefined,
    scope: s.scope,
    title: s.title,
    description: s.description ?? undefined,
    location: s.location ?? undefined,
    all_day: s.all_day,
    start_dt: s.start_dt,
    end_dt: s.end_dt,
    rrule: s.rrule ?? undefined,
    series_end_dt: s.series_end_dt ?? undefined,
    is_recurring: !!s.rrule,
  };
}

export async function fetchCalendarEvents(
  schoolId: string,
  year: number,
  month: number,
): Promise<CalendarEvent[]> {
  const response = await apiClient.get(`/schools/${schoolId}/calendar/events`, {
    params: { year, month },
  });
  return (response.data as CalendarEventOccurrenceResponse[]).map((o) =>
    mapOccurrence(schoolId, o),
  );
}

export async function createCalendarEvent(
  schoolId: string,
  payload: CreateCalendarEventPayload,
): Promise<CalendarEvent> {
  const response = await apiClient.post(`/schools/${schoolId}/calendar/events`, payload);
  return mapSeries(response.data as CalendarEventSeriesResponse);
}

export async function updateCalendarEvent(
  schoolId: string,
  eventId: string,
  payload: UpdateCalendarEventPayload,
  editMode: EditMode,
  occurrenceDate?: string,
): Promise<CalendarEvent> {
  const params: Record<string, string> = { edit_mode: editMode };
  if (occurrenceDate) params.occurrence_date = occurrenceDate;
  const response = await apiClient.put(
    `/schools/${schoolId}/calendar/events/${eventId}`,
    payload,
    { params },
  );
  return mapSeries(response.data as CalendarEventSeriesResponse);
}

export async function deleteCalendarEvent(
  schoolId: string,
  eventId: string,
  editMode: EditMode,
  occurrenceDate?: string,
): Promise<void> {
  const params: Record<string, string> = { edit_mode: editMode };
  if (occurrenceDate) params.occurrence_date = occurrenceDate;
  await apiClient.delete(`/schools/${schoolId}/calendar/events/${eventId}`, { params });
}
