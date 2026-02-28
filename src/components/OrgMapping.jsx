import { motion } from "framer-motion";

export default function OrgMapping({ rows, editingRow = null, editedValue = null, missingRows = [] }) {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="border border-[#E6E6E6] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-[#6E6E6E] uppercase tracking-wide">
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
                  className={`border-t border-[#E6E6E6] ${
                    isEditing ? "bg-amber-50" : isMissing ? "bg-red-50" : ""
                  }`}
                >
                  <td className="px-4 py-2.5">{row.bm}</td>
                  <td className="px-4 py-2.5">{row.branch}</td>
                  <td className="px-4 py-2.5">
                    {isEditing ? (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="inline-flex items-center border border-[#FFD100] rounded px-2 py-0.5 bg-white"
                      >
                        {editedValue}
                        <span className="ml-1 text-[#FFD100]">▾</span>
                      </motion.span>
                    ) : isMissing && !row.gm ? (
                      <span className="text-[#C62828] italic">— Missing —</span>
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
        <button className="px-4 py-2 bg-[#FFD100] text-[#1A1A1A] rounded text-sm font-medium">
          Confirm Mapping
        </button>
      </motion.div>
    </div>
  );
}
