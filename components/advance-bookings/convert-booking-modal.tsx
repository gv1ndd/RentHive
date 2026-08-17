'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { AdvanceBooking } from '@/types/domain';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate, getBillingCycleStartDate } from '@/lib/utils/dates';
import { calculatePendingRent } from '@/lib/calculations/rent-calculator';
import { CheckCircle2, AlertCircle, Calculator } from 'lucide-react';

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

  // Live Proration Preview Calculation (with advance token deduction)
  const prorationPreview = React.useMemo(() => {
    const numRate = parseFloat(rate) || 0;
    const numDueDay = parseInt(dueDay, 10) || 1;
    if (!checkInDate || numRate <= 0) return null;

    try {
      const advancePaid = Number(booking?.paid_amount) || 0;
      const result = calculatePendingRent({
        rate: numRate,
        checkInDate,
        dueDay: numDueDay,
        payments: (advancePaid > 0 ? [{
          id: 'advance-preview',
          tenancy_id: 'preview',
          amount: advancePaid,
          type: 'rent' as const,
          date: checkInDate,
          deleted_at: null,
        }] : []) as any[],
        asOfDate: checkInDate,
      });

      const checkInRaw = new Date(checkInDate);
      const checkIn = new Date(checkInRaw.getFullYear(), checkInRaw.getMonth(), checkInRaw.getDate());

      let curY = checkIn.getFullYear();
      let curM = checkIn.getMonth() + 1;
      const thisMonthCycleStart = getBillingCycleStartDate(curY, curM, numDueDay);
      if (checkIn.getTime() < thisMonthCycleStart.getTime()) {
        curM--;
        if (curM < 1) {
          curM = 12;
          curY--;
        }
      }

      const cycleStart = getBillingCycleStartDate(curY, curM, numDueDay);
      let nextM = curM + 1;
      let nextY = curY;
      if (nextM > 12) {
        nextM = 1;
        nextY++;
      }
      const nextCycleStart = getBillingCycleStartDate(nextY, nextM, numDueDay);

      const msPerDay = 1000 * 60 * 60 * 24;
      const totalDaysInCycle = Math.round((nextCycleStart.getTime() - cycleStart.getTime()) / msPerDay);
      const daysOccupied = Math.round((nextCycleStart.getTime() - checkIn.getTime()) / msPerDay);
      const dailyRate = Math.round((numRate / Math.max(1, totalDaysInCycle)) * 100) / 100;

      return {
        grossRent: result.totalCharged,
        advancePaid,
        netDue: result.pendingBalance,
        daysOccupied,
        totalDaysInCycle,
        dailyRate,
        nextDueDate: nextCycleStart,
      };
    } catch {
      return null;
    }
  }, [rate, dueDay, checkInDate, booking]);

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
        p_first_month_free: false,
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
            options={rooms.map((r) => ({
              value: r.id,
              label: `Room ${r.room_number}`,
            }))}
            required
          />

          <Select
            label="Select Bed"
            value={selectedBedId}
            onChange={(e) => {
              setSelectedBedId(e.target.value);
              const room = rooms.find((r) => r.id === selectedRoomId);
              const bed = room?.beds.find((b) => b.id === e.target.value);
              if (bed) {
                setRate(String(bed.default_rate || rate));
              }
            }}
            options={availableBeds.map((b) => ({
              value: b.id,
              label: `${b.bed_label} (₹${b.default_rate}/mo)`,
            }))}
            required
            disabled={!selectedRoomId}
          />
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

        {/* Live Proration & Advance Token Preview Card */}
        {prorationPreview && (
          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-primary" />
                <span>Calculated Entry Settlement</span>
              </span>
              <span className="text-sm font-bold text-primary">
                {formatCurrency(prorationPreview.netDue)} Net Due at Check-In
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-muted pt-1 border-t border-border-subtle/50">
              <div>
                <span>Gross Entry Rent:</span>
                <span className="font-medium text-foreground ml-1">{formatCurrency(prorationPreview.grossRent)}</span>
              </div>
              <div>
                <span>Prepaid Advance Token:</span>
                <span className="font-medium text-status-vacant ml-1">−{formatCurrency(prorationPreview.advancePaid)}</span>
              </div>
              <div>
                <span>Days Occupied:</span>
                <span className="font-medium text-foreground ml-1">{prorationPreview.daysOccupied} of {prorationPreview.totalDaysInCycle} days</span>
              </div>
            </div>
          </div>
        )}

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
