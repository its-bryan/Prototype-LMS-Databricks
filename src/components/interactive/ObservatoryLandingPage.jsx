import { useNavigate } from "react-router-dom";

const TILE_CONFIG = [
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

export default function ObservatoryLandingPage() {
  const navigate = useNavigate();

  return (
    <div className="px-6 py-5 space-y-5 text-[var(--hertz-black)]">
      <div>
        <h1 className="text-xl font-semibold">Observatory Tower</h1>
        <p className="text-sm text-[var(--neutral-600)] mt-1">
          Choose a view to explore company-wide trends and organizational performance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TILE_CONFIG.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => navigate(tile.path)}
            className="w-full text-left border-2 rounded-xl p-5 transition-all duration-200 cursor-pointer group border-[var(--neutral-200)] hover:border-[var(--hertz-primary)] hover:shadow-[var(--shadow-lg)] bg-white hover:bg-[var(--hertz-primary-subtle)]"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="shrink-0 w-12 h-12 rounded-lg bg-[var(--neutral-100)] group-hover:bg-[var(--hertz-primary)] flex items-center justify-center text-[var(--neutral-600)] group-hover:text-[var(--hertz-black)] transition-colors">
                  {tile.icon}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold text-[var(--hertz-black)] tracking-tight leading-snug">{tile.title}</h2>
                  <p className="text-sm text-[var(--neutral-600)] mt-0.5">{tile.description}</p>
                </div>
              </div>
              <div className="flex items-center shrink-0">
                <span className="text-[var(--neutral-400)] group-hover:text-[var(--hertz-black)] transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
