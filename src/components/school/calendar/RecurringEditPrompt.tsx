'use client';

import { EditMode } from '@/types/calendar';
import { X } from 'lucide-react';

interface RecurringEditPromptProps {
  onSelect: (mode: EditMode) => void;
  onCancel: () => void;
}

export default function RecurringEditPrompt({ onSelect, onCancel }: RecurringEditPromptProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-sm w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Edit recurring event
          </h2>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <div className="p-2">
          {(
            [
              { mode: 'THIS' as EditMode, label: 'This event' },
              { mode: 'THIS_AND_FUTURE' as EditMode, label: 'This and following events' },
              { mode: 'ALL' as EditMode, label: 'All events' },
            ] as { mode: EditMode; label: string }[]
          ).map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => onSelect(mode)}
              className="w-full text-left px-4 py-3 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="p-4 pt-2 flex justify-end border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
