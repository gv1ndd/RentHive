'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { RecordPaymentModal } from '@/components/payments/record-payment-modal';
import { EditPaymentModal } from '@/components/payments/edit-payment-modal';
import { AddTenantNoteModal } from '@/components/tenants/add-tenant-note-modal';
import { WhatsAppRentScriptModal } from '@/components/tenants/whatsapp-rent-script-modal';
import { calculatePendingRent } from '@/lib/calculations/rent-calculator';
import { splitUtilityBillsByTenancy } from '@/lib/calculations/utility-splitter';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate, formatDateTime } from '@/lib/utils/dates';
import {
  ArrowLeft,
  Phone,
  Calendar,
  CreditCard,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  BedDouble,
  Clock,
  MessageSquare,
  History,
  CheckCircle2,
} from 'lucide-react';
import { Tenant, Tenancy, Payment, TenantNote } from '@/types/domain';

interface TenancyFull extends Tenancy {
  beds?: {
    id: string;
    bed_label: string;
    rooms?: {
      id: string;
      room_number: string;
      building_id: string;
      buildings?: {
        name: string;
      };
    };
  };
}

export default function TenantHistoryPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const resolvedParams = use(params);
  const tenantId = resolvedParams.tenantId;
  const router = useRouter();
  const supabase = createClient();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenancies, setTenancies] = useState<TenancyFull[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notes, setNotes] = useState<TenantNote[]>([]);
  const [pendingBalance, setPendingBalance] = useState<number>(0);
  const [totalCharged, setTotalCharged] = useState<number>(0);
  const [totalPaid, setTotalPaid] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [electricityDue, setElectricityDue] = useState(0);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [deletingNote, setDeletingNote] = useState<TenantNote | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const loadTenantHub = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Tenant
      const { data: tData } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .is('deleted_at', null)
        .single();

      if (!tData) {
        router.push('/tenants');
        return;
      }
      setTenant(tData as Tenant);

      // 2. Fetch Tenancies
      const { data: tenanciesData } = await (supabase.from('tenancies') as any)
        .select(`
          *,
          beds (
            id,
            bed_label,
            rooms (
              id,
              room_number,
              building_id,
              buildings (
                name
              )
            )
          )
        `)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('check_in_date', { ascending: false });

      const allTenancies = (tenanciesData || []) as unknown as TenancyFull[];
      setTenancies(allTenancies);

      // 3. Fetch Payments
      const tenancyIds = allTenancies.map((t) => t.id);
      let allPayments: Payment[] = [];
      if (tenancyIds.length > 0) {
        const { data: pData } = await supabase
          .from('payments')
          .select('*')
          .in('tenancy_id', tenancyIds)
          .is('deleted_at', null)
          .order('date', { ascending: false });

        allPayments = (pData || []) as Payment[];
        setPayments(allPayments);
      }

      // 4. Fetch Notes
      const { data: notesData } = await supabase
        .from('tenant_notes')
        .select('*')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      setNotes((notesData || []) as TenantNote[]);

      // 5. Calculate pending balance across tenancies
      const activeTenancy = allTenancies.find((t) => !t.check_out_date);

      if (activeTenancy) {
        // Fetch electricity readings for active room
        const roomId = activeTenancy.beds?.rooms?.id;
        let utils: any[] = [];
        if (roomId) {
          const { data: readings } = await supabase
            .from('meter_readings')
            .select('*')
            .is('deleted_at', null);

          const utilitySplit = splitUtilityBillsByTenancy({
            tenancyRows: [{ id: activeTenancy.id, tenant_id: tenantId, check_in_date: activeTenancy.check_in_date, room_id: roomId }],
            utilityBillsByRoom: { [roomId]: (readings || []) as any[] },
          });

          utils = utilitySplit[activeTenancy.id] || [];
        }

        const calc = calculatePendingRent({
          rate: Number(activeTenancy.rate),
          checkInDate: activeTenancy.check_in_date,
          checkOutDate: activeTenancy.check_out_date,
          dueDay: activeTenancy.due_day || 1,
          payments: allPayments.filter((p) => p.tenancy_id === activeTenancy.id),
          asOfDate: new Date(),
          utilityBills: utils,
          firstMonthFree: activeTenancy.first_month_free,
        });

        setPendingBalance(calc.pendingBalance);
        setTotalCharged(calc.totalCharged);
        setTotalPaid(calc.totalPaid);
      }
    } catch (e) {
      console.error('Error loading tenant hub:', e);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, router, supabase]);

  useEffect(() => {
    loadTenantHub();
  }, [loadTenantHub]);

  const handleDeletePaymentConfirm = async () => {
    if (!deletingPayment) return;
    setIsActionLoading(true);
    try {
      const { error } = await supabase
        .from('payments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deletingPayment.id);

      if (error) throw error;
      setDeletingPayment(null);
      await loadTenantHub();
    } catch (e) {
      console.error('Error deleting payment:', e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteNoteConfirm = async () => {
    if (!deletingNote) return;
    setIsActionLoading(true);
    try {
      const { error } = await supabase
        .from('tenant_notes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deletingNote.id);

      if (error) throw error;
      setDeletingNote(null);
      await loadTenantHub();
    } catch (e) {
      console.error('Error deleting note:', e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const activeTenancy = tenancies.find((t) => !t.check_out_date);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl lg:col-span-2" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Back link & Title */}
      <div className="space-y-1">
        <Link
          href="/tenants"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground mb-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Tenants</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-foreground">Tenant Hub — {tenant?.name}</h1>
          <div className="flex items-center gap-2">
            {activeTenancy && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsWhatsAppOpen(true)}
                  leftIcon={<MessageSquare className="w-4 h-4" />}
                  className="bg-[#25D366] hover:bg-[#20bd5a] text-white border-none"
                >
                  WhatsApp Script
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsRecordPaymentOpen(true)}
                  leftIcon={<CreditCard className="w-4 h-4" />}
                >
                  Record Payment
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddNoteOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Note
            </Button>
          </div>
        </div>
      </div>

      {/* Top Profile & Active Tenancy Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Profile Card */}
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold text-xl">
              {tenant?.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">{tenant?.name}</h2>
              {tenant?.phone ? (
                <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{tenant.phone}</span>
                </p>
              ) : (
                <p className="text-xs text-muted">No phone recorded</p>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-xs">
            <span className="text-muted">Status:</span>
            {activeTenancy ? (
              <Badge variant="occupied" size="sm">
                Active Occupant
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                Checked Out
              </Badge>
            )}
          </div>
        </Card>

        {/* Active Tenancy Details Card */}
        <Card className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">
              Current Allocation
            </span>
            {activeTenancy?.expected_move_out_date && (
              <Badge variant="moving_out" size="sm">
                Move-Out: {formatDate(activeTenancy.expected_move_out_date)}
              </Badge>
            )}
          </div>

          {activeTenancy ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-surface-container/60 border border-border-subtle">
                <span className="text-muted block text-[11px]">Property</span>
                <span className="font-bold text-foreground">
                  {activeTenancy.beds?.rooms?.buildings?.name || 'Property'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container/60 border border-border-subtle">
                <span className="text-muted block text-[11px]">Room & Bed</span>
                <span className="font-bold text-foreground">
                  Room {activeTenancy.beds?.rooms?.room_number} — {activeTenancy.beds?.bed_label}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container/60 border border-border-subtle">
                <span className="text-muted block text-[11px]">Monthly Rate</span>
                <span className="font-bold text-foreground">
                  {formatCurrency(Number(activeTenancy.rate))}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container/60 border border-border-subtle">
                <span className="text-muted block text-[11px]">Rent Due Day</span>
                <span className="font-bold text-foreground">Day {activeTenancy.due_day}</span>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-muted">
              Tenant does not currently occupy an active bed.
            </div>
          )}
        </Card>
      </div>

      {/* Financial Status Summary */}
      {activeTenancy && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Live Dues Calculation</h3>
            <span className="text-xs text-muted">As of {formatDate(new Date())}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-surface-container/60 border border-border-subtle space-y-1">
              <span className="text-muted">Total Rent & Utilities Charged</span>
              <div className="text-base font-bold text-foreground">
                {formatCurrency(totalCharged)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-container/60 border border-border-subtle space-y-1">
              <span className="text-muted">Total Payments Recorded</span>
              <div className="text-base font-bold text-status-vacant">
                {formatCurrency(totalPaid)}
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border space-y-1 ${
                pendingBalance > 0
                  ? 'bg-status-pending/10 border-status-pending/25'
                  : 'bg-status-vacant/10 border-status-vacant/25'
              }`}
            >
              <span className="text-muted">Outstanding Balance</span>
              <div
                className={`text-base font-bold ${
                  pendingBalance > 0 ? 'text-status-pending' : 'text-status-vacant'
                }`}
              >
                {pendingBalance < 0
                  ? `Advance Credit: ${formatCurrency(Math.abs(pendingBalance))}`
                  : formatCurrency(pendingBalance)}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Payments Ledger Section */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Payment History</h3>
            <Badge variant="neutral" size="sm">
              {payments.length} Payments
            </Badge>
          </div>

          {activeTenancy && (
            <Button
              variant="tonal"
              size="sm"
              onClick={() => setIsRecordPaymentOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Record Payment
            </Button>
          )}
        </div>

        {payments.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">
            No payment transactions recorded for this tenant yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border-subtle text-muted">
                  <th className="py-2.5 px-3 font-semibold">Date</th>
                  <th className="py-2.5 px-3 font-semibold">Category</th>
                  <th className="py-2.5 px-3 font-semibold">Amount</th>
                  <th className="py-2.5 px-3 font-semibold">Mode</th>
                  <th className="py-2.5 px-3 font-semibold">Reference</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-highest/40 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-foreground">{formatDate(p.date)}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant={p.type === 'rent' ? 'primary' : 'neutral'} size="sm">
                        {p.type.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-foreground">
                      {formatCurrency(Number(p.amount))}
                    </td>
                    <td className="py-2.5 px-3 text-muted">{p.method || 'N/A'}</td>
                    <td className="py-2.5 px-3 text-muted font-mono">{p.receipt_number || '—'}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setEditingPayment(p)}
                          className="p-1 text-muted hover:text-foreground hover:bg-surface-highest rounded cursor-pointer"
                          title="Edit Payment"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingPayment(p)}
                          className="p-1 text-muted hover:text-status-pending hover:bg-status-pending/10 rounded cursor-pointer"
                          title="Move to Trash"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Dual Column: Stay History & Tenant Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stay History Timeline */}
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Stay History</h3>
            <Badge variant="neutral" size="sm">
              {tenancies.length} Stays
            </Badge>
          </div>

          <div className="space-y-2.5">
            {tenancies.map((t, idx) => {
              const isCurrent = !t.check_out_date;

              return (
                <div
                  key={t.id}
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    isCurrent
                      ? 'bg-primary-container/20 border-primary/30'
                      : 'bg-surface-container/50 border-border-subtle'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">
                      {t.beds?.rooms?.buildings?.name} · Room {t.beds?.rooms?.room_number} ({t.beds?.bed_label})
                    </span>
                    {isCurrent ? (
                      <Badge variant="occupied" size="sm">
                        Current Stay
                      </Badge>
                    ) : (
                      <span className="text-muted text-[11px]">Completed</span>
                    )}
                  </div>
                  <div className="text-muted flex items-center justify-between pt-1">
                    <span>
                      {formatDate(t.check_in_date)} — {t.check_out_date ? formatDate(t.check_out_date) : 'Present'}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(Number(t.rate))}/mo
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Tenant Notes */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Operational Notes</h3>
              <Badge variant="neutral" size="sm">
                {notes.length}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddNoteOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Note
            </Button>
          </div>

          {notes.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              No notes on record for this tenant.
            </div>
          ) : (
            <div className="space-y-2.5">
              {notes.map((n) => (
                <div
                  key={n.id}
                  className="p-3 rounded-xl bg-surface-container/50 border border-border-subtle text-xs space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-foreground leading-relaxed flex-1">{n.note}</p>
                    <button
                      onClick={() => setDeletingNote(n)}
                      className="p-1 text-muted hover:text-status-pending hover:bg-status-pending/10 rounded cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[10px] text-muted">
                    {formatDateTime(n.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Record Payment Modal */}
      {activeTenancy && (
        <>
          <RecordPaymentModal
            isOpen={isRecordPaymentOpen}
            onClose={() => setIsRecordPaymentOpen(false)}
            tenancyId={activeTenancy.id}
            defaultAmount={pendingBalance > 0 ? pendingBalance : undefined}
            onSuccess={loadTenantHub}
          />

          <WhatsAppRentScriptModal
            isOpen={isWhatsAppOpen}
            onClose={() => setIsWhatsAppOpen(false)}
            tenantName={tenant?.name || 'Tenant'}
            tenantPhone={tenant?.phone || null}
            buildingName={activeTenancy.beds?.rooms?.buildings?.name}
            roomNumber={activeTenancy.beds?.rooms?.room_number}
            bedLabel={activeTenancy.beds?.bed_label}
            defaultRent={Math.max(0, pendingBalance - electricityDue) || Number(activeTenancy.rate)}
            defaultElectricity={electricityDue}
          />
        </>
      )}

      {/* Edit Payment Modal */}
      <EditPaymentModal
        isOpen={Boolean(editingPayment)}
        onClose={() => setEditingPayment(null)}
        payment={editingPayment}
        onSuccess={loadTenantHub}
      />

      {/* Add Note Modal */}
      <AddTenantNoteModal
        isOpen={isAddNoteOpen}
        onClose={() => setIsAddNoteOpen(false)}
        tenantId={tenantId}
        onSuccess={loadTenantHub}
      />

      {/* Delete Payment Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deletingPayment)}
        onClose={() => setDeletingPayment(null)}
        onConfirm={handleDeletePaymentConfirm}
        title="Move Payment to Trash?"
        description={`Are you sure you want to move this ${formatCurrency(Number(deletingPayment?.amount || 0))} payment to Trash?`}
        confirmText="Move to Trash"
        isDanger
        isLoading={isActionLoading}
      />

      {/* Delete Note Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deletingNote)}
        onClose={() => setDeletingNote(null)}
        onConfirm={handleDeleteNoteConfirm}
        title="Delete Note?"
        description="Are you sure you want to delete this note?"
        confirmText="Delete Note"
        isDanger
        isLoading={isActionLoading}
      />
    </div>
  );
}
