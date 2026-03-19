import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = "All",
  maxLabelItems = 2,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const anchorRef = useRef(null);

  const visibleOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, query]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const labelText = useMemo(() => {
    if (!selected.length) return placeholder;
    if (selected.length <= maxLabelItems) return selected.join(", ");
    return `${selected.slice(0, maxLabelItems).join(", ")} +${selected.length - maxLabelItems}`;
  }, [selected, placeholder, maxLabelItems]);

  const toggleValue = (value) => {
    if (selectedSet.has(value)) {
      onChange(selected.filter((v) => v !== value));
      return;
    }
    onChange([...selected, value]);
  };

  const selectAllVisible = () => {
    const merged = Array.from(new Set([...selected, ...visibleOptions]));
    onChange(merged);
  };

  const clearAll = () => onChange([]);

  return (
    <div className="relative">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--neutral-600)]">{label}</span>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 w-full min-w-[180px] px-3 py-2 border border-[var(--neutral-200)] rounded-md bg-white text-left text-sm text-[var(--hertz-black)] hover:border-[var(--neutral-400)] transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="truncate">{labelText}</span>
          <svg className="w-4 h-4 text-[var(--neutral-500)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
          </svg>
        </div>
      </button>

      {!!selected.length && (
        <div className="mt-1 flex flex-wrap gap-1">
          {selected.slice(0, 4).map((value) => (
            <span key={value} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-[var(--hertz-primary)]/20 text-[var(--hertz-black)] font-medium">
              {value}
              <button type="button" onClick={() => toggleValue(value)} className="text-[var(--neutral-600)] hover:text-[var(--hertz-black)]" aria-label={`Remove ${value}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          {selected.length > 4 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-[var(--neutral-100)] text-[var(--neutral-700)] font-medium">
              +{selected.length - 4}
            </span>
          )}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <>
            <button type="button" className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-label="Close filter" />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute z-40 mt-2 w-[260px] p-3 rounded-lg border border-[var(--neutral-200)] bg-white shadow-[var(--shadow-md)]"
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full px-2.5 py-1.5 text-sm border border-[var(--neutral-200)] rounded-md focus:outline-none focus:border-[var(--hertz-primary)]"
              />

              <div className="mt-2 flex items-center justify-between text-[11px]">
                <button type="button" onClick={selectAllVisible} className="font-semibold text-[var(--neutral-700)] hover:text-[var(--hertz-black)]">
                  Select all
                </button>
                <button type="button" onClick={clearAll} className="font-semibold text-[var(--neutral-700)] hover:text-[var(--hertz-black)]">
                  Clear
                </button>
              </div>

              <div className="mt-2 max-h-52 overflow-y-auto border border-[var(--neutral-100)] rounded-md">
                {visibleOptions.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-[var(--neutral-500)]">No matches</p>
                ) : (
                  visibleOptions.map((value) => {
                    const checked = selectedSet.has(value);
                    return (
                      <label key={value} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--neutral-50)] cursor-pointer">
                        <input type="checkbox" checked={checked} onChange={() => toggleValue(value)} className="rounded border-[var(--neutral-300)]" />
                        <span className="truncate">{value}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
