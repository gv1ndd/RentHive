'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils/dates';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenancyId: string;
  defaultAmount?: number;
  onSuccess: () => void;
}

export function RecordPaymentModal({
  isOpen,
  onClose,
  tenancyId,
  defaultAmount,
  onSuccess,
}: RecordPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'rent' | 'electricity' | 'rent_and_electricity' | 'maintenance' | 'penalty'>('rent');
  const [date, setDate] = useState(formatDate(new Date()));
  const [isBackdated, setIsBackdated] = useState(false);
  const [keepOpenForMultiple, setKeepOpenForMultiple] = useState(false);
  const [method, setMethod] = useState('UPI');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      setAmount(defaultAmount ? String(defaultAmount) : '');
      setDate(formatDate(new Date()));
      setIsBackdated(false);
      setKeepOpenForMultiple(false);
      setError(null);
    }
  }, [isOpen, defaultAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (type === 'rent_and_electricity') {
        // Fetch tenancy details
        const { data: tenancy } = await (supabase.from('tenancies') as any)
          .select(`
            id,
            rate,
            due_day,
            check_in_date,
            beds (
              room_id
            )
          `)
          .eq('id', tenancyId)
          .single();

        // 1. Fetch payments
        const { data: tenancyPayments } = await supabase
          .from('payments')
          .select('*')
          .eq('tenancy_id', tenancyId)
          .is('deleted_at', null);

        // 2. Fetch meter readings
        let electricityDue = 0;
        const roomId = tenancy?.beds?.room_id;
        if (roomId) {
          const { data: meters } = await supabase
            .from('meters')
            .select(`
              id,
              meter_readings (
                id,
                amount_due,
                deleted_at
              )
            `)
            .eq('room_id', roomId);

          const rawReadings = ((meters || []) as any[]).flatMap((m) => m.meter_readings || []).filter((r: any) => !r.deleted_at);
          const totalUtilCharged = rawReadings.reduce((sum: number, r: any) => sum + Number(r.amount_due || 0), 0);
          const totalUtilPaid = (tenancyPayments || [])
            .filter((p: any) => p.type === 'electricity')
            .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
          electricityDue = Math.max(0, totalUtilCharged - totalUtilPaid);
        }

        // 3. Compute rent due
        const { calculatePendingRent } = await import('@/lib/calculations/rent-calculator');
        const calc = calculatePendingRent({
          rate: Number(tenancy?.rate) || 0,
          checkInDate: tenancy?.check_in_date || new Date().toISOString(),
          dueDay: tenancy?.due_day || 1,
          payments: (tenancyPayments || []) as any[],
          asOfDate: new Date(),
        });

        const rentDue = Math.max(0, calc.pendingBalance - electricityDue);

        // 4. Split Order: Rent first -> Electricity second -> Surplus to Rent
        let rentPortion = 0;
        let electricityPortion = 0;

        if (rentDue === 0 && electricityDue === 0) {
          rentPortion = numAmount;
        } else if (numAmount <= rentDue) {
          rentPortion = numAmount;
        } else {
          rentPortion = rentDue;
          const remainder = numAmount - rentDue;
          if (remainder <= electricityDue) {
            electricityPortion = remainder;
          } else {
            electricityPortion = electricityDue;
            rentPortion += (remainder - electricityDue);
          }
        }

        const rowsToInsert = [];
        const baseRef = receiptNumber.trim() || null;

        if (rentPortion > 0) {
          rowsToInsert.push({
            tenancy_id: tenancyId,
            amount: rentPortion,
            type: 'rent' as const,
            date,
            method: method || null,
            receipt_number: baseRef ? `${baseRef}-RENT` : null,
          });
        }

        if (electricityPortion > 0) {
          rowsToInsert.push({
            tenancy_id: tenancyId,
            amount: electricityPortion,
            type: 'electricity' as const,
            date,
            method: method || null,
            receipt_number: baseRef ? `${baseRef}-ELEC` : null,
          });
        }

        if (rowsToInsert.length > 0) {
          const { error: insertErr } = await supabase.from('payments').insert(rowsToInsert);
          if (insertErr) throw insertErr;
        }
      } else {
        const { error: insertError } = await supabase.from('payments').insert({
          tenancy_id: tenancyId,
          amount: numAmount,
          type,
          date,
          method: method || null,
          receipt_number: receiptNumber.trim() || null,
        });

        if (insertError) throw insertError;
      }

      setAmount('');
      setReceiptNumber('');
      onSuccess();

      if (!keepOpenForMultiple) {
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record payment';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Payment" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-status-pending/15 border border-status-pending/30 text-status-pending text-xs font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Payment Amount (₹)"
            type="number"
            placeholder="e.g. 6000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            autoFocus
          />

          <Select
            label="Payment Category"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            options={[
              { value: 'rent', label: 'Rent Only' },
              { value: 'rent_and_electricity', label: 'Rent + Electricity (Auto-Split)' },
              { value: 'electricity', label: 'Electricity Only' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'penalty', label: 'Penalty / Fine' },
            ]}
          />
        </div>

        {/* Backdated / Past Payment Toggle */}
        <div className="flex flex-col gap-2 p-3 rounded-xl bg-surface-container/60 border border-border-subtle text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-foreground">
            <input
              type="checkbox"
              checked={isBackdated}
              onChange={(e) => setIsBackdated(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary w-4 h-4"
            />
            <span>Log as Past / Backdated Payment</span>
          </label>
          {isBackdated && (
            <p className="text-[11px] text-muted pl-6">
              You can set the payment date to any historical date in the past to backfill records.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Payment Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            max={isBackdated ? undefined : formatDate(new Date())}
          />

          <Select
            label="Payment Mode"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            options={[
              { value: 'UPI', label: 'UPI (GPay, PhonePe, Paytm)' },
              { value: 'Cash', label: 'Cash' },
              { value: 'Bank Transfer', label: 'Bank Transfer (IMPS/NEFT)' },
              { value: 'Cheque', label: 'Cheque' },
            ]}
          />
        </div>

        <Input
          label="Receipt / Transaction Reference (Optional)"
          placeholder="e.g. UPI-104928"
          value={receiptNumber}
          onChange={(e) => setReceiptNumber(e.target.value)}
        />

        {/* Repeat Entry Checkbox */}
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={keepOpenForMultiple}
            onChange={(e) => setKeepOpenForMultiple(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary w-4 h-4"
          />
          <span>Keep modal open to add another payment entry</span>
        </label>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            {keepOpenForMultiple ? 'Save & Add Another' : 'Save Payment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
