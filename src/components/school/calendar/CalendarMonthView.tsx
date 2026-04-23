'use client';

import { useState } from 'react';
import { CalendarEvent } from '@/types/calendar';
import EventChip from './EventChip';

interface CalendarMonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onEmptyCellClick: (date: Date) => void;
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CHIPS = 3;

function buildGrid(currentDate: Date): Date[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startSunday = new Date(firstDay);
  startSunday.setDate(firstDay.getDate() - firstDay.getDay());

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startSunday);
    d.setDate(startSunday.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isCurrentMonth(date: Date, currentDate: Date): boolean {
  return (
    date.getFullYear() === currentDate.getFullYear() &&
    date.getMonth() === currentDate.getMonth()
  );
}

export default function CalendarMonthView({
  currentDate,
  events,
  onEventClick,
  onEmptyCellClick,
}: CalendarMonthViewProps) {
  const [popoverDate, setPopoverDate] = useState<Date | null>(null);
  const today = new Date();
  const cells = buildGrid(currentDate);

  function eventsForDay(date: Date): CalendarEvent[] {
    return events
      .filter((e) => {
        const d = new Date(e.occurrence_start_dt ?? e.start_dt);
        return isSameDay(d, date);
      })
      .sort((a, b) => {
        if (a.all_day && !b.all_day) return -1;
        if (!a.all_day && b.all_day) return 1;
        return (
          new Date(a.occurrence_start_dt ?? a.start_dt).getTime() -
          new Date(b.occurrence_start_dt ?? b.start_dt).getTime()
        );
      });
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day of week headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800">
        {DOW_LABELS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6">
        {cells.map((cell, idx) => {
          const dayEvents = eventsForDay(cell);
          const overflow = dayEvents.length - MAX_CHIPS;
          const isToday = isSameDay(cell, today);
          const inMonth = isCurrentMonth(cell, currentDate);

          return (
            <div
              key={idx}
              onClick={() => onEmptyCellClick(cell)}
              className={`border-b border-r border-gray-100 dark:border-gray-800 p-1 flex flex-col gap-0.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 min-h-[100px] ${
                !inMonth ? 'bg-gray-50 dark:bg-gray-900/50' : ''
              }`}
            >
              {/* Date number */}
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className={`text-sm w-6 h-6 flex items-center justify-center rounded-full font-medium ${
                    isToday
                      ? 'bg-[#1A1A6D] dark:bg-[#20B2AA] text-white'
                      : inMonth
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-gray-400 dark:text-gray-600'
                  }`}
                >
                  {cell.getDate()}
                </span>
              </div>

              {/* Event chips */}
              {dayEvents.slice(0, MAX_CHIPS).map((ev) => (
                <EventChip key={ev.id + (ev.occurrence_start_dt ?? '')} event={ev} onClick={onEventClick} />
              ))}

              {/* Overflow */}
              {overflow > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPopoverDate(cell);
                  }}
                  className="text-xs text-[#1A1A6D] dark:text-[#20B2AA] hover:underline text-left px-1"
                >
                  +{overflow} more
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Overflow popover */}
      {popoverDate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center" onClick={() => setPopoverDate(null)}>
          <div
            className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 p-4 w-64 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                {popoverDate.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
              <button
                onClick={() => setPopoverDate(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {eventsForDay(popoverDate).map((ev) => (
                <EventChip
                  key={ev.id + (ev.occurrence_start_dt ?? '')}
                  event={ev}
                  onClick={(e) => {
                    setPopoverDate(null);
                    onEventClick(e);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
