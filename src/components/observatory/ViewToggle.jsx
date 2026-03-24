/**
 * My View / Company View toggle for Observatory Tower.
 */
export default function ViewToggle({ viewMode, setViewMode, disabled }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--neutral-600)]">
        View
      </span>
      <div className="inline-flex rounded-md border border-[var(--neutral-200)] bg-[var(--neutral-50)] p-0.5">
        <button
          type="button"
          onClick={() => setViewMode("my")}
          disabled={disabled}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
            viewMode === "my"
              ? "bg-[var(--hertz-primary)] text-[var(--hertz-black)] shadow-sm"
              : "text-[var(--neutral-600)] hover:text-[var(--hertz-black)]"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          My View
        </button>
        <button
          type="button"
          onClick={() => setViewMode("company")}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
            viewMode === "company"
              ? "bg-[var(--hertz-primary)] text-[var(--hertz-black)] shadow-sm"
              : "text-[var(--neutral-600)] hover:text-[var(--hertz-black)]"
          }`}
        >
          Company View
        </button>
      </div>
    </div>
  );
}
