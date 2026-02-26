import { motion } from "framer-motion";

const quartileColors = {
  1: "#2E7D32",
  2: "#F5C400",
  3: "#6E6E6E",
  4: "#C62828",
};

export default function ComplianceDashboard({ branchManagers, summaryCards }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Conversion Scoreboard</h2>
        <div className="space-y-3">
          {branchManagers.map((bm, i) => (
            <div key={bm.name} className="flex items-center gap-4">
              <span className="w-28 text-sm text-[#1A1A1A] font-medium truncate">{bm.name}</span>
              <div className="flex-1 bg-gray-50 rounded h-8 relative overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(bm.conversionRate / 100) * 100}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                  className="h-full rounded"
                  style={{ backgroundColor: quartileColors[bm.quartile] }}
                />
              </div>
              <span className="w-12 text-sm font-semibold text-right" style={{ color: quartileColors[bm.quartile] }}>
                {bm.conversionRate}%
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
            className="border border-[#E6E6E6] rounded-lg p-4"
          >
            <p className="text-xs text-[#6E6E6E] uppercase tracking-wide">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.color || "text-[#1A1A1A]"}`}>
              {card.value}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
