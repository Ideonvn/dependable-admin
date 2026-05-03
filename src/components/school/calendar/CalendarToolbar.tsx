'use client';

import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { CalendarView } from '@/types/calendar';

interface CalendarToolbarProps {
  currentDate: Date;
  activeView: CalendarView;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
  onNewEvent: () => void;
}

const VIEW_LABELS: Record<CalendarView, string> = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
  '3day': '3 Day',
  schedule: 'Schedule',
};

function periodLabel(date: Date, view: CalendarView): string {
  switch (view) {
    case 'month':
      return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    case 'week': {
      const sun = new Date(date);
      sun.setDate(date.getDate() - date.getDay());
      const sat = new Date(sun);
      sat.setDate(sun.getDate() + 6);
      const startStr = sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const endStr = sat.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      return `${startStr} – ${endStr}`;
    }
    case 'day':
      return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' });
    case '3day': {
      const prev = new Date(date);
      prev.setDate(date.getDate() - 1);
      const next = new Date(date);
      next.setDate(date.getDate() + 1);
      const startStr = prev.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
      const endStr = next.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      return `${startStr} – ${endStr}`;
    }
    case 'schedule':
      return 'Schedule';
    default:
      return '';
  }
}

export default function CalendarToolbar({
  currentDate,
  activeView,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onNewEvent,
}: CalendarToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
      {/* Left: nav */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToday}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Today
        </button>
        <button
          onClick={onPrev}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={onNext}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <span className="text-base font-semibold text-gray-900 dark:text-gray-100 ml-2">
          {periodLabel(currentDate, activeView)}
        </span>
      </div>

      {/* Right: view switcher + new event */}
      <div className="flex items-center gap-2">
        {/* View switcher */}
        <div className="flex border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
          {(Object.keys(VIEW_LABELS) as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                activeView === v
                  ? 'bg-[#1A1A6D] dark:bg-[#20B2AA] text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        <button
          onClick={onNewEvent}
          className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Event
        </button>
      </div>
    </div>
  );
}
