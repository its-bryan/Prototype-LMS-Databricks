import { useNavigate } from "react-router-dom";
import { OBSERVATORY_TILES } from "../../config/observatoryTiles";

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
        {OBSERVATORY_TILES.map((tile) => (
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
