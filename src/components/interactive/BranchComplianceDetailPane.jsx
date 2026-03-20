/**
 * Branch Compliance Detail — Slide-in pane showing line-level lead data
 * for each metric in the Branch Compliance table (Meeting Prep).
 */
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import StatusBadge from "../StatusBadge";
import {
  leadCancelledWithoutBmComment,
  leadUnusedWithoutBmTouchInPeriod,
  leadBranchMatches,
} from "../../selectors/demoSelectors";
import { useData } from "../../context/DataContext";
import { formatDateRange, formatDateShort } from "../../utils/dateTime";

function formatDateRangeDisplay(dateRange) {
  return formatDateRange(dateRange?.start, dateRange?.end) || "";
}

function buildMetricSections(dateRange) {
  const start = dateRange?.start ?? null;
  const end = dateRange?.end ?? null;
  return [
    {
      key: "cancelledNoBmComment",
      label: "Cancelled — no BM comment",
      description: "Cancelled leads with no branch manager reason or notes (any week)",
      filter: leadCancelledWithoutBmComment,
    },
    {
      key: "unusedNoBmThisPeriod",
      label: "Unused — no BM activity in period",
      description:
        "Unused leads with no enrichment activity in the selected date range (e.g. this week). Change the date preset above to match your compliance window.",
      filter: (l) => leadUnusedWithoutBmTouchInPeriod(l, start, end),
    },
    {
      key: "mismatch",
      label: "Data Mismatches",
      description: "Leads with HLES vs LMS data discrepancies",
      filter: (l) => !!l.mismatch,
    },
  ];
}

function LeadTable({ leads, onLeadClick }) {
  return (
    <div className="border border-[var(--neutral-200)] rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-[40vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--hertz-black)] text-white text-xs font-semibold uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-center">Confirmation #</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-left">Cancel Reason</th>
              <th className="px-4 py-3 text-left">Comments</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--neutral-500)]">
                  No leads in this category
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => onLeadClick?.(lead)}
                  className={`border-t border-[var(--neutral-100)] transition-colors ${
                    onLeadClick ? "cursor-pointer hover:bg-[var(--neutral-50)]" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-[var(--neutral-600)] text-xs">
                    {lead.initDtFinal ? formatDateShort(new Date(lead.initDtFinal + "T12:00:00")) : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--hertz-black)]">{lead.customer ?? "—"}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-[var(--neutral-600)]">
                    {lead.reservationId ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--neutral-600)] max-w-[150px] truncate">
                    {lead.hlesReason ?? lead.enrichment?.reason ?? "—"}
                  </td>
                  <td
                    className="px-4 py-3 text-[var(--neutral-600)] max-w-[180px] truncate"
                    title={lead.enrichment?.reason ?? lead.enrichment?.notes ?? ""}
                  >
                    {lead.enrichment?.reason ?? lead.enrichment?.notes ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BranchComplianceDetailPane({ branchRow, dateRange, leads = [], onClose }) {
  const navigate = useNavigate();
  const { orgMapping } = useData();
  const [activeTab, setActiveTab] = useState("cancelledNoBmComment");

  const branchLeadsAll = useMemo(
    () => (leads ?? []).filter((l) => leadBranchMatches(l.branch, branchRow?.branch)),
    [leads, branchRow?.branch]
  );

  const sectionData = useMemo(() => {
    if (branchRow?.cancelledNoBmCommentLeads || branchRow?.unusedNoBmThisPeriodLeads || branchRow?.mismatchLeads) {
      return [
        {
          key: "cancelledNoBmComment",
          label: "Cancelled — no BM comment",
          description: "Cancelled leads with no branch manager reason or notes (any week)",
          leads: branchRow.cancelledNoBmCommentLeads ?? [],
          count: (branchRow.cancelledNoBmCommentLeads ?? []).length,
        },
        {
          key: "unusedNoBmThisPeriod",
          label: "Unused — no BM activity in period",
          description:
            "Unused leads with no enrichment activity in the selected date range (e.g. this week). Change the date preset above to match your compliance window.",
          leads: branchRow.unusedNoBmThisPeriodLeads ?? [],
          count: (branchRow.unusedNoBmThisPeriodLeads ?? []).length,
        },
        {
          key: "mismatch",
          label: "Data Mismatches",
          description: "Leads with HLES vs LMS data discrepancies",
          leads: branchRow.mismatchLeads ?? [],
          count: (branchRow.mismatchLeads ?? []).length,
        },
      ];
    }
    const sections = buildMetricSections(dateRange);
    return sections.map((s) => ({
      ...s,
      leads: branchLeadsAll.filter(s.filter),
      count: branchLeadsAll.filter(s.filter).length,
    }));
  }, [branchLeadsAll, dateRange, branchRow]);

  const zone = useMemo(() => {
    const norm = (s) => (s == null ? "" : String(s).trim().replace(/\s+/g, " "));
    const row = (orgMapping ?? []).find((r) => norm(r.branch) === norm(branchRow?.branch));
    return row?.zone ?? "—";
  }, [branchRow?.branch, orgMapping]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleLeadClick = (lead) => {
    onClose();
    navigate(`/gm/leads/${lead.id}`);
  };

  if (!branchRow) return null;

  const activeSection = sectionData.find((s) => s.key === activeTab);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex justify-end"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="absolute inset-0 bg-black/20" onClick={onClose} aria-hidden />

        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative w-full max-w-4xl bg-white shadow-xl overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-white border-b border-[var(--neutral-200)] px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-lg font-semibold text-[var(--hertz-black)]">
                {branchRow.branch} — Line-level data
              </h2>
              <p className="text-xs text-[var(--neutral-600)] mt-0.5">
                {branchRow.bmName} · {zone} · {formatDateRangeDisplay(dateRange)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-[var(--neutral-100)] text-[var(--neutral-600)]"
              aria-label="Close panel"
            >
              ✕
            </button>
          </div>

          <div className="p-6">
            {/* Metric tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {sectionData.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setActiveTab(s.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                    activeTab === s.key
                      ? "bg-[var(--hertz-black)] text-white"
                      : "bg-[var(--neutral-100)] text-[var(--neutral-600)] hover:bg-[var(--neutral-200)]"
                  }`}
                >
                  {s.label}
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${
                      s.count > 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-[var(--neutral-200)] text-[var(--neutral-500)]"
                    }`}
                  >
                    {s.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Active section content */}
            {activeSection && (
              <div>
                <h3 className="text-sm font-bold text-[var(--hertz-black)] mb-1">
                  {activeSection.label}
                </h3>
                <p className="text-xs text-[var(--neutral-600)] mb-4">{activeSection.description}</p>
                <LeadTable leads={activeSection.leads} onLeadClick={handleLeadClick} />
                {activeSection.leads.length > 0 && (
                  <p className="text-xs text-[var(--neutral-500)] mt-2">
                    Click a row to view lead details
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
