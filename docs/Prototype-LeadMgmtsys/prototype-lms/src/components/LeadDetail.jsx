import { motion } from "framer-motion";
import StatusBadge from "./StatusBadge";
import TranslogTimeline from "./TranslogTimeline";

export default function LeadDetail({ lead, enrichmentSlot }) {
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

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[#6E6E6E] text-xs uppercase">Status</p>
            <StatusBadge status={lead.status} />
          </div>
          <div>
            <p className="text-[#6E6E6E] text-xs uppercase">Days Open</p>
            <p className="font-medium">{lead.daysOpen}</p>
          </div>
          <div>
            <p className="text-[#6E6E6E] text-xs uppercase">Time to 1st Contact</p>
            <p className="font-medium">{lead.timeToFirstContact}</p>
          </div>
          {lead.timeToCancel && (
            <div>
              <p className="text-[#6E6E6E] text-xs uppercase">Time to Cancellation</p>
              <p className="font-medium">{lead.timeToCancel}</p>
            </div>
          )}
          {lead.hlesReason && (
            <div className="col-span-2">
              <p className="text-[#6E6E6E] text-xs uppercase">HLES Cancellation Reason</p>
              <p className="font-medium text-[#C62828]">{lead.hlesReason}</p>
            </div>
          )}
        </div>

        <TranslogTimeline events={lead.translog} />
      </div>

      <div className="border-l border-[#E6E6E6] pl-8">
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">LMS Enrichment</h3>
        {enrichmentSlot}
      </div>
    </motion.div>
  );
}
