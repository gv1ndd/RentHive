'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useActiveBuilding } from '@/lib/context/active-building-context';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { WhatsAppRentScriptModal } from '@/components/tenants/whatsapp-rent-script-modal';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import { calculatePendingRent } from '@/lib/calculations/rent-calculator';
import { splitUtilityBillsByTenancy } from '@/lib/calculations/utility-splitter';
import {
  BarChart3,
  Download,
  CreditCard,
  Zap,
  AlertCircle,
  TrendingUp,
  Building2,
  Users,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { Tenant, Tenancy, Room, Bed, Building } from '@/types/domain';

interface TenantDueItem {
  tenantId: string;
  tenantName: string;
  tenantPhone: string | null;
  buildingName: string;
  roomNumber: string;
  bedLabel: string;
  rentDue: number;
  electricityDue: number;
  totalPendingDue: number;
  dueDay: number;
  checkInDate: string;
}

export default function ReportsPage() {
  const { activeBuilding, activeBuildingId, isLoading: isBuildingLoading } = useActiveBuilding();
  const supabase = createClient();

  const [duesList, setDuesList] = useState<TenantDueItem[]>([]);
  const [totalCapacityPotential, setTotalCapacityPotential] = useState(0);
  const [activeRentRunRate, setActiveRentRunRate] = useState(0);
  const [totalOutstandingDues, setTotalOutstandingDues] = useState(0);
  const [totalElectricityBilled, setTotalElectricityBilled] = useState(0);
  const [occupancyRate, setOccupancyRate] = useState(0);
  const [whatsAppTarget, setWhatsAppTarget] = useState<TenantDueItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadReportsData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch beds, rooms, and active tenancies
      const { data: rawBeds } = await (supabase.from('beds') as any)
        .select(`
          id,
          bed_label,
          default_rate,
          deleted_at,
          rooms (
            id,
            room_number,
            building_id,
            deleted_at,
            buildings (
              id,
              name,
              deleted_at
            )
          ),
          tenancies (
            id,
            tenant_id,
            rate,
            due_day,
            first_month_free,
            check_in_date,
            check_out_date,
            deleted_at,
            tenants (
              id,
              name,
              phone,
              deleted_at
            )
          )
        `)
        .is('deleted_at', null);

      const allBeds = (rawBeds || []).filter(
        (b: any) =>
          b.rooms &&
          !b.rooms.deleted_at &&
          b.rooms.buildings &&
          !b.rooms.buildings.deleted_at &&
          (!activeBuildingId || b.rooms.building_id === activeBuildingId)
      );

      // Total beds potential
      const potential = allBeds.reduce((sum: number, b: any) => sum + Number(b.default_rate || 0), 0);
      setTotalCapacityPotential(potential);

      // Active tenancies
      const activeTenancies: any[] = [];
      for (const b of allBeds) {
        const active = (b.tenancies || []).find(
          (t: any) => !t.check_out_date && !t.deleted_at && !t.tenants?.deleted_at
        );
        if (active) {
          activeTenancies.push({
            ...active,
            bedLabel: b.bed_label,
            roomNumber: b.rooms.room_number,
            roomId: b.rooms.id,
            buildingName: b.rooms.buildings.name,
            tenantName: active.tenants.name,
            tenantPhone: active.tenants.phone,
          });
        }
      }

      const runRate = activeTenancies.reduce((sum, t) => sum + Number(t.rate || 0), 0);
      setActiveRentRunRate(runRate);
      setOccupancyRate(allBeds.length > 0 ? Math.round((activeTenancies.length / allBeds.length) * 100) : 0);

      // 2. Fetch payments
      const tenancyIds = activeTenancies.map((t) => t.id);
      let payments: any[] = [];
      if (tenancyIds.length > 0) {
        const { data: pData } = await supabase
          .from('payments')
          .select('*')
          .in('tenancy_id', tenancyIds)
          .is('deleted_at', null);

        payments = pData || [];
      }

      // 3. Fetch utility readings
      const { data: metersData } = await (supabase.from('meters') as any).select(`
        room_id,
        meter_readings (
          id,
          amount_due,
          reading_date,
          deleted_at
        )
      `);

      const utilityBillsByRoom: Record<string, any[]> = {};
      let totalUtils = 0;
      for (const m of (metersData || []) as any[]) {
        const readings = (m.meter_readings || []).filter((r: any) => !r.deleted_at);
        utilityBillsByRoom[m.room_id] = readings;
        totalUtils += readings.reduce((sum: number, r: any) => sum + Number(r.amount_due || 0), 0);
      }
      setTotalElectricityBilled(totalUtils);

      const utilitySplit = splitUtilityBillsByTenancy({
        tenancyRows: activeTenancies.map((t) => ({
          ...t,
          beds: { room_id: t.roomId },
        })),
        utilityBillsByRoom,
      });

      // 4. Calculate itemized dues per active tenant
      const duesItems: TenantDueItem[] = [];
      let totalDuesSum = 0;

      for (const t of activeTenancies) {
        const tPayments = payments.filter((p) => p.tenancy_id === t.id);
        const tUtils = utilitySplit[t.id] || [];

        const calc = calculatePendingRent({
          rate: Number(t.rate),
          checkInDate: t.check_in_date,
          checkOutDate: t.check_out_date,
          dueDay: t.due_day || 1,
          payments: tPayments,
          asOfDate: new Date(),
          utilityBills: tUtils,
          firstMonthFree: t.first_month_free,
        });

        // Itemized electricity charges
        const utilCharged = tUtils.reduce((s: number, u: any) => s + Number(u.amount_due || 0), 0);
        const utilPaid = tPayments
          .filter((p) => p.type === 'electricity')
          .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

        const electricityDue = Math.max(0, utilCharged - utilPaid);
        const rentDue = Math.max(0, calc.pendingBalance - electricityDue);
        const totalPendingDue = Math.max(0, calc.pendingBalance);

        if (totalPendingDue > 0) {
          totalDuesSum += totalPendingDue;
          duesItems.push({
            tenantId: t.tenant_id,
            tenantName: t.tenantName,
            tenantPhone: t.tenantPhone,
            buildingName: t.buildingName,
            roomNumber: t.roomNumber,
            bedLabel: t.bedLabel,
            rentDue,
            electricityDue,
            totalPendingDue,
            dueDay: t.due_day || 1,
            checkInDate: t.check_in_date,
          });
        }
      }

      setDuesList(duesItems);
      setTotalOutstandingDues(totalDuesSum);
    } catch (e) {
      console.error('Error generating reports:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeBuildingId, supabase]);

  useEffect(() => {
    loadReportsData();
  }, [loadReportsData]);

  // CSV Export: Pending Dues
  const handleExportPendingDuesCSV = () => {
    if (duesList.length === 0) return;

    const headers = [
      'Tenant Name',
      'Phone Number',
      'Property',
      'Room Number',
      'Bed Label',
      'Rent Due (INR)',
      'Electricity Due (INR)',
      'Total Outstanding Due (INR)',
      'Rent Due Day',
      'Check-In Date',
    ];

    const rows = duesList.map((d) => [
      `"${d.tenantName}"`,
      `"${d.tenantPhone || ''}"`,
      `"${d.buildingName}"`,
      `"${d.roomNumber}"`,
      `"${d.bedLabel}"`,
      d.rentDue,
      d.electricityDue,
      d.totalPendingDue,
      d.dueDay,
      d.checkInDate,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `rent_hive_pending_dues_${formatDate(new Date())}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Financial & Occupancy Reports</h1>
          <p className="text-xs text-muted">
            {activeBuilding?.name || 'All Properties'} · Comprehensive revenue analytics, pending dues breakdown, and CSV export.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleExportPendingDuesCSV}
          disabled={duesList.length === 0}
          leftIcon={<Download className="w-4 h-4" />}
        >
          Export Dues CSV
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="space-y-1">
          <div className="flex items-center gap-2 text-muted text-xs">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span>Monthly Run-Rate</span>
          </div>
          <div className="text-xl font-bold text-foreground">
            {formatCurrency(activeRentRunRate)}
          </div>
          <span className="text-[11px] text-muted block">
            of {formatCurrency(totalCapacityPotential)} potential
          </span>
        </Card>

        <Card className="space-y-1">
          <div className="flex items-center gap-2 text-muted text-xs">
            <Users className="w-4 h-4 text-status-occupied" />
            <span>Occupancy Rate</span>
          </div>
          <div className="text-xl font-bold text-status-occupied">
            {occupancyRate}%
          </div>
          <span className="text-[11px] text-muted block">
            Occupied bed capacity
          </span>
        </Card>

        <Card className="space-y-1">
          <div className="flex items-center gap-2 text-muted text-xs">
            <Zap className="w-4 h-4 text-primary" />
            <span>Utility Split Billed</span>
          </div>
          <div className="text-xl font-bold text-foreground">
            {formatCurrency(totalElectricityBilled)}
          </div>
          <span className="text-[11px] text-muted block">
            Total sub-meter charges
          </span>
        </Card>

        <Card className="space-y-1">
          <div className="flex items-center gap-2 text-muted text-xs">
            <AlertCircle className="w-4 h-4 text-status-pending" />
            <span>Total Outstanding Dues</span>
          </div>
          <div className="text-xl font-bold text-status-pending">
            {formatCurrency(totalOutstandingDues)}
          </div>
          <span className="text-[11px] text-muted block">
            {duesList.length} tenant(s) with dues
          </span>
        </Card>
      </div>

      {/* Itemized Pending Dues Table */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-status-pending" />
            <h2 className="text-sm font-bold text-foreground">Itemized Pending Dues</h2>
            <Badge variant="pending" size="sm">
              {duesList.length}
            </Badge>
          </div>

          {duesList.length > 0 && (
            <button
              onClick={handleExportPendingDuesCSV}
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV</span>
            </button>
          )}
        </div>

        {isLoading || isBuildingLoading ? (
          <div className="space-y-3 py-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : duesList.length === 0 ? (
          <div className="py-16 text-center space-y-3 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-status-vacant/15 text-status-vacant flex items-center justify-center mx-auto">
              <CreditCard className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Zero Outstanding Dues</h3>
              <p className="text-xs text-muted mt-1">
                All active tenants have settled their rent and electricity balances in full.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border-subtle text-muted">
                  <th className="py-3 px-3.5 font-semibold">Tenant</th>
                  <th className="py-3 px-3.5 font-semibold">Property & Allocation</th>
                  <th className="py-3 px-3.5 font-semibold">Due Day</th>
                  <th className="py-3 px-3.5 font-semibold text-right">Rent Due</th>
                  <th className="py-3 px-3.5 font-semibold text-right">Electricity Due</th>
                  <th className="py-3 px-3.5 font-semibold text-right">Total Outstanding</th>
                  <th className="py-3 px-3.5 font-semibold text-right">Hub</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {duesList.map((d) => (
                  <tr key={d.tenantId} className="hover:bg-surface-highest/40 transition-colors">
                    <td className="py-3 px-3.5 font-bold text-foreground">
                      <Link
                        href={`/tenants/${d.tenantId}/history`}
                        className="hover:text-primary hover:underline block"
                      >
                        {d.tenantName}
                      </Link>
                      {d.tenantPhone && (
                        <span className="text-[11px] text-muted font-normal block mt-0.5">
                          {d.tenantPhone}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-muted">
                      {d.buildingName} · Room {d.roomNumber} ({d.bedLabel})
                    </td>
                    <td className="py-3 px-3.5 font-medium text-foreground">
                      Day {d.dueDay}
                    </td>
                    <td className="py-3 px-3.5 text-right font-medium text-foreground">
                      {formatCurrency(d.rentDue)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-medium text-status-pending">
                      {formatCurrency(d.electricityDue)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-bold text-status-pending text-sm">
                      {formatCurrency(d.totalPendingDue)}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setWhatsAppTarget(d)}
                          className="p-1.5 text-[#25D366] hover:bg-[#25D366]/10 rounded-lg inline-flex items-center cursor-pointer transition-colors"
                          title="Share WhatsApp Script"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          href={`/tenants/${d.tenantId}/history`}
                          className="p-1.5 text-primary hover:bg-primary/10 rounded-lg inline-flex items-center"
                          title="Open Tenant Hub"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* WhatsApp Rent Script Modal */}
      {whatsAppTarget && (
        <WhatsAppRentScriptModal
          isOpen={Boolean(whatsAppTarget)}
          onClose={() => setWhatsAppTarget(null)}
          tenantName={whatsAppTarget.tenantName}
          tenantPhone={whatsAppTarget.tenantPhone}
          buildingName={whatsAppTarget.buildingName}
          roomNumber={whatsAppTarget.roomNumber}
          bedLabel={whatsAppTarget.bedLabel}
          defaultRent={whatsAppTarget.rentDue}
          defaultElectricity={whatsAppTarget.electricityDue}
        />
      )}
    </div>
  );
}
