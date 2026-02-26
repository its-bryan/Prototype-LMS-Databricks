import { motion } from "framer-motion";

const typeColors = {
  system: "#6E6E6E",
  contact: "#F5C400",
};

export default function TranslogTimeline({ events, animate = true }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-[#6E6E6E] uppercase tracking-wide mb-2">
        TRANSLOG Activity
      </h3>
      {events.length === 0 ? (
        <p className="text-sm text-[#C62828] italic">No activity recorded</p>
      ) : (
        events.map((ev, i) => (
          <motion.div
            key={i}
            initial={animate ? { opacity: 0, x: -10 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
            className="flex gap-3 items-start"
          >
            <div className="flex flex-col items-center">
              <div
                className="w-2.5 h-2.5 rounded-full mt-1"
                style={{ backgroundColor: typeColors[ev.type] || "#6E6E6E" }}
              />
              {i < events.length - 1 && <div className="w-px h-6 bg-[#E6E6E6]" />}
            </div>
            <div>
              <p className="text-sm text-[#1A1A1A]">{ev.event}</p>
              <p className="text-xs text-[#6E6E6E]">{ev.time}</p>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
}
