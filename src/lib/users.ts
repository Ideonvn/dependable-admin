import apiClient from './api';

export interface SystemUser {
  person_id: string;
  email: string;
  first_name: string;
  last_name: string;
  id_number_masked: string | null;
  image_filename: string | null;
  has_login_user: boolean;
  user_id: string | null;
  auth_active: boolean;
  is_admin: boolean;
  updated_at: string;
}

export interface UsersListResponse {
  total: number;
  page: number;
  page_size: number;
  users: SystemUser[];
}

export interface UpdateUserPayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  id_number?: string;
  is_admin?: boolean;
}

export interface UpdateUserAuthPayload {
  auth_active?: boolean;
}

export const systemUsersApi = {
  // Get paginated list of users with optional search
  getUsers: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
  }): Promise<UsersListResponse> => {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
    if (params?.search) queryParams.append('search', params.search);

    const response = await apiClient.get<UsersListResponse>(
      `/admin/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    );
    return response.data;
  },

  // Update user person details
  updateUser: async (personId: string, payload: UpdateUserPayload): Promise<SystemUser> => {
    const response = await apiClient.patch<SystemUser>(
      `/admin/users/${personId}`,
      payload
    );
    return response.data;
  },

  // Update user authentication status
  updateUserAuth: async (userId: string, payload: UpdateUserAuthPayload): Promise<SystemUser> => {
    const response = await apiClient.patch<SystemUser>(
      `/admin/users/${userId}/auth`,
      payload
    );
    return response.data;
  },

  // Toggle admin status
  updateAdminStatus: async (userId: string, isAdmin: boolean): Promise<SystemUser> => {
    const response = await apiClient.patch<SystemUser>(
      `/admin/users/${userId}/admin`,
      { is_admin: isAdmin }
    );
    return response.data;
  },

  // Send password reset email
  sendPasswordReset: async (userId: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(
      `/admin/users/${userId}/reset-password`
    );
    return response.data;
  },

  // Batch operations
  batchUpdateAuth: async (
    userIds: string[],
    authActive: boolean
  ): Promise<{ updated: number; errors?: string[] }> => {
    const response = await apiClient.post<{ updated: number; errors?: string[] }>(
      '/admin/users/batch/auth',
      { user_ids: userIds, auth_active: authActive }
    );
    return response.data;
  },

  batchUpdateAdmin: async (
    userIds: string[],
    isAdmin: boolean
  ): Promise<{ updated: number; errors?: string[] }> => {
    const response = await apiClient.post<{ updated: number; errors?: string[] }>(
      '/admin/users/batch/admin',
      { user_ids: userIds, is_admin: isAdmin }
    );
    return response.data;
  },

  batchSendPasswordReset: async (
    userIds: string[]
  ): Promise<{ sent: number; errors?: string[] }> => {
    const response = await apiClient.post<{ sent: number; errors?: string[] }>(
      '/admin/users/batch/reset-password',
      { user_ids: userIds }
    );
    return response.data;
  },

  batchScheduleForDeletion: async (
    personIds: string[]
  ): Promise<{ scheduled: number; errors?: string[] }> => {
    const response = await apiClient.post<{ scheduled: number; errors?: string[] }>(
      '/admin/users/batch/schedule-deletion',
      { person_ids: personIds }
    );
    return response.data;
  },
};
