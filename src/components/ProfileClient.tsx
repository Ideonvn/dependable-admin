'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Upload } from 'lucide-react';
import { meApi, MeUser } from '@/lib/users';
import { userSetupService } from '@/lib/userSetupService';
import UserProfileImage from '@/components/UserProfileImage';

export default function ProfileClient() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await meApi.getMe();
      setUser(data);
      setFirstName(data.first_name);
      setLastName(data.last_name);
    } catch {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;
    setUploadingImage(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await meApi.updateProfileImage(imageFile);
      setUser(updated);
      setImageFile(null);
      setImagePreview(null);
      // Refresh setup data so header avatar updates
      const setup = userSetupService.getSetupData();
      if (setup) {
        userSetupService.setSetupData({ ...setup, image_filename: updated.image_filename });
      }
      setSuccess('Profile picture updated');
    } catch {
      setError('Failed to upload profile picture');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await meApi.updateMe({ first_name: firstName.trim(), last_name: lastName.trim() });
      setUser(updated);
      // Refresh setup data so header name updates
      const setup = userSetupService.getSetupData();
      if (setup) {
        userSetupService.setSetupData({
          ...setup,
          first_name: updated.first_name,
          last_name: updated.last_name,
        });
      }
      setSuccess('Profile updated successfully');
    } catch {
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#121212] rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">My Profile</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your personal details and profile picture</p>
      </div>

      <div className="p-6 space-y-8">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-300">{success}</p>
          </div>
        )}

        {/* Profile Picture */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Profile Picture</h3>
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] flex items-center justify-center">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <UserProfileImage
                  imageFilename={user?.image_filename ?? null}
                  alt={`${user?.first_name ?? ''} ${user?.last_name ?? ''}`}
                  className="w-full h-full object-cover"
                  fallbackClassName="w-full h-full flex items-center justify-center"
                />
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors text-sm font-medium text-gray-700 dark:text-gray-300">
                <Upload className="w-4 h-4" />
                Choose photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  disabled={uploadingImage}
                />
              </label>
              {imageFile && (
                <button
                  onClick={handleImageUpload}
                  disabled={uploadingImage}
                  className="px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                >
                  {uploadingImage ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Save photo'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Name fields */}
        <form onSubmit={handleSave} className="space-y-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Personal Details</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                First name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={saving}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={saving}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="text"
              value={user?.email ?? ''}
              disabled
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-500 cursor-not-allowed"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 font-medium flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
