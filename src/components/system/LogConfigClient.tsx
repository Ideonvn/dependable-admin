'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, FileText, Plus, Pencil, Eye, EyeOff, Trash2, X, Check } from 'lucide-react';
import { logConfigApi, LogField, LogOption, CreateOptionPayload, UpdateFieldPayload } from '@/lib/logConfig';

// ── Helpers ───────────────────────────────────────────────────────────────

const FIELD_TYPE_LABELS: Record<string, string> = {
  'tile-select': 'Tile Select',
  text: 'Text',
  time: 'Time',
  'time-range': 'Time Range',
  'editable-slider': 'Editable Slider',
};

function groupBySource(fields: LogField[]): Record<string, LogField[]> {
  return fields.reduce<Record<string, LogField[]>>((acc, f) => {
    (acc[f.log_source] ??= []).push(f);
    return acc;
  }, {});
}

// ── Toast ─────────────────────────────────────────────────────────────────

type Toast = { id: string; message: string; variant: 'success' | 'error' };

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((message: string, variant: Toast['variant'] = 'success') => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((c) => [...c, { id, message, variant }]);
    setTimeout(() => setToasts((c) => c.filter((t) => t.id !== id)), 4000);
  }, []);
  const remove = useCallback((id: string) => setToasts((c) => c.filter((t) => t.id !== id)), []);
  return { toasts, add, remove };
}

// ── Main component ────────────────────────────────────────────────────────

