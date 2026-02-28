import { motion, useReducedMotion } from "framer-motion";

const BAR_HEIGHT = 48;
const SEGMENTS = [
  { key: "rented", label: "Rented", color: "#2E7D32" },
  { key: "cancelled", label: "Cancelled", color: "#C62828" },
  { key: "unused", label: "Unused", color: "#FFD100" },
];

export default function LeadStackedBarChart({ total, rented, cancelled, unused }) {
  const reduceMotion = useReducedMotion();

  const values = { rented: rented ?? 0, cancelled: cancelled ?? 0, unused: unused ?? 0 };
  const totalLeads = total ?? (values.rented + values.cancelled + values.unused);
  const maxVal = Math.max(totalLeads, 1);

  if (totalLeads === 0) {
    return (
      <div className="border border-[var(--neutral-200)] rounded-lg p-10 bg-white text-center">
        <p className="text-sm text-[var(--neutral-600)]">No leads for this range.</p>
      </div>
    );
  }

  return (
    <div className="border border-[var(--neutral-200)] rounded-lg bg-white shadow-[var(--shadow-md)] overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        <p className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wider mb-3">
          Lead Pipeline
        </p>

        <div className="flex items-center gap-6 mb-3 flex-wrap">
          {SEGMENTS.map((seg) => (
            <div key={seg.key} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-[11px] font-medium text-[var(--neutral-600)]">
                {seg.label}: {values[seg.key]}
              </span>
            </div>
          ))}
        </div>

        <div className="relative">
          <div
            className="flex h-12 rounded-lg overflow-hidden border border-[var(--neutral-200)]"
            style={{ minHeight: BAR_HEIGHT }}
          >
            {SEGMENTS.map((seg, i) => {
              const val = values[seg.key];
              const pct = val / maxVal;
              const w = Math.max(0, pct * 100);
              return (
                <motion.div
                  key={seg.key}
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: `${w}%` }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: [0.4, 0, 0.2, 1] }}
                  className="h-full flex-shrink-0 flex items-center justify-center"
                  style={{
                    backgroundColor: seg.color,
                    minWidth: val > 0 ? 4 : 0,
                  }}
                  title={`${seg.label}: ${val}`}
                >
                  {val > 0 && w > 12 && (
                    <span className="text-[11px] font-bold text-white drop-shadow-sm">
                      {val}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
