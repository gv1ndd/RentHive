'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { formatDateTime } from '@/lib/utils/dates';
import { formatCurrency } from '@/lib/utils/currency';
import {
  Trash2,
  RotateCcw,
  Building2,
  DoorOpen,
  BedDouble,
  Users,
  Zap,
  CreditCard,
  Inbox,
} from 'lucide-react';
import { Building, Tenant } from '@/types/domain';
import { restoreBuilding, restoreRoom, restoreBed } from '@/lib/services/inventory-service';

type TrashCategory = 'buildings' | 'rooms' | 'beds' | 'tenants' | 'meter_readings' | 'payments';

interface TrashItemRecord {
  id: string;
  category: TrashCategory;
  title: string;
  subtitle: string;
  deleted_at: string;
}

export default function TrashPage() {
  const [activeTab, setActiveTab] = useState<TrashCategory>('buildings');
  const [items, setItems] = useState<TrashItemRecord[]>([]);
  const [counts, setCounts] = useState<Record<TrashCategory, number>>({
    buildings: 0,
    rooms: 0,
    beds: 0,
    tenants: 0,
    meter_readings: 0,
    payments: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Modals / Action states
  const [purgingItem, setPurgingItem] = useState<TrashItemRecord | null>(null);
  const [isPurgingAll, setIsPurgingAll] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const supabase = createClient();

  const loadTrash = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch soft-deleted records for all 6 tables
      const [
        { data: buildingsData },
        { data: roomsData },
        { data: bedsData },
        { data: tenantsData },
        { data: readingsData },
        { data: paymentsData },
      ] = await Promise.all([
        supabase.from('buildings').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
        supabase.from('rooms').select('*, buildings (name)').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
        supabase.from('beds').select('*, rooms (room_number, buildings (name))').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
        supabase.from('tenants').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
        supabase.from('meter_readings').select('*, meters (meter_number, rooms (room_number, buildings (name)))').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
        supabase.from('payments').select('*, tenancies (tenants (name))').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      ]);

      const typedBuildings = (buildingsData || []) as unknown as Building[];
      const typedTenants = (tenantsData || []) as unknown as Tenant[];

      const formattedBuildings: TrashItemRecord[] = typedBuildings.map((b) => ({
        id: b.id,
        category: 'buildings',
        title: b.name,
        subtitle: b.address || 'No address specified',
        deleted_at: b.deleted_at!,
      }));

      const formattedRooms: TrashItemRecord[] = (roomsData || []).map((r: any) => ({
        id: r.id,
        category: 'rooms',
        title: `Room ${r.room_number}`,
        subtitle: `Floor ${r.floor_number} · Property: ${r.buildings?.name || 'Unknown'}`,
        deleted_at: r.deleted_at!,
      }));

      const formattedBeds: TrashItemRecord[] = (bedsData || []).map((bd: any) => ({
        id: bd.id,
        category: 'beds',
        title: bd.bed_label,
        subtitle: `Room ${bd.rooms?.room_number || '?'} · ${bd.rooms?.buildings?.name || 'Property'} · ${formatCurrency(Number(bd.default_rate))}/mo`,
        deleted_at: bd.deleted_at!,
      }));

      const formattedTenants: TrashItemRecord[] = typedTenants.map((t) => ({
        id: t.id,
        category: 'tenants',
        title: t.name,
        subtitle: `Phone: ${t.phone || 'N/A'}`,
        deleted_at: t.deleted_at!,
      }));

      const formattedReadings: TrashItemRecord[] = (readingsData || []).map((mr: any) => ({
        id: mr.id,
        category: 'meter_readings',
        title: `Reading: ${mr.current_reading} units (${formatCurrency(Number(mr.amount_due))})`,
        subtitle: `Meter ${mr.meters?.meter_number || '?'} · Room ${mr.meters?.rooms?.room_number || '?'} · Date: ${mr.reading_date}`,
        deleted_at: mr.deleted_at!,
      }));

      const formattedPayments: TrashItemRecord[] = (paymentsData || []).map((p: any) => ({
        id: p.id,
        category: 'payments',
        title: `${formatCurrency(Number(p.amount))} (${p.type})`,
        subtitle: `Tenant: ${p.tenancies?.tenants?.name || 'Tenancy'} · Date: ${p.date} ${p.method ? `· ${p.method}` : ''}`,
        deleted_at: p.deleted_at!,
      }));

      setCounts({
        buildings: formattedBuildings.length,
        rooms: formattedRooms.length,
        beds: formattedBeds.length,
        tenants: formattedTenants.length,
        meter_readings: formattedReadings.length,
        payments: formattedPayments.length,
      });

      const mapByCategory: Record<TrashCategory, TrashItemRecord[]> = {
        buildings: formattedBuildings,
        rooms: formattedRooms,
        beds: formattedBeds,
        tenants: formattedTenants,
        meter_readings: formattedReadings,
        payments: formattedPayments,
      };

      setItems(mapByCategory[activeTab] || []);
    } catch (e) {
      console.error('Error loading trash items:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, supabase]);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  // 1. Restore item (with cascading parent/child resolution)
  const handleRestore = async (item: TrashItemRecord) => {
    setIsActionLoading(true);
    try {
      if (item.category === 'buildings') {
        await restoreBuilding(supabase, item.id);
      } else if (item.category === 'rooms') {
        await restoreRoom(supabase, item.id);
      } else if (item.category === 'beds') {
        await restoreBed(supabase, item.id);
      } else {
        const { error } = await (supabase.from(item.category as any) as any)
          .update({ deleted_at: null })
          .eq('id', item.id);

        if (error) throw error;
      }

      await loadTrash();
    } catch (e) {
      console.error('Error restoring item:', e);
    } finally {
      setIsActionLoading(false);
    }
  };

  // 2. Permanently Purge Item (hard delete)
  const handlePermanentDelete = async () => {
    if (!purgingItem) return;
    setIsActionLoading(true);
    setActionError(null);
    try {
      const { error } = await (supabase.from(purgingItem.category as any) as any)
        .delete()
        .eq('id', purgingItem.id);

      if (error) {
        if (error.code === '23503' || error.message.includes('foreign key')) {
          throw new Error(`Cannot permanently delete this ${purgingItem.category.slice(0, -1)} because active historical records (payments, notes, or readings) still reference it.`);
        }
        throw error;
      }
      setPurgingItem(null);
      await loadTrash();
    } catch (e: any) {
      console.error('Error permanently deleting item:', e);
      setActionError(e.message || 'Failed to permanently delete item.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 3. Empty Entire Active Category Trash
  const handleEmptyCategoryTrash = async () => {
    setIsActionLoading(true);
    setActionError(null);
    try {
      const ids = items.map((i) => i.id);
      if (ids.length > 0) {
        const { error } = await (supabase.from(activeTab as any) as any)
          .delete()
          .in('id', ids);

        if (error) {
          if (error.code === '23503' || error.message.includes('foreign key')) {
            throw new Error(`Some items could not be deleted because active records (payments or readings) reference them.`);
          }
          throw error;
        }
      }
      setIsPurgingAll(false);
      await loadTrash();
    } catch (e: any) {
      console.error('Error emptying category trash:', e);
      setActionError(e.message || 'Failed to empty category trash.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const TABS: Array<{ id: TrashCategory; label: string; icon: any }> = [
    { id: 'buildings', label: 'Buildings', icon: Building2 },
    { id: 'rooms', label: 'Rooms', icon: DoorOpen },
    { id: 'beds', label: 'Beds', icon: BedDouble },
    { id: 'tenants', label: 'Tenants', icon: Users },
    { id: 'meter_readings', label: 'Meter Readings', icon: Zap },
    { id: 'payments', label: 'Payments', icon: CreditCard },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Trash & Recovery Bin</h1>
          <p className="text-xs text-muted">
            Recover accidentally soft-deleted properties, rooms, beds, tenants, meter readings, or payments.
          </p>
        </div>

        {items.length > 0 && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsPurgingAll(true)}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Empty {TABS.find((t) => t.id === activeTab)?.label} Trash
          </Button>
        )}
      </div>

      {actionError && (
        <div className="p-3.5 rounded-2xl bg-status-pending/15 border border-status-pending/30 text-status-pending text-xs font-medium flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-xs underline ml-2 cursor-pointer font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-border-subtle">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = counts[tab.id] || 0;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-primary-container text-on-primary-container shadow-xs'
                  : 'text-muted hover:text-foreground hover:bg-surface-highest'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-on-primary-container/20 text-on-primary-container'
                      : 'bg-surface-highest text-muted'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Trash Items List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="py-16 text-center space-y-4 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-surface-highest text-muted flex items-center justify-center mx-auto">
            <Inbox className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Trash is Empty</h2>
            <p className="text-xs text-muted mt-1">
              There are no deleted items in the{' '}
              <span className="font-semibold text-foreground">
                {TABS.find((t) => t.id === activeTab)?.label}
              </span>{' '}
              category.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:border-border"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                  <Badge variant="neutral" size="sm">
                    Deleted {formatDateTime(item.deleted_at)}
                  </Badge>
                </div>
                <p className="text-xs text-muted">{item.subtitle}</p>
              </div>

              <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-subtle justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(item)}
                  disabled={isActionLoading}
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  Restore
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPurgingItem(item)}
                  disabled={isActionLoading}
                  className="text-status-pending hover:bg-status-pending/10 hover:text-status-pending"
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Delete Forever
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Permanent Delete Single Confirmation */}
      <ConfirmModal
        isOpen={Boolean(purgingItem)}
        onClose={() => setPurgingItem(null)}
        onConfirm={handlePermanentDelete}
        title="Permanently Delete Item?"
        description={`Are you sure you want to permanently delete "${purgingItem?.title}"? This action cannot be undone.`}
        confirmText="Delete Forever"
        isDanger
        isLoading={isActionLoading}
      />

      {/* Empty Entire Category Trash Confirmation */}
      <ConfirmModal
        isOpen={isPurgingAll}
        onClose={() => setIsPurgingAll(false)}
        onConfirm={handleEmptyCategoryTrash}
        title={`Empty All ${TABS.find((t) => t.id === activeTab)?.label} Trash?`}
        description={`Are you sure you want to permanently delete all ${items.length} items in this category? This action is irreversible.`}
        confirmText="Empty Trash"
        isDanger
        isLoading={isActionLoading}
      />
    </div>
  );
}
