"use client";

import { useEffect, useMemo, useState } from 'react';
import { schoolsApi, StudentDetails, StudentContact, StudentEnrollment, AttendanceCalendarMonth, AttendanceBodyCheck } from '@/lib/schools';
import { AlertCircle, Image as ImageIcon, Loader2, Save, Upload, Users, GraduationCap, Contact, ChevronDown, ChevronRight, Check, X, Plus, Calendar, ChevronLeft } from 'lucide-react';
import ClassroomProfileImage from '../ClassroomProfileImage';
import ContactProfileImage from '../ContactProfileImage';
import StudentProfileImage from '../StudentProfileImage';

interface StudentManageProps {
  schoolId: string;
  studentId: string;
}

type TabKey = 'details' | 'contacts' | 'enrollments' | 'attendance';
type StudentStatus = 'active' | 'left' | 'graduated';

const getInitialTab = (): TabKey => {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.slice(1);
    if (hash === 'details' || hash === 'contacts' || hash === 'enrollments' || hash === 'attendance') {
      return hash as TabKey;
    }
  }
  return 'details';
};

export default function StudentManage({ schoolId, studentId }: StudentManageProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(getInitialTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: string; title?: string; message: string; variant?: 'success' | 'error' | 'info' }[]>([]);
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [showCreateContactModal, setShowCreateContactModal] = useState(false);
  const [creatingContact, setCreatingContact] = useState(false);
  const [showEditContactModal, setShowEditContactModal] = useState(false);
  const [updatingContact, setUpdatingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  const [details, setDetails] = useState<StudentDetails | null>(null);
  const [contacts, setContacts] = useState<StudentContact[]>([]);
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [attendanceCalendar, setAttendanceCalendar] = useState<AttendanceCalendarMonth | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [externalRef, setExternalRef] = useState('');
  const [admittedOn, setAdmittedOn] = useState('');
  const [studentStatus, setStudentStatus] = useState<StudentStatus>('active');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('OTHER');
  const [weightAtBirth, setWeightAtBirth] = useState<string>('');
  const [lengthAtBirth, setLengthAtBirth] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dependantId, setDependantId] = useState<string | null>(null);

  // Attendance calendar navigation
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedBodyCheck, setSelectedBodyCheck] = useState<AttendanceBodyCheck | null>(null);

  const [contactFormData, setContactFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    id_country: '',
    id_type: '',
    id_full: '',
    role: 'GUARDIAN',
    primary: false,
    can_check_in_out: false,
    can_view_records: false,
    can_receive_notifications: false,
    valid_from: '',
    valid_to: '',
    notes: '',
  });

  const [editContactFormData, setEditContactFormData] = useState({
    person_id: '',
    first_name: '',
    last_name: '',
    email: '',
    id_country: '',
    id_type: '',
    id_full: '',
    id_masked: '',
    role: 'GUARDIAN',
    primary: false,
    can_check_in_out: false,
    can_view_records: false,
    can_receive_notifications: false,
    valid_from: '',
    valid_to: '',
    notes: '',
    image_filename: '',
  });

  const addToast = (toast: { title?: string; message: string; variant?: 'success' | 'error' | 'info' }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((t) => [...t, { id, ...toast }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  };

  // Update hash when tab changes without pushing a new history entry
  useEffect(() => {
    history.replaceState(null, '', `#${activeTab}`);
  }, [activeTab]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [d, c, e] = await Promise.all([
          schoolsApi.getStudentDetails(schoolId, studentId),
          schoolsApi.getStudentContacts(schoolId, studentId),
          schoolsApi.getStudentEnrollments(schoolId, studentId),
        ]);
        if (!mounted) return;
        setDetails(d);
        setContacts(c);
        setEnrollments(e);

        setDependantId(d.dependant_id);
        setFirstName(d.first_name);
        setLastName(d.last_name);
        setDob(d.date_of_birth);
        setExternalRef(d.external_ref ?? '');
        setAdmittedOn(d.admitted_on ?? '');
        setStudentStatus(d.status);
        setGender(d.gender);
        setWeightAtBirth(d.weight_at_birth?.toString() ?? '');
        setLengthAtBirth(d.length_at_birth?.toString() ?? '');
      } catch (err) {
        console.error(err);
        setLoadError('Failed to load student data');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [schoolId, studentId]);

  // Fetch attendance calendar when attendance tab is active
  useEffect(() => {
    if (activeTab !== 'attendance') return;

    let mounted = true;
    async function loadAttendance() {
      setAttendanceLoading(true);
      try {
        const calendar = await schoolsApi.getStudentAttendanceCalendar(
          schoolId,
          studentId,
          currentYear,
          currentMonth
        );
        if (mounted) {
          setAttendanceCalendar(calendar);
        }
      } catch (err) {
        console.error('Failed to load attendance calendar:', err);
        addToast({ title: 'Error', message: 'Failed to load attendance calendar.', variant: 'error' });
      } finally {
        if (mounted) {
          setAttendanceLoading(false);
        }
      }
    }
    loadAttendance();
    return () => {
      mounted = false;
    };
  }, [schoolId, studentId, activeTab, currentYear, currentMonth]);

  const fullName = useMemo(() => `${firstName} ${lastName}`.trim(), [firstName, lastName]);

  const studentStatusClasses =
    studentStatus === 'active'
      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
      : studentStatus === 'left'
      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';

  const studentStatusLabel =
    studentStatus === 'active' ? 'Active' : studentStatus === 'left' ? 'Left' : 'Graduated';

  const onSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const onRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingContact(true);
    try {
      const newContact = await schoolsApi.createStudentContact(schoolId, studentId, {
        first_name: contactFormData.first_name.trim(),
        last_name: contactFormData.last_name.trim(),
        email: contactFormData.email || null,
        id_country: contactFormData.id_country || null,
        id_type: contactFormData.id_type || null,
        id_full: contactFormData.id_full || null,
        role: contactFormData.role,
        primary: contactFormData.primary,
        can_check_in_out: contactFormData.can_check_in_out,
        can_view_records: contactFormData.can_view_records,
        can_receive_notifications: contactFormData.can_receive_notifications,
        valid_from: contactFormData.valid_from || null,
        valid_to: contactFormData.valid_to || null,
        notes: contactFormData.notes || null,
      });
      setContacts([newContact, ...contacts]);
      setShowCreateContactModal(false);
      setContactFormData({
        first_name: '',
        last_name: '',
        email: '',
        id_country: '',
        id_type: '',
        id_full: '',
        role: 'GUARDIAN',
        primary: false,
        can_check_in_out: false,
        can_view_records: false,
        can_receive_notifications: false,
        valid_from: '',
        valid_to: '',
        notes: '',
      });
      addToast({ title: 'Success', message: 'Contact created successfully!', variant: 'success' });
    } catch (err) {
      console.error(err);
      addToast({ title: 'Error', message: 'Failed to create contact.', variant: 'error' });
    } finally {
      setCreatingContact(false);
    }
  };

  const openEditContactModal = (contact: StudentContact) => {
    setEditingContactId(contact.id);
    setEditContactFormData({
      person_id: contact.person_id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email ?? '',
      id_country: contact.id_country ?? '',
      id_type: contact.id_type ?? '',
      id_full: contact.id_full ?? '',
      id_masked: contact.id_masked ?? '',
      role: contact.role,
      primary: contact.primary,
      can_check_in_out: contact.can_check_in_out,
      can_view_records: contact.can_view_records,
      can_receive_notifications: contact.can_receive_notifications,
      valid_from: contact.valid_from ?? '',
      valid_to: contact.valid_to ?? '',
      notes: contact.notes ?? '',
      image_filename: contact.image_filename ?? '',
    });
    setShowEditContactModal(true);
  };

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContactId) return;

    setUpdatingContact(true);
    try {
      const updatedContact = await schoolsApi.updateStudentContact(schoolId, studentId, editingContactId, {
        person_id: editContactFormData.person_id,
        email: editContactFormData.email || null,
        full_name: `${editContactFormData.first_name.trim()} ${editContactFormData.last_name.trim()}`.trim(),
        first_name: editContactFormData.first_name.trim(),
        last_name: editContactFormData.last_name.trim(),
        id_country: editContactFormData.id_country || null,
        id_type: editContactFormData.id_type || null,
        id_full: editContactFormData.id_full || null,
        id_masked: editContactFormData.id_masked || null,
        role: editContactFormData.role,
        primary: editContactFormData.primary,
        can_check_in_out: editContactFormData.can_check_in_out,
        can_view_records: editContactFormData.can_view_records,
        can_receive_notifications: editContactFormData.can_receive_notifications,
        valid_from: editContactFormData.valid_from || null,
        valid_to: editContactFormData.valid_to || null,
        notes: editContactFormData.notes || null,
        image_filename: editContactFormData.image_filename || null,
      });

      setContacts((prev) => prev.map((contact) => (contact.id === updatedContact.id ? updatedContact : contact)));
      setShowEditContactModal(false);
      setEditingContactId(null);
      addToast({ title: 'Success', message: 'Contact updated successfully!', variant: 'success' });
    } catch (err) {
      console.error(err);
      addToast({ title: 'Error', message: 'Failed to update contact.', variant: 'error' });
    } finally {
      setUpdatingContact(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      if (!dependantId) {
        throw new Error('Dependant ID not available');
      }
      await Promise.all([
        schoolsApi.updateDependant(dependantId, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: dob,
          gender,
          weight_at_birth: weightAtBirth ? parseFloat(weightAtBirth) : null,
          length_at_birth: lengthAtBirth ? parseFloat(lengthAtBirth) : null,
        }),
        schoolsApi.updateStudent(schoolId, studentId, {
          external_ref: externalRef.trim() || null,
          admitted_on: admittedOn || null,
          status: studentStatus,
        }),
      ]);
      if (imageFile) {
        await schoolsApi.uploadStudentImage(dependantId, imageFile);
      }
      addToast({ title: 'Success', message: 'Student updated successfully', variant: 'success' });
      setDetails((prev) => prev ? { ...prev, first_name: firstName, last_name: lastName, full_name: fullName, date_of_birth: dob, external_ref: externalRef || null, admitted_on: admittedOn || null, status: studentStatus, gender, image_filename: imagePreview ? 'preview' : prev.image_filename } : prev);
    } catch (err) {
      console.error(err);
      addToast({ title: 'Error', message: 'Failed to save changes.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#1A1A6D] dark:text-[#20B2AA]" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 flex items-center gap-2 text-red-700 dark:text-red-400">
        <AlertCircle className="w-5 h-5" />
        <span className="text-sm">{loadError}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] overflow-hidden flex items-center justify-center text-white">
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt={fullName || 'Student'} className="w-full h-full object-cover" />
            ) : details?.image_filename ? (
              <StudentProfileImage
                schoolId={schoolId}
                studentId={studentId}
                imageFilename={details.image_filename}
                alt={fullName || 'Student'}
                className="w-full h-full object-cover"
                fallbackClassName="w-full h-full flex items-center justify-center"
              />
            ) : (
              <ImageIcon className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{fullName || details?.full_name || 'Student'}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${studentStatusClasses}`}>
                {studentStatusLabel}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Manage student details, contacts and enrollments</p>
          </div>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
          <TabButton icon={<Users className="w-4 h-4" />} active={activeTab === 'details'} onClick={() => setActiveTab('details')}>Details</TabButton>
          <TabButton icon={<Contact className="w-4 h-4" />} active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')}>Contacts</TabButton>
          <TabButton icon={<GraduationCap className="w-4 h-4" />} active={activeTab === 'enrollments'} onClick={() => setActiveTab('enrollments')}>Enrollments</TabButton>
          <TabButton icon={<Calendar className="w-4 h-4" />} active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')}>Attendance</TabButton>
        </div>

        <div className="pt-4">
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date of Birth</label>
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">External Reference</label>
                <input
                  value={externalRef}
                  onChange={(e) => setExternalRef(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="External student reference"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Admitted On</label>
                <input
                  type="date"
                  value={admittedOn}
                  onChange={(e) => setAdmittedOn(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student Status</label>
                <select
                  value={studentStatus}
                  onChange={(e) => setStudentStatus(e.target.value as StudentStatus)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="active">Active</option>
                  <option value="left">Left</option>
                  <option value="graduated">Graduated</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender</label>
                <select value={gender} onChange={(e) => setGender(e.target.value as 'MALE' | 'FEMALE' | 'OTHER')} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight at Birth (kg)</label>
                <input type="number" step="0.01" value={weightAtBirth} onChange={(e) => setWeightAtBirth(e.target.value)} placeholder="e.g., 3.5" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Length at Birth (cm)</label>
                <input type="number" step="0.1" value={lengthAtBirth} onChange={(e) => setLengthAtBirth(e.target.value)} placeholder="e.g., 50.5" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
              <div className="md:col-span-2 flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Upload Image</span>
                  <input type="file" accept="image/*" onChange={onSelectImage} className="hidden" />
                </label>
                {imageFile && (
                  <button onClick={onRemoveImage} className="text-sm text-red-600 dark:text-red-400 hover:underline">Remove Image</button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowCreateContactModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                  Add Contact
                </button>
              </div>
              <div className="space-y-2">
                {contacts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Contact className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No contacts found</p>
                  </div>
                ) : (
                  contacts.map((contact) => {
                    const isExpanded = expandedContactId === contact.id;
                    return (
                      <div key={contact.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        {/* Main Row */}
                        <button
                        onClick={() => setExpandedContactId(isExpanded ? null : contact.id)}
                        className="w-full px-4 py-3 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                      >
                        {/* Expand Icon */}
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                          )}
                        </div>

                        {/* Profile Image */}
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                          <ContactProfileImage
                            schoolId={schoolId}
                            studentId={studentId}
                            contactId={contact.id}
                            imageFilename={contact.image_filename}
                            alt={contact.full_name}
                            className="w-full h-full object-cover"
                            fallbackClassName="w-full h-full rounded-lg bg-gradient-to-br from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] flex items-center justify-center text-white text-sm font-semibold"
                          />
                        </div>

                        {/* Name & Email */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {contact.full_name}
                            </span>
                            {contact.primary && (
                              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded">
                                Primary
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {contact.email || 'No email'}
                          </div>
                        </div>

                        {/* Role */}
                        <div className="flex-shrink-0 text-sm text-gray-600 dark:text-gray-400">
                          {contact.role}
                        </div>

                        {/* Permissions Icons */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="flex items-center gap-1" title="Check in/out">
                            {contact.can_check_in_out ? (
                              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <X className="w-4 h-4 text-gray-400 dark:text-gray-600" />
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-500">Check</span>
                          </div>
                          <div className="flex items-center gap-1" title="View records">
                            {contact.can_view_records ? (
                              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <X className="w-4 h-4 text-gray-400 dark:text-gray-600" />
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-500">View</span>
                          </div>
                          <div className="flex items-center gap-1" title="Notifications">
                            {contact.can_receive_notifications ? (
                              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <X className="w-4 h-4 text-gray-400 dark:text-gray-600" />
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-500">Notify</span>
                          </div>
                        </div>
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-700">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Validity Period */}
                            {(contact.valid_from || contact.valid_to) && (
                              <div>
                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                  Valid Period
                                </div>
                                <div className="text-sm text-gray-900 dark:text-gray-100">
                                  {contact.valid_from ? new Date(contact.valid_from).toLocaleDateString() : 'N/A'} — {contact.valid_to ? new Date(contact.valid_to).toLocaleDateString() : 'Ongoing'}
                                </div>
                              </div>
                            )}

                            {/* ID Information */}
                            {(contact.id_country || contact.id_type || contact.id_masked) && (
                              <div>
                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                  Identification
                                </div>
                                <div className="text-sm text-gray-900 dark:text-gray-100 space-y-0.5">
                                  {contact.id_type && <div>Type: {contact.id_type}</div>}
                                  {contact.id_country && <div>Country: {contact.id_country}</div>}
                                  {contact.id_masked && <div>ID: {contact.id_masked}</div>}
                                </div>
                              </div>
                            )}

                            {/* Notes */}
                            {contact.notes && (
                              <div className="md:col-span-2">
                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                  Notes
                                </div>
                                <div className="text-sm text-gray-900 dark:text-gray-100">
                                  {contact.notes}
                                </div>
                              </div>
                            )}

                            {/* Person ID */}
                            <div className="md:col-span-2">
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                Person ID
                              </div>
                              <div className="text-xs font-mono text-gray-600 dark:text-gray-400">
                                {contact.person_id}
                              </div>
                            </div>

                            <div className="md:col-span-2 flex justify-end pt-2">
                              <button
                                type="button"
                                onClick={() => openEditContactModal(contact)}
                                className="px-3 py-1.5 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white text-sm rounded-lg hover:opacity-90 transition-opacity"
                              >
                                Edit Contact
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
                )}
              </div>
            </div>
          )}

          {activeTab === 'enrollments' && (
            <div className="space-y-4">
              {enrollments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No enrollments found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Enrollment</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Classroom</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">School Year</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments.map((enrollment) => {
                        const startDate = new Date(enrollment.starts_on);
                        const endDate = enrollment.ends_on ? new Date(enrollment.ends_on) : null;
                        const isActive = !endDate || endDate >= new Date();
                        
                        return (
                          <tr
                            key={enrollment.id}
                            className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                              !isActive ? 'opacity-50' : ''
                            }`}
                          >
                            {/* Enrollment Period */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-900 dark:text-gray-100">{startDate.toLocaleDateString()}</span>
                                <span className="text-gray-600 dark:text-gray-400">—</span>
                                <span className="text-gray-900 dark:text-gray-100">{endDate ? endDate.toLocaleDateString() : 'Ongoing'}</span>
                              </div>
                            </td>

                            {/* Classroom */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                                  <ClassroomProfileImage
                                    schoolId={schoolId}
                                    classroomId={enrollment.classroom.id}
                                    imageFilename={enrollment.classroom.image_filename}
                                    alt={enrollment.classroom.name}
                                    className="w-full h-full object-cover"
                                    fallbackClassName="w-full h-full rounded-lg bg-gradient-to-br from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] flex items-center justify-center"
                                  />
                                </div>
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {enrollment.classroom.name}
                                </span>
                              </div>
                            </td>

                            {/* School Year */}
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-gray-900 dark:text-gray-100">{enrollment.school_year.name}</span>
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  {new Date(enrollment.school_year.starts_on).toLocaleDateString()} — {new Date(enrollment.school_year.ends_on).toLocaleDateString()}
                                </span>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4">
                              <div className="flex flex-col items-start gap-2">
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    enrollment.status === 'enrolled'
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                      : enrollment.status === 'withdrawn'
                                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                      : enrollment.status === 'transferred'
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                                  }`}
                                >
                                  {enrollment.status.charAt(0).toUpperCase() + enrollment.status.slice(1)}
                                </span>
                                {isActive && enrollment.status === 'enrolled' ? (
                                  <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    Active
                                  </span>
                                ) : !isActive ? (
                                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
                                    Ended
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-4">
              {attendanceLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#1A1A6D] dark:text-[#20B2AA]" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Month Navigation */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        setSelectedDay(null);
                        if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(currentYear - 1); }
                        else { setCurrentMonth(currentMonth - 1); }
                      }}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    </button>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {new Date(currentYear, currentMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button
                      onClick={() => {
                        setSelectedDay(null);
                        if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(currentYear + 1); }
                        else { setCurrentMonth(currentMonth + 1); }
                      }}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300 rotate-180" />
                    </button>
                  </div>

                  {/* Calendar Grid — Monday first */}
                  <div className="select-none">
                    <div className="grid grid-cols-7 mb-1">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <div key={i} className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-1">
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-y-1">
                      {(() => {
                        // Monday-first offset: Mon=0 … Sun=6
                        const rawFirst = new Date(currentYear, currentMonth - 1, 1).getDay();
                        const offset = (rawFirst + 6) % 7;
                        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
                        const cells: (number | null)[] = [...Array(offset).fill(null)];
                        for (let d = 1; d <= daysInMonth; d++) cells.push(d);

                        const eventsByDay: Record<number, typeof attendanceCalendar extends null ? never : NonNullable<typeof attendanceCalendar>['events'][number]> = {};
                        attendanceCalendar?.events.forEach(e => { eventsByDay[e.day] = e; });

                        return cells.map((day, idx) => {
                          if (day === null) return <div key={idx} />;
                          const ev = eventsByDay[day];
                          const hasActivity = ev && (ev.attendances.length > 0 || ev.body_checks.length > 0);
                          const isSelected = selectedDay === day;
                          return (
                            <button
                              key={idx}
                              onClick={() => setSelectedDay(isSelected ? null : day)}
                              className={`flex flex-col items-center justify-start pt-1 pb-2 rounded-xl transition-colors ${
                                isSelected
                                  ? 'bg-[#1A1A6D] dark:bg-[#20B2AA]'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                              }`}
                            >
                              <span className={`text-sm font-medium leading-6 ${
                                isSelected ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                              }`}>
                                {day}
                              </span>
                              {hasActivity ? (
                                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                                  isSelected ? 'bg-white' : 'bg-green-500'
                                }`} />
                              ) : (
                                <span className="w-1.5 h-1.5 mt-0.5" />
                              )}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Day event cards */}
                  {selectedDay && (() => {
                    const ev = attendanceCalendar?.events.find(e => e.day === selectedDay);
                    const allEvents = [
                      ...(ev?.attendances ?? []).map(a => ({ type: 'attendance' as const, data: a })),
                      ...(ev?.body_checks ?? []).map(b => ({ type: 'bodycheck' as const, data: b })),
                    ].sort((a, b) => {
                      const tA = a.type === 'attendance' ? a.data.occurred_at : a.data.checked_at;
                      const tB = b.type === 'attendance' ? b.data.occurred_at : b.data.checked_at;
                      return new Date(tA).getTime() - new Date(tB).getTime();
                    });

                    if (allEvents.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                          No activity recorded for this day.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          {new Date(currentYear, currentMonth - 1, selectedDay).toLocaleDateString('en-US', {
                            weekday: 'long', day: 'numeric', month: 'long',
                          })}
                        </p>
                        {allEvents.map((item, i) => {
                          if (item.type === 'attendance') {
                            const a = item.data;
                            const isIn = a.event_type === 'check_in';
                            const time = new Date(a.occurred_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                            return (
                              <div key={i} className="flex gap-4 bg-[#1A1A6D] dark:bg-[#1e2a4a] rounded-xl px-5 py-4 text-white">
                                <div className="flex-shrink-0 min-w-[80px]">
                                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{isIn ? 'Check in' : 'Check out'}</p>
                                  <p className="text-lg font-bold mt-0.5">{time}</p>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm">{details?.full_name}</p>
                                  {a.handed_over_by && (
                                    <p className="text-xs opacity-80 mt-0.5">Handed over by {a.handed_over_by}</p>
                                  )}
                                  {a.notes && (
                                    <p className="text-xs opacity-70 mt-1 italic">{a.notes}</p>
                                  )}
                                </div>
                              </div>
                            );
                          } else {
                            const b = item.data;
                            const time = new Date(b.checked_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                            const markerCount = b.front.length + b.back.length;
                            return (
                              <button
                                key={i}
                                onClick={() => setSelectedBodyCheck(b)}
                                className="w-full flex gap-4 bg-[#1A1A6D] dark:bg-[#1e2a4a] rounded-xl px-5 py-4 text-white text-left hover:opacity-90 transition-opacity"
                              >
                                <div className="flex-shrink-0 min-w-[80px]">
                                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Body Check</p>
                                  <p className="text-lg font-bold mt-0.5">{time}</p>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm">By {b.performed_by}</p>
                                  {markerCount > 0 && (
                                    <p className="text-xs opacity-80 mt-0.5">{markerCount} note{markerCount !== 1 ? 's' : ''}</p>
                                  )}
                                  <p className="text-xs opacity-60 mt-1">Tap to view</p>
                                </div>
                              </button>
                            );
                          }
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Body Check Modal */}
          {selectedBodyCheck && (
            <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-[#121212] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-3">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Body Check</h3>
                  <button
                    onClick={() => setSelectedBodyCheck(null)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                <div className="px-6 pb-6 space-y-5">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    By {selectedBodyCheck.performed_by} ·{' '}
                    {new Date(selectedBodyCheck.checked_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </p>

                  {/* Front + Back images with markers */}
                  <div className="grid grid-cols-2 gap-6">
                    {(['front', 'back'] as const).map((side) => {
                      const markers = selectedBodyCheck[side];
                      const imgSrc = side === 'front'
                        ? '/assets/images/body-check/baby-front.png'
                        : '/assets/images/body-check/baby-back.png';
                      return (
                        <div key={side} className="flex flex-col items-center gap-3">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            {side}
                          </p>
                          {/* Image with overlaid marker dots — wrapper is exactly image size */}
                          <div className="relative inline-block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgSrc}
                              alt={side}
                              className="block w-40 object-contain"
                            />
                            {/* Marker dots at normalized (x,y) % positions */}
                            {markers.map((m, i) => (
                              <div
                                key={i}
                                title={m.note || undefined}
                                className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#1A1A6D] dark:border-[#20B2AA] flex items-center justify-center z-10 cursor-default"
                                style={{ left: `${m.x_marker * 100}%`, top: `${m.y_marker * 100}%` }}
                              >
                                <div className="w-2 h-2 rounded-full bg-[#1A1A6D] dark:bg-[#20B2AA]" />
                              </div>
                            ))}
                          </div>
                          {/* Notes list */}
                          {markers.length > 0 ? (
                            <div className="w-full space-y-1">
                              {markers.map((m, i) => (
                                <div key={i} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs text-gray-800 dark:text-gray-200">
                                  <span className="font-semibold text-[#1A1A6D] dark:text-[#20B2AA]">#{i + 1}</span>
                                  {m.note ? ` — ${m.note}` : ' — no note'}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 dark:text-gray-600 text-center">No markers</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Contact Modal */}
      {showEditContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Edit Student Contact
              </h3>
              <button
                onClick={() => {
                  setShowEditContactModal(false);
                  setEditingContactId(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateContact} className="p-6 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={editContactFormData.first_name}
                      onChange={(e) => setEditContactFormData({ ...editContactFormData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={editContactFormData.last_name}
                      onChange={(e) => setEditContactFormData({ ...editContactFormData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editContactFormData.email}
                      onChange={(e) => setEditContactFormData({ ...editContactFormData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Role *
                    </label>
                    <select
                      value={editContactFormData.role}
                      onChange={(e) => setEditContactFormData({ ...editContactFormData, role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    >
                      <option value="MOTHER">Mother</option>
                      <option value="FATHER">Father</option>
                      <option value="SIBLING">Sibling</option>
                      <option value="GUARDIAN">Guardian</option>
                      <option value="TEACHER">Teacher</option>
                      <option value="OTHER">Other</option>
                      <option value="PICKUP_CONTACT">Pickup Contact</option>
                      <option value="EMERGENCY_CONTACT">Emergency Contact</option>
                      <option value="DRIVER">Driver</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Identification</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ID Country
                    </label>
                    <input
                      type="text"
                      value={editContactFormData.id_country}
                      onChange={(e) => setEditContactFormData({ ...editContactFormData, id_country: e.target.value })}
                      placeholder="e.g., ZA"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ID Type
                    </label>
                    <input
                      type="text"
                      value={editContactFormData.id_type}
                      onChange={(e) => setEditContactFormData({ ...editContactFormData, id_type: e.target.value })}
                      placeholder="e.g., national_id"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ID Full
                    </label>
                    <input
                      type="text"
                      value={editContactFormData.id_full}
                      onChange={(e) => setEditContactFormData({ ...editContactFormData, id_full: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Permissions</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editContactFormData.primary}
                      onChange={(e) => setEditContactFormData({ ...editContactFormData, primary: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-700"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Primary Contact</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editContactFormData.can_check_in_out}
                      onChange={(e) => setEditContactFormData({ ...editContactFormData, can_check_in_out: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-700"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Can Check In/Out</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editContactFormData.can_view_records}
                      onChange={(e) => setEditContactFormData({ ...editContactFormData, can_view_records: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-700"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Can View Records</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editContactFormData.can_receive_notifications}
                      onChange={(e) => setEditContactFormData({ ...editContactFormData, can_receive_notifications: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-700"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Can Receive Notifications</span>
                  </label>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Validity Period</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Valid From
                    </label>
                    <input
                      type="date"
                      value={editContactFormData.valid_from}
                      onChange={(e) => setEditContactFormData({ ...editContactFormData, valid_from: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Valid To
                    </label>
                    <input
                      type="date"
                      value={editContactFormData.valid_to}
                      onChange={(e) => setEditContactFormData({ ...editContactFormData, valid_to: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Additional Information</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={editContactFormData.notes}
                    onChange={(e) => setEditContactFormData({ ...editContactFormData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="submit"
                  disabled={updatingContact}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {updatingContact ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Contact
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditContactModal(false);
                    setEditingContactId(null);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Contact Modal */}
      {showCreateContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Add Student Contact
              </h3>
              <button
                onClick={() => setShowCreateContactModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateContact} className="p-6 space-y-4">
              {/* Basic Information */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={contactFormData.first_name}
                      onChange={(e) => setContactFormData({ ...contactFormData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={contactFormData.last_name}
                      onChange={(e) => setContactFormData({ ...contactFormData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={contactFormData.email}
                      onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Role *
                    </label>
                    <select
                      value={contactFormData.role}
                      onChange={(e) => setContactFormData({ ...contactFormData, role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    >
                      <option value="MOTHER">Mother</option>
                      <option value="FATHER">Father</option>
                      <option value="SIBLING">Sibling</option>
                      <option value="GUARDIAN">Guardian</option>
                      <option value="TEACHER">Teacher</option>
                      <option value="OTHER">Other</option>
                      <option value="PICKUP_CONTACT">Pickup Contact</option>
                      <option value="EMERGENCY_CONTACT">Emergency Contact</option>
                      <option value="DRIVER">Driver</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Identification */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Identification</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ID Country
                    </label>
                    <input
                      type="text"
                      value={contactFormData.id_country}
                      onChange={(e) => setContactFormData({ ...contactFormData, id_country: e.target.value })}
                      placeholder="e.g., ZA"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ID Type
                    </label>
                    <input
                      type="text"
                      value={contactFormData.id_type}
                      onChange={(e) => setContactFormData({ ...contactFormData, id_type: e.target.value })}
                      placeholder="e.g., national_id"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ID Full
                    </label>
                    <input
                      type="text"
                      value={contactFormData.id_full}
                      onChange={(e) => setContactFormData({ ...contactFormData, id_full: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Permissions</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={contactFormData.primary}
                      onChange={(e) => setContactFormData({ ...contactFormData, primary: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-700"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Primary Contact</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={contactFormData.can_check_in_out}
                      onChange={(e) => setContactFormData({ ...contactFormData, can_check_in_out: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-700"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Can Check In/Out</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={contactFormData.can_view_records}
                      onChange={(e) => setContactFormData({ ...contactFormData, can_view_records: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-700"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Can View Records</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={contactFormData.can_receive_notifications}
                      onChange={(e) => setContactFormData({ ...contactFormData, can_receive_notifications: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-700"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Can Receive Notifications</span>
                  </label>
                </div>
              </div>

              {/* Validity Period */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Validity Period</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Valid From
                    </label>
                    <input
                      type="date"
                      value={contactFormData.valid_from}
                      onChange={(e) => setContactFormData({ ...contactFormData, valid_from: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Valid To
                    </label>
                    <input
                      type="date"
                      value={contactFormData.valid_to}
                      onChange={(e) => setContactFormData({ ...contactFormData, valid_to: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Additional Information</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={contactFormData.notes}
                    onChange={(e) => setContactFormData({ ...contactFormData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    rows={3}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="submit"
                  disabled={creatingContact}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {creatingContact ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Contact
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateContactModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-sm w-full px-4 py-3 rounded-lg shadow-lg border transition-opacity bg-white dark:bg-[#111217] border-gray-200 dark:border-gray-800 ${
              t.variant === 'success'
                ? 'ring-2 ring-green-500 dark:ring-green-400'
                : t.variant === 'error'
                ? 'ring-2 ring-red-500 dark:ring-red-400'
                : 'ring-1 ring-gray-200 dark:ring-gray-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                {t.title && <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.title}</div>}
                <div className="text-sm text-gray-700 dark:text-gray-300">{t.message}</div>
              </div>
              <button onClick={() => setToasts((s) => s.filter((x) => x.id !== t.id))} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabButton({ icon, active, onClick, children }: { icon: React.ReactNode; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
        active
          ? 'border-[#1A1A6D] dark:border-[#20B2AA] text-[#1A1A6D] dark:text-[#20B2AA]'
          : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
