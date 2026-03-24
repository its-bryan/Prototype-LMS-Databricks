import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import BackButton from "../BackButton";
import StatusBadge from "../StatusBadge";
import {
  getDateRangePresets,
  getDefaultBranchForDemo,
} from "../../selectors/demoSelectors";
import { formatDateShort } from "../../utils/dateTime";
import { formatDateRange } from "../../utils/dashboardHelpers";
import { usePageTransition, BMDashboardSkeleton } from "../DashboardSkeleton";

const STATUS_TABS = ["All", "Cancelled", "Unused", "Rented"];
const truncateComment = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  return text.length > 50 ? `${text.slice(0, 50)}...` : text;
};

export default function BMLeadsPage() {
  const { loading, fetchLeadsPage, initialDataReady } = useData();
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const branch = userProfile?.branch?.trim() || getDefaultBranchForDemo();
  const presets = useMemo(() => getDateRangePresets(), [loading]);
  const pageSize = 20;

  const [selectedPresetKey, setSelectedPresetKey] = useState("trailing_4_weeks");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [pagedLeads, setPagedLeads] = useState([]);
  const [pageLoading, setPageLoading] = useState(false);

  const currentPreset = presets.find((p) => p.key === selectedPresetKey);
  const dateRange = useMemo(
    () => (currentPreset ? { start: currentPreset.start, end: currentPreset.end } : null),
    [currentPreset],
  );

  useEffect(() => {
    setOffset(0);
  }, [selectedPresetKey, statusFilter, searchQuery, branch]);

  useEffect(() => {
    let cancelled = false;
    setPageLoading(true);
    fetchLeadsPage({
      branch,
      status: statusFilter === "All" ? null : statusFilter,
      search: searchQuery.trim() || null,
      startDate: dateRange?.start ?? null,
      endDate: dateRange?.end ?? null,
      limit: pageSize,
      offset,
    })
      .then((result) => {
        if (cancelled) return;
        setPagedLeads(result?.items ?? []);
        setTotalLeads(result?.total ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setPagedLeads([]);
        setTotalLeads(0);
      })
      .finally(() => {
        if (!cancelled) setPageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchLeadsPage, branch, statusFilter, searchQuery, dateRange?.start, dateRange?.end, offset]);

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

        <div className="flex items-center justify-between text-xs text-[var(--neutral-600)] px-1">
          <span>
            {totalLeads === 0 ? "0 results" : `Showing ${offset + 1}-${Math.min(offset + pageSize, totalLeads)} of ${totalLeads}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffset((prev) => Math.max(0, prev - pageSize))}
              disabled={offset === 0 || pageLoading}
              className="px-2.5 py-1 rounded border border-[var(--neutral-200)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--neutral-50)]"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setOffset((prev) => prev + pageSize)}
              disabled={pageLoading || offset + pageSize >= totalLeads}
              className="px-2.5 py-1 rounded border border-[var(--neutral-200)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--neutral-50)]"
            >
              Next
            </button>
          </div>
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
                <th className="text-left text-white text-xs font-semibold px-4 py-3">BM Comment</th>
              </tr>
            </thead>
            <tbody>
              {!pageLoading && pagedLeads.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-[var(--neutral-500)]">
                    No leads match the current filters
                  </td>
                </tr>
              )}
              {pageLoading &&
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`loading-${idx}`} className="border-b border-[var(--neutral-100)] animate-pulse">
                    <td className="px-4 py-3"><div className="h-3 w-16 rounded bg-[var(--neutral-200)]" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-32 rounded bg-[var(--neutral-200)]" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 rounded-full bg-[var(--neutral-200)]" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-24 rounded bg-[var(--neutral-200)]" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 rounded bg-[var(--neutral-200)]" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-32 rounded bg-[var(--neutral-200)]" /></td>
                  </tr>
                ))}
              {pagedLeads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => navigate(`/bm/leads/${lead.id}`)}
                  className="border-b border-[var(--neutral-100)] cursor-pointer transition-colors hover:bg-[var(--neutral-50)]"
                >
                  <td className="px-4 py-3 text-[var(--neutral-600)] text-xs">
                    {lead.initDtFinal ? formatDateShort(new Date(lead.initDtFinal + "T12:00:00Z")) : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--hertz-black)]">
                    <div>{lead.customer}</div>
                    <div className="text-xs text-[var(--neutral-500)] font-mono">{lead.reservationId}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                  <td className="px-4 py-3 text-[var(--neutral-600)]">{lead.insuranceCompany ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--neutral-600)]">{lead.contactRange ?? lead.contact_range ?? "—"}</td>
                  <td
                    className="px-4 py-3 text-[var(--neutral-600)] max-w-[260px] truncate"
                    title={lead.enrichment?.reason ?? lead.enrichment?.notes ?? ""}
                  >
                    {truncateComment(lead.enrichment?.reason || lead.enrichment?.notes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
