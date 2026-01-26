'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle, Upload, Trash2, Plus } from 'lucide-react';
import { schoolsApi, Classroom, Membership } from '@/lib/schools';

interface EditClassroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schoolId: string;
  classroom: Classroom;
}

export default function EditClassroomModal({
  isOpen,
  onClose,
  onSuccess,
  schoolId,
  classroom: initialClassroom,
}: EditClassroomModalProps) {
  const [classroom, setClassroom] = useState<Classroom>(initialClassroom);
  const [name, setName] = useState(initialClassroom.name);
  const [primaryTeacherId, setPrimaryTeacherId] = useState<string | null>(initialClassroom.primary_teacher_id);
  const [isActive, setIsActive] = useState(initialClassroom.is_active);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [teachers, setTeachers] = useState<Membership[]>([]);
  const [allTeachers, setAllTeachers] = useState<Membership[]>([]);
  const [classroomTeachers, setClassroomTeachers] = useState<Membership[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load all teachers in the school
      const memberships = await schoolsApi.getMemberships(schoolId);
      const teachersOnly = memberships.filter(m => m.role === 'TEACHER' && m.status === 'active');
      setAllTeachers(teachersOnly);

      // Load teachers assigned to this classroom
      const assignedTeachers = await schoolsApi.getClassroomTeachers(schoolId, classroom.id);
      setClassroomTeachers(assignedTeachers);
      setTeachers(assignedTeachers);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load classroom data');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleAddTeacher = async () => {
    if (!selectedTeacherId) return;

    setSubmitting(true);
    try {
      await schoolsApi.assignTeacherToClassroom(schoolId, classroom.id, selectedTeacherId);
      
      // Reload classroom teachers
      const updatedTeachers = await schoolsApi.getClassroomTeachers(schoolId, classroom.id);
      setClassroomTeachers(updatedTeachers);
      setTeachers(updatedTeachers);
      setSelectedTeacherId('');
    } catch (err) {
      setError('Failed to assign teacher');
      console.error('Error assigning teacher:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveTeacher = async (teacherId: string) => {
    setSubmitting(true);
    try {
      await schoolsApi.unassignTeacherFromClassroom(schoolId, classroom.id, teacherId);
      
      // Reload classroom teachers
      const updatedTeachers = await schoolsApi.getClassroomTeachers(schoolId, classroom.id);
      setClassroomTeachers(updatedTeachers);
      setTeachers(updatedTeachers);
    } catch (err) {
      setError('Failed to remove teacher');
      console.error('Error removing teacher:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!name.trim()) {
        setError('Classroom name is required');
        setSubmitting(false);
        return;
      }

      // Update classroom details
      await schoolsApi.updateClassroom(schoolId, classroom.id, {
        name: name.trim(),
        primary_teacher_id: primaryTeacherId,
        is_active: isActive,
      });

      // Upload image if selected
      if (imageFile) {
        await schoolsApi.uploadClassroomImage(schoolId, classroom.id, imageFile);
      }

      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update classroom';
      setError(errorMessage);
      console.error('Error updating classroom:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Get available teachers (exclude already assigned ones)
  const availableTeachers = allTeachers.filter(
    t => !classroomTeachers.find(ct => ct.user_id === t.user_id)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-2xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Edit Classroom</h2>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Section 1: Basic Details */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Classroom Details</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Grade 1A"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    disabled={submitting}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={submitting}
                    className="rounded"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Active Classroom
                  </label>
                </div>
              </div>

              {/* Section 2: Classroom Image */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Classroom Image</h3>
                
                <div className="flex gap-6">
                  <div className="w-32 h-32 rounded-lg bg-gradient-to-br from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] flex items-center justify-center text-white flex-shrink-0 overflow-hidden">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : classroom.image_filename ? (
                      <img
                        src={`${process.env.NEXT_PUBLIC_API_URL}/files/${classroom.image_filename}`}
                        alt={classroom.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl">📚</span>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col gap-3">
                    <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors disabled:opacity-50">
                      <Upload className="w-4 h-4" />
                      <span className="text-sm font-medium">Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        disabled={submitting}
                        className="hidden"
                      />
                    </label>

                    {(imageFile || classroom.image_filename) && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        disabled={submitting}
                        className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg text-red-700 dark:text-red-400 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Remove Image</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Primary Teacher */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Primary Teacher</h3>
                
                <select
                  value={primaryTeacherId || ''}
                  onChange={(e) => setPrimaryTeacherId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  disabled={submitting}
                >
                  <option value="">No Primary Teacher</option>
                  {allTeachers.map(teacher => (
                    <option key={teacher.user_id} value={teacher.user_id}>
                      {teacher.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section 4: Assigned Teachers */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Assigned Teachers</h3>
                
                {/* Add Teacher */}
                <div className="flex gap-2">
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    disabled={submitting || availableTeachers.length === 0}
                  >
                    <option value="">Select a teacher to add...</option>
                    {availableTeachers.map(teacher => (
                      <option key={teacher.user_id} value={teacher.user_id}>
                        {teacher.full_name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddTeacher}
                    disabled={submitting || !selectedTeacherId || availableTeachers.length === 0}
                    className="px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>

                {/* Teachers List */}
                {classroomTeachers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Role</th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classroomTeachers.map((teacher) => (
                          <tr key={teacher.user_id} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2 px-3 text-gray-900 dark:text-gray-100">{teacher.full_name}</td>
                            <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{teacher.role}</td>
                            <td className="py-2 px-3">
                              <button
                                type="button"
                                onClick={() => handleRemoveTeacher(teacher.user_id)}
                                disabled={submitting}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                    No teachers assigned to this classroom yet
                  </p>
                )}
              </div>
            </>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loading}
              className="px-6 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
