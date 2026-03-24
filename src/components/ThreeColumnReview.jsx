import { motion } from "framer-motion";
import StatusBadge from "./StatusBadge";
import TranslogTimeline from "./TranslogTimeline";
import { getMismatchReason } from "../selectors/demoSelectors";

export default function ThreeColumnReview({ lead, showMismatchWarning = false }) {
  const mismatchReason = getMismatchReason(lead);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-[var(--hertz-black)]">{lead.customer}</h2>
        <StatusBadge status={lead.status} />
        <span className="text-sm text-[var(--neutral-600)] font-mono">{lead.reservationId}</span>
        {lead.bmName && <span className="text-sm text-[var(--neutral-600)]">• {lead.bmName}</span>}
      </div>

      {showMismatchWarning && mismatchReason && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="px-4 py-3 bg-[var(--color-warning-light)] border border-[var(--color-warning)]/40 rounded-lg text-sm flex items-start gap-3"
        >
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-[var(--color-warning)] text-lg shrink-0"
          >
            ⚠
          </motion.span>
          <div>
            <p className="font-medium text-[var(--color-warning)]">Data mismatch — needs review</p>
            <p className="text-[var(--color-warning)] mt-0.5">{mismatchReason}</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-3 gap-6 mt-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="border border-[var(--neutral-200)] rounded-lg p-4"
        >
          <h3 className="text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wide mb-3">
            HLES Reason
          </h3>
          <p className="text-sm font-medium text-[var(--color-error)]">{lead.hlesReason || "—"}</p>
          <div className="mt-3 text-xs text-[var(--neutral-600)] space-y-1">
            <p>Time to 1st contact: {lead.timeToFirstContact}</p>
            {lead.timeToCancel && <p>Time to cancellation: {lead.timeToCancel}</p>}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="border border-[var(--neutral-200)] rounded-lg p-4"
        >
          <TranslogTimeline events={lead.translog} enrichmentLog={lead.enrichmentLog} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="border border-[var(--neutral-200)] rounded-lg p-4"
        >
          <h3 className="text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wide mb-3">
            BM Comments
          </h3>
          {lead.enrichment?.reason ? (
            <div className="space-y-2 text-sm">
              <p><span className="text-[var(--neutral-600)]">Reason:</span> {lead.enrichment.reason}</p>
              {lead.enrichment.notes && (
                <p><span className="text-[var(--neutral-600)]">Notes:</span> {lead.enrichment.notes}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--neutral-600)] italic">No comments recorded</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
