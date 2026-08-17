'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useActiveBuilding } from '@/lib/context/active-building-context';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RecordPaymentModal } from '@/components/payments/record-payment-modal';
import { WhatsAppRentScriptModal } from '@/components/tenants/whatsapp-rent-script-modal';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import { calculatePendingRent } from '@/lib/calculations/rent-calculator';
import { splitUtilityBillsByTenancy } from '@/lib/calculations/utility-splitter';
import {
  ArrowLeft,
  AlertCircle,
  Phone,
  CreditCard,
  ExternalLink,
  Plus,
  MessageSquare,
} from 'lucide-react';
import { Tenant, Tenancy } from '@/types/domain';

interface TenantDueRecord {
  tenancy: Tenancy;
  tenant: Tenant;
  roomNumber: string;
  bedLabel: string;
  rentDue: number;
  electricityDue: number;
  totalPendingDue: number;
}

export default function PendingBalancePage() {
  const { activeBuilding, activeBuildingId } = useActiveBuilding();
  const supabase = createClient();

  const [duesList, setDuesList] = useState<TenantDueRecord[]>([]);
  const [totalPendingSum, setTotalPendingSum] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Record Payment Modal
  const [payingTenancy, setPayingTenancy] = useState<{
    id: string;
    amount: number;
  } | null>(null);

  // WhatsApp Modal
  const [whatsAppTarget, setWhatsAppTarget] = useState<TenantDueRecord | null>(null);

  const loadPendingBalances = useCallback(async () => {
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
        .is('check_out_date', null);

      const active = (rawTenancies || []).filter(
        (t: any) =>
          t.beds?.rooms?.building_id === activeBuildingId &&
          !t.tenants?.deleted_at
      );

      const tenancyIds = active.map((t: any) => t.id);
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
        tenancyRows: active.map((t: any) => ({
          ...t,
          beds: { room_id: t.beds?.rooms?.id },
        })),
        utilityBillsByRoom,
      });

      const list: TenantDueRecord[] = [];
      let sum = 0;

      for (const t of active) {
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

        if (calc.pendingBalance > 0) {
          const utilCharged = tUtils.reduce((s: number, u: any) => s + Number(u.amount_due || 0), 0);
          const utilPaid = tPayments
            .filter((p) => p.type === 'electricity')
            .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

          const electricityDue = Math.max(0, utilCharged - utilPaid);
          const rentDue = Math.max(0, calc.pendingBalance - electricityDue);

          sum += calc.pendingBalance;
          list.push({
            tenancy: t,
            tenant: t.tenants,
            roomNumber: t.beds?.rooms?.room_number || '?',
            bedLabel: t.beds?.bed_label || 'Bed',
            rentDue,
            electricityDue,
            totalPendingDue: calc.pendingBalance,
          });
        }
      }

      setDuesList(list);
      setTotalPendingSum(sum);
    } catch (e) {
      console.error('Error loading pending balances:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeBuildingId, supabase]);

  useEffect(() => {
    loadPendingBalances();
  }, [loadPendingBalances]);

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
            <h1 className="text-xl font-bold text-foreground">Outstanding Pending Dues</h1>
            <p className="text-xs text-muted">
              {activeBuilding?.name || 'All Properties'} · {duesList.length} Tenants with Overdue Balances
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-status-pending/10 border border-status-pending/25 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-status-pending shrink-0" />
            <div>
              <span className="text-[11px] text-muted block">Total Outstanding Dues</span>
              <span className="text-lg font-bold text-status-pending">
                {formatCurrency(totalPendingSum)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dues List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : duesList.length === 0 ? (
        <Card className="py-16 text-center space-y-3 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-status-vacant/15 text-status-vacant flex items-center justify-center mx-auto">
            <CreditCard className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">All Dues Cleared</h2>
            <p className="text-xs text-muted mt-1">
              There are no pending dues recorded for this property.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {duesList.map((item) => {
            const { tenancy, tenant, roomNumber, bedLabel, rentDue, electricityDue, totalPendingDue } = item;
            return (
              <Card
                key={tenancy.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-status-pending/25"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-bold text-foreground">{tenant.name}</h2>
                    <Badge variant="primary" size="sm">
                      Room {roomNumber} ({bedLabel})
                    </Badge>
                    <span className="text-xs text-muted">Due Day {tenancy.due_day}</span>
                  </div>

                  {tenant.phone && (
                    <p className="text-xs text-muted flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      <span>{tenant.phone}</span>
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs pt-0.5">
                    <span className="text-muted">
                      Rent: <strong className="text-foreground">{formatCurrency(rentDue)}</strong>
                    </span>
                    <span>•</span>
                    <span className="text-muted">
                      Electricity: <strong className="text-status-pending">{formatCurrency(electricityDue)}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-subtle">
                  <div className="text-right">
                    <span className="text-[11px] text-muted block">Total Due</span>
                    <span className="text-lg font-bold text-status-pending">
                      {formatCurrency(totalPendingDue)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="tonal"
                      size="sm"
                      onClick={() => setWhatsAppTarget(item)}
                      leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                      className="text-[#25D366] hover:bg-[#25D366]/10"
                      title="Share WhatsApp Script"
                    >
                      WhatsApp
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        setPayingTenancy({
                          id: tenancy.id,
                          amount: totalPendingDue,
                        })
                      }
                      leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                    >
                      Record Payment
                    </Button>

                    <Link href={`/tenants/${tenant.id}/history`}>
                      <Button variant="outline" size="sm" aria-label="Open Tenant Hub">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Record Payment Modal */}
      {payingTenancy && (
        <RecordPaymentModal
          isOpen={Boolean(payingTenancy)}
          onClose={() => setPayingTenancy(null)}
          tenancyId={payingTenancy.id}
          defaultAmount={payingTenancy.amount}
          onSuccess={loadPendingBalances}
        />
      )}

      {/* WhatsApp Rent Script Modal */}
      {whatsAppTarget && (
        <WhatsAppRentScriptModal
          isOpen={Boolean(whatsAppTarget)}
          onClose={() => setWhatsAppTarget(null)}
          tenantName={whatsAppTarget.tenant.name}
          tenantPhone={whatsAppTarget.tenant.phone}
          buildingName={activeBuilding?.name}
          roomNumber={whatsAppTarget.roomNumber}
          bedLabel={whatsAppTarget.bedLabel}
          defaultRent={whatsAppTarget.rentDue}
          defaultElectricity={whatsAppTarget.electricityDue}
        />
      )}
    </div>
  );
}
