import { Payment } from '@/types/domain';
import { RentCalculationResult } from '@/types/calculations';
import { getBillingCycleStartDate, parseLocalDate } from '../utils/dates';

interface CalculatePendingRentParams {
  rate: number;
  checkInDate: Date | string;
  checkOutDate?: Date | string | null;
  dueDay: number;
  payments: Payment[];
  asOfDate: Date | string;
  utilityBills?: Array<{ amount_due?: number; amountDue?: number }>;
}

/**
 * Calculates the pending rent and utility balance for a tenancy up to asOfDate.
 */
export function calculatePendingRent({
  rate,
  checkInDate,
  checkOutDate,
  dueDay,
  payments,
  asOfDate,
  utilityBills = [],
}: CalculatePendingRentParams): RentCalculationResult {
  const checkIn = parseLocalDate(checkInDate);
  const effectiveEnd = checkOutDate ? parseLocalDate(checkOutDate) : parseLocalDate(asOfDate);

  // Total paid: sum of active payments with type 'rent' or 'electricity'
  const totalPaid = payments
    .filter((p) => !p.deleted_at && (p.type === 'rent' || p.type === 'electricity'))
    .reduce((sum, p) => sum + Number(p.amount), 0);

  if (checkIn.getTime() > effectiveEnd.getTime()) {
    return {
      totalCharged: 0,
      totalPaid,
      pendingBalance: -totalPaid,
    };
  }

  let currentYear = checkIn.getFullYear();
  let currentMonth = checkIn.getMonth() + 1; // 1-indexed (1-12)

  const thisMonthCycleStart = getBillingCycleStartDate(currentYear, currentMonth, dueDay);
  if (checkIn.getTime() < thisMonthCycleStart.getTime()) {
    currentMonth--;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear--;
    }
  }

  let totalCharged = 0;
  let isFirstCycle = true;

  while (true) {
    const cycleStart = getBillingCycleStartDate(currentYear, currentMonth, dueDay);

    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }
    const nextCycleStart = getBillingCycleStartDate(nextYear, nextMonth, dueDay);

    if (cycleStart.getTime() > effectiveEnd.getTime()) {
      break;
    }

    if (isFirstCycle) {
      const msPerDay = 1000 * 60 * 60 * 24;
      const totalDaysInCycle = Math.round((nextCycleStart.getTime() - cycleStart.getTime()) / msPerDay);
      const daysOccupied = Math.round((nextCycleStart.getTime() - checkIn.getTime()) / msPerDay);

      const dailyRate = Math.round((rate / Math.max(1, totalDaysInCycle)) * 100) / 100;
      const prorated = Math.round(dailyRate * daysOccupied);
      totalCharged += prorated;
    } else {
      totalCharged += rate;
    }

    isFirstCycle = false;
    currentMonth = nextMonth;
    currentYear = nextYear;
  }

  for (const bill of utilityBills) {
    const amt = bill.amount_due ?? bill.amountDue;
    if (typeof amt === 'number' && !isNaN(amt)) {
      totalCharged += amt;
    }
  }

  const pendingBalance = totalCharged - totalPaid;

  return {
    totalCharged,
    totalPaid,
    pendingBalance,
  };
}
