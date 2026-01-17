// API client configuration
import axios from 'axios';
import { tokenService } from './tokenService';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Store for the current session's Google ID token (set by the app on mount)
let currentGoogleIdToken: string | null = null;

export const setGoogleIdToken = (token: string | null) => {
  currentGoogleIdToken = token;
};

// Add Bearer token to all requests (with automatic refresh)
apiClient.interceptors.request.use(
  async (config) => {
    // Get valid token (will refresh if expired)
    const accessToken = await tokenService.getValidToken(currentGoogleIdToken || undefined);
    
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    } else {
      // No valid token available - requests will likely fail with 401
      console.warn('No valid access token available for API request');
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Types
export interface ImportBatch {
  id: string;
  filename: string;
  status: 'pending' | 'validated' | 'processing' | 'completed' | 'failed';
  created_at: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
}

export interface Invite {
  id: string;
  batch_id: string;
  email: string;
  name: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sent_at?: string;
  error_message?: string;
}

export interface ValidationIssue {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  total_invites: number;
}

// API functions
export const api = {
  // Upload CSV and create ImportBatch
  uploadCSV: async (file: File): Promise<ImportBatch> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post('/admin/import-batch', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get all import batches
  getImportBatches: async (): Promise<ImportBatch[]> => {
    const response = await apiClient.get('/admin/import-batches');
    return response.data;
  },

  // Get a specific import batch
  getImportBatch: async (id: string): Promise<ImportBatch> => {
    const response = await apiClient.get(`/admin/import-batch/${id}`);
    return response.data;
  },

  // Validate import batch
  validateBatch: async (id: string): Promise<ValidationResult> => {
    const response = await apiClient.post(`/admin/import-batch/${id}/validate`);
    return response.data;
  },

  // Get invites for a batch
  getInvites: async (batchId: string): Promise<Invite[]> => {
    const response = await apiClient.get(`/admin/import-batch/${batchId}/invites`);
    return response.data;
  },

  // Send invites
  sendInvites: async (batchId: string, inviteIds?: string[]): Promise<void> => {
    await apiClient.post(`/admin/import-batch/${batchId}/send`, {
      invite_ids: inviteIds,
    });
  },

  // Resend specific invites
  resendInvites: async (inviteIds: string[]): Promise<void> => {
    await apiClient.post('/admin/invites/resend', {
      invite_ids: inviteIds,
    });
  },

  // Cancel invites
  cancelInvites: async (inviteIds: string[]): Promise<void> => {
    await apiClient.post('/admin/invites/cancel', {
      invite_ids: inviteIds,
    });
  },
};

export default apiClient;
