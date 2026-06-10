import api from './api';

// ── Types ──────────────────────────────────────────────────────────────────

export type FieldType = 'tile-select' | 'text' | 'time' | 'time-range' | 'editable-slider';

export interface LogField {
  id: string;
  log_source: string;
  field_name: string;
  label: string;
  field_type: FieldType;
  sort_order: number;
  is_source_attribute: boolean;
  is_required: boolean;
  is_hidden: boolean;
  field_config: Record<string, unknown> | null;
}

export interface LogOption {
  id: string;
  log_source: string;
  field_name: string;
  scope_type: string;
  scope_id: string | null;
  value: string;
  label: string;
  sort_order: number;
  is_hidden: boolean;
}

export interface CreateFieldPayload {
  log_source: string;
  field_name: string;
  label: string;
  field_type: FieldType;
  sort_order: number;
  is_source_attribute: boolean;
  is_required: boolean;
  is_hidden: boolean;
  field_config: Record<string, unknown> | null;
}

export interface UpdateFieldPayload {
  label?: string;
  sort_order?: number;
  is_required?: boolean;
  is_hidden?: boolean;
  field_config?: Record<string, unknown> | null;
}

export interface CreateOptionPayload {
  log_source: string;
  field_name: string;
  value: string;
  label: string;
  sort_order: number;
  is_hidden: boolean;
}

export interface UpdateOptionPayload {
  label?: string;
  sort_order?: number;
  is_hidden?: boolean;
}

// ── API ───────────────────────────────────────────────────────────────────

export const logConfigApi = {
  listFields: (): Promise<LogField[]> =>
    api.get<LogField[]>('/admin/log-config/fields').then((r) => r.data),

  createField: (payload: CreateFieldPayload): Promise<LogField> =>
    api.post<LogField>('/admin/log-config/fields', payload).then((r) => r.data),

  updateField: (fieldId: string, payload: UpdateFieldPayload): Promise<LogField> =>
    api.patch<LogField>(`/admin/log-config/fields/${fieldId}`, payload).then((r) => r.data),

  listOptions: (logSource: string, fieldName: string): Promise<LogOption[]> =>
    api
      .get<LogOption[]>('/admin/log-config/options', {
        params: { log_source: logSource, field_name: fieldName },
      })
      .then((r) => r.data),

  createOption: (payload: CreateOptionPayload): Promise<LogOption> =>
    api.post<LogOption>('/admin/log-config/options', payload).then((r) => r.data),

  updateOption: (optionId: string, payload: UpdateOptionPayload): Promise<LogOption> =>
    api.patch<LogOption>(`/admin/log-config/options/${optionId}`, payload).then((r) => r.data),

  deleteOption: (optionId: string): Promise<void> =>
    api.delete(`/admin/log-config/options/${optionId}`).then(() => undefined),
};
