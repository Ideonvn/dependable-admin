'use client';

import { School } from '@/lib/schools';
import { useRouter } from 'next/navigation';
import SchoolProfileImage from './SchoolProfileImage';

interface SchoolCardMainProps {
  school: School;
}

export default function SchoolCardMain({ school }: SchoolCardMainProps) {
  const router = useRouter();
  const { students_overview } = school;

  const handleClick = () => {
    router.push(`/schools/${school.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className="bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 dark:from-teal-600 dark:via-teal-700 dark:to-blue-700 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:scale-105 border-2 border-blue-400/20 dark:border-teal-400/20"
    >
      {/* School Header with Image */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-shrink-0">
          <SchoolProfileImage
            schoolId={school.id}
            imageFilename={school.image_filename}
            alt={school.name}
            className="w-16 h-16 rounded-full object-cover"
            fallbackClassName="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-white mb-1 truncate">
            {school.name}
          </h3>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="space-y-3">
        {/* Presence Status */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
            <span className="text-2xl font-bold text-white">{students_overview.presence_status.checked_in}</span>
            <span className="text-sm text-white/90">In</span>
          </div>
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
            <span className="text-2xl font-bold text-white">{students_overview.presence_status.checked_out}</span>
            <span className="text-sm text-white/90">Out</span>
          </div>
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
            <span className="text-2xl font-bold text-white">{students_overview.presence_status.absent}</span>
            <span className="text-sm text-white/90">Absent</span>
          </div>
        </div>

        {/* Body Check */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
            <span className="text-2xl font-bold text-white">{students_overview.body_check.checked}</span>
            <span className="text-sm text-white/90">Checked</span>
          </div>
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
            <span className="text-2xl font-bold text-white">{students_overview.body_check.markers}</span>
            <span className="text-sm text-white/90">Markers</span>
          </div>
        </div>

        {/* Student Status */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
            <span className="text-2xl font-bold text-white">{students_overview.status.active}</span>
            <span className="text-sm text-white/90">Active</span>
          </div>
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
            <span className="text-2xl font-bold text-white">{students_overview.status.left}</span>
            <span className="text-sm text-white/90">Left</span>
          </div>
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
            <span className="text-2xl font-bold text-white">{students_overview.status.graduated}</span>
            <span className="text-sm text-white/90">Graduated</span>
          </div>
        </div>
      </div>
    </div>
  );
}
