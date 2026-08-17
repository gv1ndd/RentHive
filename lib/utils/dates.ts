/**
 * Date utility helpers for billing cycle calculations and formatting.
 */

export function parseLocalDate(dateInput: string | Date | null | undefined): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) {
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
  }
  const str = String(dateInput).split('T')[0];
  const parts = str.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const d = new Date(dateInput);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

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
