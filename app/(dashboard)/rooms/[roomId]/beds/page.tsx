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
import { AddBedModal } from '@/components/beds/add-bed-modal';
import { EditBedModal } from '@/components/beds/edit-bed-modal';
import { AssignTenantModal } from '@/components/beds/assign-tenant-modal';
import { ActiveTenancyModal } from '@/components/beds/active-tenancy-modal';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  BedDouble,
  User,
  Calendar,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { Bed, Room, Building, Tenancy, Tenant, AdvanceBooking } from '@/types/domain';

interface BedFullDetails extends Bed {
  status: 'vacant' | 'reserved' | 'occupied' | 'moving_out';
  activeTenancy?: Tenancy & { tenants: Tenant | null };
  pendingBooking?: AdvanceBooking;
}

export default function RoomBedsPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.roomId;
  const router = useRouter();
  const supabase = createClient();

  const [room, setRoom] = useState<Room | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [beds, setBeds] = useState<BedFullDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isAddBedOpen, setIsAddBedOpen] = useState(false);
  const [editingBed, setEditingBed] = useState<Bed | null>(null);
  const [deletingBed, setDeletingBed] = useState<Bed | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Tenancy Modals
  const [assigningBed, setAssigningBed] = useState<Bed | null>(null);
  const [selectedOccupiedBed, setSelectedOccupiedBed] = useState<{
    bed: Bed;
    tenancy: Tenancy & { tenants: Tenant | null };
  } | null>(null);

  const loadRoomAndBeds = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Room & Building
      const { data: roomData } = await supabase
        .from('rooms')
        .select('*, buildings (*)')
        .eq('id', roomId)
        .is('deleted_at', null)
        .single();

      if (!roomData) {
        router.push('/buildings');
        return;
      }

      setRoom(roomData as unknown as Room);
      setBuilding(roomData.buildings as unknown as Building);

      // 2. Fetch Beds with Tenancies
      const { data: bedsData } = await supabase
        .from('beds')
        .select(`
          *,
          tenancies (
            id,
            bed_id,
            tenant_id,
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
        .eq('room_id', roomId)
        .is('deleted_at', null)
        .order('bed_label', { ascending: true });

      // 3. Fetch Advance Bookings for this room
      const { data: bookingsData } = await supabase
        .from('advance_bookings')
        .select('*')
        .eq('room_id', roomId)
        .eq('status', 'pending')
        .is('deleted_at', null);

      const pendingBookings = (bookingsData || []) as AdvanceBooking[];
      const bookingsByBed: Record<string, AdvanceBooking> = {};
      for (const b of pendingBookings) {
        if (b.bed_id) bookingsByBed[b.bed_id] = b;
      }

      const processedBeds: BedFullDetails[] = (bedsData || []).map((b: any) => {
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

        return {
          id: b.id,
          room_id: b.room_id,
          bed_label: b.bed_label,
          default_rate: b.default_rate,
          created_at: b.created_at,
          deleted_at: b.deleted_at,
          status,
          activeTenancy,
          pendingBooking,
        };
      });

      setBeds(processedBeds);
    } catch (e) {
      console.error('Error loading beds:', e);
    } finally {
      setIsLoading(false);
    }
  }, [roomId, router, supabase]);

  useEffect(() => {
    loadRoomAndBeds();
  }, [loadRoomAndBeds]);

  const handleDeleteConfirm = async () => {
    if (!deletingBed) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('beds')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deletingBed.id);

      if (error) throw error;

      setDeletingBed(null);
      await loadRoomAndBeds();
    } catch (e) {
      console.error('Error soft-deleting bed:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBedClick = (bed: BedFullDetails) => {
    if (bed.status === 'occupied' || bed.status === 'moving_out') {
      if (bed.activeTenancy) {
        setSelectedOccupiedBed({ bed, tenancy: bed.activeTenancy });
      }
    } else {
      // Vacant or Reserved -> Open Check-In
      setAssigningBed(bed);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Link
              href={`/buildings/${building?.id}/rooms`}
              className="hover:text-foreground flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{building?.name}</span>
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Room {room?.room_number}</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">
            Room {room?.room_number} — Bed Matrix
          </h1>
          <p className="text-xs text-muted">
            Floor {room?.floor_number} · {beds.length} Total Beds
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAddBedOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Bed
        </Button>
      </div>

      {/* Bed Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : beds.length === 0 ? (
        <Card className="py-16 text-center space-y-4 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center mx-auto">
            <BedDouble className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">No Beds in this Room</h2>
            <p className="text-xs text-muted mt-1">
              Add bed slots (e.g. Bed A, Bed B) to begin allocating tenants.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddBedOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Bed
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {beds.map((bed) => {
            const isOccupied = bed.status === 'occupied' || bed.status === 'moving_out';
            const isReserved = bed.status === 'reserved';

            return (
              <Card
                key={bed.id}
                interactive
                onClick={() => handleBedClick(bed)}
                className={`flex flex-col justify-between space-y-4 transition-all ${
                  isOccupied
                    ? 'border-status-occupied/30'
                    : isReserved
                    ? 'border-status-reserved/40'
                    : 'border-status-vacant/30'
                }`}
              >
                {/* Top Section */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                          isOccupied
                            ? 'bg-status-occupied/15 text-status-occupied'
                            : isReserved
                            ? 'bg-status-reserved/15 text-status-reserved'
                            : 'bg-status-vacant/15 text-status-vacant'
                        }`}
                      >
                        <BedDouble className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-foreground">{bed.bed_label}</h3>
                        <span className="text-xs text-muted font-medium">
                          {formatCurrency(Number(bed.default_rate))} / mo
                        </span>
                      </div>
                    </div>

                    <Badge variant={bed.status} size="sm">
                      {bed.status === 'occupied' && 'Occupied'}
                      {bed.status === 'moving_out' && 'Moving Out'}
                      {bed.status === 'reserved' && 'Reserved'}
                      {bed.status === 'vacant' && 'Vacant'}
                    </Badge>
                  </div>

                  {/* Occupant / Reservation info */}
                  {isOccupied && bed.activeTenancy ? (
                    <div className="p-2.5 rounded-xl bg-surface-container/60 border border-border-subtle text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <User className="w-3.5 h-3.5 text-primary" />
                        <span>{bed.activeTenancy.tenants?.name || 'Occupant'}</span>
                      </div>
                      <div className="text-[11px] text-muted flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Since {formatDate(bed.activeTenancy.check_in_date)}</span>
                      </div>
                      {bed.activeTenancy.expected_move_out_date && (
                        <div className="text-[11px] text-status-moving-out font-medium flex items-center gap-1 pt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>
                            Moving out: {formatDate(bed.activeTenancy.expected_move_out_date)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : isReserved && bed.pendingBooking ? (
                    <div className="p-2.5 rounded-xl bg-status-reserved/10 border border-status-reserved/20 text-xs space-y-1">
                      <div className="font-semibold text-status-reserved">
                        {bed.pendingBooking.tenant_name}
                      </div>
                      <div className="text-[11px] text-muted">
                        Move-in: {formatDate(bed.pendingBooking.expected_move_in_date)} (Token: ₹{Number(bed.pendingBooking.paid_amount)})
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-status-vacant/10 border border-status-vacant/20 text-xs text-status-vacant font-medium">
                      Available for immediate check-in
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div
                  className="pt-3 border-t border-border-subtle flex items-center justify-between text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingBed(bed)}
                      className="p-1.5 text-muted hover:text-foreground hover:bg-surface-highest rounded-lg transition-colors cursor-pointer"
                      title="Edit Bed"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingBed(bed)}
                      className="p-1.5 text-muted hover:text-status-pending hover:bg-status-pending/10 rounded-lg transition-colors cursor-pointer"
                      title="Move to Trash"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <Button
                    variant={isOccupied ? 'tonal' : 'primary'}
                    size="sm"
                    onClick={() => handleBedClick(bed)}
                  >
                    {isOccupied ? 'View Occupant' : 'Check In'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Bed Modal */}
      <AddBedModal
        isOpen={isAddBedOpen}
        onClose={() => setIsAddBedOpen(false)}
        roomId={roomId}
        onSuccess={loadRoomAndBeds}
      />

      {/* Edit Bed Modal */}
      <EditBedModal
        isOpen={Boolean(editingBed)}
        onClose={() => setEditingBed(null)}
        bed={editingBed}
        onSuccess={loadRoomAndBeds}
      />

      {/* Check In Tenant Modal */}
      <AssignTenantModal
        isOpen={Boolean(assigningBed)}
        onClose={() => setAssigningBed(null)}
        bed={assigningBed}
        onSuccess={loadRoomAndBeds}
      />

      {/* Active Occupant Details Modal */}
      <ActiveTenancyModal
        isOpen={Boolean(selectedOccupiedBed)}
        onClose={() => setSelectedOccupiedBed(null)}
        bed={selectedOccupiedBed?.bed || null}
        tenancy={selectedOccupiedBed?.tenancy || null}
        onSuccess={loadRoomAndBeds}
      />

      {/* Delete Bed Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deletingBed)}
        onClose={() => setDeletingBed(null)}
        onConfirm={handleDeleteConfirm}
        title="Move Bed to Trash?"
        description={`Are you sure you want to move ${deletingBed?.bed_label} to Trash? You can restore it anytime from the Trash Hub.`}
        confirmText="Move to Trash"
        isDanger
        isLoading={isDeleting}
      />
    </div>
  );
}
