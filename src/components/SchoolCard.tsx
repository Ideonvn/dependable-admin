'use client';

import { useRouter } from 'next/navigation';
import { Users, CheckCircle, Clock, Upload, Calendar } from 'lucide-react';
import { SchoolWithStats } from '@/lib/schools';

interface SchoolCardProps {
  school: SchoolWithStats;
}

export default function SchoolCard({ school }: SchoolCardProps) {
  const router = useRouter();

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'validated':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'validating':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'validated':
        return 'Validated';
      case 'validating':
        return 'In Progress';
      case 'draft':
        return 'Draft';
      default:
        return 'Unknown';
    }
  };

  const completionPercentage = school.total_students > 0
    ? Math.round((school.submitted_students / school.total_students) * 100)
    : 0;

  return (
    <div
      onClick={() => router.push(`/onboarding/${school.id}`)}
      className="bg-white dark:bg-[#0F1115] rounded-lg shadow hover:shadow-lg transition-shadow duration-200 overflow-hidden cursor-pointer border border-gray-200 dark:border-gray-800 hover:border-[#1A1A6D] dark:hover:border-[#20B2AA]"
    >
      {/* School Header */}
      <div className="relative h-32 bg-gradient-to-br from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4]">
        {school.picture_url && (
          <img
            src={school.picture_url}
            alt={school.name}
            className="w-full h-full object-cover opacity-40"
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          {school.picture_url ? (
            <img
              src={school.picture_url}
              alt={school.name}
              className="w-16 h-16 rounded-full border-4 border-white dark:border-gray-800 shadow-lg object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full border-4 border-white dark:border-gray-800 shadow-lg bg-white dark:bg-gray-800 flex items-center justify-center">
              <Users className="w-8 h-8 text-gray-400 dark:text-gray-600" />
            </div>
          )}
        </div>
      </div>

      {/* School Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg line-clamp-1">
            {school.name}
          </h3>
          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(school.onboarding_status)}`}>
            {getStatusLabel(school.onboarding_status)}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2">
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 text-xs mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>Total Students</span>
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{school.total_students}</div>
          </div>

          <div className="bg-green-50 dark:bg-green-950 rounded-lg p-2">
            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-xs mb-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Validated</span>
            </div>
            <div className="text-xl font-bold text-green-700 dark:text-green-400">{school.validated_students}</div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-950 rounded-lg p-2">
            <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400 text-xs mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Pending</span>
            </div>
            <div className="text-xl font-bold text-yellow-700 dark:text-yellow-400">{school.pending_students}</div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-2">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs mb-1">
              <Upload className="w-3.5 h-3.5" />
              <span>Submitted</span>
            </div>
            <div className="text-xl font-bold text-blue-700 dark:text-blue-400">{school.submitted_students}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
            <span>Completion</span>
            <span className="font-medium">{completionPercentage}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Last Activity */}
        {school.last_activity && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>Last activity {new Date(school.last_activity).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
