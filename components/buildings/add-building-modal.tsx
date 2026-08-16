'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Building } from '@/types/domain';

interface AddBuildingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newBuilding: Building) => void;
}

export function AddBuildingModal({ isOpen, onClose, onSuccess }: AddBuildingModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a building name.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('User not authenticated');

      const { data, error: insertError } = await supabase
        .from('buildings')
        .insert({
          owner_id: user.id,
          name: name.trim(),
          address: address.trim() || null,
        })
        .select('*')
        .single();

      if (insertError) throw insertError;

      setName('');
      setAddress('');
      onSuccess(data as Building);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add building';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Property" maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-status-pending/15 border border-status-pending/30 text-status-pending text-xs font-medium">
            {error}
          </div>
        )}

        <Input
          label="Property / Building Name"
          placeholder="e.g. Hive Residency, Block A"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />

        <Input
          label="Address / Location (Optional)"
          placeholder="e.g. 12th Main, Indiranagar"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            Add Building
          </Button>
        </div>
      </form>
    </Modal>
  );
}
