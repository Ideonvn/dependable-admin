import apiClient from './api';

// Note: id is a bigint on the backend, not a UUID like other admin entities.
export interface EmailHardBounce {
  id: number;
  email_address: string;
  bounced_at: string;
  reason: string | null;
  message: string | null;
  attempts: number;
  blocked: boolean;
  unblocked_at: string | null;
}

export interface EmailHardBouncesResponse {
  total: number;
  page: number;
  page_size: number;
  hard_bounces: EmailHardBounce[];
}

export const emailBouncesApi = {
  // `search` must be 3+ characters or the backend returns 422 - callers omit it below that.
  getHardBounces: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    blocked?: boolean;
  }): Promise<EmailHardBouncesResponse> => {
    const response = await apiClient.get<EmailHardBouncesResponse>('/admin/email-hard-bounces', {
      params: {
        page: params?.page,
        page_size: params?.page_size,
        search: params?.search || undefined,
        blocked: params?.blocked,
      },
    });
    return response.data;
  },

  // Soft delete: the row keeps its bounce history and simply stops being enforced.
  unblock: async (id: number): Promise<void> => {
    await apiClient.delete(`/admin/email-hard-bounces/${id}`);
  },
};
