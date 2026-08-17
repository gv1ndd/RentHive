'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useActiveBuilding } from '@/lib/context/active-building-context';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { RecordPaymentModal } from '@/components/payments/record-payment-modal';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import {
  ArrowLeft,
  Search,
  Clock,
  CreditCard,
  Phone,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { Tenancy, Tenant } from '@/types/domain';

interface UpcomingRentItem {
  tenancy: Tenancy;
  tenant: Tenant | null;
  roomNumber: string;
  bedLabel: string;
  rate: number;
  dueDay: number;
  nextDueDate: Date;
  daysUntilDue: number;
}

export function computeNextDueDate(dueDay: number, fromDate: Date = new Date()): { nextDueDate: Date; daysUntilDue: number } {
  const nowYear = fromDate.getFullYear();
  const nowMonth = fromDate.getMonth();
  const todayDate = fromDate.getDate();
  const todayMidnight = new Date(nowYear, nowMonth, todayDate);

  const daysInCurMonth = new Date(nowYear, nowMonth + 1, 0).getDate();
  const curMonthDue = new Date(nowYear, nowMonth, Math.min(dueDay, daysInCurMonth));

  let nextDue: Date;
  if (curMonthDue.getTime() >= todayMidnight.getTime()) {
    nextDue = curMonthDue;
  } else {
    const daysInNextMonth = new Date(nowYear, nowMonth + 2, 0).getDate();
    nextDue = new Date(nowYear, nowMonth + 1, Math.min(dueDay, daysInNextMonth));
  }

  const diffTime = nextDue.getTime() - todayMidnight.getTime();
  const daysUntilDue = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return { nextDueDate: nextDue, daysUntilDue };
}

