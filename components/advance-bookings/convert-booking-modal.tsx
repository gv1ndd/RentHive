'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { AdvanceBooking, Tenancy, Tenant } from '@/types/domain';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate, getBillingCycleStartDate } from '@/lib/utils/dates';
import { parseRoomDisplay } from '@/lib/utils/room-helper';
import { calculatePendingRent } from '@/lib/calculations/rent-calculator';
import { CheckoutTenantModal } from '@/components/tenants/checkout-tenant-modal';
import { CheckCircle2, AlertCircle, Calculator, CreditCard, X, UserX } from 'lucide-react';

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
    tenancies?: Array<{
      id: string;
      check_in_date: string;
      check_out_date: string | null;
      expected_move_out_date: string | null;
      notice_given_date: string | null;
      rate: number;
      due_day: number;
      deleted_at: string | null;
      tenants?: Tenant | null;
    }>;
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

  // Optional on-the-spot payment recording
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  // Conflict resolution / Force checkout modal state
  const [forceCheckoutTenancy, setForceCheckoutTenancy] = useState<any | null>(null);
  const [forceCheckoutPendingDues, setForceCheckoutPendingDues] = useState<number>(0);

  const supabase = createClient();

  const fetchRoomsAndBeds = useCallback(async () => {
    if (!booking) return;

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
            check_in_date,
            check_out_date,
            expected_move_out_date,
            notice_given_date,
            rate,
            due_day,
            deleted_at,
            tenants (
              id,
              name,
              phone
            )
          )
        )
      `)
      .eq('building_id', booking.building_id)
      .is('deleted_at', null)
      .order('room_number', { ascending: true });

    if (data && data.length > 0) {
      const roomList = data as unknown as RoomWithVacantBeds[];
      setRooms(roomList);

      // Select initial room
      const initialRoom =
        (selectedRoomId && roomList.find((r) => r.id === selectedRoomId)) ||
        (booking.room_id && roomList.find((r) => r.id === booking.room_id)) ||
        roomList[0];

      setSelectedRoomId(initialRoom.id);

      // Beds in this room
      const roomBeds = (initialRoom.beds || []).filter((b) => !b.deleted_at);

      // Filter available beds for this room (vacant beds, or the reserved bed)
      const vacantBeds = roomBeds.filter((b) => {
        const hasActive = (b.tenancies || []).some(
          (t) => !t.check_out_date && !t.deleted_at
        );
        return !hasActive || b.id === booking.bed_id;
      });

      // Select initial bed
      const initialBed =
        (selectedBedId && roomBeds.find((b) => b.id === selectedBedId)) ||
        (booking.bed_id && roomBeds.find((b) => b.id === booking.bed_id)) ||
        vacantBeds[0] ||
        roomBeds[0];

      if (initialBed) {
        setSelectedBedId(initialBed.id);
        if (!booking.total_amount && initialBed.default_rate) {
          setRate(String(initialBed.default_rate));
        }
      } else {
        setSelectedBedId('');
      }
    }
  }, [booking, selectedRoomId, selectedBedId, supabase]);

  useEffect(() => {
    if (booking && isOpen) {
      setRate(String(booking.total_amount || 6000));
      setCheckInDate(booking.expected_move_in_date || formatDate(new Date()));
      setSelectedRoomId(booking.room_id || '');
      setSelectedBedId(booking.bed_id || '');
      setIsRecordingPayment(false);
      setPaymentAmount('');
      setPaymentMethod('Cash');
      setForceCheckoutTenancy(null);
      setError(null);

      fetchRoomsAndBeds();
    }
  }, [booking, isOpen, fetchRoomsAndBeds]);

  const activeRoom = rooms.find((r) => r.id === selectedRoomId);
  const activeBeds = (activeRoom?.beds || []).filter((b) => !b.deleted_at);

  const selectedBed = activeBeds.find((b) => b.id === selectedBedId);
  const activeOccupantTenancy = (selectedBed?.tenancies || []).find(
    (t) => !t.check_out_date && !t.deleted_at
  );

  const handleRoomChange = (newRoomId: string) => {
    setSelectedRoomId(newRoomId);
    const room = rooms.find((r) => r.id === newRoomId);
    const roomBeds = (room?.beds || []).filter((b) => !b.deleted_at);
    const vacantBeds = roomBeds.filter((b) => {
      const hasActive = (b.tenancies || []).some(
        (t) => !t.check_out_date && !t.deleted_at
      );
      return !hasActive || b.id === booking?.bed_id;
    });

    if (vacantBeds.length > 0) {
      setSelectedBedId(vacantBeds[0].id);
      if (!booking?.total_amount && vacantBeds[0].default_rate) {
        setRate(String(vacantBeds[0].default_rate));
      }
    } else if (roomBeds.length > 0) {
      setSelectedBedId(roomBeds[0].id);
    } else {
      setSelectedBedId('');
    }
  };

  const handleBedChange = (newBedId: string) => {
    setSelectedBedId(newBedId);
    const room = rooms.find((r) => r.id === selectedRoomId);
    const bed = room?.beds.find((b) => b.id === newBedId);
    if (bed && !booking?.total_amount && bed.default_rate) {
      setRate(String(bed.default_rate));
    }
  };

  const handleInitiateForceCheckout = async (tenancy: any) => {
    // Calculate pending dues for outgoing tenant
    try {
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('tenancy_id', tenancy.id)
        .is('deleted_at', null);

      const result = calculatePendingRent({
        rate: Number(tenancy.rate),
        checkInDate: tenancy.check_in_date,
        checkOutDate: tenancy.check_out_date,
        dueDay: tenancy.due_day || 1,
        payments: (paymentsData || []) as any[],
        asOfDate: new Date(),
      });

      setForceCheckoutPendingDues(result.pendingBalance);
      setForceCheckoutTenancy(tenancy);
    } catch {
      setForceCheckoutPendingDues(0);
      setForceCheckoutTenancy(tenancy);
    }
  };

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

    if (activeOccupantTenancy) {
      setError(
        `This bed is currently occupied by ${
          activeOccupantTenancy.tenants?.name || 'an active tenant'
        }. Please click "Force Checkout Now" to check out the current occupant before checking in the new tenant.`
      );
      return;
    }

    if (isRecordingPayment && (!paymentAmount || parseFloat(paymentAmount) <= 0)) {
      setError('Please enter a valid payment amount, or cancel recording payment.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Call atomic convert_advance_booking RPC
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
          throw new Error(
            'This bed is already occupied by an active tenancy. Please check out the current occupant first.'
          );
        }
        if (rpcError.message.includes('ALREADY_CONVERTED')) {
          throw new Error('This booking has already been converted.');
        }
        throw rpcError;
      }

      const res = data as { tenancy_id?: string } | null;
      const tenancyId = res?.tenancy_id;

      // 2. If landlord chose to record settlement payment on the spot:
      if (isRecordingPayment && tenancyId && parseFloat(paymentAmount) > 0) {
        const { error: pErr } = await supabase.from('payments').insert({
          tenancy_id: tenancyId,
          amount: parseFloat(paymentAmount),
          type: 'rent' as const,
          date: checkInDate,
          method: paymentMethod,
          receipt_number: `SETTLE-CHECKIN-${Date.now().toString().slice(-4)}`,
        });

        if (pErr) {
          console.error('Error inserting check-in payment:', pErr);
        }
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
            onChange={(e) => handleRoomChange(e.target.value)}
            options={rooms.map((r) => {
              const parsed = parseRoomDisplay(r.room_number);
              return {
                value: r.id,
                label: `Room ${parsed.cleanRoomNumber}${parsed.isBalcony ? ' 🌿 (Balcony)' : ''}`,
              };
            })}
            required
          />

          <Select
            label="Select Bed"
            value={selectedBedId}
            onChange={(e) => handleBedChange(e.target.value)}
            options={
              activeBeds.length > 0
                ? activeBeds.map((b) => {
                    const activeTenancy = (b.tenancies || []).find(
                      (t) => !t.check_out_date && !t.deleted_at
                    );
                    const isOccupied = Boolean(activeTenancy);
                    const occupantName = activeTenancy?.tenants?.name;
                    return {
                      value: b.id,
                      label: isOccupied
                        ? `${b.bed_label} (Occupied by ${occupantName || 'Tenant'})`
                        : `${b.bed_label} (₹${b.default_rate}/mo - Vacant)`,
                    };
                  })
                : [{ value: '', label: 'No beds in this room' }]
            }
            required
            disabled={!selectedRoomId || activeBeds.length === 0}
          />
        </div>

        {/* Active Occupant Bed Conflict Banner */}
        {activeOccupantTenancy && (
          <div className="p-3.5 rounded-xl bg-status-moving-out/15 border border-status-moving-out/30 space-y-2.5 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-status-moving-out font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Bed Conflict: Current Occupant Still Active</span>
                </div>
                <p className="text-muted leading-relaxed">
                  <strong className="text-foreground">
                    {activeOccupantTenancy.tenants?.name || 'Current occupant'}
                  </strong>{' '}
                  is currently occupying this bed
                  {activeOccupantTenancy.expected_move_out_date
                    ? ` (scheduled move-out: ${formatDate(
                        activeOccupantTenancy.expected_move_out_date
                      )})`
                    : ''}
                  . You must check out the current occupant before checking in {booking.tenant_name}.
                </p>
              </div>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => handleInitiateForceCheckout(activeOccupantTenancy)}
                leftIcon={<UserX className="w-3.5 h-3.5" />}
                className="shrink-0 w-full sm:w-auto"
              >
                Force Checkout Now
              </Button>
            </div>
          </div>
        )}

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

            {/* Optional On-the-spot Settlement Payment */}
            {prorationPreview.netDue > 0 && (
              <div className="pt-2 border-t border-border-subtle/50">
                {!isRecordingPayment ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsRecordingPayment(true);
                      setPaymentAmount(String(prorationPreview.netDue));
                    }}
                    leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                    className="w-full justify-center bg-surface/50 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    Record Payment Now ({formatCurrency(prorationPreview.netDue)})
                  </Button>
                ) : (
                  <div className="p-2.5 rounded-xl bg-surface border border-border-subtle space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-primary" />
                        <span>Record Check-In Payment</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsRecordingPayment(false)}
                        className="p-1 text-muted hover:text-foreground rounded cursor-pointer"
                        title="Cancel recording payment"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <Input
                        label="Amount Received (₹)"
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        required={isRecordingPayment}
                      />
                      <Select
                        label="Payment Method"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        options={[
                          { value: 'Cash', label: 'Cash' },
                          { value: 'UPI', label: 'UPI / GPay / PhonePe' },
                          { value: 'Bank Transfer', label: 'Bank Transfer / IMPS' },
                          { value: 'Card', label: 'Debit / Credit Card' },
                        ]}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isLoading}
            disabled={Boolean(activeOccupantTenancy)}
          >
            Convert & Check In
          </Button>
        </div>
      </form>

      {/* Force Checkout Modal */}
      {forceCheckoutTenancy && (
        <CheckoutTenantModal
          isOpen={Boolean(forceCheckoutTenancy)}
          onClose={() => setForceCheckoutTenancy(null)}
          tenancy={forceCheckoutTenancy}
          tenantName={forceCheckoutTenancy.tenants?.name || 'Current Occupant'}
          roomInfo={`${selectedBed?.bed_label || 'Bed'}`}
          pendingBalance={forceCheckoutPendingDues}
          onSuccess={async () => {
            setForceCheckoutTenancy(null);
            await fetchRoomsAndBeds();
          }}
        />
      )}
    </Modal>
  );
}
