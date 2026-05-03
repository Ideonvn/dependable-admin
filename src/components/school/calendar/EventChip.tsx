'use client';

import { useTheme } from 'next-themes';
import { CalendarEvent } from '@/types/calendar';
import { scopeBgColor, scopeTextColor } from './calendarColors';

interface EventChipProps {
  event: CalendarEvent;
  onClick: (event: CalendarEvent) => void;
}

export default function EventChip({ event, onClick }: EventChipProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const bg = scopeBgColor(event.scope, isDark);
  const color = scopeTextColor(event.scope, isDark);

  const label = event.all_day
    ? event.title
    : (() => {
        const d = new Date(event.occurrence_start_dt ?? event.start_dt);
        const h = d.getHours().toString().padStart(2, '0');
        const m = d.getMinutes().toString().padStart(2, '0');
        return `${h}:${m} ${event.title}`;
      })();

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
      className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate font-medium"
      style={{ backgroundColor: bg, color }}
      title={event.title}
    >
      {label}
    </button>
  );
}
