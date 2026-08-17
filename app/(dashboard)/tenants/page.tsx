'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useActiveBuilding } from '@/lib/context/active-building-context';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import { calculatePendingRent } from '@/lib/calculations/rent-calculator';
import { splitUtilityBillsByTenancy } from '@/lib/calculations/utility-splitter';
import {
  Users,
  Search,
  Phone,
  Calendar,
  AlertCircle,
  ArrowRight,
  UserCheck,
  UserX,
  Clock,
  BedDouble,
} from 'lucide-react';
import { Tenant, Tenancy } from '@/types/domain';

interface TenantWithTenancy extends Tenant {
  activeTenancy?: Tenancy & {
    beds?: {
      bed_label: string;
      rooms?: {
        room_number: string;
        building_id: string;
      };
    };
  };
  pastTenancies: Tenancy[];
  pendingBalance: number;
}

type TenantFilter = 'all' | 'active' | 'checked_out' | 'dues';

export default function TenantsPage() {
  const { activeBuilding, activeBuildingId, isLoading: isBuildingLoading } = useActiveBuilding();
  const supabase = createClient();

  const [tenants, setTenants] = useState<TenantWithTenancy[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<TenantFilter>('all');
  const [isLoading, setIsLoading] = useState(true);

  const loadTenants = useCallback(async () => {
    if (!activeBuildingId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch all tenancies for active building
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
        .order('check_in_date', { ascending: false });

      const allTenancies: any[] = (rawTenancies || []).filter(
        (t: any) =>
          t.beds?.rooms?.building_id === activeBuildingId &&
          !t.tenants?.deleted_at
      );

      // 2. Fetch payments
      const tenancyIds = allTenancies.map((t) => t.id);
      let payments: any[] = [];
      if (tenancyIds.length > 0) {
        const { data: pData } = await supabase
          .from('payments')
          .select('*')
          .in('tenancy_id', tenancyIds)
          .is('deleted_at', null);

        payments = pData || [];
      }

      // 3. Fetch utility readings for active building
      const { data: rawMeters } = await (supabase.from('meters') as any)
        .select(`
          room_id,
          meter_readings (
            id,
            amount_due,
            reading_date,
            deleted_at
          )
        `);

      const metersData: any[] = rawMeters || [];
      const utilityBillsByRoom: Record<string, any[]> = {};
      for (const m of metersData) {
        utilityBillsByRoom[m.room_id] = (m.meter_readings || []).filter((r: any) => !r.deleted_at);
      }

      const utilitySplit = splitUtilityBillsByTenancy({
        tenancyRows: allTenancies.map((t) => ({
          ...t,
          beds: { room_id: t.beds?.rooms?.id },
        })),
        utilityBillsByRoom,
      });

      // Group by tenant
      const tenantsMap: Record<string, TenantWithTenancy> = {};

      for (const t of allTenancies) {
        const tenantObj = t.tenants as unknown as Tenant;
        if (!tenantObj) continue;

        if (!tenantsMap[tenantObj.id]) {
          tenantsMap[tenantObj.id] = {
            ...tenantObj,
            pastTenancies: [],
            pendingBalance: 0,
          };
        }

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
        });

        if (!t.check_out_date) {
          tenantsMap[tenantObj.id].activeTenancy = t;
          tenantsMap[tenantObj.id].pendingBalance = calc.pendingBalance;
        } else {
          tenantsMap[tenantObj.id].pastTenancies.push(t);
        }
      }

      setTenants(Object.values(tenantsMap));
    } catch (e) {
      console.error('Error loading tenants:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeBuildingId, supabase]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  // Filtering & Search
  const filteredTenants = tenants.filter((t) => {
    // Search query
    const matchSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.phone && t.phone.includes(searchQuery)) ||
      (t.activeTenancy?.beds?.rooms?.room_number &&
        t.activeTenancy.beds.rooms.room_number.includes(searchQuery));

    if (!matchSearch) return false;

    // Filter tab
    if (filter === 'active') return Boolean(t.activeTenancy);
    if (filter === 'checked_out') return !t.activeTenancy;
    if (filter === 'dues') return t.pendingBalance > 0;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Tenant Directory</h1>
          <p className="text-xs text-muted">
            {activeBuilding?.name || 'All Properties'} · {tenants.length} Total Tenant Records
          </p>
        </div>

        <Link href="/buildings">
          <Button variant="primary" size="sm" leftIcon={<BedDouble className="w-4 h-4" />}>
            Assign Bed
          </Button>
        </Link>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search by name, phone, or room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface border border-border-subtle text-muted hover:text-foreground'
            }`}
          >
            All ({tenants.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filter === 'active'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface border border-border-subtle text-muted hover:text-foreground'
            }`}
          >
            Active ({tenants.filter((t) => t.activeTenancy).length})
          </button>
          <button
            onClick={() => setFilter('dues')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filter === 'dues'
                ? 'bg-status-pending text-white shadow-xs'
                : 'bg-surface border border-border-subtle text-muted hover:text-foreground'
            }`}
          >
            Has Dues ({tenants.filter((t) => t.pendingBalance > 0).length})
          </button>
          <button
            onClick={() => setFilter('checked_out')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filter === 'checked_out'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface border border-border-subtle text-muted hover:text-foreground'
            }`}
          >
            Checked Out ({tenants.filter((t) => !t.activeTenancy).length})
          </button>
        </div>
      </div>

      {/* Tenants List Grid */}
      {isLoading || isBuildingLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : filteredTenants.length === 0 ? (
        <Card className="py-16 text-center space-y-4 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-surface-highest text-muted flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">No Tenants Found</h2>
            <p className="text-xs text-muted mt-1">
              {searchQuery
                ? 'No tenant records matched your search query.'
                : 'Check in your first tenant from the Bed Matrix.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTenants.map((tenant) => {
            const active = tenant.activeTenancy;
            const isMovingOut =
              active && (active.expected_move_out_date || active.notice_given_date);

            return (
              <Link key={tenant.id} href={`/tenants/${tenant.id}/history`}>
                <Card interactive className="flex flex-col justify-between space-y-3 h-full">
                  {/* Top info */}
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-base">
                          {tenant.name.charAt(0)}
                        </div>
                        <div>
                          <h2 className="text-sm font-bold text-foreground leading-snug">
                            {tenant.name}
                          </h2>
                          {tenant.phone && (
                            <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" />
                              <span>{tenant.phone}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {active ? (
                        isMovingOut ? (
                          <Badge variant="moving_out" size="sm">
                            Moving Out
                          </Badge>
                        ) : (
                          <Badge variant="occupied" size="sm">
                            Active
                          </Badge>
                        )
                      ) : (
                        <Badge variant="neutral" size="sm">
                          Checked Out
                        </Badge>
                      )}
                    </div>

                    {/* Room & Bed Allocation */}
                    {active ? (
                      <div className="p-2.5 rounded-xl bg-surface-container/60 border border-border-subtle text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            Room {active.beds?.rooms?.room_number} — {active.beds?.bed_label}
                          </span>
                          <span className="text-muted font-medium">
                            {formatCurrency(Number(active.rate))}/mo
                          </span>
                        </div>
                        <div className="text-[11px] text-muted flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>Since {formatDate(active.check_in_date)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-surface-container/40 text-xs text-muted">
                        Past tenant · {tenant.pastTenancies.length} previous stay(s)
                      </div>
                    )}
                  </div>

                  {/* Bottom Dues & Action */}
                  <div className="pt-2.5 border-t border-border-subtle flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle
                        className={`w-3.5 h-3.5 ${
                          tenant.pendingBalance > 0
                            ? 'text-status-pending'
                            : 'text-status-vacant'
                        }`}
                      />
                      <span
                        className={`font-semibold ${
                          tenant.pendingBalance > 0
                            ? 'text-status-pending'
                            : 'text-status-vacant'
                        }`}
                      >
                        {tenant.pendingBalance > 0
                          ? `Dues: ${formatCurrency(tenant.pendingBalance)}`
                          : tenant.pendingBalance < 0
                          ? `Credit: ${formatCurrency(Math.abs(tenant.pendingBalance))}`
                          : 'Paid in Full'}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 text-primary font-semibold text-xs">
                      <span>Hub</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
