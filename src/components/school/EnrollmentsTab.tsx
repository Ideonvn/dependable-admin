'use client';

import { useState, useEffect } from 'react';
import { ClipboardCheck, Search, Save, User, Calendar, AlertCircle } from 'lucide-react';
import { schoolsApi, EnrolledStudent } from '@/lib/schools';

interface EnrollmentsTabProps {
  schoolId: string;
}

interface StudentEnrollment {
  student_id: string;
  full_name: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  classroom_id: string | null;
  started_at: string | null;
  ended_at: string | null;
}

interface Classroom {
  id: string;
  name: string;
  student_count: number;
}

export default function EnrollmentsTab({ schoolId }: EnrollmentsTabProps) {
  const [loading, setLoading] = useState(true);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [originalClassrooms, setOriginalClassrooms] = useState<Map<string, string | null>>(new Map());
  const [changes, setChanges] = useState<Map<string, string | null>>(new Map());
  const [draggedStudents, setDraggedStudents] = useState<Set<string>>(new Set());
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; title?: string; message: string; variant?: 'success' | 'error' | 'info' }[]>([]);

  const addToast = (toast: { title?: string; message: string; variant?: 'success' | 'error' | 'info' }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((t) => [...t, { id, ...toast }]);
    // auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  };

  useEffect(() => {
    loadData();
  }, [schoolId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch enrollments
      const enrollmentsData = await schoolsApi.getEnrollments(schoolId);
      
      // Build classrooms list
      const classroomsList: Classroom[] = enrollmentsData.classrooms.map(c => ({
        id: c.id,
        name: c.name,
        student_count: c.students.length
      }));
      setClassrooms(classroomsList);

      // Build enrollments list - students in classrooms
      const enrollmentsList: StudentEnrollment[] = [];
      
      enrollmentsData.classrooms.forEach(classroom => {
        classroom.students.forEach(student => {
          enrollmentsList.push({
            student_id: student.student_id,
            full_name: student.full_name,
            gender: student.gender,
            classroom_id: classroom.id,
            started_at: student.started_at,
            ended_at: student.ended_at
          });
        });
      });
      
      // Add unassigned students
      enrollmentsData.unassigned_students.forEach(student => {
        enrollmentsList.push({
          student_id: student.student_id,
          full_name: student.full_name,
          gender: student.gender,
          classroom_id: null,
          started_at: student.started_at,
          ended_at: student.ended_at
        });
      });

      setEnrollments(enrollmentsList);
      
      // Store original classroom assignments
      const originalMap = new Map<string, string | null>();
      enrollmentsList.forEach(enrollment => {
        originalMap.set(enrollment.student_id, enrollment.classroom_id);
      });
      setOriginalClassrooms(originalMap);
      setChanges(new Map()); // Clear any existing changes
    } catch (error) {
      console.error('Error loading enrollments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, studentId: string) => {
    // If student is selected, drag all selected students
    if (selectedStudents.has(studentId)) {
      setDraggedStudents(new Set(selectedStudents));
      e.dataTransfer.setData('studentIds', JSON.stringify(Array.from(selectedStudents)));
    } else {
      setDraggedStudents(new Set([studentId]));
      e.dataTransfer.setData('studentIds', JSON.stringify([studentId]));
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetClassroomId: string | null) => {
    e.preventDefault();
    const studentIdsJson = e.dataTransfer.getData('studentIds');
    const studentIds: string[] = JSON.parse(studentIdsJson);

    // Update enrollments
    const newEnrollments = enrollments.map(enrollment => {
      if (studentIds.includes(enrollment.student_id)) {
        return {
          ...enrollment,
          classroom_id: targetClassroomId
        };
      }
      return enrollment;
    });

    // Update changes map - compare against original classroom
    const newChanges = new Map(changes);
    studentIds.forEach(studentId => {
      const originalClassroom = originalClassrooms.get(studentId);
      
      // If student is back to original classroom, remove from changes
      if (originalClassroom === targetClassroomId) {
        newChanges.delete(studentId);
      } else {
        // Otherwise, track the change
        newChanges.set(studentId, targetClassroomId);
      }
    });

    setEnrollments(newEnrollments);
    setChanges(newChanges);
    setDraggedStudents(new Set());
    setSelectedStudents(new Set());
  };

  const toggleStudentSelection = (studentId: string) => {
    const newSelection = new Set(selectedStudents);
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      newSelection.add(studentId);
    }
    setSelectedStudents(newSelection);
  };

  const handleUndo = () => {
    // Reset enrollments back to original state
    const resetEnrollments = enrollments.map(enrollment => ({
      ...enrollment,
      classroom_id: originalClassrooms.get(enrollment.student_id) ?? null
    }));
    setEnrollments(resetEnrollments);
    setChanges(new Map());
    setSelectedStudents(new Set());
  };

  const handleSave = async () => {
    if (changes.size === 0) return;
    
    setSaving(true);
    try {
      // Build the payload: array of {student_id, classroom_id}
      const updates = Array.from(changes.entries()).map(([studentId, classroomId]) => ({
        student_id: studentId,
        classroom_id: classroomId
      }));
      
      // Format date as YYYY-MM-DD
      const today = new Date();
      const starts_on = today.toISOString().split('T')[0];
      
      const response = await schoolsApi.updateEnrollments(schoolId, {
        starts_on,
        ends_on: null,
        enrollments: updates
      });
      
      // Refresh data from response to ensure we're in sync with server
      const enrollmentsList: StudentEnrollment[] = [];
      
      response.classrooms.forEach(classroom => {
        classroom.students.forEach(student => {
          enrollmentsList.push({
            student_id: student.student_id,
            full_name: student.full_name,
            gender: student.gender,
            classroom_id: classroom.id,
            started_at: student.started_at,
            ended_at: student.ended_at
          });
        });
      });
      
      response.unassigned_students.forEach(student => {
        enrollmentsList.push({
          student_id: student.student_id,
          full_name: student.full_name,
          gender: student.gender,
          classroom_id: null,
          started_at: student.started_at,
          ended_at: student.ended_at
        });
      });
      
      setEnrollments(enrollmentsList);
      
      // Update original classrooms to reflect saved state
      const newOriginalClassrooms = new Map<string, string | null>();
      enrollmentsList.forEach(enrollment => {
        newOriginalClassrooms.set(enrollment.student_id, enrollment.classroom_id);
      });
      setOriginalClassrooms(newOriginalClassrooms);
      setChanges(new Map());
      
      addToast({ title: 'Success', message: 'Enrollments saved successfully!', variant: 'success' });
    } catch (error) {
      console.error('Error saving enrollments:', error);
      addToast({ title: 'Error', message: 'Failed to save enrollments. Please try again.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const getStudentsForClassroom = (classroomId: string | null) => {
    return enrollments.filter(a => {
      const matchesClassroom = a.classroom_id === classroomId;
      const matchesSearch = searchQuery === '' || 
        a.full_name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesClassroom && matchesSearch;
    });
  };

  const unassignedStudents = getStudentsForClassroom(null);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="w-6 h-6 text-[#1A1A6D] dark:text-[#20B2AA]" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Classroom Enrollments</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Drag students between classrooms to manage enrollments</p>
          </div>
        </div>
        {changes.size > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Undo Changes
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes ({changes.size})
                </>
              )}
            </button>
          </div>
        )}
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

      {/* Info Banner */}
      <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Tip:</strong> Click to select students (Ctrl/Cmd + Click for multiple), then drag them to a different classroom. 
          Changes are only saved when you click the &quot;Save Changes&quot; button.
        </div>
      </div>

      {/* Classrooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 mb-6">

        {/* Classroom Columns */}
        {classrooms.map((classroom) => {
          const studentsInClassroom = getStudentsForClassroom(classroom.id);
          return (
            <div
              key={classroom.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, classroom.id)}
              className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4 min-h-[500px] max-h-[700px] hover:border-[#1A1A6D] dark:hover:border-[#20B2AA] transition-colors flex flex-col"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">{classroom.name}</h4>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 px-2 py-0.5 rounded">{studentsInClassroom.length}</span>
              </div>
              <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                {studentsInClassroom.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                    <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No students assigned</p>
                  </div>
                ) : (
                  studentsInClassroom.map((enrollment) => (
                    <StudentCard
                      key={enrollment.student_id}
                      enrollment={enrollment}
                      isSelected={selectedStudents.has(enrollment.student_id)}
                      isDragging={draggedStudents.has(enrollment.student_id)}
                      isChanged={changes.has(enrollment.student_id)}
                      onDragStart={handleDragStart}
                      onSelect={toggleStudentSelection}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}

        {/* Unassigned Students */}
        <div
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, null)}
          className="bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-4 min-h-[500px] max-h-[700px] flex flex-col"
        >
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-300 dark:border-gray-700">
            <h4 className="font-semibold text-gray-700 dark:text-gray-300">Unassigned</h4>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded">{unassignedStudents.length}</span>
          </div>
          <div className="space-y-2 overflow-y-auto flex-1 pr-2">
            {unassignedStudents.length === 0 ? (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No unassigned students</p>
              </div>
            ) : (
              unassignedStudents.map((enrollment) => (
                <StudentCard
                  key={enrollment.student_id}
                  enrollment={enrollment}
                  isSelected={selectedStudents.has(enrollment.student_id)}
                  isDragging={draggedStudents.has(enrollment.student_id)}
                  isChanged={changes.has(enrollment.student_id)}
                  onDragStart={handleDragStart}
                  onSelect={toggleStudentSelection}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-sm w-full px-4 py-3 rounded-lg shadow-lg border transition-opacity bg-white dark:bg-[#111217] border-gray-200 dark:border-gray-800 ${
              t.variant === 'success' ? 'ring-2 ring-green-500 dark:ring-green-400' : 
              t.variant === 'error' ? 'ring-2 ring-red-500 dark:ring-red-400' : 
              'ring-1 ring-gray-200 dark:ring-gray-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                {t.title && <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.title}</div>}
                <div className="text-sm text-gray-700 dark:text-gray-300">{t.message}</div>
              </div>
              <button onClick={() => setToasts((s) => s.filter(x => x.id !== t.id))} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface StudentCardProps {
  enrollment: StudentEnrollment;
  isSelected: boolean;
  isDragging: boolean;
  isChanged: boolean;
  onDragStart: (e: React.DragEvent, studentId: string) => void;
  onSelect: (studentId: string) => void;
}

function StudentCard({ enrollment, isSelected, isDragging, isChanged, onDragStart, onSelect }: StudentCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, enrollment.student_id)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(enrollment.student_id);
      }}
      className={`
        p-3 rounded-lg cursor-move transition-all
        ${isChanged ? 'border-l-4' : 'border'}
        ${isSelected 
          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 ring-2 ring-blue-200 dark:ring-blue-700' 
          : isChanged
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-500 hover:border-amber-500 dark:hover:border-amber-400'
            : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
        }
        ${isDragging ? 'opacity-50' : 'opacity-100'}
      `}
    >
      <div className="flex items-start gap-2">
        <User className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className={`text-sm text-gray-900 dark:text-gray-100 truncate ${isChanged ? 'font-bold' : 'font-medium'}`}>
            {enrollment.full_name}
          </div>
          {enrollment.started_at && (
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-1">
              <Calendar className="w-3 h-3" />
              <span>
                {new Date(enrollment.started_at).toLocaleDateString()}
                {enrollment.ended_at && ` - ${new Date(enrollment.ended_at).toLocaleDateString()}`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
