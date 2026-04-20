import { SchoolOnboardingRecord, ClassSummary } from './schoolOnboarding';
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

// API Response types for onboarding
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
  image_filename: string | null;
  statistics: SchoolStatistics;
  last_activity?: string;
}

// API Response types for main schools view
export interface SchoolStudentsOverview {
  presence_status: {
    checked_in: number;
    checked_out: number;
    absent: number;
  };
  status: {
    active: number;
    left: number;
    graduated: number;
  };
  body_check: {
    checked: number;
    markers: number;
  };
}

export interface School {
  id: string;
  name: string;
  image_filename: string | null;
  students_overview: SchoolStudentsOverview;
}

export interface Student {
  id: string;
  dependant_id: string;
  external_ref: string | null;
  admitted_on: string | null;
  status: 'active' | 'left' | 'graduated';
  full_name: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  image_filename: string | null;
  presence_status: 'in' | 'out' | 'unknown';
  presence_changed_at: string | null;
  last_checkin_at: string | null;
  last_checkout_at: string | null;
}

// Extended student details for edit/manage screen
export interface StudentDetails {
  id: string;
  dependant_id: string;
  external_ref: string | null;
  admitted_on: string | null;
  status: 'active' | 'left' | 'graduated';
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string; // YYYY-MM-DD
  weight_at_birth: number | null;
  length_at_birth: number | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  image_filename: string | null;
}

export interface StudentUpdatePayload {
  external_ref?: string | null;
  admitted_on?: string | null;
  status?: 'active' | 'left' | 'graduated';
}

export interface StudentContact {
  id: string;
  student_id: string;
  person_id: string;
  email: string | null;
  full_name: string;
  first_name: string;
  last_name: string;
  id_country: string | null;
  id_type: string | null;
  id_full: string | null;
  id_masked: string | null;
  role: string; // e.g., GUARDIAN
  primary: boolean;
  can_check_in_out: boolean;
  can_view_records: boolean;
  can_receive_notifications: boolean;
  valid_from: string | null;
  valid_to: string | null;
  notes: string | null;
  image_filename: string | null;
}

export interface StudentEnrollment {
  id: string;
  student_id: string;
  classroom: {
    id: string;
    name: string;
    primary_teacher_id: string | null;
    is_active: boolean;
    image_filename: string | null;
  };
  school_year: {
    id: string;
    name: string;
    starts_on: string;
    ends_on: string;
  };
  starts_on: string; // YYYY-MM-DD
  ends_on: string | null; // YYYY-MM-DD
  status: 'enrolled' | 'withdrawn' | 'transferred' | string;
}

export interface AttendanceEvent {
  id: string;
  event_type: 'check_in' | 'check_out';
  occurred_at: string; // ISO datetime
  performed_by: string;
  handed_over_by: string;
  notes: string | null;
}

export interface BodyCheckMarker {
  id: string;
  x_marker: number; // normalized 0..1
  y_marker: number; // normalized 0..1
  note: string;
  marker_name?: string;
  marker_type?: string;
  severity?: string;
}

export interface AttendanceBodyCheck {
  id: string;
  checked_at: string; // ISO datetime
  performed_by: string;
  front: BodyCheckMarker[];
  back: BodyCheckMarker[];
}

export interface AttendanceCalendarDay {
  day: number;
  attendances: AttendanceEvent[];
  body_checks: AttendanceBodyCheck[];
}

export interface AttendanceCalendarMonth {
  year: number;
  month: number;
  events: AttendanceCalendarDay[];
}

export interface Membership {
  id: string;
  user_id: string;
  school_id: string;
  role: 'ADMIN' | 'TEACHER' | 'STAFF';
  status: 'active' | 'inactive';
  started_at: string;
  ended_at: string | null;
  full_name: string;
  image_filename: string | null;
}

export interface ClassroomStudentsOverview {
  presence_status: {
    checked_in: number;
    checked_out: number;
    absent: number;
  };
  status: {
    enrolled: number;
    withdrawn: number;
    transferred: number;
  };
  body_check: {
    checked: number;
    markers: number;
  };
}

export interface Classroom {
  id: string;
  name: string;
  primary_teacher_id: string | null;
  is_active: boolean;
  image_filename: string | null;
  students_overview: ClassroomStudentsOverview;
}

// Classroom teacher assignment response shape
export interface ClassroomTeacherAssignment {
  classroom_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  full_name: string;
  image_filename: string | null;
}

export interface EnrolledStudent {
  student_id: string;
  full_name: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  started_at: string;
  ended_at: string | null;
}

export interface ClassroomEnrollment {
  id: string;
  name: string;
  students: EnrolledStudent[];
}

