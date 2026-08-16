-- =============================================================================
-- Rent-Hive: Full Master Schema, Unified Soft Delete & convert_advance_booking RPC
--
-- Migration: 20260816000000_unified_soft_delete_and_schema.sql
-- Description:
--   Complete production schema for Rent-Hive on Supabase (PostgreSQL 15+).
--   Enforces Row-Level Security (RLS) scoped to auth.uid(), native deleted_at
--   soft-deletion across all tables, performance indexes, and the atomic
--   idempotent convert_advance_booking stored procedure.
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. TABLES DEFINITION
-- =============================================================================

-- 1.1 BUILDINGS
CREATE TABLE IF NOT EXISTS public.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 1.2 ROOMS
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  floor_number INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 1.3 BEDS
CREATE TABLE IF NOT EXISTS public.beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  bed_label TEXT NOT NULL,
  default_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 1.4 TENANTS
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  id_proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 1.5 TENANCIES
CREATE TABLE IF NOT EXISTS public.tenancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id UUID NOT NULL REFERENCES public.beds(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rate NUMERIC(10, 2) NOT NULL,
  due_day INT NOT NULL DEFAULT 1 CHECK (due_day >= 1 AND due_day <= 31),
  first_month_free BOOLEAN NOT NULL DEFAULT FALSE,
  check_in_date DATE NOT NULL,
  check_out_date DATE DEFAULT NULL,
  notice_given_date DATE DEFAULT NULL,
  expected_move_out_date DATE DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ DEFAULT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Partial Unique Index: Only one active tenancy per bed at any time
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_bed
ON public.tenancies (bed_id)
WHERE check_out_date IS NULL AND deleted_at IS NULL;

-- 1.6 PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rent', 'electricity', 'utility', 'maintenance', 'penalty')),
  date DATE NOT NULL,
  method TEXT DEFAULT NULL,
  receipt_number TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ DEFAULT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 1.7 ADVANCE BOOKINGS
CREATE TABLE IF NOT EXISTS public.advance_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  bed_id UUID REFERENCES public.beds(id) ON DELETE SET NULL,
  tenant_name TEXT NOT NULL,
  tenant_phone TEXT,
  total_amount NUMERIC(10, 2) NOT NULL,
  paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  expected_move_in_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'cancelled')),
  converted_tenancy_id UUID REFERENCES public.tenancies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 1.8 METERS (Electricity Sub-meters per Room)
CREATE TABLE IF NOT EXISTS public.meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  meter_number TEXT NOT NULL,
  rate_per_unit NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.9 METER READINGS
CREATE TABLE IF NOT EXISTS public.meter_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID NOT NULL REFERENCES public.meters(id) ON DELETE CASCADE,
  previous_reading NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  current_reading NUMERIC(10, 2) NOT NULL,
  units_consumed NUMERIC(10, 2) GENERATED ALWAYS AS (current_reading - previous_reading) STORED,
  amount_due NUMERIC(10, 2) NOT NULL,
  reading_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 1.10 TENANT NOTES
