'use client';

import { useState, useEffect } from 'react';
import CSVUpload from '@/components/CSVUpload';
import BatchList from '@/components/BatchList';
import BatchValidator from '@/components/BatchValidator';
import InviteManager from '@/components/InviteManager';
import { api, ImportBatch, Invite, ValidationResult } from '@/lib/api';
import { RefreshCw } from 'lucide-react';

export default function DashboardClient() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    if (selectedBatch) {
      loadInvites(selectedBatch.id);
    }
  }, [selectedBatch]);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const data = await api.getImportBatches();
      setBatches(data);
    } catch (error) {
      console.error('Error loading batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInvites = async (batchId: string) => {
    try {
      const data = await api.getInvites(batchId);
      setInvites(data);
    } catch (error) {
      console.error('Error loading invites:', error);
      setInvites([]);
    }
  };

  const handleUploadSuccess = (batch: ImportBatch) => {
    setBatches([batch, ...batches]);
    setSelectedBatch(batch);
  };

  const handleValidate = async (batchId: string): Promise<ValidationResult> => {
    const result = await api.validateBatch(batchId);
    await loadBatches();
    return result;
  };

  const handleValidationComplete = async (result: ValidationResult) => {
    if (selectedBatch) {
      await loadInvites(selectedBatch.id);
    }
  };

  const handleSendInvites = async (inviteIds?: string[]) => {
    if (selectedBatch) {
      await api.sendInvites(selectedBatch.id, inviteIds);
      await loadInvites(selectedBatch.id);
    }
  };

  const handleResendInvites = async (inviteIds: string[]) => {
    await api.resendInvites(inviteIds);
    if (selectedBatch) {
      await loadInvites(selectedBatch.id);
    }
  };

  const handleCancelInvites = async (inviteIds: string[]) => {
    await api.cancelInvites(inviteIds);
    if (selectedBatch) {
      await loadInvites(selectedBatch.id);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-end mb-4">
        <button
          onClick={loadBatches}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Upload & Batch List */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload CSV</h2>
            <CSVUpload onUploadSuccess={handleUploadSuccess} />
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Import Batches</h2>
            <BatchList
              batches={batches}
              onSelectBatch={setSelectedBatch}
              selectedBatchId={selectedBatch?.id}
            />
          </div>
        </div>

        {/* Right Column - Batch Details */}
        <div className="lg:col-span-2 space-y-6">
          {selectedBatch ? (
            <>
              <div className="bg-white rounded-lg shadow p-6">
                <BatchValidator
                  batch={selectedBatch}
                  onValidate={handleValidate}
                  onValidationComplete={handleValidationComplete}
                />
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <InviteManager
                  invites={invites}
                  onSendInvites={handleSendInvites}
                  onResendInvites={handleResendInvites}
                  onCancelInvites={handleCancelInvites}
                />
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No batch selected</h3>
              <p className="text-gray-600">
                Select a batch from the list or upload a new CSV file to get started
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
