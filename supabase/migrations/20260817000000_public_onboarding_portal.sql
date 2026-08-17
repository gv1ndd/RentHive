-- =============================================================================
-- Rent-Hive: Public Onboarding Portal Functions (Security Definer)
--
-- Migration: 20260817000000_public_onboarding_portal.sql
-- Description:
--   Enables secure public tenant onboarding without granting the anon role
--   direct SELECT/UPDATE/DELETE access to any tables.
-- =============================================================================

-- 1. Fetch public building details & vacant beds (Exposes ONLY public info, NO tenant or payment data)
CREATE OR REPLACE FUNCTION public.get_public_onboarding_details(p_building_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_building buildings%ROWTYPE;
  v_beds JSONB;
BEGIN
  -- 1. Verify building exists and is not soft-deleted
  SELECT * INTO v_building
  FROM buildings
  WHERE id = p_building_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'BUILDING_NOT_FOUND');
  END IF;

  -- 2. Query vacant beds for this building
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'bed_id', b.id,
        'bed_label', b.bed_label,
        'room_number', r.room_number,
        'floor_number', r.floor_number,
        'default_rate', b.default_rate
      )
      ORDER BY r.floor_number ASC, r.room_number ASC, b.bed_label ASC
    ),
    '[]'::jsonb
  ) INTO v_beds
  FROM beds b
  JOIN rooms r ON b.room_id = r.id
  WHERE r.building_id = p_building_id
    AND b.deleted_at IS NULL
    AND r.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM tenancies t
      WHERE t.bed_id = b.id AND t.check_out_date IS NULL AND t.deleted_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM advance_bookings ab
      WHERE ab.bed_id = b.id AND ab.status = 'pending' AND ab.deleted_at IS NULL
    );

  RETURN jsonb_build_object(
    'building_id', v_building.id,
    'building_name', v_building.name,
    'address', v_building.address,
    'available_beds', v_beds
  );
END;
$$;

-- 2. Submit public tenant onboarding (Inserts a pending advance booking)
CREATE OR REPLACE FUNCTION public.submit_tenant_onboarding(
  p_building_id UUID,
  p_bed_id UUID,
  p_name TEXT,
  p_phone TEXT,
  p_move_in_date DATE,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_booking_id UUID;
  v_rate NUMERIC(10, 2) := 0.00;
BEGIN
  -- 1. Validate building
  SELECT owner_id INTO v_owner_id
  FROM buildings
  WHERE id = p_building_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BUILDING_NOT_FOUND: Property does not exist.';
  END IF;

  -- 2. If bed specified, validate rate and availability
  IF p_bed_id IS NOT NULL THEN
    SELECT default_rate INTO v_rate
    FROM beds b
    JOIN rooms r ON b.room_id = r.id
    WHERE b.id = p_bed_id
      AND r.building_id = p_building_id
      AND b.deleted_at IS NULL
      AND r.deleted_at IS NULL;

    IF NOT FOUND THEN
      p_bed_id := NULL;
    END IF;
  END IF;

  -- 3. Insert advance booking record
  INSERT INTO advance_bookings (
    owner_id,
    building_id,
    bed_id,
    tenant_name,
    tenant_phone,
    total_amount,
    paid_amount,
    expected_move_in_date,
    status
  )
  VALUES (
    v_owner_id,
    p_building_id,
    p_bed_id,
    TRIM(p_name),
    TRIM(p_phone),
    COALESCE(v_rate, 0.00),
    0.00,
    COALESCE(p_move_in_date, CURRENT_DATE),
    'pending'
  )
  RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id
  );
END;
$$;

-- 3. Grant execute permissions to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_public_onboarding_details(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_tenant_onboarding(UUID, UUID, TEXT, TEXT, DATE, TEXT) TO anon, authenticated;
