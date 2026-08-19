'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import { Zap, Users, AlertCircle } from 'lucide-react';

interface AddMeterReadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  meter: {
    id: string;
    meter_number: string;
    rate_per_unit: number;
    room_id: string;
    room_number?: string;
  } | null;
  lastReading: number;
  onSuccess: () => void;
}

interface ActiveOccupant {
  tenancyId: string;
  tenantName: string;
  bedLabel: string;
}

export function AddMeterReadingModal({
  isOpen,
  onClose,
  meter,
  lastReading,
  onSuccess,
}: AddMeterReadingModalProps) {
  const [prevReading, setPrevReading] = useState('0');
  const [currReading, setCurrReading] = useState('');
  const [ratePerUnit, setRatePerUnit] = useState('10');
  const [readingDate, setReadingDate] = useState(formatDate(new Date()));
  const [activeOccupants, setActiveOccupants] = useState<ActiveOccupant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen && meter) {
      setPrevReading(String(lastReading || 0));
      setCurrReading('');
      setRatePerUnit(String(meter.rate_per_unit || 10));
      setReadingDate(formatDate(new Date()));
      setError(null);

      // Fetch currently active occupants strictly in this room
      const fetchOccupants = async () => {
        const { data: roomBeds } = await supabase
          .from('beds')
          .select('id, bed_label')
          .eq('room_id', meter.room_id)
          .is('deleted_at', null);

        const roomBedIds = (roomBeds || []).map((b) => b.id);
        const bedLabelMap = new Map((roomBeds || []).map((b) => [b.id, b.bed_label]));

        if (roomBedIds.length === 0) {
          setActiveOccupants([]);
          return;
        }

        const { data } = await (supabase.from('tenancies') as any)
          .select(`
            id,
            bed_id,
            check_in_date,
            check_out_date,
            tenants (
              name,
              deleted_at
            )
          `)
          .in('bed_id', roomBedIds)
          .is('deleted_at', null)
          .is('check_out_date', null);

        const list: ActiveOccupant[] = (data || [])
          .filter((t: any) => !t.tenants?.deleted_at)
          .map((t: any) => ({
            tenancyId: t.id,
            tenantName: t.tenants?.name || 'Occupant',
            bedLabel: bedLabelMap.get(t.bed_id) || 'Bed',
          }));

        setActiveOccupants(list);
      };

      fetchOccupants();
    }
  }, [isOpen, meter, lastReading, supabase]);

  const p = parseFloat(prevReading) || 0;
  const c = parseFloat(currReading) || 0;
  const r = parseFloat(ratePerUnit) || 0;

  const unitsConsumed = Math.max(0, c - p);
  const totalAmount = Math.round(unitsConsumed * r);
  const perTenantShare = activeOccupants.length > 0 ? Math.round(totalAmount / activeOccupants.length) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meter) return;

    if (c < p) {
      setError('Current reading cannot be lower than the previous reading.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase.from('meter_readings').insert({
        meter_id: meter.id,
        previous_reading: p,
        current_reading: c,
        amount_due: totalAmount,
        reading_date: readingDate,
      });

      if (insertError) throw insertError;

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record meter reading';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!meter) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Log Electricity Reading — Room ${meter.room_number || ''}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-status-pending/15 border border-status-pending/30 text-status-pending text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Previous Reading (Units)"
            type="number"
            value={prevReading}
            onChange={(e) => setPrevReading(e.target.value)}
            required
          />

          <Input
            label="Current Meter Reading"
            type="number"
            placeholder="e.g. 1450"
            value={currReading}
            onChange={(e) => setCurrReading(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Rate per Unit (₹/kWh)"
            type="number"
            step="0.1"
            value={ratePerUnit}
            onChange={(e) => setRatePerUnit(e.target.value)}
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

        {/* Live Calculation Preview Banner */}
        <div className="p-3.5 rounded-xl bg-surface-container/80 border border-border-subtle text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted">Units Consumed:</span>
            <span className="font-bold text-foreground">{unitsConsumed} kWh</span>
          </div>

          <div className="flex items-center justify-between border-t border-border-subtle pt-1.5">
            <span className="text-muted">Total Room Bill:</span>
            <span className="font-bold text-base text-primary">
              {formatCurrency(totalAmount)}
            </span>
          </div>

          {/* Active Occupants Split */}
          <div className="border-t border-border-subtle pt-2 space-y-1.5">
            <div className="flex items-center gap-1.5 text-muted font-medium">
              <Users className="w-3.5 h-3.5" />
              <span>Split among {activeOccupants.length} active occupant(s):</span>
            </div>

            {activeOccupants.length === 0 ? (
              <p className="text-[11px] text-muted italic">
                Room is currently vacant. Bill will be recorded under room history.
              </p>
            ) : (
              <div className="space-y-1 pt-1">
                {activeOccupants.map((occ) => (
                  <div
                    key={occ.tenancyId}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-surface/70 border border-border-subtle"
                  >
                    <span className="font-semibold text-foreground">
                      {occ.tenantName} ({occ.bedLabel})
                    </span>
                    <span className="font-bold text-status-pending">
                      {formatCurrency(perTenantShare)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            Save Reading & Calculate Split
          </Button>
        </div>
      </form>
    </Modal>
  );
}
