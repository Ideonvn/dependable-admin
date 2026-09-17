'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { schoolsApi, ClassroomBodyCheckDay, ClassroomBodyCheckStudent } from '@/lib/schools';
import StudentProfileImage from '@/components/StudentProfileImage';
import BodyCheckView from './body-check/BodyCheckView';

interface ClassroomBodyChecksProps {
  schoolId: string;
  classroomId: string;
  initialDate?: string; // YYYY-MM-DD from ?date=
}

// The API's `date` is a UTC day, matching the classroom card's counts
const todayUtc = () => new Date().toISOString().split('T')[0];

const formatDay = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

// A body check doesn't require a check-in, and is itself a physical observation of the child.
// Keeps the checked count a subset of the present count.
const isPresent = (student: ClassroomBodyCheckStudent) =>
  student.checked_in || student.body_checks.length > 0;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

function StudentRow({ schoolId, student, present }: { schoolId: string; student: ClassroomBodyCheckStudent; present: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const name = student.full_name ?? 'Unnamed student';
  const checked = student.body_checks.length > 0;
  const badge = checked
    ? {
        label: `Checked${student.body_checks.length > 1 ? ` ×${student.body_checks.length}` : ''}`,
        className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      }
    : present
      ? { label: 'Not checked', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300' }
      : { label: 'Absent', className: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' };
  const badgeClassName = `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.className}`;

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg">
      {/* Link and expand button are siblings: nesting interactive elements is invalid HTML */}
      <div className="flex items-center gap-3 px-4 py-2">
        <Link
          href={`/schools/${schoolId}/students/${student.id}`}
          className="flex items-center gap-3 min-w-0 group"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
            <StudentProfileImage
              schoolId={schoolId}
              studentId={student.id}
              imageFilename={student.image_filename}
              alt={name}
              className="w-full h-full object-cover"
              fallbackClassName="w-full h-full rounded-full bg-gradient-to-br from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] flex items-center justify-center"
            />
          </div>
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:underline">{name}</span>
        </Link>
        <div className="flex-1" />
        {checked ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex items-center gap-1 flex-shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={expanded ? 'Hide body checks' : 'Show body checks'}
          >
            <span className={badgeClassName}>{badge.label}</span>
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            )}
          </button>
        ) : (
          <span className={`${badgeClassName} flex-shrink-0`}>{badge.label}</span>
        )}
      </div>

      {checked && expanded && (
        <div className="px-4 pb-4 space-y-4">
          {student.body_checks.map((check) => (
            <div key={check.id} className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                By {check.performed_by ?? 'Unknown staff member'} · {formatTime(check.checked_at)}
              </p>
              <BodyCheckView front={check.front} back={check.back} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClassroomBodyChecks({ schoolId, classroomId, initialDate }: ClassroomBodyChecksProps) {
  const router = useRouter();
  const [date, setDate] = useState(() => initialDate ?? todayUtc());
  // Tagged with its date so a result for a previous date is never shown under the new one
  const [result, setResult] = useState<{ date: string; data: ClassroomBodyCheckDay | null; error: string | null } | null>(null);
  const [classroomName, setClassroomName] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    // The single-classroom endpoint omits students_overview despite the Classroom type: read name only
    schoolsApi
      .getClassroom(schoolId, classroomId)
      .then((classroom) => {
        if (!ignore) setClassroomName(classroom.name);
      })
      .catch((error) => console.error('Error loading classroom:', error));
    return () => {
      ignore = true;
    };
  }, [schoolId, classroomId]);

  useEffect(() => {
    let ignore = false;
    schoolsApi
      .getClassroomBodyChecks(schoolId, classroomId, date)
      .then((data) => {
        if (!ignore) setResult({ date, data, error: null });
      })
      .catch(() => {
        if (!ignore) setResult({ date, data: null, error: 'Failed to load body checks. Please try again.' });
      });
    return () => {
      ignore = true;
    };
  }, [schoolId, classroomId, date]);

  const changeDate = (value: string) => {
    if (!value) return;
    setDate(value);
    // replace, not push: no history entry per date change
    router.replace(`?date=${value}`, { scroll: false });
  };

  const loading = result?.date !== date;
  const data = loading ? null : result.data;
  const error = loading ? null : result.error;

  // Departed children are history for this day: never part of the roster or its counts
  const roster = data?.students.filter((s) => !s.no_longer_enrolled) ?? [];
  const departed = data?.students.filter((s) => s.no_longer_enrolled) ?? [];
  const presentCount = roster.filter(isPresent).length;
  const checkedCount = roster.filter((s) => s.body_checks.length > 0).length;
  const markerCount = roster.reduce(
    (sum, s) => sum + s.body_checks.reduce((n, c) => n + c.front.length + c.back.length, 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">Body checks · {classroomName ?? 'Classroom'}</p>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{formatDay(date)}</h2>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => changeDate(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#1A1A6D] dark:text-[#20B2AA]" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      ) : roster.length === 0 && departed.length === 0 ? (
        <p className="text-center py-12 text-gray-500 dark:text-gray-400">No students enrolled on this day</p>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            On this day: <span className="font-semibold text-gray-900 dark:text-gray-100">{checkedCount} of {presentCount}</span> present children checked
            {' · '}
            <span className="font-semibold text-gray-900 dark:text-gray-100">{markerCount}</span> marker{markerCount !== 1 ? 's' : ''} across all checks
            <span className="text-gray-400 dark:text-gray-500"> · {roster.length} enrolled</span>
          </p>

          {roster.length > 0 && (
            <div className="space-y-2">
              {roster.map((student) => (
                <StudentRow key={student.id} schoolId={schoolId} student={student} present={isPresent(student)} />
              ))}
            </div>
          )}

          {departed.length > 0 && (
            <div className="space-y-2 pt-6 border-t border-gray-200 dark:border-gray-800">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">No longer enrolled</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Checked in this classroom on this day, but have since left or moved. Not included in the totals above.
                </p>
              </div>
              {departed.map((student) => (
                <StudentRow key={student.id} schoolId={schoolId} student={student} present={isPresent(student)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
