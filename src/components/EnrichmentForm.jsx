import { motion } from "framer-motion";

export default function EnrichmentForm({
  reason = null,
  notes = null,
  nextAction = null,
  followUpDate = null,
  gmDirective = null,
  showSaved = false,
  animateFields = false,
}) {
  const delay = animateFields ? 0.3 : 0;

  return (
    <div className="space-y-5">
      <motion.div
        initial={animateFields ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: delay * 1 }}
      >
        <label className="text-xs text-[#6E6E6E] uppercase tracking-wide block mb-1">
          Cancellation Reason
        </label>
        <div className="border border-[#E6E6E6] rounded px-3 py-2 text-sm bg-white">
          {reason || <span className="text-[#E6E6E6]">Select a reason...</span>}
        </div>
      </motion.div>

      <motion.div
        initial={animateFields ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: delay * 2 }}
      >
        <label className="text-xs text-[#6E6E6E] uppercase tracking-wide block mb-1">
          Next Action
        </label>
        <div className="border border-[#E6E6E6] rounded px-3 py-2 text-sm bg-white">
          {nextAction || <span className="text-[#E6E6E6]">Select next action...</span>}
        </div>
      </motion.div>

      <motion.div
        initial={animateFields ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: delay * 3 }}
      >
        <label className="text-xs text-[#6E6E6E] uppercase tracking-wide block mb-1">
          Follow-up Date
        </label>
        <div className="border border-[#E6E6E6] rounded px-3 py-2 text-sm bg-white">
          {followUpDate || <span className="text-[#E6E6E6]">Select date...</span>}
        </div>
      </motion.div>

      <motion.div
        initial={animateFields ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: delay * 4 }}
      >
        <label className="text-xs text-[#6E6E6E] uppercase tracking-wide block mb-1">
          Notes
        </label>
        <div className="border border-[#E6E6E6] rounded px-3 py-2 text-sm bg-white min-h-[60px]">
          {notes || <span className="text-[#E6E6E6]">Add notes...</span>}
        </div>
      </motion.div>

      {gmDirective && (
        <motion.div
          initial={animateFields ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ delay: delay * 5 }}
        >
          <label className="text-xs text-[#6E6E6E] uppercase tracking-wide block mb-1">
            GM Directive
          </label>
          <div className="border border-[#FFD100] bg-amber-50 rounded px-3 py-2 text-sm">
            {gmDirective}
          </div>
        </motion.div>
      )}

      {showSaved && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 text-[#2E7D32] text-sm font-medium"
        >
          <span className="text-lg">✓</span> Saved
        </motion.div>
      )}
    </div>
  );
}
