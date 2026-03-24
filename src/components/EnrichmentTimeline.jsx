import { motion } from "framer-motion";

const roleStyles = {
  bm: { color: "var(--color-success)", bg: "bg-[var(--color-success-light)]", border: "border-[var(--color-success)]/40", label: "BM" },
  gm: { color: "var(--hertz-primary)", bg: "bg-[var(--color-warning-light)]", border: "border-[var(--color-warning)]/40", label: "GM" },
};

export default function EnrichmentTimeline({ entries = [] }) {
  if (entries.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wide mb-2">
          Comment History
        </h3>
        <p className="text-sm text-[var(--neutral-600)] italic">No comment history yet</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wide mb-3">
        Comment History
      </h3>
      <div className="space-y-0">
        {entries.map((entry, i) => {
          const style = roleStyles[entry.role] || roleStyles.bm;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-3 items-start"
            >
              {/* Timeline rail */}
              <div className="flex flex-col items-center">
                <div
                  className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: style.color }}
                />
                {i < entries.length - 1 && <div className="w-px flex-1 min-h-6 bg-[var(--neutral-200)]" />}
              </div>

              {/* Entry card */}
              <div className={`flex-1 mb-3 rounded border px-3 py-2 ${style.bg} ${style.border}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                    style={{ backgroundColor: style.color }}
                  >
                    {style.label}
                  </span>
                  <span className="text-xs font-medium text-[var(--hertz-black)]">{entry.author}</span>
                  <span className="text-xs text-[var(--neutral-600)] ml-auto">{entry.time}</span>
                </div>
                <p className="text-xs font-medium text-[var(--neutral-600)] mb-0.5">{entry.action}</p>
                {entry.notes && (
                  <p className="text-sm text-[var(--hertz-black)] leading-relaxed">{entry.notes}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
