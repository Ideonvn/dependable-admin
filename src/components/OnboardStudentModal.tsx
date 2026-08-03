'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import axios from 'axios';
import posthog from 'posthog-js';
import { schoolsApi, Classroom, StudentGender } from '@/lib/schools';

interface OnboardStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (primaryEmail: string) => void;
  schoolId: string;
}

interface FormData {
  classroomId: string;
  firstName: string;
  lastName: string;
  gender: '' | Exclude<StudentGender, null>;
  dateOfBirth: string;
  primaryName: string;
  primaryEmail: string;
}

const emptyForm: FormData = {
  classroomId: '',
  firstName: '',
  lastName: '',
  gender: '',
  dateOfBirth: '',
  primaryName: '',
  primaryEmail: '',
};

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function OnboardStudentModal({
  isOpen,
  onClose,
  onSuccess,
  schoolId,
}: OnboardStudentModalProps) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (isOpen) {
      setFormData(emptyForm);
      setError(null);
      loadClassrooms();
    }
  }, [isOpen]);

  const loadClassrooms = async () => {
    setLoading(true);
    try {
      const data = await schoolsApi.getClassrooms(schoolId);
      setClassrooms(data);
      if (data.length > 0) {
        setFormData((prev) => ({ ...prev, classroomId: data[0].id }));
      }
    } catch (err) {
      console.error('Error loading classrooms:', err);
      setError('Failed to load classrooms');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const firstName = formData.firstName.trim();
    const lastName = formData.lastName.trim();
    const primaryName = formData.primaryName.trim();
    const primaryEmail = formData.primaryEmail.trim();

    if (!formData.classroomId || !firstName || !lastName || !primaryName || !primaryEmail) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!isValidEmail(primaryEmail)) {
      setError('Please enter a valid parent email address.');
      return;
    }
    if (formData.dateOfBirth && formData.dateOfBirth > today) {
      setError('Date of birth cannot be in the future.');
      return;
    }

    setSubmitting(true);
    try {
      await schoolsApi.onboardStudent(schoolId, formData.classroomId, {
        first_name: firstName,
        last_name: lastName,
        gender: formData.gender === '' ? null : formData.gender,
        date_of_birth: formData.dateOfBirth || null,
        primary_name: primaryName,
        primary_email: primaryEmail,
      });

      posthog.capture('student_onboarded', { school_id: schoolId });
      onSuccess(primaryEmail);
      onClose();
    } catch (err) {
      const friendly = axios.isAxiosError(err)
        ? err.response?.data?.error?.friendly_message
        : undefined;
      setError(friendly || 'Failed to onboard student. Please try again.');
      console.error('Error onboarding student:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-2xl w-full my-8">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Onboard Student</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              We&apos;ll email the parent a link to complete their child&apos;s details.
            </p>
          </div>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Classroom <span className="text-red-500">*</span>
                </label>
                <select
                  name="classroomId"
                  value={formData.classroomId}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={submitting || classrooms.length === 0}
                >
                  <option value="">Select a classroom...</option>
                  {classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="e.g., Amara"
                  className={inputClass}
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
                  placeholder="e.g., Nkosi"
                  className={inputClass}
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Gender
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={submitting}
                >
                  <option value="">Unknown</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  max={today}
                  className={inputClass}
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Primary Parent Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="primaryName"
                  value={formData.primaryName}
                  onChange={handleChange}
                  placeholder="e.g., Thandi Nkosi"
                  className={inputClass}
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Primary Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="primaryEmail"
                  value={formData.primaryEmail}
                  onChange={handleChange}
                  placeholder="e.g., parent@example.com"
                  className={inputClass}
                  disabled={submitting}
                />
              </div>
            </div>
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
                  Onboarding...
                </>
              ) : (
                'Onboard'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
