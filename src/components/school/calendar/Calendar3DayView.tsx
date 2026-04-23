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
