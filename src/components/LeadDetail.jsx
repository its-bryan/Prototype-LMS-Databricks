import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StatusBadge from "./StatusBadge";
import TranslogTimeline from "./TranslogTimeline";
import { getHierarchyForBranch, getMismatchReason } from "../selectors/demoSelectors";

export default function LeadDetail({ lead, enrichmentSlot, contactSlot, contactButtonsSlot, tasksSlot, upcomingCommsSlot, contactActivities = [], translogEvents = [], userRole = "bm" }) {
  const hierarchy = getHierarchyForBranch(lead.branch);
  const mismatchReason = getMismatchReason(lead);
  const [translogExpanded, setTranslogExpanded] = useState(false);

  // Prefer translogEvents from the dedicated table; fall back to legacy lead.translog JSONB
  const resolvedTranslog = translogEvents.length > 0 ? translogEvents : (lead.translog ?? []);
  const hasActivity = resolvedTranslog.length > 0 || (lead.enrichmentLog?.length ?? 0) > 0 || (contactActivities?.length ?? 0) > 0;
  const activityCount = resolvedTranslog.length + (lead.enrichmentLog?.length ?? 0) + (contactActivities?.length ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className="grid grid-cols-2 gap-8 h-full"
    >
      <div className="space-y-6">
        {lead.mismatch && mismatchReason && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 px-4 py-3 bg-[var(--color-warning-light)] border border-[var(--color-warning)]/40 rounded-lg"
          >
            <span className="text-[var(--color-warning)] text-lg shrink-0" aria-hidden>⚠</span>
            <div>
              <p className="font-medium text-[var(--hertz-black)] text-sm">Data mismatch — needs review</p>
              <p className="text-[var(--neutral-700)] text-sm mt-0.5">{mismatchReason}</p>
            </div>
          </motion.div>
        )}

        {/* Lead header */}
        <div className="rounded-lg border border-[var(--neutral-200)] bg-[var(--hertz-white)] p-5">
          <h2 className="text-2xl font-bold text-[var(--hertz-black)]">{lead.customer}</h2>
          <p className="text-sm text-[var(--neutral-600)] font-mono mt-0.5">{lead.reservationId}</p>
        </div>

        {hierarchy && (
          <div className="flex items-center gap-2 text-xs text-[var(--neutral-600)] bg-[var(--hertz-white)] rounded-lg border border-[var(--neutral-200)] px-3 py-2">
            <span><span className="font-medium text-[var(--hertz-black)]">BM</span> {hierarchy.bm}</span>
            <span className="text-[var(--neutral-200)]">→</span>
            <span><span className="font-medium text-[var(--hertz-black)]">AM</span> {hierarchy.am}</span>
            <span className="text-[var(--neutral-200)]">→</span>
            <span><span className="font-medium text-[var(--hertz-black)]">GM</span> {hierarchy.gm}</span>
            <span className="text-[var(--neutral-200)]">→</span>
            <span><span className="font-medium text-[var(--hertz-black)]">Zone</span> {hierarchy.zone}</span>
          </div>
        )}

        {/* Lead Details */}
        <div className="rounded-lg border border-[var(--neutral-200)] bg-[var(--hertz-white)] p-5">
          <h3 className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wider mb-3">Lead Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[var(--neutral-600)] text-xs uppercase">Status</p>
              <StatusBadge status={lead.status} />
            </div>
            <div>
              <p className="text-[var(--neutral-600)] text-xs uppercase">Branch</p>
              <p className="font-medium">{lead.branch ?? "—"}</p>
            </div>
            <div>
              <p className="text-[var(--neutral-600)] text-xs uppercase">Branch Manager</p>
              <p className="font-medium">{lead.bmName ?? "—"}</p>
            </div>
            <div>
              <p className="text-[var(--neutral-600)] text-xs uppercase">Insurance Company</p>
              <p className="font-medium">{lead.insuranceCompany ?? "—"}</p>
            </div>
            <div>
              <p className="text-[var(--neutral-600)] text-xs uppercase">Time to 1st Contact</p>
              <div className="flex items-center gap-2">
                <p className="font-medium">{lead.timeToFirstContact ?? "—"}</p>
                {lead.firstContactBy && lead.firstContactBy !== "none" && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    lead.firstContactBy === "branch"
                      ? "bg-[var(--color-success-light)] text-[var(--color-success)] border border-[var(--color-success)]/40"
                      : "bg-[var(--color-error-light)] text-[var(--color-error)] border border-[var(--color-error)]/40"
                  }`}>
                    {lead.firstContactBy === "branch" ? "Branch" : "HRD"}
                  </span>
                )}
              </div>
            </div>
            {lead.mmr && (
              <div>
                <p className="text-[var(--neutral-600)] text-xs uppercase">MMR</p>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                  lead.mmr.toUpperCase() === "Y"
                    ? "bg-[var(--color-success-light)] text-[var(--color-success)] border-[var(--color-success)]/40"
                    : "bg-[var(--neutral-100)] text-[var(--neutral-600)] border-[var(--neutral-200)]"
                }`}>
                  {lead.mmr.toUpperCase() === "Y" ? "MMR Completed" : lead.mmr}
                </span>
              </div>
            )}
            {lead.timeToCancel && (
              <div>
                <p className="text-[var(--neutral-600)] text-xs uppercase">Time to Cancellation</p>
                <p className="font-medium">{lead.timeToCancel}</p>
              </div>
            )}
            {lead.gmDirective && (
              <div className="col-span-2">
                <p className="text-[var(--neutral-600)] text-xs uppercase">GM Directive</p>
                <p className="font-medium text-[var(--hertz-black)]">{lead.gmDirective}</p>
              </div>
            )}
            {lead.hlesReason && (
              <div className="col-span-2">
                <p className="text-[var(--neutral-600)] text-xs uppercase">HLES Cancellation Reason</p>
                <p className="font-medium text-[var(--color-error)]">{lead.hlesReason}</p>
              </div>
            )}
            {lead.archived && (
              <div className="col-span-2 flex flex-wrap gap-2">
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--neutral-100)] text-[var(--neutral-600)] border border-[var(--neutral-200)]">
                  Archived
                </span>
              </div>
            )}
          </div>
          {/* Contact Details — same cluster as Lead Details */}
          {(contactSlot ?? true) && (
            <div className="mt-4 pt-4 border-t border-[var(--neutral-200)]">
              {contactSlot ?? (
                <div>
                  <h3 className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wider mb-3">Contact Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[var(--neutral-600)] text-xs uppercase">Email</p>
                      <p className="font-medium truncate" title={lead.email ?? undefined}>{lead.email ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[var(--neutral-600)] text-xs uppercase">Phone</p>
                      <p className="font-medium">{lead.phone ?? "—"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* TRANSLOG Activity — collapsible */}
        <div className="rounded-lg border border-[var(--neutral-200)] bg-[var(--hertz-white)] overflow-hidden">
          <button
            type="button"
            onClick={() => setTranslogExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-[var(--neutral-50)] transition-colors cursor-pointer"
            aria-expanded={translogExpanded}
          >
            <span className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wider">TRANSLOG Activity</span>
            <span className="flex items-center gap-2 text-xs text-[var(--neutral-600)]">
              {hasActivity && <span className="font-medium">{activityCount} event{activityCount !== 1 ? "s" : ""}</span>}
              <svg
                className={`w-4 h-4 text-[var(--neutral-500)] transition-transform ${translogExpanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </button>
          <AnimatePresence>
            {translogExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 pt-1 border-t border-[var(--neutral-200)]">
                  <TranslogTimeline events={resolvedTranslog} enrichmentLog={lead.enrichmentLog} contactActivities={contactActivities} showHeader={false} userRole={userRole} rentLoc={lead.rentLoc} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right column — visual clusters for Contact, Tasks, Comments */}
      <div className="border-l border-[var(--neutral-200)] pl-8 space-y-6">
        {upcomingCommsSlot && (
          <div className="rounded-lg border border-[var(--neutral-200)] bg-[var(--hertz-white)] p-5 border-l-[3px] border-l-[var(--hertz-primary)]">
            {upcomingCommsSlot}
          </div>
        )}
        {contactButtonsSlot && (
          <div className="rounded-lg border border-[var(--neutral-200)] bg-[var(--hertz-white)] p-5">
            <h3 className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wider mb-3">Contact Customer</h3>
            {contactButtonsSlot}
          </div>
        )}
        {tasksSlot && (
          <div className="rounded-lg border border-[var(--neutral-200)] bg-[var(--hertz-white)] p-5">
            {tasksSlot}
          </div>
        )}
        <div className="rounded-lg border border-[var(--neutral-200)] bg-[var(--hertz-white)] p-5">
          {enrichmentSlot}
        </div>
      </div>
    </motion.div>
  );
}
