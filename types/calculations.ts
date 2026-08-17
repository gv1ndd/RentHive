import { Tenancy } from './domain';

export interface RentCalculationResult {
  totalCharged: number;
  totalPaid: number;
  pendingBalance: number;
}

export interface BuildingStats {
  totalRooms: number;
  totalBeds: number;
  vacantBeds: number;
  reservedBeds: number;
  occupiedBeds: number;
  totalTenants: number;
  checkedInTenants: number;
  checkedOutTenants: number;
  receivedThisMonth: number;
  pendingBalance: number;
  electricityReceivedThisMonth: number;
  electricityBilled: number;
  upcomingRent?: number;
  upcomingCount?: number;
}

export interface UpcomingMoveOut {
  tenancy: Tenancy;
  bedLabel: string;
  roomNumber: string;
  tenantName: string;
  expectedMoveOutDate: Date;
}

export interface TenantSummary {
  tenantId: string;
  tenantName: string;
  roomNumber: string;
  bedLabel: string;
  checkInDate: Date;
  checkOutDate?: Date;
  pendingBalance?: number;
  phone?: string;
  electricityDue: number;
}

export interface ReportMetrics {
  totalCollectedRent: number;
  totalCollectedElectricity: number;
  totalCollectedMaintenance: number;
  totalCollectedPenalty: number;
  totalPendingRent: number;
  totalPendingElectricity: number;
  totalPendingBalance: number;
  totalBeds: number;
  totalOccupiedBeds: number;
  totalVacantBeds: number;
  totalReservedBeds: number;
  occupancyRate: number;
}
