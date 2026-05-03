'use client';

import { useMemo } from 'react';
import { CalendarEvent } from '@/types/calendar';
import TimeGrid from './TimeGrid';

interface Calendar3DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent, columnDate: Date) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

export default function Calendar3DayView({
  currentDate,
  events,
  onEventClick,
  onSlotClick,
}: Calendar3DayViewProps) {
  const cols = useMemo(() => {
    const prev = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate() - 1));
    const next = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate() + 1));
    return [prev, currentDate, next];
  }, [currentDate]);

  return (
    <TimeGrid
      columns={cols}
      events={events}
      onEventClick={onEventClick}
      onSlotClick={onSlotClick}
    />
  );
}
