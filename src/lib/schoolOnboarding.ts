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
  picture_url?: string;
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

// Mock API for school onboarding
export const schoolOnboardingApi = {
  // Create school and import CSV
  createSchoolOnboarding: async (
    schoolName: string,
    schoolPicture: File,
    csvFile: File
  ): Promise<SchoolOnboarding> => {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Parse CSV (mock)
    const mockRecords: SchoolOnboardingRecord[] = [
      {
        id: '1',
        first_name: 'John',
        last_name: 'Doe',
        gender: 'male',
        date_of_birth: '2015-03-15',
        primary_name: 'Jane Doe',
        primary_email: 'jane.doe@example.com',
        class_name: 'Grade 1A',
        status: 'pending',
      },
      {
        id: '2',
        first_name: 'Sarah',
        last_name: 'Smith',
        gender: 'female',
        date_of_birth: '2014-07-22',
        primary_name: 'John Smith',
        primary_email: 'john.smith@example.com',
        class_name: 'Grade 2B',
        status: 'pending',
      },
      {
        id: '3',
        first_name: 'Mike',
        last_name: 'Johnson',
        gender: 'male',
        date_of_birth: '2015-01-10',
        primary_name: 'Emily Johnson',
        primary_email: 'emily.j@example.com',
        class_name: 'Grade 1A',
        status: 'pending',
      },
    ];

    return {
      id: 'onboarding-1',
      school_id: 'school-1',
      school: {
        id: 'school-1',
        name: schoolName,
        picture_url: URL.createObjectURL(schoolPicture),
        created_at: new Date().toISOString(),
      },
      records: mockRecords,
      created_at: new Date().toISOString(),
      status: 'draft',
    };
  },

  // Update a record
  updateRecord: async (
    onboardingId: string,
    recordId: string,
    updates: Partial<SchoolOnboardingRecord>
  ): Promise<SchoolOnboardingRecord> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return { ...updates, id: recordId } as SchoolOnboardingRecord;
  },

  // Delete a record
  deleteRecord: async (onboardingId: string, recordId: string): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 300));
  },

  // Create a new record
  createRecord: async (
    onboardingId: string,
    record: Omit<SchoolOnboardingRecord, 'id'>
  ): Promise<SchoolOnboardingRecord> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      ...record,
      id: `record-${Date.now()}`,
    };
  },

  // Validate records (send emails)
  validateRecords: async (
    onboardingId: string,
    recordIds?: string[]
  ): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 1500));
  },

  // Submit records to core system
  submitRecords: async (
    onboardingId: string,
    recordIds?: string[]
  ): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 2000));
  },

  // Create classes in core system
  createClasses: async (
    onboardingId: string,
    classes: ClassSummary[]
  ): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 1500));
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
