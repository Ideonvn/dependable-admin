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
  const [editMode, setEditMode] = useState<EditMode | null>(null);
  const [formInitialDate, setFormInitialDate] = useState<Date | null>(null);
  const [showRecurringEditPrompt, setShowRecurringEditPrompt] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCalendarEvents(schoolId, year, month + 1);
      setEvents(data);
    } catch (err) {
      console.error('Failed to load calendar events', err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, year, month]);

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
      setEditMode('ALL');
      setFormMode('edit');
      setShowEventForm(true);
    }
  }

  function handleEmptyCellClick(date: Date) {
    setFormInitialDate(date);
    setFormMode('create');
    setSelectedEvent(null);
    setEditMode(null);
    setShowEventForm(true);
  }

  function handleSlotClick(date: Date, hour: number) {
    const d = new Date(date);
    d.setUTCHours(hour, 0, 0, 0);
    handleEmptyCellClick(d);
  }

  function handleNewEvent() {
    setFormInitialDate(new Date());
    setFormMode('create');
    setSelectedEvent(null);
    setEditMode(null);
    setShowEventForm(true);
  }

  function handleRecurringEditSelect(mode: EditMode) {
    setEditMode(mode);
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
          editMode={editMode ?? undefined}
          initialDate={formInitialDate ?? undefined}
          onSuccess={handleSuccess}
          onClose={() => {
            setShowEventForm(false);
            setSelectedEvent(null);
            setEditMode(null);
            setFormInitialDate(null);
          }}
        />
      )}
    </div>
  );
}