export interface EnrollmentsResponse {
  classrooms: ClassroomEnrollment[];
  unassigned_students: EnrolledStudent[];
}

export interface SchoolYear {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
}

export type SchoolReportStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | '';

export interface SchoolReportResponse {
  status: SchoolReportStatus;
  message: string;
  download_url: string | null;
  ready: boolean;
}

// API for schools
export const schoolsApi = {
  // Get all schools (main view with students overview)
  getAllSchools: async (): Promise<School[]> => {
    const response = await apiClient.get<School[]>('/schools/');
    return response.data;
  },

  // ===== Students - Manage =====
  getStudentDetails: async (schoolId: string, studentId: string): Promise<StudentDetails> => {
    try {
      const response = await apiClient.get<{
        id: string;
        dependant_id: string;
        external_ref: string | null;
        admitted_on: string | null;
        status: 'active' | 'left' | 'graduated';
        full_name: string;
        gender: 'MALE' | 'FEMALE' | 'OTHER';
        image_filename: string | null;
        dependant: {
          id: string;
          first_name: string;
          last_name: string;
          gender: 'MALE' | 'FEMALE' | 'OTHER';
          date_of_birth: string;
          weight_at_birth: number;
          length_at_birth: number;
          image_filename: string | null;
        };
      }>(`/schools/${schoolId}/students/${studentId}`);
      
      const data = response.data;
      return {
        id: data.id,
        dependant_id: data.dependant_id,
        external_ref: data.external_ref,
        admitted_on: data.admitted_on,
        status: data.status,
        first_name: data.dependant.first_name,
        last_name: data.dependant.last_name,
        full_name: data.full_name,
        date_of_birth: data.dependant.date_of_birth,
        weight_at_birth: data.dependant.weight_at_birth,
        length_at_birth: data.dependant.length_at_birth,
        gender: data.dependant.gender,
        image_filename: data.dependant.image_filename,
      };
    } catch (error) {
      console.error('Error fetching student details:', error);
      throw error;
    }
  },

  updateDependant: async (
    dependantId: string,
    data: Partial<Pick<StudentDetails, 'first_name' | 'last_name' | 'date_of_birth' | 'weight_at_birth' | 'length_at_birth' | 'gender'>>
  ): Promise<{ message: string }> => {
    try {
      const response = await apiClient.put<{ message: string }>(
        `/dependants/${dependantId}`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Error updating dependant:', error);
      throw error;
    }
  },

  updateStudent: async (
    schoolId: string,
    studentId: string,
    data: StudentUpdatePayload
  ): Promise<{ message: string }> => {
    try {
      const response = await apiClient.put<{ message: string }>(
        `/schools/${schoolId}/students/${studentId}`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Error updating student:', error);
      throw error;
    }
  },

  uploadStudentImage: async (
    dependantId: string,
    file: File
  ): Promise<{ message: string }> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post<{ message: string }>(
        `/dependants/${dependantId}/profile/image`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error uploading student image:', error);
      throw error;
    }
  },

  getStudentContacts: async (schoolId: string, studentId: string): Promise<StudentContact[]> => {
    try {
      const response = await apiClient.get<StudentContact[]>(
        `/schools/${schoolId}/students/${studentId}/contacts`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching student contacts:', error);
      return [];
    }
  },

  getStudentEnrollments: async (
    schoolId: string,
    studentId: string
  ): Promise<StudentEnrollment[]> => {
    try {
      const response = await apiClient.get<StudentEnrollment[]>(
        `/schools/${schoolId}/students/${studentId}/enrollments`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching student enrollments:', error);
      return [];
    }
  },

  createStudentContact: async (
    schoolId: string,
    studentId: string,
    data: {
      first_name: string;
      last_name: string;
      email?: string | null;
      id_country?: string | null;
      id_type?: string | null;
      id_full?: string | null;
      role: string;
      primary: boolean;
      can_check_in_out: boolean;
      can_view_records: boolean;
      can_receive_notifications: boolean;
      valid_from?: string | null;
      valid_to?: string | null;
      notes?: string | null;
    }
  ): Promise<StudentContact> => {
    try {
      const response = await apiClient.post<StudentContact>(
        `/schools/${schoolId}/students/${studentId}/contacts`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Error creating student contact:', error);
      throw error;
    }
  },

  updateStudentContact: async (
    schoolId: string,
    studentId: string,
    contactId: string,
    data: {
      person_id: string;
      email?: string | null;
      full_name: string;
      first_name: string;
      last_name: string;
      id_country?: string | null;
      id_type?: string | null;
      id_full?: string | null;
      id_masked?: string | null;
      role: string;
      primary: boolean;
      can_check_in_out: boolean;
      can_view_records: boolean;
      can_receive_notifications: boolean;
      valid_from?: string | null;
      valid_to?: string | null;
      notes?: string | null;
      image_filename?: string | null;
    }
  ): Promise<StudentContact> => {
    try {
      const response = await apiClient.put<StudentContact>(
        `/schools/${schoolId}/students/${studentId}/contacts/${contactId}`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Error updating student contact:', error);
      throw error;
    }
  },

  getStudentAttendanceCalendar: async (
    schoolId: string,
    studentId: string,
    year: number,
    month: number
  ): Promise<AttendanceCalendarMonth> => {
    try {
      const response = await apiClient.get<AttendanceCalendarMonth>(
        `/schools/${schoolId}/students/${studentId}/attendance/calendar`,
        { params: { year, month } }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching attendance calendar:', error);
      throw error;
    }
  },

  // Get a specific school (main view)
  getSchool: async (schoolId: string): Promise<School | null> => {
    try {
      const response = await apiClient.get<School>(`/schools/${schoolId}`);
      return response.data;
    } catch (error) {
      // Return null if school not found
      return null;
    }
  },

  // Get students for a specific school
  getStudents: async (schoolId: string): Promise<Student[]> => {
    try {
      const response = await apiClient.get<Student[]>(`/schools/${schoolId}/students`);
      return response.data;
    } catch (error) {
      console.error('Error fetching students:', error);
      return [];
    }
  },

  // Get memberships for a specific school
  getMemberships: async (schoolId: string): Promise<Membership[]> => {
    try {
      const response = await apiClient.get<Membership[]>(`/schools/${schoolId}/memberships`);
      return response.data;
    } catch (error) {
      console.error('Error fetching memberships:', error);
      return [];
    }
  },

  // Get memberships for a specific school filtered by role
  getMembershipsByRole: async (
    schoolId: string,
    role: 'ADMIN' | 'TEACHER' | 'STAFF'
  ): Promise<Membership[]> => {
    try {
      const response = await apiClient.get<Membership[]>(
        `/schools/${schoolId}/memberships`,
        { params: { role } }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching memberships by role:', error);
      return [];
    }
  },

  // Add a new member to a school
  addMember: async (
    schoolId: string,
    data: {
      email: string;
      role: 'ADMIN' | 'TEACHER' | 'STAFF';
    }
  ): Promise<Membership> => {
    const response = await apiClient.post<Membership>(
      `/schools/${schoolId}/memberships`,
      data
    );
    return response.data;
  },

  // Update a member in a school
  updateMember: async (
    schoolId: string,
    memberId: string,
    data: {
      user_id: string;
      role: 'ADMIN' | 'TEACHER' | 'STAFF';
      status: 'active' | 'inactive' | 'invited';
    }
  ): Promise<Membership> => {
    const response = await apiClient.put<Membership>(
      `/schools/${schoolId}/memberships/${memberId}`,
      data
    );
    return response.data;
  },

  // Get classrooms for a specific school
  getClassrooms: async (schoolId: string): Promise<Classroom[]> => {
    try {
      const response = await apiClient.get<Classroom[]>(`/schools/${schoolId}/classrooms`);
      return response.data;
    } catch (error) {
      console.error('Error fetching classrooms:', error);
      return [];
    }
  },

  // Get classroom enrollments for a specific school
  getEnrollments: async (schoolId: string): Promise<EnrollmentsResponse> => {
    try {
      const response = await apiClient.get<EnrollmentsResponse>(`/schools/${schoolId}/classrooms/enrollments`);
      return response.data;
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      return { classrooms: [], unassigned_students: [] };
    }
  },

  // Enroll a new student in a classroom
  enrollStudent: async (
    schoolId: string,
    classroomId: string,
    data: {
      first_name: string;
      last_name: string;
      gender: 'MALE' | 'FEMALE' | 'OTHER';
      date_of_birth: string;
      weight_at_birth?: number | null;
      length_at_birth?: number | null;
      student: {
        external_ref: string;
        admitted_on: string;
      };
      student_contact: {
        email: string;
        first_name: string;
        last_name: string;
        role: string;
        primary: boolean;
        can_check_in_out: boolean;
        can_view_records: boolean;
        can_receive_notifications: boolean;
        id_country?: string | null;
        id_type?: string | null;
        id_full?: string | null;
      };
    }
  ): Promise<Student> => {
    const response = await apiClient.post<Student>(
      `/schools/${schoolId}/classrooms/${classroomId}/enrollments`,
      data
    );
    return response.data;
  },

  // Update student enrollments
  updateEnrollments: async (
    schoolId: string, 
    updates: {
      starts_on: string;
      ends_on: string | null;
      enrollments: { student_id: string; classroom_id: string | null }[];
    }
  ): Promise<EnrollmentsResponse> => {
    const response = await apiClient.patch<EnrollmentsResponse>(
      `/schools/${schoolId}/classrooms/enrollments`,
      updates
    );
    return response.data;
  },

  // Update school details
  updateSchool: async (schoolId: string, data: { name: string }): Promise<School> => {
    const response = await apiClient.put<School>(`/schools/${schoolId}`, data);
    return response.data;
  },

  // Upload school profile image
  uploadSchoolImage: async (schoolId: string, file: File): Promise<{ message: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<{ message: string }>(
      `/schools/${schoolId}/profile/image`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  // Create a new classroom
  createClassroom: async (
    schoolId: string,
    data: {
      name: string;
      primary_teacher_id?: string | null;
    }
  ): Promise<Classroom> => {
    const response = await apiClient.post<Classroom>(
      `/schools/${schoolId}/classrooms`,
      data
    );
    return response.data;
  },

  // Get a specific classroom with details
  getClassroom: async (schoolId: string, classroomId: string): Promise<Classroom> => {
    const response = await apiClient.get<Classroom>(
      `/schools/${schoolId}/classrooms/${classroomId}`
    );
    return response.data;
  },

  // Update classroom details
  updateClassroom: async (
    schoolId: string,
    classroomId: string,
    data: {
      name?: string;
      primary_teacher_id?: string | null;
      is_active?: boolean;
    }
  ): Promise<Classroom> => {
    const response = await apiClient.put<Classroom>(
      `/schools/${schoolId}/classrooms/${classroomId}`,
      data
    );
    return response.data;
  },

  // Upload classroom profile image
  uploadClassroomImage: async (schoolId: string, classroomId: string, file: File): Promise<{ message: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<{ message: string }>(
      `/schools/${schoolId}/classrooms/${classroomId}/profile/image`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  // Get teachers assigned to a classroom
  getClassroomTeachers: async (schoolId: string, classroomId: string): Promise<ClassroomTeacherAssignment[]> => {
    try {
      const response = await apiClient.get<ClassroomTeacherAssignment[]>(
        `/schools/${schoolId}/classrooms/${classroomId}/teachers`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching classroom teachers:', error);
      return [];
    }
  },

  // Assign a teacher to a classroom
  assignTeacherToClassroom: async (
    schoolId: string,
    classroomId: string,
    userId: string,
    startedAt?: string | null
  ): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(
      `/schools/${schoolId}/classrooms/${classroomId}/teachers`,
      {
        user_id: userId,
        started_at: startedAt || null,
      }
    );
    return response.data;
  },

  // Unassign a teacher from a classroom
  unassignTeacherFromClassroom: async (
    schoolId: string,
    classroomId: string,
    userId: string
  ): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(
      `/schools/${schoolId}/classrooms/${classroomId}/teachers/${userId}`
    );
    return response.data;
  },

  // Get school years for a specific school
  getSchoolYears: async (schoolId: string): Promise<SchoolYear[]> => {
    try {
      const response = await apiClient.get<SchoolYear[]>(`/schools/${schoolId}/years`);
      return response.data;
    } catch (error) {
      console.error('Error fetching school years:', error);
      return [];
    }
  },

  // Create a new school year
  createSchoolYear: async (
    schoolId: string,
    data: {
      name: string;
      starts_on: string;
      ends_on: string;
    }
  ): Promise<SchoolYear> => {
    const response = await apiClient.post<SchoolYear>(
      `/schools/${schoolId}/years`,
      data
    );
    return response.data;
  },

  // Update a school year
  updateSchoolYear: async (
    schoolId: string,
    yearId: string,
    data: {
      name: string;
      starts_on: string;
      ends_on: string;
    }
  ): Promise<SchoolYear> => {
    const response = await apiClient.put<SchoolYear>(
      `/schools/${schoolId}/years/${yearId}`,
      data
    );
    return response.data;
  },

  // Request a school report generation
  requestSchoolReport: async (schoolId: string): Promise<SchoolReportResponse> => {
    const response = await apiClient.post<SchoolReportResponse>(
      `/schools/${schoolId}/report/download`,
      {}
    );
    return response.data;
  },

  // Check school report generation status
  getSchoolReportStatus: async (schoolId: string): Promise<SchoolReportResponse> => {
    const response = await apiClient.get<SchoolReportResponse>(
      `/schools/${schoolId}/report/download`
    );
    return response.data;
  },
};

// API for school onboarding
export const onboardingApi = {
  // Get all schools with onboarding statistics
  getAllSchools: async (): Promise<SchoolWithStats[]> => {
    const response = await apiClient.get<SchoolWithStats[]>('/admin/onboarding/schools');
    return response.data;
  },

  // Get a specific school with onboarding stats
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
