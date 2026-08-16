# Rent-Hive Engineering Memory & Decision Log

## Project Genesis
- **Date**: 2026-08-16
- **Context**: Porting RENT-GRID (a single-owner Flutter mobile app for hostel and PG property management) to Rent-Hive, a high-performance Next.js 16 web application / PWA.
- **Source Repository**: `/home/gv1ndd/Projects/RentGrid/rent_grid`
- **Target Repository**: `/home/gv1ndd/Projects/RentHive/rent-hive`

---

## Key Technical Decisions & Invariants

### 1. User Decisions & Refinements (2026-08-16)
1. **Reports Pending Balance Calculation**: Unified with the Dashboard to include utility shares (electricity) in the total pending balance calculation, with an explicit itemized breakdown of collected/pending rent vs. utilities on the report card.
2. **Reserved Bed Status & Color**: Beds attached to an active pending advance booking (`status = 'pending'`) explicitly display a **Reserved** status badge using **Deep Teal** (`#007A78` in Light Mode / `#2DD4BF` in Dark Mode) to guarantee distinct visual contrast from Primary Purple (`#6C4AB6`).
3. **Unified PostgreSQL Soft-Delete**: Dropped device-local `localStorage` trash tracking in favor of a native PostgreSQL `deleted_at TIMESTAMPTZ` column across all entities (`buildings`, `rooms`, `beds`, `tenants`, `meter_readings`, `payments`, `advance_bookings`). Added an explicit SQL migration step before Phase 4.
4. **RPC Stored Procedure Name**: Confirmed exact Supabase PostgreSQL RPC name as `public.convert_advance_booking`.
5. **PWA Mobile Web Architecture**: Documented offline caching strategy (Cache-First static, Network-First SWR data), per-platform install prompt handling (Chromium `beforeinstallprompt` vs. iOS Safari helper modal), and WebKit Safari 7-day storage eviction mitigations.

### 2. Technology Selection
- **Frontend Framework**: Next.js 16.3.1 with React 19 and App Router.
- **Styling**: Tailwind CSS v4 using `@tailwindcss/postcss`. Zero-runtime CSS variable tokens for instant dark/light mode switching.
- **Typography**: Plus Jakarta Sans / Geist. *Inter and Space Grotesque were explicitly banned by project rules*.
- **Backend & Database**: Direct reuse of Supabase PostgreSQL and Supabase Auth.
- **Strict Boundary Decisions**:
  - *No Clerk*: Supabase SSR Auth is used natively.
  - *No Upstash Redis / Vector DB*: Postgres indexing handles all querying and filtering requirements.
  - *No External Payment Gateways*: All ledger payments are recorded manually by the property owner.

### 3. Operational App Boundaries
- Rent-Hive is strictly an operational property management tool, not a public marketing website.
- Marketing anti-patterns (e.g., pricing cards, customer testimonials, bento grids, em dashes in copy) are banned under `rules.md`.

### 4. Business Logic & Financial Invariants
- **V2 Proration**: Entry month is prorated based on days occupied within the first billing cycle; checkout/departure is forfeited (no exit proration).
- **Due Date Clamping**: Rent due day (1–31) is dynamically clamped to the last day of the month (e.g., Day 31 $\rightarrow$ Feb 28/29).
- **Electricity Reading Split**: Utility meter readings are split across tenancies active *on the reading date*, rounded to the nearest ₹.
- **Advance Credit Display**: Individual tenant overpayments/credits are displayed explicitly as advance credit, but floored at 0 ($\max(0, \text{dues})$) when aggregating building-wide or report-level pending balances.
- **Atomic Booking Conversion**: Conversion of advance bookings into tenancies and applying prepaid advance as rent credit executes in a single transactional PostgreSQL RPC (`public.convert_advance_booking`).

### 5. Layout & Navigation Invariants
- **Global-Dominant Active Building**: Selected building context is stored in persistent storage and shared across all screens. Changing building in one view updates all views.
- **Responsive Shell**:
  - Desktop: Collapsible 260px sidebar navigation.
  - Mobile: Top app bar + 3-tab bottom navigation (`Dashboard`, `Tenants`, `Electricity`).
- **360dp Narrow Viewport Safeguard**: Every dialog, form, and metric card is constrained against horizontal overflow at 360px viewport widths.

---

## Log of Completed Phases
- **Phase 0 (2026-08-16)**: Full codebase and documentation audit of RENT-GRID.
- **Phase 1 (2026-08-16)**: Creation and refinement of Rent-Hive 6-document planning suite (`prd.md`, `architecture.md`, `rules.md`, `phases.md`, `design.md`, `memory.md`). Approved by user.
- **Phase 2 (2026-08-16)**: Technical Implementation Plan for Next.js 16 with PWA details, Deep Teal Reserved token, confirmed RPC name, and migration step. Approved by user.
- **Phase 3 (2026-08-16)**: Implementation active.
