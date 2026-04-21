import apiClient from './api';

export interface MeUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  image_filename: string | null;
}

export const meApi = {
  getMe: async (): Promise<MeUser> => {
    const response = await apiClient.get<MeUser>('/users/me');
    return response.data;
  },

  updateMe: async (payload: { first_name: string; last_name: string }): Promise<MeUser> => {
    const response = await apiClient.put<MeUser>('/users/me', payload);
    return response.data;
  },

  updateProfileImage: async (file: File): Promise<MeUser> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<MeUser>('/users/me/profile/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

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
  created_at: string;
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

export interface UserOAuthProvider {
  id: number;
  provider: string;
  email: string;
  full_name: string;
  profile_picture: string | null;
  active: boolean;
  _created_at: string;
}

export interface UserAuthReset {
  id: number;
  hash: string;
  expires_at: string;
  used: boolean;
  _created_at: string;
}

export interface UserStudentContact {
  id: string;
  student_id: string;
  student_first_name: string;
  student_last_name: string;
  school_id: string;
  school_name: string;
  role: string;
  primary: boolean;
  can_check_in_out: boolean;
  can_view_records: boolean;
  can_receive_notifications: boolean;
  created_at: string;
}

export interface UserDependantRecord {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
}

export interface DependantSearchResult {
  id: string;
  first_name: string;
  last_name: string;
}

export interface UserDependant {
  id: string;
  dependant_id: string;
  independant_type: string;
  primary: boolean;
  created_at: string;
  dependant: UserDependantRecord;
}

export const systemUsersApi = {
  // Get a single user by person ID
  getUser: async (personId: string): Promise<SystemUser> => {
    const response = await apiClient.get<SystemUser>(`/admin/users/${personId}`);
    return response.data;
  },

  getOAuthProviders: async (personId: string): Promise<UserOAuthProvider[]> => {
    const response = await apiClient.get<UserOAuthProvider[]>(`/admin/users/${personId}/oauth`);
    return response.data;
  },

  getAuthResets: async (personId: string): Promise<UserAuthReset[]> => {
    const response = await apiClient.get<UserAuthReset[]>(`/admin/users/${personId}/auth-resets`);
    return response.data;
  },

  getStudentContacts: async (personId: string): Promise<UserStudentContact[]> => {
    const response = await apiClient.get<UserStudentContact[]>(`/admin/users/${personId}/student-contacts`);
    return response.data;
  },

  getDependants: async (personId: string): Promise<UserDependant[]> => {
    const response = await apiClient.get<UserDependant[]>(`/admin/users/${personId}/dependants`);
    return response.data;
  },

  setOAuthActive: async (personId: string, oauthId: number, active: boolean): Promise<UserOAuthProvider> => {
    const response = await apiClient.patch<UserOAuthProvider>(`/admin/users/${personId}/oauth/${oauthId}`, { active });
    return response.data;
  },

  addDependant: async (personId: string, payload: { dependant_id: string; independant_type: string; primary: boolean }): Promise<UserDependant> => {
    const response = await apiClient.post<UserDependant>(`/admin/users/${personId}/dependants`, payload);
    return response.data;
  },

  updateDependant: async (personId: string, linkId: string, payload: { independant_type: string; primary: boolean }): Promise<UserDependant> => {
    const response = await apiClient.patch<UserDependant>(`/admin/users/${personId}/dependants/${linkId}`, payload);
    return response.data;
  },

  deleteDependant: async (personId: string, linkId: string): Promise<void> => {
    await apiClient.delete(`/admin/users/${personId}/dependants/${linkId}`);
  },

  searchDependants: async (q: string): Promise<DependantSearchResult[]> => {
    const response = await apiClient.get<DependantSearchResult[]>(`/admin/dependants/search`, { params: { q } });
    return response.data;
  },

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
