# HLES Insurance Replacement Overview

**Source**: HLES NOI.docx (Internal Hertz Documentation)

---

## Business Context

**Insurance Replacement (IR) Significance**:
- ~3% of total rental volume
- ~6.5% of total revenue
- Higher profit per rental than most other rental types

---

## Conversion Funnel (Data Flow)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  INSURANCE COMPANY                                                       │
│  Customer makes claim → Adjuster authorizes rental                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  TSD / HIRS (Third Party)                                                │
│  Adjuster creates reservation in HIRS                                    │
│  ⚠️ Data owned by TSD - limited query access                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  HLES (Hertz System)                                                     │
│                                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐           │
│  │  CRESER  │───▶│  CRA001  │───▶│  CSPLIT  │───▶│   CPAY   │           │
│  │ (Reserv) │    │(Contract)│    │ (Rental) │    │(Payment) │           │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘           │
│       │                              │                                   │
│       │         ┌──────────┐         │                                   │
│       └────────▶│ TRANSLOG │◀────────┘                                   │
│                 │ (Events) │                                             │
│                 └──────────┘                                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌──────────┐   ┌──────────┐    ┌──────────┐
              │   MMR    │   │   HRD    │    │  Local   │
              │(Mobile)  │   │(Call Ctr)│    │(Counter) │
              └──────────┘   └──────────┘    └──────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  HIRMS (Open Rentals Only)                                               │
│  Body shop ↔ Rental team communication                                   │
│  Notes sync with HLES                                                    │
│  ⚠️ Only captures data when rental is open                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## The 4 Stages of Conversion

### Stage 1: Adjuster Reservation
**Process**: Insurance adjuster sends reservation to Hertz

**Partner Types**:
- **Exclusive** (e.g., Elephant): Hertz is sole provider
- **Co-Primary** (e.g., State Farm): Adjuster can book with multiple providers simultaneously

**Data Gap**: HIRS data owned by TSD → cannot freely query to understand what adjusters actually send

---

### Stage 2: Initial Contact
**Process**: Hertz attempts to reach customer to confirm reservation

**Channels**:
- Local HLE calls customer
- HRD (centralized call center) calls customer
- MMR link sent via text for self-service confirmation

**Data**: Tables available in HLES to track initial contact

---

### Stage 3: Body Shop Touchpoint
**Process**: Customer drops car at body shop

**Competitive Risk**:
> "The body shop is a key point in the customer rental journey since this is where Enterprise is set up to close. Enterprise has a relationship with the body shops and will promote their business alongside or within the body shop."

**Data Gap**:
- HIRMS only captures data for **open rentals**
- If customer cancels or leaves reservation unused → stuck with limited CRESER data
- This is where significant information loss occurs

---

### Stage 4: Rental Location (Counter)
**Process**: Counter agent puts customer into a car

**Data**: Only available if rental opens; no data captured if customer doesn't show

---

## Ideal Customer Journey (Perfect Scenario)

1. Customer gets in accident or makes claim
2. Insurance company creates reservation for customer
3. Hertz receives reservation in HLES (→ CRESER)
4. Hertz sends MMR link for customer to confirm rental
5. If customer needs a ride → instructed to contact local HLE
6. If customer doesn't click MMR link → HRD or local team calls
7. Customer travels to rental location
8. Rental transaction occurs
9. Insurance company + body shop determine rental length and coordinate with Hertz

---

## Key Data Limitations

| Gap | Impact |
|-----|--------|
| HIRS data owned by TSD | Cannot analyze adjuster behavior or reservation source |
| HIRMS only for open rentals | Lose visibility on non-converted reservations |
| No body shop data for cancels | Cannot determine why customers chose competitors |
| Customer contact queue locked | Currently in contract negotiations, cannot alter |

---

## Insurance Company Preferences

- Prefer scheduling repairs on **Monday or Tuesday**
- Avoid rentals extending through weekends (while HLE locations are closed)
- This affects rental timing and potentially conversion patterns

---

## System Notes

**HLES Architecture**:
- Sits separate from all other Hertz systems
- Legacy system with manual workarounds
- Counter agents must physically get car key to input vehicle info
- Pulls vehicle data from CARS system → updates DASH

---

## Open Questions from Document

- How often are customers being substituted (different car than reserved)?
- How often does the reserved vehicle match what gets paid for? (Potential metric)
- Customer contact queue optimization (blocked by contract negotiations)
