'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils/dates';

interface RecordGeneralPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildingId: string;
  onSuccess: () => void;
}

interface ActiveTenancyOption {
  id: string;
  tenantName: string;
  roomNumber: string;
  bedLabel: string;
  rate: number;
}

export function RecordGeneralPaymentModal({
  isOpen,
  onClose,
  buildingId,
  onSuccess,
}: RecordGeneralPaymentModalProps) {
  const [tenancies, setTenancies] = useState<ActiveTenancyOption[]>([]);
  const [selectedTenancyId, setSelectedTenancyId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'rent' | 'electricity' | 'maintenance' | 'penalty'>('rent');
  const [date, setDate] = useState(formatDate(new Date()));
  const [method, setMethod] = useState('UPI');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen && buildingId) {
      const fetchActiveTenancies = async () => {
        const { data } = await (supabase.from('tenancies') as any)
          .select(`
            id,
            rate,
            check_out_date,
            deleted_at,
            beds (
              bed_label,
              rooms (
                room_number,
                building_id
              )
            ),
            tenants (
              name,
              deleted_at
            )
          `)
          .is('deleted_at', null)
          .is('check_out_date', null);

        const list: ActiveTenancyOption[] = (data || [])
          .filter(
            (t: any) =>
              t.beds?.rooms?.building_id === buildingId &&
              !t.tenants?.deleted_at
          )
          .map((t: any) => ({
            id: t.id,
            tenantName: t.tenants?.name || 'Occupant',
            roomNumber: t.beds?.rooms?.room_number || '?',
            bedLabel: t.beds?.bed_label || 'Bed',
            rate: Number(t.rate),
          }));

        setTenancies(list);
        if (list.length > 0) {
          setSelectedTenancyId(list[0].id);
          setAmount(String(list[0].rate));
        }
      };

      fetchActiveTenancies();
      setDate(formatDate(new Date()));
      setError(null);
    }
  }, [isOpen, buildingId, supabase]);

  const handleTenancyChange = (id: string) => {
    setSelectedTenancyId(id);
    const chosen = tenancies.find((t) => t.id === id);
    if (chosen && type === 'rent') {
      setAmount(String(chosen.rate));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    if (!selectedTenancyId) {
      setError('Please select a tenant.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase.from('payments').insert({
        tenancy_id: selectedTenancyId,
        amount: numAmount,
        type,
        date,
        method: method || null,
        receipt_number: receiptNumber.trim() || null,
      });

      if (insertError) throw insertError;

      setAmount('');
      setReceiptNumber('');
      onSuccess();
      onClose();
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

        <Select
          label="Select Tenant & Allocation"
          value={selectedTenancyId}
          onChange={(e) => handleTenancyChange(e.target.value)}
          required
        >
          {tenancies.map((t) => (
            <option key={t.id} value={t.id}>
              {t.tenantName} — Room {t.roomNumber} ({t.bedLabel})
            </option>
          ))}
        </Select>

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
          label="Receipt / Reference Number (Optional)"
          placeholder="e.g. UPI-948201"
          value={receiptNumber}
          onChange={(e) => setReceiptNumber(e.target.value)}
        />

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            Save Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
