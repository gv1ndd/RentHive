'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { AdvanceBooking } from '@/types/domain';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface ConvertBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: AdvanceBooking | null;
  onSuccess: () => void;
}

interface RoomWithVacantBeds {
  id: string;
  room_number: string;
  beds: Array<{
    id: string;
    bed_label: string;
    default_rate: number;
    deleted_at: string | null;
    tenancies?: any[];
  }>;
}

export function ConvertBookingModal({
  isOpen,
  onClose,
  booking,
  onSuccess,
}: ConvertBookingModalProps) {
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [rate, setRate] = useState('6000');
  const [dueDay, setDueDay] = useState('1');
  const [checkInDate, setCheckInDate] = useState(formatDate(new Date()));
  const [firstMonthFree, setFirstMonthFree] = useState(false);
  const [rooms, setRooms] = useState<RoomWithVacantBeds[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (booking && isOpen) {
      setRate(String(booking.total_amount || 6000));
      setCheckInDate(booking.expected_move_in_date || formatDate(new Date()));
      setSelectedRoomId(booking.room_id || '');
      setSelectedBedId(booking.bed_id || '');
      setError(null);

      const fetchRoomsAndBeds = async () => {
        const { data } = await supabase
          .from('rooms')
          .select(`
            id,
            room_number,
            beds (
              id,
              bed_label,
              default_rate,
              deleted_at,
              tenancies (
                id,
                check_out_date,
                deleted_at
              )
            )
          `)
          .eq('building_id', booking.building_id)
          .is('deleted_at', null)
          .order('room_number', { ascending: true });

        if (data) {
          setRooms(data as unknown as RoomWithVacantBeds[]);
        }
      };
      fetchRoomsAndBeds();
    }
  }, [booking, isOpen, supabase]);

  const activeRoom = rooms.find((r) => r.id === selectedRoomId);
  const availableBeds = (activeRoom?.beds || []).filter((b) => {
    if (b.deleted_at) return false;
    const hasActiveTenancy = (b.tenancies || []).some(
      (t) => !t.check_out_date && !t.deleted_at
    );
    return !hasActiveTenancy || b.id === booking?.bed_id;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;

    if (!selectedBedId) {
      setError('Please select a bed to allocate to this tenant.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call atomic convert_advance_booking RPC
      const { data, error: rpcError } = await supabase.rpc('convert_advance_booking', {
        p_booking_id: booking.id,
        p_bed_id: selectedBedId,
        p_rate: parseFloat(rate) || 0,
        p_due_day: parseInt(dueDay, 10) || 1,
        p_first_month_free: firstMonthFree,
        p_check_in_date: checkInDate,
      });

      if (rpcError) {
        if (rpcError.message.includes('BED_OCCUPIED')) {
          throw new Error('This bed is already occupied by an active tenancy.');
        }
        if (rpcError.message.includes('ALREADY_CONVERTED')) {
          throw new Error('This booking has already been converted.');
        }
        throw rpcError;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Conversion failed';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!booking) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Convert Advance Booking to Tenancy"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-status-pending/15 border border-status-pending/30 text-status-pending text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tenant Summary Banner */}
        <div className="p-3.5 rounded-xl bg-surface-container/60 border border-border-subtle text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground text-sm">{booking.tenant_name}</span>
            <span className="text-muted">{booking.tenant_phone || 'No phone'}</span>
          </div>
          <div className="flex items-center gap-2 text-status-vacant font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              Prepaid Advance Credit: {formatCurrency(Number(booking.paid_amount))}
            </span>
          </div>
          <p className="text-[11px] text-muted">
            This prepaid amount will be automatically recorded as a rent payment against the first cycle.
          </p>
        </div>

        {/* Room and Bed Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Select Room"
            value={selectedRoomId}
            onChange={(e) => {
              setSelectedRoomId(e.target.value);
              setSelectedBedId('');
            }}
            required
          >
            <option value="">Choose Room...</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                Room {r.room_number}
              </option>
            ))}
          </Select>

          <Select
            label="Select Bed"
            value={selectedBedId}
            onChange={(e) => setSelectedBedId(e.target.value)}
            disabled={!selectedRoomId || availableBeds.length === 0}
            required
          >
            <option value="">Choose Bed...</option>
            {availableBeds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bed_label} ({formatCurrency(Number(b.default_rate))}/mo)
              </option>
            ))}
          </Select>
        </div>

        {/* Rate, Due Day, Check-In Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Monthly Rent (₹)"
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            required
          />

          <Select
            label="Rent Due Day"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            options={Array.from({ length: 31 }, (_, i) => ({
              value: i + 1,
              label: `Day ${i + 1}`,
            }))}
          />

          <Input
            label="Check-In Date"
            type="date"
            value={checkInDate}
            onChange={(e) => setCheckInDate(e.target.value)}
            required
          />
        </div>

        {/* First Month Free */}
        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container border border-border-subtle text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={firstMonthFree}
            onChange={(e) => setFirstMonthFree(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary w-4 h-4"
          />
          <div>
            <span className="font-semibold text-foreground">First Month Free</span>
            <p className="text-muted text-[11px]">
              Waives first cycle rent (utilities remain billable).
            </p>
          </div>
        </label>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            Convert & Check In
          </Button>
        </div>
      </form>
    </Modal>
  );
}
