'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  Bell,
  CheckCircle2,
  Clock,
  LogOut,
  Mail,
  Search,
  Trash2,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import {
  schoolsApi,
  TransitionAction,
  TransitionEntryInput,
  TransitionStudent,
  YearTransitionBoard as Board,
} from '@/lib/schools';
import { parseApiError } from '@/lib/apiError';
import ModalOverlay from '@/components/ModalOverlay';
import OnboardStudentModal from '@/components/OnboardStudentModal';
import ConfirmDialog from '@/components/ConfirmDialog';

interface YearTransitionBoardProps {
  schoolId: string;
  yearId: string;
  // The year was just created with default dates by "Plan next year".
  justCreated?: boolean;
}

type LeaverStatus = 'graduated' | 'left' | null;

// Single-select tiles, as in the app's TileSelectField.
const LEAVER_OPTIONS: { value: LeaverStatus; label: string; detail: string }[] = [
  { value: 'graduated', label: 'Graduated', detail: 'Finished at this school' },
  { value: 'left', label: 'Left', detail: 'Moved on before finishing' },
  { value: null, label: 'Stay active', detail: 'Class ends, status unchanged' },
];

// A column is a classroom id, or one of these two.
const LEAVING = '__leaving__';
const NO_CLASS = '__no_class__';

type Toast = { id: string; title?: string; message: string; variant?: 'success' | 'error' | 'info' };

