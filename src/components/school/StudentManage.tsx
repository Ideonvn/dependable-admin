"use client";

import { useEffect, useMemo, useState } from 'react';
import { schoolsApi, StudentDetails, StudentContact, StudentEnrollment } from '@/lib/schools';
import { AlertCircle, CheckCircle2, Image as ImageIcon, Loader2, Save, Upload, Users, GraduationCap, Contact } from 'lucide-react';

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

  const [details, setDetails] = useState<StudentDetails | null>(null);
  const [contacts, setContacts] = useState<StudentContact[]>([]);
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('OTHER');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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

        setFirstName(d.first_name);
        setLastName(d.last_name);
        setDob(d.date_of_birth);
        setGender(d.gender);
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
      await schoolsApi.updateStudentDetails(schoolId, studentId, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dob,
        gender,
      });
      if (imageFile) {
        await schoolsApi.uploadStudentImage(schoolId, studentId, imageFile);
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
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${process.env.NEXT_PUBLIC_API_URL}/files/${details.image_filename}`} alt={fullName || 'Student'} className="w-full h-full object-cover" />
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Email</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Role</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Primary</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Permissions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 px-3 text-gray-900 dark:text-gray-100">{c.full_name}</td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{c.email || '—'}</td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{c.role}</td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{c.primary ? 'Yes' : 'No'}</td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                        <span className="mr-2">Check in/out: {c.can_check_in_out ? 'Yes' : 'No'}</span>
                        <span className="mr-2">View records: {c.can_view_records ? 'Yes' : 'No'}</span>
                        <span>Notifications: {c.can_receive_notifications ? 'Yes' : 'No'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'enrollments' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Classroom</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">School Year</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Starts On</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Ends On</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => (
                    <tr key={e.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 px-3 text-gray-900 dark:text-gray-100">{e.classroom_id}</td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{e.school_year_id}</td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{new Date(e.starts_on).toLocaleDateString()}</td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{e.ends_on ? new Date(e.ends_on).toLocaleDateString() : '—'}</td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
