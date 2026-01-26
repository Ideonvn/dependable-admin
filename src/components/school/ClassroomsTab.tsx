'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Search, Plus, Users, Edit } from 'lucide-react';
import { schoolsApi, Classroom } from '@/lib/schools';
import EditClassroomModal from '@/components/EditClassroomModal';
import CreateClassroomModal from '@/components/CreateClassroomModal';
import ClassroomProfileImage from '@/components/ClassroomProfileImage';

interface ClassroomsTabProps {
  schoolId: string;
}

export default function ClassroomsTab({ schoolId }: ClassroomsTabProps) {
  const [loading, setLoading] = useState(true);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    loadClassrooms();
  }, [schoolId]);

  const loadClassrooms = async () => {
    setLoading(true);
    try {
      const data = await schoolsApi.getClassrooms(schoolId);
      setClassrooms(data);
    } catch (error) {
      console.error('Error loading classrooms:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter classrooms based on search query
  const filteredClassrooms = classrooms.filter((classroom) =>
    classroom.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-[#1A1A6D] dark:text-[#20B2AA]" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Classrooms</h3>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          Add Classroom
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search classrooms..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredClassrooms.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{searchQuery ? 'No classrooms found matching your search' : 'No classrooms yet'}</p>
          <p className="text-sm mt-2">{searchQuery ? 'Try a different search term' : 'Add classrooms to get started'}</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {filteredClassrooms.map((classroom) => (
            <div
              key={classroom.id}
              className="w-[350px] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => {
                setSelectedClassroom(classroom);
                setIsEditModalOpen(true);
              }}
            >
              {/* Classroom Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] flex items-center justify-center text-white flex-shrink-0 overflow-hidden">
                    <ClassroomProfileImage
                      schoolId={schoolId}
                      classroomId={classroom.id}
                      imageFilename={classroom.image_filename}
                      alt={classroom.name}
                      className="w-full h-full object-cover"
                      fallbackClassName="w-full h-full rounded-lg bg-gradient-to-br from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] flex items-center justify-center"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {classroom.name}
                    </h4>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                      classroom.is_active
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                    }`}>
                      {classroom.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedClassroom(classroom);
                    setIsEditModalOpen(true);
                  }}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                  title="Edit classroom"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>

              {/* Student Stats */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Enrolled</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {classroom.students_overview.status.enrolled}
                  </span>
                </div>

                {/* Presence Status */}
                <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex-1 text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">In</div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">
                      {classroom.students_overview.presence_status.checked_in}
                    </div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Out</div>
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {classroom.students_overview.presence_status.checked_out}
                    </div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Absent</div>
                    <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {classroom.students_overview.presence_status.absent}
                    </div>
                  </div>
                </div>

                {/* Body Check */}
                <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Checked</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {classroom.students_overview.body_check.checked}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Markers</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {classroom.students_overview.body_check.markers}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Classroom Modal */}
      {selectedClassroom && (
        <EditClassroomModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedClassroom(null);
          }}
          onSuccess={() => {
            loadClassrooms();
            setIsEditModalOpen(false);
            setSelectedClassroom(null);
          }}
          schoolId={schoolId}
          classroom={selectedClassroom}
        />
      )}

      {/* Create Classroom Modal */}
      <CreateClassroomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          loadClassrooms();
          setIsCreateModalOpen(false);
        }}
        schoolId={schoolId}
      />
    </div>
  );
}
