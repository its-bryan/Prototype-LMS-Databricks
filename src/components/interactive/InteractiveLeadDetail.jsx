import { useApp } from "../../context/AppContext";
import { getLeadById } from "../../selectors/demoSelectors";
import LeadDetail from "../LeadDetail";
import InteractiveEnrichmentForm from "./InteractiveEnrichmentForm";

export default function InteractiveLeadDetail() {
  const { selectedLeadId, navigateTo } = useApp();
  const lead = getLeadById(selectedLeadId);

  if (!lead) {
    return (
      <div className="h-full flex items-center justify-center text-[#6E6E6E]">
        No lead selected.
        <button
          onClick={() => navigateTo("bm-leads")}
          className="ml-2 text-[#F5C400] hover:underline cursor-pointer"
        >
          Back to leads
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigateTo("bm-leads")}
        className="text-sm text-[#6E6E6E] hover:text-[#1A1A1A] mb-4 inline-block cursor-pointer"
      >
        ← Back to leads
      </button>
      <LeadDetail
        lead={lead}
        enrichmentSlot={<InteractiveEnrichmentForm lead={lead} />}
      />
    </div>
  );
}
