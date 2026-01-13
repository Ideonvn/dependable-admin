import { School, SchoolOnboarding } from './schoolOnboarding';

// Extend the School type to include onboarding stats
export interface SchoolWithStats extends School {
  total_students: number;
  pending_students: number;
  validated_students: number;
  submitted_students: number;
  last_activity?: string;
  onboarding_status?: 'draft' | 'validating' | 'validated' | 'submitted' | 'completed';
}

// Mock API for schools
export const schoolsApi = {
  // Get all schools
  getAllSchools: async (): Promise<SchoolWithStats[]> => {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return [
      {
        id: 'school-1',
        name: 'Sunnydale Primary School',
        picture_url: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=400',
        created_at: '2024-01-15T10:00:00Z',
        total_students: 245,
        pending_students: 12,
        validated_students: 200,
        submitted_students: 33,
        last_activity: '2024-01-20T14:30:00Z',
        onboarding_status: 'validating',
      },
      {
        id: 'school-2',
        name: 'Riverside High School',
        picture_url: 'https://images.unsplash.com/photo-1562774053-701939374585?w=400',
        created_at: '2024-01-10T09:00:00Z',
        total_students: 420,
        pending_students: 0,
        validated_students: 0,
        submitted_students: 420,
        last_activity: '2024-01-18T11:00:00Z',
        onboarding_status: 'completed',
      },
      {
        id: 'school-3',
        name: 'Maple Grove Elementary',
        picture_url: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400',
        created_at: '2024-01-12T08:30:00Z',
        total_students: 180,
        pending_students: 45,
        validated_students: 135,
        submitted_students: 0,
        last_activity: '2024-01-19T16:45:00Z',
        onboarding_status: 'draft',
      },
      {
        id: 'school-4',
        name: 'Oakwood Academy',
        picture_url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400',
        created_at: '2024-01-08T11:15:00Z',
        total_students: 312,
        pending_students: 0,
        validated_students: 312,
        submitted_students: 0,
        last_activity: '2024-01-21T09:20:00Z',
        onboarding_status: 'validated',
      },
    ];
  },

  // Get a specific school
  getSchool: async (schoolId: string): Promise<SchoolWithStats | null> => {
    const schools = await schoolsApi.getAllSchools();
    return schools.find(s => s.id === schoolId) || null;
  },
};
