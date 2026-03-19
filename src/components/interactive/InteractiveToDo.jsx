import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext";
import { getCancelledLeads, getUnusedLeads } from "../../selectors/demoSelectors";
import LeadQueue from "../LeadQueue";

export default function InteractiveToDo() {
  const navigate = useNavigate();
  const { leads, demandLeads } = useData();
  useEffect(() => { demandLeads(); }, [demandLeads]);

  const unenrichedCancelled = getCancelledLeads(leads).filter((l) => !l.enrichmentComplete);
  const unenrichedUnused = getUnusedLeads(leads).filter((l) => !l.enrichmentComplete);
  const todoLeads = [...unenrichedCancelled, ...unenrichedUnused];

  const handleLeadClick = (lead) => {
    navigate(`/bm/leads/${lead.id}`);
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-1">
        <h2 className="text-xl font-semibold text-[#1A1A1A]">My To Do</h2>
        <span className="px-2 py-1 bg-[#C62828] text-white rounded text-xs font-medium">
          {todoLeads.length} pending
        </span>
      </div>
      <p className="text-sm text-[#6E6E6E] mb-4">
        Cancelled and unused leads that still need comments.
      </p>
      {todoLeads.length === 0 ? (
        <div className="text-center py-12 text-[#6E6E6E]">
          All caught up — no leads need comments.
        </div>
      ) : (
        <LeadQueue leads={todoLeads} onLeadClick={handleLeadClick} />
      )}
    </div>
  );
}
