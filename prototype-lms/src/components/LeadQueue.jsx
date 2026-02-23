import { motion } from "framer-motion";
import StatusBadge from "./StatusBadge";

export default function LeadQueue({
  leads,
  highlightId = null,
  enrichedIds = [],
  bannerCount = null,
  onLeadClick = null,
}) {
  return (
    <div>
      {bannerCount !== null && bannerCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-[#1A1A1A]"
        >
          <span className="font-semibold text-[#F5C400]">{bannerCount}</span> lead{bannerCount !== 1 ? "s" : ""} need enrichment
        </motion.div>
      )}

      <div className="border border-[#E6E6E6] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-[#6E6E6E] uppercase tracking-wide">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Reservation ID</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Days Open</th>
              <th className="px-4 py-3">Time to 1st Contact</th>
              <th className="px-4 py-3">Last Activity</th>
              <th className="px-4 py-3">Enrichment</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, i) => {
              const isHighlighted = lead.id === highlightId;
              const isEnriched = enrichedIds.includes(lead.id) || lead.enrichmentComplete;
              return (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    backgroundColor: isHighlighted ? "#FFF9E0" : "transparent",
                  }}
                  transition={{ delay: i * 0.05 }}
                  className={`border-t border-[#E6E6E6] ${
                    onLeadClick ? "cursor-pointer hover:bg-gray-50" : ""
                  } ${isHighlighted ? "ring-2 ring-[#F5C400] ring-inset" : ""}`}
                  onClick={() => onLeadClick?.(lead)}
                >
                  <td className="px-4 py-3 font-medium text-[#1A1A1A]">{lead.customer}</td>
                  <td className="px-4 py-3 text-[#6E6E6E] font-mono text-xs">{lead.reservationId}</td>
                  <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                  <td className="px-4 py-3">{lead.daysOpen}</td>
                  <td className="px-4 py-3">{lead.timeToFirstContact}</td>
                  <td className="px-4 py-3 text-[#6E6E6E]">{lead.lastActivity}</td>
                  <td className="px-4 py-3">
                    {isEnriched ? (
                      <span className="text-[#2E7D32]">✓</span>
                    ) : (
                      <span className="text-[#C62828]">—</span>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
