'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { CalendarEvent } from '@/types/calendar';

export const HOUR_HEIGHT = 64; // px per hour
export const TIME_LABEL_WIDTH = 56; // px

interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  colIndex: number;
  colCount: number;
  startMin: number;
  endMin: number;
}

function toMinutes(isoStr: string): number {
  const d = new Date(isoStr);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function isSameDay(isoStr: string, col: Date): boolean {
  const d = new Date(isoStr);
  return (
    d.getUTCFullYear() === col.getUTCFullYear() &&
    d.getUTCMonth() === col.getUTCMonth() &&
    d.getUTCDate() === col.getUTCDate()
  );
}

function isTodayCol(col: Date, now: Date): boolean {
  return (
    col.getUTCFullYear() === now.getFullYear() &&
    col.getUTCMonth() === now.getMonth() &&
    col.getUTCDate() === now.getDate()
  );
}

function scopeBgColor(scope: CalendarEvent['scope'], isDark: boolean): string {
  switch (scope) {
    case 'SCHOOL': return isDark ? '#20B2AA' : '#1A1A6D';
    case 'CLASSROOM': return isDark ? 'rgba(70, 130, 180, 1)' : 'rgba(135, 206, 250, 1)';
    case 'STUDENT': return isDark ? '#4CAF50' : '#10B981';
  }
}

function scopeTextColor(scope: CalendarEvent['scope'], isDark: boolean): string {
  if (scope === 'CLASSROOM' && !isDark) return '#1A1A6D';
  return '#ffffff';
}

function layoutEvents(dayEvents: CalendarEvent[]): PositionedEvent[] {
  const sorted = [...dayEvents].sort(
    (a, b) =>
      new Date(a.occurrence_start_dt ?? a.start_dt).getTime() -
      new Date(b.occurrence_start_dt ?? b.start_dt).getTime(),
  );

  const positioned: PositionedEvent[] = [];
  const cols: number[] = []; // end-minute of last event in each column

  sorted.forEach((ev) => {
    const startStr = ev.occurrence_start_dt ?? ev.start_dt;
    const endStr = ev.occurrence_end_dt ?? ev.end_dt;
    const startMin = toMinutes(startStr);
    const endMin = Math.max(toMinutes(endStr), startMin + 30);
    const top = (startMin / 60) * HOUR_HEIGHT;
    const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 24);

    let col = cols.findIndex((endM) => endM <= startMin);
    if (col === -1) col = cols.length;
    cols[col] = endMin;

    positioned.push({ event: ev, top, height, colIndex: col, colCount: 0, startMin, endMin });
  });

  // Assign colCount: each event's colCount = max columns in its overlap cluster
  positioned.forEach((p) => {
    let maxCol = p.colIndex;
    positioned.forEach((q) => {
      if (q !== p && q.startMin < p.endMin && q.endMin > p.startMin) {
        if (q.colIndex > maxCol) maxCol = q.colIndex;
      }
    });
    p.colCount = maxCol + 1;
  });

  return positioned;
}

interface TimeGridProps {
  columns: Date[]; // one Date per column (the calendar day)
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent, columnDate: Date) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

export default function TimeGrid({ columns, events, onEventClick, onSlotClick }: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT;

  // Auto-scroll to 07:00 on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT - 32;
    }
  }, []);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Column headers */}
      <div
        className="flex border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
        style={{ paddingLeft: TIME_LABEL_WIDTH }}
      >
        {columns.map((col, i) => {
          const isToday = isTodayCol(col, now);
          return (
            <div key={i} className="flex-1 flex flex-col items-center py-2 border-l border-gray-100 dark:border-gray-800">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                {col.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}
              </span>
              <span
                className={`text-lg font-semibold w-8 h-8 flex items-center justify-center rounded-full ${
                  isToday
                    ? 'bg-[#1A1A6D] dark:bg-[#20B2AA] text-white'
                    : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {col.getUTCDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
        <div className="relative flex" style={{ height: 24 * HOUR_HEIGHT }}>
          {/* Time labels */}
          <div className="flex-shrink-0 flex flex-col" style={{ width: TIME_LABEL_WIDTH }}>
            {hours.map((h) => (
              <div
                key={h}
                className="flex-shrink-0 flex items-start justify-end pr-2 text-xs text-gray-400"
                style={{ height: HOUR_HEIGHT }}
              >
                {h === 0 ? '' : `${h.toString().padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Column grid */}
          <div className="flex flex-1">
            {columns.map((col, colIdx) => {
              const colEvents = events.filter((e) =>
                isSameDay(e.occurrence_start_dt ?? e.start_dt, col) && !e.all_day,
              );
              const positioned = layoutEvents(colEvents);
              const isToday = isTodayCol(col, now);

              return (
                <div
                  key={colIdx}
                  className={`flex-1 relative border-l border-gray-100 dark:border-gray-800 ${
                    isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                  }`}
                  style={{ height: 24 * HOUR_HEIGHT }}
                >
                  {/* Hour rows */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-b border-gray-100 dark:border-gray-800"
                      style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    >
                      {/* Half-hour dashed divider */}
                      <div
                        className="absolute left-0 right-0 border-b border-dashed border-gray-100 dark:border-gray-800 opacity-40"
                        style={{ top: HOUR_HEIGHT / 2 }}
                      />
                      {/* Click target */}
                      <button
                        className="absolute inset-0 w-full h-full opacity-0"
                        onClick={() => onSlotClick(col, h)}
                        aria-label={`${col.toDateString()} ${h}:00`}
                      />
                    </div>
                  ))}

                  {/* Events */}
                  {positioned.map((p) => {
                    const bg = scopeBgColor(p.event.scope, isDark);
                    const color = scopeTextColor(p.event.scope, isDark);
                    const width = `${100 / p.colCount}%`;
                    const left = `${(p.colIndex / p.colCount) * 100}%`;
                    const startDt = new Date(p.event.occurrence_start_dt ?? p.event.start_dt);
                    const endDt = new Date(p.event.occurrence_end_dt ?? p.event.end_dt);
                    const timeLabel = `${startDt.getUTCHours().toString().padStart(2, '0')}:${startDt.getUTCMinutes().toString().padStart(2, '0')} – ${endDt.getUTCHours().toString().padStart(2, '0')}:${endDt.getUTCMinutes().toString().padStart(2, '0')}`;

                    return (
                      <button
                        key={p.event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(p.event, col);
                        }}
                        className="absolute rounded px-1 py-0.5 text-left overflow-hidden hover:opacity-90 transition-opacity z-10"
                        style={{
                          top: p.top,
                          height: p.height,
                          left,
                          width,
                          backgroundColor: bg,
                          color,
                        }}
                      >
                        <div className="text-xs font-semibold truncate">{p.event.title}</div>
                        {p.height > 36 && (
                          <div className="text-xs opacity-80 truncate">{timeLabel}</div>
                        )}
                      </button>
                    );
                  })}

                  {/* Current time line (only on today's column) */}
                  {isToday && (
                    <div
                      className="absolute left-0 right-0 z-20 flex items-center"
                      style={{ top: nowTop }}
                    >
                      <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 -ml-1" />
                      <div className="flex-1 border-t border-red-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
