import { CalendarEventScope } from '@/types/calendar';

export function scopeBgColor(scope: CalendarEventScope, isDark: boolean): string {
  switch (scope) {
    case 'SCHOOL':
      return isDark ? '#20B2AA' : '#1A1A6D';
    case 'CLASSROOM':
      return isDark ? 'rgba(70, 130, 180, 1)' : 'rgba(135, 206, 250, 1)';
    case 'STUDENT':
      return isDark ? '#4CAF50' : '#10B981';
  }
}

export function scopeTextColor(scope: CalendarEventScope, isDark: boolean): string {
  if (scope === 'CLASSROOM' && !isDark) return '#1A1A6D'; // dark text on light blue
  return '#ffffff';
}

export function scopeLabel(scope: CalendarEventScope): string {
  switch (scope) {
    case 'SCHOOL': return 'School';
    case 'CLASSROOM': return 'Classroom';
    case 'STUDENT': return 'Student';
  }
}
