import { useNavigate } from "react-router-dom";

const BM_WORK_TILES = [
  {
    id: "bm-meeting-prep",
    title: "Meeting Prep",
    description: "Review branch performance and prep your weekly conversation.",
    path: "/bm/meeting-prep",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
      </svg>
    ),
  },
  {
    id: "bm-leaderboard",
    title: "Leaderboard",
    description: "See where your branch ranks this period.",
    path: "/bm/leaderboard",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3h14M9 3v2a3 3 0 003 3v0a3 3 0 003-3V3M5 3a2 2 0 00-2 2v1a4 4 0 004 4h0M19 3a2 2 0 012 2v1a4 4 0 01-4 4h0M7 10v1a5 5 0 005 5v0a5 5 0 005-5v-1M9 21h6M12 16v5" />
      </svg>
    ),
  },
  {
    id: "bm-leads",
    title: "My Leads",
    description: "Open and manage leads in your branch.",
    path: "/bm/leads",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    id: "bm-tasks",
    title: "Open Tasks",
    description: "Track and complete tasks assigned to your branch.",
    path: "/bm/tasks",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function BMWorkPage() {
  const navigate = useNavigate();

  return (
    <div className="px-6 py-5 space-y-5 text-[var(--hertz-black)]">
      <div>
        <h1 className="text-xl font-semibold">Work</h1>
        <p className="text-sm text-[var(--neutral-600)] mt-1">Choose a work area to continue.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {BM_WORK_TILES.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => navigate(tile.path)}
            className="w-full text-left border-2 rounded-xl p-5 transition-all duration-200 cursor-pointer group border-[var(--neutral-200)] hover:border-[var(--hertz-primary)] hover:shadow-[var(--shadow-lg)] bg-white hover:bg-[var(--hertz-primary-subtle)]"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="shrink-0 w-12 h-12 rounded-lg bg-[var(--hertz-primary)] flex items-center justify-center text-[var(--hertz-black)] transition-colors">
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
