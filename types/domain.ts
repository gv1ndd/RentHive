import { Database } from './database';

export type Building = Database['public']['Tables']['buildings']['Row'];
export type Room = Database['public']['Tables']['rooms']['Row'];
export type Bed = Database['public']['Tables']['beds']['Row'];
export type Tenant = Database['public']['Tables']['tenants']['Row'];
export type Tenancy = Database['public']['Tables']['tenancies']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type AdvanceBooking = Database['public']['Tables']['advance_bookings']['Row'];
export type Meter = Database['public']['Tables']['meters']['Row'];
export type MeterReading = Database['public']['Tables']['meter_readings']['Row'];
export type TenantNote = Database['public']['Tables']['tenant_notes']['Row'];

export type BedStatus = 'vacant' | 'reserved' | 'occupied' | 'moving_out';

export interface BedWithStatus extends Bed {
  status: BedStatus;
  activeTenancy?: Tenancy & { tenant: Tenant };
  pendingBooking?: AdvanceBooking;
}

export interface RoomWithBeds extends Room {
  beds: BedWithStatus[];
  meter?: Meter;
  latestReading?: MeterReading;
}

export interface TrashItem {
  id: string;
  type: 'building' | 'room' | 'bed' | 'tenant' | 'meter_reading' | 'payment' | 'advance_booking';
  title: string;
  subtitle: string;
  deletedAt: string;
}
