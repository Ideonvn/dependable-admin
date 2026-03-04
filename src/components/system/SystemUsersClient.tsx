'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Key, Pencil, RefreshCw, Search, ShieldAlert, Trash2, UserCheck, UserX, Users, X } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { systemUsersApi, SystemUser } from '@/lib/users';

// Helper to map API response to internal format (keeping snake_case for consistency with API)
const mapSystemUser = (user: SystemUser) => ({
  personId: user.person_id,
  userId: user.user_id,
  email: user.email,
  firstName: user.first_name,
  lastName: user.last_name,
  idNumber: user.id_number_masked,
  idCountry: user.id_country,
  idType: user.id_type,
  hasLoginUser: user.has_login_user,
  authActive: user.auth_active,
  isAdmin: user.is_admin,
  updatedAt: user.updated_at,
});

type MappedUser = ReturnType<typeof mapSystemUser>;

type EditFormData = {
  firstName: string;
  lastName: string;
  email: string | null;
  idNumber: string | null;
  idCountry: string | null;
  idType: string | null;
  isAdmin: boolean;
};

const formatDate = (value: string) => {
  return new Date(value).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const badgeClass = (active: boolean) =>
  active
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

export default function SystemUsersClient() {
  const [users, setUsers] = useState<MappedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    action: 'deactivate' | 'activate' | 'reset-password' | 'add-admin' | 'remove-admin' | 'schedule-deletion' | null;
  }>({ isOpen: false, action: null });
  const [toasts, setToasts] = useState<{ id: string; title?: string; message: string; variant?: 'success' | 'error' | 'info' }[]>([]);

  // Debounce search term - only search endpoint if 3+ characters
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmedSearch = searchTerm.trim();
      // Only search on endpoint if 3+ characters, otherwise clear to load all users
      setDebouncedSearch(trimmedSearch.length >= 3 ? trimmedSearch : '');
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load users from API
  const loadUsers = async (page: number = 1) => {
    setLoading(true);
    setError(null);
    try {
      const response = await systemUsersApi.getUsers({
        page,
        page_size: 100,
        search: debouncedSearch || undefined,
      });
      setUsers(response.users.map(mapSystemUser));
      setTotalUsers(response.total);
      setPageSize(response.page_size);
      setCurrentPage(response.page);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load users on mount and when search changes (reset to page 1)
  useEffect(() => {
    setCurrentPage(1);
    loadUsers(1);
  }, [debouncedSearch]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) return users;

    return users.filter((user) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const email = (user.email || '').toLowerCase();
      const idNumber = (user.idNumber || '').toLowerCase();

      return (
        fullName.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        idNumber.includes(normalizedSearch)
      );
    });
  }, [searchTerm, users]);

  const selectedUsers = useMemo(
    () => users.filter((user) => selectedUserIds.has(user.personId)),
    [users, selectedUserIds]
  );

  const editingUser = useMemo(
    () => users.find((user) => user.personId === editUserId) || null,
    [editUserId, users]
  );

  const allFilteredSelected = filteredUsers.length > 0 && filteredUsers.every((user) => selectedUserIds.has(user.personId));
  const someFilteredSelected = filteredUsers.some((user) => selectedUserIds.has(user.personId)) && !allFilteredSelected;

  const [formData, setFormData] = useState<EditFormData>({
    firstName: '',
    lastName: '',
    email: null,
    idNumber: null,
    idCountry: null,
    idType: null,
    isAdmin: false,
  });

  const toNullableString = (value: string | null) => {
    if (value === null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  };

  const addToast = (toast: { title?: string; message: string; variant?: 'success' | 'error' | 'info' }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, ...toast }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toastItem) => toastItem.id !== id));
    }, 4000);
  };

  // Selection handlers
  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect all filtered users
      setSelectedUserIds((current) => {
        const newSet = new Set(current);
        filteredUsers.forEach((user) => newSet.delete(user.personId));
        return newSet;
      });
    } else {
      // Select all filtered users
      setSelectedUserIds((current) => {
        const newSet = new Set(current);
        filteredUsers.forEach((user) => newSet.add(user.personId));
        return newSet;
      });
    }
  };

  const toggleSelectUser = (personId: string) => {
    setSelectedUserIds((current) => {
      const newSet = new Set(current);
      if (newSet.has(personId)) {
        newSet.delete(personId);
      } else {
        newSet.add(personId);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedUserIds(new Set());
  };

  // Action handlers
  const openEdit = () => {
    if (selectedUsers.length !== 1) return;
    const user = selectedUsers[0];
    setEditUserId(user.personId);
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      idNumber: user.idNumber,
      idCountry: user.idCountry,
      idType: user.idType,
      isAdmin: user.isAdmin,
    });
  };

  const saveEdit = async () => {
    if (!editUserId) return;

    setActionLoading(true);
    try {
      await systemUsersApi.updateUser(editUserId, {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        email: toNullableString(formData.email),
        id_number: toNullableString(formData.idNumber),
        id_country: toNullableString(formData.idCountry),
        id_type: toNullableString(formData.idType),
        active: editingUser?.authActive || false,
        is_admin: formData.isAdmin,
      });

      // Reload users to get updated data
      await loadUsers(currentPage);

      setEditUserId(null);
      clearSelection();
      addToast({
        title: 'User Updated',
        message: 'User details were updated successfully.',
        variant: 'success',
      });
    } catch (err) {
      console.error('Failed to update user:', err);
      addToast({
        title: 'Update Failed',
        message: 'Failed to update user details. Please try again.',
        variant: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateActivate = () => {
    const hasActiveUsers = selectedUsers.some((u) => u.hasLoginUser && u.authActive);
    setConfirmAction({
      isOpen: true,
      action: hasActiveUsers ? 'deactivate' : 'activate',
    });
  };

  const handleResetPassword = () => {
    setConfirmAction({ isOpen: true, action: 'reset-password' });
  };

  const handleToggleAdmin = () => {
    const hasAdmins = selectedUsers.some((u) => u.isAdmin);
    setConfirmAction({
      isOpen: true,
      action: hasAdmins ? 'remove-admin' : 'add-admin',
    });
  };

  const handleScheduleForDeletion = () => {
    setConfirmAction({ isOpen: true, action: 'schedule-deletion' });
  };

  const executeAction = async () => {
    if (!confirmAction.action) return;

    setActionLoading(true);
    const selectedUsersWithLogin = selectedUsers.filter((u) => u.hasLoginUser);
    const personIdsWithLogin = selectedUsersWithLogin.map((u) => u.personId);

    try {
      switch (confirmAction.action) {
        case 'deactivate':
          await Promise.all(personIdsWithLogin.map((personId) => systemUsersApi.updateUserActive(personId, false)));
          addToast({
            title: 'Users Deactivated',
            message: `${personIdsWithLogin.length} user(s) have been deactivated.`,
            variant: 'success',
          });
          break;

        case 'activate':
          await Promise.all(personIdsWithLogin.map((personId) => systemUsersApi.updateUserActive(personId, true)));
          addToast({
            title: 'Users Activated',
            message: `${personIdsWithLogin.length} user(s) have been activated.`,
            variant: 'success',
          });
          break;

        case 'reset-password':
          await Promise.all(personIdsWithLogin.map((personId) => systemUsersApi.sendPasswordReset(personId)));
          addToast({
            title: 'Password Reset Sent',
            message: `Password reset emails have been sent to ${personIdsWithLogin.length} user(s).`,
            variant: 'success',
          });
          break;

        case 'add-admin':
          await Promise.all(personIdsWithLogin.map((personId) => systemUsersApi.updateAdminStatus(personId, true)));
          addToast({
            title: 'Admin Access Granted',
            message: `${personIdsWithLogin.length} user(s) have been granted admin access.`,
            variant: 'success',
          });
          break;

        case 'remove-admin':
          await Promise.all(personIdsWithLogin.map((personId) => systemUsersApi.updateAdminStatus(personId, false)));
          addToast({
            title: 'Admin Access Removed',
            message: `Admin access has been removed from ${personIdsWithLogin.length} user(s).`,
            variant: 'success',
          });
          break;

        case 'schedule-deletion':
          const personIdsForDeletion = selectedUsers.map((u) => u.personId);
          await Promise.all(personIdsForDeletion.map((personId) => systemUsersApi.scheduleDeletion(personId)));
          addToast({
            title: 'Deletion Scheduled',
            message: `${personIdsForDeletion.length} user account(s) have been scheduled for deletion. Notification emails have been sent.`,
            variant: 'success',
          });
          break;
      }

      // Reload users to get updated data
      await loadUsers(currentPage);
    } catch (err) {
      console.error('Action failed:', err);
      addToast({
        title: 'Action Failed',
        message: 'Failed to complete the action. Please try again.',
        variant: 'error',
      });
    } finally {
      setActionLoading(false);
      clearSelection();
      setConfirmAction({ isOpen: false, action: null });
    }
  };

  const getConfirmDialogProps = () => {
    const count = selectedUserIds.size;
    switch (confirmAction.action) {
      case 'deactivate':
        return {
          title: 'Deactivate Users',
          message: `Are you sure you want to deactivate ${count} user(s)? They will no longer be able to sign in.`,
          confirmText: 'Deactivate',
          variant: 'danger' as const,
        };
      case 'activate':
        return {
          title: 'Activate Users',
          message: `Are you sure you want to activate ${count} user(s)? They will be able to sign in.`,
          confirmText: 'Activate',
          variant: 'info' as const,
        };
      case 'reset-password':
        return {
          title: 'Reset Password',
          message: `Are you sure you want to send password reset emails to ${count} user(s)?`,
          confirmText: 'Send Reset Emails',
          variant: 'warning' as const,
        };
      case 'add-admin':
        return {
          title: 'Grant Admin Access',
          message: `Are you sure you want to grant admin access to ${count} user(s)?`,
          confirmText: 'Grant Admin',
          variant: 'warning' as const,
        };
      case 'remove-admin':
        return {
          title: 'Remove Admin Access',
          message: `Are you sure you want to remove admin access from ${count} user(s)?`,
          confirmText: 'Remove Admin',
          variant: 'danger' as const,
        };
      case 'schedule-deletion':
        return {
          title: 'Schedule User(s) for Deletion',
          message: `Are you sure you want to schedule ${count} user account(s) for deletion? A notification email will be sent to each user. This action cannot be undone.`,
          confirmText: 'Schedule for Deletion',
          variant: 'danger' as const,
        };
      default:
        return {
          title: 'Confirm Action',
          message: 'Are you sure?',
          confirmText: 'Confirm',
          variant: 'info' as const,
        };
    }
  };

  return (
    <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-[#0F1115]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-[#1A1A6D] dark:text-[#20B2AA]" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Users</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Manage person records and login access across the full platform
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadUsers(currentPage)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Schools
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm mb-6">
        {selectedUserIds.size > 0 ? (
          <div className="p-4 flex flex-wrap items-center gap-3">
            <button
              onClick={clearSelection}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              title="Clear selection"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {selectedUserIds.size} user{selectedUserIds.size !== 1 ? 's' : ''} selected
            </span>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={openEdit}
                disabled={selectedUserIds.size !== 1}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Pencil className="w-4 h-4" />
                Edit Details
              </button>
              <button
                onClick={handleDeactivateActivate}
                disabled={selectedUsers.every((u) => !u.hasLoginUser)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectedUsers.some((u) => u.hasLoginUser && u.authActive) ? (
                  <>
                    <UserX className="w-4 h-4" />
                    Deactivate User
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    Activate User
                  </>
                )}
              </button>
              <button
                onClick={handleResetPassword}
                disabled={selectedUsers.every((u) => !u.hasLoginUser)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Key className="w-4 h-4" />
                Reset Password
              </button>
              <button
                onClick={handleToggleAdmin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {selectedUsers.some((u) => u.isAdmin) ? (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    Remove as Admin
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Promote to Admin
                  </>
                )}
              </button>
              <button
                onClick={handleScheduleForDeletion}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Schedule for Deletion
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 dark:text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by full name, email, or ID number"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div>
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full">
            <thead className="bg-gray-100 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = someFilteredSelected;
                      }
                    }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-[#1A1A6D] dark:text-[#20B2AA] focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA]"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Person ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Full Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">ID Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Login User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Auth Active</th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Admin</th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300 uppercase">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {filteredUsers.map((row) => (
                <tr 
                  key={row.personId} 
                  className={`hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors ${
                    selectedUserIds.has(row.personId) ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                  }`}
                >
                  <td className="w-12 px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(row.personId)}
                      onChange={() => toggleSelectUser(row.personId)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-[#1A1A6D] dark:text-[#20B2AA] focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA]"
                    />
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-600 dark:text-gray-400">{row.personId}</td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {row.firstName} {row.lastName}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{row.email || '-'}</td>
                  <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{row.idNumber || '-'}</td>
                  <td className="px-4 py-4 text-sm">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(row.hasLoginUser)}`}>
                      {row.hasLoginUser ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(row.authActive)}`}>
                      {row.authActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(row.isAdmin)}`}>
                      {row.isAdmin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.updatedAt)}</td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-600 dark:text-gray-400">
                    No users found for your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalUsers > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalUsers)} of {totalUsers} users
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadUsers(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="text-sm text-gray-600 dark:text-gray-400 px-3">
                Page {currentPage} of {Math.ceil(totalUsers / pageSize)}
              </div>
              <button
                onClick={() => loadUsers(currentPage + 1)}
                disabled={currentPage >= Math.ceil(totalUsers / pageSize) || loading}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
        </div>
        )}
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit User Details</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Update person details and admin flag for this user.</p>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                <input
                  value={formData.firstName}
                  onChange={(event) => setFormData((current) => ({ ...current, firstName: event.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                <input
                  value={formData.lastName}
                  onChange={(event) => setFormData((current) => ({ ...current, lastName: event.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  value={formData.email ?? ''}
                  onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID Number</label>
                <input
                  value={formData.idNumber ?? ''}
                  onChange={(event) => setFormData((current) => ({ ...current, idNumber: event.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID Country</label>
                <input
                  value={formData.idCountry ?? ''}
                  onChange={(event) => setFormData((current) => ({ ...current, idCountry: event.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID Type</label>
                <input
                  value={formData.idType ?? ''}
                  onChange={(event) => setFormData((current) => ({ ...current, idType: event.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="flex items-center gap-2 mt-7">
                <input
                  id="isAdmin"
                  type="checkbox"
                  checked={formData.isAdmin}
                  onChange={(event) => setFormData((current) => ({ ...current, isAdmin: event.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-700"
                />
                <label htmlFor="isAdmin" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Platform Admin
                </label>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-[#0F1115] px-6 py-4 flex gap-3 justify-end rounded-b-lg">
              <button
                onClick={() => setEditUserId(null)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1A1A6D] dark:bg-[#20B2AA] rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmAction.isOpen}
        onClose={() => setConfirmAction({ isOpen: false, action: null })}
        onConfirm={executeAction}
        {...getConfirmDialogProps()}
      />

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((toastItem) => (
          <div
            key={toastItem.id}
            className={`max-w-sm w-full px-4 py-3 rounded-lg shadow-lg border transition-opacity bg-white dark:bg-[#111217] border-gray-200 dark:border-gray-800 ${
              toastItem.variant === 'success'
                ? 'ring-2 ring-green-500 dark:ring-green-400'
                : toastItem.variant === 'error'
                ? 'ring-2 ring-red-500 dark:ring-red-400'
                : 'ring-1 ring-gray-200 dark:ring-gray-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                {toastItem.title && <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{toastItem.title}</div>}
                <div className="text-sm text-gray-700 dark:text-gray-300">{toastItem.message}</div>
              </div>
              <button
                onClick={() => setToasts((current) => current.filter((item) => item.id !== toastItem.id))}
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
