'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useActiveBuilding } from '@/lib/context/active-building-context';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { AddBuildingModal } from '@/components/buildings/add-building-modal';
import { EditBuildingModal } from '@/components/buildings/edit-building-modal';
import { Building2, Plus, Edit2, Trash2, ArrowRight, MapPin, CheckCircle2, Link2, Check } from 'lucide-react';
import { Building } from '@/types/domain';
import { softDeleteBuilding } from '@/lib/services/inventory-service';

interface BuildingWithCounts extends Building {
  roomCount: number;
  bedCount: number;
}

export default function BuildingsPage() {
  const { activeBuildingId, setActiveBuildingId, refreshBuildings } = useActiveBuilding();
  const supabase = createClient();

  const [buildings, setBuildings] = useState<BuildingWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [deletingBuilding, setDeletingBuilding] = useState<Building | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadBuildings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: buildingsData, error } = await supabase
        .from('buildings')
        .select(`
          *,
          rooms (
            id,
            deleted_at,
            beds (
              id,
              deleted_at
            )
          )
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const list: BuildingWithCounts[] = (buildingsData || []).map((b: any) => {
        const activeRooms = (b.rooms || []).filter((r: any) => !r.deleted_at);
        const activeBeds = activeRooms.flatMap((r: any) =>
          (r.beds || []).filter((bd: any) => !bd.deleted_at)
        );

        return {
          id: b.id,
          owner_id: b.owner_id,
          name: b.name,
          address: b.address,
          created_at: b.created_at,
          deleted_at: b.deleted_at,
          roomCount: activeRooms.length,
          bedCount: activeBeds.length,
        };
      });

      setBuildings(list);
    } catch (e) {
      console.error('Error loading buildings:', e);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadBuildings();
  }, [loadBuildings]);

  const handleAddSuccess = async (newBuilding: Building) => {
    await loadBuildings();
    await refreshBuildings();
    setActiveBuildingId(newBuilding.id);
  };

  const handleEditSuccess = async () => {
    await loadBuildings();
    await refreshBuildings();
  };

  const handleDeleteConfirm = async () => {
    if (!deletingBuilding) return;
    setIsDeleting(true);

    try {
      await softDeleteBuilding(supabase, deletingBuilding.id);

      setDeletingBuilding(null);
      await loadBuildings();
      await refreshBuildings();
    } catch (e) {
      console.error('Error soft-deleting building:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Managed Properties</h1>
          <p className="text-xs text-muted">
            Configure buildings, floors, rooms, and individual bed inventory.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAddOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Property
        </Button>
      </div>

      {/* Buildings List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : buildings.length === 0 ? (
        <Card className="py-16 text-center space-y-4 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center mx-auto">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">No Properties Found</h2>
            <p className="text-xs text-muted mt-1">
              Add your first building to start organizing rooms and beds.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add First Property
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {buildings.map((building) => {
            const isActive = building.id === activeBuildingId;

            return (
              <Card
                key={building.id}
                className={`flex flex-col justify-between space-y-4 relative ${
                  isActive ? 'border-primary ring-1 ring-primary/30' : ''
                }`}
              >
                {/* Top Section */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-surface-highest flex items-center justify-center text-primary">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-foreground leading-snug">
                          {building.name}
                        </h2>
                        {building.address && (
                          <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{building.address}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {isActive && (
                      <Badge variant="primary" size="sm">
                        <CheckCircle2 className="w-3 h-3" />
                        Active
                      </Badge>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <Badge variant="neutral" size="sm">
                      {building.roomCount} Rooms
                    </Badge>
                    <Badge variant="neutral" size="sm">
                      {building.bedCount} Total Beds
                    </Badge>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={async () => {
                        const url = `${window.location.origin}/onboard/${building.id}`;
                        await navigator.clipboard.writeText(url);
                        setCopiedId(building.id);
                        setTimeout(() => setCopiedId(null), 2500);
                      }}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] ${
                        copiedId === building.id
                          ? 'text-status-vacant bg-status-vacant/10 font-semibold'
                          : 'text-muted hover:text-primary hover:bg-primary/10'
                      }`}
                      title="Copy Self-Serve Tenant Onboarding Link"
                    >
                      {copiedId === building.id ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied Link!</span>
                        </>
                      ) : (
                        <>
                          <Link2 className="w-3.5 h-3.5" />
                          <span>Onboarding Link</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setEditingBuilding(building)}
                      className="p-1.5 text-muted hover:text-foreground hover:bg-surface-highest rounded-lg transition-colors cursor-pointer"
                      title="Edit Property"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingBuilding(building)}
                      className="p-1.5 text-muted hover:text-status-pending hover:bg-status-pending/10 rounded-lg transition-colors cursor-pointer"
                      title="Move to Trash"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isActive && (
                      <button
                        onClick={() => setActiveBuildingId(building.id)}
                        className="text-[11px] font-semibold text-muted hover:text-foreground cursor-pointer"
                      >
                        Set Active
                      </button>
                    )}
                    <Link href={`/buildings/${building.id}/rooms`}>
                      <Button variant="tonal" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                        Manage
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      <AddBuildingModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={handleAddSuccess}
      />

      {/* Edit Modal */}
      <EditBuildingModal
        isOpen={Boolean(editingBuilding)}
        onClose={() => setEditingBuilding(null)}
        building={editingBuilding}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deletingBuilding)}
        onClose={() => setDeletingBuilding(null)}
        onConfirm={handleDeleteConfirm}
        title="Move Property to Trash?"
        description={`Are you sure you want to move "${deletingBuilding?.name}" to Trash? You can restore it anytime from the Trash Hub.`}
        confirmText="Move to Trash"
        isDanger
        isLoading={isDeleting}
      />
    </div>
  );
}
