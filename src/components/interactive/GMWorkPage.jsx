import { useNavigate } from "react-router-dom";

const GM_WORK_TILES = [
  {
    id: "gm-meeting-prep",
    title: "Meeting Prep",
    description: "Prepare branch-by-branch talking points for your weekly meeting.",
    path: "/gm/meeting-prep",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
      </svg>
    ),
  },
  {
    id: "gm-leads",
    title: "My Leads",
    description: "Review leads across your branches.",
    path: "/gm/leads",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    id: "gm-leaderboard",
    title: "Team Leaderboard",
    description: "Compare branch performance and ranking.",
    path: "/gm/leaderboard",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3h14M9 3v2a3 3 0 003 3v0a3 3 0 003-3V3M5 3a2 2 0 00-2 2v1a4 4 0 004 4h0M19 3a2 2 0 012 2v1a4 4 0 01-4 4h0M7 10v1a5 5 0 005 5v0a5 5 0 005-5v-1M9 21h6M12 16v5" />
      </svg>
    ),
  },
  {
    id: "gm-activity-report",
    title: "Activity Report",
    description: "Review outreach activity and coaching opportunities.",
    path: "/gm/activity-report",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-3m3 3V7m3 10v-5m3 9H6a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

export default function GMWorkPage() {
  const navigate = useNavigate();

  return (
    <div className="px-6 py-5 space-y-5 text-[var(--hertz-black)]">
      <div>
        <h1 className="text-xl font-semibold">Work</h1>
        <p className="text-sm text-[var(--neutral-600)] mt-1">Choose a work area to continue.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GM_WORK_TILES.map((tile) => (
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
