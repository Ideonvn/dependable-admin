'use client';

import { CalendarEvent } from '@/types/calendar';
import TimeGrid from './TimeGrid';

interface CalendarWeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent, columnDate: Date) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

function getWeekDays(date: Date): Date[] {
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

export default function CalendarWeekView({
  currentDate,
  events,
  onEventClick,
  onSlotClick,
}: CalendarWeekViewProps) {
  const columns = getWeekDays(currentDate);
  return (
    <TimeGrid
      columns={columns}
      events={events}
      onEventClick={(ev, col) => onEventClick(ev, col)}
      onSlotClick={onSlotClick}
    />
  );
}
