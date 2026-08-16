# Rent-Hive Implementation Roadmap & Phases

## Overview
This document outlines the systematic, phased porting of RENT-GRID to the Rent-Hive Next.js web application. Each phase has strict exit criteria before subsequent phases commence.

---

## Phase 0: Deep Analysis & Inventory of Source Code
- [x] Read and inspect all Dart files in `/home/gv1ndd/Projects/RentGrid/rent_grid/lib/`.
- [x] Read all six planning docs in `/home/gv1ndd/Projects/RentGrid/rent_grid/docs/`.
- [x] Produce comprehensive inventory of routes, components, design tokens, financial formulas, and ambiguity flags.
- **Exit Criteria**: Complete architectural understanding and documented inventory.

---

## Phase 1: Planning Document Suite
- [x] Create and refine `prd.md` detailing user personas, feature set, financial formulas, Reserved bed status, and non-goals.
- [x] Create and refine `architecture.md` detailing Next.js 16 + Supabase stack, RLS, unified PostgreSQL `deleted_at` schema, PWA offline caching/install architecture, and routing.
- [x] Create and refine `rules.md` containing the verbatim "Never Do This" hard constraints, app UI port boundaries, and calculation invariants.
- [x] Create and refine `phases.md` defining milestones and exit criteria.
- [x] Create and refine `design.md` defining exact hex color tokens, status tokens (incl. Deep Teal `#007A78` Reserved badge), typography scale, spacing, and responsive guidelines.
- [x] Create and refine `memory.md` logging technical decisions and historical context.
- **Exit Criteria**: Explicit approval of all 6 documents by the user. (Approved 2026-08-16).

---

## Phase 2: Detailed Technical Implementation Plan
- [x] Draft technical implementation plan artifact (`implementation_plan.md`).
- [x] Map all Flutter widgets and domain models to React 19 / Tailwind v4 components and TypeScript types.
- [x] Detail folder structure (`app/`, `components/`, `lib/`, `types/`, `hooks/`).
- [x] Define responsive navigation mapping (desktop sidebar vs. mobile bottom nav).
- [x] Outline PWA manifest, service worker caching strategy, platform install prompts, and Safari limitations.
- **Exit Criteria**: Explicit approval of Implementation Plan by the user. (Approved 2026-08-16).

---

## Phase 3: Project Foundation, Auth, App Shell & Database Migration
- [ ] Implement Supabase SQL migration (`supabase/migrations/20260816000000_unified_soft_delete_and_schema.sql`):
  - Add `deleted_at TIMESTAMPTZ` to `buildings`, `rooms`, `beds`, `tenants`, `meter_readings`, `advance_bookings`, `payments`.
  - Update RLS policies to enforce `deleted_at IS NULL` for active queries.
  - Deploy `convert_advance_booking` stored procedure.
- [ ] Setup Supabase Client (`@supabase/ssr`) with TypeScript database types.
- [ ] Implement Tailwind CSS v4 design tokens (Light/Dark themes, warm beige `#FAF7F2`, forest dark `#0D0F0D`, status colors incl. Deep Teal `#007A78` / Bright Teal `#2DD4BF` for Reserved).
- [ ] Configure Plus Jakarta Sans typography.
- [ ] Build Authentication Flow (`/login`) with Supabase email/password auth and session middleware.
- [ ] Build Responsive App Shell:
  - Desktop collapsible sidebar with building selector and theme toggle.
  - Mobile top bar and 3-tab bottom navigation bar (`Dashboard`, `Tenants`, `Electricity`).
- **Exit Criteria**: SQL migration applied, working login/logout, responsive navigation shell, working theme switch.

---

