import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import BackButton from "../BackButton";
import {
  resolveGMName,
  normalizeGmName,
  getGMBranchLeaderboard,
  getBranchesForGM,
  pctRound,
} from "../../selectors/demoSelectors";
import { formatDateRange } from "../../utils/dashboardHelpers";
import BranchDetailPane from "./BranchDetailPane";
import { GMLeaderboardSkeleton, usePageTransition } from "../DashboardSkeleton";
import SelectFilter from "../observatory/SelectFilter";

function getMetricColor(val, meta) {
  if (meta?.value === "total" || val == null) return "var(--hertz-black)";
  if (val >= 70) return "var(--color-success)";
  if (val >= 65) return "var(--hertz-black)";
  return "var(--color-error)";
}

const METRIC_OPTIONS = [
  { value: "conversionRate", label: "Conversion Rate", suffix: "%" },
  { value: "commentRate", label: "Comment Compliance %", suffix: "%" },
  { value: "branchHrdPct", label: "Branch Contact %", suffix: "%" },
  { value: "total", label: "Total Leads", suffix: "" },
];

const SORT_DIRECTIONS = [
  { value: "high_low", label: "Highest to Lowest" },
  { value: "low_high", label: "Lowest to Highest" },
  { value: "a_z", label: "A to Z" },
  { value: "z_a", label: "Z to A" },
];

// Keep full list for table columns (includes pctWithin30 & mostImproved)
const TABLE_METRICS = [
  { value: "conversionRate", label: "Conversion Rate", suffix: "%" },
  { value: "pctWithin30", label: "% < 30 min", suffix: "%" },
  { value: "commentRate", label: "Comment Compliance %", suffix: "%" },
  { value: "branchHrdPct", label: "Branch Contact %", suffix: "%" },
  { value: "total", label: "Total Leads", suffix: "" },
  { value: "mostImproved", label: "Most Improved", suffix: " pp" },
];

const BENCHMARK_METRICS = ["conversionRate", "pctWithin30", "commentRate", "branchHrdPct"];

