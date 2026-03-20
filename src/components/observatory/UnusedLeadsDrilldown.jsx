import { motion } from "framer-motion";

export default function UnusedLeadsDrilldown({
  periodLabel,
  leads,
  onClose,
  totalCount = null,
  loading = false,
  footer = null,
}) {
  const displayTotal = totalCount != null ? totalCount : leads.length;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="rounded-xl border border-[var(--neutral-200)] bg-white shadow-[var(--shadow-sm)]"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--neutral-100)]">
        <div>
          <h3 className="text-base font-semibold text-[var(--hertz-black)]">Unused Leads - {periodLabel}</h3>
          <p className="text-xs text-[var(--neutral-600)] mt-1">
            {loading ? "Loading…" : `${displayTotal} lead${displayTotal === 1 ? "" : "s"} in selected period`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-semibold rounded-md border border-[var(--neutral-200)] text-[var(--neutral-700)] hover:bg-[var(--neutral-50)]"
        >
          Close
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--hertz-black)]">
              <th className="text-left text-white text-xs font-semibold px-4 py-3">Customer</th>
              <th className="text-left text-white text-xs font-semibold px-4 py-3">Reservation ID</th>
              <th className="text-left text-white text-xs font-semibold px-4 py-3">Branch</th>
              <th className="text-left text-white text-xs font-semibold px-4 py-3">BM</th>
              <th className="text-left text-white text-xs font-semibold px-4 py-3">Days Open</th>
              <th className="text-left text-white text-xs font-semibold px-4 py-3">Insurance Company</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-10 text-center text-[var(--neutral-500)]">
                  No unused leads found for this period and filter selection.
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-[var(--neutral-100)] odd:bg-white even:bg-[var(--neutral-50)]">
                <td className="px-4 py-3 text-[var(--hertz-black)] font-medium">{lead.customer ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--neutral-600)] font-mono text-xs">{lead.reservationId ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--neutral-600)]">{lead.branch ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--neutral-600)]">{lead.bmName ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--neutral-600)]">{lead.daysOpen ?? 0}</td>
                <td className="px-4 py-3 text-[var(--neutral-600)]">{lead.insuranceCompany ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </motion.div>
  );
}
