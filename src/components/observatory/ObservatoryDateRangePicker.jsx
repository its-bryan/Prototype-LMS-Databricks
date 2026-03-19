import { useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { DateRangeCalendar } from "../DateRangeCalendar";
import { formatDateRange } from "../../utils/dateTime";

export default function ObservatoryDateRangePicker({ start, end, onChange }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  const label = useMemo(() => {
    if (!start || !end) return "Select timeline";
    return formatDateRange(new Date(start), new Date(end));
  }, [start, end]);

  return (
    <div ref={anchorRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-2 border border-[var(--neutral-200)] rounded-md bg-white text-sm text-[var(--hertz-black)] hover:bg-[var(--neutral-50)] transition-colors"
      >
        {label}
      </button>

      <AnimatePresence>
        {open && (
          <DateRangeCalendar
            start={start}
            end={end}
            onChange={({ start: s, end: e }) => onChange?.({ start: s, end: e })}
            onClose={() => setOpen(false)}
            anchorRef={anchorRef}
            placement="bottom-start"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
