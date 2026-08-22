'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { formatRoomNumber, parseRoomDisplay } from '@/lib/utils/room-helper';

interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildingId: string;
  onSuccess: () => void;
}

export function AddRoomModal({ isOpen, onClose, buildingId, onSuccess }: AddRoomModalProps) {
  const [roomNumber, setRoomNumber] = useState('');
  const [isBalcony, setIsBalcony] = useState(false);
  const [floorNumber, setFloorNumber] = useState('0');
  const [bedCount, setBedCount] = useState('2');
  const [defaultRate, setDefaultRate] = useState('6000');
  const [meterNumber, setMeterNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber.trim()) {
      setError('Please enter a room number.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const cleanInput = parseRoomDisplay(roomNumber).cleanRoomNumber.toLowerCase();
      const fullRoomNumber = formatRoomNumber(roomNumber, isBalcony);

      // Check for existing room with same number in this property
      const { data: existingRooms, error: checkError } = await supabase
        .from('rooms')
        .select('id, room_number')
        .eq('building_id', buildingId)
        .is('deleted_at', null);

      if (checkError) throw checkError;

      const duplicate = (existingRooms || []).find((r) => {
        const existingClean = parseRoomDisplay(r.room_number).cleanRoomNumber.toLowerCase();
        return existingClean === cleanInput;
      });

      if (duplicate) {
        setError(`Room "${duplicate.room_number}" already exists in this property. Please choose a different room number.`);
        setIsLoading(false);
        return;
      }

      // 1. Insert Room (with balcony tag if selected)
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          building_id: buildingId,
          room_number: fullRoomNumber,
          floor_number: parseInt(floorNumber, 10) || 0,
        })
        .select('*')
        .single();

      if (roomError) throw roomError;

      // 2. Generate initial beds (Bed A, Bed B, etc.)
      const count = parseInt(bedCount, 10) || 0;
      const rate = parseFloat(defaultRate) || 0;

      if (count > 0 && room) {
        const bedLabels = ['Bed A', 'Bed B', 'Bed C', 'Bed D', 'Bed E', 'Bed F', 'Bed G', 'Bed H'];
        const bedsToInsert = Array.from({ length: count }, (_, i) => ({
          room_id: room.id,
          bed_label: bedLabels[i] || `Bed ${i + 1}`,
          default_rate: rate,
        }));

        const { error: bedsError } = await supabase.from('beds').insert(bedsToInsert);
        if (bedsError) throw bedsError;
      }

      // 3. Insert Meter if provided
      if (meterNumber.trim() && room) {
        const { error: meterError } = await supabase.from('meters').insert({
          room_id: room.id,
          meter_number: meterNumber.trim(),
          rate_per_unit: 10.0,
        });
        if (meterError) throw meterError;
      }

      setRoomNumber('');
      setFloorNumber('0');
      setMeterNumber('');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add room';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Room" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-status-pending/15 border border-status-pending/30 text-status-pending text-xs font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Room Number"
            placeholder="e.g. 101, 204"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            required
            autoFocus
          />

          <Select
            label="Floor Number"
            value={floorNumber}
            onChange={(e) => setFloorNumber(e.target.value)}
            options={[
              { value: -2, label: 'Basement 2 (-2)' },
              { value: -1, label: 'Basement 1 (-1)' },
              { value: 0, label: 'Ground Floor (0)' },
              { value: 1, label: '1st Floor' },
              { value: 2, label: '2nd Floor' },
              { value: 3, label: '3rd Floor' },
              { value: 4, label: '4th Floor' },
              { value: 5, label: '5th Floor' },
              { value: 6, label: '6th Floor' },
              { value: 7, label: '7th Floor' },
              { value: 8, label: '8th Floor' },
              { value: 9, label: '9th Floor' },
              { value: 10, label: '10th Floor' },
              { value: 11, label: '11th Floor' },
              { value: 12, label: '12th Floor' },
              { value: 13, label: '13th Floor' },
              { value: 14, label: '14th Floor' },
              { value: 15, label: '15th Floor' },
              { value: 16, label: '16th Floor' },
              { value: 17, label: '17th Floor' },
              { value: 18, label: '18th Floor' },
              { value: 19, label: '19th Floor' },
              { value: 20, label: '20th Floor' },
            ]}
          />
          <Select
            label="Room Type / Feature"
            value={isBalcony ? 'balcony' : 'standard'}
            onChange={(e) => setIsBalcony(e.target.value === 'balcony')}
            options={[
              { value: 'standard', label: 'Standard Room (Non-Balcony)' },
              { value: 'balcony', label: '🌿 Balcony Room (Premium View / Higher Rate)' },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Initial Bed Count"
            value={bedCount}
            onChange={(e) => setBedCount(e.target.value)}
            options={[
              { value: 1, label: '1 Bed (Single Room)' },
              { value: 2, label: '2 Beds (Double Sharing)' },
              { value: 3, label: '3 Beds (Triple Sharing)' },
              { value: 4, label: '4 Beds (Four Sharing)' },
            ]}
          />

          <Input
            label="Default Monthly Rate per Bed (₹)"
            type="number"
            placeholder="6000"
            value={defaultRate}
            onChange={(e) => setDefaultRate(e.target.value)}
          />
        </div>

        <Input
          label="Electricity Sub-Meter Number (Optional)"
          placeholder="e.g. MTR-101"
          value={meterNumber}
          onChange={(e) => setMeterNumber(e.target.value)}
        />

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            Create Room
          </Button>
        </div>
      </form>
    </Modal>
  );
}
