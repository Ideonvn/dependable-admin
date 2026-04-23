'use client';

import { useMemo } from 'react';
import { CalendarEvent } from '@/types/calendar';
import TimeGrid from './TimeGrid';

interface CalendarWeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent, columnDate: Date) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

function getWeekDays(date: Date): Date[] {
  const dow = date.getUTCDay(); // 0=Sun
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - dow + i));
    days.push(d);
  }
  return days;
}

export default function CalendarWeekView({
  currentDate,
  events,
  onEventClick,
  onSlotClick,
}: CalendarWeekViewProps) {
  const cols = useMemo(() => getWeekDays(currentDate), [currentDate]);
  return (
    <TimeGrid
      columns={cols}
      events={events}
      onEventClick={onEventClick}
      onSlotClick={onSlotClick}
    />
  );
}
