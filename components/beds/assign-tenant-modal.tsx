'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Bed, Tenant } from '@/types/domain';
import { formatDate, getBillingCycleStartDate } from '@/lib/utils/dates';
import { formatCurrency } from '@/lib/utils/currency';
import { calculatePendingRent } from '@/lib/calculations/rent-calculator';
import { Calculator } from 'lucide-react';

interface AssignTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  bed: Bed | null;
  onSuccess: () => void;
}

export function AssignTenantModal({
  isOpen,
  onClose,
  bed,
  onSuccess,
}: AssignTenantModalProps) {
  const [tab, setTab] = useState<'new' | 'existing'>('new');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [existingTenants, setExistingTenants] = useState<Tenant[]>([]);
  const [rate, setRate] = useState('6000');
  const [dueDay, setDueDay] = useState('1');
  const [checkInDate, setCheckInDate] = useState(formatDate(new Date()));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (bed) {
      setRate(String(bed.default_rate || 6000));
      setCheckInDate(formatDate(new Date()));
      setError(null);
    }
  }, [bed]);

  useEffect(() => {
    if (isOpen && tab === 'existing') {
      const fetchExisting = async () => {
        const { data } = await supabase
          .from('tenants')
          .select('*')
          .is('deleted_at', null)
          .order('name', { ascending: true });

        if (data) {
          setExistingTenants(data as Tenant[]);
          if (data.length > 0) setSelectedTenantId(data[0].id);
        }
      };
      fetchExisting();
    }
  }, [isOpen, tab, supabase]);

  // Live Proration Preview Calculation
  const prorationPreview = React.useMemo(() => {
    const numRate = parseFloat(rate) || 0;
    const numDueDay = parseInt(dueDay, 10) || 1;
    if (!checkInDate || numRate <= 0) return null;

    try {
      const result = calculatePendingRent({
        rate: numRate,
        checkInDate,
        dueDay: numDueDay,
        payments: [],
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
        daysOccupied,
        totalDaysInCycle,
        dailyRate,
        nextDueDate: nextCycleStart,
        isFullCycle: daysOccupied === totalDaysInCycle,
      };
    } catch {
      return null;
    }
  }, [rate, dueDay, checkInDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bed) return;

    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('User not authenticated');

      let tenantId = selectedTenantId;

      if (tab === 'new') {
        if (!name.trim()) throw new Error('Please enter tenant name');

        const { data: newTenant, error: tenantErr } = await supabase
          .from('tenants')
          .insert({
            owner_id: user.id,
            name: name.trim(),
            phone: phone.trim() || null,
          })
          .select('*')
          .single();

        if (tenantErr) throw tenantErr;
        tenantId = newTenant.id;
      }

      if (!tenantId) throw new Error('Please select or enter a tenant');

      // Create tenancy
      const { error: tenancyErr } = await supabase.from('tenancies').insert({
        bed_id: bed.id,
        tenant_id: tenantId,
        rate: parseFloat(rate) || 0,
        due_day: parseInt(dueDay, 10) || 1,
        check_in_date: checkInDate,
      });

      if (tenancyErr) {
        if (tenancyErr.code === '23505') {
          throw new Error('This bed is already occupied by an active tenancy.');
        }
        throw tenancyErr;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to check in tenant';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Check In Tenant — ${bed?.bed_label || 'Bed'}`}
      maxWidth="md"
    >
      {/* Tab Switcher */}
      <div className="flex p-1 bg-surface-highest/80 rounded-xl border border-border-subtle text-xs font-medium mb-4">
        <button
          type="button"
          onClick={() => setTab('new')}
          className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
            tab === 'new'
              ? 'bg-surface text-foreground font-semibold shadow-xs'
              : 'text-muted hover:text-foreground'
          }`}
        >
          New Tenant
        </button>
        <button
          type="button"
          onClick={() => setTab('existing')}
          className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
            tab === 'existing'
              ? 'bg-surface text-foreground font-semibold shadow-xs'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Existing Tenant
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-status-pending/15 border border-status-pending/30 text-status-pending text-xs font-medium">
            {error}
          </div>
        )}

        {tab === 'new' ? (
          <>
            <Input
              label="Full Name"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            <Input
              label="Phone Number"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </>
        ) : (
          <Select
            label="Select Existing Tenant"
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            options={existingTenants.map((t) => ({
              value: t.id,
              label: `${t.name}${t.phone ? ` (${t.phone})` : ''}`,
            }))}
          />
        )}

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

        {/* Live Proration Preview Card */}
        {prorationPreview && (
          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-primary" />
                <span>Entry Period Proration</span>
              </span>
              <span className="text-sm font-bold text-primary">
                {formatCurrency(prorationPreview.grossRent)} Due at Check-in
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-muted pt-1 border-t border-border-subtle/50">
              <div>
                <span>Days in Entry Period:</span>
                <span className="font-medium text-foreground ml-1">{prorationPreview.daysOccupied} of {prorationPreview.totalDaysInCycle} days</span>
              </div>
              <div>
                <span>Daily Rate:</span>
                <span className="font-medium text-foreground ml-1">₹{prorationPreview.dailyRate}/day</span>
              </div>
              <div>
                <span>First Full Cycle:</span>
                <span className="font-medium text-foreground ml-1">{formatDate(prorationPreview.nextDueDate)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            Confirm Check-In
          </Button>
        </div>
      </form>
    </Modal>
  );
}
