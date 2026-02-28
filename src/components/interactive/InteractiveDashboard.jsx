import { useState, useMemo, useEffect, useRef } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import {
  getBMStats,
  getGMStats,
  getBMTrends,
  getGMTrends,
  getTimeToContactStats,
  getContactSourceStats,
  getDateRangePresets,
  getComparisonDateRange,
  getChartData,
  getLeadsForBranch,
  getTasksForBranch,
  getHierarchyForBranch,
  getDefaultBranchForDemo,
  getAllLeads,
  getLeadById,
  getOpenTasksCount,
  getTaskCompletionRate,
  getAverageTimeToContact,
  getAverageTimeToContactMinutes,
  tasksInDateRange,
} from "../../selectors/demoSelectors";
import { roleMeta, roleUsers } from "../../config/navigation";
import MiniBarChart from "../MiniBarChart";
import LeadStackedBarChart from "../LeadStackedBarChart";
import StatusBadge from "../StatusBadge";
import LeadsBoardView from "../LeadsBoardView";
import InteractiveComplianceDashboard from "./InteractiveComplianceDashboard";
import InteractiveCancelledLeads from "./InteractiveCancelledLeads";
import InteractiveUnusedLeads from "./InteractiveUnusedLeads";
import InteractiveThreeColumn from "./InteractiveThreeColumn";
import InteractiveSpotCheck from "./InteractiveSpotCheck";
import { DateRangeCalendar } from "../DateRangeCalendar";

const easeOut = [0.4, 0, 0.2, 1];
const cardAnim = (i, reduced = false) => ({
  initial: reduced ? false : { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: reduced ? 0 : i * 0.06, duration: reduced ? 0.01 : 0.4, ease: easeOut },
});

function TrendsViewButton({ onOpen }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      onClick={onOpen}
      whileHover={!reduceMotion ? { scale: 1.03 } : {}}
      whileTap={!reduceMotion ? { scale: 0.97 } : {}}
      className="ml-auto px-2.5 py-1 rounded-md text-xs font-medium text-white bg-[#1A1A1A] hover:bg-[#272425] transition-colors duration-200 cursor-pointer shrink-0"
    >
      View trends
    </motion.button>
  );
}

