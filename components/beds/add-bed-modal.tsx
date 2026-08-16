'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

interface AddBedModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  onSuccess: () => void;
}

export function AddBedModal({ isOpen, onClose, roomId, onSuccess }: AddBedModalProps) {
  const [bedLabel, setBedLabel] = useState('');
  const [defaultRate, setDefaultRate] = useState('6000');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bedLabel.trim()) {
      setError('Please enter a bed label.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase.from('beds').insert({
        room_id: roomId,
        bed_label: bedLabel.trim(),
        default_rate: parseFloat(defaultRate) || 0,
      });

      if (insertError) throw insertError;

      setBedLabel('');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add bed';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Bed" maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-status-pending/15 border border-status-pending/30 text-status-pending text-xs font-medium">
            {error}
          </div>
        )}

        <Input
          label="Bed Label"
          placeholder="e.g. Bed A, Bed B, Single"
          value={bedLabel}
          onChange={(e) => setBedLabel(e.target.value)}
          required
          autoFocus
        />

        <Input
          label="Default Monthly Rate (₹)"
          type="number"
          placeholder="6000"
          value={defaultRate}
          onChange={(e) => setDefaultRate(e.target.value)}
          required
        />

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            Add Bed
          </Button>
        </div>
      </form>
    </Modal>
  );
}
