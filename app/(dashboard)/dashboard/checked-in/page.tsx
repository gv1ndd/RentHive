'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useActiveBuilding } from '@/lib/context/active-building-context';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import { calculatePendingRent } from '@/lib/calculations/rent-calculator';
import { splitUtilityBillsByTenancy } from '@/lib/calculations/utility-splitter';
import {
  ArrowLeft,
  Users,
  Phone,
  Calendar,
  AlertCircle,
  CreditCard,
  ExternalLink,
} from 'lucide-react';
import { Tenant, Tenancy } from '@/types/domain';

interface CheckedInOccupant {
  tenancy: Tenancy;
  tenant: Tenant;
  roomNumber: string;
  bedLabel: string;
  pendingBalance: number;
}

export default function CheckedInTenantsPage() {
  const { activeBuilding, activeBuildingId } = useActiveBuilding();
  const supabase = createClient();

  const [occupants, setOccupants] = useState<CheckedInOccupant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadOccupants = useCallback(async () => {
    if (!activeBuildingId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: rawTenancies } = await (supabase.from('tenancies') as any)
        .select(`
          *,
          beds (
            id,
            bed_label,
            rooms (
              id,
              room_number,
              building_id
            )
          ),
          tenants (*)
        `)
        .is('deleted_at', null)
        .is('check_out_date', null)
        .order('check_in_date', { ascending: false });

      const filtered = (rawTenancies || []).filter(
        (t: any) =>
          t.beds?.rooms?.building_id === activeBuildingId &&
          !t.tenants?.deleted_at
      );

      const tenancyIds = filtered.map((t: any) => t.id);
      let payments: any[] = [];
      if (tenancyIds.length > 0) {
        const { data: pData } = await supabase
          .from('payments')
          .select('*')
          .in('tenancy_id', tenancyIds)
          .is('deleted_at', null);

        payments = pData || [];
      }

      // Utility split
      const { data: rawMeters } = await (supabase.from('meters') as any).select(`
        room_id,
        meter_readings (
          id,
          amount_due,
          reading_date,
          deleted_at
        )
      `);

      const utilityBillsByRoom: Record<string, any[]> = {};
      for (const m of (rawMeters || []) as any[]) {
        utilityBillsByRoom[m.room_id] = (m.meter_readings || []).filter((r: any) => !r.deleted_at);
      }

      const utilitySplit = splitUtilityBillsByTenancy({
        tenancyRows: filtered.map((t: any) => ({
          ...t,
          beds: { room_id: t.beds?.rooms?.id },
        })),
        utilityBillsByRoom,
      });

      const list: CheckedInOccupant[] = [];
      for (const t of filtered) {
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

        list.push({
          tenancy: t,
          tenant: t.tenants,
          roomNumber: t.beds?.rooms?.room_number || '?',
          bedLabel: t.beds?.bed_label || 'Bed',
          pendingBalance: calc.pendingBalance,
        });
      }

      setOccupants(list);
    } catch (e) {
      console.error('Error loading checked-in occupants:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeBuildingId, supabase]);

  useEffect(() => {
    loadOccupants();
  }, [loadOccupants]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground mb-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Active Checked-In Occupants</h1>
            <p className="text-xs text-muted">
              {activeBuilding?.name || 'All Properties'} · {occupants.length} Active Tenancies
            </p>
          </div>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : occupants.length === 0 ? (
        <Card className="py-16 text-center space-y-3 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-surface-highest text-muted flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">No Active Occupants</h2>
            <p className="text-xs text-muted mt-1">
              Check in tenants into vacant beds to see active stay records.
            </p>
          </div>
          <Link href="/buildings">
            <Button variant="primary" size="sm">
              Assign Beds
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {occupants.map(({ tenancy, tenant, roomNumber, bedLabel, pendingBalance }) => (
            <Card key={tenancy.id} className="flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-base">
                      {tenant.name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-foreground">{tenant.name}</h2>
                      {tenant.phone && (
                        <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" />
                          <span>{tenant.phone}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <Badge variant="occupied" size="sm">
                    Active
                  </Badge>
                </div>

                <div className="p-2.5 rounded-xl bg-surface-container/60 border border-border-subtle text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      Room {roomNumber} — {bedLabel}
                    </span>
                    <span className="font-bold text-primary">
                      {formatCurrency(Number(tenancy.rate))}/mo
                    </span>
                  </div>
                  <div className="text-[11px] text-muted flex items-center justify-between">
                    <span>Since {formatDate(tenancy.check_in_date)}</span>
                    <span>Due Day {tenancy.due_day}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-border-subtle flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <AlertCircle
                    className={`w-3.5 h-3.5 ${
                      pendingBalance > 0 ? 'text-status-pending' : 'text-status-vacant'
                    }`}
                  />
                  <span
                    className={`font-semibold ${
                      pendingBalance > 0 ? 'text-status-pending' : 'text-status-vacant'
                    }`}
                  >
                    {pendingBalance > 0
                      ? `Dues: ${formatCurrency(pendingBalance)}`
                      : pendingBalance < 0
                      ? `Credit: ${formatCurrency(Math.abs(pendingBalance))}`
                      : 'Settled'}
                  </span>
                </div>

                <Link
                  href={`/tenants/${tenant.id}/history`}
                  className="inline-flex items-center gap-1 text-primary font-semibold text-xs hover:underline"
                >
                  <span>Tenant Hub</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
