import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  tasksInDateRange,
  getOpenTasksCount,
  getTaskCompletionRate,
  formatMinutesToDisplay,
  parseTimeToMinutes,
  getLeadById,
  isUnusedOpenOverFiveDays,
} from "../selectors/demoSelectors";
import StatusBadge from "./StatusBadge";
import GroupBySelector from "./GroupBySelector";
import ConversionBreakdownTable from "./ConversionBreakdownTable";
import { formatDateRange, formatDateShort } from "../utils/dateTime";
import { useData } from "../context/DataContext";

function formatRange(range) {
  return formatDateRange(range?.start, range?.end) || "—";
}

function safeRate(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

const METRIC_CONFIG = {
  total_leads: {
    label: "Total Leads",
    type: "leads",
    description: "All leads received during this period",
    getValue: (leads) => leads.length,
    format: (v) => `${v}`,
    getRelevant: (leads) => leads,
  },
  conversion_rate: {
    label: "Conversion Rate",
    type: "leads",
    description: "Percentage of leads that converted to a rental",
    getValue: (leads) => {
      const total = leads.length;
      const rented = leads.filter((l) => l.status === "Rented").length;
      return total ? Math.round((rented / total) * 100) : 0;
    },
    format: (v) => `${v}%`,
    getRelevant: (leads) => leads,
    numeratorLabel: "Rented",
    numeratorFilter: (l) => l.status === "Rented",
    denominatorLabel: "Total",
  },
  comment_rate: {
    label: "Comment Rate",
    type: "leads",
    description: "Percentage of leads with enrichment/comments completed",
    getValue: (leads) => {
      const total = leads.length;
      const enriched = leads.filter((l) => l.enrichmentComplete).length;
      return total ? Math.round((enriched / total) * 100) : 0;
    },
    format: (v) => `${v}%`,
    getRelevant: (leads) => leads,
    numeratorLabel: "Commented",
    numeratorFilter: (l) => l.enrichmentComplete,
    denominatorLabel: "Total",
  },
  open_tasks: {
    label: "Open Tasks",
    type: "tasks",
    description: "Tasks that are not yet completed",
    getValue: (_, tasks) => getOpenTasksCount(tasks),
    format: (v) => `${v}`,
    getRelevantTasks: (tasks) => tasks.filter((t) => t.status !== "Done"),
  },
  task_completion_rate: {
    label: "Task Completion Rate",
    type: "tasks",
    description: "Percentage of tasks marked as Done",
    getValue: (_, tasks) => getTaskCompletionRate(tasks),
    format: (v) => (v != null ? `${v}%` : "—"),
    getRelevantTasks: (tasks) => tasks,
    numeratorLabel: "Done",
    numeratorFilter: (t) => t.status === "Done",
    denominatorLabel: "Total",
  },
  avg_time_to_contact: {
    label: "Average Time for First Contact",
    type: "leads",
    description: "Average time from lead receipt to first customer contact",
    getValue: (leads) => {
      const minutes = leads
        .map((l) => parseTimeToMinutes(l.timeToFirstContact))
        .filter((m) => m != null);
      if (minutes.length === 0) return null;
      return minutes.reduce((s, m) => s + m, 0) / minutes.length;
    },
    format: (v) => (v != null ? formatMinutesToDisplay(v) : "—"),
    getRelevant: (leads) => leads.filter((l) => parseTimeToMinutes(l.timeToFirstContact) != null),
    lowerIsBetter: true,
  },
  contacted_within_30_min: {
    label: "Contacted within 30 min",
    type: "leads",
    description: "Percentage of leads with first contact within 30 minutes of lead creation",
    getValue: (leads) => {
      const list = leads ?? [];
      if (list.length === 0) return null;
      const within30 = list.filter((l) => (l.contactRange ?? l.contact_range) === "(a)<30min").length;
      return Math.round((within30 / list.length) * 100);
    },
    format: (v) => (v != null ? `${v}%` : "—"),
    getRelevant: (leads) => leads,
    numeratorLabel: "Within 30 min",
    numeratorFilter: (l) => (l.contactRange ?? l.contact_range) === "(a)<30min",
    denominatorLabel: "Total",
    extraColumn: { label: "Contact Range", getValue: (l) => l.contactRange ?? l.contact_range ?? "—" },
  },
  branch_vs_hrd_split: {
    label: "Branch vs. HRD split",
    type: "leads",
    description: "Percentage of first contacts made by Branch (vs. HRD)",
    getValue: (leads) => {
      const { branch: branchCount, hrd } = getBranchVsHrdSplit(leads);
      const total = branchCount + hrd;
      return total ? Math.round((branchCount / total) * 100) : null;
    },
    format: (v) => (v != null ? `${v}% Branch` : "—"),
    getRelevant: (leads) =>
      leads.filter((l) => {
        const by = l.firstContactBy ?? l.first_contact_by;
        return by === "branch" || by === "hrd";
      }),
    numeratorLabel: "Branch",
    numeratorFilter: (l) => (l.firstContactBy ?? l.first_contact_by) === "branch",
    denominatorLabel: "With contact",
    extraColumn: { label: "First Contact By", getValue: (l) => l.firstContactBy ?? l.first_contact_by ?? "—" },
  },
  meeting_prep_comment_rate: {
    label: "Comment rate",
    type: "leads",
    description: "Percentage of Cancelled/Unused leads with reason or notes",
    getValue: (leads) => {
      const actionable = (leads ?? []).filter((l) => l.status === "Cancelled" || l.status === "Unused");
      if (actionable.length === 0) return null;
      const withComments = actionable.filter((l) => l.enrichment?.reason || l.enrichment?.notes);
      return Math.round((withComments.length / actionable.length) * 100);
    },
    format: (v) => (v != null ? `${v}%` : "—"),
    getRelevant: (leads) => (leads ?? []).filter((l) => l.status === "Cancelled" || l.status === "Unused"),
    numeratorLabel: "With comments",
    numeratorFilter: (l) => !!(l.enrichment?.reason || l.enrichment?.notes),
    denominatorLabel: "Cancelled/Unused",
  },
  cancelled_unreviewed: {
    label: "Cancelled Unreviewed",
    type: "leads",
    description: "Cancelled leads not yet archived or with GM directive",
    getValue: (leads) =>
      (leads ?? []).filter((l) => l.status === "Cancelled" && !l.archived && !l.gmDirective).length,
    format: (v) => `${v ?? 0}`,
    getRelevant: (leads) =>
      (leads ?? []).filter((l) => l.status === "Cancelled" && !l.archived && !l.gmDirective),
  },
  unused_overdue: {
    label: "Unused Overdue",
    type: "leads",
    description: "Unused leads open more than 5 days",
    getValue: (leads) => (leads ?? []).filter(isUnusedOpenOverFiveDays).length,
    format: (v) => `${v ?? 0}`,
    getRelevant: (leads) => (leads ?? []).filter(isUnusedOpenOverFiveDays),
    lowerIsBetter: true,
  },
};

function ComparisonCards({ config, currentValue, previousValue, currentRange, previousRange, currentCount, previousCount }) {
  const fmtCurrent = config.format(currentValue);
  const fmtPrevious = config.format(previousValue);

  return (
    <div className="grid grid-cols-2 gap-3 mb-5">
      <div className="border-2 border-[var(--hertz-primary)] rounded-lg p-4 bg-[var(--hertz-primary)]/5">
        <p className="text-[10px] font-bold text-[var(--neutral-600)] uppercase tracking-wider mb-1">Current Period</p>
        <p className="text-xs text-[var(--neutral-600)] mb-2">{formatRange(currentRange)}</p>
        <div className="flex items-center gap-2">
          <p className="text-2xl font-extrabold text-[var(--hertz-black)]">{fmtCurrent}</p>
        </div>
        {config.numeratorLabel && (
          <p className="text-xs text-[var(--neutral-600)] mt-1">
            {config.numeratorLabel}: {currentCount.numerator} / {config.denominatorLabel}: {currentCount.denominator}
          </p>
        )}
      </div>
      <div className="border border-[var(--neutral-200)] rounded-lg p-4 bg-[var(--neutral-50)]">
        <p className="text-[10px] font-bold text-[var(--neutral-600)] uppercase tracking-wider mb-1">Previous Period</p>
        <p className="text-xs text-[var(--neutral-600)] mb-2">{formatRange(previousRange)}</p>
        <p className="text-2xl font-extrabold text-[var(--neutral-500)]">{fmtPrevious}</p>
        {config.numeratorLabel && (
          <p className="text-xs text-[var(--neutral-600)] mt-1">
            {config.numeratorLabel}: {previousCount.numerator} / {config.denominatorLabel}: {previousCount.denominator}
          </p>
        )}
      </div>
    </div>
  );
}

const INITIAL_ROWS = 5;

function LeadTable({ leads, config, allLeads, onLeadClick }) {
  const [showAll, setShowAll] = useState(false);
  const showHighlight = !!config.numeratorFilter;
  const extraCol = config.extraColumn;
  const colCount = 7 + (showHighlight ? 1 : 0) + (extraCol ? 1 : 0);
  const visibleLeads = showAll ? leads : leads.slice(0, INITIAL_ROWS);
  const hasMore = leads.length > INITIAL_ROWS;
  return (
    <div className="border border-[var(--neutral-200)] rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-[45vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#272425] text-xs text-white font-semibold uppercase tracking-wider">
              {showHighlight && <th className="px-3 py-3 text-center w-[60px]">{config.numeratorLabel}</th>}
              <th className="px-3 py-3 text-left">Date</th>
              <th className="px-3 py-3 text-left">Customer</th>
              <th className="px-3 py-3 text-center">Confirmation #</th>
              <th className="px-3 py-3 text-center">Status</th>
              <th className="px-3 py-3 text-center">Time to Contact</th>
              {extraCol && <th className="px-3 py-3 text-center">{extraCol.label}</th>}
              <th className="px-3 py-3 text-left">Cancel Reason</th>
              <th className="px-3 py-3 text-left">Comments</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-12 text-center text-[var(--neutral-600)]">
                  No leads in this period
                </td>
              </tr>
            ) : (
              visibleLeads.map((lead) => {
                const isNumerator = showHighlight && config.numeratorFilter(lead);
                return (
                  <tr
                    key={lead.id}
                    onClick={onLeadClick ? () => onLeadClick(lead) : undefined}
                    className={`border-t border-[var(--neutral-200)] transition-colors ${
                      isNumerator ? "bg-[#2E7D32]/5" : ""
                    } ${
                      onLeadClick ? "cursor-pointer hover:bg-[var(--neutral-50)]" : ""
                    }`}
                  >
                    {showHighlight && (
                      <td className="px-3 py-3 text-center">
                        {isNumerator ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#2E7D32]/15 text-[#2E7D32]">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--neutral-100)] text-[var(--neutral-400)]">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-3 text-[var(--neutral-600)] text-xs">
                      {lead.initDtFinal ? formatDateShort(new Date(lead.initDtFinal + "T12:00:00Z")) : "—"}
                    </td>
                    <td className="px-3 py-3 font-semibold text-[var(--hertz-black)]">{lead.customer ?? "—"}</td>
                    <td className="px-3 py-3 text-center font-mono text-xs text-[var(--neutral-600)]">{lead.reservationId ?? "—"}</td>
                    <td className="px-3 py-3 text-center"><StatusBadge status={lead.status} /></td>
                    <td className="px-3 py-3 text-center text-[var(--neutral-600)]">{lead.timeToFirstContact ?? "—"}</td>
                    {extraCol && (
                      <td className="px-3 py-3 text-center text-[var(--neutral-600)]">{extraCol.getValue(lead)}</td>
                    )}
                    <td className="px-3 py-3 text-[var(--neutral-600)] max-w-[150px] truncate">{lead.hlesReason ?? "—"}</td>
                    <td className="px-3 py-3 text-[var(--neutral-600)] max-w-[180px] truncate" title={lead.enrichment?.reason ?? lead.enrichment?.notes ?? ""}>
                      {lead.enrichment?.reason ?? lead.enrichment?.notes ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="border-t border-[var(--neutral-200)] px-3 py-2 bg-[var(--neutral-50)]">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-medium text-[var(--hertz-primary)] hover:underline"
          >
            {showAll ? "Show less" : `View all ${leads.length} rows`}
          </button>
        </div>
      )}
    </div>
  );
}

function TaskTable({ tasks, config, allLeads }) {
  const [showAll, setShowAll] = useState(false);
  const showHighlight = !!config.numeratorFilter;
  const visibleTasks = showAll ? tasks : tasks.slice(0, INITIAL_ROWS);
  const hasMore = tasks.length > INITIAL_ROWS;
  return (
    <div className="border border-[var(--neutral-200)] rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-[45vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#272425] text-xs text-white font-semibold uppercase tracking-wider">
              {showHighlight && <th className="px-3 py-3 text-center w-[60px]">{config.numeratorLabel}</th>}
              <th className="px-3 py-3 text-left">Title</th>
              <th className="px-3 py-3 text-left">Lead</th>
              <th className="px-3 py-3 text-center">Status</th>
              <th className="px-3 py-3 text-center">Priority</th>
              <th className="px-3 py-3 text-center">Due Date</th>
              <th className="px-3 py-3 text-center">Created By</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={showHighlight ? 7 : 6} className="px-3 py-12 text-center text-[var(--neutral-600)]">
                  No tasks in this period
                </td>
              </tr>
            ) : (
              visibleTasks.map((task) => {
                const isNumerator = showHighlight && config.numeratorFilter(task);
                const leadCustomer = task.lead?.customer ?? getLeadById(allLeads, task.leadId)?.customer ?? "—";
                return (
                  <tr
                    key={task.id}
                    className={`border-t border-[var(--neutral-200)] transition-colors ${
                      isNumerator ? "bg-[#2E7D32]/5" : ""
                    }`}
                  >
                    {showHighlight && (
                      <td className="px-3 py-3 text-center">
                        {isNumerator ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#2E7D32]/15 text-[#2E7D32]">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--neutral-100)] text-[var(--neutral-400)]">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-3 font-semibold text-[var(--hertz-black)] max-w-[200px]">
                      <span className="block truncate" title={task.title}>{task.title}</span>
                    </td>
                    <td className="px-3 py-3 text-[var(--neutral-600)] max-w-[150px]">
                      <span className="block truncate" title={leadCustomer}>{leadCustomer}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        task.status === "Done" ? "bg-[#2E7D32]/15 text-[#2E7D32]" :
                        task.status === "In Progress" ? "bg-[var(--hertz-primary)]/25 text-[var(--hertz-black)]" :
                        "bg-[#C62828]/15 text-[#C62828]"
                      }`}>{task.status}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        task.priority === "High" ? "bg-amber-100 text-amber-800" :
                        "bg-[var(--neutral-100)] text-[var(--neutral-600)]"
                      }`}>{task.priority ?? "Medium"}</span>
                    </td>
                    <td className="px-3 py-3 text-center text-[var(--neutral-600)] whitespace-nowrap">{task.dueDate ?? "—"}</td>
                    <td className="px-3 py-3 text-center text-[var(--neutral-600)]">{task.createdBy ?? "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="border-t border-[var(--neutral-200)] px-3 py-2 bg-[var(--neutral-50)]">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-medium text-[var(--hertz-primary)] hover:underline"
          >
            {showAll ? "Show less" : `View all ${tasks.length} rows`}
          </button>
        </div>
      )}
    </div>
  );
}

function WeeklyBreakdownTable({ rows }) {
  const totalLeads = rows.reduce((sum, r) => sum + (r.totalLeads ?? 0), 0);
  const totalRented = rows.reduce((sum, r) => sum + (r.rented ?? 0), 0);
  const totalCancelled = rows.reduce((sum, r) => sum + (r.cancelled ?? 0), 0);
  const totalUnused = rows.reduce((sum, r) => sum + (r.unused ?? 0), 0);
  const totalRate = totalLeads > 0 ? Math.round((totalRented / totalLeads) * 100) : 0;

  return (
    <div className="mb-5 overflow-x-auto">
      <p className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wide mb-2">Weekly Breakdown</p>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--neutral-200)]">
            <th className="text-left font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 pr-3 whitespace-nowrap">Week</th>
            <th className="text-right font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Total</th>
            <th className="text-right font-semibold text-[#2E7D32] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Rented</th>
            <th className="text-right font-semibold text-[#B45309] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Cancelled</th>
            <th className="text-right font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Unused</th>
            <th className="text-right font-semibold text-[var(--hertz-black)] uppercase tracking-wider py-1.5 pl-3 whitespace-nowrap">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--neutral-100)]">
              <td className="py-1.5 pr-3 text-[var(--neutral-700)] whitespace-nowrap">{row.label}</td>
              <td className="py-1.5 px-3 text-right text-[var(--neutral-700)]">{row.totalLeads ?? 0}</td>
              <td className="py-1.5 px-3 text-right text-[#2E7D32]">{row.rented ?? 0}</td>
              <td className="py-1.5 px-3 text-right text-[#B45309]">{row.cancelled ?? 0}</td>
              <td className="py-1.5 px-3 text-right text-[var(--neutral-500)]">{row.unused ?? 0}</td>
              <td className="py-1.5 pl-3 text-right font-bold text-[var(--hertz-black)]">
                {row.conversionRate != null ? `${row.conversionRate}%` : "—"}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-[var(--neutral-300)] bg-[var(--neutral-50)]">
            <td className="py-1.5 pr-3 font-semibold text-[var(--neutral-700)] whitespace-nowrap">Total</td>
            <td className="py-1.5 px-3 text-right font-semibold text-[var(--neutral-700)]">{totalLeads}</td>
            <td className="py-1.5 px-3 text-right font-semibold text-[#2E7D32]">{totalRented}</td>
            <td className="py-1.5 px-3 text-right font-semibold text-[#B45309]">{totalCancelled}</td>
            <td className="py-1.5 px-3 text-right font-semibold text-[var(--neutral-500)]">{totalUnused}</td>
            <td className="py-1.5 pl-3 text-right font-bold text-[var(--hertz-black)]">{totalRate}%</td>
          </tr>
        </tbody>
      </table>
      <p className="text-[10px] text-[var(--neutral-400)] mt-1.5">
        Rate = Rented ÷ Total per week (Sat–Fri). Total rate is recalculated from summed weekly counts.
      </p>
    </div>
  );
}

function BmCommentRateBreakdownTable({ rows }) {
  const totalLeads = rows.reduce((sum, r) => sum + (r.totalLeads ?? 0), 0);
  const totalEnriched = rows.reduce((sum, r) => sum + (r.enriched ?? 0), 0);
  const totalRate = totalLeads > 0 ? Math.round((totalEnriched / totalLeads) * 100) : 0;

  return (
    <div className="mb-5 overflow-x-auto">
      <p className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wide mb-2">Weekly Breakdown</p>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--neutral-200)]">
            <th className="text-left font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 pr-3 whitespace-nowrap">Week</th>
            <th className="text-right font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Total</th>
            <th className="text-right font-semibold text-[#2E7D32] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Commented</th>
            <th className="text-right font-semibold text-[var(--hertz-black)] uppercase tracking-wider py-1.5 pl-3 whitespace-nowrap">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const weekRate = (row.totalLeads ?? 0) > 0
              ? Math.round(((row.enriched ?? 0) / row.totalLeads) * 100)
              : null;
            return (
              <tr key={i} className="border-b border-[var(--neutral-100)]">
                <td className="py-1.5 pr-3 text-[var(--neutral-700)] whitespace-nowrap">{row.label}</td>
                <td className="py-1.5 px-3 text-right text-[var(--neutral-700)]">{row.totalLeads ?? 0}</td>
                <td className="py-1.5 px-3 text-right text-[#2E7D32]">{row.enriched ?? 0}</td>
                <td className="py-1.5 pl-3 text-right font-bold text-[var(--hertz-black)]">
                  {weekRate != null ? `${weekRate}%` : "—"}
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-[var(--neutral-300)] bg-[var(--neutral-50)]">
            <td className="py-1.5 pr-3 font-semibold text-[var(--neutral-700)] whitespace-nowrap">Total</td>
            <td className="py-1.5 px-3 text-right font-semibold text-[var(--neutral-700)]">{totalLeads}</td>
            <td className="py-1.5 px-3 text-right font-semibold text-[#2E7D32]">{totalEnriched}</td>
            <td className="py-1.5 pl-3 text-right font-bold text-[var(--hertz-black)]">{totalRate}%</td>
          </tr>
        </tbody>
      </table>
      <p className="text-[10px] text-[var(--neutral-400)] mt-1.5">
        Rate = Commented ÷ Total per week (Sat–Fri). Total rate is recalculated from summed weekly counts.
      </p>
    </div>
  );
}

function BmContactedWithin30BreakdownTable({ rows }) {
  const totalWithin30 = rows.reduce((sum, r) => sum + (r.within30 ?? 0), 0);
  const totalDen = rows.reduce((sum, r) => sum + (r.w30Den ?? r.totalLeads ?? 0), 0);
  const totalRate = totalDen > 0 ? Math.round((totalWithin30 / totalDen) * 100) : 0;

  return (
    <div className="mb-5 overflow-x-auto">
      <p className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wide mb-2">Weekly Breakdown</p>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--neutral-200)]">
            <th className="text-left font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 pr-3 whitespace-nowrap">Week</th>
            <th className="text-right font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Total</th>
            <th className="text-right font-semibold text-[#2E7D32] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Within 30 min</th>
            <th className="text-right font-semibold text-[var(--hertz-black)] uppercase tracking-wider py-1.5 pl-3 whitespace-nowrap">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const den = row.w30Den ?? row.totalLeads ?? 0;
            const weekRate = den > 0 ? Math.round(((row.within30 ?? 0) / den) * 100) : null;
            return (
              <tr key={i} className="border-b border-[var(--neutral-100)]">
                <td className="py-1.5 pr-3 text-[var(--neutral-700)] whitespace-nowrap">{row.label}</td>
                <td className="py-1.5 px-3 text-right text-[var(--neutral-700)]">{den}</td>
                <td className="py-1.5 px-3 text-right text-[#2E7D32]">{row.within30 ?? 0}</td>
                <td className="py-1.5 pl-3 text-right font-bold text-[var(--hertz-black)]">
                  {weekRate != null ? `${weekRate}%` : "—"}
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-[var(--neutral-300)] bg-[var(--neutral-50)]">
            <td className="py-1.5 pr-3 font-semibold text-[var(--neutral-700)] whitespace-nowrap">Total</td>
            <td className="py-1.5 px-3 text-right font-semibold text-[var(--neutral-700)]">{totalDen}</td>
            <td className="py-1.5 px-3 text-right font-semibold text-[#2E7D32]">{totalWithin30}</td>
            <td className="py-1.5 pl-3 text-right font-bold text-[var(--hertz-black)]">{totalRate}%</td>
          </tr>
        </tbody>
      </table>
      <p className="text-[10px] text-[var(--neutral-400)] mt-1.5">
        Rate = Within 30 min ÷ Total per week (Sat–Fri). Total rate is recalculated from summed weekly counts.
      </p>
    </div>
  );
}

function BmBranchContactBreakdownTable({ rows }) {
  const totalBranch = rows.reduce((sum, r) => sum + (r.branchContact ?? 0), 0);
  const totalHrd = rows.reduce((sum, r) => sum + (r.hrdContact ?? 0), 0);
  const totalContact = rows.reduce((sum, r) => sum + (r.contactTotal ?? 0), 0);
  const totalRate = totalContact > 0 ? Math.round((totalBranch / totalContact) * 100) : 0;

  return (
    <div className="mb-5 overflow-x-auto">
      <p className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wide mb-2">Weekly Breakdown</p>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--neutral-200)]">
            <th className="text-left font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 pr-3 whitespace-nowrap">Week</th>
            <th className="text-right font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Total Contacts</th>
            <th className="text-right font-semibold text-[#2E7D32] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Branch</th>
            <th className="text-right font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">HRD</th>
            <th className="text-right font-semibold text-[var(--hertz-black)] uppercase tracking-wider py-1.5 pl-3 whitespace-nowrap">Branch %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const contact = row.contactTotal ?? 0;
            const weekRate = contact > 0 ? Math.round(((row.branchContact ?? 0) / contact) * 100) : null;
            return (
              <tr key={i} className="border-b border-[var(--neutral-100)]">
                <td className="py-1.5 pr-3 text-[var(--neutral-700)] whitespace-nowrap">{row.label}</td>
                <td className="py-1.5 px-3 text-right text-[var(--neutral-700)]">{contact}</td>
                <td className="py-1.5 px-3 text-right text-[#2E7D32]">{row.branchContact ?? 0}</td>
                <td className="py-1.5 px-3 text-right text-[var(--neutral-500)]">{row.hrdContact ?? 0}</td>
                <td className="py-1.5 pl-3 text-right font-bold text-[var(--hertz-black)]">
                  {weekRate != null ? `${weekRate}%` : "—"}
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-[var(--neutral-300)] bg-[var(--neutral-50)]">
            <td className="py-1.5 pr-3 font-semibold text-[var(--neutral-700)] whitespace-nowrap">Total</td>
            <td className="py-1.5 px-3 text-right font-semibold text-[var(--neutral-700)]">{totalContact}</td>
            <td className="py-1.5 px-3 text-right font-semibold text-[#2E7D32]">{totalBranch}</td>
            <td className="py-1.5 px-3 text-right font-semibold text-[var(--neutral-500)]">{totalHrd}</td>
            <td className="py-1.5 pl-3 text-right font-bold text-[var(--hertz-black)]">{totalRate}%</td>
          </tr>
        </tbody>
      </table>
      <p className="text-[10px] text-[var(--neutral-400)] mt-1.5">
        Branch % = Branch Contacts ÷ Total Contacts per week (Sat–Fri). Total rate is recalculated from summed weekly counts.
      </p>
    </div>
  );
}

function BmCancelledUnreviewedBreakdownTable({ rows }) {
  const totalCancelledUnreviewed = rows.reduce((sum, r) => sum + (r.cancelledUnreviewed ?? 0), 0);
  const totalLeads = rows.reduce((sum, r) => sum + (r.totalLeads ?? 0), 0);

  return (
    <div className="mb-5 overflow-x-auto">
      <p className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wide mb-2">Weekly Breakdown</p>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--neutral-200)]">
            <th className="text-left font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 pr-3 whitespace-nowrap">Week</th>
            <th className="text-right font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Total Leads</th>
            <th className="text-right font-semibold text-[#B45309] uppercase tracking-wider py-1.5 pl-3 whitespace-nowrap">Cancelled Unreviewed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--neutral-100)]">
              <td className="py-1.5 pr-3 text-[var(--neutral-700)] whitespace-nowrap">{row.label}</td>
              <td className="py-1.5 px-3 text-right text-[var(--neutral-700)]">{row.totalLeads ?? 0}</td>
              <td className="py-1.5 pl-3 text-right font-bold text-[#B45309]">{row.cancelledUnreviewed ?? 0}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-[var(--neutral-300)] bg-[var(--neutral-50)]">
            <td className="py-1.5 pr-3 font-semibold text-[var(--neutral-700)] whitespace-nowrap">Total</td>
            <td className="py-1.5 px-3 text-right font-semibold text-[var(--neutral-700)]">{totalLeads}</td>
            <td className="py-1.5 pl-3 text-right font-bold text-[#B45309]">{totalCancelledUnreviewed}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-[10px] text-[var(--neutral-400)] mt-1.5">
        Count of cancelled leads not yet archived or with GM directive, per week (Sat–Fri).
      </p>
    </div>
  );
}

function BmUnusedOverdueBreakdownTable({ rows }) {
  const totalUnusedOverdue = rows.reduce((sum, r) => sum + (r.unusedOverdue ?? 0), 0);
  const totalLeads = rows.reduce((sum, r) => sum + (r.totalLeads ?? 0), 0);

  return (
    <div className="mb-5 overflow-x-auto">
      <p className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wide mb-2">Weekly Breakdown</p>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--neutral-200)]">
            <th className="text-left font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 pr-3 whitespace-nowrap">Week</th>
            <th className="text-right font-semibold text-[var(--neutral-500)] uppercase tracking-wider py-1.5 px-3 whitespace-nowrap">Total Leads</th>
            <th className="text-right font-semibold text-[#B45309] uppercase tracking-wider py-1.5 pl-3 whitespace-nowrap">Unused Overdue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--neutral-100)]">
              <td className="py-1.5 pr-3 text-[var(--neutral-700)] whitespace-nowrap">{row.label}</td>
              <td className="py-1.5 px-3 text-right text-[var(--neutral-700)]">{row.totalLeads ?? 0}</td>
              <td className="py-1.5 pl-3 text-right font-bold text-[#B45309]">{row.unusedOverdue ?? 0}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-[var(--neutral-300)] bg-[var(--neutral-50)]">
            <td className="py-1.5 pr-3 font-semibold text-[var(--neutral-700)] whitespace-nowrap">Total</td>
            <td className="py-1.5 px-3 text-right font-semibold text-[var(--neutral-700)]">{totalLeads}</td>
            <td className="py-1.5 pl-3 text-right font-bold text-[#B45309]">{totalUnusedOverdue}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-[10px] text-[var(--neutral-400)] mt-1.5">
        Count of unused leads open more than 5 days, per week (Sat–Fri).
      </p>
    </div>
  );
}

export default function MetricDrilldownModal({
  metricKey,
  onClose,
  branchTasks,
  dateRange,
  comparisonRange,
  branch,
  onLeadClick,
  currentStats,
  previousStats,
  currentTaskStats,
  previousTaskStats,
  chartData,
}) {
  const config = METRIC_CONFIG[metricKey];
  const { fetchLeadsPage } = useData();
  const [activeTab, setActiveTab] = useState("current");
  const [groupByPrimary, setGroupByPrimary] = useState(null);
  const [groupBySecondary, setGroupBySecondary] = useState(null);
  const [showBenchmarks, setShowBenchmarks] = useState(false);
  const [currentLimit, setCurrentLimit] = useState(INITIAL_ROWS);
  const [previousLimit, setPreviousLimit] = useState(INITIAL_ROWS);
  const [currentLeadsPage, setCurrentLeadsPage] = useState({ items: [], total: 0, hasNext: false, loading: false });
  const [previousLeadsPage, setPreviousLeadsPage] = useState({ items: [], total: 0, hasNext: false, loading: false });

  if (!config) return null;

  const isLeadMetric = config.type === "leads";

  const currentTasks = useMemo(() => tasksInDateRange(branchTasks, dateRange), [branchTasks, dateRange]);
  const previousTasks = useMemo(() => (comparisonRange ? tasksInDateRange(branchTasks, comparisonRange) : []), [branchTasks, comparisonRange]);
  const taskStatsCurrent = currentTaskStats ?? {};
  const taskStatsPrevious = previousTaskStats ?? {};

  useEffect(() => {
    setCurrentLimit(INITIAL_ROWS);
    setPreviousLimit(INITIAL_ROWS);
  }, [metricKey, dateRange, comparisonRange, branch]);

  useEffect(() => {
    if (!isLeadMetric || !dateRange || !branch) return;
    let cancelled = false;
    setCurrentLeadsPage((prev) => ({ ...prev, loading: true }));
    fetchLeadsPage({
      branch,
      startDate: dateRange.start,
      endDate: dateRange.end,
      limit: currentLimit,
      offset: 0,
    })
      .then((result) => {
        if (cancelled) return;
        setCurrentLeadsPage({
          items: result.items ?? [],
          total: result.total ?? 0,
          hasNext: !!result.hasNext,
          loading: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setCurrentLeadsPage({ items: [], total: 0, hasNext: false, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [isLeadMetric, dateRange, branch, currentLimit, fetchLeadsPage]);

  useEffect(() => {
    if (!isLeadMetric || !comparisonRange || !branch) return;
    let cancelled = false;
    setPreviousLeadsPage((prev) => ({ ...prev, loading: true }));
    fetchLeadsPage({
      branch,
      startDate: comparisonRange.start,
      endDate: comparisonRange.end,
      limit: previousLimit,
      offset: 0,
    })
      .then((result) => {
        if (cancelled) return;
        setPreviousLeadsPage({
          items: result.items ?? [],
          total: result.total ?? 0,
          hasNext: !!result.hasNext,
          loading: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPreviousLeadsPage({ items: [], total: 0, hasNext: false, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [isLeadMetric, comparisonRange, branch, previousLimit, fetchLeadsPage]);

  const currentValue = useMemo(() => {
    if (!isLeadMetric) {
      if (metricKey === "open_tasks") return taskStatsCurrent.open ?? getOpenTasksCount(currentTasks);
      if (metricKey === "task_completion_rate") {
        const fallback = getTaskCompletionRate(currentTasks);
        return taskStatsCurrent.completionRate ?? (fallback ?? 0);
      }
      if (metricKey === "avg_time_to_contact") return taskStatsCurrent.avgTimeToContactMin ?? null;
      return config.getValue(null, currentTasks);
    }
    const stats = currentStats ?? {};
    if (metricKey === "total_leads") return stats.total ?? 0;
    if (metricKey === "conversion_rate") return stats.conversionRate ?? safeRate(stats.rented ?? 0, stats.total ?? 0);
    if (metricKey === "comment_rate") return stats.enrichmentRate ?? safeRate(stats.enriched ?? 0, stats.total ?? 0);
    return currentLeadsPage.total;
  }, [isLeadMetric, metricKey, taskStatsCurrent, currentTasks, config, currentStats, currentLeadsPage.total]);

  const previousValue = useMemo(() => {
    if (!isLeadMetric) {
      if (metricKey === "open_tasks") return taskStatsPrevious.open ?? getOpenTasksCount(previousTasks);
      if (metricKey === "task_completion_rate") {
        const fallback = getTaskCompletionRate(previousTasks);
        return taskStatsPrevious.completionRate ?? (fallback ?? 0);
      }
      if (metricKey === "avg_time_to_contact") return taskStatsPrevious.avgTimeToContactMin ?? null;
      return config.getValue(null, previousTasks);
    }
    const stats = previousStats ?? {};
    if (metricKey === "total_leads") return stats.total ?? 0;
    if (metricKey === "conversion_rate") return stats.conversionRate ?? safeRate(stats.rented ?? 0, stats.total ?? 0);
    if (metricKey === "comment_rate") return stats.enrichmentRate ?? safeRate(stats.enriched ?? 0, stats.total ?? 0);
    return previousLeadsPage.total;
  }, [isLeadMetric, metricKey, taskStatsPrevious, previousTasks, config, previousStats, previousLeadsPage.total]);

  const currentDisplayData = isLeadMetric
    ? currentLeadsPage.items
    : (config.getRelevantTasks ? config.getRelevantTasks(currentTasks) : currentTasks);

  const previousDisplayData = isLeadMetric
    ? previousLeadsPage.items
    : (config.getRelevantTasks ? config.getRelevantTasks(previousTasks) : previousTasks);

  const activeData = activeTab === "current" ? currentDisplayData : previousDisplayData;

  const currentCount = config.numeratorFilter
    ? {
        numerator: isLeadMetric
          ? (metricKey === "conversion_rate" ? (currentStats?.rented ?? 0) : metricKey === "comment_rate" ? (currentStats?.enriched ?? 0) : 0)
          : currentTasks.filter(config.numeratorFilter).length,
        denominator: isLeadMetric ? (currentStats?.total ?? 0) : currentTasks.length,
      }
    : { numerator: 0, denominator: 0 };

  const previousCount = config.numeratorFilter
    ? {
        numerator: isLeadMetric
          ? (metricKey === "conversion_rate" ? (previousStats?.rented ?? 0) : metricKey === "comment_rate" ? (previousStats?.enriched ?? 0) : 0)
          : previousTasks.filter(config.numeratorFilter).length,
        denominator: isLeadMetric ? (previousStats?.total ?? 0) : previousTasks.length,
      }
    : { numerator: 0, denominator: 0 };

  const showConversionBreakdown = false;
  const conversionBreakdown = { rows: [], zoneBenchmark: null };

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
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--neutral-200)] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-[var(--hertz-black)]">{config.label}</h3>
            <p className="text-xs text-[var(--neutral-600)] mt-0.5">{config.description}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--neutral-100)] text-[var(--neutral-600)] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-auto flex-1">
          {/* Comparison summary */}
          <ComparisonCards
            config={config}
            currentValue={currentValue}
            previousValue={previousValue}
            currentRange={dateRange}
            previousRange={comparisonRange}
            currentCount={currentCount}
            previousCount={previousCount}
          />

          {/* Conversion breakdown (conversion_rate only) */}
          {showConversionBreakdown && (
            <div className="mb-5">
              <p className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wide mb-3">
                Breakdown by group
              </p>
              <div className="flex flex-wrap items-center gap-4 mb-3">
                <GroupBySelector
                  primary={groupByPrimary}
                  secondary={groupBySecondary}
                  onPrimaryChange={(v) => {
                    setGroupByPrimary(v);
                    if (!v) setGroupBySecondary(null);
                  }}
                  onSecondaryChange={setGroupBySecondary}
                />
                <label className="flex items-center gap-2 text-sm text-[var(--neutral-600)]">
                  <input
                    type="checkbox"
                    checked={showBenchmarks}
                    onChange={(e) => setShowBenchmarks(e.target.checked)}
                    className="rounded border-[var(--neutral-300)]"
                  />
                  Show zone benchmarks
                </label>
              </div>
              <ConversionBreakdownTable
                rows={conversionBreakdown.rows}
                zoneBenchmark={conversionBreakdown.zoneBenchmark}
                showBenchmarks={showBenchmarks}
                groupByPrimary={groupByPrimary}
              />
            </div>
          )}

          {/* Weekly breakdown */}
          {(chartData ?? []).length > 0 && metricKey === "conversion_rate" && (
            <WeeklyBreakdownTable rows={chartData} />
          )}
          {(chartData ?? []).length > 0 && metricKey === "comment_rate" && (
            <BmCommentRateBreakdownTable rows={chartData} />
          )}
          {(chartData ?? []).length > 0 && metricKey === "contacted_within_30_min" && (
            <BmContactedWithin30BreakdownTable rows={chartData} />
          )}
          {(chartData ?? []).length > 0 && metricKey === "branch_vs_hrd_split" && (
            <BmBranchContactBreakdownTable rows={chartData} />
          )}
          {(chartData ?? []).length > 0 && metricKey === "cancelled_unreviewed" && (
            <BmCancelledUnreviewedBreakdownTable rows={chartData} />
          )}
          {(chartData ?? []).length > 0 && metricKey === "unused_overdue" && (
            <BmUnusedOverdueBreakdownTable rows={chartData} />
          )}

          {/* Tab selector */}
          <div className="flex items-center gap-1 mb-4">
            <button
              onClick={() => setActiveTab("current")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "current"
                  ? "bg-[var(--hertz-primary)] text-[var(--hertz-black)]"
                  : "bg-[var(--neutral-50)] text-[var(--neutral-600)] hover:bg-[var(--neutral-100)]"
              }`}
            >
              Current Period ({isLeadMetric ? currentLeadsPage.total : currentDisplayData.length} {isLeadMetric ? "leads" : "tasks"})
            </button>
            <button
              onClick={() => setActiveTab("previous")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "previous"
                  ? "bg-[var(--hertz-primary)] text-[var(--hertz-black)]"
                  : "bg-[var(--neutral-50)] text-[var(--neutral-600)] hover:bg-[var(--neutral-100)]"
              }`}
            >
              Previous Period ({isLeadMetric ? previousLeadsPage.total : previousDisplayData.length} {isLeadMetric ? "leads" : "tasks"})
            </button>
          </div>

          {/* Data table */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {isLeadMetric && ((activeTab === "current" && currentLeadsPage.loading) || (activeTab === "previous" && previousLeadsPage.loading)) ? (
                <div className="border border-[var(--neutral-200)] rounded-lg p-6 text-sm text-[var(--neutral-600)]">
                  Loading leads...
                </div>
              ) : isLeadMetric ? (
                <LeadTable leads={activeData} config={config} allLeads={[]} onLeadClick={onLeadClick} />
              ) : (
                <TaskTable tasks={activeData} config={config} allLeads={[]} />
              )}
            </motion.div>
          </AnimatePresence>
          {isLeadMetric && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-[var(--neutral-500)]">
                {activeTab === "current"
                  ? `Showing ${currentLeadsPage.items.length} of ${currentLeadsPage.total}`
                  : `Showing ${previousLeadsPage.items.length} of ${previousLeadsPage.total}`}
              </span>
              {(activeTab === "current" ? currentLeadsPage.hasNext : previousLeadsPage.hasNext) && (
                <button
                  type="button"
                  onClick={() =>
                    activeTab === "current"
                      ? setCurrentLimit(currentLeadsPage.total)
                      : setPreviousLimit(previousLeadsPage.total)
                  }
                  disabled={activeTab === "current" ? currentLeadsPage.loading : previousLeadsPage.loading}
                  className="text-xs font-medium text-[var(--hertz-primary)] hover:underline disabled:opacity-40"
                >
                  {(activeTab === "current" ? currentLeadsPage.loading : previousLeadsPage.loading)
                    ? "Loading…"
                    : `View all ${activeTab === "current" ? currentLeadsPage.total : previousLeadsPage.total} rows`}
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
