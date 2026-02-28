# Hertz Component Inventory

> Reference when building or normalizing UI components. Each component includes the Hertz-specific treatment.

---

## 1. Buttons

### Primary CTA
- **Background**: `#FFD100` (brand gold)
- **Text**: `#272425` (brand black), font-weight: 700, font-size: 16px
- **Letter-spacing**: 0.025em
- **Padding**: 12px 24px
- **Border-radius**: 6px
- **Hover**: Background darkens to `#E6BC00`, subtle scale(1.02) transform
- **Active**: scale(0.98), background `#CC9F00`
- **Disabled**: Background `#F2F2F2`, text `#888888`
- **Usage**: Book Now, Reserve, Confirm, primary actions

### Secondary Button
- **Background**: transparent
- **Border**: 2px solid `#272425`
- **Text**: `#272425`, font-weight: 600
- **Padding**: 12px 24px
- **Border-radius**: 6px
- **Hover**: Background fills to `#272425`, text flips to `#FFFFFF`
- **Usage**: View Details, Compare, Learn More

### Ghost / Tertiary
- **Background**: transparent
- **Border**: none
- **Text**: `#272425`, font-weight: 600, underline on hover
- **Usage**: Cancel, Skip, Back, inline actions

### Destructive
- **Background**: `#C62828`
- **Text**: `#FFFFFF`, font-weight: 700
- **Usage**: Remove, Cancel Booking (rare, only for destructive actions)

---

## 2. Navigation

### Top Navigation Bar
- **Background**: `#272425` (brand black)
- **Height**: 64px desktop, 56px mobile
- **Logo**: Hertz wordmark in `#FFD100` — left-aligned
- **Nav links**: `#FFFFFF`, font-weight: 500, 14px, uppercase with 0.05em letter-spacing
- **Active link**: `#FFD100` text or gold underline (2px)
- **CTA button in nav**: Gold primary button, smaller padding (8px 16px)
- **Mobile**: Hamburger icon in white, slide-out drawer with black background

### Breadcrumbs
- **Text**: `#666666`, font-size: 14px
- **Separator**: `/` or `›` in `#AAAAAA`
- **Active/current**: `#272425`, font-weight: 600
- **No background** — sits directly on page background

---

## 3. Cards

### Vehicle Card
- **Container**: White background, 1px solid `#E5E5E5` border, border-radius: 8px
- **Shadow**: `0 2px 8px rgba(39, 36, 37, 0.08)` — subtle elevation
- **Hover**: Shadow grows to `lg`, slight translateY(-2px)
- **Image area**: Top 60% of card, edge-to-edge, light grey `#F8F8F8` background behind car
- **Vehicle name**: 18px, font-weight: 700, `#272425`
- **Category tag**: 12px, uppercase, letter-spacing 0.05em, `#666666`
- **Price**: 24px, font-weight: 800, `#272425` — with "/day" in 14px regular
- **Features**: Row of small icons (passengers, bags, doors, transmission) in `#666666`
- **CTA**: Gold primary button, full-width at bottom of card

### Info Card (generic)
- **Container**: White, border-radius: 8px, padding: 24px
- **Title**: 18px, font-weight: 700
- **Body**: 16px, line-height: 1.5, `#333333`
- **No excessive internal dividers** — use spacing to separate content

---

## 4. Forms

### Text Input
- **Height**: 48px
- **Border**: 1px solid `#CCCCCC`, border-radius: 6px
- **Focus**: Border color `#272425` (2px), subtle box-shadow `0 0 0 3px rgba(255, 209, 0, 0.2)` (gold glow)
- **Label**: Above input, 14px, font-weight: 600, `#272425`
- **Placeholder**: `#888888`, font-weight: 400
- **Error state**: Border `#C62828`, error message below in 12px `#C62828`

### Select / Dropdown
- Same dimensions as text input
- Custom chevron icon on right side in `#272425`
- Dropdown menu: White, shadow `lg`, border-radius: 6px, max-height: 300px with scroll

### Date Picker
- Calendar grid with clear day/month navigation
- Selected date: `#FFD100` background with `#272425` text
- Today: Outlined with `#272425` border
- Range selection: Gold tint `#FFE566` fill between dates

### Search / Location Input
- Same as text input but with a search icon (magnifying glass) on the left
- Autocomplete dropdown follows the dropdown spec above
- Location pin icon for pickup/return locations

---

## 5. Booking Flow Components

### Booking Form (Hero Section)
- **Background**: Full-width hero image (road/car) with dark overlay (40-60% opacity `#272425`)
- **Form card**: White or semi-transparent white, border-radius: 12px, padding: 32px, elevated shadow
- **Layout**: Horizontal on desktop (location → dates → times → search button), stacked on mobile
- **Search CTA**: Large gold primary button, prominent and unmissable

### Progress Stepper
- **Style**: Horizontal steps connected by a line
- **Completed step**: `#272425` filled circle with white checkmark
- **Current step**: `#FFD100` filled circle with `#272425` number
- **Upcoming step**: `#CCCCCC` outlined circle with grey number
- **Connecting line**: `#272425` for completed segments, `#CCCCCC` for upcoming

### Price Summary Sidebar
- **Background**: `#F8F8F8`
- **Border-radius**: 8px
- **Section dividers**: 1px solid `#E5E5E5`
- **Total price**: Large (24-30px), font-weight: 800, `#272425`
- **Gold highlight bar** under the total line

---

## 6. Status & Feedback

### Badges / Tags
- **Vehicle class**: Uppercase, 12px, letter-spacing 0.05em, `#666666` text on `#F2F2F2` background, border-radius: 4px, padding: 4px 8px
- **Availability**: Green `#2E7D32` dot + "Available" text, or red dot for unavailable
- **Promo badge**: `#FFD100` background, `#272425` text, bold, border-radius: 4px

### Toast Notifications
- **Success**: Left border 4px `#2E7D32`, white background, shadow `md`
- **Error**: Left border 4px `#C62828`
- **Info**: Left border 4px `#1565C0`
- **Position**: Top-right, slides in from right, auto-dismiss after 5s
- **Close button**: `×` in `#666666`

### Loading States
- **Skeleton screens**: `#F2F2F2` blocks with subtle shimmer animation (left-to-right gradient sweep)
- **Spinner**: `#FFD100` arc on `#E5E5E5` track (NOT a rainbow spinner)
- **Progress bar**: `#FFD100` fill on `#E5E5E5` track

---

## 7. Footer

- **Background**: `#272425` (brand black)
- **Text**: `#AAAAAA` for links, `#FFFFFF` for section headings
- **Columns**: 4 columns desktop (Company, Rent, Deals, Support), stacked on mobile
- **Bottom bar**: Legal text in 12px `#666666`, separated by `|`
- **Social icons**: White, 20px, hover to `#FFD100`

---

## 8. Icons

- **Style**: Outlined (not filled), 1.5px stroke weight
- **Default color**: `#272425` or `#666666` depending on context
- **Size**: 20px for inline, 24px for standalone, 32px for feature icons
- **Active/selected**: `#FFD100` fill or stroke
- **Source**: Lucide, Phosphor, or Heroicons (outlined variants) — consistent set throughout

---

## 9. Gold Plus Rewards (Loyalty)

- **Accent color**: `#C9A94E` (gold)
- **Badge style**: Gold border, subtle gold gradient background
- **Premium tier cards**: Slightly elevated shadow, gold top border (3px)
- **Member benefits**: Checkmark icons in gold
