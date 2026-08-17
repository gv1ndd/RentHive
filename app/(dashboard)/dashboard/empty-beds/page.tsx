'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useActiveBuilding } from '@/lib/context/active-building-context';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AssignTenantModal } from '@/components/beds/assign-tenant-modal';
import { formatCurrency } from '@/lib/utils/currency';
import {
  ArrowLeft,
  BedDouble,
  DoorOpen,
  Plus,
  Building2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Bed, Room } from '@/types/domain';

interface VacantBedItem extends Bed {
  room: Room;
}

export default function EmptyBedsPage() {
  const { activeBuilding, activeBuildingId } = useActiveBuilding();
  const supabase = createClient();

  const [vacantBeds, setVacantBeds] = useState<VacantBedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [assigningBed, setAssigningBed] = useState<Bed | null>(null);

  const loadVacantBeds = useCallback(async () => {
    if (!activeBuildingId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch beds with active tenancies for active building
      const { data: rawBeds } = await (supabase.from('beds') as any)
        .select(`
          *,
          rooms (
            id,
            room_number,
            floor_number,
            building_id,
            deleted_at
          ),
          tenancies (
            id,
            check_out_date,
            deleted_at,
            tenants (
              id,
              deleted_at
            )
          )
        `)
        .is('deleted_at', null);

      // 2. Fetch pending advance bookings
      const { data: bookingsData } = await supabase
        .from('advance_bookings')
        .select('bed_id')
        .eq('status', 'pending')
        .is('deleted_at', null);

      const reservedBedIds = new Set(
        (bookingsData || []).map((b: any) => b.bed_id).filter(Boolean)
      );

      const list: VacantBedItem[] = [];

      for (const b of (rawBeds || []) as any[]) {
        if (!b.rooms || b.rooms.deleted_at || b.rooms.building_id !== activeBuildingId) {
          continue;
        }

        const hasActiveTenancy = (b.tenancies || []).some(
          (t: any) => !t.check_out_date && !t.deleted_at && !t.tenants?.deleted_at
        );

        const isReserved = reservedBedIds.has(b.id);

        if (!hasActiveTenancy && !isReserved) {
          list.push({
            id: b.id,
            room_id: b.room_id,
            bed_label: b.bed_label,
            default_rate: b.default_rate,
            created_at: b.created_at,
            deleted_at: b.deleted_at,
            room: b.rooms,
          });
        }
      }

      setVacantBeds(list);
    } catch (e) {
      console.error('Error loading vacant beds:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeBuildingId, supabase]);

  useEffect(() => {
    loadVacantBeds();
  }, [loadVacantBeds]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground mb-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Available Vacant Beds</h1>
            <p className="text-xs text-muted">
              {activeBuilding?.name || 'All Properties'} · {vacantBeds.length} Beds Available for Check-In
            </p>
          </div>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : vacantBeds.length === 0 ? (
        <Card className="py-16 text-center space-y-3 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-status-occupied/15 text-status-occupied flex items-center justify-center mx-auto">
            <BedDouble className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">100% Full Capacity</h2>
            <p className="text-xs text-muted mt-1">
              All beds in this property are currently occupied or reserved.
            </p>
          </div>
          <Link href="/buildings">
            <Button variant="outline" size="sm">
              Manage Rooms
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vacantBeds.map((bed) => (
            <Card
              key={bed.id}
              interactive
              onClick={() => setAssigningBed(bed)}
              className="flex flex-col justify-between space-y-3 border-status-vacant/30 hover:border-status-vacant/50"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-status-vacant/15 text-status-vacant flex items-center justify-center font-bold text-base">
                      <BedDouble className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-foreground">
                        Room {bed.room.room_number} — {bed.bed_label}
                      </h2>
                      <p className="text-xs text-muted">
                        Floor {bed.room.floor_number}
                      </p>
                    </div>
                  </div>

                  <Badge variant="vacant" size="sm">
                    Vacant
                  </Badge>
                </div>

                <div className="p-2.5 rounded-xl bg-surface-container/60 border border-border-subtle flex items-center justify-between text-xs">
                  <span className="text-muted">Default Monthly Rate:</span>
                  <span className="font-bold text-foreground text-sm">
                    {formatCurrency(Number(bed.default_rate))}/mo
                  </span>
                </div>
              </div>

              <div
                className="pt-2.5 border-t border-border-subtle flex items-center justify-between text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <Link
                  href={`/rooms/${bed.room.id}/beds`}
                  className="text-muted hover:text-foreground text-[11px] flex items-center gap-1"
                >
                  <DoorOpen className="w-3.5 h-3.5" />
                  <span>Room Matrix</span>
                </Link>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setAssigningBed(bed)}
                >
                  Check In Tenant
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Check In Modal */}
      <AssignTenantModal
        isOpen={Boolean(assigningBed)}
        onClose={() => setAssigningBed(null)}
        bed={assigningBed}
        onSuccess={loadVacantBeds}
      />
    </div>
  );
}
