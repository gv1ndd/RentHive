'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import { UserX, AlertCircle, CheckCircle2, CreditCard } from 'lucide-react';
import { Tenancy } from '@/types/domain';

interface CheckoutTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenancy: Tenancy | null;
  tenantName?: string;
  roomInfo?: string;
  pendingBalance: number;
  onSuccess: () => void;
}

export function CheckoutTenantModal({
  isOpen,
  onClose,
  tenancy,
  tenantName = 'Tenant',
  roomInfo = 'Current Room',
  pendingBalance,
  onSuccess,
}: CheckoutTenantModalProps) {
  const [checkOutDate, setCheckOutDate] = useState<string>(formatDate(new Date()));
  const [settlementOption, setSettlementOption] = useState<'pay' | 'keep' | 'waive'>('keep');
  const [payAmount, setPayAmount] = useState<string>(String(Math.max(0, pendingBalance)));
  const [payMethod, setPayMethod] = useState<string>('Cash');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  if (!tenancy) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // 1. If user chose to collect payment now
      if (settlementOption === 'pay' && parseFloat(payAmount) > 0) {
        const { error: pErr } = await supabase.from('payments').insert({
          tenancy_id: tenancy.id,
          amount: parseFloat(payAmount),
          type: 'rent' as const,
          date: checkOutDate,
          method: payMethod,
          receipt_number: `SETTLE-CHECKOUT-${Date.now().toString().slice(-4)}`,
        });
        if (pErr) throw pErr;
      }

      // 2. If user chose to waive dues, record a settlement discount note
      if (settlementOption === 'waive' && pendingBalance > 0) {
        await supabase.from('tenant_notes').insert({
          tenant_id: tenancy.tenant_id,
          note: `Remaining balance of ${formatCurrency(pendingBalance)} waived upon move-out on ${checkOutDate}.`,
        });
      }

      // 3. Mark tenancy as checked out
      const { error: tErr } = await supabase
        .from('tenancies')
        .update({
          check_out_date: checkOutDate,
        })
        .eq('id', tenancy.id);

      if (tErr) throw tErr;

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to process checkout');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Check Out Tenant (Move to Ex-Tenants)"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-3 rounded-xl bg-status-pending/15 border border-status-pending/30 text-status-pending font-medium">
            {error}
          </div>
        )}

        {/* Tenant Summary Banner */}
        <div className="p-3.5 rounded-xl bg-surface-container/60 border border-border-subtle space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground text-sm">{tenantName}</span>
            <span className="text-muted">{roomInfo}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border-subtle/60">
            <span className="text-muted">Outstanding Balance:</span>
            <span
              className={`font-bold text-sm ${
                pendingBalance > 0 ? 'text-status-pending' : 'text-status-vacant'
              }`}
            >
              {pendingBalance > 0
                ? formatCurrency(pendingBalance)
                : pendingBalance < 0
                ? `Advance Credit: ${formatCurrency(Math.abs(pendingBalance))}`
                : '₹0 (All Cleared)'}
            </span>
          </div>
        </div>

        {/* Check-Out Date */}
        <Input
          label="Move-Out / Check-Out Date"
          type="date"
          value={checkOutDate}
          onChange={(e) => setCheckOutDate(e.target.value)}
          required
        />

        {/* Settlement options if balance is pending */}
        {pendingBalance > 0 && (
          <div className="space-y-2.5 pt-1">
            <label className="text-xs font-semibold text-foreground block">
              Dues Settlement Option
            </label>
            <div className="space-y-2">
              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  settlementOption === 'pay'
                    ? 'border-primary bg-primary/5'
                    : 'border-border-subtle bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="settlement"
                  checked={settlementOption === 'pay'}
                  onChange={() => setSettlementOption('pay')}
                  className="mt-0.5 text-primary"
                />
                <div>
                  <span className="font-semibold text-foreground block">Collect Final Payment Now</span>
                  <span className="text-[11px] text-muted">
                    Record full or partial payment immediately before checkout.
                  </span>
                </div>
              </label>

              {settlementOption === 'pay' && (
                <div className="grid grid-cols-2 gap-2.5 p-2.5 rounded-xl bg-surface-highest/40 border border-border-subtle">
                  <Input
                    label="Amount Received (₹)"
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                  />
                  <Select
                    label="Payment Method"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    options={[
                      { value: 'Cash', label: 'Cash' },
                      { value: 'UPI', label: 'UPI / GPay / PhonePe' },
                      { value: 'Bank Transfer', label: 'Bank Transfer / IMPS' },
                      { value: 'Card', label: 'Debit / Credit Card' },
                    ]}
                  />
                </div>
              )}

              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  settlementOption === 'keep'
                    ? 'border-primary bg-primary/5'
                    : 'border-border-subtle bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="settlement"
                  checked={settlementOption === 'keep'}
                  onChange={() => setSettlementOption('keep')}
                  className="mt-0.5 text-primary"
                />
                <div>
                  <span className="font-semibold text-foreground block">Keep Balance as Ex-Tenant Due</span>
                  <span className="text-[11px] text-muted">
                    Check out now and track remaining balance in Ex-Tenants history.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  settlementOption === 'waive'
                    ? 'border-primary bg-primary/5'
                    : 'border-border-subtle bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="settlement"
                  checked={settlementOption === 'waive'}
                  onChange={() => setSettlementOption('waive')}
                  className="mt-0.5 text-primary"
                />
                <div>
                  <span className="font-semibold text-foreground block">Waive / Forgive Remaining Dues</span>
                  <span className="text-[11px] text-muted">
                    Zero out remaining dues with a settlement note upon move-out.
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" size="sm" isLoading={isLoading} leftIcon={<UserX className="w-4 h-4" />}>
            Confirm Move-Out (To Ex-Tenants)
          </Button>
        </div>
      </form>
    </Modal>
  );
}
