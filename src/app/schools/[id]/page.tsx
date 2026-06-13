'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Building2, Users, BookOpen, UserCog, ClipboardCheck, Receipt, Calendar, CalendarDays, Bell, Download, RefreshCw, Loader2, FileText } from 'lucide-react';
import { schoolsApi, School, SchoolReportResponse } from '@/lib/schools';
import SchoolDetailsTab from '@/components/school/SchoolDetailsTab';
import StudentsTab from '@/components/school/StudentsTab';
import MembershipTab from '@/components/school/MembershipTab';
import ClassroomsTab from '@/components/school/ClassroomsTab';
import EnrollmentsTab from '@/components/school/EnrollmentsTab';
import BillingTab from '@/components/school/BillingTab';
import SchoolYearsTab from '@/components/school/SchoolYearsTab';
import CalendarTab from '@/components/school/calendar/CalendarTab';
import NoticesTab from '@/components/school/notices/NoticesTab';
import LoggingTab from '@/components/school/LoggingTab';

type TabType = 'details' | 'students' | 'membership' | 'classrooms' | 'enrollments' | 'schoolYears' | 'billing' | 'calendar' | 'notices' | 'logging';

const getInitialTab = (): TabType => {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.slice(1);
    if (['details', 'students', 'membership', 'classrooms', 'enrollments', 'schoolYears', 'billing', 'calendar', 'notices', 'logging'].includes(hash)) {
      return hash as TabType;
    }
  }
  return 'details';
};

export default function SchoolDetailPage() {
  const router = useRouter();
  const params = useParams();
  const schoolId = params.id as string;
  
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  const [reportStatus, setReportStatus] = useState<SchoolReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportChecking, setReportChecking] = useState(false);

  // Update hash when tab changes
  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

  useEffect(() => {
    loadSchool();
    fetchReportStatus();
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

  const fetchReportStatus = async () => {
    setReportChecking(true);
    try {
      const status = await schoolsApi.getSchoolReportStatus(schoolId);
      setReportStatus(status);
    } catch (error) {
      console.error('Error fetching report status:', error);
    } finally {
      setReportChecking(false);
    }
  };

  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const status = await schoolsApi.requestSchoolReport(schoolId);
      setReportStatus(status);
    } catch (error) {
      console.error('Error requesting report:', error);
    } finally {
      setReportLoading(false);
    }
  };

  const handleDownloadReport = () => {
    if (reportStatus?.download_url) {
      window.open(reportStatus.download_url, '_blank');
    }
  };

  const isReportReady = reportStatus?.ready && !!reportStatus.download_url;
  const isReportGenerating = reportStatus?.status === 'PENDING' || reportStatus?.status === 'RUNNING';

  const tabs = [
    { id: 'details' as TabType, label: 'Details', icon: Building2 },
    { id: 'students' as TabType, label: 'Students', icon: Users },
    { id: 'membership' as TabType, label: 'Membership', icon: UserCog },
    { id: 'classrooms' as TabType, label: 'Classrooms', icon: BookOpen },
    { id: 'enrollments' as TabType, label: 'Enrollments', icon: ClipboardCheck },
    { id: 'schoolYears' as TabType, label: 'School Years', icon: Calendar },
    { id: 'calendar' as TabType, label: 'Calendar', icon: CalendarDays },
    { id: 'notices' as TabType, label: 'Notices', icon: Bell },
    { id: 'logging' as TabType, label: 'Logging', icon: FileText },
    { id: 'billing' as TabType, label: 'Billing', icon: Receipt },
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
        
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-[#1A1A6D] dark:text-[#20B2AA]" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{school.name}</h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Manage school details and operations</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isReportReady ? (
              <button
                onClick={handleDownloadReport}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                <Download className="w-4 h-4" />
                Download Report
              </button>
            ) : isReportGenerating ? (
              <button
                disabled
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg opacity-80"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </button>
            ) : (
              <button
                onClick={handleGenerateReport}
                disabled={reportLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {reportLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Generate Report
                  </>
                )}
              </button>
            )}

            <button
              onClick={fetchReportStatus}
              disabled={reportChecking}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-60"
              title="Refresh report status"
            >
              <RefreshCw className={`w-4 h-4 ${reportChecking ? 'animate-spin' : ''}`} />
              {reportChecking ? 'Checking...' : 'Refresh'}
            </button>
          </div>
        </div>

        {reportStatus?.message && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {reportStatus.message}
          </p>
        )}
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
        {activeTab === 'enrollments' && <EnrollmentsTab schoolId={school.id} />}
        {activeTab === 'schoolYears' && <SchoolYearsTab schoolId={school.id} />}
        {activeTab === 'billing' && <BillingTab schoolId={school.id} />}
        {activeTab === 'calendar' && <CalendarTab schoolId={school.id} />}
        {activeTab === 'notices' && <NoticesTab schoolId={school.id} />}
        {activeTab === 'logging' && <LoggingTab schoolId={school.id} />}
      </div>
    </main>
  );
}
