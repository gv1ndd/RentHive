'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useActiveBuilding } from '@/lib/context/active-building-context';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AssignTenantModal } from '@/components/beds/assign-tenant-modal';
import { ActiveTenancyModal } from '@/components/beds/active-tenancy-modal';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import { parseRoomDisplay } from '@/lib/utils/room-helper';
import {
  Search,
  BedDouble,
  Building2,
  DoorOpen,
  User,
  Phone,
  Calendar,
  Clock,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { Bed, Room, Building, Tenancy, Tenant, AdvanceBooking } from '@/types/domain';

interface SearchBedResult extends Bed {
  room: Room;
  building: Building;
  status: 'vacant' | 'reserved' | 'occupied' | 'moving_out';
  activeTenancy?: Tenancy & { tenants: Tenant | null };
  pendingBooking?: AdvanceBooking;
}

type StatusFilter = 'all' | 'vacant' | 'reserved' | 'occupied' | 'moving_out';

export default function DominantSearchPage() {
  const { activeBuildingId } = useActiveBuilding();
  const supabase = createClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [results, setResults] = useState<SearchBedResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [assigningBed, setAssigningBed] = useState<Bed | null>(null);
  const [selectedOccupiedBed, setSelectedOccupiedBed] = useState<{
    bed: Bed;
    tenancy: Tenancy & { tenants: Tenant | null };
  } | null>(null);

  const loadAllInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all active beds with parent rooms and buildings
      const { data: bedsData } = await (supabase.from('beds') as any)
        .select(`
          *,
          rooms (
            id,
            room_number,
            floor_number,
            building_id,
            deleted_at,
            buildings (
              id,
              name,
              deleted_at
            )
          ),
          tenancies (
            id,
            rate,
            due_day,
            first_month_free,
            check_in_date,
            check_out_date,
            notice_given_date,
            expected_move_out_date,
            deleted_at,
            tenants (
              id,
              name,
              phone,
              deleted_at
            )
          )
        `)
        .is('deleted_at', null);

      // 2. Fetch pending advance bookings
      const { data: bookingsData } = await supabase
        .from('advance_bookings')
        .select('*')
        .eq('status', 'pending')
        .is('deleted_at', null);

      const bookingsByBed: Record<string, AdvanceBooking> = {};
      for (const b of (bookingsData || []) as AdvanceBooking[]) {
        if (b.bed_id) bookingsByBed[b.bed_id] = b;
      }

      const list: SearchBedResult[] = [];

      for (const b of (bedsData || []) as any[]) {
        if (!b.rooms || b.rooms.deleted_at || !b.rooms.buildings || b.rooms.buildings.deleted_at) {
          continue;
        }

        const activeTenancy = (b.tenancies || []).find(
          (t: any) => !t.check_out_date && !t.deleted_at && !t.tenants?.deleted_at
        );

        let status: 'vacant' | 'reserved' | 'occupied' | 'moving_out' = 'vacant';
        const pendingBooking = bookingsByBed[b.id];

        if (activeTenancy) {
          if (activeTenancy.expected_move_out_date || activeTenancy.notice_given_date) {
            status = 'moving_out';
          } else {
            status = 'occupied';
          }
        } else if (pendingBooking) {
          status = 'reserved';
        }

        list.push({
          id: b.id,
          room_id: b.room_id,
          bed_label: b.bed_label,
          default_rate: b.default_rate,
          created_at: b.created_at,
          deleted_at: b.deleted_at,
          room: b.rooms,
          building: b.rooms.buildings,
          status,
          activeTenancy,
          pendingBooking,
        });
      }

      // Natural numeric sort: Floor -> Room Number -> Bed Label
      list.sort((a, b) => {
        if (a.room.floor_number !== b.room.floor_number) {
          return a.room.floor_number - b.room.floor_number;
        }
        const roomA = parseRoomDisplay(a.room.room_number).cleanRoomNumber;
        const roomB = parseRoomDisplay(b.room.room_number).cleanRoomNumber;
        const roomCompare = roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
        if (roomCompare !== 0) return roomCompare;

        return a.bed_label.localeCompare(b.bed_label, undefined, { numeric: true, sensitivity: 'base' });
      });

      setResults(list);
    } catch (e) {
      console.error('Error loading search inventory:', e);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadAllInventory();
  }, [loadAllInventory]);

  // Filter & Search Logic
  const filtered = results.filter((item) => {
    // Optional active property scoping if selected
    if (activeBuildingId && item.building.id !== activeBuildingId) {
      // Allow global search across all properties if search query is entered
      if (!searchQuery.trim()) return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'moving_out' && item.status !== 'moving_out') return false;
      if (statusFilter === 'occupied' && item.status !== 'occupied' && item.status !== 'moving_out') return false;
      if (statusFilter === 'vacant' && item.status !== 'vacant') return false;
      if (statusFilter === 'reserved' && item.status !== 'reserved') return false;
    }

    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    const parsedRoom = parseRoomDisplay(item.room.room_number);
    const matchBed = item.bed_label.toLowerCase().includes(q);
    const matchRoom = item.room.room_number.toLowerCase().includes(q) || parsedRoom.cleanRoomNumber.toLowerCase().includes(q);
    const matchBalcony = q.includes('balcony') && (parsedRoom.isBalcony || q.includes('non') === !parsedRoom.isBalcony);
    const matchFloor = `floor ${item.room.floor_number}`.includes(q);
    const matchBuilding = item.building.name.toLowerCase().includes(q);
    const matchTenant = Boolean(item.activeTenancy?.tenants?.name?.toLowerCase().includes(q));
    const matchPhone = Boolean(item.activeTenancy?.tenants?.phone?.includes(q));
    const matchBooking = Boolean(item.pendingBooking?.tenant_name?.toLowerCase().includes(q));

    return matchBed || matchRoom || matchBalcony || matchFloor || matchBuilding || matchTenant || matchPhone || matchBooking;
  });

  const handleBedAction = (item: SearchBedResult) => {
    if (item.status === 'occupied' || item.status === 'moving_out') {
      if (item.activeTenancy) {
        setSelectedOccupiedBed({ bed: item, tenancy: item.activeTenancy });
      }
    } else {
      setAssigningBed(item);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Universal Inventory Search</h1>
        <p className="text-xs text-muted">
          Instant portfolio-wide directory lookup across properties, floors, rooms, beds, and tenant records.
        </p>
      </div>

      {/* Prominent Search Bar */}
      <div className="relative">
        <Search className="w-5 h-5 text-primary absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search room number, bed, tenant name, phone, or property..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
          className="w-full bg-surface border-2 border-primary/30 focus:border-primary rounded-2xl pl-12 pr-4 py-3.5 text-sm text-foreground shadow-xs focus:outline-none focus:ring-4 focus:ring-primary/15 transition-all"
        />
      </div>

      {/* Status Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface border border-border-subtle text-muted hover:text-foreground'
          }`}
        >
          All ({results.length})
        </button>
        <button
          onClick={() => setStatusFilter('vacant')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            statusFilter === 'vacant'
              ? 'bg-status-vacant text-white shadow-xs'
              : 'bg-surface border border-border-subtle text-muted hover:text-foreground'
          }`}
        >
          Vacant ({results.filter((r) => r.status === 'vacant').length})
        </button>
        <button
          onClick={() => setStatusFilter('reserved')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            statusFilter === 'reserved'
              ? 'bg-status-reserved text-white shadow-xs'
              : 'bg-surface border border-border-subtle text-muted hover:text-foreground'
          }`}
        >
          Reserved ({results.filter((r) => r.status === 'reserved').length})
        </button>
        <button
          onClick={() => setStatusFilter('occupied')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            statusFilter === 'occupied'
              ? 'bg-status-occupied text-white shadow-xs'
              : 'bg-surface border border-border-subtle text-muted hover:text-foreground'
          }`}
        >
          Occupied ({results.filter((r) => r.status === 'occupied' || r.status === 'moving_out').length})
        </button>
        <button
          onClick={() => setStatusFilter('moving_out')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            statusFilter === 'moving_out'
              ? 'bg-status-moving-out text-white shadow-xs'
              : 'bg-surface border border-border-subtle text-muted hover:text-foreground'
          }`}
        >
          Moving Out Soon ({results.filter((r) => r.status === 'moving_out').length})
        </button>
      </div>

      {/* Results Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="py-16 text-center space-y-3 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-surface-highest text-muted flex items-center justify-center mx-auto">
            <Search className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">No Inventory Matched</h2>
            <p className="text-xs text-muted mt-1">
              Try refining your search terms or selecting a different status filter.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const isOccupied = item.status === 'occupied' || item.status === 'moving_out';
            const isReserved = item.status === 'reserved';

            return (
              <Card
                key={item.id}
                interactive
                onClick={() => handleBedAction(item)}
                className="flex flex-col justify-between space-y-3"
              >
                {/* Header */}
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground text-base">
                          Room {parseRoomDisplay(item.room.room_number).cleanRoomNumber} — {item.bed_label}
                        </span>
                        {parseRoomDisplay(item.room.room_number).isBalcony && (
                          <Badge variant="primary" size="sm">
                            <span>🌿 Balcony</span>
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        {item.building.name} · Floor {item.room.floor_number}
                      </p>
                    </div>

                    <Badge variant={item.status} size="sm">
                      {item.status === 'occupied' && 'Occupied'}
                      {item.status === 'moving_out' && 'Moving Out'}
                      {item.status === 'reserved' && 'Reserved'}
                      {item.status === 'vacant' && 'Vacant'}
                    </Badge>
                  </div>

                  {/* Occupant / Reservation Details */}
                  {isOccupied && item.activeTenancy ? (
                    <div className="p-2.5 rounded-xl bg-surface-container/60 border border-border-subtle text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        <User className="w-3.5 h-3.5 text-primary" />
                        <span>{item.activeTenancy.tenants?.name || 'Occupant'}</span>
                      </div>
                      {item.activeTenancy.tenants?.phone && (
                        <div className="text-[11px] text-muted flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span>{item.activeTenancy.tenants.phone}</span>
                        </div>
                      )}
                      <div className="text-[11px] text-muted flex items-center justify-between pt-0.5">
                        <span>Since {formatDate(item.activeTenancy.check_in_date)}</span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(Number(item.activeTenancy.rate))}/mo
                        </span>
                      </div>
                    </div>
                  ) : isReserved && item.pendingBooking ? (
                    <div className="p-2.5 rounded-xl bg-status-reserved/10 border border-status-reserved/20 text-xs space-y-1">
                      <div className="font-semibold text-status-reserved">
                        {item.pendingBooking.tenant_name}
                      </div>
                      <div className="text-[11px] text-muted">
                        Move-in: {formatDate(item.pendingBooking.expected_move_in_date)} · Token: ₹{Number(item.pendingBooking.paid_amount)}
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-status-vacant/10 border border-status-vacant/20 text-xs text-status-vacant font-medium flex items-center justify-between">
                      <span>Available for immediate check-in</span>
                      <span className="font-bold">
                        {formatCurrency(Number(item.default_rate))}/mo
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Action Footer */}
                <div
                  className="pt-2.5 border-t border-border-subtle flex items-center justify-between text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link
                    href={`/rooms/${item.room.id}/beds`}
                    className="text-muted hover:text-foreground text-[11px] flex items-center gap-1"
                  >
                    <DoorOpen className="w-3.5 h-3.5" />
                    <span>Manage Room</span>
                  </Link>

                  <Button
                    variant={isOccupied ? 'tonal' : 'primary'}
                    size="sm"
                    onClick={() => handleBedAction(item)}
                  >
                    {isOccupied ? 'View Occupant' : 'Check In'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Check In Modal */}
      <AssignTenantModal
        isOpen={Boolean(assigningBed)}
        onClose={() => setAssigningBed(null)}
        bed={assigningBed}
        onSuccess={loadAllInventory}
      />

      {/* Active Occupant Modal */}
      <ActiveTenancyModal
        isOpen={Boolean(selectedOccupiedBed)}
        onClose={() => setSelectedOccupiedBed(null)}
        bed={selectedOccupiedBed?.bed || null}
        tenancy={selectedOccupiedBed?.tenancy || null}
        onSuccess={loadAllInventory}
      />
    </div>
  );
}
