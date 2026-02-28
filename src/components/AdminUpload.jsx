import { motion } from "framer-motion";

export default function AdminUpload({ fileName, summary, type = "hles" }) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="border-2 border-dashed border-[#E6E6E6] rounded-lg p-8 text-center">
        <p className="text-[#6E6E6E] text-sm mb-2">
          {type === "hles" ? "HLES Conversion Data" : type === "translog" ? "TRANSLOG Activity Data" : "Organisation Mapping"}
        </p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 bg-gray-50 rounded px-4 py-2 text-sm font-mono text-[#1A1A1A]"
        >
          📄 {fileName}
        </motion.div>
      </div>

      <div className="h-2 bg-gray-100 rounded overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="h-full bg-[#FFD100] rounded"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
        className="border border-[#E6E6E6] rounded-lg p-6 space-y-3"
      >
        <h3 className="font-semibold text-[#1A1A1A]">Validation Summary</h3>
        {summary.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-[#6E6E6E]">{item.label}</span>
            <span className={`font-medium ${item.color || "text-[#1A1A1A]"}`}>{item.value}</span>
          </div>
        ))}

        {summary.some((s) => s.expandable) && (
          <div className="mt-2 pt-2 border-t border-[#E6E6E6]">
            {summary
              .filter((s) => s.expandable)
              .map((s) => (
                <div key={s.label} className="text-xs text-[#C62828] space-y-0.5 mt-1">
                  {s.details?.map((d, j) => <p key={j}>{d}</p>)}
                </div>
              ))}
          </div>
        )}

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="mt-4 px-4 py-2 bg-[#2E7D32] text-white rounded text-sm font-medium"
        >
          ✓ Import Confirmed
        </motion.button>
      </motion.div>
    </div>
  );
}
