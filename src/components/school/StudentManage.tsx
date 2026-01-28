"use client";

import { useEffect, useMemo, useState } from 'react';
import { schoolsApi, StudentDetails, StudentContact, StudentEnrollment } from '@/lib/schools';
import { AlertCircle, CheckCircle2, Image as ImageIcon, Loader2, Save, Upload, Users, GraduationCap, Contact, ChevronDown, ChevronRight, Check, X } from 'lucide-react';
import ClassroomProfileImage from '../ClassroomProfileImage';
import ContactProfileImage from '../ContactProfileImage';
import StudentProfileImage from '../StudentProfileImage';

interface StudentManageProps {
  schoolId: string;
  studentId: string;
}

type TabKey = 'details' | 'contacts' | 'enrollments';

export default function StudentManage({ schoolId, studentId }: StudentManageProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

  const [details, setDetails] = useState<StudentDetails | null>(null);
  const [contacts, setContacts] = useState<StudentContact[]>([]);
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('OTHER');
  const [weightAtBirth, setWeightAtBirth] = useState<string>('');
  const [lengthAtBirth, setLengthAtBirth] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dependantId, setDependantId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
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
        setGender(d.gender);
        setWeightAtBirth(d.weight_at_birth?.toString() ?? '');
        setLengthAtBirth(d.length_at_birth?.toString() ?? '');
      } catch (err) {
        console.error(err);
        setError('Failed to load student data');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [schoolId, studentId]);

  const fullName = useMemo(() => `${firstName} ${lastName}`.trim(), [firstName, lastName]);

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

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (!dependantId) {
        throw new Error('Dependant ID not available');
      }
      await schoolsApi.updateDependant(dependantId, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dob,
        gender,
        weight_at_birth: weightAtBirth ? parseFloat(weightAtBirth) : null,
        length_at_birth: lengthAtBirth ? parseFloat(lengthAtBirth) : null,
      });
      if (imageFile) {
        await schoolsApi.uploadStudentImage(dependantId, imageFile);
      }
      setSuccess('Student updated successfully');
      setDetails((prev) => prev ? { ...prev, first_name: firstName, last_name: lastName, full_name: fullName, date_of_birth: dob, gender, image_filename: imagePreview ? 'preview' : prev.image_filename } : prev);
    } catch (err) {
      console.error(err);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#1A1A6D] dark:text-[#20B2AA]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex items-center gap-2 text-red-700 dark:text-red-400">
        <AlertCircle className="w-5 h-5" />
        <span className="text-sm">{error}</span>
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
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{fullName || details?.full_name || 'Student'}</h2>
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

      {success && (
        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div>
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
          <TabButton icon={<Users className="w-4 h-4" />} active={activeTab === 'details'} onClick={() => setActiveTab('details')}>Details</TabButton>
          <TabButton icon={<Contact className="w-4 h-4" />} active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')}>Contacts</TabButton>
          <TabButton icon={<GraduationCap className="w-4 h-4" />} active={activeTab === 'enrollments'} onClick={() => setActiveTab('enrollments')}>Enrollments</TabButton>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender</label>
                <select value={gender} onChange={(e) => setGender(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
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
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
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
        </div>
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
