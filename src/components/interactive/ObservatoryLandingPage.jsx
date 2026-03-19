import { useNavigate } from "react-router-dom";

const TILE_CONFIG = [
  {
    id: "conversion",
    title: "Conversion %",
    description: "Track conversion performance trends over time with zone/GM/AM filters.",
    path: "/observatory/conversion",
  },
  {
    id: "leads",
    title: "Total Leads",
    description: "See overall lead volume and mix (rented, cancelled, unused) across periods.",
    path: "/observatory/leads",
  },
  {
    id: "leaderboard",
    title: "Org Leaderboard",
    description: "Compare GM performance and improvement rankings for the selected timeline.",
    path: "/observatory/leaderboard",
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
            className="text-left rounded-xl border border-[var(--neutral-200)] bg-white p-5 hover:border-[var(--hertz-primary)] hover:shadow-[var(--shadow-md)] transition-all cursor-pointer"
          >
            <h2 className="text-base font-semibold">{tile.title}</h2>
            <p className="text-sm text-[var(--neutral-600)] mt-2 leading-relaxed">{tile.description}</p>
            <span className="inline-flex items-center mt-4 text-xs font-semibold text-[var(--hertz-black)]">
              Open view
              <svg className="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
