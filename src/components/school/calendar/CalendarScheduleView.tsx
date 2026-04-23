'use client';

import { useMemo } from 'react';
import { useTheme } from 'next-themes';
import { CalendarEvent, CalendarEventScope } from '@/types/calendar';
import { CalendarDays } from 'lucide-react';

interface CalendarScheduleViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

interface DayGroup {
  date: Date;
  events: CalendarEvent[];
}

function scopeBorderColor(scope: CalendarEventScope, isDark: boolean): string {
  switch (scope) {
    case 'SCHOOL': return isDark ? '#20B2AA' : '#1A1A6D';
    case 'CLASSROOM': return isDark ? 'rgba(70, 130, 180, 1)' : 'rgba(135, 206, 250, 1)';
    case 'STUDENT': return isDark ? '#4CAF50' : '#10B981';
  }
}

function groupByDay(events: CalendarEvent[], from: Date, days: number): DayGroup[] {
  const map = new Map<string, CalendarEvent[]>();

  events.forEach((ev) => {
    const d = new Date(ev.occurrence_start_dt ?? ev.start_dt);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  });

  const groups: DayGroup[] = [];
  const fromMidnightUTC = Date.UTC(
    from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()
  );
  for (let i = 0; i < days; i++) {
    const d = new Date(fromMidnightUTC + i * 86_400_000);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    if (map.has(key)) {
      groups.push({
        date: d,
        events: map.get(key)!.sort(
          (a, b) =>
            new Date(a.occurrence_start_dt ?? a.start_dt).getTime() -
            new Date(b.occurrence_start_dt ?? b.start_dt).getTime(),
        ),
      });
    }
  }
  return groups;
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
}

export default function CalendarScheduleView({
  currentDate,
  events,
  onEventClick,
}: CalendarScheduleViewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const groups = useMemo(() => groupByDay(events, currentDate, 90), [events, currentDate]);

  if (groups.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 gap-3 py-24">
        <CalendarDays className="w-12 h-12 opacity-40" />
        <p className="text-sm">No upcoming events in the next 90 days</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {groups.map((group) => (
        <div key={group.date.toISOString().slice(0, 10)} className="border-b border-gray-100 dark:border-gray-800">
          {/* Date header */}
          <div className="flex items-baseline gap-3 px-6 py-3 bg-gray-50 dark:bg-gray-900/50">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-8">
              {group.date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}
            </span>
            <span className="text-3xl font-light text-gray-900 dark:text-gray-100">
              {group.date.getUTCDate()}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {group.date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </span>
          </div>

          {/* Events */}
          {group.events.map((ev) => {
            const borderColor = scopeBorderColor(ev.scope, isDark);
            const startDt = ev.occurrence_start_dt ?? ev.start_dt;
            const endDt = ev.occurrence_end_dt ?? ev.end_dt;

            return (
              <button
                key={ev.id + '|' + (ev.occurrence_start_dt ?? ev.start_dt)}
                onClick={() => onEventClick(ev)}
                className="w-full text-left px-6 py-3 flex gap-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors border-b border-gray-50 dark:border-gray-900"
              >
                {/* Scope colour bar */}
                <div
                  className="w-1 rounded-full flex-shrink-0 self-stretch"
                  style={{ backgroundColor: borderColor }}
                />

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                    {ev.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {ev.all_day
                      ? 'All day'
                      : `${formatTime(startDt)} – ${formatTime(endDt)}`}
                    {ev.location && (
                      <span className="ml-2">· {ev.location}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
