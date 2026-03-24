import { motion } from "framer-motion";

const quartileColors = {
  1: "var(--color-success)",
  2: "var(--hertz-primary)",
  3: "var(--neutral-600)",
  4: "var(--color-error)",
};

export default function ComplianceDashboard({ branchManagers, summaryCards }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-[var(--hertz-black)] mb-4">Conversion Scoreboard</h2>
        <div className="space-y-3">
          {branchManagers.map((bm, i) => (
            <div key={bm.name} className="flex items-center gap-4">
              <span className="w-28 text-sm text-[var(--hertz-black)] font-medium truncate">{bm.name}</span>
              <div className="flex-1 bg-[var(--neutral-50)] rounded h-8 relative overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${((bm.conversionRate ?? 0) / 100) * 100}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                  className="h-full rounded"
                  style={{ backgroundColor: quartileColors[bm.quartile] }}
                />
              </div>
              <span className="w-12 text-sm font-semibold text-right text-[var(--hertz-black)]">
                {bm.conversionRate != null ? `${bm.conversionRate}%` : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {summaryCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + i * 0.15 }}
            className="border border-[var(--neutral-200)] rounded-lg p-4"
          >
            <p className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wide">{card.label}</p>
            <p className="text-2xl font-bold mt-1 text-[var(--hertz-black)]">
              {card.value}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
