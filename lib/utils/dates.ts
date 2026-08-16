/**
 * Date utility helpers for billing cycle calculations and formatting.
 */

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getBillingCycleStartDate(year: number, month: number, dueDay: number): Date {
  const maxDays = daysInMonth(year, month);
  const clampedDay = Math.min(dueDay, maxDays);
  return new Date(year, month - 1, clampedDay);
}

export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'N/A';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return 'N/A';
  return d.toISOString().split('T')[0];
}

export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'N/A';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
