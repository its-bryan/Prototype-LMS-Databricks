import { useState, useMemo } from "react";
import { useApp } from "../../context/AppContext";
import { getUnusedLeads } from "../../selectors/demoSelectors";
import LeadQueue from "../LeadQueue";
import { FilterBar, useOrgFilterOptions, applyFilters } from "./InteractiveCancelledLeads";

export default function InteractiveUnusedLeads() {
  const { navigateTo, selectLead } = useApp();
  const unusedLeads = getUnusedLeads();
  const options = useOrgFilterOptions();

  const [bmFilter, setBmFilter] = useState("All");
  const [branchFilter, setBranchFilter] = useState("All");
  const [gmFilter, setGmFilter] = useState("All");

  const filteredLeads = useMemo(
    () => applyFilters(unusedLeads, { bmFilter, branchFilter, gmFilter }),
    [unusedLeads, bmFilter, branchFilter, gmFilter],
  );

  const handleLeadClick = (lead) => {
    selectLead(lead.id);
    navigateTo("gm-review");
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-xl font-semibold text-[#1A1A1A]">Unused Leads</h2>
        <span className="px-2 py-1 bg-[#FFD100] text-[#1A1A1A] rounded text-xs font-medium">
          {filteredLeads.length} leads
        </span>
      </div>
      <div className="mb-4">
        <FilterBar
          bmFilter={bmFilter}
          setBmFilter={setBmFilter}
          branchFilter={branchFilter}
          setBranchFilter={setBranchFilter}
          gmFilter={gmFilter}
          setGmFilter={setGmFilter}
          options={options}
        />
      </div>
      <LeadQueue leads={filteredLeads} onLeadClick={handleLeadClick} />
    </div>
  );
}