export default function LogConfigClient() {
  const [fields, setFields] = useState<LogField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<string | null>(null);

  // Options state: keyed by "source:fieldName"
  const [optionsMap, setOptionsMap] = useState<Record<string, LogOption[]>>({});
  const [optionsLoading, setOptionsLoading] = useState<Record<string, boolean>>({});

  // Edit-field modal state
  const [editingField, setEditingField] = useState<LogField | null>(null);
  const [editForm, setEditForm] = useState<UpdateFieldPayload>({});
  const [editSaving, setEditSaving] = useState(false);

  // Add-field modal state
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [addFieldForm, setAddFieldForm] = useState({
    field_name: '',
    label: '',
    field_type: 'tile-select' as LogField['field_type'],
    sort_order: 0,
    is_source_attribute: false,
    is_required: false,
    is_hidden: false,
  });
  const [addFieldSaving, setAddFieldSaving] = useState(false);

  // Add-option modal state
  const [addOptionField, setAddOptionField] = useState<LogField | null>(null);
  const [addOptionForm, setAddOptionForm] = useState({ value: '', label: '', sort_order: 0 });
  const [addOptionSaving, setAddOptionSaving] = useState(false);

  // Edit-option inline state
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOptionLabel, setEditingOptionLabel] = useState('');
  const [optionSaving, setOptionSaving] = useState(false);

  const { toasts, add: addToast, remove: removeToast } = useToasts();

  // ── Data loading ────────────────────────────────────────────────────────

  const loadFields = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await logConfigApi.listFields();
      setFields(data);
      setActiveSource((current) => current ?? (data.length > 0 ? data[0].log_source : null));
    } catch {
      setError('Failed to load log config fields. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  const loadOptions = useCallback(
    async (field: LogField) => {
      const key = `${field.log_source}:${field.field_name}`;
      setOptionsMap((current) => {
        if (current[key] !== undefined) return current;
        return current;
      });
      setOptionsLoading((current) => {
        if (current[key]) return current;
        // Trigger fetch outside setState
        return { ...current, [key]: true };
      });
    },
    []
  );

  // Actual fetch triggered when optionsLoading changes to true for a key
  useEffect(() => {
    const pendingKeys = Object.entries(optionsLoading)
      .filter(([key, loading]) => loading && optionsMap[key] === undefined)
      .map(([key]) => key);

    if (pendingKeys.length === 0) return;

    pendingKeys.forEach(async (key) => {
      const [logSource, fieldName] = key.split(':');
      try {
        const data = await logConfigApi.listOptions(logSource, fieldName);
        setOptionsMap((c) => ({ ...c, [key]: data }));
      } catch {
        addToast(`Failed to load options for ${fieldName}`, 'error');
        setOptionsMap((c) => ({ ...c, [key]: [] }));
      } finally {
        setOptionsLoading((c) => ({ ...c, [key]: false }));
      }
    });
  }, [optionsLoading, optionsMap, addToast]);

  // Load options for tile-select fields in active tab
  useEffect(() => {
    if (!activeSource) return;
    fields
      .filter((f) => f.log_source === activeSource && f.field_type === 'tile-select')
      .forEach(loadOptions);
  }, [activeSource, fields, loadOptions]);

  // ── Field actions ───────────────────────────────────────────────────────

  const openEditField = (field: LogField) => {
    setEditingField(field);
    setEditForm({
      label: field.label,
      sort_order: field.sort_order,
      is_required: field.is_required,
      is_hidden: field.is_hidden,
      field_config: field.field_config,
    });
  };

  const saveEditField = async () => {
    if (!editingField) return;
    setEditSaving(true);
    try {
      const updated = await logConfigApi.updateField(editingField.id, editForm);
      setFields((c) => c.map((f) => (f.id === updated.id ? updated : f)));
      setEditingField(null);
      addToast('Field updated successfully.');
    } catch {
      addToast('Failed to update field.', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const saveAddField = async () => {
    if (!activeSource) return;
    setAddFieldSaving(true);
    try {
      const created = await logConfigApi.createField({
        log_source: activeSource,
        field_name: addFieldForm.field_name.trim(),
        label: addFieldForm.label.trim(),
        field_type: addFieldForm.field_type,
        sort_order: addFieldForm.sort_order,
        is_source_attribute: addFieldForm.is_source_attribute,
        is_required: addFieldForm.is_required,
        is_hidden: addFieldForm.is_hidden,
        field_config: null,
      });
      setFields((c) => [...c, created]);
      setAddFieldOpen(false);
      setAddFieldForm({
        field_name: '',
        label: '',
        field_type: 'tile-select',
        sort_order: 0,
        is_source_attribute: false,
        is_required: false,
        is_hidden: false,
      });
      addToast('Field created successfully.');
    } catch {
      addToast('Failed to create field.', 'error');
    } finally {
      setAddFieldSaving(false);
    }
  };

  // ── Option actions ──────────────────────────────────────────────────────

  const saveAddOption = async () => {
    if (!addOptionField) return;
    setAddOptionSaving(true);
    const key = `${addOptionField.log_source}:${addOptionField.field_name}`;
    const payload: CreateOptionPayload = {
      log_source: addOptionField.log_source,
      field_name: addOptionField.field_name,
      value: addOptionForm.value.trim(),
      label: addOptionForm.label.trim() || addOptionForm.value.trim(),
      sort_order: addOptionForm.sort_order,
      is_hidden: false,
    };
    try {
      const created = await logConfigApi.createOption(payload);
      setOptionsMap((c) => ({ ...c, [key]: [...(c[key] ?? []), created] }));
      setAddOptionField(null);
      setAddOptionForm({ value: '', label: '', sort_order: 0 });
      addToast('Option added successfully.');
    } catch {
      addToast('Failed to add option. It may already exist.', 'error');
    } finally {
      setAddOptionSaving(false);
    }
  };

  const startEditOption = (option: LogOption) => {
    setEditingOptionId(option.id);
    setEditingOptionLabel(option.label);
  };

  const saveEditOption = async (option: LogOption) => {
    const key = `${option.log_source}:${option.field_name}`;
    setOptionSaving(true);
    try {
      const updated = await logConfigApi.updateOption(option.id, { label: editingOptionLabel });
      setOptionsMap((c) => ({
        ...c,
        [key]: (c[key] ?? []).map((o) => (o.id === updated.id ? updated : o)),
      }));
      setEditingOptionId(null);
      addToast('Option updated.');
    } catch {
      addToast('Failed to update option.', 'error');
    } finally {
      setOptionSaving(false);
    }
  };

  const toggleHideOption = async (option: LogOption) => {
    const key = `${option.log_source}:${option.field_name}`;
    try {
      const updated = await logConfigApi.updateOption(option.id, { is_hidden: !option.is_hidden });
      setOptionsMap((c) => ({
        ...c,
        [key]: (c[key] ?? []).map((o) => (o.id === updated.id ? updated : o)),
      }));
      addToast(updated.is_hidden ? 'Option hidden.' : 'Option shown.');
    } catch {
      addToast('Failed to update option.', 'error');
    }
  };

  const deleteOption = async (option: LogOption) => {
    const key = `${option.log_source}:${option.field_name}`;
    try {
      await logConfigApi.deleteOption(option.id);
      setOptionsMap((c) => ({
        ...c,
        [key]: (c[key] ?? []).filter((o) => o.id !== option.id),
      }));
      addToast('Option deleted.');
    } catch {
      addToast('Failed to delete option.', 'error');
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────

  const grouped = groupBySource(fields);
  const sources = Object.keys(grouped).sort();
  const activeFields = activeSource
    ? (grouped[activeSource] ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
    : [];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-[#0F1115]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-[#1A1A6D] dark:text-[#20B2AA]" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Log Config</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Manage log fields and selectable options across all log sources
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadFields}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Schools
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Source tabs */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
            {sources.map((source) => (
              <button
                key={source}
                onClick={() => setActiveSource(source)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap capitalize transition-colors border-b-2 -mb-px ${
                  activeSource === source
                    ? 'border-[#1A1A6D] dark:border-[#20B2AA] text-[#1A1A6D] dark:text-[#20B2AA]'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                {source}
              </button>
            ))}
          </div>

          {/* Add field button */}
          {activeSource && (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setAddFieldOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1A1A6D] dark:bg-[#20B2AA] rounded-lg hover:opacity-90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Field
              </button>
            </div>
          )}

          {/* Fields table */}
          <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="min-w-full w-full">
                <thead className="bg-gray-100 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Field Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Label</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Sort</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Required</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Hidden</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {activeFields.map((field) => (
                    <>
                      <tr
                        key={field.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">{field.field_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium">{field.label}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {FIELD_TYPE_LABELS[field.field_type] ?? field.field_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{field.sort_order}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${field.is_required ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                            {field.is_required ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${field.is_hidden ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                            {field.is_hidden ? 'Hidden' : 'Visible'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => openEditField(field)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                        </td>
                      </tr>
                      {field.field_type === 'tile-select' && (
                        <tr key={`${field.id}-options`} className="bg-gray-50/50 dark:bg-gray-900/20">
                          <td colSpan={7} className="px-8 py-4">
                            <OptionsSection
                              field={field}
                              options={optionsMap[`${field.log_source}:${field.field_name}`]}
                              loading={!!optionsLoading[`${field.log_source}:${field.field_name}`]}
                              editingOptionId={editingOptionId}
                              editingOptionLabel={editingOptionLabel}
                              optionSaving={optionSaving}
                              onEditStart={startEditOption}
                              onEditLabelChange={setEditingOptionLabel}
                              onEditCancel={() => setEditingOptionId(null)}
                              onEditSave={saveEditOption}
                              onToggleHide={toggleHideOption}
                              onDelete={deleteOption}
                              onAddClick={() => {
                                setAddOptionField(field);
                                setAddOptionForm({ value: '', label: '', sort_order: 0 });
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {activeFields.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-600 dark:text-gray-400">
                        No fields for this log source.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Edit Field Modal */}
      {editingField && (
        <Modal title="Edit Field" onClose={() => setEditingField(null)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label</label>
              <input
                value={editForm.label ?? ''}
                onChange={(e) => setEditForm((c) => ({ ...c, label: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sort Order</label>
              <input
                type="number"
                value={editForm.sort_order ?? 0}
                onChange={(e) => setEditForm((c) => ({ ...c, sort_order: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex items-center gap-4 mt-7">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.is_required ?? false}
                  onChange={(e) => setEditForm((c) => ({ ...c, is_required: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-700"
                />
                Required
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.is_hidden ?? false}
                  onChange={(e) => setEditForm((c) => ({ ...c, is_hidden: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-700"
                />
                Hidden
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setEditingField(null)}
              disabled={editSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={saveEditField}
              disabled={editSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1A1A6D] dark:bg-[#20B2AA] rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {editSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Save Changes
            </button>
          </div>
        </Modal>
      )}

      {/* Add Field Modal */}
      {addFieldOpen && activeSource && (
        <Modal title={`Add Field — ${activeSource}`} onClose={() => setAddFieldOpen(false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Field Name <span className="text-xs text-gray-500">(snake_case)</span>
              </label>
              <input
                value={addFieldForm.field_name}
                onChange={(e) => setAddFieldForm((c) => ({ ...c, field_name: e.target.value }))}
                placeholder="e.g. mood_after"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label</label>
              <input
                value={addFieldForm.label}
                onChange={(e) => setAddFieldForm((c) => ({ ...c, label: e.target.value }))}
                placeholder="e.g. Mood After"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field Type</label>
              <select
                value={addFieldForm.field_type}
                onChange={(e) => setAddFieldForm((c) => ({ ...c, field_type: e.target.value as LogField['field_type'] }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                {Object.entries(FIELD_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sort Order</label>
              <input
                type="number"
                value={addFieldForm.sort_order}
                onChange={(e) => setAddFieldForm((c) => ({ ...c, sort_order: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addFieldForm.is_required}
                  onChange={(e) => setAddFieldForm((c) => ({ ...c, is_required: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-700"
                />
                Required
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addFieldForm.is_hidden}
                  onChange={(e) => setAddFieldForm((c) => ({ ...c, is_hidden: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-700"
                />
                Hidden
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addFieldForm.is_source_attribute}
                  onChange={(e) => setAddFieldForm((c) => ({ ...c, is_source_attribute: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-700"
                />
                Source Attribute
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setAddFieldOpen(false)}
              disabled={addFieldSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={saveAddField}
              disabled={addFieldSaving || !addFieldForm.field_name.trim() || !addFieldForm.label.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1A1A6D] dark:bg-[#20B2AA] rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {addFieldSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Create Field
            </button>
          </div>
        </Modal>
      )}

      {/* Add Option Modal */}
      {addOptionField && (
        <Modal title={`Add Option — ${addOptionField.label}`} onClose={() => setAddOptionField(null)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value</label>
              <input
                value={addOptionForm.value}
                onChange={(e) => {
                  const v = e.target.value;
                  setAddOptionForm((c) => ({ ...c, value: v, label: c.label || v }));
                }}
                placeholder="e.g. Yoga"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Label <span className="text-xs text-gray-500">(defaults to value)</span>
              </label>
              <input
                value={addOptionForm.label}
                onChange={(e) => setAddOptionForm((c) => ({ ...c, label: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sort Order</label>
              <input
                type="number"
                value={addOptionForm.sort_order}
                onChange={(e) => setAddOptionForm((c) => ({ ...c, sort_order: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setAddOptionField(null)}
              disabled={addOptionSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={saveAddOption}
              disabled={addOptionSaving || !addOptionForm.value.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1A1A6D] dark:bg-[#20B2AA] rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {addOptionSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Add Option
            </button>
          </div>
        </Modal>
      )}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-sm w-full px-4 py-3 rounded-lg shadow-lg border bg-white dark:bg-[#111217] border-gray-200 dark:border-gray-800 ${
              t.variant === 'success'
                ? 'ring-2 ring-green-500 dark:ring-green-400'
                : 'ring-2 ring-red-500 dark:ring-red-400'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">{t.message}</div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-2xl w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

interface OptionsSectionProps {
  field: LogField;
  options: LogOption[] | undefined;
  loading: boolean;
  editingOptionId: string | null;
  editingOptionLabel: string;
  optionSaving: boolean;
  onEditStart: (o: LogOption) => void;
  onEditLabelChange: (v: string) => void;
  onEditCancel: () => void;
  onEditSave: (o: LogOption) => void;
  onToggleHide: (o: LogOption) => void;
  onDelete: (o: LogOption) => void;
  onAddClick: () => void;
}

function OptionsSection({
  options,
  loading,
  editingOptionId,
  editingOptionLabel,
  optionSaving,
  onEditStart,
  onEditLabelChange,
  onEditCancel,
  onEditSave,
  onToggleHide,
  onDelete,
  onAddClick,
}: OptionsSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Options
        </span>
        <button
          onClick={onAddClick}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#1A1A6D] dark:text-[#20B2AA] border border-[#1A1A6D] dark:border-[#20B2AA] rounded hover:bg-blue-50 dark:hover:bg-teal-950/30 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Option
        </button>
      </div>

      {loading && (
        <div className="text-xs text-gray-500 dark:text-gray-400 py-2">Loading options…</div>
      )}

      {!loading && options && options.length === 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 py-2">No options yet.</div>
      )}

      {!loading && options && options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <div
              key={opt.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-opacity ${
                opt.is_hidden
                  ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20 opacity-50'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
              }`}
            >
              {editingOptionId === opt.id ? (
                <>
                  <input
                    autoFocus
                    value={editingOptionLabel}
                    onChange={(e) => onEditLabelChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onEditSave(opt);
                      if (e.key === 'Escape') onEditCancel();
                    }}
                    className="w-32 px-1 py-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    onClick={() => onEditSave(opt)}
                    disabled={optionSaving}
                    className="text-green-600 dark:text-green-400 hover:text-green-800 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={onEditCancel} className="text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-gray-800 dark:text-gray-200">{opt.label}</span>
                  <button
                    onClick={() => onEditStart(opt)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-1"
                    title="Edit label"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onToggleHide(opt)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    title={opt.is_hidden ? 'Show' : 'Hide'}
                  >
                    {opt.is_hidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => onDelete(opt)}
                    className="text-red-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
