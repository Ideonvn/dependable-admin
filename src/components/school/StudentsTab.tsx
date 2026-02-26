'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Search, Plus, User } from 'lucide-react';
import { schoolsApi, Student } from '@/lib/schools';
import EnrollStudentModal from '@/components/EnrollStudentModal';
import StudentProfileImage from '@/components/StudentProfileImage';

interface StudentsTabProps {
  schoolId: string;
}

export default function StudentsTab({ schoolId }: StudentsTabProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);

  useEffect(() => {
    loadStudents();
  }, [schoolId]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const data = await schoolsApi.getStudents(schoolId);
      setStudents(data);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter students based on search query
  const filteredStudents = students.filter((student) =>
    student.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPresenceStatusColor = (status: Student['presence_status']) => {
    switch (status) {
      case 'in':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'out':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
    }
  };

  const getPresenceStatusLabel = (status: Student['presence_status']) => {
    switch (status) {
      case 'in':
        return 'Checked In';
      case 'out':
        return 'Checked Out';
      default:
        return 'Unknown';
    }
  };

  const getEnrollmentStatusColor = (status: Student['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'left':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      case 'graduated':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
    }
  };

  const getEnrollmentStatusLabel = (status: Student['status']) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'left':
        return 'Left';
      case 'graduated':
        return 'Graduated';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-[#1A1A6D] dark:text-[#20B2AA]" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Students</h3>
        </div>
        <button 
          onClick={() => setIsEnrollModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Add Student
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search students..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{searchQuery ? 'No students found matching your search' : 'No students yet'}</p>
          <p className="text-sm mt-2">{searchQuery ? 'Try a different search term' : 'Add students to get started'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Student</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Gender</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Enrollment Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Admitted On</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Presence Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr
                  key={student.id}
                  onClick={() => router.push(`/schools/${schoolId}/students/${student.id}`)}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  title="View & manage student"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] flex items-center justify-center text-white font-semibold overflow-hidden">
                        <StudentProfileImage
                          schoolId={schoolId}
                          studentId={student.id}
                          imageFilename={student.image_filename}
                          alt={student.full_name}
                          className="w-full h-full object-cover"
                          fallbackClassName="w-full h-full rounded-full bg-gradient-to-br from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] flex items-center justify-center"
                        />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {student.full_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {student.dependant_id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                    {student.gender.charAt(0) + student.gender.slice(1).toLowerCase()}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEnrollmentStatusColor(student.status)}`}>
                      {getEnrollmentStatusLabel(student.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                    {student.admitted_on ? new Date(student.admitted_on).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPresenceStatusColor(student.presence_status)}`}>
                      {getPresenceStatusLabel(student.presence_status)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                    {student.last_checkin_at
                      ? new Date(student.last_checkin_at).toLocaleDateString()
                      : student.last_checkout_at
                      ? new Date(student.last_checkout_at).toLocaleDateString()
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Enroll Student Modal */}
      <EnrollStudentModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        onSuccess={loadStudents}
        schoolId={schoolId}
      />
    </div>
  );
}
