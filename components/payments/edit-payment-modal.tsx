'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Payment } from '@/types/domain';

interface EditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  onSuccess: () => void;
}

export function EditPaymentModal({
  isOpen,
  onClose,
  payment,
  onSuccess,
}: EditPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'rent' | 'electricity' | 'maintenance' | 'penalty'>('rent');
  const [date, setDate] = useState('');
  const [method, setMethod] = useState('UPI');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (payment) {
      setAmount(String(payment.amount));
      setType(payment.type as any);
      setDate(payment.date);
      setMethod(payment.method || 'UPI');
      setReceiptNumber(payment.receipt_number || '');
      setError(null);
    }
  }, [payment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) return;

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          amount: numAmount,
          type,
          date,
          method: method || null,
          receipt_number: receiptNumber.trim() || null,
          edited_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      if (updateError) throw updateError;

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update payment';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Payment Record" maxWidth="md">
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
              { value: 'rent', label: 'Rent' },
              { value: 'electricity', label: 'Electricity' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'penalty', label: 'Penalty / Fine' },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Payment Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
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
          label="Receipt / Reference Number"
          value={receiptNumber}
          onChange={(e) => setReceiptNumber(e.target.value)}
        />

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
