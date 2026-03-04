import apiClient from './api';

export interface SystemUser {
  person_id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  id_number_masked: string | null;
  id_country: string | null;
  id_type: string | null;
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
  first_name: string;
  last_name: string;
  email: string| null;
  id_number: string | null;
  id_country: string | null;
  id_type: string | null;
  active: boolean;
  is_admin: boolean;
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

  // Activate/deactivate user
  updateUserActive: async (personId: string, active: boolean): Promise<SystemUser> => {
    const response = await apiClient.patch<SystemUser>(
      `/admin/users/${personId}/active`,
      { active }
    );
    return response.data;
  },

  // Promote/remove admin
  updateAdminStatus: async (personId: string, isAdmin: boolean): Promise<SystemUser> => {
    const response = await apiClient.patch<SystemUser>(
      `/admin/users/${personId}/admin`,
      { is_admin: isAdmin }
    );
    return response.data;
  },

  // Send password reset email
  sendPasswordReset: async (personId: string): Promise<void> => {
    await apiClient.post(
      `/admin/users/${personId}/reset-password`
    );
  },

  scheduleDeletion: async (personId: string): Promise<void> => {
    await apiClient.post(
      `/admin/users/${personId}/schedule-deletion`
    );
  },
};
