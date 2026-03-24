import { useState } from "react";
import { motion } from "framer-motion";
import { useData } from "../../context/DataContext";

const filters = [
  { key: "branches", label: "Branches" },
  { key: "gms", label: "GMs" },
  { key: "ams", label: "AMs" },
  { key: "zones", label: "Zones" },
  { key: "overall", label: "Overall" },
];

function getRateColor(rate) {
  if (rate >= 70) return "var(--color-success)";
  if (rate >= 65) return "var(--hertz-black)";
  return "var(--color-error)";
}

function BarVisual({ rate, maxRate, delta }) {
  const width = (rate / maxRate) * 100;
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 h-5 bg-[var(--neutral-100)] rounded overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full rounded"
          style={{ backgroundColor: getRateColor(rate) }}
        />
      </div>
      <span className="text-sm font-semibold w-12 text-right" style={{ color: getRateColor(rate) }}>
        {rate}%
      </span>
      {delta !== undefined && (
        <span className={`text-xs font-medium w-10 text-right ${delta > 0 ? "text-[var(--color-success)]" : delta < 0 ? "text-[var(--color-error)]" : "text-[var(--neutral-600)]"}`}>
          {delta > 0 ? `↑+${delta}` : delta < 0 ? `↓${delta}` : "—"}
        </span>
      )}
    </div>
  );
}

function getOverallData(leaderboardData) {
  const overall = [
    ...leaderboardData.branches.map((b) => ({ ...b, type: "Branch" })),
    ...leaderboardData.gms.map((g) => ({ ...g, type: "GM" })),
    ...leaderboardData.ams.map((a) => ({ ...a, type: "AM" })),
    ...leaderboardData.zones.map((z) => ({ ...z, type: "Zone" })),
  ];
  return overall.sort((a, b) => b.conversionRate - a.conversionRate);
}

function getColumnLabel(filter) {
  switch (filter) {
    case "branches": return "Branch";
    case "gms": return "General Manager";
    case "ams": return "Area Manager";
    case "zones": return "Zone";
    case "overall": return "Name";
    default: return "Name";
  }
}

function getSecondaryLabel(filter) {
  switch (filter) {
    case "branches": return "Leads";
    case "gms":
    case "ams":
    case "zones":
      return "Branches";
    case "overall": return "Type";
    default: return "";
  }
}

export default function InteractiveLeaderboard() {
  const { leaderboardData, branchManagers } = useData();
  const [activeFilter, setActiveFilter] = useState("branches");
  const [sortByImproved, setSortByImproved] = useState(false);

  let data = activeFilter === "overall"
    ? getOverallData(leaderboardData)
    : leaderboardData[activeFilter].map((d, i) => ({ ...d, rank: i + 1 }));

  if (sortByImproved && activeFilter === "branches") {
    data = [...data].sort((a, b) => {
      const deltaA = (a.conversionRate - (a.priorConversionRate ?? a.conversionRate));
      const deltaB = (b.conversionRate - (b.priorConversionRate ?? b.conversionRate));
      return deltaB - deltaA;
    });
  }

  const maxRate = Math.max(...data.map((d) => d.conversionRate ?? 0));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--hertz-black)]">Leaderboard</h1>
        <div className="w-12 h-1 bg-[var(--hertz-primary)] mt-2" />
        <p className="text-sm text-[var(--neutral-600)] mt-2">Conversion rate rankings across the organization</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-[var(--neutral-100)] rounded-lg p-1 w-fit">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
              activeFilter === f.key
                ? "bg-[var(--hertz-primary)] text-[var(--hertz-black)]"
                : "text-[var(--neutral-600)] hover:text-[var(--hertz-black)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sort toggle for branches */}
      {activeFilter === "branches" && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setSortByImproved(false)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              !sortByImproved ? "bg-[var(--hertz-black)] text-white" : "bg-[var(--neutral-100)] text-[var(--neutral-600)] hover:bg-[var(--neutral-200)]"
            }`}
          >
            Top Rate
          </button>
          <button
            onClick={() => setSortByImproved(true)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              sortByImproved ? "bg-[var(--hertz-black)] text-white" : "bg-[var(--neutral-100)] text-[var(--neutral-600)] hover:bg-[var(--neutral-200)]"
            }`}
          >
            Most Improved
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border border-[var(--neutral-200)] rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[3rem_1fr_5rem_1fr] gap-4 px-4 py-3 bg-[var(--neutral-50)] border-b border-[var(--neutral-200)] text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wide">
          <span>#</span>
          <span>{getColumnLabel(activeFilter)}</span>
          <span className="text-right">{getSecondaryLabel(activeFilter)}</span>
          <span>Conversion Rate</span>
        </div>

        {/* Rows */}
        {data.map((row, i) => (
          <motion.div
            key={`${activeFilter}-${row.name}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className={`grid grid-cols-[3rem_1fr_5rem_1fr] gap-4 px-4 py-3 items-center ${
              i < data.length - 1 ? "border-b border-[var(--neutral-200)]" : ""
            } ${i < 3 ? "bg-[var(--hertz-primary)]/5" : ""}`}
          >
            <span className={`text-sm font-bold ${i < 3 ? "text-[var(--hertz-primary)]" : "text-[var(--neutral-600)]"}`}>
              {i + 1}
            </span>
            <span className="text-sm text-[var(--hertz-black)] font-medium">{row.name}</span>
            <span className="text-sm text-[var(--neutral-600)] text-right">
              {activeFilter === "overall" ? row.type : (row.leads ?? row.branches)}
            </span>
            <BarVisual rate={row.conversionRate} maxRate={maxRate} delta={row.priorConversionRate !== undefined ? row.conversionRate - row.priorConversionRate : undefined} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
