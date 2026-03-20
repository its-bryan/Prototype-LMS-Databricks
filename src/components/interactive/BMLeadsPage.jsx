import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import BackButton from "../BackButton";
import StatusBadge from "../StatusBadge";
import {
  getDateRangePresets,
  getLeadsForBranchInRange,
  getDefaultBranchForDemo,
} from "../../selectors/demoSelectors";
import { formatDateShort } from "../../utils/dateTime";
import { formatDateRange } from "../../utils/dashboardHelpers";
import { usePageTransition, BMDashboardSkeleton } from "../DashboardSkeleton";

const STATUS_TABS = ["All", "Cancelled", "Unused", "Rented"];

export default function BMLeadsPage() {
  const { leads, loading, updateLeadDirective, markLeadReviewed, demandLeads, initialDataReady } = useData();
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { demandLeads(); }, [demandLeads]);

  const branch = userProfile?.branch?.trim() || getDefaultBranchForDemo();
  const presets = useMemo(() => getDateRangePresets(), [loading]);

  const [selectedPresetKey, setSelectedPresetKey] = useState("trailing_4_weeks");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const currentPreset = presets.find((p) => p.key === selectedPresetKey);
  const dateRange = currentPreset ? { start: currentPreset.start, end: currentPreset.end } : null;

  const filteredLeads = useMemo(() => {
    let result = getLeadsForBranchInRange(leads, dateRange, branch);

    if (statusFilter !== "All") {
      result = result.filter((l) => l.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (l) =>
          (l.customer ?? "").toLowerCase().includes(q) ||
          (l.reservationId ?? "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [leads, dateRange, branch, statusFilter, searchQuery]);

  const pageReady = usePageTransition();
  if (!initialDataReady || !pageReady) return <BMDashboardSkeleton />;

  return (
    <div className="flex flex-col h-full gap-0">
      <BackButton onClick={() => navigate("/bm")} label="Back to Dashboard" />

      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--hertz-black)]">My Leads</h1>
          <p className="text-sm text-[var(--neutral-500)] mt-0.5">{branch}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => setSelectedPresetKey(p.key)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  selectedPresetKey === p.key
                    ? "bg-[var(--hertz-black)] text-white"
                    : "bg-[var(--neutral-100)] text-[var(--neutral-600)] hover:bg-[var(--neutral-200)]"
                }`}
              >
                {p.label}
              </button>
            ))}
            {currentPreset && (
              <span className="text-xs text-[var(--neutral-400)] px-1">
                {formatDateRange(currentPreset)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-[var(--neutral-200)] overflow-hidden">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  statusFilter === tab
                    ? "bg-[var(--hertz-black)] text-white"
                    : "bg-white text-[var(--neutral-600)] hover:bg-[var(--neutral-100)]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name or reservation..."
            className="px-3 py-1.5 border border-[var(--neutral-200)] rounded-md text-xs bg-white w-52 focus:outline-none focus:ring-2 focus:ring-[var(--hertz-primary)]"
          />
        </div>

        <div className="border border-[var(--neutral-200)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--hertz-black)]">
                <th className="text-left text-white text-xs font-semibold px-4 py-3">Date</th>
                <th className="text-left text-white text-xs font-semibold px-4 py-3">Customer</th>
                <th className="text-left text-white text-xs font-semibold px-4 py-3">Status</th>
                <th className="text-left text-white text-xs font-semibold px-4 py-3">Insurance</th>
                <th className="text-left text-white text-xs font-semibold px-4 py-3">Contact Range</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-12 text-center text-[var(--neutral-500)]">
                    No leads match the current filters
                  </td>
                </tr>
              )}
              {filteredLeads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => navigate(`/bm/leads/${lead.id}`)}
                  className="border-b border-[var(--neutral-100)] cursor-pointer transition-colors hover:bg-[var(--neutral-50)]"
                >
                  <td className="px-4 py-3 text-[var(--neutral-600)] text-xs">
                    {lead.initDtFinal ? formatDateShort(new Date(lead.initDtFinal + "T12:00:00")) : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--hertz-black)]">
                    <div>{lead.customer}</div>
                    <div className="text-xs text-[var(--neutral-500)] font-mono">{lead.reservationId}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                  <td className="px-4 py-3 text-[var(--neutral-600)]">{lead.insuranceCompany ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--neutral-600)]">{lead.contactRange ?? lead.contact_range ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