export default function InteractiveGMLeaderboardPage() {
  const { initialDataReady, snapshot, orgMapping, leads, fetchLeadsPage } = useData();
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [sortMetric, setSortMetric] = useState("conversionRate");
  const [sortDirection, setSortDirection] = useState("high_low");
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [bmFilter, setBmFilter] = useState("All");
  const [branchFilter, setBranchFilter] = useState("All");
  const [zoneFilter, setZoneFilter] = useState("All");
  const [selectedPresetKey, setSelectedPresetKey] = useState("trailing_4_weeks");
  const [periodLeads, setPeriodLeads] = useState(null);
  const [periodLoading, setPeriodLoading] = useState(false);

  // Resolve the logged-in GM's canonical name from orgMapping (must match
  // the casing stored in the snapshot, which is ALL CAPS from the DB).
  const gmName = useMemo(() => {
    const name = userProfile?.displayName;
    if (!name) return resolveGMName(null, userProfile?.id);
    const nm = normalizeGmName(name);
    const orgMatch = (orgMapping ?? []).find((r) => r.gm && normalizeGmName(r.gm) === nm);
    if (orgMatch) return orgMatch.gm;
    return resolveGMName(name, userProfile?.id);
  }, [userProfile?.displayName, userProfile?.id, orgMapping]);

  const presets = useMemo(() => {
    const toNoonUTC = (iso) => new Date(iso.length <= 10 ? iso + "T12:00:00Z" : iso);
    const latestDate = snapshot?.now ? toNoonUTC(snapshot.now) : new Date();
    const t4wStart = snapshot?.period?.start ? toNoonUTC(snapshot.period.start) : null;
    const t4wEnd = snapshot?.period?.end ? toNoonUTC(snapshot.period.end) : null;
    const thisMonthStart = new Date(Date.UTC(latestDate.getUTCFullYear(), latestDate.getUTCMonth(), 1, 12, 0, 0));
    const thisYearStart = new Date(Date.UTC(latestDate.getUTCFullYear(), 0, 1, 12, 0, 0));
    const earliestDate = snapshot?.earliestDate ? toNoonUTC(snapshot.earliestDate) : null;
    const day = latestDate.getUTCDay();
    const satOffset = (day + 1) % 7;
    const thisSaturday = new Date(latestDate);
    thisSaturday.setUTCDate(latestDate.getUTCDate() - satOffset);
    thisSaturday.setUTCHours(12, 0, 0, 0);

    return [
      { key: "this_week", label: "This week", start: thisSaturday, end: new Date(thisSaturday.getTime() + 6 * 86400000) },
      { key: "trailing_4_weeks", label: "Trailing 4 weeks", start: t4wStart, end: t4wEnd },
      { key: "this_month", label: "This month", start: thisMonthStart, end: latestDate },
      { key: "this_year", label: "This Year", start: thisYearStart, end: latestDate },
      { key: "all_time", label: "All Time", start: earliestDate, end: latestDate },
    ];
  }, [snapshot]);

  const currentPreset = presets.find((p) => p.key === selectedPresetKey);
  const dateRange = useMemo(
    () => (currentPreset ? { start: currentPreset.start, end: currentPreset.end } : null),
    [currentPreset],
  );

  const isDefaultPeriod = selectedPresetKey === "trailing_4_weeks";

  // Fetch leads for non-default time periods so we can recompute metrics client-side.
  const gmBranches = useMemo(() => getBranchesForGM(gmName), [gmName]);

  useEffect(() => {
    if (isDefaultPeriod || !dateRange?.start || !dateRange?.end || !gmBranches.length) {
      setPeriodLeads(null);
      setPeriodLoading(false);
      return;
    }
    let cancelled = false;
    setPeriodLoading(true);
    const toISODate = (d) => {
      if (!d) return null;
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    };
    fetchLeadsPage({
      branches: gmBranches.join(","),
      startDate: toISODate(dateRange.start),
      endDate: toISODate(dateRange.end),
      limit: 5000,
      offset: 0,
    }).then((result) => {
      if (!cancelled) {
        setPeriodLeads(result.items ?? []);
        setPeriodLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setPeriodLeads([]);
        setPeriodLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [isDefaultPeriod, dateRange, gmBranches, fetchLeadsPage]);

  // snapshot.leaderboard filtered to GM's branches, re-sorted client-side.
  // For the default trailing-4-weeks period, use pre-computed snapshot data.
  // For other periods, recompute from fetched leads.
  const useSnapshot = isDefaultPeriod && !!(snapshot?.leaderboard?.length);

  const leaderboard = useMemo(() => {
    // Non-default period: recompute from fetched leads
    if (!isDefaultPeriod && periodLeads != null) {
      const { sorted: rawSorted, benchmark: rawBench } = getGMBranchLeaderboard(
        periodLeads, dateRange, sortMetric, "my_branches", gmName,
      );

      // Re-sort according to current sortDirection (getGMBranchLeaderboard always sorts high-to-low)
      const sortKey = sortMetric === "mostImproved" ? "improvementDelta" : sortMetric;
      let sorted;
      if (sortDirection === "a_z") {
        sorted = [...rawSorted].sort((a, b) => (a.branch ?? "").localeCompare(b.branch ?? ""));
      } else if (sortDirection === "z_a") {
        sorted = [...rawSorted].sort((a, b) => (b.branch ?? "").localeCompare(a.branch ?? ""));
      } else if (sortDirection === "low_high") {
        sorted = [...rawSorted].sort((a, b) => (a[sortKey] ?? -1) - (b[sortKey] ?? -1));
      } else {
        sorted = [...rawSorted];
      }
      sorted.forEach((r, i) => { r.rank = i + 1; });

      const avgTotal = sorted.length > 0 ? Math.round((rawBench.total ?? 0) / sorted.length) : 0;
      return { sorted, benchmark: { ...rawBench, avgTotal } };
    }

    if (useSnapshot) {
      const nmGm = normalizeGmName(gmName);
      const rows = snapshot.leaderboard
        .filter((r) => normalizeGmName(r.gm) === nmGm)
        .map((r) => ({ ...r, isMyBranch: true }));

      const sortKey = sortMetric === "mostImproved" ? "improvementDelta" : sortMetric;
      let sorted;
      if (sortDirection === "a_z") {
        sorted = [...rows].sort((a, b) => (a.branch ?? "").localeCompare(b.branch ?? ""));
      } else if (sortDirection === "z_a") {
        sorted = [...rows].sort((a, b) => (b.branch ?? "").localeCompare(a.branch ?? ""));
      } else if (sortDirection === "low_high") {
        sorted = [...rows].sort((a, b) => (a[sortKey] ?? -1) - (b[sortKey] ?? -1));
      } else {
        sorted = [...rows].sort((a, b) => (b[sortKey] ?? -1) - (a[sortKey] ?? -1));
      }
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
        conversionRate: benchTotal ? pctRound((benchRented / benchTotal) * 100) : null,
        pctWithin30: benchTotal ? pctRound((benchW30 / benchTotal) * 100) : null,
        branchHrdPct: benchTotal > 0 ? pctRound((benchBcTotal / benchTotal) * 100) : null,
        commentRate: benchActionable > 0 ? pctRound((benchCr / benchActionable) * 100) : null,
        total: benchTotal,
        avgTotal: rows.length > 0 ? Math.round(benchTotal / rows.length) : 0,
      };

      return { sorted, benchmark };
    }

    return {
      sorted: [],
      benchmark: {
        conversionRate: null,
        pctWithin30: null,
        branchHrdPct: null,
        commentRate: null,
        total: 0,
        avgTotal: 0,
      },
    };
  }, [isDefaultPeriod, periodLeads, useSnapshot, snapshot, gmName, dateRange, sortMetric, sortDirection]);

  const bmNames = useMemo(() => [...new Set(leaderboard.sorted.map((r) => r.bmName).filter(Boolean))].sort(), [leaderboard.sorted]);
  const branchNames = useMemo(() => [...new Set(leaderboard.sorted.map((r) => r.branch).filter(Boolean))].sort(), [leaderboard.sorted]);
  const zoneNames = useMemo(() => [...new Set(leaderboard.sorted.map((r) => r.zone).filter(Boolean))].sort(), [leaderboard.sorted]);

  const filteredRows = useMemo(() => {
    let rows = leaderboard.sorted;
    if (bmFilter !== "All") rows = rows.filter((r) => r.bmName === bmFilter);
    if (branchFilter !== "All") rows = rows.filter((r) => r.branch === branchFilter);
    if (zoneFilter !== "All") rows = rows.filter((r) => r.zone === zoneFilter);
    return rows;
  }, [leaderboard.sorted, bmFilter, branchFilter, zoneFilter]);

  const pageReady = usePageTransition();
  if (!initialDataReady || !pageReady) return <GMLeaderboardSkeleton />;

  return (
    <div className="space-y-6">
      <BackButton onClick={() => navigate("/gm/work")} label="Back to Work" />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--hertz-black)]">Team Leaderboard</h1>
          <p className="text-sm text-[var(--neutral-600)] mt-0.5">
            My branches — {currentPreset?.label ?? "trailing 4 weeks"} — {filteredRows.length} branches
          </p>
        </div>
      </div>

      {/* Time period toggle */}
      <div className="flex items-center gap-1.5">
        <div className="inline-flex rounded-md border border-[var(--neutral-200)] bg-[var(--neutral-50)] p-0.5">
          {presets.map((p) => (
            <button
              key={p.key}
              onClick={() => setSelectedPresetKey(p.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                selectedPresetKey === p.key
                  ? "bg-[var(--hertz-primary)] text-[var(--hertz-black)] shadow-sm"
                  : "text-[var(--neutral-600)] hover:text-[var(--hertz-black)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {currentPreset && (
          <span className="text-xs text-[var(--neutral-400)] px-1">
            {formatDateRange(currentPreset)}
          </span>
        )}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-end gap-3">
        <SelectFilter
          label="Metric"
          value={sortMetric}
          onChange={setSortMetric}
          options={METRIC_OPTIONS.map((m) => ({ value: m.value, label: m.label }))}
          minWidth={160}
        />
        <SelectFilter
          label="Sort By"
          value={sortDirection}
          onChange={setSortDirection}
          options={SORT_DIRECTIONS.map((d) => ({ value: d.value, label: d.label }))}
          minWidth={170}
        />
        <SelectFilter
          label="BM"
          value={bmFilter}
          onChange={setBmFilter}
          options={[{ value: "All", label: "All BMs" }, ...bmNames.map((n) => ({ value: n, label: n }))]}
          minWidth={160}
        />
        <SelectFilter
          label="Branch"
          value={branchFilter}
          onChange={setBranchFilter}
          options={[{ value: "All", label: "All Branches" }, ...branchNames.map((b) => ({ value: b, label: b }))]}
          minWidth={160}
        />
        <SelectFilter
          label="Zone"
          value={zoneFilter}
          onChange={setZoneFilter}
          options={[{ value: "All", label: "All Zones" }, ...zoneNames.map((z) => ({ value: z, label: z }))]}
          minWidth={160}
        />
      </div>

      {/* Leaderboard table */}
      <div className="border border-[var(--neutral-200)] rounded-xl overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 1100 }}>
          <thead>
            <tr className="bg-[var(--hertz-black)]">
              <th className="text-center text-white text-xs font-semibold px-4 py-3 w-12">#</th>
              <th className="text-left text-white text-xs font-semibold px-4 py-3">Branch</th>
              <th className="text-left text-white text-xs font-semibold px-4 py-3">BM</th>
              <th className="text-center text-white text-xs font-semibold px-4 py-3">Zone</th>
              {TABLE_METRICS.filter((m) => m.value !== "mostImproved").map((m) => (
                <React.Fragment key={m.value}>
                  <th
                    onClick={() => setSortMetric(m.value)}
                    className="text-center text-xs font-semibold px-4 py-3 cursor-pointer transition-colors text-white hover:text-[var(--neutral-300)]"
                  >
                    {m.label}
                  </th>
                  {BENCHMARK_METRICS.includes(m.value) && (
                    <th className="text-center text-xs font-semibold px-3 py-3 text-white">
                      vs. Benchmark
                    </th>
                  )}
                </React.Fragment>
              ))}
              <th className="text-center text-xs font-semibold px-4 py-3 text-white">
                vs. Benchmark
              </th>
            </tr>
          </thead>
          <tbody>
            {periodLoading && (
              <tr>
                <td colSpan={14} className="px-4 py-8 text-center text-[var(--neutral-500)]">
                  Loading data…
                </td>
              </tr>
            )}
            {!periodLoading && filteredRows.length === 0 && (
              <tr>
                <td colSpan={14} className="px-4 py-8 text-center text-[var(--neutral-500)]">
                  No data for this period
                </td>
              </tr>
            )}
            {!periodLoading && filteredRows.map((row, i) => (
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
                  {TABLE_METRICS.filter((m) => m.value !== "mostImproved").map((m) => {
                    const val = row[m.value];
                    const hasBench = BENCHMARK_METRICS.includes(m.value);
                    const diff = hasBench && val != null && leaderboard.benchmark[m.value] != null
                      ? val - leaderboard.benchmark[m.value]
                      : null;
                    return (
                      <React.Fragment key={m.value}>
                        <td className={`px-4 py-3 text-center font-medium ${
                          m.value === sortMetric ? "text-[var(--hertz-black)]" : "text-[var(--neutral-600)]"
                        }`}>
                          {val != null ? `${val}${m.suffix}` : "—"}
                        </td>
                        {hasBench && (
                          <td className="px-3 py-3 text-center text-xs font-semibold bg-[var(--hertz-primary)]/10">
                            {diff != null ? (
                              <span className={diff > 0 ? "text-[var(--color-success)]" : diff < 0 ? "text-[var(--color-error)]" : "text-[var(--neutral-500)]"}>
                                {diff > 0 ? "+" : ""}{diff} pp
                              </span>
                            ) : "—"}
                          </td>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {(() => {
                    const diff = row.total != null && leaderboard.benchmark.avgTotal
                      ? row.total - leaderboard.benchmark.avgTotal
                      : null;
                    return (
                      <td className="px-3 py-3 text-center text-xs font-semibold bg-[var(--hertz-primary)]/10">
                        {diff != null ? (
                          <span className={diff > 0 ? "text-[var(--color-success)]" : diff < 0 ? "text-[var(--color-error)]" : "text-[var(--neutral-500)]"}>
                            {diff > 0 ? "+" : ""}{diff}
                          </span>
                        ) : "—"}
                      </td>
                    );
                  })()}
                </motion.tr>
            ))}
            {!periodLoading && filteredRows.length > 0 && (
              <tr className="border-t-2 border-[var(--neutral-300)] bg-[var(--neutral-100)]">
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-left font-bold text-xs uppercase tracking-wide text-[var(--neutral-600)]" colSpan={3}>
                  Benchmark
                </td>
                {TABLE_METRICS.filter((m) => m.value !== "mostImproved").map((m) => {
                  const val = leaderboard.benchmark[m.value];
                  const hasBench = BENCHMARK_METRICS.includes(m.value);
                  return (
                    <React.Fragment key={m.value}>
                      <td className="px-4 py-3 text-center font-bold text-[var(--neutral-700)]">
                        {m.value === "total" ? "" : val != null ? `${val}${m.suffix}` : "—"}
                      </td>
                      {hasBench && <td className="px-3 py-3" />}
                    </React.Fragment>
                  );
                })}
                <td className="px-3 py-3 text-center font-bold text-[var(--neutral-700)]">
                  {leaderboard.benchmark.avgTotal}
                </td>
              </tr>
            )}
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
