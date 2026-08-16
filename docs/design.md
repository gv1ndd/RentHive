# Rent-Hive Design System Specification

## 1. Design Philosophy
Rent-Hive is an operational tool designed for high information density, rapid scannability, and frictionless data entry on both mobile phones and desktop displays. The visual language emphasizes clear borders, solid flat surfaces, high-contrast readable text, and semantic color indicators.

---

## 2. Color Palette & Design Tokens

### 2.1 Theme Palettes
The theme is warm and tactile in Light Mode and deep forest-tinted in Dark Mode.

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| **Background** | `#FAF7F2` (Warm Beige) | `#0D0F0D` (Near Black) | Main app page background |
| **Surface** | `#FFFFFF` | `#161A16` | Card and modal backgrounds |
| **Surface Container** | `#F7F4FC` | `#161C16` | Sub-card sections and table rows |
| **Surface Highest** | `#EDE7F6` | `#1E2A1E` | Search bars, input fills, dropdowns |
| **Primary (Accent)** | `#6C4AB6` (Deep Purple) | `#3DDC84` (Parrot Green) | Buttons, active icons, brand accents |
| **Primary Container** | `#E8DCFF` | `#005229` | Highlight banners, active badge bg |
| **On Primary Container**| `#21005D` | `#98F5C4` | Highlight banner text |
| **Text Primary** | `#241E30` (Near Black) | `#EAF5EC` (Near White) | Headlines, titles, primary labels |
| **Text Secondary** | `#6E6478` | `#9FB3A4` | Subtitles, captions, dates |
| **Outline / Border** | `#CAC4D0` | `#4A5E4D` | Form inputs, structural dividers |
| **Outline Variant** | `#E7E0EC` | `#2E3D2E` | Card borders, subtle separators |

### 2.2 Semantic Status Tokens (Brightness-Aware)
Status colors dynamically adapt to the active theme brightness to ensure WCAG AA contrast compliance:

| Status | Light Mode Hex | Dark Mode Hex | Usage |
|---|---|---|---|
| **Occupied / Checked-In** | `#3B6FD4` (Blue) | `#82B1FF` (Light Blue) | Occupied beds, active tenants |
| **Vacant / Available** | `#2E7D32` (Green) | `#81C784` (Light Green) | Vacant beds, paid-in-full receipts |
| **Reserved** | `#007A78` (Deep Teal) | `#2DD4BF` (Bright Teal) | Beds reserved by pending advance bookings (distinct from primary purple `#6C4AB6`) |
| **Pending / Overdue Dues**| `#B3261E` (Red) | `#FF8A80` (Light Red) | Unpaid rent balances, danger actions |
| **Moving Out Soon** | `#F9A825` (Amber) | `#FFD54F` (Light Amber) | Notice given, expected move-outs |

---

## 3. Typography Scale
- **Primary Font Family**: **Plus Jakarta Sans** or **Geist** (`font-sans`).
- **Forbidden Fonts**: Inter and Space Grotesque are strictly banned.

| Level | Size / Line Height | Weight | Tailwind Class | Usage |
|---|---|---|---|---|
| **Display** | 24px / 1.2 | Bold (700) | `text-2xl font-bold` | Dashboard revenue totals |
| **Headline** | 20px / 1.3 | SemiBold (600) | `text-xl font-semibold` | Page titles, major dialog titles |
| **Title** | 17px / 1.4 | Medium (500) | `text-[17px] font-medium` | Section headers, card titles |
| **Body Large** | 15px / 1.5 | Regular (400) / SemiBold (600) | `text-[15px]` | List items, table cells, form labels |
| **Body Medium** | 14px / 1.5 | Regular (400) | `text-sm` | Default text, descriptions |
| **Caption / Small**| 11–12px / 1.6 | Regular (400) / Bold (700) | `text-xs` | Badges, timestamps, secondary meta |

---

## 4. Spacing, Radius & Elevation Scale

### 4.1 Spacing Scale
- `xs`: 4px (`gap-1`, `p-1`)
- `sm`: 8px (`gap-2`, `p-2`)
- `md`: 12px (`gap-3`, `p-3`)
- `lg`: 16px (`gap-4`, `p-4`)
- `xl`: 20px (`gap-5`, `p-5`)
- `xxl`: 24px (`gap-6`, `p-6`)
- `xxxl`: 32px (`gap-8`, `p-8`)

### 4.2 Corner Radii
- **Cards & Dialogs**: 16px to 20px (`rounded-2xl`).
- **Buttons & Text Inputs**: 10px to 12px (`rounded-xl`).
- **Badges & Chips**: 6px to 8px (`rounded-lg`).

### 4.3 Card Styling
- Solid surface color (`bg-surface`).
- 1px crisp outline border (`border border-outline-variant`).
- Subtle ambient elevation (`shadow-xs` or `shadow-sm`).
- **No heavy blurry drop shadows, no glassmorphic distortion layers**.

---

## 5. Responsive Layout Architecture

### 5.1 Viewport Breakpoints
- **Mobile (< 1024px)**:
  - Top Bar with Logo, Active Building Dropdown, Quick Search, Profile.
  - Persistent 3-Tab Bottom Navigation Bar (`Dashboard`, `Tenants`, `Electricity`).
  - Full-width stacked cards, horizontal scroll filter chips.
- **Desktop ($\ge$ 1024px)**:
  - Fixed 260px Sidebar with collapsible navigation.
  - Top header with Global Building Switcher and Theme Toggle.
  - Multi-column grid layouts for Dashboard metrics and Room/Bed matrices.

### 5.2 360dp Narrow Viewport Safeguard
- Every dialog, sheet, and form is constrained to prevent horizontal overflow on 360px wide devices.
- Modals use responsive widths (`w-full max-w-md`) with 16px padding gutters.
- Numbers and currency amounts wrap or scale gracefully (`truncate` / `text-ellipsis`).

---

## 6. Micro-Interactions & Feedback
- **Skeleton Loaders**: Pulsing placeholder cards during data fetching (mandatory for all async screens).
- **Animated Counters**: Smooth 500ms easing transitions for metric counters.
- **Toasts**: Instant feedback for CRUD operations (success green, error red) with human-readable error descriptions.
