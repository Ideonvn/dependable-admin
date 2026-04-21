// Admin setup data for the currently logged-in user
import apiClient from './api';

export interface SchoolMembership {
  id: string;
  user_id: string;
  school_id: string;
  role: string;
  status: string;
  started_at: string;
  ended_at: string | null;
}

export interface AdminSetupData {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  image_filename: string | null;
  is_admin: boolean;
  school_memberships: SchoolMembership[];
}

const SETUP_STORAGE_KEY = 'admin_setup_data';

export const userSetupService = {
  async fetchAndStore(): Promise<AdminSetupData> {
    const response = await apiClient.get<AdminSetupData>('/users/me/admin/setup');
    this.setSetupData(response.data);
    return response.data;
  },

  setSetupData(data: AdminSetupData): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(data));
    }
  },

  getSetupData(): AdminSetupData | null {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(SETUP_STORAGE_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data) as AdminSetupData;
    } catch {
      return null;
    }
  },

  clearSetupData(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SETUP_STORAGE_KEY);
    }
  },

  isAdmin(): boolean {
    return this.getSetupData()?.is_admin ?? false;
  },

  getFullName(): string | null {
    const data = this.getSetupData();
    if (!data) return null;
    const name = `${data.first_name} ${data.last_name}`.trim();
    return name || null;
  },
};
