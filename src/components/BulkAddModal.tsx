'use client';

import { useState, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import axios from 'axios';
import { schoolOnboardingApi, CSVImportResult } from '@/lib/schoolOnboarding';

interface BulkAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Called from the result screen; the parent reloads records and statistics.
  onDone: () => void;
  schoolId: string;
}

export default function BulkAddModal({ isOpen, onClose, onDone, schoolId }: BulkAddModalProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CSVImportResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCsvFile(null);
      setError(null);
      setResult(null);
    }
  }, [isOpen]);

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith('.csv')) {
        setError('Please upload a CSV file');
        return;
      }
      setCsvFile(file);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!csvFile) {
      setError('CSV file is required');
      return;
    }

    setImporting(true);
    setError(null);
    try {
      setResult(await schoolOnboardingApi.importRecords(schoolId, csvFile));
    } catch (err) {
      // The API puts the specific 400 text ("CSV missing required fields" etc.) in
      // developer_message; friendly_message is generic for these errors.
      const apiError = axios.isAxiosError(err) ? err.response?.data?.error : undefined;
      setError(apiError?.developer_message || apiError?.friendly_message || 'Failed to import CSV. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  const close = result ? onDone : onClose;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-lg w-full my-8">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Bulk add from CSV</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Students are added as pending records. Press Validate afterwards.
            </p>
          </div>
          <button
            onClick={close}
            disabled={importing}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {result ? (
          <>
            <div className="p-6 space-y-4">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {result.successful_imports} student{result.successful_imports !== 1 ? 's' : ''} imported.
              </p>

              {result.duplicate_count > 0 && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {result.duplicate_count} of these look like children already on this school&apos;s list. They are marked in the table.
                </p>
              )}

              {result.failed_imports > 0 && (
                <div>
                  <p className="text-sm text-red-700 dark:text-red-400 mb-2">
                    {result.failed_imports} row{result.failed_imports !== 1 ? 's' : ''} could not be imported:
                  </p>
                  <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Row</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {result.errors.map((e) => (
                          <tr key={e.row}>
                            <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{e.row}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{e.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 pb-6 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={onDone}
                className="px-6 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="flex items-center justify-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-gray-400 dark:hover:border-gray-600 cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 text-gray-400 dark:text-gray-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {csvFile ? csvFile.name : 'Choose CSV file'}
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvFileChange}
                    className="hidden"
                    disabled={importing}
                  />
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Required columns: first_name, last_name, primary_name, primary_email, class_name. Optional: gender, date_of_birth (YYYY-MM-DD).{' '}
                  <a
                    href="/sample-onboarding.csv"
                    download
                    className="text-[#20B2AA] hover:underline"
                  >
                    Download sample CSV
                  </a>
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 pb-6 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={onClose}
                disabled={importing}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className="px-6 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
