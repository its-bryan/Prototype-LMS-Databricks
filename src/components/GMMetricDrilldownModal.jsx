import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDateRange } from "../utils/dateTime";

const GM_METRIC_CONFIG = {
  conversion_rate: {
    label: "Conversion Rate",
    description: "Percentage of leads that converted to a rental",
    format: (v) => (v != null ? `${v}%` : "—"),
    suffix: "%",
    branchKey: "conversionRate",
    prevBranchKey: "prevConversionRate",
    deltaKey: "improvementDelta",
    isRate: true,
  },
  contacted_within_30_min: {
    label: "Contacted within 30 min",
    description: "Percentage of leads with first contact within 30 minutes",
    format: (v) => (v != null ? `${v}%` : "—"),
    suffix: "%",
    branchKey: "pctWithin30",
    prevBranchKey: "prevPctWithin30",
    deltaKey: "deltaPctWithin30",
    isRate: true,
  },
  comment_rate: {
    label: "Comment Compliance",
    description: "Percentage of actionable leads with enrichment/comments",
    format: (v) => (v != null ? `${v}%` : "—"),
    suffix: "%",
    branchKey: "commentRate",
    prevBranchKey: "prevCommentRate",
    deltaKey: "deltaCommentRate",
    isRate: true,
  },
  branch_vs_hrd_split: {
    label: "Branch Contact %",
    description: "Percentage of first contacts made by Branch (vs. HRD)",
    format: (v) => (v != null ? `${v}%` : "—"),
    suffix: "%",
    branchKey: "branchHrdPct",
    prevBranchKey: "prevBranchHrdPct",
    deltaKey: "deltaBranchHrdPct",
    isRate: true,
  },
  cancelled_unreviewed: {
    label: "Cancelled Unreviewed",
    description: "Cancelled leads not yet archived or with GM directive",
    format: (v) => `${v ?? 0}`,
    suffix: "",
    branchKey: "cancelledUnreviewed",
    prevBranchKey: "prevCancelledUnreviewed",
    isRate: false,
    lowerIsBetter: true,
  },
  unused_overdue: {
    label: "Unused Overdue",
    description: "Unused leads open more than 5 days",
    format: (v) => `${v ?? 0}`,
    suffix: "",
    branchKey: "unusedOverdue",
    prevBranchKey: "prevUnusedOverdue",
    isRate: false,
    lowerIsBetter: true,
  },
  no_contact_attempt: {
    label: "No Contact Attempt",
    description: "Leads with no contact attempt recorded",
    format: (v) => `${v ?? 0}`,
    suffix: "",
    branchKey: "noContact",
    prevBranchKey: "prevNoContact",
    isRate: false,
    lowerIsBetter: true,
  },
};

