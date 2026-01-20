import { School, SchoolOnboardingRecord, ClassSummary } from './schoolOnboarding';
import apiClient from './api';

export interface RecordAction {
  id: string;
  onboarding_record_id: string;
  action_type: string;
  user_id: string | null;
  success: string;
  message: string;
  raw_metadata: any;
  _created_at: string;
}

export interface RecordDetails extends SchoolOnboardingRecord {
  actions: RecordAction[];
}

// API Response types
export interface ClassInfo {
  class_name: string;
  count: number;
  exists_in_system: boolean;
}

export interface SchoolStatistics {
  total_records: number;
  pending_count: number;
  validated_count: number;
  submitted_count: number;
  failed_count: number;
  error_count: number;
  unique_classes: ClassInfo[];
}

export interface SchoolWithStats {
  school_id: string;
  school_name: string;
  school_image_url: string | null;
  statistics: SchoolStatistics;
  last_activity?: string;
}

// API for schools
export const schoolsApi = {
  // Get all schools with onboarding statistics
  getAllSchools: async (): Promise<SchoolWithStats[]> => {
    const response = await apiClient.get<SchoolWithStats[]>('/admin/onboarding/schools');
    return response.data;
  },

  // Get a specific school
  getSchool: async (schoolId: string): Promise<SchoolWithStats | null> => {
    try {
      const response = await apiClient.get<SchoolWithStats>(`/admin/onboarding/schools/${schoolId}`);
      return response.data;
    } catch (error) {
      // Return null if school not found
      return null;
    }
  },
  // Get records for a specific school
  getRecords: async (schoolId: string): Promise<SchoolOnboardingRecord[]> => {
    try {
      const response = await apiClient.get<any[]>(`/admin/onboarding/schools/${schoolId}/records`);

      // Map API record shape to local SchoolOnboardingRecord
      return response.data.map((r) => {
        // Map gender
        let gender: SchoolOnboardingRecord['gender'] = 'other';
        if (typeof r.gender === 'string') {
          const g = r.gender.toLowerCase();
          if (g === 'male') gender = 'male';
          else if (g === 'female') gender = 'female';
        }

        // Map status
        let status: SchoolOnboardingRecord['status'] = 'pending';
        if (typeof r.status === 'string') {
          const s = r.status.toLowerCase();
          if (s === 'pending') status = 'pending';
          else if (s === 'validated') status = 'validated';
          else if (s === 'submitted') status = 'submitted';
          else if (s === 'error' || s === 'failed') status = 'error';
          else if (s === 'created') status = 'created';
        }

        return {
          id: r.id,
          first_name: r.first_name || '',
          last_name: r.last_name || '',
          gender,
          date_of_birth: r.date_of_birth || '',
          primary_name: r.primary_name || '',
          primary_email: r.primary_email || '',
          class_name: r.class_name || '',
          status,
          error_message: r.error_message,
        } as SchoolOnboardingRecord;
      });
    } catch (error) {
      return [];
    }
  },
  // Get classes summary for a specific school
  getClasses: async (schoolId: string): Promise<ClassSummary[]> => {
    try {
      const response = await apiClient.get<any[]>(`/admin/onboarding/schools/${schoolId}/classes`);

      // Map API class shape to local ClassSummary
      return response.data.map((c) => ({
        class_name: c.class_name || '',
        total_students: typeof c.count === 'number' ? c.count : Number(c.count) || 0,
        validated_students: 0, // API doesn't provide validated count per class
        is_fixed: !!c.exists_in_system,
      } as ClassSummary));
    } catch (error) {
      return [];
    }
  },
  // Get record details with actions
  getRecordDetails: async (schoolId: string, recordId: string): Promise<RecordDetails | null> => {
    try {
      const response = await apiClient.get<any>(`/admin/onboarding/schools/${schoolId}/records/${recordId}`);
      const r = response.data;

      // Map gender
      let gender: SchoolOnboardingRecord['gender'] = 'other';
      if (typeof r.gender === 'string') {
        const g = r.gender.toLowerCase();
        if (g === 'male') gender = 'male';
        else if (g === 'female') gender = 'female';
      }

      // Map status
      let status: SchoolOnboardingRecord['status'] = 'pending';
      if (typeof r.status === 'string') {
        const s = r.status.toLowerCase();
        if (s === 'pending') status = 'pending';
        else if (s === 'validated') status = 'validated';
        else if (s === 'submitted') status = 'submitted';
        else if (s === 'error' || s === 'failed') status = 'error';
        else if (s === 'created') status = 'created';
      }

      return {
        id: r.id,
        first_name: r.first_name || '',
        last_name: r.last_name || '',
        gender,
        date_of_birth: r.date_of_birth || '',
        primary_name: r.primary_name || '',
        primary_email: r.primary_email || '',
        class_name: r.class_name || '',
        status,
        error_message: r.error_message,
        actions: r.actions || [],
      };
    } catch (error) {
      console.error('Failed to fetch record details:', error);
      return null;
    }
  },
};
