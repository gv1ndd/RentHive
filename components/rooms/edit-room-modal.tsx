'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Room } from '@/types/domain';
import { parseRoomDisplay, formatRoomNumber } from '@/lib/utils/room-helper';

interface EditRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  onSuccess: () => void;
}

export function EditRoomModal({ isOpen, onClose, room, onSuccess }: EditRoomModalProps) {
  const [roomNumber, setRoomNumber] = useState('');
  const [isBalcony, setIsBalcony] = useState(false);
  const [floorNumber, setFloorNumber] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (room) {
      const parsed = parseRoomDisplay(room.room_number);
      setRoomNumber(parsed.cleanRoomNumber);
      setIsBalcony(parsed.isBalcony);
      setFloorNumber(String(room.floor_number));
      setError(null);
    }
  }, [room]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || !roomNumber.trim()) {
      setError('Please enter a room number.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const cleanInput = parseRoomDisplay(roomNumber).cleanRoomNumber.toLowerCase();
      const fullRoomNumber = formatRoomNumber(roomNumber, isBalcony);

      // Check for duplicate room in this property (excluding this room)
      const { data: existingRooms, error: checkError } = await supabase
        .from('rooms')
        .select('id, room_number')
        .eq('building_id', room.building_id)
        .neq('id', room.id)
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

      const { error: updateError } = await supabase
        .from('rooms')
        .update({
          room_number: fullRoomNumber,
          floor_number: parseInt(floorNumber, 10) || 0,
        })
        .eq('id', room.id);

      if (updateError) throw updateError;

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update room';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Room Details" maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-status-pending/15 border border-status-pending/30 text-status-pending text-xs font-medium">
            {error}
          </div>
        )}

        <Input
          label="Room Number"
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
