'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Building2, Users, BookOpen, UserCog, ClipboardCheck } from 'lucide-react';
import { schoolsApi, School } from '@/lib/schools';
import SchoolDetailsTab from '@/components/school/SchoolDetailsTab';
import StudentsTab from '@/components/school/StudentsTab';
import MembershipTab from '@/components/school/MembershipTab';
import ClassroomsTab from '@/components/school/ClassroomsTab';
import AssignmentsTab from '@/components/school/AssignmentsTab';

type TabType = 'details' | 'students' | 'membership' | 'classrooms' | 'assignments';

export default function SchoolDetailPage() {
  const router = useRouter();
  const params = useParams();
  const schoolId = params.id as string;
  
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('details');

  useEffect(() => {
    loadSchool();
  }, [schoolId]);

  const loadSchool = async () => {
    setLoading(true);
    try {
      const data = await schoolsApi.getSchool(schoolId);
      setSchool(data);
    } catch (error) {
      console.error('Error loading school:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'details' as TabType, label: 'Details', icon: Building2 },
    { id: 'students' as TabType, label: 'Students', icon: Users },
    { id: 'membership' as TabType, label: 'Membership', icon: UserCog },
    { id: 'classrooms' as TabType, label: 'Classrooms', icon: BookOpen },
    { id: 'assignments' as TabType, label: 'Assignments', icon: ClipboardCheck },
  ];

  if (loading) {
    return (
      <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-[#0F1115]">
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  if (!school) {
    return (
      <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-[#0F1115]">
        <div className="bg-white dark:bg-[#121212] rounded-lg shadow border border-gray-200 dark:border-gray-800 p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">School not found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The school you're looking for doesn't exist or has been removed
          </p>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-[#0F1115]">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Schools
        </button>
        
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-[#1A1A6D] dark:text-[#20B2AA]" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{school.name}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Manage school details and operations</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800 mb-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-[#1A1A6D] dark:text-[#20B2AA] border-b-2 border-[#1A1A6D] dark:border-[#20B2AA]'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-[#0F1115] rounded-lg shadow border border-gray-200 dark:border-gray-800">
        {activeTab === 'details' && <SchoolDetailsTab school={school} onUpdate={loadSchool} />}
        {activeTab === 'students' && <StudentsTab schoolId={school.id} />}
        {activeTab === 'membership' && <MembershipTab schoolId={school.id} />}
        {activeTab === 'classrooms' && <ClassroomsTab schoolId={school.id} />}
        {activeTab === 'assignments' && <AssignmentsTab schoolId={school.id} />}
      </div>
    </main>
  );
}
