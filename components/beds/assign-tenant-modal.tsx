'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Bed, Tenant } from '@/types/domain';
import { formatDate, getBillingCycleStartDate } from '@/lib/utils/dates';
import { formatCurrency } from '@/lib/utils/currency';
import { calculatePendingRent } from '@/lib/calculations/rent-calculator';
import { CheckoutTenantModal } from '@/components/tenants/checkout-tenant-modal';
import { Calculator, AlertCircle, UserX } from 'lucide-react';

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

  // Active occupant conflict state
  const [activeOccupant, setActiveOccupant] = useState<any | null>(null);
  const [forceCheckoutPendingDues, setForceCheckoutPendingDues] = useState<number>(0);
  const [isForceCheckoutOpen, setIsForceCheckoutOpen] = useState(false);

  const supabase = createClient();

  const checkBedOccupant = useCallback(async () => {
    if (!bed) return;

    const { data } = await supabase
      .from('tenancies')
      .select('*, tenants(*)')
      .eq('bed_id', bed.id)
      .is('check_out_date', null)
      .is('deleted_at', null)
      .maybeSingle();

    setActiveOccupant(data || null);
  }, [bed, supabase]);

  useEffect(() => {
    if (bed && isOpen) {
      setRate(String(bed.default_rate || 6000));
      setCheckInDate(formatDate(new Date()));
      setError(null);
      checkBedOccupant();
    }
  }, [bed, isOpen, checkBedOccupant]);

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

  const handleInitiateForceCheckout = async () => {
    if (!activeOccupant) return;
    try {
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('tenancy_id', activeOccupant.id)
        .is('deleted_at', null);

      const result = calculatePendingRent({
        rate: Number(activeOccupant.rate),
        checkInDate: activeOccupant.check_in_date,
        checkOutDate: activeOccupant.check_out_date,
        dueDay: activeOccupant.due_day || 1,
        payments: (paymentsData || []) as any[],
        asOfDate: new Date(),
      });

      setForceCheckoutPendingDues(result.pendingBalance);
      setIsForceCheckoutOpen(true);
    } catch {
      setForceCheckoutPendingDues(0);
      setIsForceCheckoutOpen(true);
    }
  };

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
      };
    } catch {
      return null;
    }
  }, [rate, dueDay, checkInDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bed) return;

    if (activeOccupant) {
      setError(
        `This bed is currently occupied by ${
          activeOccupant.tenants?.name || 'an active tenant'
        }. Please force checkout the current occupant before assigning a new tenant.`
      );
      return;
    }

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
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-status-pending/15 border border-status-pending/30 text-status-pending text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Active Occupant Conflict Banner */}
        {activeOccupant && (
          <div className="p-3.5 rounded-xl bg-status-moving-out/15 border border-status-moving-out/30 space-y-2.5 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-status-moving-out font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Bed Conflict: Current Occupant Active</span>
                </div>
                <p className="text-muted leading-relaxed">
                  <strong className="text-foreground">
                    {activeOccupant.tenants?.name || 'Current occupant'}
                  </strong>{' '}
                  is currently occupying {bed?.bed_label}
                  {activeOccupant.expected_move_out_date
                    ? ` (scheduled move-out: ${formatDate(
                        activeOccupant.expected_move_out_date
                      )})`
                    : ''}
                  . You must check out the current occupant before checking in a new tenant.
                </p>
              </div>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleInitiateForceCheckout}
                leftIcon={<UserX className="w-3.5 h-3.5" />}
                className="shrink-0 w-full sm:w-auto"
              >
                Force Checkout Now
              </Button>
            </div>
          </div>
        )}

        {/* Tab Selection: New vs Existing */}
        <div className="flex p-1 bg-surface-highest/80 rounded-xl border border-border-subtle text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab('new')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
              tab === 'new'
                ? 'bg-surface text-foreground shadow-xs'
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
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-muted hover:text-foreground'
            }`}
          >
            Existing Tenant
          </button>
        </div>

        {tab === 'new' ? (
          <>
            <Input
              label="Tenant Full Name"
              placeholder="e.g. John Doe"
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
            options={
              existingTenants.length > 0
                ? existingTenants.map((t) => ({
                    value: t.id,
                    label: `${t.name}${t.phone ? ` (${t.phone})` : ''}`,
                  }))
                : [{ value: '', label: 'No existing tenants found' }]
            }
            disabled={existingTenants.length === 0}
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
                <span>Proration Settlement Preview</span>
              </span>
              <span className="text-sm font-bold text-primary">
                {formatCurrency(prorationPreview.grossRent)} Due at Entry
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted pt-1 border-t border-border-subtle/50">
              <div>
                <span>Days Occupied:</span>
                <span className="font-medium text-foreground ml-1">
                  {prorationPreview.daysOccupied} of {prorationPreview.totalDaysInCycle} days
                </span>
              </div>
              <div>
                <span>Effective Daily Rate:</span>
                <span className="font-medium text-foreground ml-1">
                  {formatCurrency(prorationPreview.dailyRate)}/day
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isLoading}
            disabled={Boolean(activeOccupant)}
          >
            Check In Tenant
          </Button>
        </div>
      </form>

      {/* Force Checkout Modal */}
      {isForceCheckoutOpen && activeOccupant && (
        <CheckoutTenantModal
          isOpen={isForceCheckoutOpen}
          onClose={() => setIsForceCheckoutOpen(false)}
          tenancy={activeOccupant}
          tenantName={activeOccupant.tenants?.name || 'Current Occupant'}
          roomInfo={`${bed?.bed_label || 'Bed'}`}
          pendingBalance={forceCheckoutPendingDues}
          onSuccess={async () => {
            setIsForceCheckoutOpen(false);
            await checkBedOccupant();
            onSuccess();
          }}
        />
      )}
    </Modal>
  );
}
