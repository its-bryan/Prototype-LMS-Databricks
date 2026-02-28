import { branchManagers, weeklyTrends, orgMapping, tasks, dailyTrends } from "../data/mockData";

// Demo "now" — set so "this week" aligns with mock data (Feb 17–23)
const NOW = new Date("2026-02-22T09:00:00");

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getDateRangePresets() {
  const thisMonday = getMonday(NOW);
  const thisMonthStart = new Date(NOW.getFullYear(), NOW.getMonth(), 1);
  const thisYearStart = new Date(NOW.getFullYear(), 0, 1);

  return [
    { key: "this_week", label: "This week", start: thisMonday, end: new Date(thisMonday.getTime() + 6 * 86400000 + 86399999) },
    { key: "this_month", label: "This month", start: thisMonthStart, end: new Date(NOW) },
    { key: "this_year", label: "This Year", start: thisYearStart, end: new Date(NOW) },
  ];
}

/** Returns the comparison (previous) period for relative change: this_week→last_week, this_month→prev month, this_year→prev year, custom→same-length prior period */
export function getComparisonDateRange(selectedPresetKey, customStart, customEnd) {
  const presets = getDateRangePresets();
  const preset = presets.find((p) => p.key === selectedPresetKey);

  if (selectedPresetKey === "this_week") {
    const thisMonday = preset?.start;
    if (!thisMonday) return null;
    const lastMonday = new Date(thisMonday.getTime() - 7 * 86400000);
    return { start: lastMonday, end: new Date(lastMonday.getTime() + 6 * 86400000 + 86399999) };
  }
  if (selectedPresetKey === "this_month") {
    const thisMonthStart = preset?.start;
    if (!thisMonthStart) return null;
    const prevMonthStart = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth() - 1, 1);
    const prevMonthEnd = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth(), 0, 23, 59, 59);
    return { start: prevMonthStart, end: prevMonthEnd };
  }
  if (selectedPresetKey === "this_year") {
    const thisYearStart = preset?.start;
    const thisYearEnd = preset?.end;
    if (!thisYearStart || !thisYearEnd) return null;
    const spanMs = thisYearEnd.getTime() - thisYearStart.getTime();
    const prevYearEnd = new Date(thisYearStart.getTime() - 86400000);
    const prevYearStart = new Date(prevYearEnd.getTime() - spanMs);
    return { start: prevYearStart, end: prevYearEnd };
  }
  if (selectedPresetKey === "custom" && customStart && customEnd) {
    const start = new Date(customStart + "T00:00:00");
    const end = new Date(customEnd + "T23:59:59");
    const spanMs = end.getTime() - start.getTime();
    const priorEnd = new Date(start.getTime() - 1);
    const priorStart = new Date(priorEnd.getTime() - spanMs);
    return { start: priorStart, end: priorEnd };
  }
  return null;
}

function leadInDateRange(lead, start, end) {
  const t = lead.lastActivity ? new Date(lead.lastActivity) : (lead.translog?.[0] ? new Date(`${lead.translog[0].time}, 2026`) : null);
  if (!t) return false;
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  if (s && t < s) return false;
  if (e && t > new Date(e.getTime() + 86400000 - 1)) return false;
  return true;
}

// BM selectors — accept leads as first param (from useData().leads)
export function getLeadsForBranch(leads, branch) {
  return (leads ?? []).filter((l) => l.branch === branch);
}

export function getUnresolvedLeads(leads) {
  return (leads ?? []).filter((l) => !l.enrichmentComplete && !l.archived);
}

export function getAllLeads(leads) {
  return leads ?? [];
}

// GM selectors
export function getCancelledLeads(leads) {
  return (leads ?? []).filter((l) => l.status === "Cancelled" && !l.archived);
}

export function getUnusedLeads(leads) {
  return (leads ?? []).filter((l) => l.status === "Unused");
}

export function getUntouchedLeads(leads) {
  return (leads ?? []).filter((l) => l.status === "Unused" && !l.enrichmentComplete);
}

