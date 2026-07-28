'use client';

import { useState, useEffect, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Send, Upload as UploadIcon, ArrowLeft, RefreshCw, Users, CheckCircle, Clock, Calendar } from 'lucide-react';
import {
  schoolOnboardingApi,
  SchoolOnboarding,
  SchoolOnboardingRecord,
  ClassSummary,
} from '@/lib/schoolOnboarding';
import posthog from 'posthog-js';
import { onboardingApi, SchoolWithStats } from '@/lib/schools';
import EditableTable from '@/components/EditableTable';
import ClassSummaryTable from '@/components/ClassSummaryTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import AlertDialog from '@/components/AlertDialog';
import SchoolProfileImage from '@/components/SchoolProfileImage';
import { userSetupService } from '@/lib/userSetupService';

export default function OnboardingEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    if (!userSetupService.isAdmin()) {
      router.replace('/');
    }
  }, [router]);
  const [school, setSchool] = useState<SchoolWithStats | null>(null);
  const [onboarding, setOnboarding] = useState<SchoolOnboarding | null>(null);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newRecordId, setNewRecordId] = useState<string | null>(null);
  
  // Dialog states
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [validateDialog, setValidateDialog] = useState(false);
  const [submitDialog, setSubmitDialog] = useState(false);
  const [submitClassesDialog, setSubmitClassesDialog] = useState(false);
  const [alertDialog, setAlertDialog] = useState<{ isOpen: boolean; title: string; message: string; variant: 'success' | 'error' | 'info' }>({ isOpen: false, title: '', message: '', variant: 'info' });
  // Toasts (non-blocking notifications)
  const [toasts, setToasts] = useState<{ id: string; title?: string; message: string; variant?: 'success' | 'error' | 'info' }[]>([]);

  const addToast = (toast: { title?: string; message: string; variant?: 'success' | 'error' | 'info' }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((t) => [...t, { id, ...toast }]);
    // auto-dismiss
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  };

  // Function to load onboarding data
  const loadOnboardingData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    try {
      // Fetch school data from API
      const schoolData = await onboardingApi.getSchool(id);
      if (!schoolData) {
        setSchool(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      setSchool(schoolData);

      // Fetch records and classes from API
      const [records, classesData] = await Promise.all([
        onboardingApi.getRecords(id),
        onboardingApi.getClasses(id),
      ]);

      const onboardingData: SchoolOnboarding = {
        id: id,
        school_id: schoolData.school_id,
        school: {
          id: schoolData.school_id,
          name: schoolData.school_name,
          image_filename: schoolData.image_filename || undefined,
          created_at: new Date().toISOString(),
        },
        records,
        created_at: new Date().toISOString(),
        status: 'draft',
      };

      setOnboarding(onboardingData);
      setClasses(classesData);
    } catch (error) {
      console.error('Failed to load onboarding data:', error);
      setSchool(null);
    } finally {
      if (showLoader) setLoading(false);
      else setRefreshing(false);
    }
  };

  // Mock: Load onboarding data
  useEffect(() => {
    loadOnboardingData();
  }, [id]);

  // Use classes provided by backend when available
  const classSummary = useMemo(() => classes, [classes]);

  const handleUpdate = async (id: string, updates: Partial<SchoolOnboardingRecord>) => {
    if (!onboarding) return;

    // Check if this is a new record being created
    if (id === newRecordId) {
      // Create new record via API
      const newRecord = await schoolOnboardingApi.createRecord(onboarding.id, {
        first_name: updates.first_name || '',
        last_name: updates.last_name || '',
        gender: updates.gender ?? null,
        date_of_birth: updates.date_of_birth || '',
        primary_name: updates.primary_name || '',
        primary_email: updates.primary_email || '',
        class_name: updates.class_name || '',
        status: 'pending',
      } as SchoolOnboardingRecord);

      // Replace temp record with real one
      setOnboarding({
        ...onboarding,
        records: onboarding.records.map((r) =>
          r.id === id ? { ...newRecord, id: newRecord.id } : r
        ),
      });
      setNewRecordId(null);
      
      addToast({ title: 'Success', message: 'New student record has been created successfully.', variant: 'success' });
    } else {
      // Update existing record
      const updated = await schoolOnboardingApi.updateRecord(onboarding.id, id, updates);

      setOnboarding({
        ...onboarding,
        records: onboarding.records.map((r) =>
          r.id === id ? { ...r, ...updated } : r
        ),
      });
    }
  };

  const handleAdd = () => {
    if (!onboarding) return;
    
    // Generate temporary ID for new record
    const tempId = `temp-${Date.now()}`;
    setNewRecordId(tempId);
    
    // Create empty record and add to top of list
    const emptyRecord: SchoolOnboardingRecord = {
      id: tempId,
      first_name: '',
      last_name: '',
      gender: null,
      date_of_birth: '',
      primary_name: '',
      primary_email: '',
      class_name: '',
      status: 'pending',
    };
    
    setOnboarding({
      ...onboarding,
      records: [emptyRecord, ...onboarding.records],
    });
  };

  const handleDelete = async (id: string) => {
    // If deleting a temp record (being added), just remove it from the list
    if (id.startsWith('temp-')) {
      setOnboarding({
        ...onboarding!,
        records: onboarding!.records.filter((r) => r.id !== id),
      });
      setNewRecordId(null);
      return;
    }
    
    // Otherwise, show confirmation dialog for real records
    setDeleteDialog({ isOpen: true, id });
  };

  const handleResetStatus = async (recordId: string) => {
    if (!onboarding) return;

    try {
      await schoolOnboardingApi.resetRecordStatus(onboarding.id, recordId);
      addToast({
        title: 'Status Reset',
        message: 'The failed record has been reset and can now be retried.',
        variant: 'success',
      });
      await loadOnboardingData(false);
    } catch (error) {
      addToast({
        title: 'Reset Failed',
        message: 'Could not reset record status. Please try again.',
        variant: 'error',
      });
    }
  };

  const confirmDelete = async () => {
    if (!onboarding || !deleteDialog.id) return;

    await schoolOnboardingApi.deleteRecord(onboarding.id, deleteDialog.id);

    setOnboarding({
      ...onboarding,
      records: onboarding.records.filter((r) => r.id !== deleteDialog.id),
    });
    
    addToast({ title: 'Deleted', message: 'The student record has been successfully deleted.', variant: 'success' });
    setDeleteDialog({ isOpen: false, id: null });
  };

  const handleValidate = () => {
    if (!onboarding) return;
    
    // Count pending records
    const pendingCount = onboarding.records.filter(r => r.status === 'pending').length;
    if (pendingCount === 0) {
      setAlertDialog({
        isOpen: true,
        title: 'No Pending Records',
        message: 'There are no pending records to validate.',
        variant: 'info',
      });
      return;
    }
    
    setValidateDialog(true);
  };

  const confirmValidate = async () => {
    if (!onboarding) return;

    setActionLoading('validate');
    try {
      await schoolOnboardingApi.validateRecords(onboarding.id);
      setAlertDialog({
        isOpen: true,
        title: 'Success',
        message: 'Validation emails sent successfully!',
        variant: 'success',
      });
    } catch (error) {
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: 'Failed to send validation emails',
        variant: 'error',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmit = async () => {
    if (!onboarding) return;
    setSubmitDialog(true);
  };

  const confirmSubmit = async () => {
    if (!onboarding) return;

    setActionLoading('submit');
    try {
      await schoolOnboardingApi.submitRecords(onboarding.id);
      posthog.capture('onboarding_submitted', { onboarding_id: onboarding.id });
      setAlertDialog({
        isOpen: true,
        title: 'Success',
        message: 'Records submitted successfully! Redirecting to dashboard...',
        variant: 'success',
      });
      setTimeout(() => router.push('/'), 1500);
    } catch (error) {
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: 'Failed to submit records',
        variant: 'error',
      });
      setActionLoading(null);
    }
  };

  const handleSubmitClasses = () => {
    if (!onboarding) return;
    setSubmitClassesDialog(true);
  };

  const confirmSubmitClasses = async () => {
    if (!onboarding) return;

    setActionLoading('submit-classes');
    try {
      await schoolOnboardingApi.createClasses(onboarding.id, classSummary);
      setAlertDialog({
        isOpen: true,
        title: 'Success',
        message: 'Classes created successfully in the core system!',
        variant: 'success',
      });
    } catch (error) {
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: 'Failed to create classes',
        variant: 'error',
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-gray-50 dark:bg-[#0F1115] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!onboarding || !school) {
    return (
      <div className="flex-1 bg-gray-50 dark:bg-[#0F1115] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">School Not Found</h2>
          <button
            onClick={() => router.push('/')}
            className="text-[#1A1A6D] dark:text-[#20B2AA] hover:opacity-80"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 dark:bg-[#0F1115] py-8">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/onboarding')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Onboarding
          </button>
        </div>

        {/* School Info */}
        <div className="bg-white dark:bg-[#121212] rounded-lg shadow border border-gray-200 dark:border-gray-800 mb-6 overflow-hidden">
          <div className="relative h-32 bg-gradient-to-br from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4]">
            {school.image_filename && (
              <SchoolProfileImage
                schoolId={school.school_id}
                imageFilename={school.image_filename}
                alt={`${school.school_name} cover`}
                className="w-full h-full object-cover opacity-40"
                fallbackClassName="w-full h-full"
              />
            )}

            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex items-center gap-4">
              <SchoolProfileImage
                schoolId={school.school_id}
                imageFilename={school.image_filename}
                alt={school.school_name}
                className="w-20 h-20 rounded-full border-4 border-white dark:border-gray-800 shadow-lg object-cover"
                fallbackClassName="w-20 h-20 rounded-full border-4 border-white dark:border-gray-800 shadow-lg bg-white dark:bg-gray-800 flex items-center justify-center"
              />

              <div className="min-w-0">
                <h1 className="text-lg md:text-2xl font-bold leading-tight md:truncate md:max-w-[28rem] text-white">
                  {school.school_name}
                </h1>
                <p className="text-sm text-white/90 mt-1">
                  {school.statistics.total_records} record{school.statistics.total_records !== 1 ? 's' : ''} • {school.statistics.pending_count} pending
                </p>
              </div>
            </div>

            <div className="absolute right-4 top-3">
              <button
                onClick={() => loadOnboardingData(false)}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="w-20 bg-gray-50 dark:bg-gray-900 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-600 dark:text-gray-400">Total</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{school.statistics.total_records}</div>
              </div>

              <div className="w-20 bg-green-50 dark:bg-green-950 rounded-lg p-2 text-center">
                <div className="text-xs text-green-600 dark:text-green-400">Validated</div>
                <div className="text-sm font-semibold text-green-700 dark:text-green-400">{school.statistics.validated_count}</div>
              </div>

              <div className="w-20 bg-yellow-50 dark:bg-yellow-950 rounded-lg p-2 text-center">
                <div className="text-xs text-yellow-600 dark:text-yellow-400">Pending</div>
                <div className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">{school.statistics.pending_count}</div>
              </div>

              <div className="w-20 bg-blue-50 dark:bg-blue-950 rounded-lg p-2 text-center">
                <div className="text-xs text-blue-600 dark:text-blue-400">Submitted</div>
                <div className="text-sm font-semibold text-blue-700 dark:text-blue-400">{school.statistics.submitted_count}</div>
              </div>
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span>Completion</span>
                <span className="font-medium">{Math.round((school.statistics.submitted_count / Math.max(1, school.statistics.total_records)) * 100)}%</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] transition-all duration-300"
                  style={{ width: `${Math.round((school.statistics.submitted_count / Math.max(1, school.statistics.total_records)) * 100)}%` }}
                />
              </div>
            </div>

            {school.last_activity && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <Calendar className="w-3.5 h-3.5" />
                <span>Last activity {new Date(school.last_activity).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Table */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white dark:bg-[#121212] rounded-lg shadow border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Student Records</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleAdd}
                    disabled={newRecordId !== null}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                  <button
                    onClick={handleValidate}
                    disabled={actionLoading !== null}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'validate' ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Validate
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={actionLoading !== null}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 dark:bg-purple-700 text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'submit' ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <UploadIcon className="w-4 h-4" />
                    )}
                    Submit
                  </button>
                </div>
              </div>

              <EditableTable
                records={onboarding.records}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onResetStatus={handleResetStatus}
                initialEditingId={newRecordId}
                schoolId={id}
              />
            </div>
          </div>

          {/* Classes Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-[#121212] rounded-lg shadow border border-gray-200 dark:border-gray-800 p-6 sticky top-8">
              <ClassSummaryTable 
                classes={classSummary} 
                onSubmitClasses={handleSubmitClasses}
                isSubmitting={actionLoading === 'submit-classes'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title="Delete Record"
        message="Are you sure you want to delete this student record? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={validateDialog}
        onClose={() => setValidateDialog(false)}
        onConfirm={confirmValidate}
        title="Send Validation Emails"
        message={`This will send validation emails to all records with "Pending" status. Each primary guardian will receive an email at their registered address to verify the student information. Do you want to proceed?`}
        confirmText="Send Emails"
        cancelText="Cancel"
        variant="warning"
      />

      <ConfirmDialog
        isOpen={submitDialog}
        onClose={() => setSubmitDialog(false)}
        onConfirm={confirmSubmit}
        title="Submit Records"
        message='This will submit all records with "Validated" status to the core system. This action cannot be undone. Are you sure you want to proceed?'
        confirmText="Submit"
        cancelText="Cancel"
        variant="info"
      />

      <ConfirmDialog
        isOpen={submitClassesDialog}
        onClose={() => setSubmitClassesDialog(false)}
        onConfirm={confirmSubmitClasses}
        title="Create Classes"
        message="Are you sure you want to create these classes in the core system? This will make them available for enrollment."
        confirmText="Create"
        cancelText="Cancel"
        variant="info"
      />

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        title={alertDialog.title}
        message={alertDialog.message}
        variant={alertDialog.variant}
      />

      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-sm w-full px-4 py-3 rounded-lg shadow-md border transition-opacity bg-white dark:bg-[#111217] border-gray-200 dark:border-gray-800 ${t.variant === 'success' ? 'ring-1 ring-green-200' : ''}`}
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
