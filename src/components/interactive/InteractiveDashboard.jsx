import { useState, useMemo, useEffect, useRef } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import {
  getBMStats,
  getDateRangePresets,
  getComparisonDateRange,
  getSummaryDataWithChart,
  getTasksForBranch,
  getDefaultBranchForDemo,
  getAllLeads,
  getOpenTasksCount,
  getTaskCompletionRate,
  getAverageTimeToContact,
  getAverageTimeToContactMinutes,
  tasksInDateRange,
  getGMDashboardStats,
  resolveGMName,
  normalizeGmName,
  relChange,
  formatMinutesToDisplay,
  normalizeBranchKey,
} from "../../selectors/demoSelectors";
import { roleMeta, roleUsers, roleDefaults } from "../../config/navigation";
import StatusBadge from "../StatusBadge";
import MeetingPrepModule from "../MeetingPrepModule";
import LeaderboardModule from "../LeaderboardModule";
import GMLeaderboardModule from "../GMLeaderboardModule";
import GMMeetingPrepModule from "../GMMeetingPrepModule";
import GMSpotCheckModule from "../GMSpotCheckModule";
import ActivityReportModule from "../ActivityReportModule";
import MetricDrilldownModal from "../MetricDrilldownModal";
import GMMetricDrilldownModal from "../GMMetricDrilldownModal";
import SummaryExportModal from "../SummaryExportModal";
import {
  cardAnim,
  getTimeOfDayGreeting,
  formatDateRange,
} from "../../utils/dashboardHelpers";
import { formatDateShort } from "../../utils/dateTime";
import { BMDashboardSkeleton, GMDashboardSkeleton } from "../DashboardSkeleton";


