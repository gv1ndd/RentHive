# Rent-Hive Product Requirements Document (PRD)

## 1. Product Overview
**Rent-Hive** is a high-efficiency, mobile-first and desktop-responsive Property & Hostel Management web application (PWA) designed specifically for Paying Guest (PG) and hostel owners. It is a modern Next.js port of the RENT-GRID mobile platform, optimized for daily operational tasks: tenant check-ins/check-outs, bed allocations, rent and utility tracking, payment records, advance bookings, and financial analytics.

---

## 2. Target User & Core Persona
- **Target User**: Individual PG / Hostel owners or managers managing 1 to 5 properties (typically 10–200 beds total).
- **Usage Pattern**: Multi-device, single-owner access (mobile phone while walking the property floor, laptop/desktop at reception or home office).
- **Core Needs**:
  - Instant visibility into vacant, reserved, and occupied beds across rooms and floors.
  - Zero-friction tenant onboarding and single-tap checkout.
  - Automated rent calculation with transparent entry proration and utility bill splitting.
  - Quick room search and tenant history lookup.
  - Accurate outstanding dues tracking without double-counting or hidden negative balances.

---

## 3. Core Feature Requirements

### 3.1 Authentication & Property Context
- **Email/Password Auth**: Secure owner sign-in powered by Supabase Auth.
- **Global Active Building Context**: Owners can switch between managed properties. The selected building is globally dominant across all screens (Dashboard, Tenants, Rooms, Beds, Electricity, Payments, and Search).

### 3.2 Inventory Hierarchy & Management
- **Buildings**: Create, view, edit, and soft-delete buildings.
- **Rooms**: Organized by floor number and room number.
- **Beds**: Named bed labels (e.g., Bed A, Bed B) with individual monthly rate configurations.
- **Visual Status Engine**:
  - **Vacant**: Available for immediate tenant assignment or advance reservation.
  - **Reserved**: Assigned to an active pending advance booking awaiting check-in date.
  - **Occupied**: Assigned to an active checked-in tenancy.
  - **Moving Out Soon**: Tenant has submitted move-out notice with a future departure date.

### 3.3 Tenant Lifecycle & Tenancy Tracking
- **Check-In**: Assign either a new tenant (name, phone) or an existing tenant from history to a vacant/reserved bed.
  - Configurable monthly rent rate.
  - Configurable rent due day (1st to 31st of month).
  - Optional "First Month Free" promotional grace period.
- **Stay History**: Complete chronological log of all past and current stays for every tenant.
- **Tenant Notes**: Timestamped operational notes (e.g., maintenance requests, behavioral notes).
- **Unified Move-Out Flow**: Single date picker workflow:
  - If picked date is **today or in the past** $\rightarrow$ Immediate check-out, bed becomes vacant immediately.
  - If picked date is **in the future** $\rightarrow$ Sets notice given date to today and expected move-out date to the selected date. Bed displays "Moving Out Soon" badge. Final check-out confirmed on departure date.

### 3.4 Advance Bookings & Conversions
- **Pre-Booking**: Record prospective tenants with agreed monthly rate, advance token payment, expected move-in date, and optional room/bed reservation.
- **Reserved Bed Status**: When a bed is selected for an advance booking, its status transitions to **Reserved** until checked in or cancelled.
- **Atomic Check-In RPC**: Convert advance booking to active tenancy in a single transactional database call (`convert_advance_booking`), applying the advance token payment directly as a rent credit against the first billing cycle.

### 3.5 Billing, Utility Splitting & Financial Engine
- **V2 Rent Proration Formula**:
  - **Entry Month**: Prorated from `check_in_date` to the first billing cycle date:
    $$\text{Prorated Rent} = \text{rate} \times \left(\frac{\text{days occupied in 1st cycle}}{\text{total days in 1st cycle}}\right) \quad (\text{rounded to nearest ₹})$$
  - **Subsequent Months**: Flat full monthly rate per billing cycle.
  - **Exit Month**: Not prorated (forfeited on exit per hostel standard policy).
  - **First Month Free**: First billing cycle rent charge is waived ($₹0$ rent), while utilities remain billable.
- **Electricity & Utility Splitting**:
  - Room-level sub-meter readings (previous reading, current reading, rate per unit).
  - Billed amounts are split among tenancies active on the reading date:
    $$\text{Tenant Share} = \text{round}\left(\frac{\text{reading amount}}{\text{occupancy on reading date}}\right)$$
  - Vacant room readings are not charged to incoming tenants.
- **Running Balance Calculation**:
  - $\text{Total Charged} = \text{Total Rent Charged} + \text{Total Utility Shares}$
  - $\text{Total Paid} = \sum \text{Payments (rent + electricity)}$
  - $\text{Pending Balance} = \text{Total Charged} - \text{Total Paid}$
  - Overpayments display explicitly as "Advance Credit" (pending balance floored at $0$ for building-wide outstanding aggregates).

### 3.6 Payments & Collections
- Record payments categorized by type (`rent`, `electricity`, `maintenance`, `penalty`).
- Optional payment method (`Cash`, `UPI`, `Bank Transfer`, `Cheque`) and receipt number.
- Filter by payment type and view collection totals.
- Soft-delete, restore, and permanent deletion support.

### 3.7 Dashboard & Fast Operations
- **Dominant Search Bar**: Rapid search by room number surfacing occupants, bed availability/reservation status, meter readings, and recent room payment history.
- **Hero Metric Cards**: Total Tenants, Checked In, Checked Out, Total Rooms, Total Beds, Empty Beds, Received This Month (with electricity breakdown), and Total Outstanding Balance.
- **Upcoming Move-Outs**: Real-time counter of tenants nearing expected checkout date.
- **Pending Balance & Move-Out Drilldowns**: Dedicated sub-views for debt collection and departure management.

### 3.8 Reports, Analytics & CSV Export
- Custom date-range reporting for collected rent, pending balance (including electricity to match Dashboard metrics, with an itemized rent vs. electricity breakdown), maintenance, penalty, and electricity collections.
- Occupancy rate metrics over selected periods.
- One-click CSV export of payment records with full relational data (date, building, room, bed, tenant name, type, amount, method, receipt).

### 3.9 Multi-Device Database Trash System
- Centralized Trash bin powered by PostgreSQL `deleted_at` timestamp across all entities (Buildings, Rooms, Beds, Tenants, Meter Readings, and Payments).
- Replaces device-local storage so deletions and restorations sync in real time across all owner devices.
- Accidental deletions are recoverable; permanent purge is explicit.

---

## 4. Non-Goals (Out of Scope for MVP)
- ❌ External payment gateway integration (Razorpay, Stripe, UPI deep linking) — all payments are recorded manually by the owner.
- ❌ Tenant-facing login portal or self-service app.
- ❌ Multi-owner / Staff role permission matrices (single owner per property portfolio).
- ❌ Automated offline sync engines (RxDB / WatermelonDB) — online-first PWA with optimistic caching.
- ❌ Complex AI chatbot integrations or marketing lead gen funnels.

---

## 5. Success Metrics
- **Sub-100ms** client route navigation and instant search results.
- **Zero rounding discrepancies** between tenant history dues, reports, and building aggregate balances.
- **100% data parity** with existing Supabase schema and RENT-GRID database.
