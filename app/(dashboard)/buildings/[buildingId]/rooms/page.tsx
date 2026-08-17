'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { AddRoomModal } from '@/components/rooms/add-room-modal';
import { EditRoomModal } from '@/components/rooms/edit-room-modal';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  BedDouble,
  Zap,
  Building2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Building, Room } from '@/types/domain';
import { softDeleteRoom } from '@/lib/services/inventory-service';

interface RoomWithDetails extends Room {
  beds: Array<{
    id: string;
    bed_label: string;
    default_rate: number;
    deleted_at: string | null;
    status: 'vacant' | 'reserved' | 'occupied' | 'moving_out';
  }>;
  meter?: {
    id: string;
    meter_number: string;
  };
}

export default function BuildingRoomsPage({
  params,
}: {
  params: Promise<{ buildingId: string }>;
}) {
  const resolvedParams = use(params);
  const buildingId = resolvedParams.buildingId;
  const router = useRouter();
  const supabase = createClient();

  const [building, setBuilding] = useState<Building | null>(null);
  const [rooms, setRooms] = useState<RoomWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadBuildingAndRooms = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch building
      const { data: bData } = await supabase
        .from('buildings')
        .select('*')
        .eq('id', buildingId)
        .is('deleted_at', null)
        .single();

      if (!bData) {
        router.push('/buildings');
        return;
      }
      setBuilding(bData as Building);

      // 2. Fetch Rooms with beds, meters, and tenancies
      const { data: roomsData } = await supabase
        .from('rooms')
        .select(`
          *,
          beds (
            id,
            bed_label,
            default_rate,
            deleted_at,
            tenancies (
              id,
              check_out_date,
              notice_given_date,
              expected_move_out_date,
              deleted_at
            )
          ),
          meters (
            id,
            meter_number
          )
        `)
        .eq('building_id', buildingId)
        .is('deleted_at', null)
        .order('floor_number', { ascending: true })
        .order('room_number', { ascending: true });

      // 3. Fetch Advance Bookings for reservation status
      const { data: bookingsData } = await supabase
        .from('advance_bookings')
        .select('bed_id')
        .eq('building_id', buildingId)
        .eq('status', 'pending')
        .is('deleted_at', null);

      const reservedBedIds = new Set(
        (bookingsData || []).map((b: any) => b.bed_id).filter(Boolean)
      );

      const processedRooms: RoomWithDetails[] = (roomsData || []).map((r: any) => {
        const activeBeds = (r.beds || [])
          .filter((b: any) => !b.deleted_at)
          .map((b: any) => {
            const activeTenancy = (b.tenancies || []).find(
              (t: any) => !t.check_out_date && !t.deleted_at
            );

            let status: 'vacant' | 'reserved' | 'occupied' | 'moving_out' = 'vacant';
            if (activeTenancy) {
              if (activeTenancy.expected_move_out_date || activeTenancy.notice_given_date) {
                status = 'moving_out';
              } else {
                status = 'occupied';
              }
            } else if (reservedBedIds.has(b.id)) {
              status = 'reserved';
            }

            return {
              id: b.id,
              bed_label: b.bed_label,
              default_rate: b.default_rate,
              deleted_at: b.deleted_at,
              status,
            };
          });

        return {
          id: r.id,
          building_id: r.building_id,
          room_number: r.room_number,
          floor_number: r.floor_number,
          created_at: r.created_at,
          deleted_at: r.deleted_at,
          beds: activeBeds,
          meter: r.meters?.[0] ? { id: r.meters[0].id, meter_number: r.meters[0].meter_number } : undefined,
        };
      });

      setRooms(processedRooms);
    } catch (e) {
      console.error('Error loading rooms:', e);
    } finally {
      setIsLoading(false);
    }
  }, [buildingId, router, supabase]);

  useEffect(() => {
    loadBuildingAndRooms();
  }, [loadBuildingAndRooms]);

  const handleDeleteConfirm = async () => {
    if (!deletingRoom) return;
    setIsDeleting(true);

    try {
      await softDeleteRoom(supabase, deletingRoom.id);

      setDeletingRoom(null);
      await loadBuildingAndRooms();
    } catch (e) {
      console.error('Error soft-deleting room:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  // Group rooms by floor number
  const floors = Array.from(new Set(rooms.map((r) => r.floor_number))).sort((a, b) => a - b);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Link href="/buildings" className="hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Properties</span>
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{building?.name}</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">
            {building?.name} — Rooms & Beds
          </h1>
          <p className="text-xs text-muted">
            {rooms.length} Rooms · {rooms.flatMap((r) => r.beds).length} Total Beds
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAddOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Room
        </Button>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, j) => (
                  <Skeleton key={j} className="h-40 rounded-2xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <Card className="py-16 text-center space-y-4 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center mx-auto">
            <Layers className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">No Rooms Created Yet</h2>
            <p className="text-xs text-muted mt-1">
              Add your first room and allocate beds to begin checking in tenants.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add First Room
          </Button>
        </Card>
      ) : (
        /* Floors & Rooms Display */
        <div className="space-y-8">
          {floors.map((floor) => {
            const floorRooms = rooms.filter((r) => r.floor_number === floor);
            const floorLabel =
              floor === 0 ? 'Ground Floor (0)' : `${floor}${floor === 1 ? 'st' : floor === 2 ? 'nd' : floor === 3 ? 'rd' : 'th'} Floor`;

            return (
              <div key={floor} className="space-y-3">
                {/* Floor Header */}
                <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    {floorLabel}
                  </h2>
                  <span className="text-xs text-muted">({floorRooms.length} rooms)</span>
                </div>

                {/* Rooms Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {floorRooms.map((room) => {
                    const occupiedBeds = room.beds.filter(
                      (b) => b.status === 'occupied' || b.status === 'moving_out'
                    ).length;
                    const reservedBeds = room.beds.filter((b) => b.status === 'reserved').length;
                    const vacantBeds = room.beds.filter((b) => b.status === 'vacant').length;

                    return (
                      <Card
                        key={room.id}
                        interactive
                        className="flex flex-col justify-between space-y-4"
                        onClick={() => router.push(`/rooms/${room.id}/beds`)}
                      >
                        {/* Top Info */}
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-foreground">
                                  Room {room.room_number}
                                </h3>
                                {room.meter && (
                                  <Badge variant="neutral" size="sm">
                                    <Zap className="w-3 h-3 text-primary" />
                                    <span>{room.meter.meter_number}</span>
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted mt-0.5">
                                {room.beds.length} Total Beds
                              </p>
                            </div>

                            {/* Bed Status Breakdown */}
                            <div className="flex flex-wrap gap-1 justify-end max-w-[140px]">
                              {occupiedBeds > 0 && (
                                <Badge variant="occupied" size="sm">
                                  {occupiedBeds} Occ
                                </Badge>
                              )}
                              {reservedBeds > 0 && (
                                <Badge variant="reserved" size="sm">
                                  {reservedBeds} Res
                                </Badge>
                              )}
                              {vacantBeds > 0 && (
                                <Badge variant="vacant" size="sm">
                                  {vacantBeds} Vac
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Bed Pills List */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {room.beds.map((b) => (
                              <Badge key={b.id} variant={b.status} size="sm">
                                {b.bed_label}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div
                          className="pt-3 border-t border-border-subtle flex items-center justify-between text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingRoom(room)}
                              className="p-1.5 text-muted hover:text-foreground hover:bg-surface-highest rounded-lg transition-colors cursor-pointer"
                              title="Edit Room"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingRoom(room)}
                              className="p-1.5 text-muted hover:text-status-pending hover:bg-status-pending/10 rounded-lg transition-colors cursor-pointer"
                              title="Move to Trash"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <Link
                            href={`/rooms/${room.id}/beds`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            <span>Manage Beds</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      <AddRoomModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        buildingId={buildingId}
        onSuccess={loadBuildingAndRooms}
      />

      {/* Edit Modal */}
      <EditRoomModal
        isOpen={Boolean(editingRoom)}
        onClose={() => setEditingRoom(null)}
        room={editingRoom}
        onSuccess={loadBuildingAndRooms}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deletingRoom)}
        onClose={() => setDeletingRoom(null)}
        onConfirm={handleDeleteConfirm}
        title="Move Room to Trash?"
        description={
          rooms.find((r) => r.id === deletingRoom?.id)?.beds.some((b) => b.status === 'occupied' || b.status === 'moving_out')
            ? `⚠️ Warning: Room ${deletingRoom?.room_number} has active occupants. Deleting this room will automatically check them out and move them to Ex-Tenants history so no ghost records remain.`
            : `Are you sure you want to move Room ${deletingRoom?.room_number} and all its beds to Trash? You can restore it anytime from the Trash Hub.`
        }
        confirmText="Move to Trash"
        isDanger
        isLoading={isDeleting}
      />
    </div>
  );
}