export function getUntouchedLeadsForBranch(leads, branch) {
  return (leads ?? []).filter((l) => l.status === "Unused" && !l.enrichmentComplete && l.branch === branch);
}

export function getMismatchLeads(leads) {
  return (leads ?? []).filter((l) => l.mismatch);
}

/** Returns a human-readable reason why a lead was flagged for data mismatch. Uses stored reason if present, otherwise derives from lead data. */
export function getMismatchReason(lead) {
  if (!lead?.mismatch) return null;
  if (lead.mismatchReason) return lead.mismatchReason;
  const hasContactEvents = (lead.translog?.length ?? 0) > 0;
  const hlesReason = lead.hlesReason || "Unknown";
  if (!hasContactEvents) {
    return `HLES states "${hlesReason}" but no contact attempts were recorded in the activity trail. Was this lead ever actually worked?`;
  }
  return `The stated reason ("${hlesReason}") doesn't match the recorded activity. Review the activity trail and BM comments for details.`;
}

export function getLeadById(leads, id) {
  return (leads ?? []).find((l) => l.id === id);
}

// Branch selectors
export function getBranches(leads) {
  return [...new Set((leads ?? []).map((l) => l.branch))];
}

export function getBranchManagers() {
  return branchManagers;
}

// Summary stats (optional date range: { start, end })
export function getBMStats(leads, dateRange = null, branch = null) {
  let filtered = leads ?? [];
  if (branch) filtered = filtered.filter((l) => l.branch === branch);
  if (dateRange?.start || dateRange?.end) {
    filtered = filtered.filter((l) => leadInDateRange(l, dateRange.start, dateRange.end));
  }
  const total = filtered.length;
  const enriched = filtered.filter((l) => l.enrichmentComplete).length;
  const cancelled = filtered.filter((l) => l.status === "Cancelled").length;
  const unused = filtered.filter((l) => l.status === "Unused").length;
  const rented = filtered.filter((l) => l.status === "Rented").length;
  return { total, enriched, cancelled, unused, rented, enrichmentRate: total ? Math.round((enriched / total) * 100) : 0 };
}

export function getGMStats(leads) {
  const list = leads ?? [];
  const cancelledUnreviewed = list.filter((l) => l.status === "Cancelled" && !l.archived && !l.gmDirective).length;
  const unusedOverdue = list.filter((l) => l.status === "Unused" && l.daysOpen > 5).length;
  const enriched = list.filter((l) => l.enrichmentComplete).length;
  const total = list.length;
  return {
    cancelledUnreviewed,
    unusedOverdue,
    enrichmentCompliance: total ? Math.round((enriched / total) * 100) : 0,
  };
}

// Trend selectors — always returns last 4 weeks for "4-Week Trend" charts
export function getBMTrends(dateRange = null) {
  const allWeeks = weeklyTrends.bm;
  // Always show last 4 weeks for the trend visualizations
  const weeks = allWeeks.slice(-4);
  const labels = weeks.map((w) => w.weekLabel);
  return {
    labels,
    leadVolume: weeks.map((w) => w.totalLeads),
    conversionRate: weeks.map((w) => w.conversionRate),
    commentRate: weeks.map((w) => w.commentRate),
  };
}

export function getGMTrends() {
  const weeks = weeklyTrends.gm;
  const labels = weeks.map((w) => w.weekLabel);
  return {
    labels,
    cancelledUnreviewed: weeks.map((w) => w.cancelledUnreviewed),
    commentCompliance: weeks.map((w) => w.commentCompliance),
    zoneConversionRate: weeks.map((w) => w.zoneConversionRate),
  };
}

// Time to Contact stats (GM) — maps under24h/under48h/over48h to 30m/1h/3h buckets for display
export function getTimeToContactStats() {
  const latest = weeklyTrends.gm[weeklyTrends.gm.length - 1];
  const t = latest.timeToContact || {};
  return {
    within30m: t.within30m ?? 50,
    within1h: t.within1h ?? 25,
    within3h: t.within3h ?? 15,
    over3h: t.over3h ?? 10,
  };
}

