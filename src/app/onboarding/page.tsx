'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, GraduationCap, Building2, ArrowLeft } from 'lucide-react';
import { onboardingApi, SchoolWithStats } from '@/lib/schools';
import { SCHOOL_STATUSES, SCHOOL_STATUS_META } from '@/lib/schoolStatus';
import SchoolCard from '@/components/SchoolCard';
import { userSetupService } from '@/lib/userSetupService';

type StatusFilter = 'default' | (typeof SCHOOL_STATUSES)[number];

export default function OnboardingPage() {
  const router = useRouter();
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('default');

  // Default view hides archived schools; a specific filter matches exactly.
  const filteredSchools = schools.filter((s) =>
    statusFilter === 'default' ? s.school_status !== 'archived' : s.school_status === statusFilter
  );

  useEffect(() => {
    if (!userSetupService.isAdmin()) {
      router.replace('/');
      return;
    }
    loadSchools();
  }, []);

  const loadSchools = async () => {
    setLoading(true);
    try {
      const data = await onboardingApi.getAllSchools();
      setSchools(data);
    } catch (error) {
      console.error('Error loading schools:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-[#0F1115]">
      <button
        onClick={() => router.push('/')}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Schools
      </button>

      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-[#1A1A6D] dark:text-[#20B2AA]" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">School Onboarding</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Manage school onboarding and student data import</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent"
          >
            <option value="default">All (excl. archived)</option>
            {SCHOOL_STATUSES.map((s) => (
              <option key={s} value={s}>{SCHOOL_STATUS_META[s].label}</option>
            ))}
          </select>

          <button
            onClick={loadSchools}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button
            onClick={() => router.push('/onboarding/create')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] text-white rounded-lg hover:opacity-90 transition-all shadow-lg hover:shadow-xl font-medium"
          >
            <GraduationCap className="w-5 h-5" />
            New School Onboarding
          </button>
        </div>
      </div>

      {/* Schools Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredSchools.length === 0 ? (
        <div className="bg-white dark:bg-[#0F1115] rounded-lg shadow border border-gray-200 dark:border-gray-800 p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {schools.length === 0 ? 'No schools yet' : 'No schools match this filter'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {schools.length === 0 ? 'Get started by creating your first school onboarding' : 'Try a different status filter'}
          </p>
          {schools.length === 0 && (
            <button
              onClick={() => router.push('/onboarding/create')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-colors font-medium"
            >
              <GraduationCap className="w-5 h-5" />
              Create First School
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {filteredSchools.map((school) => (
            <SchoolCard key={school.school_id} school={school} />
          ))}
        </div>
      )}
    </main>
  );
}
