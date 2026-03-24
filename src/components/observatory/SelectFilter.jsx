import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function SelectFilter({ label, options, value, onChange, minWidth = 180 }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption?.label ?? "";

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div className="relative">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--neutral-600)]">{label}</span>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ minWidth }}
        className="mt-1 w-full px-3 py-2 border border-[var(--neutral-200)] rounded-md bg-white text-left text-sm text-[var(--hertz-black)] hover:border-[var(--neutral-400)] transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="truncate">{displayLabel}</span>
          <svg className="w-4 h-4 text-[var(--neutral-500)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
          </svg>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button type="button" className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-label="Close filter" />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute z-40 mt-2 w-full p-1 rounded-lg border border-[var(--neutral-200)] bg-white shadow-[var(--shadow-md)]"
            >
              <div className="max-h-52 overflow-y-auto">
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-[var(--neutral-50)] cursor-pointer transition-colors ${opt.value === value ? "bg-[var(--hertz-primary)]/10 font-semibold" : ""}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
