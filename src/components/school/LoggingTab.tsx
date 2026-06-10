'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Eye, EyeOff, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import { schoolLogConfigApi, MergedLogOption, SchoolLogField } from '@/lib/schoolLogConfig';

// ── Helpers ────────────────────────────────────────────────────────────────

function groupBySource(fields: SchoolLogField[]): Record<string, SchoolLogField[]> {
  return fields.reduce<Record<string, SchoolLogField[]>>((acc, f) => {
    (acc[f.log_source] ??= []).push(f);
    return acc;
  }, {});
}

// ── Toast ──────────────────────────────────────────────────────────────────

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

// ── Main component ─────────────────────────────────────────────────────────

export default function LoggingTab({ schoolId }: { schoolId: string }) {
  const [fields, setFields] = useState<SchoolLogField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<string | null>(null);

  // Options per field key ("source:fieldName")
  const [optionsMap, setOptionsMap] = useState<Record<string, MergedLogOption[]>>({});
  const [optionsLoading, setOptionsLoading] = useState<Record<string, boolean>>({});
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  const fetchedKeysRef = useRef<Set<string>>(new Set());

  const { toasts, add: addToast, remove: removeToast } = useToasts();

  // ── Load fields ───────────────────────────────────────────────────────────

  const loadFields = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await schoolLogConfigApi.listFields(schoolId);
      setFields(data);
      setActiveSource((c) => c ?? (data.length > 0 ? data[0].log_source : null));
    } catch {
      setError('Failed to load log config. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  // ── Load options (lazy, once per key) ─────────────────────────────────────

  const loadOptions = useCallback(
    (field: SchoolLogField) => {
      const key = `${field.log_source}:${field.field_name}`;
      if (fetchedKeysRef.current.has(key)) return;
      fetchedKeysRef.current.add(key);
      setOptionsLoading((c) => ({ ...c, [key]: true }));
      schoolLogConfigApi
        .listOptions(schoolId, field.log_source, field.field_name)
        .then((data) => setOptionsMap((c) => ({ ...c, [key]: data })))
        .catch(() => {
          addToast(`Failed to load options for ${field.label}`, 'error');
          setOptionsMap((c) => ({ ...c, [key]: [] }));
        })
        .finally(() => setOptionsLoading((c) => ({ ...c, [key]: false })));
    },
    [schoolId, addToast]
  );

  const refreshOptions = useCallback(
    async (field: SchoolLogField) => {
      const key = `${field.log_source}:${field.field_name}`;
      setOptionsLoading((c) => ({ ...c, [key]: true }));
      try {
        const data = await schoolLogConfigApi.listOptions(schoolId, field.log_source, field.field_name);
        setOptionsMap((c) => ({ ...c, [key]: data }));
      } catch {
        addToast(`Failed to refresh options for ${field.label}`, 'error');
      } finally {
        setOptionsLoading((c) => ({ ...c, [key]: false }));
      }
    },
    [schoolId, addToast]
  );

  const toggleExpand = (field: SchoolLogField) => {
    const key = `${field.log_source}:${field.field_name}`;
    setExpandedFields((c) => {
      const next = new Set(c);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        loadOptions(field);
      }
      return next;
    });
  };

  // ── Option actions ────────────────────────────────────────────────────────

  const hideGlobalOption = async (field: SchoolLogField, option: MergedLogOption) => {
    try {
      await schoolLogConfigApi.createOption(schoolId, {
        log_source: field.log_source,
        field_name: field.field_name,
        value: option.value,
        label: option.label,
        is_hidden: true,
      });
      await refreshOptions(field);
      addToast('Option hidden for this school.');
    } catch {
      addToast('Failed to hide option.', 'error');
    }
  };

  const unhideGlobalOption = async (field: SchoolLogField, option: MergedLogOption) => {
    if (!option.school_option_id) return;
    try {
      await schoolLogConfigApi.deleteOption(schoolId, option.school_option_id);
      await refreshOptions(field);
      addToast('Option restored to default visibility.');
    } catch {
      addToast('Failed to unhide option.', 'error');
    }
  };

  const deleteSchoolOption = async (field: SchoolLogField, option: MergedLogOption) => {
    if (!option.school_option_id) return;
    try {
      await schoolLogConfigApi.deleteOption(schoolId, option.school_option_id);
      await refreshOptions(field);
      addToast('Option deleted.');
    } catch {
      addToast('Failed to delete option.', 'error');
    }
  };

  const reorderOptions = useCallback(
    async (field: SchoolLogField, reordered: MergedLogOption[]) => {
      const key = `${field.log_source}:${field.field_name}`;
      const withNewOrder = reordered.map((o, i) => ({ ...o, sort_order: i * 10 }));
      setOptionsMap((c) => ({ ...c, [key]: withNewOrder }));
      const schoolOptions = withNewOrder.filter(
        (o, i) => o.school_option_id && o.sort_order !== reordered[i].sort_order
      );
      try {
        await Promise.all(
          schoolOptions.map((o) =>
            schoolLogConfigApi.updateOption(schoolId, o.school_option_id!, { sort_order: o.sort_order })
          )
        );
      } catch {
        setOptionsMap((c) => ({ ...c, [key]: reordered }));
        addToast('Failed to save new order.', 'error');
      }
    },
    [schoolId, addToast]
  );

  // ── Derived ───────────────────────────────────────────────────────────────

  const grouped = groupBySource(fields);
  const sources = Object.keys(grouped)
    .filter((s) => grouped[s].some((f) => f.field_type === 'tile-select'))
    .sort();
  const activeFields = activeSource
    ? (grouped[activeSource] ?? [])
        .filter((f) => f.field_type === 'tile-select')
        .sort((a, b) => a.sort_order - b.sort_order)
    : [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 py-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Source tabs */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

          {activeFields.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
              No tile-select fields for this log source.
            </p>
          )}

          <div className="space-y-3">
            {activeFields.map((field) => {
              const key = `${field.log_source}:${field.field_name}`;
              const expanded = expandedFields.has(key);
              const options = optionsMap[key];
              const optLoading = !!optionsLoading[key];

              return (
                <div
                  key={field.id}
                  className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden"
                >
                  {/* Field header — click to expand */}
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors text-left"
                    onClick={() => toggleExpand(field)}
                  >
                    <div className="flex items-center gap-3">
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="font-medium text-gray-900 dark:text-gray-100">{field.label}</span>
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{field.field_name}</span>
                    </div>
                    {options && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {options.filter((o) => !o.is_hidden).length} visible /{' '}
                        {options.length} total
                      </span>
                    )}
                  </button>

                  {/* Options panel */}
                  {expanded && (
                    <div className="border-t border-gray-200 dark:border-gray-800 px-5 py-4">
                      {optLoading ? (
                        <div className="flex items-center gap-2 py-2 text-sm text-gray-500 dark:text-gray-400">
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          Loading options…
                        </div>
                      ) : (
                        <OptionsPanel
                          field={field}
                          schoolId={schoolId}
                          options={options ?? []}
                          onHide={(opt) => hideGlobalOption(field, opt)}
                          onUnhide={(opt) => unhideGlobalOption(field, opt)}
                          onDelete={(opt) => deleteSchoolOption(field, opt)}
                          onReorder={(reordered) => reorderOptions(field, reordered)}
                          onRefresh={() => refreshOptions(field)}
                          addToast={addToast}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
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
              <button onClick={() => removeToast(t.id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── OptionsPanel ──────────────────────────────────────────────────────────

interface OptionsPanelProps {
  field: SchoolLogField;
  schoolId: string;
  options: MergedLogOption[];
  onHide: (o: MergedLogOption) => void;
  onUnhide: (o: MergedLogOption) => void;
  onDelete: (o: MergedLogOption) => void;
  onReorder: (reordered: MergedLogOption[]) => void;
  onRefresh: () => Promise<void>;
  addToast: (msg: string, variant?: 'success' | 'error') => void;
}

function OptionsPanel({
  field,
  schoolId,
  options,
  onHide,
  onUnhide,
  onDelete,
  onReorder,
  onRefresh,
  addToast,
}: OptionsPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [addValue, setAddValue] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<MergedLogOption | null>(null);

  // Drag state
  const dragIndexRef = useRef<number | null>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const startEdit = (opt: MergedLogOption) => {
    setEditingId(opt.school_option_id);
    setEditLabel(opt.label);
  };

  const saveEdit = async (opt: MergedLogOption) => {
    if (!opt.school_option_id) return;
    setEditSaving(true);
    try {
      await schoolLogConfigApi.updateOption(schoolId, opt.school_option_id, { label: editLabel });
      await onRefresh();
      setEditingId(null);
      addToast('Option updated.');
    } catch {
      addToast('Failed to update option.', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const handleAdd = async () => {
    const trimmed = addValue.trim();
    if (!trimmed) return;
    setAddSaving(true);
    setAddError(null);
    try {
      await schoolLogConfigApi.createOption(schoolId, {
        log_source: field.log_source,
        field_name: field.field_name,
        value: trimmed,
        label: trimmed,
      });
      await onRefresh();
      setAddValue('');
      addToast('Option added.');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setAddError('An option with that name already exists.');
      } else {
        setAddError('Failed to add option. Please try again.');
      }
    } finally {
      setAddSaving(false);
    }
  };

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
    setDragFromIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = dragIndexRef.current;
    if (fromIndex === null || fromIndex === dropIndex) return;
    const reordered = [...options];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    onReorder(reordered);
    dragIndexRef.current = null;
    setDragFromIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragFromIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div>
      {/* Option rows */}
      {options.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No options yet.</p>
      )}

      <div className="divide-y divide-gray-100 dark:divide-gray-800 mb-4">
        {options.map((opt, index) => {
          const isSchool = opt.origin === 'SCHOOL';
          const isEditing = editingId === opt.school_option_id && opt.school_option_id !== null;
          const isDragTarget = dragOverIndex === index && dragFromIndex !== index;

          return (
            <div
              key={opt.value}
              draggable={isSchool && !isEditing}
              onDragStart={() => isSchool && handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 py-2.5 transition-all ${
                isDragTarget ? 'bg-blue-50 dark:bg-blue-950/20 rounded-lg' : ''
              } ${dragFromIndex === index ? 'opacity-40' : ''}`}
            >
              {/* Grip — only for SCHOOL options */}
              <div className="w-4 flex-shrink-0">
                {isSchool && (
                  <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing" />
                )}
              </div>

              {/* Label / edit input */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    autoFocus
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(opt);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <span
                    className={`text-sm ${
                      opt.is_hidden
                        ? 'line-through text-gray-400 dark:text-gray-600'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {opt.label}
                  </span>
                )}
              </div>

              {/* Origin badge */}
              <span
                className={`flex-shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  isSchool
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {opt.origin}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => saveEdit(opt)}
                      disabled={editSaving}
                      className="p-1 text-green-600 dark:text-green-400 hover:text-green-800 disabled:opacity-50"
                      title="Save"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    {/* SCHOOL option: edit + delete */}
                    {isSchool && (
                      <>
                        <button
                          onClick={() => startEdit(opt)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          title="Edit label"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(opt)}
                          className="p-1 text-red-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {/* GLOBAL option: hide / unhide */}
                    {!isSchool && (
                      <>
                        {opt.is_hidden ? (
                          <button
                            onClick={() => onUnhide(opt)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            title="Restore default visibility"
                          >
                            <Eye className="w-3 h-3" />
                            Unhide
                          </button>
                        ) : (
                          <button
                            onClick={() => onHide(opt)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            title="Hide for this school"
                          >
                            <EyeOff className="w-3 h-3" />
                            Hide
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add option */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <input
          value={addValue}
          onChange={(e) => { setAddValue(e.target.value); setAddError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="New option label…"
          className={`flex-1 px-3 py-1.5 text-sm rounded-lg border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ${
            addError ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-700'
          }`}
        />
        <button
          onClick={handleAdd}
          disabled={addSaving || !addValue.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#1A1A6D] dark:bg-[#20B2AA] rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
        >
          {addSaving ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          Add
        </button>
      </div>
      {addError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{addError}</p>}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-sm w-full p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Delete Option</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete <strong>{confirmDelete.label}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { onDelete(confirmDelete); setConfirmDelete(null); }}
                className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
