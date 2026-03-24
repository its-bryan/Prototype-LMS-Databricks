import { motion } from "framer-motion";

export default function AdminUpload({ fileName, summary, type = "hles" }) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="border-2 border-dashed border-[var(--neutral-200)] rounded-lg p-8 text-center">
        <p className="text-[var(--neutral-600)] text-sm mb-2">
          {type === "hles" ? "HLES Conversion Data" : type === "translog" ? "TRANSLOG Activity Data" : "Organisation Mapping"}
        </p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 bg-[var(--neutral-50)] rounded px-4 py-2 text-sm font-mono text-[var(--hertz-black)]"
        >
          📄 {fileName}
        </motion.div>
      </div>

      <div className="h-2 bg-[var(--neutral-100)] rounded overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="h-full bg-[var(--hertz-primary)] rounded"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
        className="border border-[var(--neutral-200)] rounded-lg p-6 space-y-3"
      >
        <h3 className="font-semibold text-[var(--hertz-black)]">Validation Summary</h3>
        {summary.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-[var(--neutral-600)]">{item.label}</span>
            <span className={`font-medium ${item.color || "text-[var(--hertz-black)]"}`}>{item.value}</span>
          </div>
        ))}

        {summary.some((s) => s.expandable) && (
          <div className="mt-2 pt-2 border-t border-[var(--neutral-200)]">
            {summary
              .filter((s) => s.expandable)
              .map((s) => (
                <div key={s.label} className="text-xs text-[var(--color-error)] space-y-0.5 mt-1">
                  {s.details?.map((d, j) => <p key={j}>{d}</p>)}
                </div>
              ))}
          </div>
        )}

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="mt-4 px-4 py-2 bg-[var(--color-success)] text-white rounded text-sm font-medium"
        >
          ✓ Import Confirmed
        </motion.button>
      </motion.div>
    </div>
  );
}
