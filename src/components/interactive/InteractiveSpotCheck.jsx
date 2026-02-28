import { useState } from "react";
import { motion } from "framer-motion";
import { useData } from "../../context/DataContext";
import { getBranches, getUntouchedLeadsForBranch } from "../../selectors/demoSelectors";
import LeadQueue from "../LeadQueue";

export default function InteractiveSpotCheck() {
  const { leads } = useData();
  const branches = getBranches(leads);
  const [selectedBranch, setSelectedBranch] = useState(branches[0] || "");
  const [directive, setDirective] = useState("");
  const [isSent, setIsSent] = useState(false);

  const untouchedLeads = getUntouchedLeadsForBranch(leads, selectedBranch);

  const handleSend = () => {
    setIsSent(true);
    setTimeout(() => setIsSent(false), 2000);
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-xl font-semibold text-[#1A1A1A]">Spot Check</h2>
      </div>

      <div className="mb-4">
        <label className="text-xs text-[#6E6E6E] uppercase tracking-wide block mb-1">
          Select Branch
        </label>
        <select
          value={selectedBranch}
          onChange={(e) => {
            setSelectedBranch(e.target.value);
            setDirective("");
            setIsSent(false);
          }}
          className="border border-[#E6E6E6] rounded px-3 py-2 text-sm bg-white focus:border-[#FFD100] focus:outline-none"
        >
          {branches.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      {untouchedLeads.length > 0 ? (
        <>
          <div className="flex items-center gap-3 mb-4">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-2 py-1 bg-red-50 text-[#C62828] text-xs rounded font-medium border border-red-200"
            >
              {untouchedLeads.length} untouched lead{untouchedLeads.length !== 1 ? "s" : ""}
            </motion.span>
          </div>
          <LeadQueue leads={untouchedLeads} />
        </>
      ) : (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-[#2E7D32] py-4"
        >
          No untouched leads for this branch.
        </motion.p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-4 max-w-md"
      >
        <label className="text-xs text-[#6E6E6E] uppercase tracking-wide block mb-1">
          GM Directive
        </label>
        <textarea
          value={directive}
          onChange={(e) => setDirective(e.target.value)}
          rows={2}
          placeholder="Add directive for this branch..."
          className="w-full border border-[#FFD100] bg-amber-50 rounded px-3 py-2 text-sm focus:outline-none resize-none"
        />
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={handleSend}
            disabled={!directive.trim()}
            className="px-4 py-1.5 bg-[#FFD100] text-[#1A1A1A] rounded text-sm font-medium hover:bg-[#E6BC00] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send Directive
          </button>
          {isSent && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[#2E7D32] text-sm font-medium"
            >
              ✓ Sent
            </motion.span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