// Contact source stats (GM)
export function getContactSourceStats() {
  const latest = weeklyTrends.gm[weeklyTrends.gm.length - 1];
  return { branchContactRate: latest.branchContactRate, hrdContactRate: latest.hrdContactRate };
}

// Org hierarchy lookup by branch
export function getHierarchyForBranch(branch) {
  return orgMapping.find((r) => r.branch === branch) || null;
}

// Default branch for BM demo when user profile has no branch (e.g. before seed)
export function getDefaultBranchForDemo() {
  return orgMapping[0]?.branch ?? "Santa Monica";
}

// Insurance companies for filter
export function getInsuranceCompanies(leads) {
  return [...new Set((leads ?? []).map((l) => l.insuranceCompany).filter(Boolean))].sort();
}

// Tasks for branch (BM view)
export function getTasksForBranch(branch) {
  return tasks.filter((t) => t.assignedBranch === branch);
}

/** Count of open tasks (status !== Done) for a branch */
export function getOpenTasksCount(tasksList) {
  return (tasksList ?? []).filter((t) => t.status !== "Done").length;
}

/** Task completion rate: (Done tasks / total tasks) * 100 for a branch */
export function getTaskCompletionRate(tasksList) {
  const list = tasksList ?? [];
  if (list.length === 0) return null;
  const done = list.filter((t) => t.status === "Done").length;
  return Math.round((done / list.length) * 100);
}

/** Filter tasks by createdAt within date range */
export function tasksInDateRange(tasksList, dateRange) {
  if (!tasksList?.length || !dateRange?.start || !dateRange?.end) return [];
  const startMs = dateRange.start.getTime();
  const endMs = dateRange.end.getTime() + 86400000 - 1; // end of day
  return tasksList.filter((t) => {
    const created = t.createdAt ? new Date(t.createdAt).getTime() : 0;
    return created >= startMs && created <= endMs;
  });
}

/** Parse time string like "2h 15m", "45m", "5d 2h" to minutes. Returns null if unparseable. */
function parseTimeToMinutes(str) {
  if (!str || typeof str !== "string") return null;
  const s = str.trim();
  if (!s || s === "—") return null;
  let total = 0;
  const d = s.match(/(\d+)\s*d/);
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  if (d) total += Number(d[1]) * 24 * 60;
  if (h) total += Number(h[1]) * 60;
  if (m) total += Number(m[1]);
  return total > 0 ? total : null;
}

