import { getBillingCycleStartDate, parseLocalDate } from './lib/utils/dates.js';

function calculatePendingRentFixed({
  rate,
  checkInDate,
  checkOutDate,
  dueDay,
  payments,
  asOfDate,
  utilityBills = [],
}) {
  const checkIn = parseLocalDate(checkInDate);
  const effectiveEnd = checkOutDate ? parseLocalDate(checkOutDate) : parseLocalDate(asOfDate);

  const totalPaid = payments
    .filter((p) => !p.deleted_at && (p.type === 'rent' || p.type === 'electricity'))
    .reduce((sum, p) => sum + Number(p.amount), 0);

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

    // First cycle is always charged for an active tenancy.
    // Subsequent cycles are only charged if cycleStart has occurred relative to effectiveEnd.
    if (!isFirstCycle && cycleStart.getTime() > effectiveEnd.getTime()) {
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

// Test Case: Check-in date is Aug 17, 2026, due day 10, rate 8000, advance paid 2000
// Current date (asOfDate) is TODAY (any date, e.g. now)
const res = calculatePendingRentFixed({
  rate: 8000,
  checkInDate: '2026-08-17',
  dueDay: 10,
  payments: [
    {
      id: 'p1',
      amount: 2000,
      type: 'rent',
      date: '2026-08-17',
      deleted_at: null,
    }
  ],
  asOfDate: new Date(),
});

console.log('Result regardless of current system date:', res);