export default function UpcomingRentPage() {
  const { activeBuilding, activeBuildingId, isLoading: isBuildingLoading } = useActiveBuilding();
  const supabase = createClient();

  const [items, setItems] = useState<UpcomingRentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [payingTenancy, setPayingTenancy] = useState<UpcomingRentItem | null>(null);

  const loadUpcomingData = useCallback(async () => {
    if (!activeBuildingId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch active tenancies with rooms & beds
      const { data: tenanciesData } = await (supabase.from('tenancies') as any)
        .select(`
          id,
          bed_id,
          tenant_id,
          rate,
          due_day,
          check_in_date,
          check_out_date,
          deleted_at,
          beds (
            id,
            bed_label,
            rooms (
              id,
              room_number,
              building_id
            )
          ),
          tenants (
            id,
            name,
            phone,
            deleted_at
          )
        `)
        .is('deleted_at', null)
        .is('check_out_date', null);

      const filteredTenancies = (tenanciesData || []).filter(
        (t: any) =>
          t.beds?.rooms?.building_id === activeBuildingId &&
          !t.tenants?.deleted_at
      );

      const upcomingList: UpcomingRentItem[] = [];
      const now = new Date();

      for (const t of filteredTenancies) {
        const dueDay = t.due_day || 1;
        const { nextDueDate, daysUntilDue } = computeNextDueDate(dueDay, now);

        if (daysUntilDue >= 0 && daysUntilDue <= 10) {
          upcomingList.push({
            tenancy: t,
            tenant: t.tenants,
            roomNumber: t.beds?.rooms?.room_number || '?',
            bedLabel: t.beds?.bed_label || 'Bed',
            rate: Number(t.rate) || 0,
            dueDay,
            nextDueDate,
            daysUntilDue,
          });
        }
      }

      // Sort by closest due date first
      upcomingList.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
      setItems(upcomingList);
    } catch (e) {
      console.error('Error loading upcoming rent data:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeBuildingId, supabase]);

  useEffect(() => {
    loadUpcomingData();
  }, [loadUpcomingData]);

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.tenant?.name?.toLowerCase().includes(q) ||
      item.roomNumber.toLowerCase().includes(q) ||
      item.bedLabel.toLowerCase().includes(q) ||
      (item.tenant?.phone && item.tenant.phone.includes(q))
    );
  });

  const totalUpcomingSum = items.reduce((s, i) => s + i.rate, 0);

  if (isBuildingLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
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
        <h2 className="text-xl font-bold text-foreground">No Building Selected</h2>
        <p className="text-sm text-muted">Please select a building from the header to view upcoming dues.</p>
        <Link href="/buildings">
          <Button variant="primary">Go to Buildings</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Link href="/" className="hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Upcoming Rent</span>
          </div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <span>Upcoming Rent Worklist (Next 10 Days)</span>
          </h1>
          <p className="text-xs text-muted">
            Track rent due within the next 10 days for {activeBuilding.name} and record early advance collections.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="flex items-center justify-between p-4 bg-surface border border-border-subtle">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted">Total Upcoming (10 Days)</span>
            <div className="text-2xl font-bold text-foreground">
              {isLoading ? <Skeleton className="h-8 w-28" /> : formatCurrency(totalUpcomingSum)}
            </div>
            <span className="text-[11px] text-muted">Expected monthly rate total</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <CreditCard className="w-6 h-6" />
          </div>
        </Card>

        <Card className="flex items-center justify-between p-4 bg-surface border border-border-subtle">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted">Tenancies Coming Due</span>
            <div className="text-2xl font-bold text-foreground">
              {isLoading ? <Skeleton className="h-8 w-16" /> : items.length}
            </div>
            <span className="text-[11px] text-muted">Due between today and next 10 days</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-status-occupied/10 flex items-center justify-center text-status-occupied">
            <Clock className="w-6 h-6" />
          </div>
        </Card>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Input
          placeholder="Filter by tenant name, phone, or room..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-4 h-4 text-muted" />}
        />
      </div>

      {/* Worklist Section */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Upcoming Rent Collections</h2>
          <Badge variant="neutral" size="sm">
            {filteredItems.length} {filteredItems.length === 1 ? 'Tenant' : 'Tenants'}
          </Badge>
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-status-vacant mx-auto opacity-70" />
            <p className="text-sm font-semibold text-foreground">
              {searchQuery ? 'No matching upcoming dues found' : 'No Rent Due in the Next 10 Days'}
            </p>
            <p className="text-xs text-muted max-w-sm mx-auto">
              All active tenancies in this building have due dates beyond the next 10-day notice window.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const isToday = item.daysUntilDue === 0;
              const isTomorrow = item.daysUntilDue === 1;

              return (
                <div
                  key={item.tenancy.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-surface-container/40 border border-border-subtle gap-4 hover:border-primary/30 transition-all shadow-xs"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-foreground text-sm truncate">
                        {item.tenant?.name || 'Occupant'}
                      </span>
                      <Badge variant="neutral" size="sm">
                        Room {item.roomNumber} ({item.bedLabel})
                      </Badge>
                      {isToday ? (
                        <Badge variant="occupied" size="sm">
                          Due Today
                        </Badge>
                      ) : isTomorrow ? (
                        <Badge variant="pending" size="sm">
                          Due Tomorrow
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          Due in {item.daysUntilDue} days
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>Due: {formatDate(item.nextDueDate)}</span>
                      </span>
                      {item.tenant?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span>{item.tenant.phone}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-subtle">
                    <div className="text-left sm:text-right">
                      <span className="text-[11px] text-muted block">Monthly Rate</span>
                      <span className="text-base font-bold text-foreground">
                        {formatCurrency(item.rate)}
                      </span>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setPayingTenancy(item)}
                      leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                    >
                      Collect Early
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Record Early Payment Modal */}
      {payingTenancy && (
        <RecordPaymentModal
          isOpen={Boolean(payingTenancy)}
          onClose={() => setPayingTenancy(null)}
          tenancyId={payingTenancy.tenancy.id}
          defaultAmount={payingTenancy.rate}
          onSuccess={loadUpcomingData}
        />
      )}
    </div>
  );
}
