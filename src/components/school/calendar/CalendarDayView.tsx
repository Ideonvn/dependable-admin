'use client';

import { CalendarEvent } from '@/types/calendar';
import TimeGrid from './TimeGrid';

interface CalendarDayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent, columnDate: Date) => void;
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
      onEventClick={(ev, col) => onEventClick(ev, col)}
      onSlotClick={onSlotClick}
    />
  );
}
