// API client configuration
import axios from 'axios';

// TODO: Replace this with proper authentication handling
const TEMP_BEARER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJEZXBlbmRhYmxlIiwic3ViIjoiY2EwOWRmYWMtZGZkOS00YTcxLTgxOGYtMDAyNjUxZDAyNGVkIiwiZXhwIjoxNzY5MTkwMjgyLCJpYXQiOjE3Njg1ODU0ODIsImp0aSI6IjljYWVhN2VjYzRiZjZlZmU1Zjg3ZDk2MzkxZTY2M2U5MGI4YWYyNjk4YTdmMjdjYjY5NGVkZjQxZDI1MDgxMzFkNGFiYWUxYTEzOWU4NTc2MmE0ZWRmMWZmYjQ4ZWNhYTEwYWNiODAxYWRhNjMxMTg0ZDhhOTkzYzI2NDY1ZTNkNzkzNzc3OWQ2YzRhOTEzZjc1NmYxNTdiZjNlOGE2ZDFjZmU2ODk1NjgwMmE0MjczMTYzZTkyMjdiMjEyNjk2OTM1ZWY3NzQwIn0.NpOLa72iVIrgzFzQv-MnryD45k-EJ_xRgBIr4dN75yA'; // Replace with your actual token

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add Bearer token to all requests
apiClient.interceptors.request.use(
  (config) => {
    if (TEMP_BEARER_TOKEN) {
      config.headers.Authorization = `Bearer ${TEMP_BEARER_TOKEN}`;
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
