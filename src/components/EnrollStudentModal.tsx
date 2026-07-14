'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import posthog from 'posthog-js';
import { schoolsApi, Classroom } from '@/lib/schools';

interface EnrollStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schoolId: string;
}

interface FormData {
  // Student details
  externalRef: string;
  admittedOn: string;
  classroomId: string;
  
  // Dependant details
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth: string;
  weightAtBirth: number | undefined;
  lengthAtBirth: number | undefined;
  
  // Student contact details
  contactEmail: string;
  contactFirstName: string;
  contactLastName: string;
  contactRole: string;
}

export default function EnrollStudentModal({
  isOpen,
  onClose,
  onSuccess,
  schoolId,
}: EnrollStudentModalProps) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    externalRef: '',
    admittedOn: new Date().toISOString().split('T')[0],
    classroomId: '',
    firstName: '',
    lastName: '',
    gender: 'MALE',
    dateOfBirth: '',
    weightAtBirth: undefined,
    lengthAtBirth: undefined,
    contactEmail: '',
    contactFirstName: '',
    contactLastName: '',
    contactRole: 'FATHER',
  });

  useEffect(() => {
    if (isOpen) {
      loadClassrooms();
    }
  }, [isOpen]);

  const loadClassrooms = async () => {
    setLoading(true);
    try {
      const data = await schoolsApi.getClassrooms(schoolId);
      setClassrooms(data);
      // Auto-select first classroom if available
      if (data.length > 0) {
        setFormData(prev => ({ ...prev, classroomId: data[0].id }));
      }
    } catch (err) {
      console.error('Error loading classrooms:', err);
      setError('Failed to load classrooms');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value ? parseFloat(value) : undefined
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Validate required fields
      if (!formData.classroomId || !formData.firstName ||
          !formData.lastName || !formData.dateOfBirth || !formData.contactEmail ||
          !formData.contactFirstName || !formData.contactLastName ||
          formData.weightAtBirth === undefined || formData.lengthAtBirth === undefined) {
        setError('Please fill in all required fields');
        setSubmitting(false);
        return;
      }

      await schoolsApi.enrollStudent(schoolId, formData.classroomId, {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        gender: formData.gender,
        date_of_birth: formData.dateOfBirth,
        weight_at_birth: formData.weightAtBirth || null,
        length_at_birth: formData.lengthAtBirth || null,
        student: {
          external_ref: formData.externalRef.trim(),
          admitted_on: formData.admittedOn,
        },
        student_contact: {
          email: formData.contactEmail.trim(),
          first_name: formData.contactFirstName.trim(),
          last_name: formData.contactLastName.trim(),
          role: formData.contactRole,
          primary: true,
          can_check_in_out: true,
          can_view_records: true,
          can_receive_notifications: true,
          id_country: null,
          id_type: null,
          id_full: null,
        },
      });

      setError(null);
      setFormData({
        externalRef: '',
        admittedOn: new Date().toISOString().split('T')[0],
        classroomId: classrooms.length > 0 ? classrooms[0].id : '',
        firstName: '',
        lastName: '',
        gender: 'MALE',
        dateOfBirth: '',
        weightAtBirth: undefined,
        lengthAtBirth: undefined,
        contactEmail: '',
        contactFirstName: '',
        contactLastName: '',
        contactRole: 'FATHER',
      });
      posthog.capture('student_enrolled', { school_id: schoolId });
      onSuccess();
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enroll student';
      setError(errorMessage);
      console.error('Error enrolling student:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-2xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Enroll New Student</h2>
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
              {/* Section 1: Student Details */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Student Details</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Student ID
                    </label>
                    <input
                      type="text"
                      name="externalRef"
                      value={formData.externalRef}
                      onChange={handleChange}
                      placeholder="e.g., STU-2024-001"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Admitted Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="admittedOn"
                      value={formData.admittedOn}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      disabled={submitting}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Classroom <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="classroomId"
                      value={formData.classroomId}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      disabled={submitting || classrooms.length === 0}
                    >
                      <option value="">Select a classroom...</option>
                      {classrooms.map(classroom => (
                        <option key={classroom.id} value={classroom.id}>
                          {classroom.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Dependant Details */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Dependant Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="e.g., John"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="e.g., Doe"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Gender <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      disabled={submitting}
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date of Birth <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Weight at Birth (grams) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="weightAtBirth"
                      value={formData.weightAtBirth ?? ''}
                      onChange={handleNumberChange}
                      placeholder="e.g., 3400"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Length at Birth (millimeters) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="lengthAtBirth"
                      value={formData.lengthAtBirth ?? ''}
                      onChange={handleNumberChange}
                      placeholder="e.g., 520"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Student Contact Details */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Primary Contact Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="contactEmail"
                      value={formData.contactEmail}
                      onChange={handleChange}
                      placeholder="e.g., parent@example.com"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="contactFirstName"
                      value={formData.contactFirstName}
                      onChange={handleChange}
                      placeholder="e.g., Sarah"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="contactLastName"
                      value={formData.contactLastName}
                      onChange={handleChange}
                      placeholder="e.g., Johnson"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="contactRole"
                      value={formData.contactRole}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      disabled={submitting}
                    >
                      <option value="FATHER">Father</option>
                      <option value="MOTHER">Mother</option>
                      <option value="GUARDIAN">Guardian</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>
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
                  Enrolling...
                </>
              ) : (
                'Enroll Student'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
