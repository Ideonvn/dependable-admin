import { SchoolStatus, SCHOOL_STATUS_META } from '@/lib/schoolStatus';

interface SchoolStatusBadgeProps {
  status: SchoolStatus;
  variant?: 'badge' | 'dot';
  className?: string;
}

// Renders a school's lifecycle status as either a coloured badge (with label)
// or a bare coloured dot.
export default function SchoolStatusBadge({ status, variant = 'badge', className = '' }: SchoolStatusBadgeProps) {
  const meta = SCHOOL_STATUS_META[status] ?? SCHOOL_STATUS_META.pending;

  if (variant === 'dot') {
    return (
      <span
        title={meta.label}
        aria-label={meta.label}
        className={`inline-block w-2.5 h-2.5 rounded-full ${meta.dot} ${className}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
