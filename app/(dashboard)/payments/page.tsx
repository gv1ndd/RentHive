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
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { RecordGeneralPaymentModal } from '@/components/payments/record-general-payment-modal';
import { EditPaymentModal } from '@/components/payments/edit-payment-modal';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import {
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  Search,
  Zap,
  TrendingUp,
  Building2,
  Receipt,
  User,
} from 'lucide-react';
import { Payment } from '@/types/domain';

interface PaymentWithTenancy extends Payment {
  tenancies?: {
    id: string;
    rate: number;
    beds?: {
      bed_label: string;
      rooms?: {
        room_number: string;
        building_id: string;
      };
    };
    tenants?: {
      id: string;
      name: string;
    };
  };
}

type PaymentFilter = 'all' | 'rent' | 'electricity' | 'maintenance' | 'penalty';

export default function PaymentsPage() {
  const { activeBuilding, activeBuildingId, isLoading: isBuildingLoading } = useActiveBuilding();
  const supabase = createClient();

  const [payments, setPayments] = useState<PaymentWithTenancy[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<PaymentFilter>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadPayments = useCallback(async () => {
    if (!activeBuildingId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: rawPayments } = await (supabase.from('payments') as any)
        .select(`
          *,
          tenancies (
            id,
            rate,
            beds (
              bed_label,
              rooms (
                room_number,
                building_id
              )
            ),
            tenants (
              id,
              name
            )
          )
        `)
        .is('deleted_at', null)
        .order('date', { ascending: false });

      const filtered = (rawPayments || []).filter(
        (p: any) =>
          p.tenancies?.beds?.rooms?.building_id === activeBuildingId
      );

      setPayments(filtered as PaymentWithTenancy[]);
    } catch (e) {
      console.error('Error loading payments:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeBuildingId, supabase]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleDeleteConfirm = async () => {
    if (!deletingPayment) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('payments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deletingPayment.id);

      if (error) throw error;

      setDeletingPayment(null);
      await loadPayments();
    } catch (e) {
      console.error('Error soft-deleting payment:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  // Metrics
  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const rentCollected = payments
    .filter((p) => p.type === 'rent')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const utilityCollected = payments
    .filter((p) => p.type === 'electricity')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const otherCollected = payments
    .filter((p) => p.type === 'maintenance' || p.type === 'penalty')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  // Filter & Search
  const filteredPayments = payments.filter((p) => {
    const tenantName = p.tenancies?.tenants?.name || '';
    const roomNumber = p.tenancies?.beds?.rooms?.room_number || '';
    const receipt = p.receipt_number || '';

    const matchSearch =
      tenantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      roomNumber.includes(searchQuery) ||
      receipt.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchSearch) return false;

    if (filter === 'all') return true;
    return p.type === filter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Payments Ledger</h1>
          <p className="text-xs text-muted">
            {activeBuilding?.name || 'All Properties'} · Master ledger of rent, electricity, maintenance, and advance collections.
          </p>
        </div>

        {activeBuildingId && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsRecordOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Record Payment
          </Button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="space-y-1">
          <div className="flex items-center gap-2 text-muted text-xs">
            <TrendingUp className="w-4 h-4 text-status-vacant" />
            <span>Total Collections</span>
          </div>
          <div className="text-xl font-bold text-foreground">
            {formatCurrency(totalCollected)}
          </div>
        </Card>

        <Card className="space-y-1">
          <div className="flex items-center gap-2 text-muted text-xs">
            <CreditCard className="w-4 h-4 text-primary" />
            <span>Rent Collected</span>
          </div>
          <div className="text-xl font-bold text-primary">
            {formatCurrency(rentCollected)}
          </div>
        </Card>

        <Card className="space-y-1">
          <div className="flex items-center gap-2 text-muted text-xs">
            <Zap className="w-4 h-4 text-status-pending" />
            <span>Electricity Collected</span>
          </div>
          <div className="text-xl font-bold text-foreground">
            {formatCurrency(utilityCollected)}
          </div>
        </Card>

        <Card className="space-y-1">
          <div className="flex items-center gap-2 text-muted text-xs">
            <Receipt className="w-4 h-4 text-muted" />
            <span>Maintenance & Fines</span>
          </div>
          <div className="text-xl font-bold text-foreground">
            {formatCurrency(otherCollected)}
          </div>
        </Card>
      </div>

      {/* Search & Filter Chips */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search tenant, room, or receipt..."
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
            All ({payments.length})
          </button>
          <button
            onClick={() => setFilter('rent')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filter === 'rent'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface border border-border-subtle text-muted hover:text-foreground'
            }`}
          >
            Rent ({payments.filter((p) => p.type === 'rent').length})
          </button>
          <button
            onClick={() => setFilter('electricity')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filter === 'electricity'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface border border-border-subtle text-muted hover:text-foreground'
            }`}
          >
            Electricity ({payments.filter((p) => p.type === 'electricity').length})
          </button>
          <button
            onClick={() => setFilter('maintenance')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filter === 'maintenance'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface border border-border-subtle text-muted hover:text-foreground'
            }`}
          >
            Maintenance ({payments.filter((p) => p.type === 'maintenance').length})
          </button>
          <button
            onClick={() => setFilter('penalty')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filter === 'penalty'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface border border-border-subtle text-muted hover:text-foreground'
            }`}
          >
            Penalty ({payments.filter((p) => p.type === 'penalty').length})
          </button>
        </div>
      </div>

      {/* Payments Table */}
      <Card className="space-y-4">
        {isLoading || isBuildingLoading ? (
          <div className="space-y-3 py-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-16 text-center space-y-3 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-surface-highest text-muted flex items-center justify-center mx-auto">
              <CreditCard className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">No Payments Recorded</h2>
              <p className="text-xs text-muted mt-1">
                {searchQuery
                  ? 'No transactions match your search query.'
                  : 'Record rent or electricity payments to build your financial ledger.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border-subtle text-muted">
                  <th className="py-3 px-3.5 font-semibold">Date</th>
                  <th className="py-3 px-3.5 font-semibold">Tenant</th>
                  <th className="py-3 px-3.5 font-semibold">Allocation</th>
                  <th className="py-3 px-3.5 font-semibold">Category</th>
                  <th className="py-3 px-3.5 font-semibold">Amount</th>
                  <th className="py-3 px-3.5 font-semibold">Mode</th>
                  <th className="py-3 px-3.5 font-semibold">Reference</th>
                  <th className="py-3 px-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-highest/40 transition-colors">
                    <td className="py-3 px-3.5 font-medium text-foreground whitespace-nowrap">
                      {formatDate(p.date)}
                    </td>
                    <td className="py-3 px-3.5 font-bold text-foreground">
                      {p.tenancies?.tenants ? (
                        <Link
                          href={`/tenants/${p.tenancies.tenants.id}/history`}
                          className="hover:text-primary hover:underline"
                        >
                          {p.tenancies.tenants.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-muted">
                      Room {p.tenancies?.beds?.rooms?.room_number || '?'} ({p.tenancies?.beds?.bed_label || 'Bed'})
                    </td>
                    <td className="py-3 px-3.5">
                      <Badge
                        variant={
                          p.type === 'rent'
                            ? 'primary'
                            : p.type === 'electricity'
                            ? 'occupied'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {p.type.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-3.5 font-bold text-foreground text-sm">
                      {formatCurrency(Number(p.amount))}
                    </td>
                    <td className="py-3 px-3.5 text-muted">{p.method || 'N/A'}</td>
                    <td className="py-3 px-3.5 text-muted font-mono text-[11px]">
                      {p.receipt_number || '—'}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setEditingPayment(p)}
                          className="p-1.5 text-muted hover:text-foreground hover:bg-surface-highest rounded cursor-pointer"
                          title="Edit Payment"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingPayment(p)}
                          className="p-1.5 text-muted hover:text-status-pending hover:bg-status-pending/10 rounded cursor-pointer"
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

      {/* Record Payment Modal */}
      {activeBuildingId && (
        <RecordGeneralPaymentModal
          isOpen={isRecordOpen}
          onClose={() => setIsRecordOpen(false)}
          buildingId={activeBuildingId}
          onSuccess={loadPayments}
        />
      )}

      {/* Edit Payment Modal */}
      <EditPaymentModal
        isOpen={Boolean(editingPayment)}
        onClose={() => setEditingPayment(null)}
        payment={editingPayment}
        onSuccess={loadPayments}
      />

      {/* Delete Payment Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deletingPayment)}
        onClose={() => setDeletingPayment(null)}
        onConfirm={handleDeleteConfirm}
        title="Move Payment to Trash?"
        description={`Are you sure you want to move this ${formatCurrency(Number(deletingPayment?.amount || 0))} payment to Trash?`}
        confirmText="Move to Trash"
        isDanger
        isLoading={isDeleting}
      />
    </div>
  );
}