## Phase 4: Core Inventory Management & Unified Database Trash
- [ ] Buildings Management (`/buildings`): List, Add, Edit, Soft-delete (`deleted_at`).
- [ ] Global `ActiveBuildingContext` provider with persistent `localStorage`.
- [ ] Rooms Management (`/buildings/[id]/rooms`): List by floor, Add Room dialog.
- [ ] Beds Management (`/rooms/[id]/beds`): Bed list, status badges (Vacant, Reserved, Occupied, Moving Out Soon), rate configuration.
- [ ] Centralized Database Trash Bin (`/trash` & `/profile/trash`): PostgreSQL-backed soft-delete recovery and permanent purge across all entities.
- **Exit Criteria**: Full CRUD on property inventory, accurate active building scoping, real-time cross-device trash sync.

---

## Phase 5: Tenant Hub & Advance Bookings
- [ ] Tenant Management (`/tenants`): Scoped tenant directory with search.
- [ ] Tenant Check-In Flow:
  - New tenant vs. Existing tenant assignment.
  - Due day picker (1–31) and First Month Free toggle.
- [ ] Unified Move-Out Flow:
  - Past/Today $\rightarrow$ Immediate vacate.
  - Future $\rightarrow$ Notice given + expected move-out date ("Moving Out Soon" badge).
  - Final checkout confirmation dialog.
- [ ] Tenant History Hub (`/tenants/[id]/history`): Profile card, active room summary, stay history, tenant notes, payment ledger.
- [ ] Advance Bookings:
  - Pre-booking modal (`AddAdvanceBookingDialog`) marking reserved beds.
  - Atomic RPC check-in (`convert_advance_booking`) applying advance credit to first cycle.
- **Exit Criteria**: Tenant assignment, stay logs, unified move-out, and atomic advance conversions verified.

---

## Phase 6: Financial Engine, Payments & Utility Splitting
- [ ] Port `rent-calculator.ts` with V2 proration formula, due day clamping, and advance credit handling.
- [ ] Port `utility-splitter.ts` with date-of-reading occupancy allocation.
- [ ] Payments Ledger (`/payments`): Record payment modal, category filter chips, total summary bar.
- [ ] Electricity Tracker (`/electricity` & `/buildings/[id]/electricity`):
  - Room sub-meter reader, previous reading auto-fetch, bill calculator.
  - Reading history list with DB soft-delete support.
- **Exit Criteria**: 100% calculation parity with RENT-GRID across complex multi-cycle and utility test cases.

---

## Phase 7: Dashboard, Search & Reports
- [ ] Dominant Room Search (`/search`): Real-time lookup with occupant details, bed status (Vacant/Reserved/Occupied), meter reading, and recent payments.
- [ ] Dashboard Hero Metrics:
  - Tenants, Checked-In, Checked-Out, Rooms, Beds, Vacant Beds, Collections, Total Outstanding Dues.
- [ ] Dashboard Sub-pages:
  - `/dashboard/checked-in` (Active tenants + awaiting check-ins).
  - `/dashboard/checked-out` (Upcoming move-outs + history window filter).
  - `/dashboard/empty-beds` (Vacant bed browser).
  - `/dashboard/pending-balance` (Pending dues breakdown with electricity split).
- [ ] Reports & CSV Exporter (`/reports`): Custom date ranges, collected vs. pending totals (including electricity with itemized breakdown), occupancy rates, and downloadable CSV report.
- **Exit Criteria**: All dashboard counters, drilldowns, and reports matching DB aggregates.

---

## Phase 8: PWA, Observability, Polish & Deployment
- [ ] PWA Manifest (`manifest.ts`), icons, and service worker offline caching strategy (Cache-First for static assets, Network-First Stale-While-Revalidate for queries).
- [ ] Per-platform install prompt components (Chromium `beforeinstallprompt` banner + iOS Safari educational modal).
- [ ] Document iOS Safari limitations & mitigations (no native install banner, WebKit ITP 7-day storage eviction, push limitations).
- [ ] Sentry error monitoring and PostHog product analytics integration.
- [ ] End-to-end user journey testing on desktop and 360dp mobile viewports.
- [ ] Vercel deployment and CI/CD verification.
- **Exit Criteria**: Production-ready, lightning-fast Next.js PWA deployed to Vercel.