// Dates from the API are plain YYYY-MM-DD; parse as local midnight so they never shift a day.
const parseDay = (d: string) => new Date(`${d}T00:00:00`);
const formatDay = (d: string) =>
  parseDay(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const addDays = (d: string, n: number) => {
  const x = parseDay(d);
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

// Age on the new year's first day: placement is age-based, so that is the age that matters.
const ageAt = (dob: string | null, on: string): { label: string; months: number } | null => {
  if (!dob) return null;
  const b = parseDay(dob);
  const t = parseDay(on);
  let months = (t.getFullYear() - b.getFullYear()) * 12 + (t.getMonth() - b.getMonth());
  if (t.getDate() < b.getDate()) months -= 1;
  if (months < 0) return null;
  return { label: `${Math.floor(months / 12)}y ${months % 12}m`, months };
};

const columnOf = (s: TransitionStudent): string => {
  if (s.planned.action === 'leave') return LEAVING;
  if (s.planned.action === 'move' && s.planned.classroom_id) return s.planned.classroom_id;
  return NO_CLASS;
};

const entryFor = (studentId: string, column: string): TransitionEntryInput => {
  if (column === LEAVING) return { student_id: studentId, action: 'leave', to_classroom_id: null };
  if (column === NO_CLASS) return { student_id: studentId, action: 'unplaced', to_classroom_id: null };
  return { student_id: studentId, action: 'move', to_classroom_id: column };
};

export default function YearTransitionBoard({ schoolId, yearId, justCreated = false }: YearTransitionBoardProps) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<Set<string>>(new Set());
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'age'>('name');
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [editingDates, setEditingDates] = useState(justCreated);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [datesError, setDatesError] = useState<string | null>(null);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((t) => [...t, { id, ...toast }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  };

  const load = async () => {
    try {
      setBoard(await schoolsApi.getYearTransition(schoolId, yearId));
      setLoadError(null);
    } catch (err) {
      setLoadError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, yearId]);

  const classroomName = useMemo(() => {
    const names = new Map<string, string>();
    board?.classrooms.forEach((c) => names.set(c.id, c.name));
    return names;
  }, [board]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="py-12 text-center text-red-600 dark:text-red-400">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        {loadError ?? 'Could not load the class plan.'}
      </div>
    );
  }

  const year = board.school_year;
  const firstDay = year.starts_on;
  const lastDayNow = addDays(firstDay, -1);
  const leaveDay = board.previous_school_year ? addDays(board.previous_school_year.ends_on, 1) : null;
  const locked = board.locked;
  const applied = !!board.transition?.applied_at;

  const save = async (entries: TransitionEntryInput[]) => {
    if (entries.length === 0) return;
    // Optimistic: the board moves now, the server's answer replaces it.
    setBoard((b) =>
      b && {
        ...b,
        students: b.students.map((s) => {
          const e = entries.find((x) => x.student_id === s.student_id);
          return e
            ? { ...s, planned: { action: e.action, classroom_id: e.to_classroom_id, source: 'plan' as const } }
            : s;
        }),
      }
    );
    setSaving(true);
    try {
      setBoard(await schoolsApi.updateYearTransitionEntries(schoolId, yearId, entries));
    } catch (err) {
      addToast({ title: 'Not saved', message: parseApiError(err).message, variant: 'error' });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const moveTo = (studentIds: string[], column: string) => {
    const moving = board.students.filter((s) => studentIds.includes(s.student_id) && columnOf(s) !== column);
    save(moving.map((s) => entryFor(s.student_id, column)));
    setSelected(new Set());
    setDragging(new Set());
  };

  const addWholeClass = (fromClassroomId: string, column: string) => {
    const ids = board.students.filter((s) => s.current_classroom_id === fromClassroomId).map((s) => s.student_id);
    moveTo(ids, column);
  };

  const setLeaverStatus = async (value: LeaverStatus) => {
    setSaving(true);
    try {
      setBoard(await schoolsApi.updateYearTransitionSettings(schoolId, yearId, { leaver_status: value }));
    } catch (err) {
      addToast({ title: 'Not saved', message: parseApiError(err).message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const startEditingDates = () => {
    setDraftStart(year.starts_on);
    setDraftEnd(year.ends_on);
    setDatesError(null);
    setEditingDates(true);
  };

  const saveDates = async () => {
    setDatesError(null);
    const today = new Date().toLocaleDateString('en-CA');
    // Untouched inputs show the year's current dates.
    const start = draftStart || year.starts_on;
    const end = draftEnd || year.ends_on;
    if (!start || !end) return setDatesError('Both dates are required.');
    // A start today or earlier would lock the plan immediately.
    if (start <= today) return setDatesError('The first day must be after today.');
    if (end < start) return setDatesError('The last day must be on or after the first day.');
    if (board.previous_school_year && start <= board.previous_school_year.ends_on) {
      return setDatesError(
        `The first day must be after ${board.previous_school_year.name} ends (${formatDay(board.previous_school_year.ends_on)}).`
      );
    }
    setSaving(true);
    try {
      await schoolsApi.updateSchoolYear(schoolId, yearId, { name: year.name, starts_on: start, ends_on: end });
      setEditingDates(false);
      await load();
    } catch (err) {
      setDatesError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const discard = async () => {
    try {
      await schoolsApi.discardYearTransition(schoolId, yearId);
      addToast({ title: 'Plan discarded', message: 'Every child is back in their current class on the plan.', variant: 'info' });
      await load();
    } catch (err) {
      addToast({ title: 'Not discarded', message: parseApiError(err).message, variant: 'error' });
    }
  };

  const visible = (s: TransitionStudent) =>
    (!search || (s.full_name ?? '').toLowerCase().includes(search.toLowerCase())) && (!onlyPending || s.pending);

  const sorted = (list: TransitionStudent[]) =>
    [...list].sort((a, b) => {
      if (sortBy === 'age') {
        const am = ageAt(a.date_of_birth, firstDay)?.months ?? -1;
        const bm = ageAt(b.date_of_birth, firstDay)?.months ?? -1;
        if (am !== bm) return bm - am;
      }
      return (a.full_name ?? '').localeCompare(b.full_name ?? '');
    });

  const studentsIn = (column: string) => sorted(board.students.filter((s) => columnOf(s) === column && visible(s)));
  const countIn = (column: string) => board.students.filter((s) => columnOf(s) === column).length;

  const knownClassNames = new Set(board.classrooms.map((c) => c.name));
  const invitesIn = (column: string) =>
    board.invited.filter((i) =>
      column === NO_CLASS ? !knownClassNames.has(i.class_name) : classroomName.get(column) === i.class_name
    );

  // Today's classes, for "add a whole class": every classroom any child is in today.
  const todaysClasses = Array.from(
    new Set(board.students.map((s) => s.current_classroom_id).filter((c): c is string => !!c))
  );

  const onDragStart = (e: React.DragEvent, studentId: string) => {
    const ids = selected.has(studentId) ? Array.from(selected) : [studentId];
    setDragging(new Set(ids));
    e.dataTransfer.setData('studentIds', JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (e: React.DragEvent, column: string) => {
    e.preventDefault();
    setDropTarget(null);
    const raw = e.dataTransfer.getData('studentIds');
    if (raw) moveTo(JSON.parse(raw) as string[], column);
  };

  const toggleSelect = (e: React.MouseEvent, studentId: string) => {
    if (locked) return;
    const multi = e.metaKey || e.ctrlKey || e.shiftKey;
    setSelected((prev) => {
      if (multi) {
        const next = new Set(prev);
        if (next.has(studentId)) next.delete(studentId);
        else next.add(studentId);
        return next;
      }
      // Plain click selects just this child, or clears it if it was the only one.
      return prev.size === 1 && prev.has(studentId) ? new Set() : new Set([studentId]);
    });
  };

  // Classes have no order of their own; children's ages give the progression, so
  // order by the average age of the children in each class today, youngest first.
  const averageAge = (classroomId: string) => {
    const ages = board.students
      .filter((s) => s.current_classroom_id === classroomId)
      .map((s) => ageAt(s.date_of_birth, firstDay)?.months)
      .filter((m): m is number => m !== undefined);
    return ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : Number.POSITIVE_INFINITY;
  };
  const orderedClassrooms = [...board.classrooms].sort(
    (a, b) => averageAge(a.id) - averageAge(b.id) || a.name.localeCompare(b.name)
  );

  const columns: { id: string; title: string; hint?: string; tone: 'class' | 'leaving' | 'none' }[] = [
    ...orderedClassrooms.map((c) => ({ id: c.id, title: c.name, tone: 'class' as const })),
    {
      id: LEAVING,
      title: 'Leaving',
      hint: `Last day ${formatDay(board.previous_school_year?.ends_on ?? lastDayNow)}`,
      tone: 'leaving' as const,
    },
    { id: NO_CLASS, title: 'No class yet', hint: 'Staying, class still to decide', tone: 'none' as const },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <ArrowRightLeft className="w-6 h-6 mt-1 text-[#1A1A6D] dark:text-[#20B2AA]" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Class plan for {year.name}</h1>
            {editingDates && !locked ? (
              <div className="mt-2 space-y-2">
                {justCreated && (
                  <p className="text-sm text-[#1A1A6D] dark:text-[#20B2AA]">
                    {year.name} was created with default dates. Set the school&apos;s real first and last day.
                  </p>
                )}
                <div className="flex flex-wrap items-end gap-3 text-sm">
                  <label className="text-gray-700 dark:text-gray-300">
                    <span className="block mb-1">First day</span>
                    <input
                      type="date"
                      value={draftStart || year.starts_on}
                      onChange={(e) => setDraftStart(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </label>
                  <label className="text-gray-700 dark:text-gray-300">
                    <span className="block mb-1">Last day</span>
                    <input
                      type="date"
                      value={draftEnd || year.ends_on}
                      onChange={(e) => setDraftEnd(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </label>
                  <button
                    onClick={saveDates}
                    disabled={saving}
                    className="px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    Save dates
                  </button>
                  <button
                    onClick={() => setEditingDates(false)}
                    disabled={saving}
                    className="px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    {justCreated ? 'Keep defaults' : 'Cancel'}
                  </button>
                </div>
                {datesError && <p className="text-sm text-red-600 dark:text-red-400">{datesError}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {year.name} runs <strong>{formatDay(firstDay)}</strong> to <strong>{formatDay(year.ends_on)}</strong>.
                Today&apos;s classes run until <strong>{formatDay(lastDayNow)}</strong>.{' '}
                {!locked && (
                  <button
                    onClick={startEditingDates}
                    className="text-[#1A1A6D] dark:text-[#20B2AA] hover:underline"
                  >
                    Change dates
                  </button>
                )}
              </p>
            )}
          </div>
        </div>
        {!locked && (
          <div className="flex flex-wrap items-center gap-2">
            {board.transition && !applied && (
              <button
                onClick={() => setDiscardOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Discard plan
              </button>
            )}
            <button
              onClick={() => setOnboardOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Onboard new child
            </button>
            <button
              onClick={() => setApplyOpen(true)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {!applied ? 'Apply plan' : board.pending_count > 0 ? `Apply changes (${board.pending_count})` : 'Apply again'}
            </button>
          </div>
        )}
      </div>

      {/* Status */}
      <div
        className={`mb-4 rounded-lg border p-4 text-sm flex items-start gap-3 ${
          locked
            ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300'
            : applied && board.pending_count === 0
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
        }`}
      >
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          {locked ? (
            <p>{year.name} has started. This plan is now read-only; use the Enrollments tab for changes.</p>
          ) : !applied ? (
            <p>
              <strong>Draft.</strong> Nothing has changed for teachers or families yet. Every child starts in the class
              they are in today; drag children to where they go in {year.name}, then apply the plan.
            </p>
          ) : board.pending_count === 0 ? (
            <p>
              <strong>Applied</strong> {new Date(board.transition!.applied_at!).toLocaleString()}. Every child&apos;s{' '}
              {year.name} class is set and takes effect on {formatDay(firstDay)}. Until then, you can still change the
              plan and apply again.
            </p>
          ) : (
            <p>
              <strong>{board.pending_count} change{board.pending_count === 1 ? '' : 's'} not applied yet.</strong> The
              plan was last applied {new Date(board.transition!.applied_at!).toLocaleString()}; apply again to put these
              changes into effect.
            </p>
          )}
          {board.transition?.notify_scheduled_at && (
            <p className="flex items-center gap-1.5">
              <Bell className="w-4 h-4" />
              Families will be told their child&apos;s new class on{' '}
              {new Date(board.transition.notify_scheduled_at).toLocaleString()}.
            </p>
          )}
        </div>
      </div>

      {/* Leavers' status */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-[#1A1A6D] dark:text-[#20B2AA]">
          {leaveDay ? (
            <>
              On {formatDay(leaveDay)}, the day after {board.previous_school_year!.name} ends, children in Leaving
              become:
            </>
          ) : (
            'Children in Leaving become:'
          )}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {leaveDay
            ? 'Graduated or Left: their parents lose access to the school that day.'
            : 'There is no previous school year to take the last day from, so leavers keep their status.'}
        </p>
        <div className="grid grid-cols-3 gap-2 max-w-xl">
          {LEAVER_OPTIONS.map((option) => {
            const current: LeaverStatus = board.transition ? board.transition.leaver_status : 'left';
            const isSelected = current === option.value;
            return (
              <button
                key={option.label}
                type="button"
                disabled={locked || saving || !leaveDay}
                onClick={() => !isSelected && setLeaverStatus(option.value)}
                className={`min-h-[70px] rounded-[10px] px-3 py-2 flex flex-col items-center justify-center text-center transition-colors disabled:opacity-60 ${
                  isSelected
                    ? 'bg-[#1A1A6D] dark:bg-[#20B2AA] text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <span className="font-bold">{option.label}</span>
                <span className={`text-xs mt-0.5 ${isSelected ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                  {option.detail}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search children..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#1A1A6D] dark:focus:ring-[#20B2AA] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'age')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
          >
            <option value="name">Sort by name</option>
            <option value="age">Sort by age (oldest first)</option>
          </select>
          {!locked && (
            <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
              Only unapplied changes
            </label>
          )}
          {saving && <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">Saving…</span>}
        </div>
      </div>

      {!locked && (
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Click to select (Ctrl/Cmd + click for several), then drag. Use &ldquo;Add a whole class&rdquo; at the top of
          a column to move everyone from one of today&apos;s classes at once. Changes save as you go.
        </p>
      )}

      {/* Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 mb-6">
        {columns.map((col) => {
          const students = studentsIn(col.id);
          const invites = invitesIn(col.id);
          const isTarget = dropTarget === col.id;
          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                if (locked) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dropTarget !== col.id) setDropTarget(col.id);
              }}
              onDragLeave={() => setDropTarget((t) => (t === col.id ? null : t))}
              onDrop={(e) => !locked && onDrop(e, col.id)}
              className={`rounded-lg border-2 p-3 min-h-[420px] max-h-[720px] flex flex-col transition-colors ${
                col.tone === 'class'
                  ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  : col.tone === 'leaving'
                  ? 'bg-red-50/40 dark:bg-red-900/10 border-dashed border-red-200 dark:border-red-900'
                  : 'bg-gray-50 dark:bg-gray-900 border-dashed border-gray-300 dark:border-gray-700'
              } ${isTarget ? '!border-[#1A1A6D] dark:!border-[#20B2AA]' : ''}`}
            >
              <div className="mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 truncate">
                    {col.tone === 'leaving' && <LogOut className="w-4 h-4 text-red-500" />}
                    {col.title}
                  </h4>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 px-2 py-0.5 rounded">
                    {countIn(col.id) + invites.length}
                  </span>
                </div>
                {col.hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{col.hint}</p>}
                {!locked && todaysClasses.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => e.target.value && addWholeClass(e.target.value, col.id)}
                    className="mt-2 w-full text-xs px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                  >
                    <option value="">+ Add a whole class…</option>
                    {[...todaysClasses].sort((x, y) => averageAge(x) - averageAge(y)).map((id) => (
                      <option key={id} value={id}>
                        Everyone now in {classroomName.get(id) ?? 'an inactive class'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                {students.length === 0 && invites.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                    <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No children</p>
                  </div>
                ) : (
                  <>
                    {students.map((s) => (
                      <ChildCard
                        key={s.student_id}
                        student={s}
                        firstDay={firstDay}
                        currentClassName={
                          s.current_classroom_id ? classroomName.get(s.current_classroom_id) ?? 'inactive class' : null
                        }
                        locked={locked}
                        isSelected={selected.has(s.student_id)}
                        isDragging={dragging.has(s.student_id)}
                        onDragStart={onDragStart}
                        onDragEnd={() => setDragging(new Set())}
                        onClick={toggleSelect}
                      />
                    ))}
                    {invites.map((i) => (
                      <div
                        key={i.id}
                        className="p-3 rounded-lg border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10"
                        title={`Invite sent to ${i.primary_email}`}
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{i.full_name}</div>
                        <div className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300 mt-1">
                          <Mail className="w-3 h-3" />
                          Invited, waiting for parent
                          {col.id === NO_CLASS ? ` (${i.class_name})` : ''}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <OnboardStudentModal
        isOpen={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        onSuccess={(email) => {
          addToast({
            title: 'Invite sent',
            message: `${email} will get a link to complete onboarding. Their child starts on ${formatDay(firstDay)}.`,
            variant: 'success',
          });
          load();
        }}
        schoolId={schoolId}
        startsOn={firstDay}
      />

      {applyOpen && (
        <ApplyDialog
          board={board}
          leaveDay={leaveDay}
          onClose={() => setApplyOpen(false)}
          onApplied={(next, notified) => {
            setBoard(next);
            setApplyOpen(false);
            addToast({
              title: 'Plan applied',
              message: notified
                ? `Classes for ${year.name} are set. Families will be notified.`
                : `Classes for ${year.name} are set. They take effect on ${formatDay(firstDay)}.`,
              variant: 'success',
            });
          }}
          schoolId={schoolId}
          yearId={yearId}
        />
      )}

      <ConfirmDialog
        isOpen={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={discard}
        title="Discard this plan?"
        message="Every decision on this board is thrown away. Nothing was applied, so no enrollments change."
        confirmText="Discard"
        variant="danger"
      />

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-sm w-full px-4 py-3 rounded-lg shadow-lg border bg-white dark:bg-[#111217] border-gray-200 dark:border-gray-800 ${
              t.variant === 'success'
                ? 'ring-2 ring-green-500 dark:ring-green-400'
                : t.variant === 'error'
                ? 'ring-2 ring-red-500 dark:ring-red-400'
                : 'ring-1 ring-gray-200 dark:ring-gray-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                {t.title && <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.title}</div>}
                <div className="text-sm text-gray-700 dark:text-gray-300">{t.message}</div>
              </div>
              <button
                onClick={() => setToasts((s) => s.filter((x) => x.id !== t.id))}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ChildCardProps {
  student: TransitionStudent;
  firstDay: string;
  currentClassName: string | null;
  locked: boolean;
  isSelected: boolean;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, studentId: string) => void;
  onDragEnd: () => void;
  onClick: (e: React.MouseEvent, studentId: string) => void;
}

function ChildCard({
  student,
  firstDay,
  currentClassName,
  locked,
  isSelected,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: ChildCardProps) {
  const age = ageAt(student.date_of_birth, firstDay);
  const staysPut =
    student.planned.action === 'move' && student.planned.classroom_id === student.current_classroom_id;
  return (
    <div
      draggable={!locked}
      onDragStart={(e) => onDragStart(e, student.student_id)}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e, student.student_id);
      }}
      className={`p-3 rounded-lg transition-all select-none ${locked ? '' : 'cursor-move'} ${
        student.pending ? 'border-l-4' : 'border'
      } ${
        isSelected
          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 ring-2 ring-blue-200 dark:ring-blue-700'
          : student.pending
          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-500'
          : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {student.full_name ?? 'Unnamed child'}
        </div>
        {age && <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{age.label}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-1 mt-1.5 text-xs">
        {student.is_new || !currentClassName ? (
          <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
            {student.is_new ? 'New' : 'No class today'}
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
            Now: {currentClassName}
          </span>
        )}
        {staysPut && student.planned.source === 'current_class' && (
          <span className="px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400" title="Not moved yet: stays in today's class">
            not moved yet
          </span>
        )}
        {student.pending && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
            <Clock className="w-3 h-3" />
            not applied
          </span>
        )}
      </div>
    </div>
  );
}

interface ApplyDialogProps {
  board: Board;
  leaveDay: string | null;
  schoolId: string;
  yearId: string;
  onClose: () => void;
  onApplied: (board: Board, notified: boolean) => void;
}

function ApplyDialog({ board, leaveDay, schoolId, yearId, onClose, onApplied }: ApplyDialogProps) {
  const [notify, setNotify] = useState(true);
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [notifyAt, setNotifyAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const year = board.school_year;
  const count = (pred: (s: TransitionStudent) => boolean) => board.students.filter(pred).length;
  const is = (s: TransitionStudent, a: TransitionAction) => s.planned.action === a;
  const changing = count(
    (s) => is(s, 'move') && !!s.current_classroom_id && s.planned.classroom_id !== s.current_classroom_id
  );
  const staying = count((s) => is(s, 'move') && !!s.current_classroom_id && s.planned.classroom_id === s.current_classroom_id);
  const joining = count((s) => is(s, 'move') && !s.current_classroom_id);
  const leaving = count((s) => is(s, 'leave'));
  const noClass = count((s) => is(s, 'unplaced') && (s.planned.source === 'plan' || !!s.current_classroom_id));
  const leaverStatus = board.transition ? board.transition.leaver_status : 'left';

  const submit = async () => {
    setError(null);
    if (notify && when === 'later' && !notifyAt) {
      setError('Choose when families should be notified.');
      return;
    }
    setSubmitting(true);
    try {
      const next = await schoolsApi.applyYearTransition(schoolId, yearId, {
        notify_families: notify,
        notify_at: notify && when === 'later' ? new Date(notifyAt).toISOString() : null,
      });
      onApplied(next, notify);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  const rows: [string, number][] = [
    ['Moving to a new class', changing],
    ['Staying in the same class', staying],
    ['Joining (no class today)', joining],
    ['Leaving the school', leaving],
    ['Staying, no class yet', noClass],
  ];

  return (
    <ModalOverlay>
      <div className="bg-white dark:bg-[#121212] rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-lg w-full">
        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Apply the {year.name} plan</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Classes change on {formatDay(year.starts_on)}. Until then teachers and parents see today&apos;s classes,
              and you can keep changing the plan and apply again.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-2 text-sm text-red-800 dark:text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <table className="w-full text-sm">
            <tbody>
              {rows.map(([label, n]) => (
                <tr key={label} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <td className="py-1.5 text-gray-700 dark:text-gray-300">{label}</td>
                  <td className="py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {leaving > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {leaverStatus && leaveDay
                ? `${leaving} leaving child${leaving === 1 ? '' : 'ren'} will be marked ${
                    leaverStatus === 'graduated' ? 'Graduated' : 'Left'
                  } on ${formatDay(leaveDay)}.`
                : `Leaving children's classes end, but they stay active.`}
            </p>
          )}

          <div className="space-y-2">
            <label className="flex items-start gap-3 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              <span>
                Tell families their child&apos;s {year.name} class
                <span className="block text-gray-500 dark:text-gray-400">
                  Email and push to each child&apos;s primary parent. Only children whose class is new to them since
                  the last message are included; leavers and children without a class aren&apos;t messaged.
                </span>
              </span>
            </label>
            {notify && (
              <div className="ml-7 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={when === 'now'} onChange={() => setWhen('now')} />
                  As soon as I apply
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={when === 'later'} onChange={() => setWhen('later')} />
                  On
                  <input
                    type="datetime-local"
                    value={notifyAt}
                    onChange={(e) => {
                      setNotifyAt(e.target.value);
                      setWhen('later');
                    }}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="px-6 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Apply plan
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
