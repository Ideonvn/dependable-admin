// School Onboarding Types
export interface SchoolOnboardingRecord {
  id: string;
  first_name: string;
  last_name: string;
  gender: 'male' | 'female' | 'other';
  date_of_birth: string;
  primary_name: string;
  primary_email: string;
  class_name: string;
  status: 'pending' | 'validated' | 'submitted' | 'error' | 'created';
  error_message?: string;
}

export interface School {
  id: string;
  name: string;
  image_filename?: string;
  created_at: string;
}

export interface SchoolOnboarding {
  id: string;
  school_id: string;
  school: School;
  records: SchoolOnboardingRecord[];
  created_at: string;
  status: 'draft' | 'validating' | 'validated' | 'submitted';
}

export interface ClassSummary {
  class_name: string;
  total_students: number;
  validated_students: number;
  is_fixed: boolean;
}

export interface OperationResult {
  total: number;
  successful: number;
  failed: number;
  errors: any[];
}

export interface CreateClassResult {
  name: string;
  status: string;
}

// Mock API for school onboarding
import apiClient from '@/lib/api';

export const schoolOnboardingApi = {
  // Create school and import CSV
  createSchoolOnboarding: async (
    schoolName: string,
    schoolPicture: File,
    csvFile: File
  ): Promise<SchoolOnboarding> => {
    // Call backend to create onboarding using multipart/form-data
    const form = new FormData();
    form.append('school_name', schoolName);
    if (schoolPicture) form.append('school_image', schoolPicture);
    if (csvFile) form.append('csv_file', csvFile);

    const response = await apiClient.post('/admin/onboarding/schools', form, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const data = response.data;

    // Construct a minimal SchoolOnboarding object for the frontend
    const result: SchoolOnboarding = {
      id: data.school_id || data.schoolId || '',
      school_id: data.school_id || data.schoolId || '',
      school: {
        id: data.school_id || data.schoolId || '',
        name: schoolName,
        image_filename: schoolPicture ? URL.createObjectURL(schoolPicture) : undefined,
        created_at: new Date().toISOString(),
      },
      records: [],
      created_at: new Date().toISOString(),
      status: 'draft',
    };

    return result;
  },

  // Update a record (PATCH)
  updateRecord: async (
    onboardingId: string,
    recordId: string,
    updates: Partial<SchoolOnboardingRecord>
  ): Promise<SchoolOnboardingRecord> => {
    const payload: any = {
      ...updates,
      gender: updates.gender ? updates.gender.toString().toUpperCase() : undefined,
    };

    const response = await apiClient.patch(
      `/admin/onboarding/schools/${onboardingId}/records/${recordId}`,
      Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined))
    );

    const data = response.data;
    return {
      id: data.id,
      first_name: data.first_name,
      last_name: data.last_name,
      gender: (data.gender || '').toString().toLowerCase() as 'male' | 'female' | 'other',
      date_of_birth: data.date_of_birth || '',
      primary_name: data.primary_name || '',
      primary_email: data.primary_email || '',
      class_name: data.class_name || '',
      status: (data.status || '').toString().toLowerCase() as SchoolOnboardingRecord['status'],
      error_message: data.error_message,
    };
  },

  // Delete a record (DELETE)
  deleteRecord: async (onboardingId: string, recordId: string): Promise<void> => {
    await apiClient.delete(`/admin/onboarding/schools/${onboardingId}/records/${recordId}`);
  },

  // Create a new record (POST)
  createRecord: async (
    onboardingId: string,
    record: Omit<SchoolOnboardingRecord, 'id'>
  ): Promise<SchoolOnboardingRecord> => {
    const payload: any = {
      ...record,
      gender: record.gender ? record.gender.toString().toUpperCase() : undefined,
    };

    const response = await apiClient.post(
      `/admin/onboarding/schools/${onboardingId}/records/`,
      payload
    );

    const data = response.data;
    return {
      id: data.id,
      first_name: data.first_name,
      last_name: data.last_name,
      gender: (data.gender || '').toString().toLowerCase() as 'male' | 'female' | 'other',
      date_of_birth: data.date_of_birth || '',
      primary_name: data.primary_name || '',
      primary_email: data.primary_email || '',
      class_name: data.class_name || '',
      status: (data.status || '').toString().toLowerCase() as SchoolOnboardingRecord['status'],
      error_message: data.error_message,
    };
  },

  // Validate records (send emails)
  validateRecords: async (
    onboardingId: string,
    recordIds?: string[]
  ): Promise<OperationResult> => {
    const payload = {};
    const response = await apiClient.post(`/admin/onboarding/schools/${onboardingId}/records/validate`, payload);
    return response.data as OperationResult;
  },

  // Submit records to core system
  submitRecords: async (
    onboardingId: string,
    recordIds?: string[]
  ): Promise<OperationResult> => {
    const payload = {};
    const response = await apiClient.post(`/admin/onboarding/schools/${onboardingId}/records/submit`, payload);
    return response.data as OperationResult;
  },

  // Create classes in core system
  createClasses: async (
    onboardingId: string,
    classes: ClassSummary[]
  ): Promise<CreateClassResult[]> => {
    // For now backend expects an empty JSON payload; send {}
    const payload = {};
    const response = await apiClient.post(`/admin/onboarding/schools/${onboardingId}/classes`, payload);
    return response.data as CreateClassResult[];
  },

  // Get class summary
  getClassSummary: (records: SchoolOnboardingRecord[]): ClassSummary[] => {
    const classMap = new Map<string, ClassSummary>();

    records.forEach(record => {
      const existing = classMap.get(record.class_name);
      if (existing) {
        existing.total_students++;
        if (record.status === 'validated') {
          existing.validated_students++;
        }
      } else {
        classMap.set(record.class_name, {
          class_name: record.class_name,
          total_students: 1,
          validated_students: record.status === 'validated' ? 1 : 0,
          is_fixed: false,
        });
      }
    });

    return Array.from(classMap.values()).sort((a, b) =>
      a.class_name.localeCompare(b.class_name)
    );
  },
};
