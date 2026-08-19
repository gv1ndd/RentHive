'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils/dates';
import { parseRoomDisplay } from '@/lib/utils/room-helper';

interface AddBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildingId: string;
  onSuccess: () => void;
}

interface RoomOption {
  id: string;
  room_number: string;
  beds: Array<{
    id: string;
    bed_label: string;
    default_rate: number;
    deleted_at: string | null;
    tenancies?: Array<{
      id: string;
      check_out_date: string | null;
      deleted_at: string | null;
      expected_move_out_date: string | null;
      notice_given_date: string | null;
    }>;
  }>;
}

export function AddBookingModal({
  isOpen,
  onClose,
  buildingId,
  onSuccess,
}: AddBookingModalProps) {
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [totalAmount, setTotalAmount] = useState('6000');
  const [paidAmount, setPaidAmount] = useState('1000');
  const [expectedMoveInDate, setExpectedMoveInDate] = useState(formatDate(new Date()));
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen && buildingId) {
      const fetchRooms = async () => {
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
                deleted_at,
                expected_move_out_date,
                notice_given_date
              )
            )
          `)
          .eq('building_id', buildingId)
          .is('deleted_at', null)
          .order('room_number', { ascending: true });

        if (data) {
          setRooms(data as unknown as RoomOption[]);
        }
      };
      fetchRooms();
      setExpectedMoveInDate(formatDate(new Date()));
      setError(null);
    }
  }, [isOpen, buildingId, supabase]);

  const activeRoom = rooms.find((r) => r.id === selectedRoomId);
  const activeBeds = (activeRoom?.beds || []).filter((b) => !b.deleted_at);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim()) {
      setError('Please enter tenant name.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('User not authenticated');

      const { error: insertError } = await supabase.from('advance_bookings').insert({
        owner_id: user.id,
        building_id: buildingId,
        room_id: selectedRoomId || null,
        bed_id: selectedBedId || null,
        tenant_name: tenantName.trim(),
        tenant_phone: tenantPhone.trim() || null,
        total_amount: parseFloat(totalAmount) || 0,
        paid_amount: parseFloat(paidAmount) || 0,
        expected_move_in_date: expectedMoveInDate,
        status: 'pending',
      });

      if (insertError) throw insertError;

      setTenantName('');
      setTenantPhone('');
      setSelectedRoomId('');
      setSelectedBedId('');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create booking';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Advance Booking" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-status-pending/15 border border-status-pending/30 text-status-pending text-xs font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Prospective Tenant Name"
            placeholder="e.g. Amit Kumar"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Phone Number"
            placeholder="e.g. 9876543210"
            value={tenantPhone}
            onChange={(e) => setTenantPhone(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Agreed Monthly Rent (₹)"
            type="number"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            required
          />

          <Input
            label="Advance Token Paid (₹)"
            type="number"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            required
          />

          <Input
            label="Expected Move-In Date"
            type="date"
            value={expectedMoveInDate}
            onChange={(e) => setExpectedMoveInDate(e.target.value)}
            required
          />
        </div>

        {/* Optional Room & Bed Reservation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-container/50 rounded-xl border border-border-subtle">
          <Select
            label="Reserve Room (Optional)"
            value={selectedRoomId}
            onChange={(e) => {
              setSelectedRoomId(e.target.value);
              setSelectedBedId('');
            }}
          >
            <option value="">No Room Assigned (General Booking)</option>
            {rooms.map((r) => {
              const parsed = parseRoomDisplay(r.room_number);
              return (
                <option key={r.id} value={r.id}>
                  Room {parsed.cleanRoomNumber} {parsed.isBalcony ? '🌿 (Balcony)' : ''}
                </option>
              );
            })}
          </Select>

          <Select
            label="Reserve Bed (Optional)"
            value={selectedBedId}
            onChange={(e) => setSelectedBedId(e.target.value)}
            disabled={!selectedRoomId || activeBeds.length === 0}
          >
            <option value="">No Bed Assigned</option>
            {activeBeds.map((b) => {
              const activeTenancy = (b.tenancies || []).find((t) => !t.check_out_date && !t.deleted_at);
              let statusLabel = 'Vacant';
              if (activeTenancy) {
                if (activeTenancy.expected_move_out_date || activeTenancy.notice_given_date) {
                  statusLabel = 'Notice Given';
                } else {
                  statusLabel = 'Occupied';
                }
              }
              return (
                <option key={b.id} value={b.id}>
                  {b.bed_label} (₹{Number(b.default_rate)}/mo · {statusLabel})
                </option>
              );
            })}
          </Select>
        </div>

        <p className="text-[11px] text-muted">
          Assigning a bed marks it with the <span className="font-bold text-status-reserved">Reserved</span> status badge on bed grids.
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            Save Advance Booking
          </Button>
        </div>
      </form>
    </Modal>
  );
}
