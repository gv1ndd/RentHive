import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

/**
 * Soft-deletes a building and cascades deleted_at to all its rooms and beds.
 */
export async function softDeleteBuilding(
  supabase: SupabaseClient<Database>,
  buildingId: string
) {
  const now = new Date().toISOString();

  // 1. Fetch active room IDs
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id')
    .eq('building_id', buildingId)
    .is('deleted_at', null);

  const roomIds = (rooms || []).map((r) => r.id);

  // 2. Soft-delete building
  const { error: bErr } = await supabase
    .from('buildings')
    .update({ deleted_at: now })
    .eq('id', buildingId);

  if (bErr) throw bErr;

  // 3. Soft-delete rooms, beds, and check out active tenancies
  if (roomIds.length > 0) {
    const { data: beds } = await supabase
      .from('beds')
      .select('id')
      .in('room_id', roomIds)
      .is('deleted_at', null);

    const bedIds = (beds || []).map((b) => b.id);
    if (bedIds.length > 0) {
      await supabase
        .from('tenancies')
        .update({ check_out_date: new Date().toISOString().split('T')[0] })
        .in('bed_id', bedIds)
        .is('check_out_date', null)
        .is('deleted_at', null);

      await supabase
        .from('beds')
        .update({ deleted_at: now })
        .in('id', bedIds);
    }

    await supabase.from('rooms').update({ deleted_at: now }).in('id', roomIds);
  }
}

/**
 * Restores a soft-deleted building and restores its associated rooms and beds.
 */
export async function restoreBuilding(
  supabase: SupabaseClient<Database>,
  buildingId: string
) {
  // 1. Fetch building deletion timestamp before clearing
  const { data: bData } = await supabase
    .from('buildings')
    .select('deleted_at')
    .eq('id', buildingId)
    .single();

  const bTime = bData?.deleted_at ? new Date(bData.deleted_at).getTime() : 0;

  // 2. Restore building
  const { error: bErr } = await supabase
    .from('buildings')
    .update({ deleted_at: null })
    .eq('id', buildingId);

  if (bErr) throw bErr;

  // 3. Restore rooms and beds under this building that were deleted alongside the building
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, deleted_at')
    .eq('building_id', buildingId);

  const roomsToRestore = (rooms || []).filter((r) => {
    if (!r.deleted_at) return false;
    if (!bTime) return true;
    const rTime = new Date(r.deleted_at).getTime();
    return Math.abs(rTime - bTime) < 120000; // Deleted within 2 minutes of building
  });

  const roomIds = roomsToRestore.map((r) => r.id);

  if (roomIds.length > 0) {
    await supabase.from('rooms').update({ deleted_at: null }).in('id', roomIds);
    await supabase.from('beds').update({ deleted_at: null }).in('room_id', roomIds);
  }
}

/**
 * Soft-deletes a bed and automatically checks out any active tenancy to ex-tenants.
 */
export async function softDeleteBed(
  supabase: SupabaseClient<Database>,
  bedId: string,
  checkoutDate: string = new Date().toISOString().split('T')[0]
) {
  const now = new Date().toISOString();

  // 1. Check out active tenancy on this bed
  await supabase
    .from('tenancies')
    .update({ check_out_date: checkoutDate })
    .eq('bed_id', bedId)
    .is('check_out_date', null)
    .is('deleted_at', null);

  // 1b. Unassign bed from pending advance bookings to avoid dangling bed references
  await supabase
    .from('advance_bookings')
    .update({ bed_id: null })
    .eq('bed_id', bedId)
    .eq('status', 'pending')
    .is('deleted_at', null);

  // 2. Soft-delete bed
  const { error } = await supabase
    .from('beds')
    .update({ deleted_at: now })
    .eq('id', bedId);

  if (error) throw error;
}

/**
 * Soft-deletes a room and cascades deleted_at to all its beds, checking out active occupants.
 */
