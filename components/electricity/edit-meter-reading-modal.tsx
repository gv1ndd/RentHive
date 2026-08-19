'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/currency';
import { MeterReading } from '@/types/domain';

interface EditMeterReadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  reading: MeterReading | null;
  ratePerUnit: number;
  onSuccess: () => void;
}

export function EditMeterReadingModal({
  isOpen,
  onClose,
  reading,
  ratePerUnit,
  onSuccess,
}: EditMeterReadingModalProps) {
  const [prevReading, setPrevReading] = useState('0');
  const [currReading, setCurrReading] = useState('0');
  const [readingDate, setReadingDate] = useState('');
  const [rate, setRate] = useState('10');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (reading) {
      setPrevReading(String(reading.previous_reading));
      setCurrReading(String(reading.current_reading));
      setReadingDate(reading.reading_date);
      setRate(String(ratePerUnit || 10));
      setError(null);
    }
  }, [reading, ratePerUnit]);

  const p = parseFloat(prevReading) || 0;
  const c = parseFloat(currReading) || 0;
  const r = parseFloat(rate) || 0;

  const unitsConsumed = Math.max(0, c - p);
  const totalAmount = Math.round(unitsConsumed * r);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reading) return;

    if (c < p) {
      setError('Current reading cannot be lower than the previous reading.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('meter_readings')
        .update({
          previous_reading: p,
          current_reading: c,
          amount_due: totalAmount,
          reading_date: readingDate,
        })
        .eq('id', reading.id);

      if (updateError) throw updateError;

      // Maintain contiguous meter chain: update subsequent reading's previous reading if exists
      const { data: nextReadings } = await supabase
        .from('meter_readings')
        .select('*')
        .eq('meter_id', reading.meter_id)
        .gt('reading_date', readingDate)
        .is('deleted_at', null)
        .order('reading_date', { ascending: true })
        .limit(1);

      if (nextReadings && nextReadings.length > 0) {
        const nextR = nextReadings[0];
        const nextConsumed = Math.max(0, Number(nextR.current_reading) - c);
        const nextAmount = Math.round(nextConsumed * r);
        await supabase
          .from('meter_readings')
          .update({
            previous_reading: c,
            amount_due: nextAmount,
          })
          .eq('id', nextR.id);
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update reading';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Meter Reading" maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-status-pending/15 border border-status-pending/30 text-status-pending text-xs font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Previous Reading"
            type="number"
            value={prevReading}
            onChange={(e) => setPrevReading(e.target.value)}
            required
          />

          <Input
            label="Current Reading"
            type="number"
            value={currReading}
            onChange={(e) => setCurrReading(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Rate per Unit (₹)"
            type="number"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            required
          />

          <Input
            label="Reading Date"
            type="date"
            value={readingDate}
            onChange={(e) => setReadingDate(e.target.value)}
            required
          />
        </div>

        <div className="p-3 rounded-xl bg-surface-container border border-border-subtle text-xs flex items-center justify-between">
          <span className="text-muted">Calculated Total:</span>
          <span className="font-bold text-sm text-foreground">
            {unitsConsumed} units · {formatCurrency(totalAmount)}
          </span>
        </div>

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
