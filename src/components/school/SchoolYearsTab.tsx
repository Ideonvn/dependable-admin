'use client';

import { useState, useEffect } from 'react';
import { Calendar, Search, Plus, Edit, Trash2 } from 'lucide-react';
import { schoolsApi, SchoolYear } from '@/lib/schools';
import CreateSchoolYearModal from '@/components/CreateSchoolYearModal';
import EditSchoolYearModal from '@/components/EditSchoolYearModal';
import AlertDialog from '@/components/AlertDialog';

interface SchoolYearsTabProps {
  schoolId: string;
}

export default function SchoolYearsTab({ schoolId }: SchoolYearsTabProps) {
  const [loading, setLoading] = useState(true);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<SchoolYear | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [yearToDelete, setYearToDelete] = useState<SchoolYear | null>(null);

  useEffect(() => {
    loadSchoolYears();
  }, [schoolId]);

  const loadSchoolYears = async () => {
    setLoading(true);
    try {
      const data = await schoolsApi.getSchoolYears(schoolId);
      setSchoolYears(data);
    } catch (error) {
      console.error('Error loading school years:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredYears = schoolYears.filter((year) =>
    year.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteClick = (year: SchoolYear) => {
    setYearToDelete(year);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    // Delete functionality would go here when backend endpoint is ready
    setDeleteConfirmOpen(false);
    setYearToDelete(null);
  };

  const calculateWeekdays = (startDate: Date, endDate: Date): number => {
    let weekdayCount = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        weekdayCount++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return weekdayCount;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-[#1A1A6D] dark:text-[#20B2AA]" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">School Years</h3>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Add Year
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search school years..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredYears.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{searchQuery ? 'No school years found matching your search' : 'No school years yet'}</p>
          <p className="text-sm mt-2">{searchQuery ? 'Try a different search term' : 'Add school years to get started'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Year</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Starts</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Ends</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Duration</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Weekdays</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredYears.map((year) => {
                const startDate = new Date(year.starts_on);
                const endDate = new Date(year.ends_on);
                const durationDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                const weekdays = calculateWeekdays(startDate, endDate);

                return (
                  <tr
                    key={year.id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] flex items-center justify-center text-white font-semibold">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {year.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {startDate.toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {endDate.toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {durationDays} days
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {weekdays} days
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedYear(year);
                            setEditModalOpen(true);
                            setIsEditModalOpen(true);
                          }}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                          title="Edit year"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {/* TODO: Create backend endpoint */}
                        {/* <button
                          onClick={() => handleDeleteClick(year)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Delete year"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button> */}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create School Year Modal */}
      <CreateSchoolYearModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadSchoolYears}
        schoolId={schoolId}
      />

      {/* Edit School Year Modal */}
      {selectedYear && (
        <EditSchoolYearModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedYear(null);
          }}
          onSuccess={() => {
            loadSchoolYears();
            setIsEditModalOpen(false);
            setSelectedYear(null);
          }}
          schoolId={schoolId}
          year={selectedYear}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setYearToDelete(null);
        }}
        title="Delete School Year?"
        message={`Are you sure you want to delete the school year "${yearToDelete?.name}"? This action cannot be undone.`}
        variant="error"
        buttonText="Delete"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
