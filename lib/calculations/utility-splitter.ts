interface TenancyRow {
  id: string;
  tenant_id: string;
  check_in_date: string;
  check_out_date?: string | null;
  room_id?: string;
  beds?: {
    room_id?: string;
    rooms?: {
      id?: string;
    };
  };
}

interface UtilityReading {
  id?: string;
  amount_due: number;
  reading_date: string;
}

interface TenancyWindow {
  tenancyId: string;
  tenantId: string;
  checkIn: Date;
  checkOut: Date | null;
}

function getRoomId(row: TenancyRow): string | null {
  if (row.room_id) return row.room_id;
  if (row.beds?.rooms?.id) return row.beds.rooms.id;
  if (row.beds?.room_id) return row.beds.room_id;
  return null;
}

function isOccupiedOnReadingDate(window: TenancyWindow, readingDate: Date): boolean {
  const nextDay = new Date(readingDate.getTime() + 24 * 60 * 60 * 1000);
  const prevDay = new Date(readingDate.getTime() - 24 * 60 * 60 * 1000);

  const checkedInBeforeOrOn = window.checkIn.getTime() < nextDay.getTime();
  const checkedOutAfterOrOn = !window.checkOut || window.checkOut.getTime() > prevDay.getTime();

  return checkedInBeforeOrOn && checkedOutAfterOrOn;
}

/**
 * Splits each room's utility readings among the tenancies that occupied the room
 * on that reading's date (occupancy-at-reading-date, NOT current occupancy).
 *
 * Each reading's amount_due is divided by the occupancy on the reading date and rounded
 * to the nearest whole rupee. Soft-deleted tenants are excluded.
 *
 * Returns a map of `tenancy_id -> [{ amount_due: share }]`.
 */
export function splitUtilityBillsByTenancy({
  tenancyRows,
  utilityBillsByRoom,
  deletedTenantIds = new Set<string>(),
}: {
  tenancyRows: TenancyRow[];
  utilityBillsByRoom: Record<string, UtilityReading[]>;
  deletedTenantIds?: Set<string>;
}): Record<string, Array<{ amount_due: number }>> {
  const tenanciesByRoom: Record<string, TenancyRow[]> = {};

  for (const row of tenancyRows) {
    const roomId = getRoomId(row);
    if (!roomId) continue;
    if (!tenanciesByRoom[roomId]) {
      tenanciesByRoom[roomId] = [];
    }
    tenanciesByRoom[roomId].push(row);
  }

  const result: Record<string, Array<{ amount_due: number }>> = {};

  for (const [roomId, roomTenancies] of Object.entries(tenanciesByRoom)) {
    const readings = utilityBillsByRoom[roomId] || [];
    if (readings.length === 0) continue;

    const windows: TenancyWindow[] = [];
    for (const t of roomTenancies) {
      if (!t.check_in_date) continue;
      const checkIn = new Date(t.check_in_date);
      if (isNaN(checkIn.getTime())) continue;

      const checkOut = t.check_out_date ? new Date(t.check_out_date) : null;
      windows.push({
        tenancyId: t.id,
        tenantId: t.tenant_id,
        checkIn,
        checkOut,
      });
    }

    for (const bill of readings) {
      const readingDate = new Date(bill.reading_date);
      const amount = Number(bill.amount_due) || 0;
      if (isNaN(readingDate.getTime()) || amount <= 0) continue;

      let occupancy = 0;
      for (const w of windows) {
        if (deletedTenantIds.has(w.tenantId)) continue;
        if (isOccupiedOnReadingDate(w, readingDate)) {
          occupancy++;
        }
      }

      // Vacant periods are not charged to anyone (fall back to 1 to avoid division by zero)
      if (occupancy === 0) occupancy = 1;

      const share = Math.round(amount / occupancy);
      if (share <= 0) continue;

      for (const w of windows) {
        if (deletedTenantIds.has(w.tenantId)) continue;
        if (isOccupiedOnReadingDate(w, readingDate)) {
          if (!result[w.tenancyId]) {
            result[w.tenancyId] = [];
          }
          result[w.tenancyId].push({ amount_due: share });
        }
      }
    }
  }

  return result;
}
