import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import BackButton from "../BackButton";
import {
  getGMBranchLeaderboard,
  getDateRangePresets,
  resolveGMName,
  normalizeGmName,
} from "../../selectors/demoSelectors";
import BranchDetailPane from "./BranchDetailPane";
import { GMLeaderboardSkeleton, usePageTransition } from "../DashboardSkeleton";

function getMetricColor(val, meta) {
  if (meta?.value === "total" || val == null) return "var(--hertz-black)";
  if (val >= 70) return "var(--color-success)";
  if (val >= 65) return "var(--hertz-black)";
  return "#C62828";
}

const SORT_METRICS = [
  { value: "conversionRate", label: "Conversion Rate", suffix: "%" },
  { value: "pctWithin30", label: "% < 30 min", suffix: "%" },
  { value: "commentRate", label: "Comment Rate", suffix: "%" },
  { value: "branchHrdPct", label: "Branch Contact %", suffix: "%" },
  { value: "total", label: "Total Leads", suffix: "" },
  { value: "mostImproved", label: "Most Improved", suffix: " pp" },
];

function fmtMD(d) {
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).replace(" ", "/");
}

export default function InteractiveGMLeaderboardPage() {
  const { leads, loading, demandLeads, initialDataReady, snapshot, orgMapping } = useData();
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [sortMetric, setSortMetric] = useState("conversionRate");
  const [selectedBranch, setSelectedBranch] = useState(null);

  // Resolve the logged-in GM's canonical name from orgMapping (must match
  // the casing stored in the snapshot, which is ALL CAPS from the DB).
  const gmName = useMemo(() => {
    const name = userProfile?.displayName;
    if (!name) return resolveGMName(null, userProfile?.id);
    const nm = normalizeGmName(name);
    const orgMatch = (orgMapping ?? []).find((r) => r.gm && normalizeGmName(r.gm) === nm);
    if (orgMatch) return orgMatch.gm;
    if ((leads ?? []).some((l) => normalizeGmName(l.generalMgr ?? l.general_mgr) === nm)) return name;
    return resolveGMName(name, userProfile?.id);
  }, [userProfile?.displayName, userProfile?.id, orgMapping, leads]);

  // Trailing 4 weeks preset — locked; used as fallback dateRange when snapshot is unavailable
  const presets = useMemo(() => getDateRangePresets(), [loading]);
  const trailing4wPreset = presets.find((p) => p.key === "trailing_4_weeks");
  const dateRange = trailing4wPreset ? { start: trailing4wPreset.start, end: trailing4wPreset.end } : null;

  // Comparison period for "Change" column header: the 4 weeks before the current trailing_4_weeks
  const comparisonDateRange = useMemo(() => {
    if (!trailing4wPreset) return null;
    const end = new Date(trailing4wPreset.end);
    end.setDate(end.getDate() - 7);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(end.getDate() - 27);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }, [trailing4wPreset]);

  // Primary path: snapshot.leaderboard filtered to GM's branches, re-sorted client-side.
  // Fallback path: demand leads + compute via selector (covers first-load before snapshot arrives).
  const useSnapshot = !!(snapshot?.leaderboard?.length);

  useEffect(() => {
    if (!useSnapshot) demandLeads();
  }, [useSnapshot, demandLeads]);

  const leaderboard = useMemo(() => {
    if (useSnapshot) {
      const nmGm = normalizeGmName(gmName);
      const rows = snapshot.leaderboard
        .filter((r) => normalizeGmName(r.gm) === nmGm)
        .map((r) => ({ ...r, isMyBranch: true }));

      const sortKey = sortMetric === "mostImproved" ? "improvementDelta" : sortMetric;
      const sorted = [...rows].sort((a, b) => (b[sortKey] ?? -1) - (a[sortKey] ?? -1));
      sorted.forEach((r, i) => { r.rank = i + 1; });

      const benchTotal = rows.reduce((s, r) => s + (r.total ?? 0), 0);
      const benchRented = rows.reduce((s, r) => s + (r.rented ?? 0), 0);
      const benchW30 = rows.reduce((s, r) => {
        const pct = r.pctWithin30;
        return s + (pct != null && r.total ? Math.round((pct / 100) * r.total) : 0);
      }, 0);
      const benchBcArr = rows.map((r) =>
        r.branchHrdPct != null && r.total ? Math.round((r.branchHrdPct / 100) * r.total) : null
      );
      const benchBcTotal = benchBcArr.filter((v) => v != null).reduce((s, v) => s + v, 0);
      const benchCr = rows.reduce((s, r) => {
        const pct = r.commentRate;
        const actionable = r.cancelled + r.unused;
        return s + (pct != null && actionable ? Math.round((pct / 100) * actionable) : 0);
      }, 0);
      const benchActionable = rows.reduce((s, r) => s + ((r.cancelled ?? 0) + (r.unused ?? 0)), 0);

      const benchmark = {
        conversionRate: benchTotal ? Math.round((benchRented / benchTotal) * 100) : null,
        pctWithin30: benchTotal ? Math.round((benchW30 / benchTotal) * 100) : null,
        branchHrdPct: benchBcTotal > 0 ? Math.round((benchBcTotal / benchTotal) * 100) : null,
        commentRate: benchActionable > 0 ? Math.round((benchCr / benchActionable) * 100) : null,
        total: benchTotal,
      };

      return { sorted, benchmark };
    }

    return getGMBranchLeaderboard(leads, dateRange, sortMetric, "my_branches", gmName);
  }, [useSnapshot, snapshot, gmName, sortMetric, leads, dateRange]);

  const pageReady = usePageTransition();
  if (!initialDataReady || !pageReady) return <GMLeaderboardSkeleton />;

  return (
    <div className="space-y-6">
      <BackButton onClick={() => navigate("/gm/work")} label="Back to Work" />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--hertz-black)]">Leaderboard</h1>
          <p className="text-sm text-[var(--neutral-600)] mt-0.5">
            My branches — trailing 4 weeks — {leaderboard.sorted.length} branches
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--neutral-600)] font-medium">Sort by</label>
          <select
            value={sortMetric}
            onChange={(e) => setSortMetric(e.target.value)}
            className="px-3 py-1.5 border border-[var(--neutral-200)] rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--hertz-primary)]"
          >
            {SORT_METRICS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Benchmark bar */}
      {leaderboard.benchmark.total > 0 && (
        <div className="bg-[var(--neutral-50)] rounded-xl px-5 py-3 flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wide">
            My Branches Benchmark
          </span>
          <div className="flex items-center gap-6">
            {SORT_METRICS.filter((m) => m.value !== "total").map((m) => (
              <div key={m.value} className="text-center">
                <p className={`text-lg font-bold ${m.value === sortMetric ? "text-[var(--hertz-black)]" : "text-[var(--neutral-500)]"}`}>
                  {leaderboard.benchmark[m.value] ?? "—"}{m.suffix}
                </p>
                <p className="text-xs text-[var(--neutral-500)]">{m.label}</p>
              </div>
            ))}
            <div className="text-center">
              <p className="text-lg font-bold text-[var(--neutral-500)]">{leaderboard.benchmark.total}</p>
              <p className="text-xs text-[var(--neutral-500)]">Total</p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard table */}
      <div className="border border-[var(--neutral-200)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--hertz-black)]">
              <th className="text-center text-white text-xs font-semibold px-4 py-3 w-12">#</th>
              <th className="text-left text-white text-xs font-semibold px-4 py-3">Branch</th>
              <th className="text-left text-white text-xs font-semibold px-4 py-3">BM</th>
              <th className="text-center text-white text-xs font-semibold px-4 py-3">Zone</th>
              {SORT_METRICS.filter((m) => m.value !== "mostImproved").map((m) => (
                <th
                  key={m.value}
                  onClick={() => setSortMetric(m.value)}
                  className={`text-center text-xs font-semibold px-4 py-3 cursor-pointer transition-colors ${
                    sortMetric === m.value ? "text-[var(--hertz-primary)]" : "text-white hover:text-[var(--neutral-300)]"
                  }`}
                >
                  {m.label} {sortMetric === m.value && "▼"}
                </th>
              ))}
              <th
                onClick={() => setSortMetric("mostImproved")}
                className={`text-center text-xs font-semibold px-4 py-3 cursor-pointer transition-colors ${
                  sortMetric === "mostImproved" ? "text-[var(--hertz-primary)]" : "text-white hover:text-[var(--neutral-300)]"
                }`}
              >
                {comparisonDateRange
                  ? `Change from ${fmtMD(comparisonDateRange.start)}–${fmtMD(comparisonDateRange.end)}`
                  : "Change"}
                {sortMetric === "mostImproved" && " ▼"}
              </th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-[var(--neutral-500)]">
                  No data for this period
                </td>
              </tr>
            )}
            {leaderboard.sorted.map((row, i) => (
                <motion.tr
                  key={row.branch}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.3 }}
                  onClick={() => setSelectedBranch(row)}
                  className="border-b border-[var(--neutral-100)] transition-colors hover:bg-[var(--neutral-50)] cursor-pointer"
                >
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      row.rank <= 3 ? "bg-[var(--hertz-primary)] text-[var(--hertz-black)]" : "bg-[var(--neutral-100)] text-[var(--neutral-600)]"
                    }`}>
                      {row.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-left font-medium text-[var(--hertz-black)]">{row.branch}</td>
                  <td className="px-4 py-3 text-left text-[var(--neutral-600)]">{row.bmName}</td>
                  <td className="px-4 py-3 text-center text-[var(--neutral-600)]">{row.zone}</td>
                  {SORT_METRICS.filter((m) => m.value !== "mostImproved").map((m) => {
                    const val = row[m.value];
                    return (
                      <td key={m.value} className={`px-4 py-3 text-center font-medium ${
                        m.value === sortMetric ? "text-[var(--hertz-black)]" : "text-[var(--neutral-600)]"
                      }`}>
                        {val != null ? `${val}${m.suffix}` : "—"}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center">
                    {row.improvementDelta != null ? (
                      <span className={`text-xs font-semibold ${
                        row.improvementDelta > 0 ? "text-emerald-700" : row.improvementDelta < 0 ? "text-red-700" : "text-[var(--neutral-500)]"
                      }`}>
                        {row.improvementDelta > 0 ? "+" : ""}{row.improvementDelta} pp
                      </span>
                    ) : "—"}
                  </td>
                </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Branch detail slide-in pane */}
      <AnimatePresence>
        {selectedBranch && (
          <BranchDetailPane
            branchRow={selectedBranch}
            dateRange={dateRange}
            leads={leads}
            onClose={() => setSelectedBranch(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
