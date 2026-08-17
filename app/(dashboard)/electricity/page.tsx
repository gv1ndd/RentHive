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
import { AddMeterReadingModal } from '@/components/electricity/add-meter-reading-modal';
import { EditMeterReadingModal } from '@/components/electricity/edit-meter-reading-modal';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import {
  Zap,
  Plus,
  Edit2,
  Trash2,
  Users,
  History,
  TrendingUp,
  Building2,
  Layers,
} from 'lucide-react';
import { Meter, MeterReading, Room } from '@/types/domain';

interface RoomMeterWithHistory {
  room: Room;
  meter: Meter;
  latestReading?: MeterReading;
  readings: MeterReading[];
  occupants: Array<{
    id: string;
    name: string;
    bedLabel: string;
  }>;
}

export default function ElectricityPage() {
  const { activeBuilding, activeBuildingId, isLoading: isBuildingLoading } = useActiveBuilding();
  const supabase = createClient();

  const [roomMeters, setRoomMeters] = useState<RoomMeterWithHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [loggingMeter, setLoggingMeter] = useState<{
    id: string;
    meter_number: string;
    rate_per_unit: number;
    room_id: string;
    room_number: string;
    lastReading: number;
  } | null>(null);

  const [editingReading, setEditingReading] = useState<{
    reading: MeterReading;
    ratePerUnit: number;
  } | null>(null);

  const [deletingReading, setDeletingReading] = useState<MeterReading | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadElectricityData = useCallback(async () => {
    if (!activeBuildingId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch all rooms with meters for this building
      const { data: roomsData } = await (supabase.from('rooms') as any)
        .select(`
          id,
          room_number,
          floor_number,
          building_id,
          meters (
            id,
            meter_number,
            rate_per_unit,
            room_id
          ),
          beds (
            id,
            bed_label,
            tenancies (
              id,
              check_out_date,
              deleted_at,
              tenants (
                id,
                name,
                deleted_at
              )
            )
          )
        `)
        .eq('building_id', activeBuildingId)
        .is('deleted_at', null)
        .order('room_number', { ascending: true });

      const rooms = (roomsData || []) as any[];

      // 2. Fetch all meter readings
      const meterIds = rooms.flatMap((r) => (r.meters || []).map((m: any) => m.id));
      const readingsByMeter: Record<string, MeterReading[]> = {};

      if (meterIds.length > 0) {
        const { data: readingsData } = await supabase
          .from('meter_readings')
          .select('*')
          .in('meter_id', meterIds)
          .is('deleted_at', null)
          .order('reading_date', { ascending: false });

        for (const r of (readingsData || []) as MeterReading[]) {
          if (!readingsByMeter[r.meter_id]) {
            readingsByMeter[r.meter_id] = [];
          }
          readingsByMeter[r.meter_id].push(r);
        }
      }

      // 3. Assemble list
      const list: RoomMeterWithHistory[] = [];

      for (const r of rooms) {
        const meter = r.meters?.[0];
        if (!meter) continue;

        const meterReadings = readingsByMeter[meter.id] || [];
        const latest = meterReadings[0];

        const occupants = (r.beds || []).flatMap((b: any) =>
          (b.tenancies || [])
            .filter((t: any) => !t.check_out_date && !t.deleted_at && !t.tenants?.deleted_at)
            .map((t: any) => ({
              id: t.id,
              name: t.tenants?.name || 'Occupant',
              bedLabel: b.bed_label,
            }))
        );

        list.push({
          room: {
            id: r.id,
            building_id: r.building_id,
            room_number: r.room_number,
            floor_number: r.floor_number,
            created_at: '',
            deleted_at: null,
          },
          meter,
          latestReading: latest,
          readings: meterReadings,
          occupants,
        });
      }

      setRoomMeters(list);
    } catch (e) {
      console.error('Error loading electricity data:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeBuildingId, supabase]);

  useEffect(() => {
    loadElectricityData();
  }, [loadElectricityData]);

  const handleDeleteReadingConfirm = async () => {
    if (!deletingReading) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('meter_readings')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deletingReading.id);

      if (error) throw error;

      setDeletingReading(null);
      await loadElectricityData();
    } catch (e) {
      console.error('Error soft-deleting reading:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  // Summary Metrics
  const totalUnits = roomMeters.reduce(
    (sum, rm) => sum + rm.readings.reduce((rSum, r) => rSum + Number(r.units_consumed), 0),
    0
  );
  const totalBilled = roomMeters.reduce(
    (sum, rm) => sum + rm.readings.reduce((rSum, r) => rSum + Number(r.amount_due), 0),
    0
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Electricity & Sub-Meters</h1>
          <p className="text-xs text-muted">
            {activeBuilding?.name || 'All Properties'} · Log monthly meter readings & split consumption across active occupants.
          </p>
        </div>

        <Link href="/buildings">
          <Button variant="outline" size="sm" leftIcon={<Layers className="w-4 h-4" />}>
            Manage Rooms
          </Button>
        </Link>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="space-y-1">
          <div className="flex items-center gap-2 text-muted text-xs">
            <Zap className="w-4 h-4 text-primary" />
            <span>Installed Sub-Meters</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{roomMeters.length}</div>
        </Card>

        <Card className="space-y-1">
          <div className="flex items-center gap-2 text-muted text-xs">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span>Total Units Consumed</span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {totalUnits.toLocaleString('en-IN')} <span className="text-xs text-muted">kWh</span>
          </div>
        </Card>

        <Card className="space-y-1">
          <div className="flex items-center gap-2 text-muted text-xs">
            <Zap className="w-4 h-4 text-status-pending" />
            <span>Total Utility Billed</span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(totalBilled)}
          </div>
        </Card>
      </div>

      {/* Room Meters Grid */}
      {isLoading || isBuildingLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : roomMeters.length === 0 ? (
        <Card className="py-16 text-center space-y-4 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-surface-highest text-muted flex items-center justify-center mx-auto">
            <Zap className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">No Sub-Meters Configured</h2>
            <p className="text-xs text-muted mt-1">
              Add sub-meters when creating or editing rooms to log electricity usage.
            </p>
          </div>
          <Link href="/buildings">
            <Button variant="primary" size="sm">
              Configure Rooms
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {roomMeters.map(({ room, meter, latestReading, readings, occupants }) => {
            const lastVal = latestReading ? Number(latestReading.current_reading) : 0;
            const perPersonShare =
              occupants.length > 0 && latestReading
                ? Math.round(Number(latestReading.amount_due) / occupants.length)
                : 0;

            return (
              <Card key={room.id} className="space-y-4 flex flex-col justify-between">
                {/* Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-foreground">
                          Room {room.room_number}
                        </h2>
                        <Badge variant="primary" size="sm">
                          <Zap className="w-3 h-3" />
                          <span>{meter.meter_number}</span>
                        </Badge>
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        Floor {room.floor_number} · Rate: ₹{Number(meter.rate_per_unit)}/unit
                      </p>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        setLoggingMeter({
                          id: meter.id,
                          meter_number: meter.meter_number,
                          rate_per_unit: Number(meter.rate_per_unit),
                          room_id: room.id,
                          room_number: room.room_number,
                          lastReading: lastVal,
                        })
                      }
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                    >
                      Log Reading
                    </Button>
                  </div>

                  {/* Latest Reading Highlights */}
                  {latestReading ? (
                    <div className="p-3.5 rounded-xl bg-surface-container/70 border border-border-subtle text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Latest Reading:</span>
                        <span className="font-bold text-foreground">
                          {Number(latestReading.current_reading)} units ({formatDate(latestReading.reading_date)})
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-t border-border-subtle pt-1.5">
                        <span className="text-muted">Consumption / Bill:</span>
                        <span className="font-bold text-primary">
                          {Number(latestReading.units_consumed)} kWh · {formatCurrency(Number(latestReading.amount_due))}
                        </span>
                      </div>

                      {/* Active Occupants Split */}
                      <div className="border-t border-border-subtle pt-1.5 flex items-center justify-between">
                        <span className="text-muted flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>{occupants.length} Occupant(s) Share:</span>
                        </span>
                        <span className="font-bold text-status-pending">
                          {perPersonShare > 0 ? `${formatCurrency(perPersonShare)} each` : '—'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-surface-container/40 text-xs text-muted text-center">
                      No readings logged yet for this room.
                    </div>
                  )}

                  {/* Past Readings Mini-Ledger */}
                  {readings.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                        Reading History ({readings.length})
                      </span>
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {readings.slice(0, 5).map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-surface/80 border border-border-subtle text-xs"
                          >
                            <div>
                              <span className="font-medium text-foreground">
                                {formatDate(r.reading_date)}
                              </span>
                              <span className="text-muted text-[11px] ml-2">
                                ({Number(r.units_consumed)} units)
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">
                                {formatCurrency(Number(r.amount_due))}
                              </span>
                              <button
                                onClick={() =>
                                  setEditingReading({
                                    reading: r,
                                    ratePerUnit: Number(meter.rate_per_unit),
                                  })
                                }
                                className="p-1 text-muted hover:text-foreground hover:bg-surface-highest rounded cursor-pointer"
                                title="Edit Reading"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setDeletingReading(r)}
                                className="p-1 text-muted hover:text-status-pending hover:bg-status-pending/10 rounded cursor-pointer"
                                title="Move to Trash"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Log Reading Modal */}
      <AddMeterReadingModal
        isOpen={Boolean(loggingMeter)}
        onClose={() => setLoggingMeter(null)}
        meter={loggingMeter}
        lastReading={loggingMeter?.lastReading || 0}
        onSuccess={loadElectricityData}
      />

      {/* Edit Reading Modal */}
      <EditMeterReadingModal
        isOpen={Boolean(editingReading)}
        onClose={() => setEditingReading(null)}
        reading={editingReading?.reading || null}
        ratePerUnit={editingReading?.ratePerUnit || 10}
        onSuccess={loadElectricityData}
      />

      {/* Delete Reading Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deletingReading)}
        onClose={() => setDeletingReading(null)}
        onConfirm={handleDeleteReadingConfirm}
        title="Move Reading to Trash?"
        description={`Are you sure you want to move this ${formatCurrency(Number(deletingReading?.amount_due || 0))} reading to Trash?`}
        confirmText="Move to Trash"
        isDanger
        isLoading={isDeleting}
      />
    </div>
  );
}
