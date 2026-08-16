'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Building } from '@/types/domain';

interface EditBuildingModalProps {
  isOpen: boolean;
  onClose: () => void;
  building: Building | null;
  onSuccess: (updated: Building) => void;
}

export function EditBuildingModal({
  isOpen,
  onClose,
  building,
  onSuccess,
}: EditBuildingModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (building) {
      setName(building.name);
      setAddress(building.address || '');
      setError(null);
    }
  }, [building]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!building || !name.trim()) {
      setError('Please enter a building name.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: updateError } = await supabase
        .from('buildings')
        .update({
          name: name.trim(),
          address: address.trim() || null,
        })
        .eq('id', building.id)
        .select('*')
        .single();

      if (updateError) throw updateError;

      onSuccess(data as Building);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update building';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Property" maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-status-pending/15 border border-status-pending/30 text-status-pending text-xs font-medium">
            {error}
          </div>
        )}

        <Input
          label="Property / Building Name"
          placeholder="Building Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />

        <Input
          label="Address / Location (Optional)"
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
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