function TrendsViewModal({ onClose }) {
  const presets = getDateRangePresets();
  const [metric, setMetric] = useState("leadPipeline");
  const [presetKey, setPresetKey] = useState("this_week");
  const [useCustom, setUseCustom] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);
  const customAnchorRef = useRef(null);

  const dateRange = useMemo(() => {
    if (useCustom) {
      if (customStart && customEnd) return { start: new Date(customStart + "T00:00:00"), end: new Date(customEnd + "T23:59:59") };
      return null;
    }
    const p = presets.find((x) => x.key === presetKey);
    return p ? { start: p.start, end: p.end } : null;
  }, [presetKey, useCustom, customStart, customEnd, presets]);

  const chartData = useMemo(() => {
    if (!dateRange) return [];
    return getChartData(useCustom ? "custom" : presetKey, dateRange);
  }, [dateRange, presetKey, useCustom]);

  const metricConfig = {
    leadPipeline: { key: "totalLeads", label: "Total Leads", color: "#272425", suffix: "" },
    conversionRate: { key: "conversionRate", label: "Conversion Rate", color: "#2E7D32", suffix: "%" },
    commentRate: { key: "commentRate", label: "Comment Rate", color: "#FFD100", suffix: "%" },
  };
  const config = metricConfig[metric];
  const values = chartData.map((d) => d[config.key] ?? 0);
  const labels = chartData.map((d) => d.label);
  const max = Math.max(...values, 1);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="px-6 py-4 border-b border-[var(--neutral-200)] flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--hertz-black)]">View trends</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--neutral-100)] text-[var(--neutral-600)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-4 overflow-auto flex-1">
          <p className="text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wider mb-2">Metric</p>
          <div className="flex gap-2 mb-4">
            {Object.entries(metricConfig).map(([k, c]) => (
              <button
                key={k}
                onClick={() => setMetric(k)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  metric === k ? "bg-[var(--hertz-primary)] text-[var(--hertz-black)]" : "bg-[var(--neutral-50)] text-[var(--neutral-600)] hover:bg-[var(--neutral-100)]"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wider mb-2">Time range</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => { setPresetKey(p.key); setUseCustom(false); setShowCustomCalendar(false); }}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  !useCustom && presetKey === p.key ? "bg-[var(--hertz-primary)] text-[var(--hertz-black)]" : "bg-[var(--neutral-50)] text-[var(--neutral-600)] hover:bg-[var(--neutral-100)]"
                }`}
              >
                {p.label}
              </button>
            ))}
            <div ref={customAnchorRef} className="relative inline-block">
              <button
                onClick={() => { setUseCustom(true); setShowCustomCalendar(true); }}
                className={`px-2 py-1 rounded text-xs font-medium ${useCustom ? "bg-[var(--hertz-primary)] text-[var(--hertz-black)]" : "bg-[var(--neutral-50)] text-[var(--neutral-600)] hover:bg-[var(--neutral-100)]"}`}
              >
                Custom
              </button>
              <AnimatePresence>
                {showCustomCalendar && (
                  <DateRangeCalendar
                    start={customStart}
                    end={customEnd}
                    onChange={({ start: s, end: e }) => { setCustomStart(s); setCustomEnd(e); }}
                    onClose={() => setShowCustomCalendar(false)}
                    anchorRef={customAnchorRef}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="border border-[var(--neutral-200)] rounded-lg p-4 bg-[var(--neutral-50)]/30">
            <p className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wider mb-3">{config.label}</p>
            {chartData.length === 0 ? (
              <p className="text-sm text-[var(--neutral-600)] py-8 text-center">Select a time range to see the trend.</p>
            ) : (
              <>
                <div className="flex items-end gap-1.5" style={{ height: 160 }}>
                  {values.map((v, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: max > 0 ? `${(v / max) * 100}%` : "0%" }}
                      transition={{ delay: i * 0.05, duration: 0.3, ease: "easeOut" }}
                      className="flex-1 rounded-sm min-w-[8px]"
                      style={{ backgroundColor: config.color, opacity: i === values.length - 1 ? 1 : 0.7 }}
                      title={`${labels[i]}: ${v}${config.suffix}`}
                    />
                  ))}
                </div>
                <div className="flex gap-1 mt-2 overflow-x-auto">
                  {labels.map((l, i) => (
                    <span key={i} className="flex-shrink-0 text-[10px] text-[var(--neutral-600)]">{l}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SectionHeader({ title }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mb-4"
    >
      <h3 className="text-base font-bold text-[var(--hertz-black)] tracking-tight">
        {title}
      </h3>
      <div className="w-10 h-0.5 bg-[var(--hertz-primary)] mt-1.5" />
    </motion.div>
  );
}

function getTimeOfDayGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDateRange(preset, customStart, customEnd) {
  if (preset?.key === "custom" && customStart && customEnd) {
    return `${new Date(customStart).toLocaleDateString("en-AU", { month: "short", day: "numeric" })} – ${new Date(customEnd).toLocaleDateString("en-AU", { month: "short", day: "numeric" })}`;
  }
  if (preset?.start && preset?.end) {
    return `${preset.start.toLocaleDateString("en-AU", { month: "short", day: "numeric" })} – ${preset.end.toLocaleDateString("en-AU", { month: "short", day: "numeric" })}`;
  }
  return preset?.label ?? "";
}

function formatDateDisplay(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr + "T00:00:00");
  if (isNaN(d.getTime())) return isoStr;
  const mo = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  const yr = d.getFullYear();
  return `${mo} ${day}, ${yr}`;
}

function leadToHlesRow(lead, org) {
  const rentInd = lead.status === "Rented" ? 1 : 0;
  const cancelId = lead.status === "Cancelled" ? 1 : 0;
  const unusedInd = lead.status === "Unused" ? 1 : 0;
  return {
    INIT_DT_FINAL: formatDateDisplay(lead.initDtFinal),
    CONFIRM_NUM: lead.reservationId ?? "—",
    RENTER_LAST: lead.customer ?? "—",
    CLAIM: lead.claim ?? "—",
    CDP: lead.cdp ?? lead.insuranceCompany ?? "—",
    RENT_LOC: lead.branch ?? "—",
    RES_ID: lead.reservationId ?? "—",
    RENT_IND: rentInd,
    CANCEL_ID: cancelId,
    UNUSED_IND: unusedInd,
    STATUS: lead.status,
    CANCEL_REASON: lead.hlesReason ?? "—",
    COMMENTS: lead.enrichment?.reason ?? lead.enrichment?.notes ?? "—",
    AREA_MGR: org?.am ?? "—",
    GENERAL_MGR: org?.gm ?? "—",
    DAYS_OPEN: lead.daysOpen ?? "—",
    DT_FROM_ALPHA1: formatDateDisplay(lead.dtFromAlpha1),
    TIME_TO_CONTACT: lead.timeToFirstContact ?? "—",
  };
}

function BMDashboard({ navigateTo, selectLead, selectTask }) {
  const { userProfile } = useAuth();
  const { leads, fetchTasksForBranch, useSupabase, updateLeadEnrichment } = useData();
  const reduceMotion = useReducedMotion();
  const branch = userProfile?.branch ?? getDefaultBranchForDemo();
  const displayName = userProfile?.displayName ?? roleUsers.bm?.name ?? "there";

  const [branchTasks, setBranchTasks] = useState(() =>
    useSupabase ? [] : getTasksForBranch(branch)
  );

  useEffect(() => {
    if (useSupabase && branch) {
      fetchTasksForBranch(branch).then(setBranchTasks).catch(() => setBranchTasks([]));
    } else {
      setBranchTasks(getTasksForBranch(branch));
    }
  }, [useSupabase, branch, fetchTasksForBranch]);

  const presets = getDateRangePresets();
  const [selectedPresetKey, setSelectedPresetKey] = useState("this_week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [showTrendsModal, setShowTrendsModal] = useState(false);
  const [leadsViewMode, setLeadsViewMode] = useState("table"); // "table" | "board"
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);
  const customAnchorRef = useRef(null);

  const [leadsStatusFilter, setLeadsStatusFilter] = useState("All");
  const [leadsInsuranceFilter, setLeadsInsuranceFilter] = useState("All");
  const [leadsCancelReasonFilter, setLeadsCancelReasonFilter] = useState("All");
  const [leadsDaysOpenFilter, setLeadsDaysOpenFilter] = useState("All");
  const [leadsTimeToContactFilter, setLeadsTimeToContactFilter] = useState("All");
  const [leadsFirstContactByFilter, setLeadsFirstContactByFilter] = useState("All");

  const [tasksStatusFilter, setTasksStatusFilter] = useState("All");
  const [tasksPriorityFilter, setTasksPriorityFilter] = useState("All");
  const [tasksCreatedByFilter, setTasksCreatedByFilter] = useState("All");
  const [tasksDueDateFilter, setTasksDueDateFilter] = useState("All");

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

  const stats = getBMStats(leads, dateRange, branch);
  const branchLeads = getLeadsForBranch(leads, branch);

  const leadsFilterOptions = useMemo(() => {
    const statuses = [...new Set(branchLeads.map((l) => l.status))].sort();
    const insuranceCompanies = [...new Set(branchLeads.map((l) => l.insuranceCompany ?? "—"))].sort((a, b) => (a === "—" ? 1 : b === "—" ? -1 : a.localeCompare(b)));
    const cancelReasons = [...new Set(branchLeads.map((l) => l.hlesReason ?? "—"))].sort((a, b) => (a === "—" ? 1 : b === "—" ? -1 : a.localeCompare(b)));
    const timeToContacts = [...new Set(branchLeads.map((l) => l.timeToFirstContact ?? "—"))].sort((a, b) => (a === "—" ? 1 : b === "—" ? -1 : a.localeCompare(b)));
    const firstContactBy = [...new Set(branchLeads.map((l) => l.firstContactBy ?? "none"))].sort();
    const daysOpenRanges = [
      { value: "0-1", label: "0–1 days" },
      { value: "2-5", label: "2–5 days" },
      { value: "6-10", label: "6–10 days" },
      { value: "11-", label: "11+ days" },
    ];
    return { statuses, insuranceCompanies, cancelReasons, timeToContacts, firstContactBy, daysOpenRanges };
  }, [branchLeads]);

  const filteredBranchLeads = useMemo(() => {
    let result = branchLeads;
    if (leadsStatusFilter !== "All") result = result.filter((l) => l.status === leadsStatusFilter);
    if (leadsInsuranceFilter !== "All") result = result.filter((l) => (l.insuranceCompany ?? "—") === leadsInsuranceFilter);
    if (leadsCancelReasonFilter !== "All") result = result.filter((l) => (l.hlesReason ?? "—") === leadsCancelReasonFilter);
    if (leadsTimeToContactFilter !== "All") result = result.filter((l) => (l.timeToFirstContact ?? "—") === leadsTimeToContactFilter);
    if (leadsFirstContactByFilter !== "All") result = result.filter((l) => (l.firstContactBy ?? "none") === leadsFirstContactByFilter);
    if (leadsDaysOpenFilter !== "All") {
      const parts = leadsDaysOpenFilter.split("-");
      const min = Number(parts[0]);
      const max = parts[1] ? (parts[1] === "" ? null : Number(parts[1])) : min;
      result = result.filter((l) => {
        const d = l.daysOpen ?? 0;
        if (max === null) return d >= min; // e.g. "11-" means 11+
        return d >= min && d <= max;
      });
    }
    result = [...result].sort((a, b) => (b.daysOpen ?? 0) - (a.daysOpen ?? 0));
    return result;
  }, [branchLeads, leadsStatusFilter, leadsInsuranceFilter, leadsCancelReasonFilter, leadsDaysOpenFilter, leadsTimeToContactFilter, leadsFirstContactByFilter]);

  const tasksFilterOptions = useMemo(() => {
    const statuses = [...new Set(branchTasks.map((t) => t.status))].sort();
    const priorities = [...new Set(branchTasks.map((t) => t.priority ?? "Normal"))].sort((a, b) => {
      const order = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
      return (order[a] ?? 2) - (order[b] ?? 2);
    });
    const createdBys = [...new Set(branchTasks.map((t) => t.createdBy ?? "—").filter(Boolean))].sort((a, b) => (a === "—" ? 1 : b === "—" ? -1 : a.localeCompare(b)));
    const dueDateRanges = [
      { value: "overdue", label: "Overdue" },
      { value: "today", label: "Due today" },
      { value: "week", label: "Due this week" },
      { value: "later", label: "Due later" },
      { value: "none", label: "No due date" },
    ];
    return { statuses, priorities, createdBys, dueDateRanges };
  }, [branchTasks]);

  const filteredBranchTasks = useMemo(() => {
    let result = branchTasks;
    if (tasksStatusFilter !== "All") result = result.filter((t) => t.status === tasksStatusFilter);
    if (tasksPriorityFilter !== "All") result = result.filter((t) => (t.priority ?? "Normal") === tasksPriorityFilter);
    if (tasksCreatedByFilter !== "All") result = result.filter((t) => (t.createdBy ?? "—") === tasksCreatedByFilter);
    if (tasksDueDateFilter !== "All") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(today);
      endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
      endOfWeek.setHours(23, 59, 59, 999);
      result = result.filter((t) => {
        const d = t.dueDate;
        if (!d) return tasksDueDateFilter === "none";
        const due = new Date(d + "T00:00:00");
        due.setHours(0, 0, 0, 0);
        if (tasksDueDateFilter === "overdue") return due < today;
        if (tasksDueDateFilter === "today") return due.getTime() === today.getTime();
        if (tasksDueDateFilter === "week") return due >= today && due <= endOfWeek;
        if (tasksDueDateFilter === "later") return due > endOfWeek;
        if (tasksDueDateFilter === "none") return false;
        return true;
      });
    }
    return result;
  }, [branchTasks, tasksStatusFilter, tasksPriorityFilter, tasksCreatedByFilter, tasksDueDateFilter]);

  const presetKey = useCustom ? "custom" : selectedPresetKey;
  const comparisonRange = useCustom
    ? getComparisonDateRange("custom", customStart, customEnd)
    : getComparisonDateRange(selectedPresetKey);
  const comparisonStats = getBMStats(leads, comparisonRange, branch);

  const convRate = stats.total ? Math.round((stats.rented / stats.total) * 100) : 0;
  const prevConvRate = comparisonStats.total ? Math.round((comparisonStats.rented / comparisonStats.total) * 100) : 0;
  const prevCommentRate = comparisonStats.enrichmentRate ?? 0;

  const relChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  // Tasks in date range for period-over-period comparison (consistent with other metrics)
  const tasksInPeriod = tasksInDateRange(branchTasks, dateRange);
  const tasksInComparison = comparisonRange
    ? tasksInDateRange(branchTasks, comparisonRange)
    : [];
  const openInPeriod = getOpenTasksCount(tasksInPeriod);
  const openInComparison = getOpenTasksCount(tasksInComparison);
  const completionInPeriod = getTaskCompletionRate(tasksInPeriod);
  const completionInComparison = getTaskCompletionRate(tasksInComparison);

  const openTasksCount = dateRange ? openInPeriod : getOpenTasksCount(branchTasks);
  const taskCompletionRate = dateRange && tasksInPeriod.length > 0 ? completionInPeriod : getTaskCompletionRate(branchTasks);
  const avgTimeToContact = getAverageTimeToContact(leads, dateRange, branch);
  const avgTimeToContactMin = getAverageTimeToContactMinutes(leads, dateRange, branch);
  const prevAvgTimeToContactMin = getAverageTimeToContactMinutes(leads, comparisonRange, branch);

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
    { label: "Total Leads", value: stats.total, color: "text-[var(--hertz-black)]", isCount: true, relChange: relChange(stats.total, comparisonStats.total) },
    { label: "Conversion Rate", value: `${convRate}%`, color: "text-[var(--color-success)]", isCount: false, relChange: relChange(convRate, prevConvRate) },
    { label: "Comment Rate", value: `${stats.enrichmentRate}%`, color: "text-[var(--hertz-primary)]", isCount: false, relChange: relChange(stats.enrichmentRate, prevCommentRate) },
  ];

  const secondaryTiles = [
    { label: "Open Tasks", value: openTasksCount, color: "text-[var(--hertz-black)]", relChange: relChangeOpenTasks },
    { label: "Task Completion Rate", value: taskCompletionRate != null ? `${taskCompletionRate}%` : "—", color: "text-[var(--neutral-700)]", relChange: relChangeCompletion },
    { label: "Average Time for First Contact", value: avgTimeToContact ?? "—", color: "text-[var(--neutral-700)]", relChange: relChangeAvgTime, lowerIsBetter: true },
  ];

  const activePreset = useCustom ? { key: "custom" } : presets.find((p) => p.key === selectedPresetKey);
  const rangeLabel = formatDateRange(activePreset, customStart, customEnd);

  const greeting = getTimeOfDayGreeting();

  return (
    <div className="max-w-6xl">
      <AnimatePresence>
        {showTrendsModal && (
          <TrendsViewModal onClose={() => setShowTrendsModal(false)} />
        )}
      </AnimatePresence>
      {/* Dashboard: Greeting + Summary + Stats + Trend */}
      <div id="dashboard" className="mb-10 scroll-mt-4">
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
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.2, duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="w-16 h-1 bg-[var(--hertz-primary)] mt-3 origin-left"
        />
      </div>

      {/* Summary: Date presets + Stats */}
      <div data-onboarding="summary">
      <SectionHeader title="Summary" />
      <div className="flex items-center gap-2 flex-nowrap mb-6 whitespace-nowrap overflow-x-auto">
        <div className="flex items-center gap-1.5 flex-nowrap">
          {presets.map((p) => {
            const isActive = !useCustom && selectedPresetKey === p.key;
            return (
              <motion.button
                key={p.key}
                onClick={() => { setSelectedPresetKey(p.key); setUseCustom(false); setShowCustomCalendar(false); }}
                whileHover={!reduceMotion ? { scale: 1.03 } : {}}
                whileTap={!reduceMotion ? { scale: 0.97 } : {}}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-200 cursor-pointer shrink-0 ${
                  isActive
                    ? "bg-[var(--hertz-primary)] text-[var(--hertz-black)] shadow-[var(--shadow-md)]"
                    : "bg-[var(--neutral-50)] text-[var(--neutral-600)] border border-transparent hover:border-[var(--neutral-200)] hover:bg-[var(--neutral-100)]"
                }`}
              >
                {p.label}
              </motion.button>
            );
          })}
          <span className="text-[var(--neutral-200)] mx-0.5">|</span>
          <div ref={customAnchorRef} className="relative shrink-0">
            <motion.button
              onClick={() => { setUseCustom(true); setShowCustomCalendar(true); }}
              whileHover={!reduceMotion ? { scale: 1.03 } : {}}
              whileTap={!reduceMotion ? { scale: 0.97 } : {}}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-200 cursor-pointer shrink-0 ${
                useCustom ? "bg-[var(--hertz-primary)] text-[var(--hertz-black)] shadow-[var(--shadow-md)]" : "bg-[var(--neutral-50)] text-[var(--neutral-600)] border border-transparent hover:border-[var(--neutral-200)] hover:bg-[var(--neutral-100)]"
              }`}
            >
              Custom
            </motion.button>
            <AnimatePresence>
              {showCustomCalendar && (
                <DateRangeCalendar
                  start={customStart}
                  end={customEnd}
                  onChange={({ start: s, end: e }) => { setCustomStart(s); setCustomEnd(e); }}
                  onClose={() => setShowCustomCalendar(false)}
                  anchorRef={customAnchorRef}
                />
              )}
            </AnimatePresence>
          </div>
          {rangeLabel && <span className="text-xs text-[var(--neutral-600)] ml-2 font-medium shrink-0">{rangeLabel}</span>}
        </div>
        <span data-onboarding="view-trends">
          <TrendsViewButton
            onOpen={() => {
              setShowTrendsModal(true);
              window.dispatchEvent(new CustomEvent("onboarding:action", { detail: { actionType: "view_trends" } }));
            }}
          />
        </span>
      </div>

      {/* Rate tiles */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {rateTiles.map((tile, i) => (
          <motion.div
            key={tile.label}
            {...cardAnim(i + 1, reduceMotion)}
            whileHover={!reduceMotion ? { y: -2, boxShadow: "0 8px 24px rgba(39,36,37,0.10)", transition: { duration: 0.2 } } : {}}
            className="bg-white border border-[var(--neutral-200)] rounded-lg px-4 py-3 shadow-[var(--shadow-sm)]"
          >
            <p className="text-[10px] font-bold text-[var(--neutral-600)] uppercase tracking-wider">{tile.label}</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <p className="text-xl font-extrabold tracking-tight text-[var(--hertz-black)]">{tile.value}</p>
              {comparisonRange != null && (
                <span
                  className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                    tile.relChange > 0 ? "bg-[#2E7D32]/15 text-[#2E7D32]" : tile.relChange < 0 ? "bg-[#C62828]/15 text-[#C62828]" : "bg-[var(--neutral-100)] text-[var(--neutral-600)]"
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
      {/* Secondary tiles: Open Tasks, Task Completion Rate, Average Time for First Contact */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {secondaryTiles.map((tile, i) => (
          <motion.div
            key={tile.label}
            {...cardAnim(4 + i, reduceMotion)}
            whileHover={!reduceMotion ? { y: -2, boxShadow: "0 8px 24px rgba(39,36,37,0.10)", transition: { duration: 0.2 } } : {}}
            className="bg-white border border-[var(--neutral-200)] rounded-lg px-4 py-3 shadow-[var(--shadow-sm)]"
          >
            <p className="text-[10px] font-bold text-[var(--neutral-600)] uppercase tracking-wider">{tile.label}</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <p className={`text-xl font-extrabold tracking-tight ${tile.color}`}>{tile.value}</p>
              {comparisonRange != null && tile.relChange != null && (
                <span
                  className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                    // lowerIsBetter: decrease = green (relChange>0), increase = red (relChange<0)
                    tile.relChange > 0 ? "bg-[#2E7D32]/15 text-[#2E7D32]" : tile.relChange < 0 ? "bg-[#C62828]/15 text-[#C62828]" : "bg-[var(--neutral-100)] text-[var(--neutral-600)]"
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

      {/* Horizontal stacked bar: Total Leads (rented, cancelled, unused) */}
      <motion.div
        {...cardAnim(3, reduceMotion)}
        className="mb-6"
      >
        <LeadStackedBarChart
          total={stats.total}
          rented={stats.rented}
          cancelled={stats.cancelled}
          unused={stats.unused}
        />
      </motion.div>
      </div>

      {/* My Leads */}
      <div id="lead-pipeline" className="scroll-mt-4 mb-10" data-onboarding="my-leads">
        <SectionHeader title="My Leads" />
        <div className="flex items-center gap-2 mt-2 mb-3">
          <div className="flex items-center gap-1 rounded-lg border border-[var(--neutral-200)] p-0.5 bg-[var(--neutral-50)]">
            <button
              onClick={() => setLeadsViewMode("table")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                leadsViewMode === "table"
                  ? "bg-white text-[var(--hertz-black)] shadow-sm"
                  : "text-[var(--neutral-600)] hover:text-[var(--hertz-black)]"
              }`}
              title="Table view"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span className="text-sm font-medium">Table view</span>
            </button>
            <button
              onClick={() => setLeadsViewMode("board")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                leadsViewMode === "board"
                  ? "bg-white text-[var(--hertz-black)] shadow-sm"
                  : "text-[var(--neutral-600)] hover:text-[var(--hertz-black)]"
              }`}
              title="Board view"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              <span className="text-sm font-medium">Board view</span>
            </button>
          </div>
        </div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap mb-4 w-full">
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="text-xs text-[var(--neutral-600)] font-medium whitespace-nowrap">Status</label>
          <select
            className="px-2 py-1 border border-[var(--neutral-200)] rounded text-xs text-[var(--hertz-black)] bg-white focus:outline-none focus:border-[var(--hertz-primary)] min-w-[5rem]"
            value={leadsStatusFilter}
            onChange={(e) => setLeadsStatusFilter(e.target.value)}
          >
            <option value="All">All</option>
            {leadsFilterOptions.statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="text-xs text-[var(--neutral-600)] font-medium whitespace-nowrap">Insurance</label>
          <select
            className="px-2 py-1 border border-[var(--neutral-200)] rounded text-xs text-[var(--hertz-black)] bg-white focus:outline-none focus:border-[var(--hertz-primary)] min-w-[5rem]"
            value={leadsInsuranceFilter}
            onChange={(e) => setLeadsInsuranceFilter(e.target.value)}
          >
            <option value="All">All</option>
            {leadsFilterOptions.insuranceCompanies.map((ic) => (
              <option key={ic} value={ic}>{ic}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="text-xs text-[var(--neutral-600)] font-medium whitespace-nowrap" title="Cancel Reason">Reason</label>
          <select
            className="px-2 py-1 border border-[var(--neutral-200)] rounded text-xs text-[var(--hertz-black)] bg-white focus:outline-none focus:border-[var(--hertz-primary)] min-w-[6rem]"
            value={leadsCancelReasonFilter}
            onChange={(e) => setLeadsCancelReasonFilter(e.target.value)}
          >
            <option value="All">All</option>
            {leadsFilterOptions.cancelReasons.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="text-xs text-[var(--neutral-600)] font-medium whitespace-nowrap">Days</label>
          <select
            className="px-2 py-1 border border-[var(--neutral-200)] rounded text-xs text-[var(--hertz-black)] bg-white focus:outline-none focus:border-[var(--hertz-primary)] min-w-[5.5rem]"
            value={leadsDaysOpenFilter}
            onChange={(e) => setLeadsDaysOpenFilter(e.target.value)}
          >
            <option value="All">All</option>
            {leadsFilterOptions.daysOpenRanges.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="text-xs text-[var(--neutral-600)] font-medium whitespace-nowrap" title="Time to Contact">Contact</label>
          <select
            className="px-2 py-1 border border-[var(--neutral-200)] rounded text-xs text-[var(--hertz-black)] bg-white focus:outline-none focus:border-[var(--hertz-primary)] min-w-[5rem]"
            value={leadsTimeToContactFilter}
            onChange={(e) => setLeadsTimeToContactFilter(e.target.value)}
          >
            <option value="All">All</option>
            {leadsFilterOptions.timeToContacts.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="text-xs text-[var(--neutral-600)] font-medium whitespace-nowrap" title="First contact by">Contact By</label>
          <select
            className="px-2 py-1 border border-[var(--neutral-200)] rounded text-xs text-[var(--hertz-black)] bg-white focus:outline-none focus:border-[var(--hertz-primary)] min-w-[5rem]"
            value={leadsFirstContactByFilter}
            onChange={(e) => setLeadsFirstContactByFilter(e.target.value)}
          >
            <option value="All">All</option>
            {leadsFilterOptions.firstContactBy.map((fc) => (
              <option key={fc} value={fc}>{fc === "none" ? "Not contacted" : fc}</option>
            ))}
          </select>
        </div>
        {(leadsStatusFilter !== "All" || leadsInsuranceFilter !== "All" || leadsCancelReasonFilter !== "All" || leadsDaysOpenFilter !== "All" || leadsTimeToContactFilter !== "All" || leadsFirstContactByFilter !== "All") && (
          <button
            onClick={() => {
              setLeadsStatusFilter("All");
              setLeadsInsuranceFilter("All");
              setLeadsCancelReasonFilter("All");
              setLeadsDaysOpenFilter("All");
              setLeadsTimeToContactFilter("All");
              setLeadsFirstContactByFilter("All");
            }}
            className="px-2 py-1 rounded text-xs font-medium text-[var(--neutral-600)] hover:bg-[var(--neutral-100)] transition-colors cursor-pointer shrink-0"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-[var(--neutral-600)] shrink-0 whitespace-nowrap">
          {filteredBranchLeads.length} of {branchLeads.length} leads
        </span>
      </div>
      <AnimatePresence mode="wait">
      {leadsViewMode === "table" ? (
      <motion.div
        key="table"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="border-2 border-[#E5E5E5] rounded-lg overflow-hidden shadow-[0_2px_8px_rgba(39,36,37,0.08)]"
      >
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="bg-[#272425] text-center text-xs text-white font-semibold uppercase tracking-wider">
              <th className="px-3 py-4 w-[9%] break-words">Received Date</th>
              <th className="px-3 py-4 w-[9%] break-words">Confirmation #</th>
              <th className="px-3 py-4 w-[11%] break-words">Customer</th>
              <th className="px-3 py-4 w-[8%] break-words">Status</th>
              <th className="px-3 py-4 w-[8%] break-words">Days Open</th>
              <th className="px-3 py-4 w-[11%] break-words">First Contact Date</th>
              <th className="px-3 py-4 w-[10%] break-words">Time to Contact</th>
              <th className="px-3 py-4 w-[14%] break-words">Cancel Reason</th>
              <th className="px-3 py-4 w-[20%] break-words">Comments</th>
            </tr>
          </thead>
          <tbody>
            {filteredBranchLeads.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-[#F8F8F8] flex items-center justify-center text-[#FFD100]">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-[#272425] font-semibold">{branchLeads.length === 0 ? "All caught up" : "No matching leads"}</p>
                    <p className="text-sm text-[#666666]">{branchLeads.length === 0 ? "No leads for this branch right now." : "Try adjusting your filters."}</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredBranchLeads.map((lead, i) => {
                const org = getHierarchyForBranch(lead.branch);
                const row = leadToHlesRow(lead, org);
                return (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    data-onboarding={i === 0 ? "lead-row" : undefined}
                    className="border-t border-[var(--neutral-200)] cursor-pointer hover:bg-[var(--neutral-50)] transition-colors duration-150"
                    onClick={() => {
                      selectLead(lead.id);
                      navigateTo("bm-lead-detail");
                      window.dispatchEvent(new CustomEvent("onboarding:action", { detail: { actionType: "click_lead" } }));
                    }}
                  >
                    <td className="px-3 py-4 text-center text-[var(--neutral-600)] whitespace-nowrap">{row.INIT_DT_FINAL}</td>
                    <td className="px-3 py-4 text-center text-[var(--hertz-black)] font-medium">{row.CONFIRM_NUM}</td>
                    <td className="px-3 py-4 text-center font-semibold text-[var(--hertz-black)]">{row.RENTER_LAST}</td>
                    <td className="px-3 py-4 text-center"><StatusBadge status={row.STATUS} /></td>
                    <td className="px-3 py-4 text-center text-[var(--neutral-600)]">{row.DAYS_OPEN}</td>
                    <td className="px-3 py-4 text-center text-[var(--neutral-600)] whitespace-nowrap">{row.DT_FROM_ALPHA1}</td>
                    <td className="px-3 py-4 text-center text-[var(--neutral-600)]">{row.TIME_TO_CONTACT}</td>
                    <td className="px-3 py-4 text-center text-[var(--neutral-600)] break-words">{row.CANCEL_REASON}</td>
                    <td className="px-3 py-4 text-center text-[var(--neutral-600)] break-words" title={row.COMMENTS}>{row.COMMENTS}</td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </motion.div>
      ) : (
      <motion.div
        key="board"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="border-2 border-[#E5E5E5] rounded-lg overflow-hidden shadow-[0_2px_8px_rgba(39,36,37,0.08)] p-4"
      >
        {filteredBranchLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-full bg-[#F8F8F8] flex items-center justify-center text-[#FFD100]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[#272425] font-semibold mt-2">{branchLeads.length === 0 ? "All caught up" : "No matching leads"}</p>
            <p className="text-sm text-[#666666]">{branchLeads.length === 0 ? "No leads for this branch right now." : "Try adjusting your filters."}</p>
          </div>
        ) : (
          <LeadsBoardView
            leads={filteredBranchLeads}
            onLeadClick={(lead) => {
              selectLead(lead.id);
              navigateTo("bm-lead-detail");
              window.dispatchEvent(new CustomEvent("onboarding:action", { detail: { actionType: "click_lead" } }));
            }}
            getHierarchyForBranch={getHierarchyForBranch}
            onStatusChange={updateLeadEnrichment}
          />
        )}
      </motion.div>
      )}
      </AnimatePresence>
      </div>

      {/* Open Tasks */}
      <div id="open-tasks" className="scroll-mt-4">
      <SectionHeader title="Open Tasks" />
      {/* Task filter bar */}
      <div className="flex items-center gap-2 flex-wrap mb-4 w-full">
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="text-xs text-[var(--neutral-600)] font-medium whitespace-nowrap">Status</label>
          <select
            className="px-2 py-1 border border-[var(--neutral-200)] rounded text-xs text-[var(--hertz-black)] bg-white focus:outline-none focus:border-[var(--hertz-primary)] min-w-[5rem]"
            value={tasksStatusFilter}
            onChange={(e) => setTasksStatusFilter(e.target.value)}
          >
            <option value="All">All</option>
            {tasksFilterOptions.statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="text-xs text-[var(--neutral-600)] font-medium whitespace-nowrap">Priority</label>
          <select
            className="px-2 py-1 border border-[var(--neutral-200)] rounded text-xs text-[var(--hertz-black)] bg-white focus:outline-none focus:border-[var(--hertz-primary)] min-w-[5rem]"
            value={tasksPriorityFilter}
            onChange={(e) => setTasksPriorityFilter(e.target.value)}
          >
            <option value="All">All</option>
            {tasksFilterOptions.priorities.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="text-xs text-[var(--neutral-600)] font-medium whitespace-nowrap">Created By</label>
          <select
            className="px-2 py-1 border border-[var(--neutral-200)] rounded text-xs text-[var(--hertz-black)] bg-white focus:outline-none focus:border-[var(--hertz-primary)] min-w-[5rem]"
            value={tasksCreatedByFilter}
            onChange={(e) => setTasksCreatedByFilter(e.target.value)}
          >
            <option value="All">All</option>
            {tasksFilterOptions.createdBys.map((cb) => (
              <option key={cb} value={cb}>{cb}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="text-xs text-[var(--neutral-600)] font-medium whitespace-nowrap">Due Date</label>
          <select
            className="px-2 py-1 border border-[var(--neutral-200)] rounded text-xs text-[var(--hertz-black)] bg-white focus:outline-none focus:border-[var(--hertz-primary)] min-w-[6rem]"
            value={tasksDueDateFilter}
            onChange={(e) => setTasksDueDateFilter(e.target.value)}
          >
            <option value="All">All</option>
            {tasksFilterOptions.dueDateRanges.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        {(tasksStatusFilter !== "All" || tasksPriorityFilter !== "All" || tasksCreatedByFilter !== "All" || tasksDueDateFilter !== "All") && (
          <button
            onClick={() => {
              setTasksStatusFilter("All");
              setTasksPriorityFilter("All");
              setTasksCreatedByFilter("All");
              setTasksDueDateFilter("All");
            }}
            className="px-2 py-1 rounded text-xs font-medium text-[var(--neutral-600)] hover:bg-[var(--neutral-100)] transition-colors cursor-pointer shrink-0"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-[var(--neutral-600)] shrink-0 whitespace-nowrap">
          {filteredBranchTasks.length} of {branchTasks.length} tasks
        </span>
      </div>
      <div className="border-2 border-[var(--neutral-200)] rounded-lg overflow-x-auto shadow-[var(--shadow-md)]">
        <table className="w-full min-w-[900px] table-fixed text-sm">
          <thead>
            <tr className="bg-[var(--hertz-black)] text-left text-xs text-white font-semibold uppercase tracking-wider">
              <th className="px-4 py-4 w-[18%] text-left">Title</th>
              <th className="px-4 py-4 w-[7%] text-center">Lead ID</th>
              <th className="px-4 py-4 w-[12%] text-left">Lead</th>
              <th className="px-4 py-4 w-[22%] text-left">Description</th>
              <th className="px-4 py-4 w-[10%] text-left">Due Date</th>
              <th className="px-4 py-4 w-[10%] text-center">Priority</th>
              <th className="px-4 py-4 w-[11%] text-center">Status</th>
              <th className="px-4 py-4 w-[10%] text-center">Created By</th>
            </tr>
          </thead>
          <tbody>
            {branchTasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-[var(--neutral-50)] flex items-center justify-center text-[var(--hertz-primary)]">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-[var(--hertz-black)] font-semibold">All clear</p>
                    <p className="text-sm text-[var(--neutral-600)]">No open tasks at the moment.</p>
                  </div>
                </td>
              </tr>
            ) : (
              branchTasks.map((task, i) => (
                <motion.tr
                  key={task.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => { selectTask?.(task.id); navigateTo("bm-task-detail"); }}
                  className="border-t border-[var(--neutral-200)] hover:bg-[var(--neutral-50)] transition-colors duration-150 cursor-pointer"
                >
                  <td className="px-4 py-4 font-semibold text-[var(--hertz-black)] min-w-0">
                    <span className="block truncate" title={task.title}>{task.title}</span>
                  </td>
                  <td className="px-4 py-4 text-center text-[var(--neutral-600)] font-mono text-xs">{task.leadId ?? "—"}</td>
                  <td className="px-4 py-4 text-[var(--neutral-600)] min-w-0">
                    <span className="block truncate" title={task.lead?.customer ?? getLeadById(leads ?? [], task.leadId)?.customer ?? undefined}>
                      {(task.lead?.customer ?? getLeadById(leads ?? [], task.leadId)?.customer) ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-[var(--neutral-600)] text-xs min-w-0">
                    <span className="block truncate" title={task.description ?? undefined}>{task.description ?? "—"}</span>
                  </td>
                  <td className="px-4 py-4 text-[var(--neutral-600)] whitespace-nowrap">{task.dueDate ?? "—"}</td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      task.priority === "Urgent" ? "bg-[var(--color-error)]/15 text-[var(--color-error)]" :
                      task.priority === "High" ? "bg-amber-100 text-amber-800" :
                      "bg-[var(--neutral-100)] text-[var(--neutral-600)]"
                    }`}>
                      {task.priority ?? "Normal"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      task.status === "Done" ? "bg-[var(--color-success)]/15 text-[var(--color-success)]" :
                      task.status === "In Progress" ? "bg-[var(--hertz-primary)]/25 text-[var(--hertz-black)]" :
                      "bg-[var(--color-error)]/15 text-[var(--color-error)]"
                    }`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center text-[var(--neutral-600)]">{task.createdBy ?? "—"}</td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}

export function BMDashboardInbox({ navigateTo, selectLead }) {
  const { leads } = useData();
  const directiveLeads = getAllLeads(leads).filter((l) => l.gmDirective);

  const handleClick = (lead) => {
    selectLead(lead.id);
    navigateTo("bm-lead-detail");
  };

  return (
    <>
      <SectionHeader title="Inbox" />
      <p className="text-sm text-[#6E6E6E] mb-5">
        Messages from your General Manager tied to specific reservations. Click a row to review and take action.
      </p>
      <div className="border-2 border-[#E5E5E5] rounded-lg overflow-hidden shadow-[0_2px_8px_rgba(39,36,37,0.08)] max-h-48 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#272425] text-left text-xs text-white font-semibold uppercase tracking-wider">
              <th className="px-5 py-2">Customer</th>
              <th className="px-5 py-2">Reservation ID</th>
              <th className="px-5 py-2">Branch</th>
              <th className="px-5 py-2">Status</th>
              <th className="px-5 py-2">Days Open</th>
              <th className="px-5 py-2">GM Directive</th>
            </tr>
          </thead>
          <tbody>
            {directiveLeads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-[#F8F8F8] flex items-center justify-center text-[#FFD100]">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <p className="text-[#272425] font-semibold">No directives</p>
                    <p className="text-sm text-[#666666]">Your inbox is clear.</p>
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
                  <td className="px-5 py-2 font-semibold text-[var(--hertz-black)]">{lead.customer}</td>
                  <td className="px-5 py-2 font-mono text-xs text-[var(--neutral-600)]">{lead.reservationId}</td>
                  <td className="px-5 py-2 text-[var(--neutral-600)]">{lead.branch}</td>
                  <td className="px-5 py-2"><StatusBadge status={lead.status} /></td>
                  <td className="px-5 py-2 text-[var(--neutral-600)]">{lead.daysOpen}d</td>
                  <td className="px-5 py-2 text-[var(--neutral-600)] max-w-xs truncate">{lead.gmDirective}</td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TimeToContactCard() {
  const ttc = getTimeToContactStats();
  const segments = [
    { label: "< 30m", value: ttc.within30m, color: "#2E7D32" },
    { label: "30m–1h", value: ttc.within1h, color: "#FFD100" },
    { label: "1–3h", value: ttc.within3h, color: "#1A1A1A" },
    { label: "> 3h", value: ttc.over3h, color: "#C62828" },
  ];
  return (
    <motion.div {...cardAnim(3)} className="border border-[#E6E6E6] rounded-lg p-5">
      <p className="text-xs font-bold text-[#6E6E6E] uppercase tracking-wide mb-3">Time to First Contact</p>
      <div className="flex h-4 rounded overflow-hidden mb-3">
        {segments.map((s) => (
          <div key={s.label} style={{ width: `${s.value}%`, backgroundColor: s.color }} />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {segments.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-lg font-bold text-[var(--hertz-black)]">{s.value}%</p>
            <p className="text-[10px] text-[#6E6E6E]">{s.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function ContactSourceCard() {
  const src = getContactSourceStats();
  return (
    <motion.div {...cardAnim(4)} className="border border-[#E6E6E6] rounded-lg p-5">
      <p className="text-xs font-bold text-[#6E6E6E] uppercase tracking-wide mb-3">First Contact Source</p>
      <div className="flex gap-4">
        <div className="flex-1 text-center">
          <p className="text-2xl font-bold text-[var(--hertz-black)]">{src.branchContactRate}%</p>
          <p className="text-xs text-[#6E6E6E]">Branch</p>
        </div>
        <div className="w-px bg-[#E6E6E6]" />
        <div className="flex-1 text-center">
          <p className="text-2xl font-bold text-[var(--hertz-black)]">{src.hrdContactRate}%</p>
          <p className="text-xs text-[#6E6E6E]">HRD (OKC)</p>
        </div>
      </div>
    </motion.div>
  );
}

function GMDashboard({ navigateTo }) {
  const { leads } = useData();
  const stats = getGMStats(leads);
  const trends = getGMTrends();
  const cards = [
    { label: "Cancelled Unreviewed", value: stats.cancelledUnreviewed, color: "text-[#C62828]" },
    { label: "Unused Overdue (5+ days)", value: stats.unusedOverdue, color: "text-[#FFD100]" },
    { label: "Comment Compliance", value: `${stats.enrichmentCompliance}%`, color: "text-[#2E7D32]" },
  ];

  const actions = [
    { label: "View Compliance", view: "gm-compliance" },
    { label: "Review Cancelled", view: "gm-cancelled" },
    { label: "Spot Check", view: "gm-spot-check" },
  ];

  return (
    <div>
      <div id="dashboard" className="scroll-mt-4">
        <SectionHeader title="This Week · Feb 17–21" />
        <div className="grid grid-cols-3 gap-4 mb-4">
          {cards.map((card, i) => (
            <motion.div
              key={card.label}
              {...cardAnim(i)}
              className="border border-[#E6E6E6] rounded-lg p-5"
            >
              <p className="text-xs font-bold text-[#6E6E6E] uppercase tracking-wide">{card.label}</p>
              <p className="text-3xl font-bold mt-1 text-[var(--hertz-black)]">{card.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <TimeToContactCard />
          <ContactSourceCard />
        </div>

        <SectionHeader title="4-Week Trend" />
        <div className="grid grid-cols-3 gap-4 mb-8">
          <motion.div {...cardAnim(0)}>
            <MiniBarChart
              data={trends.cancelledUnreviewed}
              labels={trends.labels}
              color="#C62828"
              label="Cancelled Unreviewed"
            />
          </motion.div>
          <motion.div {...cardAnim(1)}>
            <MiniBarChart
              data={trends.commentCompliance}
              labels={trends.labels}
              color="#2E7D32"
              label="Comment Compliance"
              suffix="%"
            />
          </motion.div>
          <motion.div {...cardAnim(2)}>
            <MiniBarChart
              data={trends.zoneConversionRate}
              labels={trends.labels}
              color="#1A1A1A"
              label="Zone Conversion Rate"
              suffix="%"
            />
          </motion.div>
        </div>

        <motion.div {...cardAnim(3)} className="flex gap-3 mb-12">
          {actions.map((a) => (
            <button
              key={a.view}
              onClick={() => navigateTo(a.view)}
              className="px-4 py-2 bg-[#FFD100] text-[#1A1A1A] rounded font-medium text-sm hover:bg-[#E6BC00] transition-colors cursor-pointer"
            >
              {a.label}
            </button>
          ))}
        </motion.div>
      </div>

      <div id="compliance" className="scroll-mt-4 mb-12">
        <InteractiveComplianceDashboard />
      </div>

      <div id="cancelled-leads" className="scroll-mt-4 mb-12">
        <InteractiveCancelledLeads />
      </div>

      <div id="unused-leads" className="scroll-mt-4 mb-12">
        <InteractiveUnusedLeads />
      </div>

      <div id="lead-review" className="scroll-mt-4 mb-12">
        <InteractiveThreeColumn />
      </div>

      <div id="spot-check" className="scroll-mt-4">
        <InteractiveSpotCheck />
      </div>
    </div>
  );
}

function AdminDashboard({ navigateTo }) {
  const cards = [
    { label: "Data Uploads", desc: "Upload HLES and TRANSLOG files", view: "admin-uploads" },
    { label: "Org Mapping", desc: "Manage BM/Branch/GM assignments", view: "admin-org-mapping" },
  ];

  return (
    <div className="grid grid-cols-2 gap-6">
      {cards.map((card, i) => (
        <motion.button
          key={card.view}
          {...cardAnim(i)}
          onClick={() => navigateTo(card.view)}
          className="border border-[#E6E6E6] rounded-lg p-6 text-left hover:border-[#FFD100] transition-colors cursor-pointer"
        >
          <p className="text-lg font-semibold text-[#1A1A1A] mb-1">{card.label}</p>
          <p className="text-sm text-[#6E6E6E]">{card.desc}</p>
        </motion.button>
      ))}
    </div>
  );
}

const BM_SECTION_MAP = {
  "bm-dashboard": "dashboard",
  "bm-leads": "lead-pipeline",
  "bm-todo": "open-tasks",
};

const GM_SECTION_MAP = {
  "gm-dashboard": "dashboard",
  "gm-compliance": "compliance",
  "gm-cancelled": "cancelled-leads",
  "gm-unused": "unused-leads",
  "gm-review": "lead-review",
  "gm-spot-check": "spot-check",
};

// Reverse: sectionId -> viewId for scroll-based highlight
const BM_SECTION_TO_VIEW = Object.fromEntries(
  Object.entries(BM_SECTION_MAP).map(([view, section]) => [section, view])
);
const GM_SECTION_TO_VIEW = Object.fromEntries(
  Object.entries(GM_SECTION_MAP).map(([view, section]) => [section, view])
);

export default function InteractiveDashboard() {
  const { role, activeView, navigateTo, setScrollActiveView, selectLead, selectTask } = useApp();

  useEffect(() => {
    const sectionMap = role === "bm" ? BM_SECTION_MAP : role === "gm" ? GM_SECTION_MAP : null;
    const sectionId = sectionMap?.[activeView];
    if (sectionId) {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [role, activeView]);

  useEffect(() => {
    const sectionToView = role === "bm" ? BM_SECTION_TO_VIEW : role === "gm" ? GM_SECTION_TO_VIEW : null;
    if (!sectionToView) return;

    const scrollRoot = document.getElementById("dashboard-scroll-root");
    if (!scrollRoot) return;

    const sectionIds = Object.keys(sectionToView);
    const observed = [];

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter((e) => e.isIntersecting);
        if (intersecting.length === 0) return;
        const sorted = intersecting
          .map((e) => ({ entry: e, viewId: sectionToView[e.target.id] }))
          .filter((x) => x.viewId)
          .sort((a, b) => a.entry.boundingClientRect.top - b.entry.boundingClientRect.top);
        if (sorted.length > 0) {
          setScrollActiveView(sorted[0].viewId);
        }
      },
      { root: scrollRoot, rootMargin: "0px 0px -60% 0px", threshold: 0 }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
        observed.push(el);
      }
    });

    return () => {
      observed.forEach((el) => observer.unobserve(el));
    };
  }, [role, setScrollActiveView]);

  return (
    <div>
      {role === "bm" ? (
        <BMDashboard navigateTo={navigateTo} selectLead={selectLead} selectTask={selectTask} />
      ) : (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--hertz-black)]">{roleMeta[role]?.label} Dashboard</h1>
            <div className="w-12 h-1 bg-[var(--hertz-primary)] mt-2" />
          </div>
          {role === "gm" && <GMDashboard navigateTo={navigateTo} />}
          {role === "admin" && <AdminDashboard navigateTo={navigateTo} />}
        </>
      )}
    </div>
  );
}
