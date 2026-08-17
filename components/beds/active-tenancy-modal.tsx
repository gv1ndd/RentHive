'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { Bed, Tenancy, Tenant } from '@/types/domain';
import { calculatePendingRent } from '@/lib/calculations/rent-calculator';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import { RecordPaymentModal } from '@/components/payments/record-payment-modal';
import {
  User,
  Phone,
  Calendar,
  CreditCard,
  AlertCircle,
  ExternalLink,
  CalendarDays,
  XCircle,
} from 'lucide-react';

interface ActiveTenancyModalProps {
  isOpen: boolean;
  onClose: () => void;
  bed: Bed | null;
  tenancy: (Tenancy & { tenants: Tenant | null }) | null;
  onSuccess: () => void;
}

export function ActiveTenancyModal({
  isOpen,
  onClose,
  bed,
  tenancy,
  onSuccess,
}: ActiveTenancyModalProps) {
  const [pendingDues, setPendingDues] = useState<number>(0);
  const [moveOutDate, setMoveOutDate] = useState<string>(formatDate(new Date()));
  const [isMoveOutOpen, setIsMoveOutOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (tenancy) {
      const fetchPaymentsAndDues = async () => {
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('*')
          .eq('tenancy_id', tenancy.id)
          .is('deleted_at', null);

        const result = calculatePendingRent({
          rate: Number(tenancy.rate),
          checkInDate: tenancy.check_in_date,
          checkOutDate: tenancy.check_out_date,
          dueDay: tenancy.due_day || 1,
          payments: (paymentsData || []) as any[],
          asOfDate: new Date(),
        });

        setPendingDues(result.pendingBalance);
      };

      fetchPaymentsAndDues();
      setIsMoveOutOpen(false);
      setMoveOutDate(formatDate(new Date()));
    }
  }, [tenancy, supabase]);

  const handleMoveOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenancy) return;

    setIsLoading(true);
    setError(null);

    try {
      const chosen = new Date(moveOutDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      chosen.setHours(0, 0, 0, 0);

      if (chosen <= today) {
        // Immediate checkout
        const { error: coError } = await supabase
          .from('tenancies')
          .update({
            check_out_date: moveOutDate,
            expected_move_out_date: null,
          })
          .eq('id', tenancy.id);

        if (coError) throw coError;
      } else {
        // Notice given with expected departure date
        const { error: noticeError } = await supabase
          .from('tenancies')
          .update({
            notice_given_date: formatDate(new Date()),
            expected_move_out_date: moveOutDate,
          })
          .eq('id', tenancy.id);

        if (noticeError) throw noticeError;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process move-out';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelNotice = async () => {
    if (!tenancy) return;
    setIsLoading(true);
    try {
      const { error: cancelError } = await supabase
        .from('tenancies')
        .update({
          notice_given_date: null,
          expected_move_out_date: null,
        })
        .eq('id', tenancy.id);

      if (cancelError) throw cancelError;

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!tenancy || !tenancy.tenants) return null;

  const hasNotice = Boolean(tenancy.expected_move_out_date || tenancy.notice_given_date);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${bed?.bed_label || 'Bed'} — Active Occupant`}
      maxWidth="md"
    >
      <div className="space-y-4 text-xs">
        {error && (
          <div className="p-3 rounded-xl bg-status-pending/15 border border-status-pending/30 text-status-pending font-medium">
            {error}
          </div>
        )}

        {/* Tenant Details Card */}
        <div className="p-4 rounded-xl bg-surface-container/60 border border-border-subtle space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-base">
                {tenancy.tenants.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">{tenancy.tenants.name}</h3>
                {tenancy.tenants.phone && (
                  <p className="text-muted flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" />
                    <span>{tenancy.tenants.phone}</span>
                  </p>
                )}
              </div>
            </div>

            {hasNotice ? (
              <Badge variant="moving_out" size="sm">
                Moving Out Soon
              </Badge>
            ) : (
              <Badge variant="occupied" size="sm">
                Occupied
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border-subtle">
            <div>
              <span className="text-muted block">Monthly Rate</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(Number(tenancy.rate))}
              </span>
            </div>
            <div>
              <span className="text-muted block">Rent Due Day</span>
              <span className="font-semibold text-foreground">Day {tenancy.due_day}</span>
            </div>
            <div>
              <span className="text-muted block">Checked In</span>
              <span className="font-semibold text-foreground">
                {formatDate(tenancy.check_in_date)}
              </span>
            </div>
          </div>
        </div>

        {/* Dues Banner */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border-subtle">
          <div className="flex items-center gap-2">
            <AlertCircle
              className={`w-4 h-4 ${
                pendingDues > 0 ? 'text-status-pending' : 'text-status-vacant'
              }`}
            />
            <span className="font-medium text-foreground">Outstanding Balance</span>
          </div>
          <span
            className={`font-bold text-sm ${
              pendingDues > 0 ? 'text-status-pending' : 'text-status-vacant'
            }`}
          >
            {pendingDues < 0
              ? `Advance Credit: ${formatCurrency(Math.abs(pendingDues))}`
              : formatCurrency(pendingDues)}
          </span>
        </div>

        {/* Notice Status Banner (if active) */}
        {hasNotice && (
          <div className="p-3 rounded-xl bg-status-moving-out/15 border border-status-moving-out/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-status-moving-out" />
              <span className="font-medium text-foreground">
                Move-out scheduled: {formatDate(tenancy.expected_move_out_date)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCancelNotice}
              className="text-xs text-status-pending hover:underline font-semibold cursor-pointer"
            >
              Cancel Notice
            </button>
          </div>
        )}

        {/* Move-Out Section Form */}
        {isMoveOutOpen ? (
          <form
            onSubmit={handleMoveOutSubmit}
            className="p-4 rounded-xl bg-surface-container/80 border border-border-subtle space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Set Move-Out / Check-Out Date</span>
              <button
                type="button"
                onClick={() => setIsMoveOutOpen(false)}
                className="text-muted hover:text-foreground"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              If the selected date is today or past, the tenant will be immediately checked out and the bed vacated. If future, a move-out notice will be set.
            </p>

            <Input
              type="date"
              label="Selected Date"
              value={moveOutDate}
              onChange={(e) => setMoveOutDate(e.target.value)}
              required
            />

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsMoveOutOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="danger" size="sm" isLoading={isLoading}>
                Confirm Date
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRecordPaymentOpen(true)}
                leftIcon={<CreditCard className="w-3.5 h-3.5 text-primary" />}
                className="flex-1 sm:flex-initial"
              >
                Record Payment
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsMoveOutOpen(true)}
                leftIcon={<CalendarDays className="w-3.5 h-3.5" />}
                className="flex-1 sm:flex-initial"
              >
                Set Notice
              </Button>
            </div>

            <Link href={`/tenants/${tenancy.tenant_id}/history`} className="w-full sm:w-auto">
              <Button
                type="button"
                variant="primary"
                size="sm"
                rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                className="w-full sm:w-auto"
              >
                Full Tenant Hub
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {isRecordPaymentOpen && (
        <RecordPaymentModal
          isOpen={isRecordPaymentOpen}
          onClose={() => setIsRecordPaymentOpen(false)}
          tenancyId={tenancy.id}
          defaultAmount={pendingDues > 0 ? pendingDues : Number(tenancy.rate)}
          onSuccess={() => {
            onSuccess();
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
