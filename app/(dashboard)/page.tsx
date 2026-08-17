'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActiveBuilding } from '@/lib/context/active-building-context';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedNumber } from '@/components/ui/animated-number';
import {
  Search,
  Users,
  BedDouble,
  CreditCard,
  AlertCircle,
  Calendar,
  ArrowRight,
  Plus,
  Zap,
  Building,
  BarChart3,
  Clock,
} from 'lucide-react';
import { BuildingStats, UpcomingMoveOut } from '@/types/calculations';
import { AdvanceBooking, Bed, Room } from '@/types/domain';
import { AddBookingModal } from '@/components/advance-bookings/add-booking-modal';
import { ConvertBookingModal } from '@/components/advance-bookings/convert-booking-modal';
import { RecordGeneralPaymentModal } from '@/components/payments/record-general-payment-modal';
import { calculatePendingRent } from '@/lib/calculations/rent-calculator';
import { splitUtilityBillsByTenancy } from '@/lib/calculations/utility-splitter';
import { formatDate } from '@/lib/utils/dates';

interface RoomWithBedsData {
  id: string;
  room_number: string;
  floor_number: number;
  beds: Array<{
    id: string;
    bed_label: string;
    default_rate: number;
    deleted_at: string | null;
  }>;
}

interface TenancyData {
  id: string;
  bed_id: string;
  tenant_id: string;
  rate: number;
  due_day: number;
  first_month_free: boolean;
  check_in_date: string;
  check_out_date: string | null;
  notice_given_date: string | null;
  expected_move_out_date: string | null;
  tenants: {
    id: string;
    name: string;
    phone: string | null;
    deleted_at: string | null;
  } | null;
}

interface MeterData {
  id: string;
  room_id: string;
  meter_readings: Array<{
    id: string;
    previous_reading: number;
    current_reading: number;
    amount_due: number;
    reading_date: string;
    deleted_at: string | null;
  }>;
}