export async function softDeleteRoom(
  supabase: SupabaseClient<Database>,
  roomId: string,
  checkoutDate: string = new Date().toISOString().split('T')[0]
) {
  const now = new Date().toISOString();

  // 1. Fetch active beds in this room
  const { data: beds } = await supabase
    .from('beds')
    .select('id')
    .eq('room_id', roomId)
    .is('deleted_at', null);

  const bedIds = (beds || []).map((b) => b.id);

  // 2. Check out all active occupants across these beds
  if (bedIds.length > 0) {
    await supabase
      .from('tenancies')
      .update({ check_out_date: checkoutDate })
      .in('bed_id', bedIds)
      .is('check_out_date', null)
      .is('deleted_at', null);

    // 2b. Unassign pending advance bookings from deleted beds/room
    await supabase
      .from('advance_bookings')
      .update({ bed_id: null, room_id: null })
      .in('bed_id', bedIds)
      .eq('status', 'pending')
      .is('deleted_at', null);

    // 3. Soft-delete attached beds
    await supabase
      .from('beds')
      .update({ deleted_at: now })
      .in('id', bedIds);
  }

  // 4. Soft-delete room
  const { error: rErr } = await supabase
    .from('rooms')
    .update({ deleted_at: now })
    .eq('id', roomId);

  if (rErr) throw rErr;
}

/**
 * Restores a soft-deleted room and its beds, also restoring parent building if it was soft-deleted.
 */
export async function restoreRoom(
  supabase: SupabaseClient<Database>,
  roomId: string
) {
  // 1. Fetch room to find building_id
  const { data: room } = await supabase
    .from('rooms')
    .select('building_id')
    .eq('id', roomId)
    .single();

  // 2. Restore room and its beds
  await supabase.from('rooms').update({ deleted_at: null }).eq('id', roomId);
  await supabase.from('beds').update({ deleted_at: null }).eq('room_id', roomId);

  // 3. If parent building is soft-deleted, restore it as well
  if (room?.building_id) {
    await supabase
      .from('buildings')
      .update({ deleted_at: null })
      .eq('id', room.building_id);
  }
}

/**
 * Restores a soft-deleted bed, also ensuring parent room and building are restored.
 */
export async function restoreBed(
  supabase: SupabaseClient<Database>,
  bedId: string
) {
  // 1. Restore bed
  await supabase.from('beds').update({ deleted_at: null }).eq('id', bedId);

  // 2. Fetch parent room to ensure it is restored
  const { data: bed } = await supabase
    .from('beds')
    .select('room_id, rooms (building_id)')
    .eq('id', bedId)
    .single();

  if (bed?.room_id) {
    await supabase
      .from('rooms')
      .update({ deleted_at: null })
      .eq('id', bed.room_id);

    const bedData = bed as { room_id?: string; rooms?: { building_id?: string } | null } | null;
    const buildingId = bedData?.rooms?.building_id;
    if (buildingId) {
      await supabase
        .from('buildings')
        .update({ deleted_at: null })
        .eq('id', buildingId);
    }
  }
}

/**
 * Automatically checks out any active tenancies attached to deleted rooms or beds.
 * Ensures no ghost active records remain across dashboard, pending balances, or tenant directory.
 */
export async function cleanupOrphanedTenancies(
  supabase: SupabaseClient<Database>,
  buildingId?: string
) {
  try {
    const { data: tenancies } = await (supabase.from('tenancies') as any)
      .select(`
        id,
        beds (
          id,
          deleted_at,
          rooms (
            id,
            building_id,
            deleted_at
          )
        )
      `)
      .is('deleted_at', null)
      .is('check_out_date', null);

    if (!tenancies || tenancies.length === 0) return;

    const orphanedIds = tenancies
      .filter((t: any) => {
        if (buildingId && t.beds?.rooms?.building_id !== buildingId) return false;
        const isBedDeleted = !t.beds || t.beds.deleted_at != null;
        const isRoomDeleted = !t.beds?.rooms || t.beds.rooms.deleted_at != null;
        return isBedDeleted || isRoomDeleted;
      })
      .map((t: any) => t.id);

    if (orphanedIds.length > 0) {
      await supabase
        .from('tenancies')
        .update({ check_out_date: new Date().toISOString().split('T')[0] })
        .in('id', orphanedIds);
    }
  } catch (err) {
    console.error('Error cleaning up orphaned tenancies:', err);
  }
}

