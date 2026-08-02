'use client';

import { useState, useEffect } from 'react';
import { School, schoolsApi } from '@/lib/schools';
import { Camera, Save } from 'lucide-react';
import SchoolProfileImage from '@/components/SchoolProfileImage';
import SchoolStatusBadge from '@/components/SchoolStatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import { SchoolStatus, SCHOOL_STATUSES, SCHOOL_STATUS_META, billingStateText } from '@/lib/schoolStatus';
import { billingApi } from '@/lib/billing';
import { userSetupService } from '@/lib/userSetupService';

interface SchoolDetailsTabProps {
  school: School;
  onUpdate: () => void;
}

export default function SchoolDetailsTab({ school, onUpdate }: SchoolDetailsTabProps) {
  const isAdmin = userSetupService.isAdmin();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(school.name);
  const [saving, setSaving] = useState(false);
  const [generateInvoices, setGenerateInvoices] = useState<boolean | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<SchoolStatus | null>(null);

  // Fetch the billing flag so we can show the combined billing state next to the status control.
  useEffect(() => {
    if (!isAdmin) return;
    billingApi
      .getBillingConfig(school.id)
      .then((c) => setGenerateInvoices(c.generate_invoices))
      .catch(() => setGenerateInvoices(null));
  }, [isAdmin, school.id]);

  const applyStatus = async (status: SchoolStatus) => {
    setSavingStatus(true);
    try {
      await schoolsApi.updateSchoolStatus(school.id, status);
      onUpdate();
    } catch (error) {
      console.error('Error updating school status:', error);
      alert('Failed to update school status. Please try again.');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleStatusChange = (next: SchoolStatus) => {
    if (next === school.status) return;
    // Moving a school out of active stops automatic invoicing — confirm first.
    if (school.status === 'active') {
      setPendingStatus(next);
      return;
    }
    applyStatus(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await schoolsApi.updateSchool(school.id, { name });
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error saving school details:', error);
      alert('Failed to update school name. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await schoolsApi.uploadSchoolImage(school.id, file);
      onUpdate();
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* School Image Section */}
      <div className="flex items-start gap-6">
        <div className="relative flex-shrink-0">
          <SchoolProfileImage
            schoolId={school.id}
            imageFilename={school.image_filename}
            alt={school.name}
            className="w-32 h-32 rounded-2xl object-cover border-4 border-gray-200 dark:border-gray-700"
            fallbackClassName="w-32 h-32 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center border-4 border-gray-200 dark:border-gray-700"
          />
          <label
            htmlFor="school-image-upload"
            className="absolute bottom-0 right-0 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white p-2 rounded-full cursor-pointer hover:opacity-90 transition-opacity shadow-lg"
          >
            <Camera className="w-4 h-4" />
            <input
              id="school-image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">School Profile</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Update the school&apos;s name and profile picture
          </p>
        </div>
      </div>

      {/* School Name Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="flex items-center justify-between mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            School Name
          </label>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-[#1A1A6D] dark:text-[#20B2AA] hover:underline"
            >
              Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="flex gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Enter school name"
            />
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
            <button
              onClick={() => {
                setName(school.name);
                setIsEditing(false);
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {school.name}
          </div>
        )}
      </div>

      {/* School Status (platform-admin only — controls automatic billing) */}
      {isAdmin && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="flex items-center gap-3 mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              School Status
            </label>
            <SchoolStatusBadge status={school.status} />
          </div>

          <select
            value={school.status}
            onChange={(e) => handleStatusChange(e.target.value as SchoolStatus)}
            disabled={savingStatus}
            className="w-full max-w-xs px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-60"
          >
            {SCHOOL_STATUSES.map((s) => (
              <option key={s} value={s}>{SCHOOL_STATUS_META[s].label}</option>
            ))}
          </select>

          {generateInvoices !== null && (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              {billingStateText(school.status, generateInvoices)}
            </p>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingStatus !== null}
        onClose={() => setPendingStatus(null)}
        onConfirm={() => {
          if (pendingStatus) applyStatus(pendingStatus);
        }}
        title="Change school status"
        message="Moving this school out of Active will stop automatic invoicing. Are you sure you want to continue?"
        confirmText="Change status"
        variant="warning"
      />

      {/* School Statistics Overview */}
      {/* <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Students</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {school.students_overview.status.active}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Checked In</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {school.students_overview.presence_status.checked_in}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Absent Today</div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {school.students_overview.presence_status.absent}
            </div>
          </div>
        </div>
      </div> */}
    </div>
  );
}