export default function DashboardPage() {
  const { activeBuilding, activeBuildingId, isLoading: isBuildingLoading } = useActiveBuilding();
  const router = useRouter();
  const supabase = createClient();

  const [stats, setStats] = useState<BuildingStats>({
    totalRooms: 0,
    totalBeds: 0,
    vacantBeds: 0,
    reservedBeds: 0,
    occupiedBeds: 0,
    totalTenants: 0,
    checkedInTenants: 0,
    checkedOutTenants: 0,
    receivedThisMonth: 0,
    pendingBalance: 0,
    electricityReceivedThisMonth: 0,
    electricityBilled: 0,
  });

  const [advanceBookings, setAdvanceBookings] = useState<AdvanceBooking[]>([]);
  const [upcomingMoveOuts, setUpcomingMoveOuts] = useState<UpcomingMoveOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddBookingOpen, setIsAddBookingOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [convertingBooking, setConvertingBooking] = useState<AdvanceBooking | null>(null);

  const loadDashboardData = useCallback(async () => {
    if (!activeBuildingId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch Rooms & Beds for active building
      const { data: roomsData } = await supabase
        .from('rooms')
        .select(`
          id,
          room_number,
          floor_number,
          beds (
            id,
            bed_label,
            default_rate,
            deleted_at
          )
        `)
        .eq('building_id', activeBuildingId)
        .is('deleted_at', null);

      const rooms = (roomsData || []) as unknown as RoomWithBedsData[];
      const allBeds = rooms.flatMap((r) =>
        (r.beds || []).filter((b) => !b.deleted_at)
      );

      const bedIds = allBeds.map((b) => b.id);

      // 2. Fetch Active and Historical Tenancies for these beds
      let tenancies: TenancyData[] = [];
      if (bedIds.length > 0) {
        const { data: tenanciesData } = await supabase
          .from('tenancies')
          .select(`
            id,
            bed_id,
            tenant_id,
            rate,
            due_day,
            first_month_free,
            check_in_date,
            check_out_date,
            notice_given_date,
            expected_move_out_date,
            tenants (
              id,
              name,
              phone,
              deleted_at
            )
          `)
          .in('bed_id', bedIds);

        tenancies = ((tenanciesData || []) as unknown as TenancyData[]).filter(
          (t) => !t.tenants?.deleted_at
        );
      }

      // 3. Fetch Advance Bookings for active building
      const { data: bookingsData } = await supabase
        .from('advance_bookings')
        .select('*')
        .eq('building_id', activeBuildingId)
        .eq('status', 'pending')
        .is('deleted_at', null)
        .order('expected_move_in_date', { ascending: true });

      const pendingBookings = (bookingsData || []) as AdvanceBooking[];
      setAdvanceBookings(pendingBookings);

      const reservedBedIds = new Set(
        pendingBookings.map((b) => b.bed_id).filter((id): id is string => Boolean(id))
      );

      // 4. Fetch Payments for active building's tenancies
      const tenancyIds = tenancies.map((t) => t.id);
      let payments: any[] = [];
      if (tenancyIds.length > 0) {
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('*')
          .in('tenancy_id', tenancyIds)
          .is('deleted_at', null);

        payments = paymentsData || [];
      }

      // 5. Fetch Electricity Readings
      const utilityReadingsByRoom: Record<string, any[]> = {};
      const roomIds = rooms.map((r) => r.id);
      if (roomIds.length > 0) {
        const { data: metersData } = await supabase
          .from('meters')
          .select(`
            id,
            room_id,
            meter_readings (
              id,
              previous_reading,
              current_reading,
              amount_due,
              reading_date,
              deleted_at
            )
          `)
          .in('room_id', roomIds);

        const typedMeters = (metersData || []) as unknown as MeterData[];
        for (const m of typedMeters) {
          utilityReadingsByRoom[m.room_id] = (m.meter_readings || []).filter(
            (r) => !r.deleted_at
          );
        }
      }

      // Utility split calculation
      const utilitySplit = splitUtilityBillsByTenancy({
        tenancyRows: tenancies.map((t) => ({
          ...t,
          beds: { room_id: allBeds.find((b) => b.id === t.bed_id) ? rooms.find((r) => r.beds.some((b) => b.id === t.bed_id))?.id : undefined },
        })),
        utilityBillsByRoom: utilityReadingsByRoom,
      });

      // Calculate monthly collections and total pending balance
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      let totalReceivedThisMonth = 0;
      let totalElectricityThisMonth = 0;
      for (const p of payments) {
        const pDate = new Date(p.date);
        if (pDate >= firstDayOfMonth) {
          totalReceivedThisMonth += Number(p.amount) || 0;
          if (p.type === 'electricity') {
            totalElectricityThisMonth += Number(p.amount) || 0;
          }
        }
      }

      let totalPendingDues = 0;
      const activeTenancies = tenancies.filter((t) => !t.check_out_date);
      const checkedOutTenancies = tenancies.filter((t) => t.check_out_date);

      for (const t of activeTenancies) {
        const tPayments = payments.filter((p) => p.tenancy_id === t.id);
        const tUtils = utilitySplit[t.id] || [];
        const result = calculatePendingRent({
          rate: Number(t.rate),
          checkInDate: t.check_in_date,
          checkOutDate: t.check_out_date,
          dueDay: t.due_day || 1,
          payments: tPayments,
          asOfDate: now,
          utilityBills: tUtils,
        });

        // Floor at 0 for aggregate pending balance
        if (result.pendingBalance > 0) {
          totalPendingDues += result.pendingBalance;
        }
      }

      // Bed stats
      const occupiedBedIds = new Set(activeTenancies.map((t) => t.bed_id));
      let occupiedCount = 0;
      let reservedCount = 0;
      let vacantCount = 0;

      for (const b of allBeds) {
        if (occupiedBedIds.has(b.id)) {
          occupiedCount++;
        } else if (reservedBedIds.has(b.id)) {
          reservedCount++;
        } else {
          vacantCount++;
        }
      }

      // Calculate upcoming rent due within the next 10 days
      let upcomingRentTotal = 0;
      let upcomingTenanciesCount = 0;

      for (const t of activeTenancies) {
        const dueDay = t.due_day || 1;
        const nowYear = now.getFullYear();
        const nowMonth = now.getMonth();
        const todayDate = now.getDate();

        const daysInCurMonth = new Date(nowYear, nowMonth + 1, 0).getDate();
        const curMonthDue = new Date(nowYear, nowMonth, Math.min(dueDay, daysInCurMonth));

        let nextDue: Date;
        if (curMonthDue.getTime() >= new Date(nowYear, nowMonth, todayDate).getTime()) {
          nextDue = curMonthDue;
        } else {
          const daysInNextMonth = new Date(nowYear, nowMonth + 2, 0).getDate();
          nextDue = new Date(nowYear, nowMonth + 1, Math.min(dueDay, daysInNextMonth));
        }

        const diffTime = nextDue.getTime() - new Date(nowYear, nowMonth, todayDate).getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays <= 10) {
          upcomingRentTotal += Number(t.rate) || 0;
          upcomingTenanciesCount++;
        }
      }

      // Upcoming move-outs
      const moveOuts: UpcomingMoveOut[] = [];
      for (const t of activeTenancies) {
        if (t.expected_move_out_date || t.notice_given_date) {
          const moveOutDate = new Date(t.expected_move_out_date || t.notice_given_date!);
          const bed = allBeds.find((b) => b.id === t.bed_id);
          const room = rooms.find((r) => r.beds.some((b) => b.id === t.bed_id));

          moveOuts.push({
            tenancy: t as unknown as import('@/types/domain').Tenancy,
            bedLabel: bed?.bed_label || 'Bed',
            roomNumber: room?.room_number || 'Room',
            tenantName: t.tenants?.name || 'Tenant',
            expectedMoveOutDate: moveOutDate,
          });
        }
      }
      moveOuts.sort((a, b) => a.expectedMoveOutDate.getTime() - b.expectedMoveOutDate.getTime());
      setUpcomingMoveOuts(moveOuts);

      setStats({
        totalRooms: rooms.length,
        totalBeds: allBeds.length,
        vacantBeds: vacantCount,
        reservedBeds: reservedCount,
        occupiedBeds: occupiedCount,
        totalTenants: tenancies.length,
        checkedInTenants: activeTenancies.length,
        checkedOutTenants: checkedOutTenancies.length,
        receivedThisMonth: totalReceivedThisMonth,
        pendingBalance: totalPendingDues,
        electricityReceivedThisMonth: totalElectricityThisMonth,
        electricityBilled: 0,
        upcomingRent: upcomingRentTotal,
        upcomingCount: upcomingTenanciesCount,
      });
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeBuildingId, supabase]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (isBuildingLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full max-w-md" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!activeBuilding) {
    return (
      <div className="py-16 text-center space-y-4 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-primary-container text-on-primary-container flex items-center justify-center mx-auto shadow-sm">
          <Building className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">No Property Added Yet</h2>
        <p className="text-sm text-muted">
          Add your first building or hostel property to begin tracking rooms, beds, tenants, and collections.
        </p>
        <Link href="/buildings">
          <Button variant="primary" size="lg" className="mt-2">
            <Plus className="w-4 h-4 mr-2" />
            Add First Building
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Search Bar */}
      <div className="relative max-w-xl">
        <Link
          href="/search"
          className="flex items-center gap-3 w-full bg-surface border border-border-subtle hover:border-primary/40 rounded-2xl px-4 py-3 shadow-xs text-sm text-muted transition-all"
        >
          <Search className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">Search room number, tenant name, or bed...</span>
          <kbd className="hidden sm:inline-block ml-auto text-[10px] bg-surface-highest text-muted px-2 py-0.5 rounded-md font-mono border border-border-subtle">
            /
          </kbd>
        </Link>
      </div>

      {/* Hero Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Upcoming Rent Card */}
        <Link href="/dashboard/upcoming">
          <Card interactive className="space-y-2 h-full">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-semibold">Upcoming Rent</span>
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <AnimatedNumber value={stats.upcomingRent || 0} isCurrency />
              )}
            </div>
            <div className="text-[11px] text-muted flex items-center gap-1.5">
              <Badge variant="primary" size="sm">
                {stats.upcomingCount || 0} due
              </Badge>
              <span>within 10 days</span>
            </div>
          </Card>
        </Link>

        {/* Vacant Beds Card */}
        <Link href="/dashboard/empty-beds">
          <Card interactive className="space-y-2 h-full">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-semibold">Vacant Beds</span>
              <BedDouble className="w-4 h-4 text-status-vacant" />
            </div>
            <div className="text-2xl font-bold text-status-vacant">
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <AnimatedNumber value={stats.vacantBeds} />
              )}
            </div>
            <div className="text-[11px] text-muted flex items-center gap-1.5">
              {stats.reservedBeds > 0 ? (
                <Badge variant="reserved" size="sm">
                  {stats.reservedBeds} reserved
                </Badge>
              ) : (
                <span className="text-muted">Immediate check-in</span>
              )}
            </div>
          </Card>
        </Link>

        {/* Collections This Month */}
        <Link href="/payments">
          <Card interactive className="space-y-2 h-full">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-semibold">Received This Month</span>
              <CreditCard className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <AnimatedNumber value={stats.receivedThisMonth} isCurrency />
              )}
            </div>
            <div className="text-[11px] text-muted">
              <span>Incl. ₹{stats.electricityReceivedThisMonth.toLocaleString('en-IN')} elec</span>
            </div>
          </Card>
        </Link>

        {/* Outstanding Pending Balance */}
        <Link href="/dashboard/pending-balance">
          <Card interactive className="space-y-2 h-full">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-semibold">Pending Balance</span>
              <AlertCircle className="w-4 h-4 text-status-pending" />
            </div>
            <div className="text-2xl font-bold text-status-pending">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <AnimatedNumber value={stats.pendingBalance} isCurrency />
              )}
            </div>
            <div className="text-[11px] text-muted">
              <span>Outstanding dues (floored)</span>
            </div>
          </Card>
        </Link>
      </div>

      {/* Quick Action Navigation Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Link
          href={activeBuildingId ? `/buildings/${activeBuildingId}/rooms` : '/buildings'}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-border-subtle bg-surface text-foreground hover:bg-surface-highest hover:border-primary/40 active:scale-[0.99] transition-all shrink-0 shadow-xs"
        >
          <BedDouble className="w-4 h-4 text-primary" />
          <span>Manage Beds</span>
        </Link>
        <Link
          href="/electricity"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-border-subtle bg-surface text-foreground hover:bg-surface-highest hover:border-primary/40 active:scale-[0.99] transition-all shrink-0 shadow-xs"
        >
          <Zap className="w-4 h-4 text-status-occupied" />
          <span>Log Electricity</span>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (activeBuildingId) {
              setIsRecordPaymentOpen(true);
            } else {
              router.push('/payments');
            }
          }}
          leftIcon={<CreditCard className="w-4 h-4 text-primary" />}
          className="shrink-0 font-semibold"
        >
          Record Payment
        </Button>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-border-subtle bg-surface text-foreground hover:bg-surface-highest hover:border-primary/40 active:scale-[0.99] transition-all shrink-0 shadow-xs"
        >
          <BarChart3 className="w-4 h-4 text-primary" />
          <span>Financial Reports</span>
        </Link>
      </div>

      {/* Advance Bookings & Upcoming Move-Outs Dual Column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Advance Bookings Section */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">Advance Bookings</h2>
              <Badge variant="reserved" size="sm">
                {advanceBookings.length}
              </Badge>
            </div>
            {activeBuildingId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddBookingOpen(true)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                New Booking
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : advanceBookings.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              No pending advance bookings found.
            </div>
          ) : (
            <div className="space-y-2.5">
              {advanceBookings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-container/50 border border-border-subtle text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{b.tenant_name}</span>
                      <Badge variant="reserved" size="sm">
                        Reserved
                      </Badge>
                    </div>
                    <div className="text-muted flex items-center gap-2">
                      <span>Token: ₹{Number(b.paid_amount).toLocaleString('en-IN')}</span>
                      <span>•</span>
                      <span>Move-in: {formatDate(b.expected_move_in_date)}</span>
                    </div>
                  </div>
                  <Button
                    variant="tonal"
                    size="sm"
                    onClick={() => setConvertingBooking(b)}
                  >
                    Convert
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Upcoming Move-Outs Section */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">Upcoming Move-Outs</h2>
              <Badge variant="moving_out" size="sm">
                {upcomingMoveOuts.length}
              </Badge>
            </div>
            <Link
              href="/dashboard/checked-out"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              <span>View History</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : upcomingMoveOuts.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              No upcoming move-outs or notices on file.
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcomingMoveOuts.map((mo) => (
                <div
                  key={mo.tenancy.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-container/50 border border-border-subtle text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{mo.tenantName}</span>
                      <span className="text-muted">
                        ({mo.roomNumber} - {mo.bedLabel})
                      </span>
                    </div>
                    <div className="text-status-moving-out font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>Date: {formatDate(mo.expectedMoveOutDate)}</span>
                    </div>
                  </div>
                  <Link href={`/tenants/${mo.tenancy.tenant_id}/history`}>
                    <Button variant="outline" size="sm">
                      Details
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Add Advance Booking Modal */}
      {activeBuildingId && (
        <AddBookingModal
          isOpen={isAddBookingOpen}
          onClose={() => setIsAddBookingOpen(false)}
          buildingId={activeBuildingId}
          onSuccess={loadDashboardData}
        />
      )}

      {/* Record Payment Modal */}
      {activeBuildingId && (
        <RecordGeneralPaymentModal
          isOpen={isRecordPaymentOpen}
          onClose={() => setIsRecordPaymentOpen(false)}
          buildingId={activeBuildingId}
          onSuccess={loadDashboardData}
        />
      )}

      {/* Convert Advance Booking Modal */}
      <ConvertBookingModal
        isOpen={Boolean(convertingBooking)}
        onClose={() => setConvertingBooking(null)}
        booking={convertingBooking}
        onSuccess={loadDashboardData}
      />
    </div>
  );
}
