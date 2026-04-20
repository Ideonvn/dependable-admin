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
    try {
      const accessToken = await tokenService.getValidToken(currentGoogleIdToken || undefined);

      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      } else {
        console.warn('No valid access token available for API request');
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'REFRESH_TOKEN_EXPIRED') {
        console.error('Refresh token expired, redirecting to sign-in');
        if (typeof window !== 'undefined') {
          window.location.href = '/api/auth/signout?callbackUrl=/auth/signin';
        }
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle authentication errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Check for 403 error indicating expired/invalid credentials
    if (error.response?.status === 401) {
      const errorData = error.response?.data?.error;
      
      // Check if it's an authentication-related 401
      if (errorData?.developer_message?.toLowerCase().includes('credential') ||
          errorData?.developer_message?.toLowerCase().includes('token')) {
        console.error('Authentication failed (401), triggering logout');
        
        // Clear local token data
        tokenService.clearTokenData();
        setGoogleIdToken(null);
        
        // Trigger logout by redirecting to sign-in
        if (typeof window !== 'undefined') {
          // Use NextAuth signOut to properly clear session
          window.location.href = '/api/auth/signout?callbackUrl=/auth/signin';
        }
      }
    }
    
    return Promise.reject(error);
  }
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
