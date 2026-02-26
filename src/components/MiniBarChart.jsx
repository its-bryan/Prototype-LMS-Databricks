import { motion } from "framer-motion";

export default function MiniBarChart({ data, labels, color, label, suffix = "" }) {
  const max = Math.max(...data);
  const current = data[data.length - 1];
  const prior = data[data.length - 2];
  const delta = prior !== 0 ? Math.round(((current - prior) / prior) * 100) : 0;
  const deltaUp = delta > 0;
  const deltaFlat = delta === 0;

  return (
    <div className="border border-[#E6E6E6] rounded-lg p-4">
      <p className="text-xs text-[#6E6E6E] uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-bold" style={{ color }}>
          {current}{suffix}
        </span>
        {!deltaFlat && (
          <span className={`text-xs font-medium ${deltaUp ? "text-[#2E7D32]" : "text-[#C62828]"}`}>
            {deltaUp ? "↑" : "↓"}{Math.abs(delta)}%
          </span>
        )}
        {deltaFlat && (
          <span className="text-xs font-medium text-[#6E6E6E]">—</span>
        )}
      </div>
      <div className="flex items-end gap-1.5" style={{ height: 48 }}>
        {data.map((value, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: max > 0 ? `${(value / max) * 100}%` : "0%" }}
            transition={{ delay: i * 0.1, duration: 0.4, ease: "easeOut" }}
            className="flex-1 rounded-sm"
            style={{ backgroundColor: color, opacity: i === data.length - 1 ? 1 : 0.5 }}
          />
        ))}
      </div>
      <div className="flex gap-1.5 mt-1">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 text-center text-[10px] text-[#6E6E6E]">{l}</span>
        ))}
      </div>
    </div>
  );
}