/** Format minutes to display string (e.g. "1h 45m", "2.3d") */
function formatMinutesToDisplay(min) {
  if (min == null || min < 0) return "—";
  if (min < 60) return `${Math.round(min)}m`;
  if (min < 24 * 60) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(min / (24 * 60));
  const remainder = min % (24 * 60);
  const h = Math.round(remainder / 60);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

/** Average days open for leads (filtered by date range and branch) */
export function getAverageDaysOpen(leads, dateRange = null, branch = null) {
  let filtered = leads ?? [];
  if (branch) filtered = filtered.filter((l) => l.branch === branch);
  if (dateRange?.start || dateRange?.end) {
    filtered = filtered.filter((l) => leadInDateRange(l, dateRange.start, dateRange.end));
  }
  const withDays = filtered.filter((l) => (l.daysOpen ?? 0) >= 0);
  if (withDays.length === 0) return null;
  const sum = withDays.reduce((s, l) => s + (l.daysOpen ?? 0), 0);
  return Math.round((sum / withDays.length) * 10) / 10;
}

/** Average time to first contact for leads (filtered by date range and branch). Returns formatted string. */
export function getAverageTimeToContact(leads, dateRange = null, branch = null) {
  const avgMin = getAverageTimeToContactMinutes(leads, dateRange, branch);
  return avgMin != null ? formatMinutesToDisplay(avgMin) : null;
}

/** Average time to first contact in minutes (for relChange calculation) */
export function getAverageTimeToContactMinutes(leads, dateRange = null, branch = null) {
  let filtered = leads ?? [];
  if (branch) filtered = filtered.filter((l) => l.branch === branch);
  if (dateRange?.start || dateRange?.end) {
    filtered = filtered.filter((l) => leadInDateRange(l, dateRange.start, dateRange.end));
  }
  const minutes = filtered
    .map((l) => parseTimeToMinutes(l.timeToFirstContact))
    .filter((m) => m != null);
  if (minutes.length === 0) return null;
  return minutes.reduce((s, m) => s + m, 0) / minutes.length;
}

// Task by id (for task detail view)
export function getTaskById(taskId) {
  return tasks.find((t) => t.id === taskId) ?? null;
}

// Tasks for a specific lead (pass tasksList for override, else uses mock tasks)
export function getTasksForLead(leadId, tasksList) {
  const list = tasksList ?? tasks;
  return list.filter((t) => t.leadId === leadId);
}

// Chart data — groups dailyTrends into day/week/month buckets
function chartGranularity(presetKey, dateRange) {
  if (presetKey === "this_week") return "day";
  if (presetKey === "this_month") return "week";
  if (presetKey === "this_year") return "month";
  if (dateRange?.start && dateRange?.end) {
    const span = (dateRange.end - dateRange.start) / 86400000;
    if (span <= 14) return "day";
    if (span <= 90) return "week";
    return "month";
  }
  return "day";
}

function aggregateBucket(items) {
  const totalLeads = items.reduce((s, d) => s + d.totalLeads, 0);
  const rented = items.reduce((s, d) => s + d.rented, 0);
  const enriched = items.reduce((s, d) => s + d.enriched, 0);
  return {
    totalLeads,
    rented,
    enriched,
    conversionRate: totalLeads ? Math.round((rented / totalLeads) * 100) : 0,
    commentRate: totalLeads ? Math.round((enriched / totalLeads) * 100) : 0,
  };
}

function groupByWeekBuckets(data) {
  const weeks = new Map();
  for (const d of data) {
    const dt = new Date(d.date + "T00:00:00");
    const mon = getMonday(dt);
    const key = mon.toISOString().split("T")[0];
    if (!weeks.has(key)) weeks.set(key, { items: [], start: mon });
    weeks.get(key).items.push(d);
  }
  return [...weeks.values()].map((w) => ({
    label: w.start.toLocaleDateString("en-AU", { month: "short", day: "numeric" }),
    ...aggregateBucket(w.items),
  }));
}

function groupByMonthBuckets(data) {
  const months = new Map();
  for (const d of data) {
    const dt = new Date(d.date + "T00:00:00");
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    if (!months.has(key)) months.set(key, { items: [], year: dt.getFullYear(), month: dt.getMonth() });
    months.get(key).items.push(d);
  }
  return [...months.values()].map((m) => ({
    label: new Date(m.year, m.month, 1).toLocaleDateString("en-AU", { month: "short", year: "2-digit" }),
    ...aggregateBucket(m.items),
  }));
}

export function getChartData(presetKey, dateRange) {
  let filtered = dailyTrends;
  if (dateRange?.start) {
    const s = dateRange.start.toISOString().split("T")[0];
    filtered = filtered.filter((d) => d.date >= s);
  }
  if (dateRange?.end) {
    const e = dateRange.end.toISOString().split("T")[0];
    filtered = filtered.filter((d) => d.date <= e);
  }
  if (filtered.length === 0) return [];

  const gran = chartGranularity(presetKey, dateRange);

  if (gran === "day") {
    const isWeekPreset = presetKey === "this_week";
    return filtered.map((d) => {
      const dt = new Date(d.date + "T00:00:00");
      const label = isWeekPreset
        ? dt.toLocaleDateString("en-AU", { weekday: "short" })
        : dt.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
      return { label, ...aggregateBucket([d]) };
    });
  }

  if (gran === "week") return groupByWeekBuckets(filtered);
  return groupByMonthBuckets(filtered);
}
