'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildingId: string;
  onSuccess: () => void;
}

export function AddRoomModal({ isOpen, onClose, buildingId, onSuccess }: AddRoomModalProps) {
  const [roomNumber, setRoomNumber] = useState('');
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
      // 1. Insert Room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          building_id: buildingId,
          room_number: roomNumber.trim(),
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
        if (bedsError) console.error('Error generating beds:', bedsError);
      }

      // 3. Insert Meter if provided
      if (meterNumber.trim() && room) {
        await supabase.from('meters').insert({
          room_id: room.id,
          meter_number: meterNumber.trim(),
          rate_per_unit: 10.0,
        });
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
              { value: 0, label: 'Ground Floor (0)' },
              { value: 1, label: '1st Floor' },
              { value: 2, label: '2nd Floor' },
              { value: 3, label: '3rd Floor' },
              { value: 4, label: '4th Floor' },
              { value: 5, label: '5th Floor' },
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
