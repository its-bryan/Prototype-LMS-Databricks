import { motion } from "framer-motion";

export default function OrgMapping({ rows, editingRow = null, editedValue = null, missingRows = [] }) {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="border border-[var(--neutral-200)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--hertz-black)] text-left text-xs text-white font-semibold uppercase tracking-wider">
              <th className="px-4 py-3">Branch Manager</th>
              <th className="px-4 py-3">Branch Location</th>
              <th className="px-4 py-3">General Manager</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isMissing = missingRows.includes(i);
              const isEditing = editingRow === i;
              return (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className={`border-t border-[var(--neutral-200)] ${
                    isEditing ? "bg-[var(--color-warning-light)]" : isMissing ? "bg-[var(--color-error-light)]" : ""
                  }`}
                >
                  <td className="px-4 py-2.5">{row.bm}</td>
                  <td className="px-4 py-2.5">{row.branch}</td>
                  <td className="px-4 py-2.5">
                    {isEditing ? (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="inline-flex items-center border border-[var(--hertz-primary)] rounded px-2 py-0.5 bg-white"
                      >
                        {editedValue}
                        <span className="ml-1 text-[var(--hertz-primary)]">▾</span>
                      </motion.span>
                    ) : isMissing && !row.gm ? (
                      <span className="text-[var(--color-error)] italic">— Missing —</span>
                    ) : (
                      row.gm
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex justify-end"
      >
        <button className="px-4 py-2 bg-[var(--hertz-primary)] text-[var(--hertz-black)] rounded text-sm font-medium">
          Confirm Mapping
        </button>
      </motion.div>
    </div>
  );
}
