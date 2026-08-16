'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Room } from '@/types/domain';

interface EditRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  onSuccess: () => void;
}

export function EditRoomModal({ isOpen, onClose, room, onSuccess }: EditRoomModalProps) {
  const [roomNumber, setRoomNumber] = useState('');
  const [floorNumber, setFloorNumber] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (room) {
      setRoomNumber(room.room_number);
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
      const { error: updateError } = await supabase
        .from('rooms')
        .update({
          room_number: roomNumber.trim(),
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
            { value: 0, label: 'Ground Floor (0)' },
            { value: 1, label: '1st Floor' },
            { value: 2, label: '2nd Floor' },
            { value: 3, label: '3rd Floor' },
            { value: 4, label: '4th Floor' },
            { value: 5, label: '5th Floor' },
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
