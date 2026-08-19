'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActiveBuilding } from '@/lib/context/active-building-context';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import {
  ArrowLeft,
  Calendar,
  Clock,
  UserCheck,
  UserX,
  Phone,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { Tenant, Tenancy } from '@/types/domain';

interface MoveOutRecord {
  tenancy: Tenancy;
  tenant: Tenant;
  roomNumber: string;
  bedLabel: string;
  isUpcoming: boolean;
}

type DateFilterOption = 'current_month' | 'last_month' | 'custom' | 'all';

function CheckedOutContent() {
  const { activeBuilding, activeBuildingId } = useActiveBuilding();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [records, setRecords] = useState<MoveOutRecord[]>([]);
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('current_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Sync tab with URL search parameter if present
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'upcoming' || tabParam === 'history') {
      setTab(tabParam);
    }
  }, [searchParams]);

  const loadMoveOuts = useCallback(async () => {
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
        .order('check_in_date', { ascending: false });

      const filtered = (rawTenancies || []).filter(
        (t: any) =>
          t.beds?.rooms?.building_id === activeBuildingId &&
          !t.tenants?.deleted_at
      );

      const list: MoveOutRecord[] = [];

      for (const t of filtered) {
        const isUpcoming = Boolean(
          !t.check_out_date && (t.expected_move_out_date || t.notice_given_date)
        );
        const isCompleted = Boolean(t.check_out_date);

        if (isUpcoming || isCompleted) {
          list.push({
            tenancy: t,
            tenant: t.tenants,
            roomNumber: t.beds?.rooms?.room_number || '?',
            bedLabel: t.beds?.bed_label || 'Bed',
            isUpcoming,
          });
        }
      }

      setRecords(list);
    } catch (e) {
      console.error('Error loading move-outs:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeBuildingId, supabase]);

  useEffect(() => {
    loadMoveOuts();
  }, [loadMoveOuts]);

  const upcomingList = useMemo(() => records.filter((r) => r.isUpcoming), [records]);
  const historyList = useMemo(() => records.filter((r) => !r.isUpcoming), [records]);

  // Filter checkout history by check_out_date
  const filteredHistoryList = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Current Month range
    const currentMonthStart = formatDate(new Date(currentYear, currentMonth, 1));
    const currentMonthEnd = formatDate(new Date(currentYear, currentMonth + 1, 0));

    // Last Month range
    const lastMonthStart = formatDate(new Date(currentYear, currentMonth - 1, 1));
    const lastMonthEnd = formatDate(new Date(currentYear, currentMonth, 0));

    return historyList
      .filter((r) => {
        const coDate = r.tenancy.check_out_date;
        if (!coDate) return false;

        if (dateFilter === 'current_month') {
          return coDate >= currentMonthStart && coDate <= currentMonthEnd;
        }
        if (dateFilter === 'last_month') {
          return coDate >= lastMonthStart && coDate <= lastMonthEnd;
        }
        if (dateFilter === 'custom') {
          if (customStartDate && coDate < customStartDate) return false;
          if (customEndDate && coDate > customEndDate) return false;
          return true;
        }
        if (dateFilter === 'all') {
          return true;
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = a.tenancy.check_out_date || '';
        const dateB = b.tenancy.check_out_date || '';
        return dateB.localeCompare(dateA);
      });
  }, [historyList, dateFilter, customStartDate, customEndDate]);

  const activeList = tab === 'upcoming' ? upcomingList : filteredHistoryList;

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
            <h1 className="text-xl font-bold text-foreground">Move-Outs & Checkout History</h1>
            <p className="text-xs text-muted">
              {activeBuilding?.name || 'All Properties'} · Track upcoming departures and past stay history.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-surface-highest/80 rounded-xl border border-border-subtle text-xs font-semibold max-w-sm">
        <button
          onClick={() => setTab('upcoming')}
          className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            tab === 'upcoming'
              ? 'bg-surface text-foreground shadow-xs'
              : 'text-muted hover:text-foreground'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Upcoming ({upcomingList.length})</span>
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            tab === 'history'
              ? 'bg-surface text-foreground shadow-xs'
              : 'text-muted hover:text-foreground'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>History ({filteredHistoryList.length})</span>
        </button>
      </div>

      {/* Checkout History Date Range Filter */}
      {tab === 'history' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-surface border border-border-subtle text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-primary" />
              <span>Checkout Date Filter:</span>
            </span>
            <div className="w-48">
              <Select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilterOption)}
                options={[
                  { value: 'current_month', label: 'Current Month' },
                  { value: 'last_month', label: 'Last Month' },
                  { value: 'custom', label: 'Custom Date Range' },
                  { value: 'all', label: 'All (till today)' },
                ]}
              />
            </div>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 text-xs pt-2 sm:pt-0 border-t sm:border-t-0 border-border-subtle">
              <div className="w-36">
                <Input
                  type="date"
                  label="From Date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <span className="text-muted pt-4">to</span>
              <div className="w-36">
                <Input
                  type="date"
                  label="To Date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : activeList.length === 0 ? (
        <Card className="py-16 text-center space-y-3 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-surface-highest text-muted flex items-center justify-center mx-auto">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              {tab === 'upcoming' ? 'No Upcoming Move-Outs' : 'No Checkout History Found'}
            </h2>
            <p className="text-xs text-muted mt-1">
              {tab === 'upcoming'
                ? 'No departure notices have been recorded for this property.'
                : dateFilter === 'current_month'
                ? 'No tenants checked out during the current month. Select "All (till today)" to see full history.'
                : dateFilter === 'last_month'
                ? 'No tenants checked out during the last month.'
                : 'No checkouts found matching the selected date range.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeList.map(({ tenancy, tenant, roomNumber, bedLabel, isUpcoming }) => (
            <Card
              key={tenancy.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground">{tenant.name}</h2>
                  <Badge variant="primary" size="sm">
                    Room {roomNumber} ({bedLabel})
                  </Badge>
                  {isUpcoming ? (
                    <Badge variant="moving_out" size="sm">
                      Notice Active
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">
                      Completed Stay
                    </Badge>
                  )}
                </div>

                {tenant.phone && (
                  <p className="text-xs text-muted flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <span>{tenant.phone}</span>
                  </p>
                )}

                <div className="text-xs text-muted flex items-center gap-2 pt-0.5">
                  <span>Stay: {formatDate(tenancy.check_in_date)}</span>
                  <span>→</span>
                  <span className="font-semibold text-foreground">
                    {tenancy.check_out_date
                      ? formatDate(tenancy.check_out_date)
                      : tenancy.expected_move_out_date
                      ? `Expected ${formatDate(tenancy.expected_move_out_date)}`
                      : 'Present'}
                  </span>
                </div>
              </div>

              <div className="pt-2 sm:pt-0 border-t sm:border-t-0 border-border-subtle flex items-center justify-end">
                <Link href={`/tenants/${tenant.id}/history`}>
                  <Button variant="outline" size="sm" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
                    Tenant Hub
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CheckedOutPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
      <CheckedOutContent />
    </Suspense>
  );
}