function SectionHeader({ title, subtitle, action }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mb-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-[var(--hertz-primary)] rounded-full" />
            <h3 className="text-lg font-extrabold text-[var(--hertz-black)] tracking-tight">
              {title}
            </h3>
          </div>
          {subtitle && (
            <p className="text-xs text-[var(--neutral-600)] pl-4">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
    </motion.div>
  );
}

export function BMDashboard({ navigateTo }) {
  const { userProfile } = useAuth();
  const { leads, loading, initialDataReady, snapshot, demandLeads, leadsReady, fetchTasksForBranch, updateLeadEnrichment, updateTaskStatus, insertTask } = useData();
  const reduceMotion = useReducedMotion();
  const branch = (userProfile?.branch?.trim() || getDefaultBranchForDemo());
  const snapshotBranch = useMemo(() => {
    if (!snapshot?.branches || !branch) return null;
    const direct = snapshot.branches[branch];
    if (direct) return direct;
    const norm = normalizeBranchKey(branch);
    const key = Object.keys(snapshot.branches).find((k) => normalizeBranchKey(k) === norm);
    return key ? snapshot.branches[key] : null;
  }, [snapshot, branch]);
  const useSnapshotData = !!snapshotBranch;

  const [branchTasks, setBranchTasks] = useState(() =>
    []
  );

  useEffect(() => {
    if (branch) {
      fetchTasksForBranch(branch).then(setBranchTasks).catch(() => setBranchTasks([]));
    } else {
      setBranchTasks(getTasksForBranch(branch));
    }
  }, [branch, fetchTasksForBranch]);

  const presets = getDateRangePresets();
  const [selectedPresetKey, setSelectedPresetKey] = useState("trailing_4_weeks");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [drilldownMetric, setDrilldownMetric] = useState(null);
  const [showSummaryExport, setShowSummaryExport] = useState(false);

  const dateRange = useMemo(() => {
    if (useCustom && customStart && customEnd) {
      return {
        start: new Date(customStart + "T00:00:00"),
        end: new Date(customEnd + "T23:59:59"),
      };
    }
    const preset = presets.find((p) => p.key === selectedPresetKey);
    return preset ? { start: preset.start, end: preset.end } : null;
  }, [selectedPresetKey, useCustom, customStart, customEnd, presets]);

  // Demand-load leads when user picks a custom date range (snapshot only covers trailing 4 weeks)
  useEffect(() => {
    if (useCustom || (selectedPresetKey !== "trailing_4_weeks" && !useSnapshotData)) {
      demandLeads();
    }
  }, [useCustom, selectedPresetKey, useSnapshotData, demandLeads]);

  const { stats } = useMemo(() => {
    if (useSnapshotData && selectedPresetKey === "trailing_4_weeks" && !useCustom) {
      return { stats: snapshotBranch.stats };
    }
    if (!dateRange) return { stats: getBMStats(leads, dateRange, branch) };
    return getSummaryDataWithChart(leads, branchTasks, dateRange, branch, "trailing_4_weeks", "period");
  }, [dateRange, leads, branch, branchTasks, useSnapshotData, snapshotBranch, selectedPresetKey, useCustom]);

  const presetKey = useCustom ? "custom" : selectedPresetKey;
  const comparisonRange = useCustom
    ? getComparisonDateRange("custom", customStart, customEnd)
    : getComparisonDateRange(selectedPresetKey);
  const comparisonStats = (useSnapshotData && snapshotBranch?.comparison)
    ? snapshotBranch.comparison
    : getBMStats(leads, comparisonRange, branch);

  const convRate = stats.conversionRate ?? (stats.total ? Math.round((stats.rented / stats.total) * 100) : 0);
  const prevConvRate = comparisonStats.conversionRate ?? (comparisonStats.total ? Math.round((comparisonStats.rented / comparisonStats.total) * 100) : 0);
  const prevCommentRate = comparisonStats.enrichmentRate ?? 0;

  // Tasks in date range for period-over-period comparison (consistent with other metrics)
  const tasksInPeriod = tasksInDateRange(branchTasks, dateRange);
  const tasksInComparison = comparisonRange
    ? tasksInDateRange(branchTasks, comparisonRange)
    : [];

  const _snapshotTasks = useSnapshotData ? snapshotBranch?.tasks : null;
  const _snapshotCompTasks = useSnapshotData ? snapshotBranch?.comparisonTasks : null;

  const openInPeriod = _snapshotTasks ? _snapshotTasks.open : getOpenTasksCount(tasksInPeriod);
  const openInComparison = _snapshotCompTasks ? _snapshotCompTasks.open : getOpenTasksCount(tasksInComparison);
  const completionInPeriod = _snapshotTasks ? _snapshotTasks.completionRate : getTaskCompletionRate(tasksInPeriod);
  const completionInComparison = _snapshotCompTasks ? _snapshotCompTasks.completionRate : getTaskCompletionRate(tasksInComparison);

  const openTasksCount = _snapshotTasks ? _snapshotTasks.open : (dateRange ? openInPeriod : getOpenTasksCount(branchTasks));
  const taskCompletionRate = _snapshotTasks ? _snapshotTasks.completionRate : (dateRange && tasksInPeriod.length > 0 ? completionInPeriod : getTaskCompletionRate(branchTasks));
  const avgTimeToContact = useSnapshotData
    ? (_snapshotTasks?.avgTimeToContactMin ? formatMinutesToDisplay(_snapshotTasks.avgTimeToContactMin) : null)
    : getAverageTimeToContact(leads, dateRange, branch);
  const avgTimeToContactMin = _snapshotTasks?.avgTimeToContactMin ?? getAverageTimeToContactMinutes(leads, dateRange, branch);
  const prevAvgTimeToContactMin = _snapshotCompTasks?.avgTimeToContactMin ?? getAverageTimeToContactMinutes(leads, comparisonRange, branch);

  const relChangeOpenTasks = comparisonRange != null && openInComparison > 0
    ? Math.round(((openInComparison - openInPeriod) / openInComparison) * 100) // fewer = better
    : null;
  const relChangeCompletion = comparisonRange != null && completionInComparison != null && completionInComparison > 0
    ? relChange(completionInPeriod ?? 0, completionInComparison)
    : null;
  const relChangeAvgTime = comparisonRange != null && prevAvgTimeToContactMin != null && prevAvgTimeToContactMin > 0 && avgTimeToContactMin != null
    ? Math.round(((prevAvgTimeToContactMin - avgTimeToContactMin) / prevAvgTimeToContactMin) * 100) // lower = better
    : null;

  const rateTiles = [
    { label: "Total Leads", value: stats.total, color: "text-[var(--hertz-black)]", isCount: true, relChange: relChange(stats.total, comparisonStats.total), metricKey: "total_leads" },
    { label: "Conversion Rate", value: `${convRate}%`, color: "text-[var(--color-success)]", isCount: false, relChange: relChange(convRate, prevConvRate), metricKey: "conversion_rate" },
    { label: "Comment Rate", value: `${stats.enrichmentRate}%`, color: "text-[var(--hertz-primary)]", isCount: false, relChange: relChange(stats.enrichmentRate, prevCommentRate), metricKey: "comment_rate" },
  ];

  const secondaryTiles = [
    { label: "Open Tasks", value: openTasksCount, color: "text-[var(--hertz-black)]", relChange: relChangeOpenTasks, metricKey: "open_tasks" },
    { label: "Task Completion Rate", value: taskCompletionRate != null ? `${taskCompletionRate}%` : "—", color: "text-[var(--neutral-700)]", relChange: relChangeCompletion, metricKey: "task_completion_rate" },
    { label: "Average Time for First Contact", value: avgTimeToContact ?? "—", color: "text-[var(--neutral-700)]", relChange: relChangeAvgTime, lowerIsBetter: true, metricKey: "avg_time_to_contact" },
  ];

  const activePreset = useCustom ? { key: "custom" } : presets.find((p) => p.key === selectedPresetKey);
  const rangeLabel = formatDateRange(activePreset, customStart, customEnd);

  if (!initialDataReady && !snapshotBranch) return <BMDashboardSkeleton />;

  return (
    <div className="max-w-[var(--container-max)]">
      <AnimatePresence>
        {drilldownMetric && (
          <MetricDrilldownModal
            metricKey={drilldownMetric}
            onClose={() => setDrilldownMetric(null)}
            leads={leads}
            branchTasks={branchTasks}
            dateRange={dateRange}
            comparisonRange={comparisonRange}
            branch={branch}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showSummaryExport && (
          <SummaryExportModal
            onClose={() => setShowSummaryExport(false)}
            leads={leads}
            branchTasks={branchTasks}
            branch={branch}
          />
        )}
      </AnimatePresence>
      <div id="dashboard" data-onboarding="summary" className="scroll-mt-4 mb-4">
      <SectionHeader
        title="Summary"
        subtitle="Key metrics and trends for your branch this period."
        action={
        <motion.button
          whileHover={!reduceMotion ? { scale: 1.05 } : {}}
          whileTap={!reduceMotion ? { scale: 0.95 } : {}}
          onClick={() => setShowSummaryExport(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--neutral-50)] text-[var(--neutral-600)] border border-transparent hover:border-[var(--neutral-200)] hover:bg-[var(--neutral-100)] transition-colors cursor-pointer shrink-0"
          title="Export summary as CSV"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" /></svg>
          Export
        </motion.button>
      } />
      <div className="flex items-center gap-2 mb-4">
        <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--hertz-primary)] text-[var(--hertz-black)] shadow-[var(--shadow-md)]">
          Trailing 4 weeks{activePreset?.sublabel ? ` ${activePreset.sublabel}` : ""}
        </span>
        {rangeLabel && <span className="text-xs text-[var(--neutral-600)] font-medium">{rangeLabel}</span>}
      </div>

      {/* Rate tiles — click to view underlying data and drivers */}
      <div data-onboarding="metric-drilldown" className="grid grid-cols-3 gap-2 mb-4">
        {rateTiles.map((tile, i) => (
          <motion.div
            key={tile.label}
            {...cardAnim(i + 1, reduceMotion)}
            whileHover={!reduceMotion ? { y: -3, boxShadow: "0 12px 28px rgba(39,36,37,0.12), 0 4px 10px rgba(39,36,37,0.06)", transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } } : {}}
            onClick={() => setDrilldownMetric(tile.metricKey)}
            title="Click to view underlying data and what's driving changes"
            className="bg-neutral-700 border border-white/20 rounded-lg px-4 py-3 shadow-[var(--shadow-sm)] cursor-pointer group transition-all duration-200 hover:ring-2 hover:ring-[var(--hertz-primary)]/50"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-white uppercase tracking-wider">{tile.label}</p>
              <svg className="w-3.5 h-3.5 text-white/70 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xl font-extrabold tracking-tight text-white">{tile.value}</p>
              {comparisonRange != null && (
                <span
                  className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                    tile.relChange > 0 ? "bg-emerald-400/25 text-emerald-200" : tile.relChange < 0 ? "bg-rose-400/25 text-rose-200" : "bg-white/15 text-white/70"
                  }`}
                >
                  {tile.relChange > 0 ? "↑" : tile.relChange < 0 ? "↓" : "—"}
                  {tile.relChange !== 0 ? `${Math.abs(tile.relChange)}%` : ""}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
      {/* Secondary tiles: Open Tasks, Task Completion Rate, Average Time for First Contact — click to drill down */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {secondaryTiles.map((tile, i) => (
          <motion.div
            key={tile.label}
            {...cardAnim(4 + i, reduceMotion)}
            whileHover={!reduceMotion ? { y: -3, boxShadow: "0 12px 28px rgba(39,36,37,0.12), 0 4px 10px rgba(39,36,37,0.06)", transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } } : {}}
            onClick={() => setDrilldownMetric(tile.metricKey)}
            title="Click to view underlying data and what's driving changes"
            className="bg-neutral-700 border border-white/20 rounded-lg px-4 py-3 shadow-[var(--shadow-sm)] cursor-pointer group transition-all duration-200 hover:ring-2 hover:ring-[var(--hertz-primary)]/50"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-white uppercase tracking-wider">{tile.label}</p>
              <svg className="w-3.5 h-3.5 text-white/70 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xl font-extrabold tracking-tight text-white">{tile.value}</p>
              {comparisonRange != null && tile.relChange != null && (
                <span
                  className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                    tile.relChange > 0 ? "bg-emerald-400/25 text-emerald-200" : tile.relChange < 0 ? "bg-rose-400/25 text-rose-200" : "bg-white/15 text-white/70"
                  }`}
                >
                  {tile.lowerIsBetter
                    ? (tile.relChange > 0 ? "↓" : tile.relChange < 0 ? "↑" : "—")
                    : (tile.relChange > 0 ? "↑" : tile.relChange < 0 ? "↓" : "—")}
                  {tile.relChange !== 0 ? `${Math.abs(tile.relChange)}%` : ""}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      </div>

      {/* Work — Meeting Prep & Leaderboard modules */}
      <div id="work" className="scroll-mt-4 mb-4">
        <SectionHeader title="Work" subtitle="Prepare for your weekly meeting and see how you rank." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MeetingPrepModule
            navigateTo={navigateTo}
            leads={leads}
            dateRange={dateRange}
            branch={branch}
            reduceMotion={reduceMotion}
          />
          <LeaderboardModule
            navigateTo={navigateTo}
            leads={leads}
            branch={branch}
            dateRange={dateRange}
            reduceMotion={reduceMotion}
            snapshotLeaderboard={snapshot?.leaderboard}
            loading={loading}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <motion.div {...cardAnim(2, reduceMotion)} className="h-full">
            <motion.button
              onClick={() => navigateTo("/bm/leads")}
              whileHover={!reduceMotion ? { scale: 1.005 } : {}}
              whileTap={!reduceMotion ? { scale: 0.995 } : {}}
              className="w-full h-full text-left border-2 rounded-xl p-5 transition-all duration-200 cursor-pointer group border-[var(--neutral-200)] hover:border-[var(--hertz-primary)] hover:shadow-[var(--shadow-lg)] bg-white hover:bg-[var(--hertz-primary-subtle)]"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="shrink-0 w-12 h-12 rounded-lg bg-[var(--hertz-primary)] flex items-center justify-center text-[var(--hertz-black)] transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-extrabold text-[var(--hertz-black)] tracking-tight leading-snug">My Leads</h3>
                    <p className="text-sm text-[var(--neutral-600)] mt-0.5">Check all leads in my branch</p>
                  </div>
                </div>
                <div className="flex items-center shrink-0">
                  <span className="text-[var(--neutral-400)] group-hover:text-[var(--hertz-black)] transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </motion.button>
          </motion.div>
          <motion.div {...cardAnim(3, reduceMotion)} className="h-full">
            <motion.button
              onClick={() => navigateTo("/bm/tasks")}
              whileHover={!reduceMotion ? { scale: 1.005 } : {}}
              whileTap={!reduceMotion ? { scale: 0.995 } : {}}
              className="w-full h-full text-left border-2 rounded-xl p-5 transition-all duration-200 cursor-pointer group border-[var(--neutral-200)] hover:border-[var(--hertz-primary)] hover:shadow-[var(--shadow-lg)] bg-white hover:bg-[var(--hertz-primary-subtle)]"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="shrink-0 w-12 h-12 rounded-lg bg-[var(--hertz-primary)] flex items-center justify-center text-[var(--hertz-black)] transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-extrabold text-[var(--hertz-black)] tracking-tight leading-snug">Open Tasks</h3>
                    <p className="text-sm text-[var(--neutral-600)] mt-0.5">{openTasksCount} tasks need your attention.</p>
                  </div>
                </div>
                <div className="flex items-center shrink-0">
                  <span className="text-[var(--neutral-400)] group-hover:text-[var(--hertz-black)] transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </motion.button>
          </motion.div>
        </div>
      </div>

    </div>
  );
}

export function BMDashboardInbox({ navigateTo }) {
  const { leads } = useData();
  const directiveLeads = getAllLeads(leads).filter((l) => l.gmDirective);

  const handleClick = (lead) => {
    navigateTo(`/bm/leads/${lead.id}`);
  };

  return (
    <>
      <SectionHeader title="Inbox" subtitle="GM directives tied to specific reservations — click a row to review and take action." />
      <div className="border border-[var(--neutral-200)] rounded-lg overflow-hidden shadow-[var(--shadow-md)] max-h-[28rem] overflow-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="bg-[var(--hertz-black)] text-left text-xs text-white font-semibold uppercase tracking-wider">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Reservation ID</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">GM Directive</th>
            </tr>
          </thead>
          <tbody>
            {directiveLeads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--hertz-primary)]/10 flex items-center justify-center text-[var(--hertz-primary)]">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.981l7.5-4.039a2.25 2.25 0 012.134 0l7.5 4.039a2.25 2.25 0 011.183 1.98V19.5z" />
                      </svg>
                    </div>
                    <p className="text-[var(--hertz-black)] font-bold text-sm mt-1">Inbox zero</p>
                    <p className="text-sm text-[var(--neutral-600)]">No GM directives right now — you're all set.</p>
                  </div>
                </td>
              </tr>
            ) : (
              directiveLeads.map((lead, i) => (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => handleClick(lead)}
                  className="border-t border-[var(--neutral-200)] cursor-pointer hover:bg-[var(--neutral-50)] transition-colors duration-150"
                >
                  <td className="px-4 py-3 text-sm text-[var(--neutral-600)]">
                    {lead.initDtFinal ? formatDateShort(new Date(lead.initDtFinal + "T12:00:00")) : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-[var(--hertz-black)]">{lead.customer}</td>
                  <td className="px-4 py-3 text-sm font-mono text-[var(--neutral-600)]">{lead.reservationId}</td>
                  <td className="px-4 py-3 text-sm text-[var(--neutral-600)]">{lead.branch}</td>
                  <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                  <td className="px-4 py-3 text-sm text-[var(--neutral-600)] min-w-[200px] max-w-[320px] break-words whitespace-normal">{lead.gmDirective}</td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function getGMContextualInsight({ stats }) {
  if (!stats) return null;
  const total = (stats.cancelledUnreviewed ?? 0) + (stats.unusedOverdue ?? 0);
  if (total === 0) return "All clear — no urgent reviews.";
  return `${total} cancelled and unused unreviewed.`;
}

export function GMDashboardPage({ navigateTo }) {
  const { userProfile } = useAuth();
  const { leads, loading, initialDataReady, orgMapping, snapshot } = useData();
  const reduceMotion = useReducedMotion();
  const displayName = userProfile?.displayName ?? roleUsers.gm?.name ?? "there";
  const [drilldownMetric, setDrilldownMetric] = useState(null);
  const presets = useMemo(() => getDateRangePresets(), [loading]);

  const selectedPresetKey = "trailing_4_weeks";

  const currentPreset = presets.find((p) => p.key === selectedPresetKey);
  const dateRange = currentPreset ? { start: currentPreset.start, end: currentPreset.end } : null;

  const gmName = useMemo(() => {
    const name = userProfile?.displayName;
    if (!name) return resolveGMName(null, userProfile?.id);
    const nm = normalizeGmName(name);
    const orgMatch = (orgMapping ?? []).find((r) => r.gm && normalizeGmName(r.gm) === nm);
    if (orgMatch) return orgMatch.gm;
    if ((leads ?? []).some((l) => normalizeGmName(l.generalMgr ?? l.general_mgr) === nm)) return name;
    return resolveGMName(name, userProfile?.id);
  }, [userProfile?.displayName, userProfile?.id, orgMapping, leads]);

  const snapshotGM = gmName ? (snapshot?.gms?.[gmName] ?? null) : null;
  const useSnapshotGM = !!snapshotGM;

  const stats = useMemo(() => {
    if (useSnapshotGM && selectedPresetKey === "trailing_4_weeks") return snapshotGM.stats;
    return getGMDashboardStats(leads, dateRange, gmName);
  }, [leads, dateRange, gmName, useSnapshotGM, snapshotGM, selectedPresetKey]);
  const prevRange = useMemo(() => getComparisonDateRange(selectedPresetKey), [selectedPresetKey]);
  const prevStats = useMemo(() => {
    if (useSnapshotGM && snapshotGM?.comparison) return snapshotGM.comparison;
    return prevRange ? getGMDashboardStats(leads, prevRange, gmName) : null;
  }, [leads, prevRange, gmName, useSnapshotGM, snapshotGM]);

  const greeting = getTimeOfDayGreeting();
  const insight = getGMContextualInsight({ stats });

  const gmTiles = [
    { label: "Conversion Rate", value: `${stats.conversionRate}%`, relChange: relChange(stats.conversionRate, prevStats?.conversionRate), metricKey: "conversion_rate" },
    { label: "Contacted < 30 min", value: `${stats.pctWithin30}%`, relChange: relChange(stats.pctWithin30, prevStats?.pctWithin30), metricKey: "contacted_within_30_min" },
    { label: "Comment Compliance", value: `${stats.commentCompliance}%`, relChange: relChange(stats.commentCompliance, prevStats?.commentCompliance), metricKey: "comment_rate" },
    { label: "Branch Contact %", value: `${stats.branchPct}%`, relChange: relChange(stats.branchPct, prevStats?.branchPct), metricKey: "branch_vs_hrd_split" },
    { label: "Cancelled Unreviewed", value: stats.cancelledUnreviewed, relChange: relChange(stats.cancelledUnreviewed, prevStats?.cancelledUnreviewed), isAlert: stats.cancelledUnreviewed > 0, lowerIsBetter: true, metricKey: "cancelled_unreviewed" },
    { label: "Unused Overdue", value: stats.unusedOverdue, relChange: relChange(stats.unusedOverdue, prevStats?.unusedOverdue), isAlert: stats.unusedOverdue > 0, lowerIsBetter: true, metricKey: "unused_overdue" },
  ];

  if (!initialDataReady && !snapshotGM) return <GMDashboardSkeleton />;

  return (
    <div className="max-w-[var(--container-max)]">
      <AnimatePresence>
        {drilldownMetric && (() => {
          const tile = gmTiles.find((t) => t.metricKey === drilldownMetric);
          const rawVal = tile?.value;
          const numericCurrent = typeof rawVal === "string" ? parseFloat(rawVal) : rawVal;
          const prevTile = {
            conversion_rate: prevStats?.conversionRate,
            contacted_within_30_min: prevStats?.pctWithin30,
            comment_rate: prevStats?.commentCompliance,
            branch_vs_hrd_split: prevStats?.branchPct,
            cancelled_unreviewed: prevStats?.cancelledUnreviewed,
            unused_overdue: prevStats?.unusedOverdue,
          };
          return (
            <GMMetricDrilldownModal
              metricKey={drilldownMetric}
              onClose={() => setDrilldownMetric(null)}
              leads={leads}
              dateRange={dateRange}
              comparisonRange={prevRange}
              currentValue={numericCurrent}
              previousValue={prevTile[drilldownMetric]}
              selectedPresetKey={selectedPresetKey}
              gmName={gmName}
            />
          );
        })()}
      </AnimatePresence>
      {/* Home — top of overview page, same greeting and logic as BM */}
      <div id="home" className="scroll-mt-4 mb-4">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-sm font-semibold text-[var(--hertz-primary)] uppercase tracking-wider mb-1"
        >
          {greeting}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="text-3xl md:text-4xl font-extrabold text-[var(--hertz-black)] tracking-tight"
        >
          {displayName}
        </motion.h1>
        {insight && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="text-sm text-[var(--neutral-600)] mt-2.5"
          >
            {insight}
          </motion.p>
        )}
      </div>

      {/* Section 1: Summary (formerly Business Metrics) */}
      <div id="business-metrics" className="scroll-mt-4 mb-8" data-onboarding="gm-summary">
        <SectionHeader title="Summary" subtitle="Zone-wide metrics at a glance." />

        {/* Time filter */}
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--hertz-primary)] text-[var(--hertz-black)] shadow-[var(--shadow-md)]">
            Trailing 4 weeks{currentPreset?.sublabel ? ` ${currentPreset.sublabel}` : ""}
          </span>
        </div>

        {/* Metric tiles — 2 rows of 3, BM black-tile format */}
        <div className="grid grid-cols-3 gap-2 mb-2" data-onboarding="gm-metric-drilldown">
          {gmTiles.slice(0, 3).map((tile, i) => (
            <motion.div
              key={tile.label}
              {...cardAnim(i + 1, reduceMotion)}
              whileHover={!reduceMotion ? { y: -3, boxShadow: "0 12px 28px rgba(39,36,37,0.12), 0 4px 10px rgba(39,36,37,0.06)", transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } } : {}}
              onClick={() => tile.metricKey && setDrilldownMetric(tile.metricKey)}
              title="Click to view underlying data and what's driving changes"
              className="bg-neutral-700 border border-white/20 rounded-lg px-4 py-3 shadow-[var(--shadow-sm)] cursor-pointer group transition-all duration-200 hover:ring-2 hover:ring-[var(--hertz-primary)]/50"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-white uppercase tracking-wider">{tile.label}</p>
                <svg className="w-3.5 h-3.5 text-white/70 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xl font-extrabold tracking-tight text-white">{tile.value}</p>
                {prevRange != null && tile.relChange != null && (
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                    tile.relChange > 0 ? "bg-emerald-400/25 text-emerald-200" : tile.relChange < 0 ? "bg-rose-400/25 text-rose-200" : "bg-white/15 text-white/70"
                  }`}>
                    {tile.relChange > 0 ? "↑" : tile.relChange < 0 ? "↓" : "—"}
                    {tile.relChange !== 0 ? `${Math.abs(tile.relChange)}%` : ""}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {gmTiles.slice(3).map((tile, i) => (
            <motion.div
              key={tile.label}
              {...cardAnim(4 + i, reduceMotion)}
              whileHover={!reduceMotion ? { y: -3, boxShadow: "0 12px 28px rgba(39,36,37,0.12), 0 4px 10px rgba(39,36,37,0.06)", transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } } : {}}
              onClick={() => tile.metricKey && setDrilldownMetric(tile.metricKey)}
              title="Click to view underlying data and what's driving changes"
              className="bg-neutral-700 border border-white/20 rounded-lg px-4 py-3 shadow-[var(--shadow-sm)] cursor-pointer group transition-all duration-200 hover:ring-2 hover:ring-[var(--hertz-primary)]/50"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-white uppercase tracking-wider">{tile.label}</p>
                <svg className="w-3.5 h-3.5 text-white/70 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xl font-extrabold tracking-tight text-white">{tile.value}</p>
                {prevRange != null && tile.relChange != null && tile.relChange !== 0 && (
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                    tile.lowerIsBetter
                      ? (tile.relChange > 0 ? "bg-rose-400/25 text-rose-200" : "bg-emerald-400/25 text-emerald-200")
                      : (tile.relChange > 0 ? "bg-emerald-400/25 text-emerald-200" : "bg-rose-400/25 text-rose-200")
                  }`}>
                    {tile.lowerIsBetter
                      ? (tile.relChange > 0 ? "↑" : "↓")
                      : (tile.relChange > 0 ? "↑" : "↓")}
                    {`${Math.abs(tile.relChange)}%`}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Section 2: Work (formerly To Dos) */}
      <div id="todos" className="scroll-mt-4 mb-8" data-onboarding="gm-work">
        <SectionHeader title="Work" subtitle="Meeting prep and branch health checks at a glance." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div data-onboarding="gm-meeting-prep">
            <GMMeetingPrepModule
              navigateTo={navigateTo}
              leads={leads}
              dateRange={dateRange}
              reduceMotion={reduceMotion}
            />
          </div>
          <div data-onboarding="gm-spot-check">
            <GMSpotCheckModule
              navigateTo={navigateTo}
              leads={leads}
              dateRange={dateRange}
              reduceMotion={reduceMotion}
            />
          </div>
          <motion.div {...cardAnim(2, reduceMotion)} className="h-full">
            <motion.button
              onClick={() => navigateTo("/gm/leads")}
              whileHover={!reduceMotion ? { scale: 1.005 } : {}}
              whileTap={!reduceMotion ? { scale: 0.995 } : {}}
              className="w-full h-full text-left border-2 rounded-xl p-5 transition-all duration-200 cursor-pointer group border-[var(--neutral-200)] hover:border-[var(--hertz-primary)] hover:shadow-[var(--shadow-lg)] bg-white hover:bg-[var(--hertz-primary-subtle)]"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="shrink-0 w-12 h-12 rounded-lg bg-[var(--neutral-100)] group-hover:bg-[var(--hertz-primary)] flex items-center justify-center text-[var(--neutral-600)] group-hover:text-[var(--hertz-black)] transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-extrabold text-[var(--hertz-black)] tracking-tight leading-snug">My Leads</h3>
                    <p className="text-sm text-[var(--neutral-600)] mt-0.5">Check all leads across my branches</p>
                  </div>
                </div>
                <div className="flex items-center shrink-0">
                  <span className="text-[var(--neutral-400)] group-hover:text-[var(--hertz-black)] transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* Section 3: Team Leaderboard */}
      <div id="team-leaderboard" className="scroll-mt-4 mb-8" data-onboarding="gm-leaderboard">
        <SectionHeader title="Team Leaderboard" subtitle="Leaderboard rankings and activity across branches." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GMLeaderboardModule
            navigateTo={navigateTo}
            leads={leads}
            dateRange={dateRange}
            reduceMotion={reduceMotion}
            snapshotLeaderboard={snapshot?.leaderboard}
            gmName={gmName}
            loading={loading}
          />
          <ActivityReportModule
            navigateTo={navigateTo}
            leads={leads}
            reduceMotion={reduceMotion}
          />
        </div>
      </div>
    </div>
  );
}

export function AdminDashboard({ navigateTo }) {
  const cards = [
    {
      label: "Data Upload",
      desc: "Upload HLES and TRANSLOG CSV files to refresh lead data",
      view: "/admin/uploads",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
      accent: "bg-[var(--hertz-primary)]",
    },
    {
      label: "Org Mapping",
      desc: "BM-to-branch assignments and auto-derived hierarchy",
      view: "/admin/org-mapping",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      accent: "bg-[var(--hertz-black)]",
    },
    {
      label: "Cancellation Reasons",
      desc: "Configure the reason categories BMs use for cancelled leads",
      view: "/admin/legend",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      accent: "bg-[var(--neutral-100)]",
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-3 gap-5">
        {cards.map((card, i) => (
          <motion.button
            key={card.view}
            {...cardAnim(i)}
            onClick={() => navigateTo(card.view)}
            className="border border-[var(--neutral-200)] rounded-xl p-5 text-left hover:border-[var(--hertz-primary)] hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className={`w-11 h-11 ${card.accent} rounded-lg flex items-center justify-center mb-4 ${card.accent === "bg-[var(--hertz-primary)]" ? "text-[var(--hertz-black)]" : card.accent === "bg-[var(--hertz-black)]" ? "text-white" : "text-[var(--neutral-600)]"}`}>
              {card.icon}
            </div>
            <p className="text-base font-semibold text-[var(--hertz-black)] mb-1 group-hover:text-[var(--hertz-primary)] transition-colors">
              {card.label}
            </p>
            <p className="text-sm text-[var(--neutral-500)] leading-relaxed">{card.desc}</p>
            <div className="flex items-center gap-1 mt-3 text-xs font-medium text-[var(--neutral-400)] group-hover:text-[var(--hertz-black)] transition-colors">
              Open
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// BM sections in scroll order on Summary page: Work → Summary → My Leads → Open Tasks
const BM_SECTION_MAP = {
  "bm-work": "work",
  "bm-dashboard": "dashboard",
  "bm-leads": "lead-pipeline",
  "bm-todo": "open-tasks",
};

const GM_SECTION_MAP = {
  "gm-overview": "home",
  "gm-todos": "todos",
  "gm-leaderboard": "team-leaderboard",
};

// Reverse: sectionId -> viewId for scroll-based highlight
const BM_SECTION_TO_VIEW = Object.fromEntries(
  Object.entries(BM_SECTION_MAP).map(([view, section]) => [section, view])
);
const GM_SECTION_TO_VIEW = Object.fromEntries(
  Object.entries(GM_SECTION_MAP).map(([view, section]) => [section, view])
);

export default function InteractiveDashboard() {
  const { role, activeView, navigateTo, setScrollActiveView, setScrollDirection, selectLead, selectTask } = useApp();
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const sectionMap = role === "bm" ? BM_SECTION_MAP : role === "gm" ? GM_SECTION_MAP : null;
    const sectionId = sectionMap?.[activeView];
    if (sectionId) {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [role, activeView]);

  useEffect(() => {
    const sectionToView = role === "bm" ? BM_SECTION_TO_VIEW : role === "gm" ? GM_SECTION_TO_VIEW : null;
    if (!sectionToView) return;

    const scrollRoot = document.getElementById("dashboard-scroll-root");
    if (!scrollRoot) return;

    const sectionIds = Object.keys(sectionToView);
    const lastViewId = sectionToView[sectionIds[sectionIds.length - 1]];
    const firstViewId = sectionToView[sectionIds[0]];
    const secondViewId = sectionIds.length > 1 ? sectionToView[sectionIds[1]] : null;
    // GM: Work (todos) is the first substantial section; home is just the greeting. Highlight Work at top.
    const topViewId = role === "gm" ? sectionToView["todos"] ?? firstViewId : firstViewId;
    const observed = [];
    let hasUserScrolled = false;
    let lastScrollTop = scrollRoot.scrollTop;

    setScrollActiveView(topViewId);

    const updateActiveFromScroll = () => {
      const { scrollTop, clientHeight, scrollHeight } = scrollRoot;
      const atTop = scrollTop < 8;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 50;
      if (atTop && topViewId) {
        setScrollActiveView(topViewId);
        return true;
      }
      if (atBottom && lastViewId) {
        setScrollActiveView(lastViewId);
        return true;
      }
      return false;
    };

    const computeActiveFromSections = () => {
      const { scrollTop, clientHeight, scrollHeight } = scrollRoot;
      if (scrollTop < 8) return topViewId;
      if (scrollTop + clientHeight >= scrollHeight - 50) return lastViewId;
      const rootRect = scrollRoot.getBoundingClientRect();
      const candidates = sectionIds
        .map((id) => {
          const el = document.getElementById(id);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          if (rect.bottom <= rootRect.top || rect.top >= rootRect.bottom) return null;
          return { id, viewId: sectionToView[id], top: rect.top };
        })
        .filter(Boolean);
      if (candidates.length === 0) return firstViewId;
      const inViewport = candidates.filter((c) => c.top >= 0);
      let topmost;
      if (inViewport.length > 0) {
        inViewport.sort((a, b) => a.top - b.top);
        topmost = inViewport[0];
      } else {
        candidates.sort((a, b) => b.top - a.top);
        topmost = candidates[0];
      }
      if (role === "bm" && topmost.viewId === "bm-home" && topmost.top < 0 && secondViewId) {
        return secondViewId;
      }
      return topmost.viewId;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (updateActiveFromScroll()) return;
        if (!hasUserScrolled) return;
        const viewId = computeActiveFromSections();
        if (viewId) setScrollActiveView(viewId);
      },
      { root: scrollRoot, rootMargin: "0px 0px -35% 0px", threshold: 0 }
    );

    const handleScroll = () => {
      hasUserScrolled = true;
      const { scrollTop } = scrollRoot;
      const delta = scrollTop - lastScrollTop;
      if (Math.abs(delta) > 2) {
        setScrollDirection(delta > 0 ? "down" : "up");
      }
      lastScrollTop = scrollTop;
      if (updateActiveFromScroll()) return;
      const viewId = computeActiveFromSections();
      if (viewId) setScrollActiveView(viewId);
    };

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
        observed.push(el);
      }
    });

    scrollRoot.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      scrollRoot.removeEventListener("scroll", handleScroll);
      observed.forEach((el) => observer.unobserve(el));
    };
  }, [role, setScrollActiveView, setScrollDirection]);

  return (
    <div>
      {role === "bm" ? (
        <BMDashboard navigateTo={navigateTo} selectLead={selectLead} selectTask={selectTask} />
      ) : (
        <>
          {role === "admin" && (
            <div className="mb-8">
              <h1 className="text-3xl font-extrabold text-[var(--hertz-black)] tracking-tight">{roleMeta[role]?.label} Dashboard</h1>
            </div>
          )}
          {role === "gm" && <GMDashboardPage navigateTo={navigateTo} />}
          {role === "admin" && <AdminDashboard navigateTo={navigateTo} />}
        </>
      )}
    </div>
  );
}
