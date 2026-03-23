import { useState, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import {
  getDateRangePresets,
  getComparisonDateRange,
  relChange,
  resolveGMName,
  getBranchesForGM,
  normalizeGmName,
} from "../../selectors/demoSelectors";
import GMMetricDrilldownModal from "../GMMetricDrilldownModal";
import { ComplianceSkeleton, usePageTransition } from "../DashboardSkeleton";

const quartileColors = { 1: "#2E7D32", 2: "#F4C300", 3: "#808080", 4: "#C62828" };

function getQuartile(rate, maxRate) {
  if (rate == null) return 4;
  const pct = maxRate > 0 ? rate / maxRate : 0;
  if (pct >= 0.75) return 1;
  if (pct >= 0.5) return 2;
  if (pct >= 0.25) return 3;
  return 4;
}

export default function InteractiveComplianceDashboard() {
  const { userProfile } = useAuth();
  const { orgMapping, initialDataReady, snapshot } = useData();
  const reduceMotion = useReducedMotion();
  const presets = useMemo(() => getDateRangePresets(), []);

  const gmName = useMemo(() => {
    const name = userProfile?.displayName;
    if (!name) return resolveGMName(null, userProfile?.id);
    const nm = normalizeGmName(name);
    if ((orgMapping ?? []).some((r) => r.gm && normalizeGmName(r.gm) === nm)) return name;
    return resolveGMName(name, userProfile?.id);
  }, [userProfile?.displayName, userProfile?.id, orgMapping]);
  const gmBranches = useMemo(() => getBranchesForGM(gmName), [gmName]);
  const selectedPresetKey = "trailing_4_weeks";
  const [branchFilter, setBranchFilter] = useState("All");
  const [insuranceFilter, setInsuranceFilter] = useState("All");
  const [sortMetric, setSortMetric] = useState("conversionRate");

  const currentPreset = presets.find((p) => p.key === selectedPresetKey);
  const dateRange = useMemo(() => {
    if (snapshot?.period?.start && snapshot?.period?.end) {
      return {
        start: new Date(snapshot.period.start + "T12:00:00Z"),
        end: new Date(snapshot.period.end + "T12:00:00Z"),
      };
    }
    return currentPreset ? { start: currentPreset.start, end: currentPreset.end } : null;
  }, [snapshot?.period, currentPreset]);
  const insuranceCompanies = [];
  const branches = useMemo(() => [...new Set(gmBranches)].sort(), [gmBranches]);

  const filteredLeads = [];

  const stats = useMemo(() => {
    const snGm = snapshot?.gms?.[gmName];
    if (snGm?.stats) return snGm.stats;
    return {
      conversionRate: 0,
      pctWithin30: 0,
      commentCompliance: 0,
      branchPct: 0,
      cancelledUnreviewed: 0,
      unusedOverdue: 0,
      noContactAttempt: 0,
    };
  }, [snapshot, gmName]);

  const leaderboard = useMemo(() => {
    if (!snapshot?.leaderboard?.length) return { sorted: [], benchmark: { total: 0 } };
    const nmGm = normalizeGmName(gmName);
    let rows = snapshot.leaderboard.filter((r) => normalizeGmName(r.gm) === nmGm);
    if (branchFilter !== "All") rows = rows.filter((r) => r.branch === branchFilter);
    const sortKey = sortMetric;
    const sorted = [...rows]
      .sort((a, b) => (b[sortKey] ?? -1) - (a[sortKey] ?? -1))
      .map((r, i) => ({ ...r, rank: i + 1 }));
    const benchTotal = rows.reduce((s, r) => s + (r.total ?? 0), 0);
    const benchRented = rows.reduce((s, r) => s + (r.rented ?? 0), 0);
    const benchmark = {
      [sortMetric]: benchTotal ? Math.round((benchRented / benchTotal) * 100) : null,
      total: benchTotal,
    };
    return { sorted, benchmark };
  }, [snapshot, gmName, branchFilter, sortMetric]);

  const maxRate = Math.max(...leaderboard.sorted.map((b) => b[sortMetric] ?? 0), 1);
  const benchVal = leaderboard.benchmark?.[sortMetric];
  const benchWidth = benchVal != null ? Math.min(100, benchVal) : null;

  const comparisonRange = useMemo(() => {
    if (snapshot?.comparison?.start && snapshot?.comparison?.end) {
      return {
        start: new Date(snapshot.comparison.start + "T12:00:00Z"),
        end: new Date(snapshot.comparison.end + "T12:00:00Z"),
      };
    }
    return getComparisonDateRange(selectedPresetKey);
  }, [snapshot?.comparison, selectedPresetKey]);
  const prevStats = useMemo(() => {
    const snGm = snapshot?.gms?.[gmName];
    if (snGm?.comparison) return snGm.comparison;
    return null;
  }, [snapshot, gmName]);

  const summaryCards = [
    { label: "Cancelled Unreviewed", value: String(stats.cancelledUnreviewed), metricKey: "cancelled_unreviewed", relChange: relChange(stats.cancelledUnreviewed, prevStats?.cancelledUnreviewed), lowerIsBetter: true },
    { label: "Unused Overdue (5+ days)", value: String(stats.unusedOverdue), metricKey: "unused_overdue", relChange: relChange(stats.unusedOverdue, prevStats?.unusedOverdue), lowerIsBetter: true },
    { label: "Comment Compliance", value: `${stats.commentCompliance}%`, metricKey: "comment_rate", relChange: relChange(stats.commentCompliance, prevStats?.commentCompliance) },
  ];

  const sortOptions = [
    { value: "commentRate", label: "Comment Rate" },
    { value: "conversionRate", label: "Conversion Rate" },
    { value: "pctWithin30", label: "% < 30 min" },
    { value: "branchHrdPct", label: "Branch Contact %" },
  ];

  const metricLabel = sortOptions.find((o) => o.value === sortMetric)?.label ?? sortMetric;

  const [drilldownMetric, setDrilldownMetric] = useState(null);
  const [showAllBranches, setShowAllBranches] = useState(false);
  const SCOREBOARD_LIMIT = 20;

  const pageReady = usePageTransition();
  if (!initialDataReady || !pageReady) return <ComplianceSkeleton />;

  return (
    <div>
      <AnimatePresence>
        {drilldownMetric && (() => {
          const metricValueMap = {
            cancelled_unreviewed: stats.cancelledUnreviewed,
            unused_overdue: stats.unusedOverdue,
            comment_rate: stats.commentCompliance,
            conversion_rate: stats.conversionRate,
            contacted_within_30_min: stats.pctWithin30,
            branch_vs_hrd_split: stats.branchPct,
          };
          const prevMetricValueMap = {
            cancelled_unreviewed: prevStats?.cancelledUnreviewed,
            unused_overdue: prevStats?.unusedOverdue,
            comment_rate: prevStats?.commentCompliance,
            conversion_rate: prevStats?.conversionRate,
            contacted_within_30_min: prevStats?.pctWithin30,
            branch_vs_hrd_split: prevStats?.branchPct,
          };
          const snGm = snapshot?.gms?.[gmName];
          return (
            <GMMetricDrilldownModal
              metricKey={drilldownMetric}
              onClose={() => setDrilldownMetric(null)}
              leads={[]}
              dateRange={dateRange}
              comparisonRange={comparisonRange}
              currentValue={metricValueMap[drilldownMetric]}
              previousValue={prevMetricValueMap[drilldownMetric]}
              selectedPresetKey={selectedPresetKey}
              gmName={gmName}
              chartData={snGm?.chartData ?? []}
              leaderboardRows={(snapshot?.leaderboard ?? []).filter((r) =>
                (snGm?.branches ?? []).includes(r.branch)
              )}
              allLeaderboardRows={snapshot?.leaderboard ?? []}
              branchesSnapshot={snapshot?.branches ?? null}
              zonesSnapshot={snapshot?.zones ?? null}
              gmZone={snGm?.zone ?? null}
            />
          );
        })()}
      </AnimatePresence>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-[var(--hertz-black)]">Compliance Dashboard</h2>
          <span className="text-sm text-[var(--neutral-600)]">
            {gmName} — My Branches
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <label className="text-xs text-[var(--neutral-600)] font-medium">Branch</label>
        <select
          value={branchFilter}
          onChange={(e) => {
            setBranchFilter(e.target.value);
            setShowAllBranches(false);
          }}
          className="px-3 py-1.5 border border-[var(--neutral-200)] rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--hertz-primary)]"
        >
          <option>All</option>
          {branches.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <label className="text-xs text-[var(--neutral-600)] font-medium">Insurance</label>
        <select
          value={insuranceFilter}
          onChange={(e) => setInsuranceFilter(e.target.value)}
          className="px-3 py-1.5 border border-[var(--neutral-200)] rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--hertz-primary)]"
        >
          <option>All</option>
          {insuranceCompanies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Summary cards — match GM metric tile format, clickable for drilldown */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {summaryCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={!reduceMotion ? { y: -3, boxShadow: "0 12px 28px rgba(39,36,37,0.12), 0 4px 10px rgba(39,36,37,0.06)", transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } } : {}}
            onClick={() => card.metricKey && setDrilldownMetric(card.metricKey)}
            title="Click to view underlying data and what's driving changes"
            className="bg-[var(--hertz-black)] rounded-xl p-5 cursor-pointer group transition-all duration-200 hover:ring-2 hover:ring-[var(--hertz-primary)]/50"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-[var(--neutral-400)] uppercase tracking-wide">{card.label}</p>
              <svg className="w-3.5 h-3.5 text-white/70 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-3xl font-bold text-white">{card.value}</p>
              {comparisonRange != null && card.relChange != null && (
                <span
                  className={`text-xs font-semibold px-1.5 py-0.5 rounded self-center ${
                    card.lowerIsBetter
                      ? (card.relChange > 0 ? "bg-rose-400/25 text-rose-200" : card.relChange < 0 ? "bg-emerald-400/25 text-emerald-200" : "bg-white/15 text-white/70")
                      : (card.relChange > 0 ? "bg-emerald-400/25 text-emerald-200" : card.relChange < 0 ? "bg-rose-400/25 text-rose-200" : "bg-white/15 text-white/70")
                  }`}
                >
                  {card.lowerIsBetter
                    ? (card.relChange > 0 ? "↑" : card.relChange < 0 ? "↓" : "—")
                    : (card.relChange > 0 ? "↑" : card.relChange < 0 ? "↓" : "—")}
                  {card.relChange !== 0 ? `${Math.abs(card.relChange)}%` : ""}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Branch scoreboard */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[var(--hertz-black)]">Branch Scoreboard</h3>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--neutral-600)] font-medium">Rank by</label>
          <select
            value={sortMetric}
            onChange={(e) => setSortMetric(e.target.value)}
            className="px-3 py-1.5 border border-[var(--neutral-200)] rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--hertz-primary)]"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative mb-6">
        {/* Single benchmark line spanning all rows */}
        {benchWidth != null && benchWidth > 0 && leaderboard.sorted.filter((b) => b.total > 0).length > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0 border-l-2 border-dashed border-[var(--hertz-black)] opacity-70 pointer-events-none z-10"
            style={{
              left: `calc(1.5rem + 1rem + 9rem + 1rem + 9rem + (100% - 1.5rem - 1rem - 9rem - 1rem - 9rem - 1rem - 1rem - 3rem) * ${benchWidth} / 100)`,
            }}
            title={`Benchmark: ${benchVal}%`}
            aria-hidden
          />
        )}
        <div className="space-y-3">
          {(() => {
            const withData = leaderboard.sorted.filter((b) => b.total > 0);
            const visible = showAllBranches ? withData : withData.slice(0, SCOREBOARD_LIMIT);
            const hiddenCount = withData.length - visible.length;
            return (
              <>
                {visible.map((bm, i) => {
                  const val = bm[sortMetric] ?? 0;
                  const quartile = getQuartile(val, maxRate);
                  const bmDisplay = bm.bmName && bm.bmName !== "—" && bm.bmName !== "— Unassigned —" ? bm.bmName : "—";
                  return (
                    <div key={bm.branch} className="flex items-center gap-4 group/row relative">
                      <span className="w-6 shrink-0 text-xs font-bold text-[var(--neutral-500)] text-right">{bm.rank}</span>
                      <span className="w-36 shrink-0 text-sm text-[var(--neutral-600)] font-medium truncate" title={bm.branch}>
                        {bm.branch}
                      </span>
                      <span className="w-36 shrink-0 text-sm text-[var(--neutral-600)] truncate" title={bmDisplay}>
                        {bmDisplay}
                      </span>
                      <div className="flex-1 min-w-0 bg-[var(--neutral-50)] rounded-md h-8 relative overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(val, 100)}%` }}
                          transition={{ duration: 0.8, delay: i * 0.06, ease: "easeOut" }}
                          className="h-full rounded-md"
                          style={{ backgroundColor: quartileColors[quartile] }}
                        />
                        <div className="absolute inset-0 z-10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-150 pointer-events-none flex items-center justify-center">
                          <span className="bg-[var(--hertz-black)] text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-lg whitespace-nowrap">
                            {bm.rented} converted / {bm.total} leads
                          </span>
                        </div>
                      </div>
                      <span className="w-12 shrink-0 text-sm font-semibold text-right text-[var(--hertz-black)]">
                        {val != null ? `${val}%` : "—"}
                      </span>
                    </div>
                  );
                })}
                {hiddenCount > 0 && (
                  <button
                    onClick={() => setShowAllBranches(true)}
                    className="w-full py-2.5 text-sm font-semibold text-[var(--neutral-600)] bg-[var(--neutral-50)] hover:bg-[var(--neutral-100)] rounded-md transition-colors cursor-pointer"
                  >
                    View All ({withData.length} branches)
                  </button>
                )}
                {withData.length === 0 && (
                  <p className="text-sm text-[var(--neutral-500)] py-4 text-center">No data for this period</p>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Benchmark legend */}
      {leaderboard.benchmark.total > 0 && benchVal != null && (
        <div className="flex items-center gap-3 border-t border-[var(--neutral-200)] pt-4 mb-6 text-xs text-[var(--neutral-600)]">
          <svg width="8" height="14" viewBox="0 0 8 14" className="inline-block align-middle shrink-0" aria-hidden="true">
            <line x1="4" y1="0" x2="4" y2="14" stroke="var(--hertz-black)" strokeWidth="1.5" strokeDasharray="2 2" strokeOpacity="0.7" />
          </svg>
          <span>Zone benchmark ({benchVal}%, {leaderboard.benchmark.total} leads)</span>
        </div>
      )}

    </div>
  );
}
