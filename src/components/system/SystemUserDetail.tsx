'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, AlertCircle, AlertTriangle, RefreshCw, Copy, Check, Plus, Trash2,
  Pencil, Save, X, User, Shield, ShieldOff, ToggleLeft, ToggleRight,
  ExternalLink, Search, LogIn,
} from 'lucide-react';
import {
  systemUsersApi, SystemUser,
  UserOAuthProvider, UserAuthReset, UserStudentContact, UserDependant, DependantSearchResult,
} from '@/lib/users';
import { COUNTRIES } from '@/lib/countries';
import { ID_TYPE_OPTIONS } from '@/lib/idTypes';
import ConfirmDialog from '@/components/ConfirmDialog';

type Tab = 'details' | 'oauth' | 'auth-reset' | 'student-contact' | 'dependants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmtDate = (v: string) =>
  new Date(v).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: '2-digit' });

const fmtDateTime = (v: string) =>
  new Date(v).toLocaleString('en-ZA', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

const Badge = ({ on, labelOn, labelOff }: { on: boolean; labelOn: string; labelOff: string }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
    on
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
  }`}>
    {on ? labelOn : labelOff}
  </span>
);

const TabLoader = () => (
  <div className="flex justify-center py-12">
    <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
  </div>
);

const TabError = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="flex flex-col items-center gap-3 py-10">
    <AlertCircle className="w-8 h-8 text-red-400" />
    <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
    <button onClick={onRetry} className="text-sm text-[#1A1A6D] dark:text-[#20B2AA] hover:underline">Retry</button>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SystemUserDetail({ personId }: { personId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('details');

  // -- Details --
  const [user, setUser] = useState<SystemUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '',
    id_number: '', id_country: '', id_type: '',
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [authConfirm, setAuthConfirm] = useState<{
    open: boolean; action: 'activate' | 'deactivate' | 'add-admin' | 'remove-admin' | 'create-login' | null;
  }>({ open: false, action: null });
  const [authActionLoading, setAuthActionLoading] = useState(false);

  // -- OAuth --
  const [oauthList, setOauthList] = useState<UserOAuthProvider[]>([]);
  const [loadingOauth, setLoadingOauth] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  // -- Auth Resets --
  const [authResets, setAuthResets] = useState<UserAuthReset[]>([]);
  const [loadingResets, setLoadingResets] = useState(false);
  const [resetsError, setResetsError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // -- Student Contacts --
  const [contacts, setContacts] = useState<UserStudentContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  // -- Dependants --
  const [dependants, setDependants] = useState<UserDependant[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [depsError, setDepsError] = useState<string | null>(null);
  const [depSearch, setDepSearch] = useState('');
  const [depSearchResults, setDepSearchResults] = useState<DependantSearchResult[]>([]);
  const [showAddDep, setShowAddDep] = useState(false);
  const [newDep, setNewDep] = useState<{ dependant: DependantSearchResult | null; type: string; primary: boolean }>({
    dependant: null, type: 'GUARDIAN', primary: false,
  });
  const [editingDepId, setEditingDepId] = useState<string | null>(null);
  const [editDepForm, setEditDepForm] = useState<{ type: string; primary: boolean }>({ type: '', primary: false });
  const [depDeleteConfirm, setDepDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  // Load user on mount
  useEffect(() => { loadUser(); }, [personId]);

  // Lazy-load tabs on first visit
  useEffect(() => {
    if (activeTab === 'oauth' && oauthList.length === 0 && !loadingOauth && !oauthError) loadOauth();
    if (activeTab === 'auth-reset' && authResets.length === 0 && !loadingResets && !resetsError) loadResets();
    if (activeTab === 'student-contact' && contacts.length === 0 && !loadingContacts && !contactsError) loadContacts();
    if (activeTab === 'dependants' && dependants.length === 0 && !loadingDeps && !depsError) loadDeps();
  }, [activeTab]);

  const loadUser = async () => {
    setLoadingUser(true);
    setUserError(null);
    try {
      const data = await systemUsersApi.getUser(personId);
      setUser(data);
      setFormData({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email ?? '',
        id_number: data.id_number_masked ?? '',
        id_country: data.id_country ?? '',
        id_type: data.id_type ?? '',
      });
    } catch {
      setUserError('Failed to load user.');
    } finally {
      setLoadingUser(false);
    }
  };

  const loadOauth = async () => {
    setLoadingOauth(true);
    setOauthError(null);
    try {
      setOauthList(await systemUsersApi.getOAuthProviders(personId));
    } catch {
      setOauthError('Failed to load OAuth providers.');
    } finally {
      setLoadingOauth(false);
    }
  };

  const loadResets = async () => {
    setLoadingResets(true);
    setResetsError(null);
    try {
      setAuthResets(await systemUsersApi.getAuthResets(personId));
    } catch {
      setResetsError('Failed to load auth resets.');
    } finally {
      setLoadingResets(false);
    }
  };

  const loadContacts = async () => {
    setLoadingContacts(true);
    setContactsError(null);
    try {
      setContacts(await systemUsersApi.getStudentContacts(personId));
    } catch {
      setContactsError('Failed to load student contacts.');
    } finally {
      setLoadingContacts(false);
    }
  };

  const loadDeps = async () => {
    setLoadingDeps(true);
    setDepsError(null);
    try {
      setDependants(await systemUsersApi.getDependants(personId));
    } catch {
      setDepsError('Failed to load dependants.');
    } finally {
      setLoadingDeps(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!user) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await systemUsersApi.updateUser(personId, {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim() || null,
        id_number: formData.id_number.trim() || null,
        id_country: formData.id_country.trim() || null,
        id_type: formData.id_type.trim() || null,
        active: user.auth_active,
        is_admin: user.is_admin,
      });
      await loadUser();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setUserError('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const executeAuthAction = async () => {
    if (!user || !authConfirm.action) return;
    setAuthActionLoading(true);
    try {
      if (authConfirm.action === 'activate') await systemUsersApi.updateUserActive(personId, true);
      else if (authConfirm.action === 'deactivate') await systemUsersApi.updateUserActive(personId, false);
      else if (authConfirm.action === 'add-admin') await systemUsersApi.updateAdminStatus(personId, true);
      else if (authConfirm.action === 'remove-admin') await systemUsersApi.updateAdminStatus(personId, false);
      else if (authConfirm.action === 'create-login') await systemUsersApi.createLogin(personId);
      await loadUser();
    } catch {
      setUserError('Failed to update auth status.');
    } finally {
      setAuthActionLoading(false);
      setAuthConfirm({ open: false, action: null });
    }
  };

  const toggleOAuth = async (id: number, currentlyActive: boolean) => {
    try {
      const updated = await systemUsersApi.setOAuthActive(personId, id, !currentlyActive);
      setOauthList(prev => prev.map(o => o.id === id ? updated : o));
    } catch {
      setOauthError('Failed to update OAuth provider status.');
    }
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Dependant search — debounced, requires 2+ chars (backend enforces this too)
  useEffect(() => {
    if (depSearch.length < 2) { setDepSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const results = await systemUsersApi.searchDependants(depSearch);
        setDepSearchResults(results);
      } catch {
        setDepSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [depSearch]);

  const confirmAddDep = async () => {
    if (!newDep.dependant) return;
    try {
      const created = await systemUsersApi.addDependant(personId, {
        dependant_id: newDep.dependant.id,
        independant_type: newDep.type,
        primary: newDep.primary,
      });
      setDependants(prev => [...prev, created]);
      setShowAddDep(false);
      setNewDep({ dependant: null, type: 'GUARDIAN', primary: false });
      setDepSearch('');
    } catch {
      setDepsError('Failed to add dependant.');
    }
  };

  const startEditDep = (dep: UserDependant) => {
    setEditingDepId(dep.id);
    setEditDepForm({ type: dep.independant_type, primary: dep.primary });
  };

  const saveEditDep = async () => {
    if (!editingDepId) return;
    const dep = dependants.find(d => d.id === editingDepId);
    if (!dep) return;
    try {
      const updated = await systemUsersApi.updateDependant(personId, dep.id, {
        independant_type: editDepForm.type,
        primary: editDepForm.primary,
      });
      setDependants(prev => prev.map(d => d.id === editingDepId ? updated : d));
      setEditingDepId(null);
    } catch {
      setDepsError('Failed to update dependant.');
    }
  };

  const deleteDep = async () => {
    if (!depDeleteConfirm.id) return;
    const dep = dependants.find(d => d.id === depDeleteConfirm.id);
    if (!dep) return;
    try {
      await systemUsersApi.deleteDependant(personId, dep.id);
      setDependants(prev => prev.filter(d => d.id !== depDeleteConfirm.id));
      setDepDeleteConfirm({ open: false, id: null });
    } catch {
      setDepsError('Failed to remove dependant.');
      setDepDeleteConfirm({ open: false, id: null });
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const tabs: { id: Tab; label: string }[] = [
    { id: 'details', label: 'Details' },
    { id: 'oauth', label: 'OAuth' },
    { id: 'auth-reset', label: 'Auth Reset' },
    { id: 'student-contact', label: 'Student Contacts' },
    { id: 'dependants', label: 'Dependants' },
  ];

  const fieldClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent text-sm';
  const readonlyClass = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-500 text-sm cursor-not-allowed';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
  const sectionHeadClass = 'text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3';
  const thClass = 'px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap';
  const tdClass = 'px-4 py-3 text-sm text-gray-800 dark:text-gray-200 whitespace-nowrap';

  const displayName = user ? `${user.first_name} ${user.last_name}`.trim() : 'Loading…';
  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
    : '?';

  return (
    <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-[#0F1115] min-h-screen">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/system/users"
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to System Users
        </Link>
        <button
          onClick={loadUser}
          disabled={loadingUser}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loadingUser ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* User hero */}
      <div className="bg-white dark:bg-[#121212] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm px-6 py-5 mb-6 flex items-center gap-5">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{displayName}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email ?? ''}</p>
        </div>
        {user && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge on={user.auth_active} labelOn="Active" labelOff="Inactive" />
            {user.is_admin && <Badge on={true} labelOn="Admin" labelOff="User" />}
          </div>
        )}
      </div>

      {userError && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{userError}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-[#121212] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex border-b border-gray-200 dark:border-gray-800 px-6 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#1A1A6D] dark:border-[#20B2AA] text-[#1A1A6D] dark:text-[#20B2AA]'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">

          {/* ================================================================
              DETAILS
          ================================================================ */}
          {activeTab === 'details' && (
            <div className="space-y-8">
              {loadingUser ? <TabLoader /> : (
                <>
                  <div>
                    <p className={sectionHeadClass}>Personal Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>First Name</label>
                        <input className={fieldClass} value={formData.first_name}
                          onChange={e => setFormData(p => ({ ...p, first_name: e.target.value }))} />
                      </div>
                      <div>
                        <label className={labelClass}>Last Name</label>
                        <input className={fieldClass} value={formData.last_name}
                          onChange={e => setFormData(p => ({ ...p, last_name: e.target.value }))} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Email (Person record)</label>
                        <input className={fieldClass} value={formData.email}
                          onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
                        {user?.email_mismatch && (
                          <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-700 dark:text-amber-300">
                              <span className="font-semibold">Email mismatch:</span> the login account uses a different email address.
                              <div className="mt-0.5">Login email: <span className="font-mono font-medium">{user.user_email}</span></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className={sectionHeadClass}>Identity</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>ID Number</label>
                        <input className={fieldClass} value={formData.id_number}
                          onChange={e => setFormData(p => ({ ...p, id_number: e.target.value }))} />
                      </div>
                      <div>
                        <label className={labelClass}>ID Country</label>
                        <select className={fieldClass} value={formData.id_country}
                          onChange={e => setFormData(p => ({ ...p, id_country: e.target.value }))}>
                          <option value="">Select country</option>
                          {formData.id_country && !COUNTRIES.some(c => c.code === formData.id_country) && (
                            <option value={formData.id_country}>{formData.id_country}</option>
                          )}
                          {COUNTRIES.map(c => (
                            <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>ID Type</label>
                        <select className={fieldClass} value={formData.id_type}
                          onChange={e => setFormData(p => ({ ...p, id_type: e.target.value }))}>
                          <option value="">Select type</option>
                          {formData.id_type && !ID_TYPE_OPTIONS.some(t => t.value === formData.id_type) && (
                            <option value={formData.id_type}>{formData.id_type}</option>
                          )}
                          {ID_TYPE_OPTIONS.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className={sectionHeadClass}>System Info</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Person ID</label>
                        <input className={readonlyClass} value={user?.person_id ?? ''} readOnly />
                      </div>
                      <div>
                        <label className={labelClass}>Person Created</label>
                        <input className={readonlyClass} value={user?.created_at ? fmtDateTime(user.created_at) : '—'} readOnly />
                      </div>
                      <div>
                        <label className={labelClass}>Last Updated</label>
                        <input className={readonlyClass} value={user?.updated_at ? fmtDateTime(user.updated_at) : '—'} readOnly />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={handleSaveDetails}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm font-medium"
                    >
                      {saving
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Save className="w-4 h-4" />}
                      Save Changes
                    </button>
                    {saveSuccess && (
                      <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Saved
                      </span>
                    )}
                  </div>

                  <div>
                    <p className={sectionHeadClass}>Auth Status</p>
                    {user && !user.has_login_user && (
                      <div className="mb-4 flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No login account</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">This person cannot sign in yet.</p>
                        </div>
                        <button
                          onClick={() => setAuthConfirm({ open: true, action: 'create-login' })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
                        >
                          <LogIn className="w-4 h-4" />
                          Create Login
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Auth Active</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {user?.auth_active ? 'User can sign in' : 'Sign-in is disabled'}
                          </p>
                        </div>
                        <button
                          onClick={() => setAuthConfirm({ open: true, action: user?.auth_active ? 'deactivate' : 'activate' })}
                          className="flex items-center gap-1.5 text-sm font-medium"
                        >
                          {user?.auth_active
                            ? <><ToggleRight className="w-8 h-8 text-emerald-500" /><span className="text-emerald-600 dark:text-emerald-400">Active</span></>
                            : <><ToggleLeft className="w-8 h-8 text-gray-400" /><span className="text-gray-500">Inactive</span></>}
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Platform Admin</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {user?.is_admin ? 'Has admin privileges' : 'Standard user access'}
                          </p>
                        </div>
                        <button
                          onClick={() => setAuthConfirm({ open: true, action: user?.is_admin ? 'remove-admin' : 'add-admin' })}
                          className="flex items-center gap-1.5 text-sm font-medium"
                        >
                          {user?.is_admin
                            ? <><Shield className="w-5 h-5 text-[#1A1A6D] dark:text-[#20B2AA]" /><span className="text-[#1A1A6D] dark:text-[#20B2AA]">Admin</span></>
                            : <><ShieldOff className="w-5 h-5 text-gray-400" /><span className="text-gray-500">User</span></>}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ================================================================
              OAUTH
          ================================================================ */}
          {activeTab === 'oauth' && (
            <div>
              {loadingOauth ? <TabLoader /> : oauthError ? (
                <TabError message={oauthError} onRetry={loadOauth} />
              ) : oauthList.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">No OAuth providers linked</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className={thClass}>Provider</th>
                        <th className={thClass}>Email</th>
                        <th className={thClass}>Full Name</th>
                        <th className={thClass}>Profile Picture</th>
                        <th className={thClass}>Status</th>
                        <th className={thClass}>Created</th>
                        <th className={thClass}>Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {oauthList.map(o => (
                        <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                          <td className={tdClass}>
                            <span className="inline-flex items-center gap-2 font-medium capitalize">
                              <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                <User className="w-3 h-3 text-gray-500" />
                              </div>
                              {o.provider}
                            </span>
                          </td>
                          <td className={tdClass}>{o.email}</td>
                          <td className={tdClass}>{o.full_name}</td>
                          <td className={tdClass}>
                            {o.profile_picture ? (
                              <a href={o.profile_picture} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[#1A1A6D] dark:text-[#20B2AA] hover:underline">
                                View <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className={tdClass}><Badge on={o.active} labelOn="Active" labelOff="Disabled" /></td>
                          <td className={tdClass}>{fmtDateTime(o._created_at)}</td>
                          <td className={tdClass}>
                            <button
                              onClick={() => toggleOAuth(o.id, o.active)}
                              className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${
                                o.active
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200'
                                  : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200'
                              }`}
                            >
                              {o.active ? 'Disable' : 'Enable'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              AUTH RESET
          ================================================================ */}
          {activeTab === 'auth-reset' && (
            <div>
              {loadingResets ? <TabLoader /> : resetsError ? (
                <TabError message={resetsError} onRetry={loadResets} />
              ) : authResets.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">No reset requests found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className={thClass}>Hash</th>
                        <th className={thClass}>Expires At</th>
                        <th className={thClass}>Used</th>
                        <th className={thClass}>Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {authResets.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                                {r.hash}
                              </span>
                              <button
                                onClick={() => copyHash(r.hash)}
                                className="flex-shrink-0 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                title="Copy hash"
                              >
                                {copiedHash === r.hash
                                  ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                              </button>
                            </div>
                          </td>
                          <td className={tdClass}>
                            <span className={new Date(r.expires_at) < new Date() ? 'text-red-500 dark:text-red-400' : ''}>
                              {fmtDateTime(r.expires_at)}
                            </span>
                          </td>
                          <td className={tdClass}><Badge on={r.used} labelOn="Used" labelOff="Pending" /></td>
                          <td className={tdClass}>{fmtDateTime(r._created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              STUDENT CONTACTS
          ================================================================ */}
          {activeTab === 'student-contact' && (
            <div>
              {loadingContacts ? <TabLoader /> : contactsError ? (
                <TabError message={contactsError} onRetry={loadContacts} />
              ) : contacts.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">No student contacts found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className={thClass}>School</th>
                        <th className={thClass}>Student</th>
                        <th className={thClass}>Role</th>
                        <th className={thClass}>Primary</th>
                        <th className={thClass}>Check In/Out</th>
                        <th className={thClass}>View Records</th>
                        <th className={thClass}>Notifications</th>
                        <th className={thClass}>Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {contacts.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                          <td className={tdClass}>
                            <Link href={`/schools/${c.school_id}`}
                              className="text-[#1A1A6D] dark:text-[#20B2AA] hover:underline inline-flex items-center gap-1">
                              {c.school_name} <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                          <td className={tdClass}>
                            <Link href={`/schools/${c.school_id}/students/${c.student_id}`}
                              className="text-[#1A1A6D] dark:text-[#20B2AA] hover:underline inline-flex items-center gap-1">
                              {c.student_first_name} {c.student_last_name} <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                          <td className={tdClass}><span className="capitalize">{c.role}</span></td>
                          <td className={tdClass}><Badge on={c.primary} labelOn="Yes" labelOff="No" /></td>
                          <td className={tdClass}><Badge on={c.can_check_in_out} labelOn="Yes" labelOff="No" /></td>
                          <td className={tdClass}><Badge on={c.can_view_records} labelOn="Yes" labelOff="No" /></td>
                          <td className={tdClass}><Badge on={c.can_receive_notifications} labelOn="Yes" labelOff="No" /></td>
                          <td className={tdClass}>{fmtDate(c.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              DEPENDANTS
          ================================================================ */}
          {activeTab === 'dependants' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">Dependants linked to this user.</p>
                <button
                  onClick={() => setShowAddDep(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Dependant
                </button>
              </div>

              {loadingDeps ? <TabLoader /> : depsError ? (
                <TabError message={depsError} onRetry={loadDeps} />
              ) : dependants.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">No dependants linked</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className={thClass}>Dependant</th>
                        <th className={thClass}>Date of Birth</th>
                        <th className={thClass}>Type</th>
                        <th className={thClass}>Primary</th>
                        <th className={thClass}>Linked At</th>
                        <th className={thClass}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {dependants.map(dep => (
                        <tr key={dep.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                          <td className={tdClass}>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {dep.dependant.first_name} {dep.dependant.last_name}
                            </p>
                            <p className="text-xs text-gray-400">{dep.dependant_id}</p>
                          </td>
                          <td className={tdClass}>{fmtDate(dep.dependant.date_of_birth)}</td>
                          <td className="px-4 py-3">
                            {editingDepId === dep.id ? (
                              <select
                                value={editDepForm.type}
                                onChange={e => setEditDepForm(p => ({ ...p, type: e.target.value }))}
                                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              >
                                {['MOTHER', 'FATHER', 'SIBLING', 'GUARDIAN', 'TEACHER', 'OTHER'].map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-sm text-gray-800 dark:text-gray-200">{dep.independant_type}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {editingDepId === dep.id ? (
                              <input
                                type="checkbox"
                                checked={editDepForm.primary}
                                onChange={e => setEditDepForm(p => ({ ...p, primary: e.target.checked }))}
                                className="w-4 h-4 rounded"
                              />
                            ) : (
                              <Badge on={dep.primary} labelOn="Yes" labelOff="No" />
                            )}
                          </td>
                          <td className={tdClass}>{fmtDate(dep.created_at)}</td>
                          <td className="px-4 py-3">
                            {editingDepId === dep.id ? (
                              <div className="flex items-center gap-2">
                                <button onClick={saveEditDep}
                                  className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded hover:bg-emerald-200 transition-colors">
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setEditingDepId(null)}
                                  className="p-1.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded hover:bg-gray-200 transition-colors">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button onClick={() => startEditDep(dep)}
                                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors text-gray-500 dark:text-gray-400"
                                  title="Edit">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDepDeleteConfirm({ open: true, id: dep.id })}
                                  className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors text-red-500 dark:text-red-400"
                                  title="Remove">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ================================================================
          ADD DEPENDANT MODAL
      ================================================================ */}
      {showAddDep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#121212] rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Add Dependant</h3>
              <button onClick={() => { setShowAddDep(false); setDepSearch(''); setNewDep({ dependant: null, type: 'GUARDIAN', primary: false }); }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={labelClass}>Search Dependant</label>
                {newDep.dependant ? (
                  <div className="flex items-center justify-between px-3 py-2 bg-[#1A1A6D]/5 dark:bg-[#20B2AA]/10 border border-[#1A1A6D]/20 dark:border-[#20B2AA]/30 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{newDep.dependant.first_name} {newDep.dependant.last_name}</p>
                      <p className="text-xs text-gray-500">{newDep.dependant.id}</p>
                    </div>
                    <button onClick={() => setNewDep(p => ({ ...p, dependant: null }))}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      className={`${fieldClass} pl-9`}
                      placeholder="Type to search…"
                      value={depSearch}
                      onChange={e => setDepSearch(e.target.value)}
                    />
                    {depSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                        {depSearchResults.map(r => (
                          <button key={r.id}
                            className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            onClick={() => { setNewDep(p => ({ ...p, dependant: r })); setDepSearch(''); setDepSearchResults([]); }}
                          >
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.first_name} {r.last_name}</p>
                            <p className="text-xs text-gray-500">{r.id}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className={labelClass}>Relationship Type</label>
                <select className={fieldClass} value={newDep.type}
                  onChange={e => setNewDep(p => ({ ...p, type: e.target.value }))}>
                  {['MOTHER', 'FATHER', 'SIBLING', 'GUARDIAN', 'TEACHER', 'OTHER'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="dep-primary" checked={newDep.primary}
                  onChange={e => setNewDep(p => ({ ...p, primary: e.target.checked }))}
                  className="w-4 h-4 rounded" />
                <label htmlFor="dep-primary" className="text-sm font-medium text-gray-700 dark:text-gray-300">Primary</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button onClick={() => { setShowAddDep(false); setDepSearch(''); setNewDep({ dependant: null, type: 'GUARDIAN', primary: false }); }}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={confirmAddDep}
                disabled={!newDep.dependant}
                className="px-5 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm font-medium"
              >
                Add Dependant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth action confirm */}
      <ConfirmDialog
        isOpen={authConfirm.open}
        onClose={() => setAuthConfirm({ open: false, action: null })}
        onConfirm={executeAuthAction}
        title={
          authConfirm.action === 'activate' ? 'Activate User' :
          authConfirm.action === 'deactivate' ? 'Deactivate User' :
          authConfirm.action === 'add-admin' ? 'Grant Admin Access' :
          authConfirm.action === 'create-login' ? 'Create Login Account' :
          'Remove Admin Access'
        }
        message={
          authConfirm.action === 'activate' ? 'This user will be able to sign in again.' :
          authConfirm.action === 'deactivate' ? 'This user will no longer be able to sign in.' :
          authConfirm.action === 'add-admin' ? 'Grant this user full admin access to the platform?' :
          authConfirm.action === 'create-login' ? 'Provision a login account for this person? A password reset email will be sent to their email address so they can set a password.' :
          'Remove admin privileges from this user?'
        }
        confirmText={
          authConfirm.action === 'activate' ? 'Activate' :
          authConfirm.action === 'deactivate' ? 'Deactivate' :
          authConfirm.action === 'add-admin' ? 'Grant Admin' :
          authConfirm.action === 'create-login' ? 'Create Login' :
          'Remove Admin'
        }
        variant={authConfirm.action === 'deactivate' || authConfirm.action === 'remove-admin' ? 'danger' : 'info'}
      />
      {/* unused loading state reference to satisfy exhaustive-deps */}
      {authActionLoading && null}

      <ConfirmDialog
        isOpen={depDeleteConfirm.open}
        onClose={() => setDepDeleteConfirm({ open: false, id: null })}
        onConfirm={deleteDep}
        title="Remove Dependant"
        message="Remove this dependant link? The dependant record itself will not be deleted."
        confirmText="Remove"
        variant="danger"
      />
    </main>
  );
}
