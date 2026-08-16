# Rent-Hive Engineering Rules & Constraints

## 1. Absolute Constraints: The "Never Do This" List

The following list of design, visual, and copywriting anti-patterns are **strictly forbidden** across the entire codebase, styling, UI components, and documentation. These are hard constraints for every session:

> ### Hard Constraints: Never Use
> Never use: harsh gradients, blue-tinted sidebar icons, pure white backgrounds, rainbow coloring, drop shadows on everything, three-feature-cards-in-a-row layouts, emojis, 'liquid glass' effects, em dashes in copy, Inter or Space Grotesque as the primary font, discolored/faded stripe backgrounds, oversized testimonial blocks, bento-grid layouts, terminal-window visual motifs, 'it's not X, it's Y' copywriting, checkmark bullet lists, three-tier pricing sections, placeholder/fake product demos (must reflect real Rent-Hive data), soft/rounded corner radii as a default, generic purple-and-black color schemes, missing skeleton loaders (loading states ARE required), radial gradient 'orbs,' dot-grid background patterns, sparkle icons, animated arrows, missing Terms of Service, missing Privacy Policy, hover animations applied indiscriminately to every element, neon colors, generic pastel colors.

---

## 2. Product Context & UI Nature
- **Operational App UI Port**: Rent-Hive is an internal property operations platform (Dashboard, Tenant Management, Room & Bed Allocations, Electricity Billing, Payments Ledger, Reports, Trash).
- **Not a Marketing Landing Page**: Landing page patterns (such as three-tier pricing sections, customer testimonials, feature hero cards, marketing copy slogans) do not belong in this application. If any marketing or promotional section is ever requested, flag it explicitly to the user for confirmation rather than assuming where it goes.

---

## 3. Financial Calculation & Billing Rules
1. **Single Source of Truth**: All financial calculations (rent proration, utility bill splits, running balances, aggregate building dues, reports metrics) must use the pure calculation engine functions (`rent-calculator.ts`). Never calculate dues inline in UI components.
2. **Unified Pending Balance**:
   - Both the **Dashboard** and the **Reports** screen include electricity utility bill shares in the total pending balance calculation.
   - The Reports card explicitly presents both the total pending balance and an itemized breakdown of collected/pending rent vs. utilities.
3. **V2 Entry-Only Proration**:
   - Proration applies strictly to the tenant's first billing cycle.
   - Departure/checkout is never prorated (forfeited on exit).
   - `due_day` must always be clamped to the maximum days of the relevant month ($1 \le \text{due\_day} \le 31$, e.g., Day 31 clamped to Feb 28/29).
4. **Electricity Reading Split by Date**:
   - Room meter readings must be split across tenancies that occupied the room *on the reading date* (not current occupancy).
   - Round individual shares to the nearest whole Rupee ($₹$).
   - Vacant periods are not billed to new tenants.
5. **Advance Credit Floor**:
   - Individual negative balances represent advance credit.
   - When summing building-wide or reporting pending totals, individual dues are floored at $0$ ($\max(0, \text{dues})$) so that prepaid credits do not artificially reduce the total arrears owed by other tenants.

---

## 4. Bed Occupancy & Reservation State Rules
1. **Bed Status Invariants**:
   - **Vacant**: Bed has no active tenancy and no pending advance booking.
   - **Reserved**: Bed is attached to a pending advance booking (`status = 'pending'`). Must be visually displayed with a distinct **Teal** badge (`#007A78` / `#2DD4BF`) so landlords do not double-book.
   - **Occupied**: Bed has an active checked-in tenancy (`check_out_date IS NULL`).
   - **Moving Out Soon**: Tenant has an active notice or expected move-out date.

---

## 5. UI/UX Design System Discipline
1. **Color Tokens**:
   - **Light Mode**: Background `#FAF7F2` (Warm Beige, never pure `#FFFFFF`), Surface `#FFFFFF`, Primary `#6C4AB6`, Text `#241E30`.
   - **Dark Mode**: Background `#0D0F0D` (Near Black, never pure `#000000`), Surface `#161A16`, Primary `#3DDC84` (Parrot Green), Text `#EAF5EC`.
   - **Status Tokens (Brightness-Aware)**:
     - Occupied: Light `#3B6FD4` (Blue) / Dark `#82B1FF` (Light Blue)
     - Vacant: Light `#2E7D32` (Green) / Dark `#81C784` (Light Green)
     - Reserved: Light `#007A78` (Deep Teal) / Dark `#2DD4BF` (Bright Teal) — distinct separation from Primary Purple
     - Pending Dues: Light `#B3261E` (Red) / Dark `#FF8A80` (Light Red)
     - Moving Out Soon: Light `#F9A825` (Amber) / Dark `#FFD54F` (Light Amber)
2. **Typography Scale**:
   - Primary Font: **Plus Jakarta Sans** or **Geist** (Inter and Space Grotesque are strictly forbidden).
   - Display: 24px Bold (`text-2xl font-bold`)
   - Headline: 20px SemiBold (`text-xl font-semibold`)
   - Title: 17px Medium (`text-[17px] font-medium`)
   - Body Large: 15px Regular (`text-[15px]`)
   - Body Medium: 14px Regular (`text-sm`)
   - Caption / Small: 11–12px Regular (`text-xs`)
3. **Card Styling**:
   - Flat solid surface card with 1px border (`border-border/50` or `outlineVariant`).
   - Border radius: $16\text{px}$ to $20\text{px}$ (`rounded-2xl`).
   - No excessive drop shadows or glassmorphic blur distortions.
4. **Loading States**:
   - Skeleton pulse loaders are mandatory for every asynchronous data fetching state. Never show raw blank screens or unstyled text loaders.
5. **Narrow Viewport Safety (360dp)**:
   - All dialogs, sheets, and cards must fit comfortably on a 360px wide screen without horizontal overflow.
   - Never use fixed desktop pixel widths on modal dialogs. Use responsive max-width classes (`w-full max-w-md`).

---

## 6. Database & Soft-Delete Architecture Rules
1. **Row-Level Security (RLS)**: Every query must operate within the authenticated owner's scope (`auth.uid()`).
2. **Atomic Operations**:
   - Converting an advance booking to a tenancy + applying prepayment credit must execute inside the transactional Postgres RPC `convert_advance_booking`.
3. **Unified PostgreSQL Soft-Delete**:
   - All entities (`buildings`, `rooms`, `beds`, `tenants`, `meter_readings`, `payments`, `advance_bookings`) use a native PostgreSQL `deleted_at TIMESTAMPTZ` column.
   - An explicit migration script (`supabase/migrations/20260816000000_unified_soft_delete_and_schema.sql`) must be applied before soft-delete UI is built.
   - Zero local-storage trash state.
   - Active queries must filter `deleted_at IS NULL`.
   - Centralized Trash view queries `deleted_at IS NOT NULL`.
4. **User-Facing Error Handling**:
   - Never expose raw database errors or stack traces in toast messages. Map PostgREST error codes to clean, actionable English messages.