CREATE TABLE IF NOT EXISTS public.tenant_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- =============================================================================
-- 2. INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_buildings_owner_deleted ON public.buildings(owner_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_rooms_building_deleted ON public.rooms(building_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_beds_room_deleted ON public.beds(room_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_deleted ON public.tenants(owner_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tenancies_bed_deleted ON public.tenancies(bed_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tenancies_tenant_deleted ON public.tenancies(tenant_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_payments_tenancy_deleted ON public.payments(tenancy_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_advance_bookings_building_status ON public.advance_bookings(building_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_meters_room ON public.meters(room_id);
CREATE INDEX IF NOT EXISTS idx_meter_readings_meter_deleted ON public.meter_readings(meter_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tenant_notes_tenant_deleted ON public.tenant_notes(tenant_id, deleted_at);

-- =============================================================================
-- 3. ROW-LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advance_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_notes ENABLE ROW LEVEL SECURITY;

-- 3.1 Buildings Policy
DROP POLICY IF EXISTS "Owners can manage their buildings" ON public.buildings;
CREATE POLICY "Owners can manage their buildings" ON public.buildings
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 3.2 Rooms Policy
DROP POLICY IF EXISTS "Owners can manage rooms" ON public.rooms;
CREATE POLICY "Owners can manage rooms" ON public.rooms
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.buildings b
      WHERE b.id = rooms.building_id AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.buildings b
      WHERE b.id = rooms.building_id AND b.owner_id = auth.uid()
    )
  );

-- 3.3 Beds Policy
DROP POLICY IF EXISTS "Owners can manage beds" ON public.beds;
CREATE POLICY "Owners can manage beds" ON public.beds
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms r
      JOIN public.buildings b ON r.building_id = b.id
      WHERE r.id = beds.room_id AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rooms r
      JOIN public.buildings b ON r.building_id = b.id
      WHERE r.id = beds.room_id AND b.owner_id = auth.uid()
    )
  );

-- 3.4 Tenants Policy
DROP POLICY IF EXISTS "Owners can manage tenants" ON public.tenants;
CREATE POLICY "Owners can manage tenants" ON public.tenants
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 3.5 Tenancies Policy
DROP POLICY IF EXISTS "Owners can manage tenancies" ON public.tenancies;
CREATE POLICY "Owners can manage tenancies" ON public.tenancies
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.beds bd
      JOIN public.rooms r ON bd.room_id = r.id
      JOIN public.buildings b ON r.building_id = b.id
      WHERE bd.id = tenancies.bed_id AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.beds bd
      JOIN public.rooms r ON bd.room_id = r.id
      JOIN public.buildings b ON r.building_id = b.id
      WHERE bd.id = tenancies.bed_id AND b.owner_id = auth.uid()
    )
  );

-- 3.6 Payments Policy
DROP POLICY IF EXISTS "Owners can manage payments" ON public.payments;
CREATE POLICY "Owners can manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenancies t
      JOIN public.beds bd ON t.bed_id = bd.id
      JOIN public.rooms r ON bd.room_id = r.id
      JOIN public.buildings b ON r.building_id = b.id
      WHERE t.id = payments.tenancy_id AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenancies t
      JOIN public.beds bd ON t.bed_id = bd.id
      JOIN public.rooms r ON bd.room_id = r.id
      JOIN public.buildings b ON r.building_id = b.id
      WHERE t.id = payments.tenancy_id AND b.owner_id = auth.uid()
    )
  );

-- 3.7 Advance Bookings Policy
DROP POLICY IF EXISTS "Owners can manage advance bookings" ON public.advance_bookings;
CREATE POLICY "Owners can manage advance bookings" ON public.advance_bookings
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 3.8 Meters Policy
DROP POLICY IF EXISTS "Owners can manage meters" ON public.meters;
CREATE POLICY "Owners can manage meters" ON public.meters
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms r
      JOIN public.buildings b ON r.building_id = b.id
      WHERE r.id = meters.room_id AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rooms r
      JOIN public.buildings b ON r.building_id = b.id
      WHERE r.id = meters.room_id AND b.owner_id = auth.uid()
    )
  );

-- 3.9 Meter Readings Policy
DROP POLICY IF EXISTS "Owners can manage meter readings" ON public.meter_readings;
CREATE POLICY "Owners can manage meter readings" ON public.meter_readings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meters m
      JOIN public.rooms r ON m.room_id = r.id
      JOIN public.buildings b ON r.building_id = b.id
      WHERE m.id = meter_readings.meter_id AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meters m
      JOIN public.rooms r ON m.room_id = r.id
      JOIN public.buildings b ON r.building_id = b.id
      WHERE m.id = meter_readings.meter_id AND b.owner_id = auth.uid()
    )
  );

