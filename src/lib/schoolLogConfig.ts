import api from './api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SchoolLogField {
  id: string;
  log_source: string;
  field_name: string;
  label: string;
  field_type: string;
  sort_order: number;
  is_source_attribute: boolean;
  is_required: boolean;
  is_hidden: boolean;
  field_config: Record<string, unknown> | null;
}

export interface MergedLogOption {
  value: string;
  label: string;
  sort_order: number;
  is_hidden: boolean;
  origin: 'GLOBAL' | 'SCHOOL';
  global_option_id: string | null;
  school_option_id: string | null;
}

export interface CreateSchoolOptionPayload {
  log_source: string;
  field_name: string;
  value: string;
  label: string;
  is_hidden?: boolean;
}

export interface UpdateSchoolOptionPayload {
  label?: string;
  sort_order?: number;
  is_hidden?: boolean;
}

// ── API ───────────────────────────────────────────────────────────────────

export const schoolLogConfigApi = {
  listFields: (schoolId: string): Promise<SchoolLogField[]> =>
    api.get<SchoolLogField[]>(`/schools/${schoolId}/log-config/fields`).then((r) => r.data),

  listOptions: (schoolId: string, logSource: string, fieldName: string): Promise<MergedLogOption[]> =>
    api
      .get<MergedLogOption[]>(`/schools/${schoolId}/log-config/options`, {
        params: { log_source: logSource, field_name: fieldName },
      })
      .then((r) => r.data),

  createOption: (schoolId: string, payload: CreateSchoolOptionPayload): Promise<{ id: string }> =>
    api.post<{ id: string }>(`/schools/${schoolId}/log-options`, payload).then((r) => r.data),

  updateOption: (schoolId: string, schoolOptionId: string, payload: UpdateSchoolOptionPayload): Promise<void> =>
    api.patch(`/schools/${schoolId}/log-options/${schoolOptionId}`, payload).then(() => undefined),

  deleteOption: (schoolId: string, schoolOptionId: string): Promise<void> =>
    api.delete(`/schools/${schoolId}/log-options/${schoolOptionId}`).then(() => undefined),
};
