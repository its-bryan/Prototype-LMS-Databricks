import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { getDateRangePresets, getDefaultBranchForDemo } from "../../selectors/demoSelectors";
import LeadQueue from "../LeadQueue";
import { formatDateShort } from "../../utils/dateTime";
import { usePageTransition, BMDashboardSkeleton } from "../DashboardSkeleton";

const STATUS_TABS = ["All", "Cancelled", "Unused", "Rented"];

export default function InteractiveLeadQueue() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { loading, fetchLeadsPage, initialDataReady } = useData();

  const branch = userProfile?.branch?.trim() || getDefaultBranchForDemo();
  const presets = useMemo(() => getDateRangePresets(), [loading]);
  const pageSize = 20;

  const [selectedPresetKey, setSelectedPresetKey] = useState("all_time");
  const [useCustom, setUseCustom] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [offset, setOffset] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [pagedLeads, setPagedLeads] = useState([]);
  const [pageLoading, setPageLoading] = useState(false);
  const [bannerCount, setBannerCount] = useState(0);

  const dateRange = useMemo(() => {
    if (useCustom && customStart && customEnd) {
      return { start: new Date(customStart + "T12:00:00Z"), end: new Date(customEnd + "T23:59:59") };
    }
    const preset = presets.find((p) => p.key === selectedPresetKey);
    return preset ? { start: preset.start, end: preset.end } : { start: null, end: null };
  }, [useCustom, customStart, customEnd, selectedPresetKey, presets]);

  useEffect(() => {
    setOffset(0);
  }, [selectedPresetKey, useCustom, customStart, customEnd, statusFilter, branch]);

  useEffect(() => {
    let cancelled = false;
    setPageLoading(true);
    fetchLeadsPage({
      branch,
      status: statusFilter === "All" ? null : statusFilter,
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
  }, [fetchLeadsPage, branch, statusFilter, dateRange?.start, dateRange?.end, offset]);

  useEffect(() => {
    let cancelled = false;
    fetchLeadsPage({
      branch,
      enrichmentComplete: false,
      startDate: dateRange?.start ?? null,
      endDate: dateRange?.end ?? null,
      limit: 1,
      offset: 0,
    })
      .then((res) => {
        if (!cancelled) setBannerCount(res?.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) setBannerCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchLeadsPage, branch, dateRange?.start, dateRange?.end]);

  const mismatchCount = useMemo(
    () => pagedLeads.filter((l) => l.mismatch).length,
    [pagedLeads],
  );

  const handleLeadClick = (lead) => {
    navigate(`/bm/leads/${lead.id}`);
  };

  const subtitle = useMemo(() => {
    if (useCustom && customStart && customEnd) {
      return `${formatDateShort(new Date(customStart))} – ${formatDateShort(new Date(customEnd))}`;
    }
    const preset = presets.find((p) => p.key === selectedPresetKey);
    if (preset?.start && preset?.end) {
      return `${formatDateShort(preset.start)} – ${formatDateShort(preset.end)}`;
    }
    return "All leads";
  }, [useCustom, customStart, customEnd, selectedPresetKey, presets]);

  const pageReady = usePageTransition();
  if (!initialDataReady || !pageReady) return <BMDashboardSkeleton />;

  return (
    <div>
      <h2 className="text-xl font-semibold text-[#1A1A1A] mb-1">My Leads</h2>
      <p className="text-sm text-[#6E6E6E] mb-4">{subtitle}</p>

      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              setSelectedPresetKey(p.key);
              setUseCustom(false);
            }}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              !useCustom && selectedPresetKey === p.key
                ? "bg-[#FFD100] text-[#1A1A1A]"
                : "bg-gray-100 text-[#6E6E6E] hover:bg-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}

        <span className="text-[#E6E6E6] mx-0.5">|</span>

        <button
          type="button"
          onClick={() => setUseCustom(true)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
            useCustom ? "bg-[#FFD100] text-[#1A1A1A]" : "bg-gray-100 text-[#6E6E6E] hover:bg-gray-200"
          }`}
        >
          Custom
        </button>

        {useCustom && (
          <div className="flex items-center gap-1.5 ml-0.5">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2 py-1 border border-[#E6E6E6] rounded text-xs text-[#1A1A1A] focus:outline-none focus:border-[#FFD100]"
            />
            <span className="text-xs text-[#6E6E6E]">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2 py-1 border border-[#E6E6E6] rounded text-xs text-[#1A1A1A] focus:outline-none focus:border-[#FFD100]"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex rounded-lg border border-[#E6E6E6] overflow-hidden">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                statusFilter === tab ? "bg-[#1A1A1A] text-white" : "bg-white text-[#6E6E6E] hover:bg-gray-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-[#6E6E6E] mb-4 px-0.5">
        <span>
          {pageLoading ? "Loading…" : totalLeads === 0 ? "0 results" : `Showing ${offset + 1}-${Math.min(offset + pageSize, totalLeads)} of ${totalLeads}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOffset((prev) => Math.max(0, prev - pageSize))}
            disabled={offset === 0 || pageLoading}
            className="px-2.5 py-1 rounded border border-[#E6E6E6] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setOffset((prev) => prev + pageSize)}
            disabled={pageLoading || offset + pageSize >= totalLeads}
            className="px-2.5 py-1 rounded border border-[#E6E6E6] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      </div>

      <LeadQueue
        leads={pagedLeads}
        bannerCount={bannerCount}
        mismatchCount={mismatchCount}
        onLeadClick={handleLeadClick}
      />
    </div>
  );
}
