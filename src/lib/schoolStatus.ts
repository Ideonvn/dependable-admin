// School lifecycle status: shared type, display metadata, and the billing rule.
// A school is auto-billed only when status === 'active' && generate_invoices.

export type SchoolStatus = 'pending' | 'active' | 'paused' | 'inactive' | 'archived';

export const SCHOOL_STATUSES: SchoolStatus[] = ['pending', 'active', 'paused', 'inactive', 'archived'];

// Dot/badge colours per user spec: active green, pending yellow, paused orange,
// inactive red, archived grey.
export const SCHOOL_STATUS_META: Record<SchoolStatus, { label: string; dot: string; badge: string }> = {
  active: {
    label: 'Active',
    dot: 'bg-green-500',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  pending: {
    label: 'Pending',
    dot: 'bg-yellow-400',
    badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  paused: {
    label: 'Paused',
    dot: 'bg-orange-500',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  inactive: {
    label: 'Inactive',
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  archived: {
    label: 'Archived',
    dot: 'bg-gray-400',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
};

export const isAutoBilled = (status: SchoolStatus, generateInvoices: boolean): boolean =>
  status === 'active' && generateInvoices;

export const billingStateText = (status: SchoolStatus, generateInvoices: boolean): string => {
  if (isAutoBilled(status, generateInvoices)) {
    return 'This school will be invoiced automatically by the scheduled billing job.';
  }
  if (status !== 'active') {
    return `This school will not be invoiced automatically (status: ${SCHOOL_STATUS_META[status]?.label ?? status}).`;
  }
  return 'This school will not be invoiced automatically (invoice generation is turned off).';
};
