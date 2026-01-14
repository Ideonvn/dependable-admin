'use client';

import { useState, useMemo, useEffect } from 'react';
import { Edit2, Trash2, Check, X, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { SchoolOnboardingRecord } from '@/lib/schoolOnboarding';

interface EditableTableProps {
  records: SchoolOnboardingRecord[];
  onUpdate: (id: string, updates: Partial<SchoolOnboardingRecord>) => void;
  onDelete: (id: string) => void;
  initialEditingId?: string | null;
}

export default function EditableTable({ records, onUpdate, onDelete, initialEditingId }: EditableTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<SchoolOnboardingRecord>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<keyof SchoolOnboardingRecord>('first_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    class_name: 'all',
  });

  // Auto-enter edit mode for new records
  useEffect(() => {
    if (initialEditingId) {
      const record = records.find(r => r.id === initialEditingId);
      if (record) {
        setEditingId(initialEditingId);
        setEditData({ ...record });
      }
    }
  }, [initialEditingId, records]);

  // Get unique class names for filter
  const classNames = useMemo(() => {
    return Array.from(new Set(records.map(r => r.class_name))).sort();
  }, [records]);

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    let filtered = records.filter(record => {
      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const matchesSearch =
          record.first_name.toLowerCase().includes(search) ||
          record.last_name.toLowerCase().includes(search) ||
          record.primary_name.toLowerCase().includes(search) ||
          record.primary_email.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status !== 'all' && record.status !== filters.status) {
        return false;
      }

      // Class filter
      if (filters.class_name !== 'all' && record.class_name !== filters.class_name) {
        return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      // Handle undefined values
      if (aVal === undefined && bVal === undefined) return 0;
      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;
      
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [records, filters, sortField, sortDirection]);

  const handleSort = (field: keyof SchoolOnboardingRecord) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const startEdit = (record: SchoolOnboardingRecord) => {
    setEditingId(record.id);
    setEditData({ ...record });
  };

  const cancelEdit = () => {
    // If canceling a new record (temp ID), delete it
    if (editingId && editingId.startsWith('temp-')) {
      onDelete(editingId);
    }
    setEditingId(null);
    setEditData({});
  };

  const toggleRowExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const saveEdit = () => {
    if (editingId) {
      onUpdate(editingId, editData);
      setEditingId(null);
      setEditData({});
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400';
      case 'validated':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400';
      case 'submitted':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400';
      case 'error':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400';
      case 'created':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent"
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="validated">Validated</option>
          <option value="submitted">Submitted</option>
          <option value="error">Error</option>
        </select>
        <select
          value={filters.class_name}
          onChange={(e) => setFilters({ ...filters, class_name: e.target.value })}
          className="px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent"
        >
          <option value="all">All Classes</option>
          {classNames.map(className => (
            <option key={className} value={className}>{className}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 w-8"></th>
                {[
                  { key: 'first_name', label: 'First Name' },
                  { key: 'last_name', label: 'Last Name' },
                  { key: 'gender', label: 'Gender' },
                  { key: 'date_of_birth', label: 'Date of Birth' },
                  { key: 'primary_name', label: 'Primary Parent' },
                  { key: 'primary_email', label: 'Primary Email' },
                  { key: 'class_name', label: 'Class' },
                  { key: 'status', label: 'Status' },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key as keyof SchoolOnboardingRecord)}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center gap-1">
                      {label}
                      {sortField === key && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-[#0F1115] divide-y divide-gray-200 dark:divide-gray-800">
              {filteredRecords.map((record) => (
                <>
                  <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                    {editingId === record.id ? (
                      <>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={editData.first_name || ''}
                            onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded text-sm"
                          />
                        </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editData.last_name || ''}
                          onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={editData.gender || ''}
                          onChange={(e) => setEditData({ ...editData, gender: e.target.value as any })}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded text-sm"
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={editData.date_of_birth || ''}
                          onChange={(e) => setEditData({ ...editData, date_of_birth: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editData.primary_name || ''}
                          onChange={(e) => setEditData({ ...editData, primary_name: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="email"
                          value={editData.primary_email || ''}
                          onChange={(e) => setEditData({ ...editData, primary_email: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editData.class_name || ''}
                          onChange={(e) => setEditData({ ...editData, class_name: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={saveEdit}
                            className="text-green-600 hover:text-green-800"
                            title="Save"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-red-600 hover:text-red-800"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        {record.status === 'error' && record.error_message ? (
                          <button
                            onClick={() => toggleRowExpand(record.id)}
                            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                          >
                            {expandedRows.has(record.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{record.first_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{record.last_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 capitalize">{record.gender}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{record.date_of_birth}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{record.primary_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{record.primary_email}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{record.class_name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {record.status !== 'submitted' && record.status !== 'created' ? (
                            <>
                              <button
                                onClick={() => startEdit(record)}
                                className="text-[#1A1A6D] dark:text-[#20B2AA] hover:opacity-80"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => onDelete(record.id)}
                                className="text-red-600 dark:text-red-400 hover:opacity-80"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400 italic">Read-only</span>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
                {/* Error message row */}
                {record.status === 'error' && record.error_message && expandedRows.has(record.id) && (
                  <tr key={`${record.id}-error`} className="bg-red-50 dark:bg-red-900/10">
                    <td colSpan={10} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-900 dark:text-red-300 mb-1">Error Details</p>
                          <p className="text-sm text-red-800 dark:text-red-400">{record.error_message}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredRecords.length} of {records.length} records
      </div>
    </div>
  );
}
