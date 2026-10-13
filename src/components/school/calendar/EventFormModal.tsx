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
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from './calendarApi';
import RecurringDeletePrompt from './RecurringDeletePrompt';
import EventRsvpPanel from './EventRsvpPanel';
import ModalOverlay from '@/components/ModalOverlay';

interface EventFormModalProps {
  mode: 'create' | 'edit';
  schoolId: string;
  event?: CalendarEvent;
  editMode?: EditMode;
  initialDate?: Date;
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

// Start and end are held as local "YYYY-MM-DDTHH:mm" strings.
const HOUR_MS = 60 * 60 * 1000;
const datePart = (value: string) => value.slice(0, 10);
const timePart = (value: string) => value.slice(11, 16) || '09:00';
const joinLocal = (date: string, time: string) => `${date}T${time}`;
const addMs = (value: string, ms: number) =>
  toLocalDateTimeValue(new Date(new Date(value).getTime() + ms).toISOString());

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

function scopeBgColor(scope: CalendarEventScope, isDark: boolean): string {
  switch (scope) {
    case 'SCHOOL': return isDark ? '#20B2AA' : '#1A1A6D';
    case 'CLASSROOM': return isDark ? 'rgba(70, 130, 180, 1)' : 'rgba(135, 206, 250, 1)';
    case 'STUDENT': return isDark ? '#4CAF50' : '#10B981';
  }
}

function scopeLabel(scope: CalendarEventScope): string {
  switch (scope) {
    case 'SCHOOL': return 'School';
    case 'CLASSROOM': return 'Classroom';
    case 'STUDENT': return 'Student';
  }
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

  const [title, setTitle] = useState(event?.title ?? '');
  const [scope, setScope] = useState<CalendarEventScope>(event?.scope ?? 'SCHOOL');
  const [classroomId, setClassroomId] = useState(event?.classroom_id ?? '');
  const [studentId, setStudentId] = useState(event?.student_id ?? '');
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [startDt, setStartDt] = useState(
    event ? toLocalDateTimeValue(event.occurrence_start_dt ?? event.start_dt) : toLocalDateTimeValue(defaultStartIso)
  );
  const [endDt, setEndDt] = useState(
    event ? toLocalDateTimeValue(event.occurrence_end_dt ?? event.end_dt) : toLocalDateTimeValue(defaultEndIso)
  );
  const [location, setLocation] = useState(event?.location ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [recurring, setRecurring] = useState(event?.is_recurring ?? false);
  const [freq, setFreq] = useState<Frequency>('WEEKLY');
  const [recurEndType, setRecurEndType] = useState<RecurEndType>('never');
  const [recurEndDate, setRecurEndDate] = useState('');
  const [recurAfterN, setRecurAfterN] = useState(10);
  const [rsvpEnabled, setRsvpEnabled] = useState(event?.rsvp_enabled ?? false);
  // Off: the event ends on the day it starts and the end date is hidden.
  const [multiDay, setMultiDay] = useState(datePart(startDt) !== datePart(endDt));

  // Google-style: moving the start carries the end along, keeping the length.
  function changeStart(next: string) {
    if (!next) return;
    const length = Math.max(0, new Date(endDt).getTime() - new Date(startDt).getTime());
    const nextEnd = addMs(next, length);
    setStartDt(next);
    setEndDt(nextEnd);
    // An end pushed onto the next day switches multi-day on, so the end date
    // is never changed out of sight.
    if (datePart(nextEnd) !== datePart(next)) setMultiDay(true);
  }

  function changeMultiDay(on: boolean) {
    setMultiDay(on);
    if (!on) {
      const sameDay = joinLocal(datePart(startDt), timePart(endDt));
      setEndDt(new Date(sameDay) > new Date(startDt) ? sameDay : addMs(startDt, HOUR_MS));
    }
  }

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);

  useEffect(() => {
    schoolsApi.getClassrooms(schoolId).then(setClassrooms).catch(console.error);
    schoolsApi.getStudents(schoolId).then(setStudents).catch(console.error);
  }, [schoolId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) { setError('Title is required'); return; }
    if (scope === 'CLASSROOM' && !classroomId) { setError('Please select a classroom'); return; }
    if (scope === 'STUDENT' && !studentId) { setError('Please select a student'); return; }

    if (!allDay && new Date(endDt) <= new Date(startDt)) {
      setError('End time must be after start time');
      return;
    }
    if (allDay && datePart(endDt) < datePart(startDt)) {
      setError('End date must not be before the start date');
      return;
    }

    if (recurring && recurEndType === 'on_date' && !recurEndDate) {
      setError('Please select a recurrence end date');
      return;
    }

    // All-day keeps its previous meaning: the date at UTC midnight.
    const startIso = new Date(allDay ? datePart(startDt) : startDt).toISOString();
    const endIso = new Date(allDay ? datePart(endDt) : endDt).toISOString();

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
      rsvp_enabled: rsvpEnabled,
      classroom_id: scope === 'CLASSROOM' ? classroomId : undefined,
      student_id: scope === 'STUDENT' ? studentId : undefined,
    };

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createCalendarEvent(schoolId, payload);
      } else if (event) {
        const em = editMode ?? 'ALL';
        const occDate = event.occurrence_start_dt ? toLocalDateValue(event.occurrence_start_dt) : undefined;
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

  async function handleDelete(deleteMode: EditMode) {
    if (!event) return;
    setSubmitting(true);
    try {
      const occDate = event.occurrence_start_dt ? toLocalDateValue(event.occurrence_start_dt) : undefined;
      await deleteCalendarEvent(schoolId, event.id, deleteMode, occDate);
      setShowDeletePrompt(false);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setSubmitting(false);
    }
  }

  const scopeColor = scopeBgColor(scope, isDark);

  return (
    <>
      <ModalOverlay>
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
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    allDay ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">All day</span>
            </div>

            {/* Start */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={datePart(startDt)}
                  onChange={(e) => e.target.value && changeStart(joinLocal(e.target.value, timePart(startDt)))}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                />
                {!allDay && (
                  <input
                    type="time"
                    value={timePart(startDt)}
                    onChange={(e) => e.target.value && changeStart(joinLocal(datePart(startDt), e.target.value))}
                    disabled={submitting}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                  />
                )}
              </div>
            </div>

            {/* Multi-day toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => changeMultiDay(!multiDay)}
                disabled={submitting}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  multiDay ? 'bg-[#1A1A6D] dark:bg-[#20B2AA]' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    multiDay ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">Multi-day</span>
            </div>

            {/* End: a single all-day event has none to pick */}
            {(multiDay || !allDay) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {multiDay && (
                    <input
                      type="date"
                      value={datePart(endDt)}
                      min={datePart(startDt)}
                      onChange={(e) => e.target.value && setEndDt(joinLocal(e.target.value, timePart(endDt)))}
                      disabled={submitting}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                    />
                  )}
                  {!allDay && (
                    <input
                      type="time"
                      value={timePart(endDt)}
                      onChange={(e) => e.target.value && setEndDt(joinLocal(datePart(endDt), e.target.value))}
                      disabled={submitting}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                rows={3}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
              />
            </div>

            {/* RSVP toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRsvpEnabled(!rsvpEnabled)}
                disabled={submitting}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  rsvpEnabled ? 'bg-[#1A1A6D] dark:bg-[#20B2AA]' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    rsvpEnabled ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">Ask parents to RSVP</span>
            </div>

            {/* Responses: what was saved, not the unsaved toggle */}
            {mode === 'edit' && event?.rsvp_enabled && (
              <EventRsvpPanel
                schoolId={schoolId}
                eventId={event.id}
                occurrenceDate={new Date(event.occurrence_start_dt ?? event.start_dt).toISOString().slice(0, 10)}
              />
            )}

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
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                      recurring ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-300">Recurring</span>
              </div>

              {recurring && (
                <div className="pl-4 border-l-2 border-gray-200 dark:border-gray-700 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Repeats</label>
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

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ends</label>
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
                  onClick={() => {
                    if (event?.is_recurring) {
                      setShowDeletePrompt(true);
                    } else {
                      handleDelete('ALL');
                    }
                  }}
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
      </ModalOverlay>

      {showDeletePrompt && (
        <RecurringDeletePrompt
          onSelect={handleDelete}
          onCancel={() => setShowDeletePrompt(false)}
        />
      )}
    </>
  );
}