-- 3.10 Tenant Notes Policy
DROP POLICY IF EXISTS "Owners can manage tenant notes" ON public.tenant_notes;
CREATE POLICY "Owners can manage tenant notes" ON public.tenant_notes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants tn
      WHERE tn.id = tenant_notes.tenant_id AND tn.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenants tn
      WHERE tn.id = tenant_notes.tenant_id AND tn.owner_id = auth.uid()
    )
  );

-- =============================================================================
-- 4. ATOMIC CONVERT ADVANCE BOOKING RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION public.convert_advance_booking(
  p_booking_id UUID,
  p_bed_id UUID,
  p_rate NUMERIC,
  p_due_day INTEGER,
  p_first_month_free BOOLEAN,
  p_check_in_date DATE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking advance_bookings%ROWTYPE;
  v_tenant_id UUID;
  v_tenancy_id UUID;
  v_owner_id UUID;
BEGIN
  -- Lock the booking row for the duration of the transaction.
  SELECT * INTO v_booking
  FROM advance_bookings
  WHERE id = p_booking_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: This advance booking no longer exists.';
  END IF;

  SELECT auth.uid() INTO v_owner_id;
  IF v_booking.owner_id IS DISTINCT FROM v_owner_id THEN
    RAISE EXCEPTION 'NOT_OWNER: You do not have access to this booking.';
  END IF;

  -- Idempotency guard: only a 'pending' booking may be converted.
  IF v_booking.status <> 'pending' THEN
    RAISE EXCEPTION 'ALREADY_CONVERTED: This booking has already been converted.';
  END IF;

  -- Re-verify that target bed belongs to the booking's building and is not soft-deleted.
  IF NOT EXISTS (
    SELECT 1 FROM beds b
    JOIN rooms r ON r.id = b.room_id
    WHERE b.id = p_bed_id 
      AND r.building_id = v_booking.building_id
      AND b.deleted_at IS NULL
      AND r.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'BED_NOT_IN_BUILDING: The selected bed is not available in this building.';
  END IF;

  -- Bed vacancy pre-check
  IF EXISTS (
    SELECT 1 FROM tenancies
    WHERE bed_id = p_bed_id AND check_out_date IS NULL AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'BED_OCCUPIED: This bed is already occupied by an active tenancy.';
  END IF;

  -- Reuse existing tenant by name within the same owner scope or create new
  SELECT id INTO v_tenant_id
  FROM tenants
  WHERE name = v_booking.tenant_name AND owner_id = v_owner_id AND deleted_at IS NULL
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    v_tenant_id := gen_random_uuid();
    INSERT INTO tenants (id, owner_id, name, phone)
    VALUES (v_tenant_id, v_owner_id, v_booking.tenant_name, v_booking.tenant_phone);
  END IF;

  -- Insert tenancy record
  BEGIN
    INSERT INTO tenancies (
      bed_id, tenant_id, rate, due_day, first_month_free, check_in_date
    )
    VALUES (
      p_bed_id,
      v_tenant_id,
      p_rate,
      p_due_day,
      COALESCE(p_first_month_free, false),
      p_check_in_date
    )
    RETURNING id INTO v_tenancy_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'BED_OCCUPIED: This bed is already occupied by an active tenancy.';
  END;

  -- Auto-apply advance prepayment as rent credit
  IF v_booking.paid_amount > 0 THEN
    INSERT INTO payments (tenancy_id, amount, type, date, method, receipt_number)
    VALUES (
      v_tenancy_id,
      v_booking.paid_amount,
      'rent',
      p_check_in_date,
      'Advance Prepayment',
      'ADV-' || UPPER(SUBSTR(v_booking.id::TEXT, 1, 8))
    );
  END IF;

  -- Mark advance booking converted
  UPDATE advance_bookings
  SET status = 'converted', converted_tenancy_id = v_tenancy_id
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'tenancy_id', v_tenancy_id,
    'tenant_id', v_tenant_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.convert_advance_booking(UUID, UUID, NUMERIC, INTEGER, BOOLEAN, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_advance_booking(UUID, UUID, NUMERIC, INTEGER, BOOLEAN, DATE) TO authenticated;