function TrendChart({ data, config, selectedIndex, onPointClick, dateRange }) {
  const { weekLabels, series, rows } = data;
  const values = series?.[0]?.values ?? [];

  const xAxisLabels = (rows ?? []).map((r) => {
    if (r.weekStart && r.weekEnd) {
      // Each trendline point represents cumulative T4W through this week:
      // period start = this week's start minus 21 days (4 weeks back from weekEnd).
      const t4wPeriodStart = shiftIso(r.weekStart, -21);
      return `${fmtIso(t4wPeriodStart)} - ${fmtIso(r.weekEnd)}`;
    }
    const refDate = dateRange?.end ?? dateRange?.start ?? new Date();
    const refYear = refDate instanceof Date ? refDate.getFullYear() : new Date(refDate).getFullYear();
    const refMonth = refDate instanceof Date ? refDate.getMonth() : new Date(refDate).getMonth();
    return formatWeekDateRange(r, refYear, refMonth) ?? r.label;
  });

  if (!weekLabels?.length || values.every((v) => v == null)) {
    return (
      <div className="flex items-center justify-center h-[120px] text-[11px] text-[var(--neutral-500)]">
        No trend data available
      </div>
    );
  }

  const numericValues = values.filter((v) => v != null);
  const isCount = !config.isRate;
  const rawMax = Math.max(...numericValues, 0);
  const rawMin = Math.min(...numericValues, 0);

  const dataSpread = rawMax - rawMin;
  let yMin, yMax;
  if (isCount) {
    yMin = Math.max(rawMin - 1, 0);
    yMax = rawMax + Math.max(1, Math.ceil(dataSpread * 0.15));
  } else {
    const pad = Math.max(5, Math.ceil(dataSpread * 0.2));
    yMin = Math.max(Math.floor((rawMin - pad) / 5) * 5, 0);
    yMax = Math.min(Math.ceil((rawMax + pad) / 5) * 5, 100);
  }
  const range = yMax - yMin || 1;

  const W = 590;
  const H = 170;
  const PAD = { top: 18, right: 14, bottom: 34, left: 46 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const n = weekLabels.length;

  const xStep = n > 1 ? plotW / (n - 1) : 0;
  const points = values.map((v, i) => {
    if (v == null) return null;
    const x = PAD.left + i * xStep;
    const y = PAD.top + plotH - ((v - yMin) / range) * plotH;
    return { x, y, v };
  });

  const validPoints = points.filter(Boolean);
  const pathD = validPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const tickCount = isCount ? Math.min(5, yMax - yMin + 1) : 5;
  const yTicks = Array.from({ length: tickCount }, (_, i) => {
    const raw = yMin + (i * range) / (tickCount - 1);
    return isCount ? Math.round(raw) : Math.round(raw / 5) * 5;
  });
  const uniqueTicks = [...new Set(yTicks)];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: "180px" }}>
      {uniqueTicks.map((tick) => {
        const y = PAD.top + plotH - ((tick - yMin) / range) * plotH;
        return (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="var(--neutral-100)" strokeWidth={0.5} />
            <text x={PAD.left - 16} y={y + 3} textAnchor="end" className="fill-[var(--neutral-400)]" fontSize={9}>
              {tick}{config.suffix}
            </text>
          </g>
        );
      })}
      {xAxisLabels.map((label, i) => {
        const isSelected = i === selectedIndex;
        const x = PAD.left + i * xStep;
        return (
          <text
            key={i}
            x={x}
            y={H - 8}
            textAnchor="middle"
            fontSize={9}
            fontWeight={isSelected ? 700 : 500}
            className={isSelected ? "fill-[var(--hertz-black)]" : "fill-[var(--neutral-500)]"}
            style={{ cursor: onPointClick ? "pointer" : "default" }}
            onClick={() => onPointClick?.(i)}
          >
            {label}
          </text>
        );
      })}
      {validPoints.length > 1 && (
        <path d={pathD} fill="none" stroke="var(--hertz-primary)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {points.map((p, i) => {
        if (!p) return null;
        const isSelected = i === selectedIndex;
        return (
          <g key={i} onClick={() => onPointClick?.(i)} style={{ cursor: onPointClick ? "pointer" : "default" }}>
            <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
            {isSelected && (
              <circle cx={p.x} cy={p.y} r={8} fill="none" stroke="var(--hertz-primary)" strokeWidth={1.5} opacity={0.25} />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={isSelected ? 5.5 : 3.5}
              fill={isSelected ? "white" : "var(--hertz-primary)"}
              stroke="var(--hertz-primary)"
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            <text
              x={p.x}
              y={p.y - 12}
              textAnchor="middle"
              fontSize={10}
              fontWeight={isSelected ? 700 : 500}
              className={isSelected ? "fill-[var(--hertz-black)]" : "fill-[var(--neutral-600)]"}
            >
              {config.format(p.v)}
              {isSelected && (
                <animate
                  attributeName="opacity"
                  values="1;0.35;1"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
              )}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const STATUS_COLOR = {
  Rented: "text-[#2E7D32]",
  Cancelled: "text-[#B45309]",
  Unused: "text-[var(--neutral-500)]",
  Reviewed: "text-[var(--neutral-400)]",
};

const GM_INITIAL_ROWS = 5;

function BranchLeadsPanel({ branch, gmName, startDate, endDate, periodLabel, onClose }) {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(GM_INITIAL_ROWS);

  const fetchLeads = useCallback(async (fetchLimit) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        paged: "1",
        limit: String(fetchLimit),
        offset: "0",
      });
      if (branch) params.set("branch", branch);
      else if (gmName) params.set("gm_name", gmName);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      // Inherit auth token from cookie/header via same origin
      const res = await fetch(`/api/leads?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      setLeads(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setLeads([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [branch, gmName, startDate, endDate]);

  useEffect(() => { fetchLeads(limit); }, [fetchLeads, limit]);

  const hasMore = total != null && leads.length < total;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel header */}
        <div className="px-5 py-4 border-b border-[var(--neutral-200)] flex items-center justify-between shrink-0">
          <div>
            <p className="text-sm font-bold text-[var(--hertz-black)]">{branch ?? "All Branches"}</p>
            {periodLabel && <p className="text-xs text-[var(--neutral-500)] mt-0.5">{periodLabel}</p>}
            {total != null && (
              <p className="text-[10px] text-[var(--neutral-400)] mt-0.5">{total} lead{total !== 1 ? "s" : ""}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--neutral-100)] text-[var(--neutral-600)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Lead table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[11px] text-[var(--neutral-500)]">Loading…</div>
          ) : leads.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[11px] text-[var(--neutral-500)]">No leads for this period</div>
          ) : (
            <table className="w-full text-[11px] border-collapse">
              <thead className="sticky top-0 bg-white border-b border-[var(--neutral-200)]">
                <tr>
                  <th className="text-left font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-2 px-3">Customer</th>
                  <th className="text-left font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-2 px-3">Confirm #</th>
                  <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-2 px-3">Date</th>
                  <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-2 px-3">Status</th>
                  <th className="text-left font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-2 px-3">Contact</th>
                  <th className="text-left font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-2 px-3">Comment</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const enrichment = typeof lead.enrichment === "string"
                    ? (() => { try { return JSON.parse(lead.enrichment); } catch { return {}; } })()
                    : (lead.enrichment ?? {});
                  const comment = enrichment?.reason || enrichment?.notes || "";
                  return (
                    <tr key={lead.id} className="border-b border-[var(--neutral-100)] hover:bg-[var(--neutral-50)]">
                      <td className="py-1.5 px-3 font-medium text-[var(--hertz-black)] max-w-[120px] truncate">{lead.customer ?? "—"}</td>
                      <td className="py-1.5 px-3 text-[var(--neutral-600)]">{lead.confirm_num ?? lead.confirmNum ?? "—"}</td>
                      <td className="py-1.5 px-3 text-center text-[var(--neutral-600)]">
                        {(lead.init_dt_final ?? lead.week_of ?? "").slice(0, 10) || "—"}
                      </td>
                      <td className={`py-1.5 px-3 text-center font-semibold ${STATUS_COLOR[lead.status] ?? "text-[var(--neutral-600)]"}`}>
                        {lead.status ?? "—"}
                      </td>
                      <td className="py-1.5 px-3 text-[var(--neutral-600)]">
                        {lead.contact_range ?? lead.contactRange ?? "—"}
                      </td>
                      <td className="py-1.5 px-3 text-[var(--neutral-500)] max-w-[160px] truncate" title={comment}>
                        {comment || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* View more */}
        {(hasMore || loading) && (
          <div className="px-5 py-2 border-t border-[var(--neutral-200)] flex items-center justify-between shrink-0">
            <span className="text-[10px] text-[var(--neutral-500)]">
              Showing {leads.length} of {total ?? "…"}
            </span>
            {hasMore && (
              <button
                disabled={loading}
                onClick={() => setLimit(total ?? 9999)}
                className="text-xs text-[var(--hertz-primary)] disabled:text-[var(--neutral-300)] font-medium hover:underline"
              >
                {loading ? "Loading…" : `View all ${total} rows`}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function BranchBar({ row, maxVal, config, benchmark, rank, onClick }) {
  const val = row[config.branchKey];
  const prevVal = row[config.prevBranchKey];
  // Prefer pre-computed exact delta from snapshot to avoid rounding-of-rounded errors.
  // Fall back to val - prevVal only when no pre-computed delta is available (count metrics).
  const rawDelta = config.deltaKey != null && row[config.deltaKey] != null
    ? row[config.deltaKey]
    : (val != null && prevVal != null) ? val - prevVal : null;
  // Rate metrics: display as absolute pp change. Count metrics: display as relative % change.
  const delta = (!config.isRate && rawDelta != null && prevVal != null && prevVal !== 0)
    ? Math.round((rawDelta / prevVal) * 100)
    : (!config.isRate && rawDelta != null && prevVal === 0)
      ? (val > 0 ? 100 : 0)
      : rawDelta;
  const displaySuffix = !config.isRate ? "%" : config.suffix;
  const isPositive = config.lowerIsBetter ? (delta != null && delta < 0) : (delta != null && delta > 0);
  const isNegative = config.lowerIsBetter ? (delta != null && delta > 0) : (delta != null && delta < 0);
  const barWidth = val != null && maxVal > 0 ? Math.max((Math.abs(val) / maxVal) * 100, 2) : 0;

  return (
    <div
      className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-[var(--neutral-50)] transition-colors group cursor-pointer"
      onClick={onClick}
    >
      <span className="text-[10px] font-semibold text-[var(--hertz-black)] w-5 text-right shrink-0">{rank}</span>
      <span className="text-[11px] font-medium text-[var(--hertz-black)] w-[130px] truncate shrink-0" title={row.branch}>{row.branch}</span>
      <div className="flex-1 h-5 bg-[var(--neutral-100)] rounded-sm relative overflow-hidden">
        <div
          className="h-full rounded-sm transition-all duration-500"
          style={{ width: `${barWidth}%`, backgroundColor: "var(--hertz-primary)" }}
        />
        {benchmark != null && maxVal > 0 && (
          <div
            className="absolute top-0 h-full border-r-2 border-[var(--hertz-black)]"
            style={{ left: `${(benchmark / maxVal) * 100}%` }}
            title={`Zone avg: ${config.format(benchmark)}`}
          />
        )}
      </div>
      <span className="text-[11px] font-bold text-[var(--hertz-black)] w-[50px] text-center shrink-0">{config.format(val)}</span>
      <span className={`text-[10px] font-semibold w-[48px] text-center shrink-0 ${
        delta == null || delta === 0
          ? "text-[var(--neutral-400)]"
          : isPositive ? "text-[#2E7D32]" : isNegative ? "text-[#C62828]" : "text-[var(--neutral-400)]"
      }`}>
        {delta == null ? "—" : delta === 0 ? "—" : `${rawDelta > 0 ? "↑" : "↓"}${Math.abs(delta)}${displaySuffix}`}
      </span>
    </div>
  );
}

function BranchPerformanceSection({ leaderboard, config, sortKey, onSortChange, periodLabel, onBranchClick }) {
  const { sorted, benchmark } = leaderboard;
  const benchmarkVal = benchmark?.[config.branchKey] ?? null;
  const maxVal = Math.max(...sorted.map((r) => Math.abs(r[config.branchKey] ?? 0)), 1);

  const sortOptions = [
    { value: "highToLow", label: "High \u2192 Low" },
    { value: "lowToHigh", label: "Low \u2192 High" },
    { value: "mostImproved", label: "Most Improved" },
    { value: "alpha", label: "A \u2192 Z" },
  ];

  const displayed = useMemo(() => {
    const rows = [...sorted];
    if (sortKey === "highToLow") {
      rows.sort((a, b) => (b[config.branchKey] ?? -1) - (a[config.branchKey] ?? -1));
    } else if (sortKey === "lowToHigh") {
      rows.sort((a, b) => (a[config.branchKey] ?? -1) - (b[config.branchKey] ?? -1));
    } else if (sortKey === "mostImproved") {
      rows.sort((a, b) => {
        // Prefer pre-computed exact delta (avoids rounding-of-rounded errors and missing prevBranchKey
        // on re-aggregated weekly rows). Fall back to branchKey - prevBranchKey.
        const da = config.deltaKey != null && a[config.deltaKey] != null
          ? a[config.deltaKey]
          : (a[config.branchKey] ?? 0) - (a[config.prevBranchKey] ?? 0);
        const db = config.deltaKey != null && b[config.deltaKey] != null
          ? b[config.deltaKey]
          : (b[config.branchKey] ?? 0) - (b[config.prevBranchKey] ?? 0);
        return config.lowerIsBetter ? da - db : db - da;
      });
    } else if (sortKey === "alpha") {
      rows.sort((a, b) => a.branch.localeCompare(b.branch));
    }
    return rows;
  }, [sorted, sortKey, config]);

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <p className="text-xs font-bold text-[var(--hertz-black)] uppercase tracking-wider">By Branch</p>
        {periodLabel && (
          <span className="text-[10px] text-[var(--neutral-500)]">{periodLabel}</span>
        )}
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-[var(--neutral-500)]">Sort:</span>
        <select
          value={sortKey}
          onChange={(e) => onSortChange(e.target.value)}
          className="text-xs border border-[var(--neutral-200)] rounded-md px-2 py-1 text-[var(--neutral-600)] bg-white focus:outline-none focus:border-[var(--hertz-primary)] cursor-pointer"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {displayed.map((row, i) => (
          <BranchBar
            key={row.branch}
            row={row}
            maxVal={maxVal}
            config={config}
            benchmark={benchmarkVal}
            rank={i + 1}
            onClick={() => onBranchClick?.(row.branch)}
          />
        ))}
      </div>
      {benchmarkVal != null && (
        <p className="text-[10px] text-[var(--neutral-500)] mt-1.5 pl-8">
          <span className="inline-block w-3 border-t-2 border-[var(--hertz-black)] mr-1.5 align-middle" />
          Zone average: {config.format(benchmarkVal)}
        </p>
      )}
    </div>
  );
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_INDEX = Object.fromEntries(MONTH_NAMES.map((m, i) => [m, i]));

function fmtIso(iso) {
  const [, m, d] = iso.split("-");
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

function shiftIso(iso, n) {
  const [y, mo, dy] = iso.split("-").map(Number);
  const d = new Date(y, mo - 1, dy + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Parse "Mar 3" label (which is the Monday) into an ISO date string.
// If the month is later in the year than refMonth, assume previous year.
function parseMondayLabelToIso(label, refYear, refMonth) {
  const parts = label.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const mo = MONTH_INDEX[parts[0]];
  const dy = parseInt(parts[1], 10);
  if (mo == null || isNaN(dy)) return null;
  const year = mo > refMonth + 1 ? refYear - 1 : refYear;
  return `${year}-${String(mo + 1).padStart(2, "0")}-${String(dy).padStart(2, "0")}`;
}

// Returns "Sat MMM D -Fri MMM D" for the HLES Sat–Fri week.
// Uses weekStart/weekEnd from the snapshot if available, otherwise derives
// them from the Monday label (weekStart = Monday − 2, weekEnd = Monday + 4).
function formatWeekDateRange(row, refYear, refMonth) {
  if (row.weekStart && row.weekEnd) {
    return `${fmtIso(row.weekStart)} - ${fmtIso(row.weekEnd)}`;
  }
  // Fallback: derive from the Monday label
  if (refYear == null || !row.label) return null;
  const mondayIso = parseMondayLabelToIso(row.label, refYear, refMonth);
  if (!mondayIso) return null;
  return `${fmtIso(shiftIso(mondayIso, -2))} - ${fmtIso(shiftIso(mondayIso, 4))}`;
}

function WeeklyBreakdownTable({ rows, selectedIndex, dateRange, onWeekClick }) {
  const refDate = dateRange?.end ?? dateRange?.start ?? new Date();
  const refYear = refDate instanceof Date ? refDate.getFullYear() : new Date(refDate).getFullYear();
  const refMonth = refDate instanceof Date ? refDate.getMonth() : new Date(refDate).getMonth();

  const totalLeads = rows.reduce((sum, r) => sum + (r.totalLeads ?? 0), 0);
  const totalRented = rows.reduce((sum, r) => sum + (r.rented ?? 0), 0);
  const totalCancelled = rows.reduce((sum, r) => sum + (r.cancelled ?? 0), 0);
  const totalUnused = rows.reduce((sum, r) => sum + (r.unused ?? 0), 0);
  const totalRate = totalLeads > 0 ? Math.round((totalRented / totalLeads) * 100) : 0;

  return (
    <div className="mt-4 overflow-x-auto">
      <p className="text-xs font-bold text-[var(--hertz-black)] uppercase tracking-wider mb-0.5">Weekly Breakdown</p>
      <p className="text-[10px] text-[var(--neutral-500)] mb-2">See the below data to understand how each T4W period was calculated.</p>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--neutral-200)]">
            <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Week</th>
            <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Total</th>
            <th className="text-center font-semibold text-[#2E7D32] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Rented</th>
            <th className="text-center font-semibold text-[#B45309] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Cancelled</th>
            <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Unused</th>
            <th className="text-center font-semibold text-[var(--hertz-black)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isSelected = i === selectedIndex;
            return (
              <tr
                key={i}
                className={`border-b border-[var(--neutral-100)] ${onWeekClick ? "cursor-pointer hover:bg-[var(--neutral-50)]" : ""}`}
                onClick={() => onWeekClick?.(row)}
              >
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold text-[var(--hertz-black)]" : "text-[var(--neutral-700)]"}`}>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="whitespace-nowrap">
                      {formatWeekDateRange(row, refYear, refMonth) ?? row.label}
                    </span>
                  </div>
                </td>
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold text-[var(--hertz-black)]" : "text-[var(--neutral-700)]"}`}>{row.totalLeads ?? 0}</td>
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold" : ""} text-[#2E7D32]`}>{row.rented ?? 0}</td>
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold" : ""} text-[#B45309]`}>{row.cancelled ?? 0}</td>
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold" : ""} text-[var(--neutral-500)]`}>{row.unused ?? 0}</td>
                <td className="py-1.5 px-3 text-center font-bold text-[var(--hertz-black)]">
                  {row.conversionRate != null ? `${row.conversionRate}%` : "—"}
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-[var(--neutral-300)] bg-[var(--neutral-50)]">
            <td className="py-1.5 px-3 text-center font-semibold text-[var(--neutral-700)] whitespace-nowrap">T4W Total</td>
            <td className="py-1.5 px-3 text-center font-semibold text-[var(--neutral-700)]">{totalLeads}</td>
            <td className="py-1.5 px-3 text-center font-semibold text-[#2E7D32]">{totalRented}</td>
            <td className="py-1.5 px-3 text-center font-semibold text-[#B45309]">{totalCancelled}</td>
            <td className="py-1.5 px-3 text-center font-semibold text-[var(--neutral-500)]">{totalUnused}</td>
            <td className="py-1.5 px-3 text-center font-bold text-[var(--hertz-black)]">{totalRate}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CommentRateBreakdownTable({ rows, selectedIndex, dateRange, onWeekClick }) {
  const refDate = dateRange?.end ?? dateRange?.start ?? new Date();
  const refYear = refDate instanceof Date ? refDate.getFullYear() : new Date(refDate).getFullYear();
  const refMonth = refDate instanceof Date ? refDate.getMonth() : new Date(refDate).getMonth();

  const totalLeads = rows.reduce((sum, r) => sum + (r.totalLeads ?? 0), 0);
  const totalEnriched = rows.reduce((sum, r) => sum + (r.enriched ?? 0), 0);
  const totalRate = totalLeads > 0 ? Math.round((totalEnriched / totalLeads) * 100) : 0;

  return (
    <div className="mt-4 overflow-x-auto">
      <p className="text-xs font-bold text-[var(--hertz-black)] uppercase tracking-wider mb-0.5">Weekly Breakdown</p>
      <p className="text-[10px] text-[var(--neutral-500)] mb-2">See the below data to understand how each T4W period was calculated.</p>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--neutral-200)]">
            <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Week</th>
            <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Total</th>
            <th className="text-center font-semibold text-[#2E7D32] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Commented</th>
            <th className="text-center font-semibold text-[var(--hertz-black)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isSelected = i === selectedIndex;
            const weekRate = (row.totalLeads ?? 0) > 0
              ? Math.round(((row.enriched ?? 0) / row.totalLeads) * 100)
              : null;
            return (
              <tr
                key={i}
                className={`border-b border-[var(--neutral-100)] ${onWeekClick ? "cursor-pointer hover:bg-[var(--neutral-50)]" : ""}`}
                onClick={() => onWeekClick?.(row)}
              >
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold text-[var(--hertz-black)]" : "text-[var(--neutral-700)]"}`}>
                  <span className="whitespace-nowrap">
                    {formatWeekDateRange(row, refYear, refMonth) ?? row.label}
                  </span>
                </td>
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold text-[var(--hertz-black)]" : "text-[var(--neutral-700)]"}`}>{row.totalLeads ?? 0}</td>
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold" : ""} text-[#2E7D32]`}>{row.enriched ?? 0}</td>
                <td className="py-1.5 px-3 text-center font-bold text-[var(--hertz-black)]">
                  {weekRate != null ? `${weekRate}%` : "—"}
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-[var(--neutral-300)] bg-[var(--neutral-50)]">
            <td className="py-1.5 px-3 text-center font-semibold text-[var(--neutral-700)] whitespace-nowrap">T4W Total</td>
            <td className="py-1.5 px-3 text-center font-semibold text-[var(--neutral-700)]">{totalLeads}</td>
            <td className="py-1.5 px-3 text-center font-semibold text-[#2E7D32]">{totalEnriched}</td>
            <td className="py-1.5 px-3 text-center font-bold text-[var(--hertz-black)]">{totalRate}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function NoContactBreakdownTable({ rows, selectedIndex, dateRange, onWeekClick }) {
  const refDate = dateRange?.end ?? dateRange?.start ?? new Date();
  const refYear = refDate instanceof Date ? refDate.getFullYear() : new Date(refDate).getFullYear();
  const refMonth = refDate instanceof Date ? refDate.getMonth() : new Date(refDate).getMonth();

  const totalNoContact = rows.reduce((sum, r) => sum + (r.noContact ?? 0), 0);
  const totalLeads = rows.reduce((sum, r) => sum + (r.totalLeads ?? 0), 0);

  return (
    <div className="mt-4 overflow-x-auto">
      <p className="text-xs font-bold text-[var(--hertz-black)] uppercase tracking-wider mb-0.5">Weekly Breakdown</p>
      <p className="text-[10px] text-[var(--neutral-500)] mb-2">See the below data to understand how each T4W period was calculated.</p>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--neutral-200)]">
            <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Week</th>
            <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Total Leads</th>
            <th className="text-center font-semibold text-[#B45309] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">No Contact</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isSelected = i === selectedIndex;
            return (
              <tr
                key={i}
                className={`border-b border-[var(--neutral-100)] ${onWeekClick ? "cursor-pointer hover:bg-[var(--neutral-50)]" : ""}`}
                onClick={() => onWeekClick?.(row)}
              >
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold text-[var(--hertz-black)]" : "text-[var(--neutral-700)]"}`}>
                  <span className="whitespace-nowrap">
                    {formatWeekDateRange(row, refYear, refMonth) ?? row.label}
                  </span>
                </td>
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold text-[var(--hertz-black)]" : "text-[var(--neutral-700)]"}`}>{row.totalLeads ?? 0}</td>
                <td className={`py-1.5 px-3 text-center font-bold ${isSelected ? "font-semibold" : ""} text-[#B45309]`}>{row.noContact ?? 0}</td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-[var(--neutral-300)] bg-[var(--neutral-50)]">
            <td className="py-1.5 px-3 text-center font-semibold text-[var(--neutral-700)] whitespace-nowrap">T4W Total</td>
            <td className="py-1.5 px-3 text-center font-semibold text-[var(--neutral-700)]">{totalLeads}</td>
            <td className="py-1.5 px-3 text-center font-bold text-[#B45309]">{totalNoContact}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ContactedWithin30BreakdownTable({ rows, selectedIndex, dateRange, onWeekClick }) {
  const refDate = dateRange?.end ?? dateRange?.start ?? new Date();
  const refYear = refDate instanceof Date ? refDate.getFullYear() : new Date(refDate).getFullYear();
  const refMonth = refDate instanceof Date ? refDate.getMonth() : new Date(refDate).getMonth();

  const totalWithin30 = rows.reduce((sum, r) => sum + (r.within30 ?? 0), 0);
  const totalDen = rows.reduce((sum, r) => sum + (r.w30Den ?? r.totalLeads ?? 0), 0);
  const totalRate = totalDen > 0 ? Math.round((totalWithin30 / totalDen) * 100) : 0;

  return (
    <div className="mt-4 overflow-x-auto">
      <p className="text-xs font-bold text-[var(--hertz-black)] uppercase tracking-wider mb-0.5">Weekly Breakdown</p>
      <p className="text-[10px] text-[var(--neutral-500)] mb-2">See the below data to understand how each T4W period was calculated.</p>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--neutral-200)]">
            <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Week</th>
            <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Total</th>
            <th className="text-center font-semibold text-[#2E7D32] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Within 30 min</th>
            <th className="text-center font-semibold text-[var(--hertz-black)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isSelected = i === selectedIndex;
            const den = row.w30Den ?? row.totalLeads ?? 0;
            const weekRate = den > 0 ? Math.round(((row.within30 ?? 0) / den) * 100) : null;
            return (
              <tr
                key={i}
                className={`border-b border-[var(--neutral-100)] ${onWeekClick ? "cursor-pointer hover:bg-[var(--neutral-50)]" : ""}`}
                onClick={() => onWeekClick?.(row)}
              >
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold text-[var(--hertz-black)]" : "text-[var(--neutral-700)]"}`}>
                  <span className="whitespace-nowrap">
                    {formatWeekDateRange(row, refYear, refMonth) ?? row.label}
                  </span>
                </td>
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold text-[var(--hertz-black)]" : "text-[var(--neutral-700)]"}`}>{den}</td>
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold" : ""} text-[#2E7D32]`}>{row.within30 ?? 0}</td>
                <td className="py-1.5 px-3 text-center font-bold text-[var(--hertz-black)]">
                  {weekRate != null ? `${weekRate}%` : "—"}
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-[var(--neutral-300)] bg-[var(--neutral-50)]">
            <td className="py-1.5 px-3 text-center font-semibold text-[var(--neutral-700)] whitespace-nowrap">T4W Total</td>
            <td className="py-1.5 px-3 text-center font-semibold text-[var(--neutral-700)]">{totalDen}</td>
            <td className="py-1.5 px-3 text-center font-semibold text-[#2E7D32]">{totalWithin30}</td>
            <td className="py-1.5 px-3 text-center font-bold text-[var(--hertz-black)]">{totalRate}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BranchContactBreakdownTable({ rows, selectedIndex, dateRange, onWeekClick }) {
  const refDate = dateRange?.end ?? dateRange?.start ?? new Date();
  const refYear = refDate instanceof Date ? refDate.getFullYear() : new Date(refDate).getFullYear();
  const refMonth = refDate instanceof Date ? refDate.getMonth() : new Date(refDate).getMonth();

  const totalBranch = rows.reduce((sum, r) => sum + (r.branchContact ?? 0), 0);
  const totalHrd = rows.reduce((sum, r) => sum + (r.hrdContact ?? 0), 0);
  const totalContact = rows.reduce((sum, r) => sum + (r.contactTotal ?? 0), 0);
  const totalRate = totalContact > 0 ? Math.round((totalBranch / totalContact) * 100) : 0;

  return (
    <div className="mt-4 overflow-x-auto">
      <p className="text-xs font-bold text-[var(--hertz-black)] uppercase tracking-wider mb-0.5">Weekly Breakdown</p>
      <p className="text-[10px] text-[var(--neutral-500)] mb-2">See the below data to understand how each T4W period was calculated.</p>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--neutral-200)]">
            <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Week</th>
            <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Total Contacts</th>
            <th className="text-center font-semibold text-[#2E7D32] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Branch</th>
            <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">HRD</th>
            <th className="text-center font-semibold text-[var(--hertz-black)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Branch %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isSelected = i === selectedIndex;
            const contact = row.contactTotal ?? 0;
            const weekRate = contact > 0 ? Math.round(((row.branchContact ?? 0) / contact) * 100) : null;
            return (
              <tr
                key={i}
                className={`border-b border-[var(--neutral-100)] ${onWeekClick ? "cursor-pointer hover:bg-[var(--neutral-50)]" : ""}`}
                onClick={() => onWeekClick?.(row)}
              >
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold text-[var(--hertz-black)]" : "text-[var(--neutral-700)]"}`}>
                  <span className="whitespace-nowrap">
                    {formatWeekDateRange(row, refYear, refMonth) ?? row.label}
                  </span>
                </td>
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold text-[var(--hertz-black)]" : "text-[var(--neutral-700)]"}`}>{contact}</td>
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold" : ""} text-[#2E7D32]`}>{row.branchContact ?? 0}</td>
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold" : ""} text-[var(--neutral-500)]`}>{row.hrdContact ?? 0}</td>
                <td className="py-1.5 px-3 text-center font-bold text-[var(--hertz-black)]">
                  {weekRate != null ? `${weekRate}%` : "—"}
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-[var(--neutral-300)] bg-[var(--neutral-50)]">
            <td className="py-1.5 px-3 text-center font-semibold text-[var(--neutral-700)] whitespace-nowrap">T4W Total</td>
            <td className="py-1.5 px-3 text-center font-semibold text-[var(--neutral-700)]">{totalContact}</td>
            <td className="py-1.5 px-3 text-center font-semibold text-[#2E7D32]">{totalBranch}</td>
            <td className="py-1.5 px-3 text-center font-semibold text-[var(--neutral-500)]">{totalHrd}</td>
            <td className="py-1.5 px-3 text-center font-bold text-[var(--hertz-black)]">{totalRate}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CancelledUnreviewedBreakdownTable({ rows, selectedIndex, dateRange, onWeekClick }) {
  const refDate = dateRange?.end ?? dateRange?.start ?? new Date();
  const refYear = refDate instanceof Date ? refDate.getFullYear() : new Date(refDate).getFullYear();
  const refMonth = refDate instanceof Date ? refDate.getMonth() : new Date(refDate).getMonth();

  const totalCancelledUnreviewed = rows.reduce((sum, r) => sum + (r.cancelledUnreviewed ?? 0), 0);
  const totalLeads = rows.reduce((sum, r) => sum + (r.totalLeads ?? 0), 0);

  return (
    <div className="mt-4 overflow-x-auto">
      <p className="text-xs font-bold text-[var(--hertz-black)] uppercase tracking-wider mb-0.5">Weekly Breakdown</p>
      <p className="text-[10px] text-[var(--neutral-500)] mb-2">See the below data to understand how each T4W period was calculated.</p>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--neutral-200)]">
            <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Week</th>
            <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Total Leads</th>
            <th className="text-center font-semibold text-[#B45309] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Cancelled Unreviewed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isSelected = i === selectedIndex;
            return (
              <tr
                key={i}
                className={`border-b border-[var(--neutral-100)] ${onWeekClick ? "cursor-pointer hover:bg-[var(--neutral-50)]" : ""}`}
                onClick={() => onWeekClick?.(row)}
              >
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold text-[var(--hertz-black)]" : "text-[var(--neutral-700)]"}`}>
                  <span className="whitespace-nowrap">
                    {formatWeekDateRange(row, refYear, refMonth) ?? row.label}
                  </span>
                </td>
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold text-[var(--hertz-black)]" : "text-[var(--neutral-700)]"}`}>{row.totalLeads ?? 0}</td>
                <td className={`py-1.5 px-3 text-center font-bold ${isSelected ? "font-semibold" : ""} text-[#B45309]`}>{row.cancelledUnreviewed ?? 0}</td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-[var(--neutral-300)] bg-[var(--neutral-50)]">
            <td className="py-1.5 px-3 text-center font-semibold text-[var(--neutral-700)] whitespace-nowrap">T4W Total</td>
            <td className="py-1.5 px-3 text-center font-semibold text-[var(--neutral-700)]">{totalLeads}</td>
            <td className="py-1.5 px-3 text-center font-bold text-[#B45309]">{totalCancelledUnreviewed}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function UnusedOverdueBreakdownTable({ rows, selectedIndex, dateRange, onWeekClick }) {
  const refDate = dateRange?.end ?? dateRange?.start ?? new Date();
  const refYear = refDate instanceof Date ? refDate.getFullYear() : new Date(refDate).getFullYear();
  const refMonth = refDate instanceof Date ? refDate.getMonth() : new Date(refDate).getMonth();

  const totalUnusedOverdue = rows.reduce((sum, r) => sum + (r.unusedOverdue ?? 0), 0);
  const totalLeads = rows.reduce((sum, r) => sum + (r.totalLeads ?? 0), 0);

  return (
    <div className="mt-4 overflow-x-auto">
      <p className="text-xs font-bold text-[var(--hertz-black)] uppercase tracking-wider mb-0.5">Weekly Breakdown</p>
      <p className="text-[10px] text-[var(--neutral-500)] mb-2">See the below data to understand how each T4W period was calculated.</p>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--neutral-200)]">
            <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Week</th>
            <th className="text-center font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Total Leads</th>
            <th className="text-center font-semibold text-[#B45309] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Unused Overdue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isSelected = i === selectedIndex;
            return (
              <tr
                key={i}
                className={`border-b border-[var(--neutral-100)] ${onWeekClick ? "cursor-pointer hover:bg-[var(--neutral-50)]" : ""}`}
                onClick={() => onWeekClick?.(row)}
              >
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold text-[var(--hertz-black)]" : "text-[var(--neutral-700)]"}`}>
                  <span className="whitespace-nowrap">
                    {formatWeekDateRange(row, refYear, refMonth) ?? row.label}
                  </span>
                </td>
                <td className={`py-1.5 px-3 text-center ${isSelected ? "font-semibold text-[var(--hertz-black)]" : "text-[var(--neutral-700)]"}`}>{row.totalLeads ?? 0}</td>
                <td className={`py-1.5 px-3 text-center font-bold ${isSelected ? "font-semibold" : ""} text-[#B45309]`}>{row.unusedOverdue ?? 0}</td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-[var(--neutral-300)] bg-[var(--neutral-50)]">
            <td className="py-1.5 px-3 text-center font-semibold text-[var(--neutral-700)] whitespace-nowrap">T4W Total</td>
            <td className="py-1.5 px-3 text-center font-semibold text-[var(--neutral-700)]">{totalLeads}</td>
            <td className="py-1.5 px-3 text-center font-bold text-[#B45309]">{totalUnusedOverdue}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function GMMetricDrilldownModal({
  metricKey,
  onClose,
  dateRange,
  comparisonRange,
  currentValue,
  previousValue,
  chartData,
  leaderboardRows,
  allLeaderboardRows,
  branchesSnapshot,
  zonesSnapshot,
  gmZone,
  gmName,
}) {
  const config = GM_METRIC_CONFIG[metricKey];
  const [branchSort, setBranchSort] = useState("highToLow");
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(null);
  // { branch, startDate, endDate, periodLabel } — drives the BranchLeadsPanel
  const [branchLeadsContext, setBranchLeadsContext] = useState(null);

  if (!config) return null;

  const relChangeVal = useMemo(() => {
    if (currentValue == null || previousValue == null) return null;
    // Rate metrics: show absolute point-change (pp). Count metrics: show relative % change.
    if (config.isRate) return Math.round(currentValue - previousValue);
    if (previousValue === 0) return currentValue > 0 ? 100 : 0;
    return Math.round(((currentValue - previousValue) / Math.abs(previousValue)) * 100);
  }, [currentValue, previousValue, config.isRate]);

  const isPositive = config.lowerIsBetter
    ? (relChangeVal != null && relChangeVal < 0)
    : (relChangeVal != null && relChangeVal > 0);
  const isNegative = config.lowerIsBetter
    ? (relChangeVal != null && relChangeVal > 0)
    : (relChangeVal != null && relChangeVal < 0);

  const trendData = useMemo(() => {
    const allRows = chartData ?? [];
    // The trendline shows only the last 4 rows (the T4W period).
    // Extra rows at the start are historical context for the breakdown table.
    const rows = allRows.slice(-4);
    const weekLabels = rows.map((r) => r.label);

    // Compute rolling T4W metric at each week: each point = 28-day lookback ending at that week.
    // For point i in `rows` (which are allRows[-4:]), the window is allRows[endIdx-3..endIdx].
    // All rate metrics aggregate raw counts across the window and divide once — never average
    // pre-rounded percentages. Count metrics sum the raw weekly counts directly.
    const t4wWindow = (i) => {
      const endIdx = allRows.length - 4 + i;
      const startIdx = Math.max(0, endIdx - 3);
      return allRows.slice(startIdx, endIdx + 1);
    };

    let t4wValues = Array(rows.length).fill(null);
    if (metricKey === "conversion_rate") {
      t4wValues = rows.map((_, i) => {
        const win = t4wWindow(i);
        const totalRented = win.reduce((s, r) => s + (r.rented ?? 0), 0);
        const totalLeads = win.reduce((s, r) => s + (r.totalLeads ?? 0), 0);
        return totalLeads > 0 ? Math.round((totalRented / totalLeads) * 100) : null;
      });
    } else if (metricKey === "comment_rate") {
      t4wValues = rows.map((_, i) => {
        const win = t4wWindow(i);
        const totalEnriched = win.reduce((s, r) => s + (r.enriched ?? 0), 0);
        const totalLeads = win.reduce((s, r) => s + (r.totalLeads ?? 0), 0);
        return totalLeads > 0 ? Math.round((totalEnriched / totalLeads) * 100) : null;
      });
    } else if (metricKey === "contacted_within_30_min") {
      t4wValues = rows.map((_, i) => {
        const win = t4wWindow(i);
        const totalWithin30 = win.reduce((s, r) => s + (r.within30 ?? 0), 0);
        const totalLeads = win.reduce((s, r) => s + (r.totalLeads ?? 0), 0);
        return totalLeads > 0 ? Math.round((totalWithin30 / totalLeads) * 100) : null;
      });
    } else if (metricKey === "branch_vs_hrd_split") {
      t4wValues = rows.map((_, i) => {
        const win = t4wWindow(i);
        const totalBranch = win.reduce((s, r) => s + (r.branchContact ?? 0), 0);
        const totalContact = win.reduce((s, r) => s + (r.contactTotal ?? 0), 0);
        return totalContact > 0 ? Math.round((totalBranch / totalContact) * 100) : null;
      });
    } else if (metricKey === "cancelled_unreviewed") {
      t4wValues = rows.map((_, i) => {
        const win = t4wWindow(i);
        return win.reduce((s, r) => s + (r.cancelledUnreviewed ?? 0), 0) || null;
      });
    } else if (metricKey === "unused_overdue") {
      t4wValues = rows.map((_, i) => {
        const win = t4wWindow(i);
        return win.reduce((s, r) => s + (r.unusedOverdue ?? 0), 0) || null;
      });
    } else if (metricKey === "no_contact_attempt") {
      t4wValues = rows.map((_, i) => {
        const win = t4wWindow(i);
        return win.reduce((s, r) => s + (r.noContact ?? 0), 0) || null;
      });
    }

    return {
      weekLabels,
      series: [{ name: config.label, values: t4wValues }],
      rows,
      allRows,
    };
  }, [chartData, metricKey, config.label]);

  // Default to the most recent week
  const effectiveSelectedIndex = selectedWeekIndex !== null
    ? selectedWeekIndex
    : Math.max(0, trendData.rows.length - 1);

  const leaderboard = useMemo(() => {
    const sorted = [...(leaderboardRows ?? [])];

    // Compute zone benchmark from raw counts across ALL branches in the zone.
    // This matches the verified calculation: e.g. SPAC zone conversion rate =
    // total rented / total leads across every branch in the zone (not an average of
    // branch-level rounded percentages, and not limited to only the GM's own branches).
    //
    // leaderboard rows carry `total` and `rented` for all metrics backed by those counts.
    // For other metrics we fall back to the pre-computed zones snapshot.
    let benchmarkVal = null;
    const zoneRows = gmZone ? (allLeaderboardRows ?? []).filter((r) => r.zone === gmZone) : [];

    if (zoneRows.length > 0) {
      const tot = zoneRows.reduce((s, r) => s + (r.total ?? 0), 0);
      const ren = zoneRows.reduce((s, r) => s + (r.rented ?? 0), 0);

      if (metricKey === "conversion_rate") {
        benchmarkVal = tot > 0 ? Math.round((ren / tot) * 100) : null;
      } else {
        // For other metrics, use the pre-computed zone snapshot (weighted raw counts
        // computed server-side in the same T4W window).
        const zoneRow = zonesSnapshot ? (zonesSnapshot[gmZone] ?? null) : null;
        benchmarkVal = zoneRow ? (zoneRow[config.branchKey] ?? null) : null;
      }
    }

    // Final fallback: simple average of the GM's own branch values (least accurate).
    if (benchmarkVal == null && config.branchKey != null) {
      const numeric = (v) => (typeof v === "number" ? v : null);
      const valid = sorted.map((r) => numeric(r[config.branchKey])).filter((v) => v != null);
      benchmarkVal = valid.length > 0 ? Math.round(valid.reduce((s, v) => s + v, 0) / valid.length) : null;
    }

    return {
      sorted,
      benchmark: config.branchKey != null ? { [config.branchKey]: benchmarkVal } : {},
    };
  }, [leaderboardRows, allLeaderboardRows, config.branchKey, gmZone, metricKey, zonesSnapshot]);

  // Cumulative branch metrics through the selected trendline week.
  // trendData.rows are the 4 T4W weeks; clicking index i means "T4W cumulative through week i".
  // We aggregate each branch's weekly chartData rows from week 0 through effectiveSelectedIndex.
  // Only conversion_rate and comment_rate have sufficient per-week branch data.
  const BRANCH_REAGGREGATABLE = ["conversion_rate", "comment_rate", "contacted_within_30_min", "branch_vs_hrd_split", "no_contact_attempt"];

  const weeklyLeaderboard = useMemo(() => {
    if (!branchesSnapshot || !trendData.rows.length) return null;
    if (!BRANCH_REAGGREGATABLE.includes(metricKey)) return null;

    // At the full T4W view (last trendline point), return null so the snapshot
    // leaderboard values are used directly. Re-aggregating from chartData uses
    // week_of buckets which can diverge from the leaderboard's init_dt_final-based
    // filtering, causing current and prev values from different lead sets → wrong delta.
    if (effectiveSelectedIndex === trendData.rows.length - 1) return null;

    // Build a normalized lookup: normKey -> branchData
    const normKey = (s) => (s == null ? "" : String(s).trim().replace(/\s+/g, " "));
    const branchLookup = new Map(
      Object.entries(branchesSnapshot).map(([k, v]) => [normKey(k), v])
    );

    // Branch chartData covers exactly the T4W period (4 weeks, indices 0–3).
    // trendData.rows are also those same 4 weeks (allRows.slice(-4)).
    // Match positionally: branch chartData row i corresponds to trendData.rows[i].
    // Cumulative T4W through effectiveSelectedIndex = aggregate branch rows 0..effectiveSelectedIndex.
    const sliceEnd = effectiveSelectedIndex + 1; // inclusive slice

    const rows = (leaderboardRows ?? []).map((r) => {
      const branchData = branchLookup.get(normKey(r.branch));
      const branchChartData = branchData?.chartData ?? [];

      // Try weekStart matching first (works once snapshot is regenerated with weekStart).
      // Fall back to positional alignment if weekStart is absent.
      let weekRows;
      const t4wStart = trendData.rows[0]?.weekStart;
      const t4wEnd = trendData.rows[effectiveSelectedIndex]?.weekStart;
      if (t4wStart && t4wEnd) {
        weekRows = branchChartData.filter(
          (w) => w.weekStart >= t4wStart && w.weekStart <= t4wEnd
        );
      } else {
        // Positional fallback: branch chartData rows align with trendData.rows by index.
        weekRows = branchChartData.slice(0, sliceEnd);
      }

      let metricVal = null;
      if (metricKey === "conversion_rate") {
        const totalLeads = weekRows.reduce((s, w) => s + (w.totalLeads ?? 0), 0);
        const totalRented = weekRows.reduce((s, w) => s + (w.rented ?? 0), 0);
        metricVal = totalLeads > 0 ? Math.round((totalRented / totalLeads) * 100) : null;
      } else if (metricKey === "comment_rate") {
        const totalLeads = weekRows.reduce((s, w) => s + (w.totalLeads ?? 0), 0);
        const totalEnriched = weekRows.reduce((s, w) => s + (w.enriched ?? 0), 0);
        metricVal = totalLeads > 0 ? Math.round((totalEnriched / totalLeads) * 100) : null;
      } else if (metricKey === "contacted_within_30_min") {
        const totalWithin30 = weekRows.reduce((s, w) => s + (w.within30 ?? 0), 0);
        const totalEligible = weekRows.reduce((s, w) => s + (w.w30Den ?? w.totalLeads ?? 0), 0);
        metricVal = totalEligible > 0 ? Math.round((totalWithin30 / totalEligible) * 100) : null;
      } else if (metricKey === "branch_vs_hrd_split") {
        const totalBranch = weekRows.reduce((s, w) => s + (w.branchContact ?? 0), 0);
        const totalContact = weekRows.reduce((s, w) => s + (w.contactTotal ?? 0), 0);
        metricVal = totalContact > 0 ? Math.round((totalBranch / totalContact) * 100) : null;
      } else if (metricKey === "no_contact_attempt") {
        metricVal = weekRows.reduce((s, w) => s + (w.noContact ?? 0), 0);
      }

      return { ...r, [config.branchKey]: metricVal };
    });

    const numeric = (v) => (typeof v === "number" ? v : null);
    const valid = rows.map((r) => numeric(r[config.branchKey])).filter((v) => v != null);
    const benchmarkVal = valid.length > 0 ? Math.round(valid.reduce((s, v) => s + v, 0) / valid.length) : null;
    return { sorted: rows, benchmark: { [config.branchKey]: benchmarkVal } };
  }, [trendData.rows, effectiveSelectedIndex, branchesSnapshot, leaderboardRows, metricKey, config.branchKey]);

  const activeBranchLabel = useMemo(() => {
    if (!weeklyLeaderboard) return null;
    const lastIdx = trendData.rows.length - 1;
    if (effectiveSelectedIndex === lastIdx) return "T4W";
    const row = trendData.rows[effectiveSelectedIndex];
    if (!row) return "T4W";
    const endLabel = row.weekStart && row.weekEnd
      ? `${fmtIso(row.weekStart)}–${fmtIso(row.weekEnd)}`
      : row.label;
    return `T4W through ${endLabel}`;
  }, [weeklyLeaderboard, trendData.rows, effectiveSelectedIndex]);

  const formatRange = (r) => formatDateRange(r?.start, r?.end);

  // Derive the ISO date range for the currently selected trendline point.
  // Full T4W (last point) → use snapshot period dates.
  // Sub-period → use the rolling 4-week window ending at that trendline row.
  const selectedIsoRange = useMemo(() => {
    const lastIdx = trendData.rows.length - 1;
    if (effectiveSelectedIndex === lastIdx) {
      // Full T4W — use snapshot period
      const s = dateRange?.start instanceof Date
        ? dateRange.start.toISOString().slice(0, 10)
        : typeof dateRange?.start === "string" ? dateRange.start.slice(0, 10) : null;
      const e = dateRange?.end instanceof Date
        ? dateRange.end.toISOString().slice(0, 10)
        : typeof dateRange?.end === "string" ? dateRange.end.slice(0, 10) : null;
      return s && e ? { startDate: s, endDate: e } : null;
    }
    // Rolling 4-week window: endRow = trendData.allRows[endIdx], startRow = endRow - 3 weeks
    const endIdx = trendData.allRows.length - 4 + effectiveSelectedIndex;
    const startIdx = Math.max(0, endIdx - 3);
    const startRow = trendData.allRows[startIdx];
    const endRow = trendData.allRows[endIdx];
    const startDate = startRow?.weekStart ?? null;
    const endDate = endRow?.weekEnd ?? null;
    return startDate && endDate ? { startDate, endDate } : null;
  }, [trendData, effectiveSelectedIndex, dateRange]);

  const handleBranchClick = useCallback((branchName) => {
    const label = activeBranchLabel ?? formatRange(dateRange) ?? "T4W";
    setBranchLeadsContext({
      branch: branchName,
      gmName: null,
      startDate: selectedIsoRange?.startDate ?? null,
      endDate: selectedIsoRange?.endDate ?? null,
      periodLabel: label,
    });
  }, [selectedIsoRange, activeBranchLabel, dateRange, formatRange]);

  const handleWeekRowClick = useCallback((row) => {
    // Single week: use weekStart/weekEnd from the row
    const startDate = row.weekStart ?? null;
    const endDate = row.weekEnd ?? null;
    const label = (startDate && endDate)
      ? `${fmtIso(startDate)} – ${fmtIso(endDate)}`
      : (row.label ?? "Week");
    setBranchLeadsContext({ branch: null, gmName, startDate, endDate, periodLabel: label });
  }, [gmName]);

  return (
    <>
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
        className="relative bg-white rounded-xl shadow-xl w-full max-w-[56rem] mx-4 max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--neutral-200)] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-0.5">
                <h3 className="text-lg font-bold text-[var(--hertz-black)]">{config.label}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-extrabold text-[var(--hertz-black)]">{config.format(currentValue)}</span>
                  {relChangeVal != null && relChangeVal !== 0 && (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                      isPositive ? "bg-[#2E7D32]/15 text-[#2E7D32]" : isNegative ? "bg-[#C62828]/15 text-[#C62828]" : "bg-[var(--neutral-100)] text-[var(--neutral-600)]"
                    }`}>
                      {config.lowerIsBetter
                        ? (relChangeVal < 0 ? "↓" : "↑")
                        : (relChangeVal > 0 ? "↑" : "↓")}
                      {Math.abs(relChangeVal)}%
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-[var(--neutral-600)]">
                {config.description} &middot; {formatRange(dateRange)}
                {comparisonRange && <span className="text-[var(--neutral-400)]"> vs {formatRange(comparisonRange)}</span>}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--neutral-100)] text-[var(--neutral-600)] transition-colors ml-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-auto flex-1 space-y-6">
          {/* Section 1: T4W Trendline */}
          <div>
            <p className="text-xs font-bold text-[var(--hertz-black)] uppercase tracking-wider mb-1">Trailing 4-Week Trendline</p>
            <p className="text-[10px] text-[var(--neutral-500)] mb-3">
              Rolling T4W rate at each week — each point is a 28-day lookback ending that week. Click a point to highlight its breakdown below.
            </p>
            <div className="border border-[var(--neutral-100)] rounded-lg p-3 bg-[var(--neutral-50)]/50">
              <TrendChart
                data={trendData}
                config={config}
                selectedIndex={effectiveSelectedIndex}
                onPointClick={setSelectedWeekIndex}
                dateRange={dateRange}
              />
            </div>
            {trendData.rows.length > 0 && (() => {
              // Slice the 4-week window ending at the selected trendline point.
              // allRows has up to 7 rows (3 historical + 4 T4W); trendline index i
              // maps to allRows starting at (i + extraWeeks - 3).
              const extraWeeks = trendData.allRows.length - 4;
              let breakdownRows, breakdownSelectedIndex;
              if (extraWeeks >= 3) {
                const windowStart = effectiveSelectedIndex + extraWeeks - 3;
                breakdownRows = trendData.allRows.slice(windowStart, windowStart + 4);
                breakdownSelectedIndex = 3;
              } else {
                // Snapshot predates the history expansion: trim any weeks that
                // fall after the clicked point so the table always ends at the
                // selected week (Mar 9 disappears when clicking Mar 2, etc.).
                breakdownRows = trendData.rows.slice(0, effectiveSelectedIndex + 1);
                breakdownSelectedIndex = effectiveSelectedIndex;
              }
              if (metricKey === "comment_rate") {
                return <CommentRateBreakdownTable rows={breakdownRows} selectedIndex={breakdownSelectedIndex} dateRange={dateRange} onWeekClick={handleWeekRowClick} />;
              }
              if (metricKey === "no_contact_attempt") {
                return <NoContactBreakdownTable rows={breakdownRows} selectedIndex={breakdownSelectedIndex} dateRange={dateRange} onWeekClick={handleWeekRowClick} />;
              }
              if (metricKey === "contacted_within_30_min") {
                return <ContactedWithin30BreakdownTable rows={breakdownRows} selectedIndex={breakdownSelectedIndex} dateRange={dateRange} onWeekClick={handleWeekRowClick} />;
              }
              if (metricKey === "branch_vs_hrd_split") {
                return <BranchContactBreakdownTable rows={breakdownRows} selectedIndex={breakdownSelectedIndex} dateRange={dateRange} onWeekClick={handleWeekRowClick} />;
              }
              if (metricKey === "cancelled_unreviewed") {
                return <CancelledUnreviewedBreakdownTable rows={breakdownRows} selectedIndex={breakdownSelectedIndex} dateRange={dateRange} onWeekClick={handleWeekRowClick} />;
              }
              if (metricKey === "unused_overdue") {
                return <UnusedOverdueBreakdownTable rows={breakdownRows} selectedIndex={breakdownSelectedIndex} dateRange={dateRange} onWeekClick={handleWeekRowClick} />;
              }
              return <WeeklyBreakdownTable rows={breakdownRows} selectedIndex={breakdownSelectedIndex} dateRange={dateRange} onWeekClick={handleWeekRowClick} />;
            })()}
          </div>

          {/* Section 2: Performance by Branch (only when branch-level data exists) */}
          {config.branchKey != null && (
            <div>
              <BranchPerformanceSection
                leaderboard={weeklyLeaderboard ?? leaderboard}
                config={config}
                sortKey={branchSort}
                onSortChange={setBranchSort}
                periodLabel={activeBranchLabel}
                onBranchClick={handleBranchClick}
              />
            </div>
          )}

        </div>

      </motion.div>
    </motion.div>

    {/* Branch leads popup modal */}
    <AnimatePresence>
      {branchLeadsContext && (
        <BranchLeadsPanel
          branch={branchLeadsContext.branch}
          gmName={branchLeadsContext.gmName}
          startDate={branchLeadsContext.startDate}
          endDate={branchLeadsContext.endDate}
          periodLabel={branchLeadsContext.periodLabel}
          onClose={() => setBranchLeadsContext(null)}
        />
      )}
    </AnimatePresence>
    </>
  );
}
