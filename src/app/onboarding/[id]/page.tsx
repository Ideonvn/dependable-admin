'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Send, Upload as UploadIcon, ArrowLeft, RefreshCw } from 'lucide-react';
import {
  schoolOnboardingApi,
  SchoolOnboarding,
  SchoolOnboardingRecord,
} from '@/lib/schoolOnboarding';
import EditableTable from '@/components/EditableTable';
import ClassSummaryTable from '@/components/ClassSummaryTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import AlertDialog from '@/components/AlertDialog';

export default function OnboardingEdit({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [onboarding, setOnboarding] = useState<SchoolOnboarding | null>(null);
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

  // Function to load onboarding data
  const loadOnboardingData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    try {
      // In real app, fetch from API
      const mockOnboarding: SchoolOnboarding = {
        id: params.id,
        school_id: 'school-1',
        school: {
          id: 'school-1',
          name: 'Sunnydale Primary School',
          picture_url: 'https://via.placeholder.com/150',
          created_at: new Date().toISOString(),
        },
        records: [
          {
            id: '1',
            first_name: 'John',
            last_name: 'Doe',
            gender: 'male',
            date_of_birth: '2015-03-15',
            primary_name: 'Jane Doe',
            primary_email: 'jane.doe@example.com',
            class_name: 'Grade 1A',
            status: 'pending',
          },
          {
            id: '2',
            first_name: 'Sarah',
            last_name: 'Smith',
            gender: 'female',
            date_of_birth: '2014-07-22',
            primary_name: 'John Smith',
            primary_email: 'john.smith@example.com',
            class_name: 'Grade 2B',
            status: 'pending',
          },
          {
            id: '3',
            first_name: 'Mike',
            last_name: 'Johnson',
            gender: 'male',
            date_of_birth: '2015-01-10',
            primary_name: 'Emily Johnson',
            primary_email: 'emily.j@example.com',
            class_name: 'Grade 1A',
            status: 'validated',
          },
          {
            id: '4',
            first_name: 'Emma',
            last_name: 'Wilson',
            gender: 'female',
            date_of_birth: '2015-05-20',
            primary_name: 'David Wilson',
            primary_email: 'david.wilson@example.com',
            class_name: 'Grade 1A',
            status: 'error',
            error_message: 'Failed to send validation email: Invalid email address format. Please update the primary email and try again.',
          },
          {
            id: '5',
            first_name: 'Oliver',
            last_name: 'Brown',
            gender: 'male',
            date_of_birth: '2014-11-08',
            primary_name: 'Lisa Brown',
            primary_email: 'lisa.brown@example.com',
            class_name: 'Grade 2B',
            status: 'submitted',
          },
          {
            id: '6',
            first_name: 'Sophia',
            last_name: 'Davis',
            gender: 'female',
            date_of_birth: '2015-02-14',
            primary_name: 'Michael Davis',
            primary_email: 'michael.davis@example.com',
            class_name: 'Grade 1A',
            status: 'created',
          },
        ],
        created_at: new Date().toISOString(),
        status: 'draft',
      };

      await new Promise(resolve => setTimeout(resolve, 500));
      setOnboarding(mockOnboarding);
    } catch (error) {
      console.error('Failed to load onboarding data:', error);
    } finally {
      if (showLoader) setLoading(false);
      else setRefreshing(false);
    }
  };

  // Mock: Load onboarding data
  useEffect(() => {
    loadOnboardingData();
  }, [params.id]);

  const classSummary = useMemo(() => {
    if (!onboarding) return [];
    return schoolOnboardingApi.getClassSummary(onboarding.records);
  }, [onboarding]);

  const handleUpdate = async (id: string, updates: Partial<SchoolOnboardingRecord>) => {
    if (!onboarding) return;

    // Check if this is a new record being created
    if (id === newRecordId) {
      // Create new record via API
      const newRecord = await schoolOnboardingApi.createRecord(onboarding.id, {
        first_name: updates.first_name || '',
        last_name: updates.last_name || '',
        gender: updates.gender || 'male',
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
      
      setAlertDialog({
        isOpen: true,
        title: 'Success',
        message: 'New student record has been created successfully.',
        variant: 'success',
      });
    } else {
      // Update existing record
      await schoolOnboardingApi.updateRecord(onboarding.id, id, updates);

      setOnboarding({
        ...onboarding,
        records: onboarding.records.map((r) =>
          r.id === id ? { ...r, ...updates } : r
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
      gender: 'male',
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

  const confirmDelete = async () => {
    if (!onboarding || !deleteDialog.id) return;

    await schoolOnboardingApi.deleteRecord(onboarding.id, deleteDialog.id);

    setOnboarding({
      ...onboarding,
      records: onboarding.records.filter((r) => r.id !== deleteDialog.id),
    });
    
    setAlertDialog({
      isOpen: true,
      title: 'Record Deleted',
      message: 'The student record has been successfully deleted.',
      variant: 'success',
    });
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
      <div className="min-h-screen bg-gray-50 dark:bg-[#0F1115] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!onboarding) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0F1115] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Onboarding Not Found</h2>
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
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F1115] py-8">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>

        {/* School Info */}
        <div className="bg-white dark:bg-[#121212] rounded-lg shadow border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onboarding.school.picture_url && (
                <img
                  src={onboarding.school.picture_url}
                  alt={onboarding.school.name}
                  className="w-20 h-20 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {onboarding.school.name}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {onboarding.records.length} student{onboarding.records.length !== 1 ? 's' : ''} •{' '}
                  Created {new Date(onboarding.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => loadOnboardingData(false)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Table */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white dark:bg-[#121212] rounded-lg shadow border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Student Records</h2>
                <div className="flex gap-2">
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
                initialEditingId={newRecordId}
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
    </div>
  );
}
