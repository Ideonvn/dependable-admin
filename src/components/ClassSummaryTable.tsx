'use client';

import { FolderPlus } from 'lucide-react';
import { ClassSummary } from '@/lib/schoolOnboarding';

interface ClassSummaryTableProps {
  classes: ClassSummary[];
  onSubmitClasses?: () => void;
  isSubmitting?: boolean;
}

export default function ClassSummaryTable({ classes, onSubmitClasses, isSubmitting }: ClassSummaryTableProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Classes Summary</h3>
          {onSubmitClasses && (
            <button
              onClick={onSubmitClasses}
              disabled={isSubmitting || classes.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FolderPlus className="w-3 h-3" />
              )}
              Create
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                Class
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                Students
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                Validated
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-[#0F1115] divide-y divide-gray-200 dark:divide-gray-800">
            {classes.map((cls) => (
              <tr key={cls.class_name} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {cls.class_name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 text-center">
                  {cls.total_students}
                </td>
                <td className="px-4 py-3 text-sm text-center">
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {cls.validated_students}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {cls.is_fixed ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                      Fixed
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
                      Pending
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {classes.length === 0 && (
        <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
          No classes found
        </div>
      )}
    </div>
  );
}
