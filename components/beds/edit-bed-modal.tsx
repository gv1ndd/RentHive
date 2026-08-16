'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Bed } from '@/types/domain';

interface EditBedModalProps {
  isOpen: boolean;
  onClose: () => void;
  bed: Bed | null;
  onSuccess: () => void;
}

export function EditBedModal({ isOpen, onClose, bed, onSuccess }: EditBedModalProps) {
  const [bedLabel, setBedLabel] = useState('');
  const [defaultRate, setDefaultRate] = useState('6000');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (bed) {
      setBedLabel(bed.bed_label);
      setDefaultRate(String(bed.default_rate));
      setError(null);
    }
  }, [bed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bed || !bedLabel.trim()) {
      setError('Please enter a bed label.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('beds')
        .update({
          bed_label: bedLabel.trim(),
          default_rate: parseFloat(defaultRate) || 0,
        })
        .eq('id', bed.id);

      if (updateError) throw updateError;

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update bed';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Bed Details" maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-status-pending/15 border border-status-pending/30 text-status-pending text-xs font-medium">
            {error}
          </div>
        )}

        <Input
          label="Bed Label"
          value={bedLabel}
          onChange={(e) => setBedLabel(e.target.value)}
          required
          autoFocus
        />

        <Input
          label="Default Monthly Rate (₹)"
          type="number"
          value={defaultRate}
          onChange={(e) => setDefaultRate(e.target.value)}
          required
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
