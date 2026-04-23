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
