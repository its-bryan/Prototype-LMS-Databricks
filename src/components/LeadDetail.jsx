import { motion } from "framer-motion";
import StatusBadge from "./StatusBadge";
import TranslogTimeline from "./TranslogTimeline";
import { getHierarchyForBranch, getMismatchReason } from "../selectors/demoSelectors";

export default function LeadDetail({ lead, enrichmentSlot, contactSlot, contactButtonsSlot, tasksSlot, contactActivities = [] }) {
  const hierarchy = getHierarchyForBranch(lead.branch);
  const mismatchReason = getMismatchReason(lead);

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className="grid grid-cols-2 gap-8 h-full"
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">{lead.customer}</h2>
          <p className="text-sm text-[#6E6E6E] font-mono">{lead.reservationId}</p>
        </div>

        {lead.mismatch && mismatchReason && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg"
          >
            <span className="text-amber-600 text-lg shrink-0" aria-hidden>⚠</span>
            <div>
              <p className="font-medium text-amber-900 text-sm">Data mismatch — needs review</p>
              <p className="text-amber-800 text-sm mt-0.5">{mismatchReason}</p>
            </div>
          </motion.div>
        )}

        {hierarchy && (
          <div className="flex items-center gap-2 text-xs text-[#6E6E6E] bg-gray-50 rounded px-3 py-2">
            <span><span className="font-medium text-[#1A1A1A]">BM</span> {hierarchy.bm}</span>
            <span className="text-[#E6E6E6]">→</span>
            <span><span className="font-medium text-[#1A1A1A]">AM</span> {hierarchy.am}</span>
            <span className="text-[#E6E6E6]">→</span>
            <span><span className="font-medium text-[#1A1A1A]">GM</span> {hierarchy.gm}</span>
            <span className="text-[#E6E6E6]">→</span>
            <span><span className="font-medium text-[#1A1A1A]">Zone</span> {hierarchy.zone}</span>
          </div>
        )}

        {/* Lead Details */}
        <div>
          <h3 className="text-xs font-bold text-[#6E6E6E] uppercase tracking-wider mb-3">Lead Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[#6E6E6E] text-xs uppercase">Status</p>
              <StatusBadge status={lead.status} />
            </div>
            <div>
              <p className="text-[#6E6E6E] text-xs uppercase">Branch</p>
              <p className="font-medium">{lead.branch ?? "—"}</p>
            </div>
            <div>
              <p className="text-[#6E6E6E] text-xs uppercase">Branch Manager</p>
              <p className="font-medium">{lead.bmName ?? "—"}</p>
            </div>
            <div>
              <p className="text-[#6E6E6E] text-xs uppercase">Insurance Company</p>
              <p className="font-medium">{lead.insuranceCompany ?? "—"}</p>
            </div>
            <div>
              <p className="text-[#6E6E6E] text-xs uppercase">Days Open</p>
              <p className="font-medium">{lead.daysOpen ?? "—"}</p>
            </div>
            <div>
              <p className="text-[#6E6E6E] text-xs uppercase">Time to 1st Contact</p>
              <div className="flex items-center gap-2">
                <p className="font-medium">{lead.timeToFirstContact ?? "—"}</p>
                {lead.firstContactBy && lead.firstContactBy !== "none" && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    lead.firstContactBy === "branch"
                      ? "bg-green-50 text-[#2E7D32] border border-green-200"
                      : "bg-red-50 text-[#C62828] border border-red-200"
                  }`}>
                    {lead.firstContactBy === "branch" ? "Branch" : "HRD"}
                  </span>
                )}
              </div>
            </div>
            {lead.timeToCancel && (
              <div>
                <p className="text-[#6E6E6E] text-xs uppercase">Time to Cancellation</p>
                <p className="font-medium">{lead.timeToCancel}</p>
              </div>
            )}
            {lead.gmDirective && (
              <div className="col-span-2">
                <p className="text-[#6E6E6E] text-xs uppercase">GM Directive</p>
                <p className="font-medium text-[var(--hertz-black)]">{lead.gmDirective}</p>
              </div>
            )}
            {lead.hlesReason && (
              <div className="col-span-2">
                <p className="text-[#6E6E6E] text-xs uppercase">HLES Cancellation Reason</p>
                <p className="font-medium text-[#C62828]">{lead.hlesReason}</p>
              </div>
            )}
            {(lead.archived || lead.enrichmentComplete) && (
              <div className="col-span-2 flex flex-wrap gap-2">
                {lead.archived && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--neutral-100)] text-[var(--neutral-600)]">
                    Archived
                  </span>
                )}
                {lead.enrichmentComplete && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-50 text-[#2E7D32] border border-green-200">
                    Enrichment complete
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Contact Details — contactSlot renders full section with pencil edit; fallback for walkthroughs */}
        <div>
          {contactSlot ?? (
            <div>
              <h3 className="text-xs font-bold text-[#6E6E6E] uppercase tracking-wider mb-3">Contact Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#6E6E6E] text-xs uppercase">Email</p>
                  <p className="font-medium truncate" title={lead.email ?? undefined}>{lead.email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[#6E6E6E] text-xs uppercase">Phone</p>
                  <p className="font-medium">{lead.phone ?? "—"}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <TranslogTimeline events={lead.translog} enrichmentLog={lead.enrichmentLog} contactActivities={contactActivities} />
      </div>

      <div className="border-l border-[var(--neutral-200)] pl-8 space-y-8">
        {contactButtonsSlot && (
          <div>
            <h3 className="text-xs font-bold text-[#6E6E6E] uppercase tracking-wider mb-3">Contact Customer</h3>
            {contactButtonsSlot}
          </div>
        )}
        {tasksSlot && <div>{tasksSlot}</div>}
        <div>{enrichmentSlot}</div>
      </div>
    </motion.div>
  );
}
