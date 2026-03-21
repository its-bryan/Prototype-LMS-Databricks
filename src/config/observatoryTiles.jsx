export const OBSERVATORY_TILES = [
  {
    id: "conversion",
    title: "Conversion %",
    description: "Track conversion performance trends over time with zone/GM/AM filters.",
    path: "/observatory/conversion",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19h16M7 16V9m5 7V5m5 11v-4" />
      </svg>
    ),
  },
  {
    id: "leads",
    title: "Total Leads",
    description: "See overall lead volume and mix (rented, cancelled, unused) across periods.",
    path: "/observatory/leads",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    ),
  },
  {
    id: "leaderboard",
    title: "Org Leaderboard",
    description: "Compare GM performance and improvement rankings for the selected timeline.",
    path: "/observatory/leaderboard",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m6 10V4m5 13V10M4 21h16" />
      </svg>
    ),
  },
];
