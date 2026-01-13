'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, GraduationCap, Building2 } from 'lucide-react';
import { schoolsApi, SchoolWithStats } from '@/lib/schools';
import SchoolCard from '@/components/SchoolCard';

export default function DashboardClient() {
  const router = useRouter();
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchools();
  }, []);

  const loadSchools = async () => {
    setLoading(true);
    try {
      const data = await schoolsApi.getAllSchools();
      setSchools(data);
    } catch (error) {
      console.error('Error loading schools:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-[#1A1A6D] dark:text-[#20B2AA]" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Schools</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Manage school onboarding and student data</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
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
      ) : schools.length === 0 ? (
        <div className="bg-white dark:bg-[#0F1115] rounded-lg shadow border border-gray-200 dark:border-gray-800 p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No schools yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Get started by creating your first school onboarding
          </p>
          <button
            onClick={() => router.push('/onboarding/create')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-colors font-medium"
          >
            <GraduationCap className="w-5 h-5" />
            Create First School
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {schools.map((school) => (
            <SchoolCard key={school.id} school={school} />
          ))}
        </div>
      )}
    </main>
  );
}
