'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Building2, Image as ImageIcon } from 'lucide-react';
import { schoolOnboardingApi } from '@/lib/schoolOnboarding';

export default function SchoolOnboardingCreate() {
  const router = useRouter();
  const [schoolName, setSchoolName] = useState('');
  const [schoolPicture, setSchoolPicture] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSchoolPictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSchoolPicture(e.target.files[0]);
    }
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith('.csv')) {
        setError('Please upload a CSV file');
        return;
      }
      setCsvFile(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!schoolName.trim()) {
      setError('School name is required');
      return;
    }
    
    if (!schoolPicture) {
      setError('School picture is required');
      return;
    }
    
    if (!csvFile) {
      setError('CSV file is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const onboarding = await schoolOnboardingApi.createSchoolOnboarding(
        schoolName,
        schoolPicture,
        csvFile
      );
      
      // Navigate to the edit page with the onboarding data
      router.push(`/onboarding/${onboarding.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create onboarding');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-gray-50 dark:bg-[#0F1115] py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-[#121212] rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 p-8">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="w-8 h-8 text-[#1A1A6D] dark:text-[#20B2AA]" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              New School Onboarding
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* School Name */}
            <div>
              <label htmlFor="schoolName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                School Name *
              </label>
              <input
                type="text"
                id="schoolName"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent"
                placeholder="e.g., Sunnydale Primary School"
                disabled={loading}
              />
            </div>

            {/* School Picture */}
            <div>
              <label htmlFor="schoolPicture" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                School Picture *
              </label>
              <div className="flex items-center gap-4">
                <label className="flex-1 flex items-center justify-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-gray-400 dark:hover:border-gray-600 cursor-pointer transition-colors">
                  <ImageIcon className="w-5 h-5 text-gray-400 dark:text-gray-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {schoolPicture ? schoolPicture.name : 'Choose school picture'}
                  </span>
                  <input
                    type="file"
                    id="schoolPicture"
                    accept="image/*"
                    onChange={handleSchoolPictureChange}
                    className="hidden"
                    disabled={loading}
                  />
                </label>
                {schoolPicture && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                    <img
                      src={URL.createObjectURL(schoolPicture)}
                      alt="School preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* CSV File */}
            <div>
              <label htmlFor="csvFile" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                CSV File *
              </label>
              <div className="space-y-2">
                <label className="flex items-center justify-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-gray-400 dark:hover:border-gray-600 cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 text-gray-400 dark:text-gray-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {csvFile ? csvFile.name : 'Choose CSV file'}
                  </span>
                  <input
                    type="file"
                    id="csvFile"
                    accept=".csv"
                    onChange={handleCsvFileChange}
                    className="hidden"
                    disabled={loading}
                  />
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Required columns: first_name, last_name, gender, date_of_birth, primary_name, primary_email, class_name
                </p>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={loading}
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg font-medium hover:opacity-90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Onboarding'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
