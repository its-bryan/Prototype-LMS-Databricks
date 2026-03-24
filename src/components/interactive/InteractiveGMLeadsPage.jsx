import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import BackButton from "../BackButton";
import {
  resolveGMName,
  normalizeGmName,
} from "../../selectors/demoSelectors";
import { formatDateRange } from "../../utils/dashboardHelpers";
import { formatDateShort } from "../../utils/dateTime";
import StatusBadge from "../StatusBadge";
import ThreeColumnReview from "../ThreeColumnReview";
import { GMLeadsPageSkeleton, usePageTransition } from "../DashboardSkeleton";
import SelectFilter from "../observatory/SelectFilter";

const STATUS_TABS = ["All", "Cancelled", "Unused", "Rented"];
const truncateComment = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  return text.length > 50 ? `${text.slice(0, 50)}...` : text;
};

export default function InteractiveGMLeadsPage() {
  const { loading, orgMapping, updateLeadDirective, markLeadReviewed, fetchLeadsPage, initialDataReady, snapshot } = useData();
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const presets = useMemo(() => {
    const toNoonUTC = (iso) => new Date(iso.length <= 10 ? iso + "T12:00:00Z" : iso);

    // Latest HLES date from snapshot (the "now" anchor)
    const latestDate = snapshot?.now ? toNoonUTC(snapshot.now) : new Date();

    // T4W: use snapshot.period directly (matches summary metric tiles)
    const t4wStart = snapshot?.period?.start ? toNoonUTC(snapshot.period.start) : null;
    const t4wEnd = snapshot?.period?.end ? toNoonUTC(snapshot.period.end) : null;

    // This Month: 1st of current month → latest HLES date
    const thisMonthStart = new Date(Date.UTC(latestDate.getUTCFullYear(), latestDate.getUTCMonth(), 1, 12, 0, 0));

    // This Year: Jan 1 → latest HLES date
    const thisYearStart = new Date(Date.UTC(latestDate.getUTCFullYear(), 0, 1, 12, 0, 0));

    // Earliest HLES date from snapshot (for All Time label)
    const earliestDate = snapshot?.earliestDate ? toNoonUTC(snapshot.earliestDate) : null;

    // This week: Saturday of the current HLES week → Friday
    const day = latestDate.getUTCDay();
    const satOffset = (day + 1) % 7;
    const thisSaturday = new Date(latestDate);
    thisSaturday.setUTCDate(latestDate.getUTCDate() - satOffset);
    thisSaturday.setUTCHours(12, 0, 0, 0);

    return [
      { key: "this_week", label: "This week", start: thisSaturday, end: new Date(thisSaturday.getTime() + 6 * 86400000) },
      { key: "trailing_4_weeks", label: "Trailing 4 weeks", start: t4wStart, end: t4wEnd },
      { key: "this_month", label: "This month", start: thisMonthStart, end: latestDate },
      { key: "this_year", label: "This Year", start: thisYearStart, end: latestDate },
      { key: "all_time", label: "All Time", start: earliestDate, end: latestDate },
    ];
  }, [snapshot]);
  const pageSize = 20;

  const [selectedPresetKey, setSelectedPresetKey] = useState("this_week");
  const [statusFilter, setStatusFilter] = useState("All");
  const [bmFilter, setBmFilter] = useState("All");
  const [branchFilter, setBranchFilter] = useState("All");
  const [insuranceFilter, setInsuranceFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [directive, setDirective] = useState("");
  const [directiveSaved, setDirectiveSaved] = useState(false);
  const [offset, setOffset] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [pagedLeads, setPagedLeads] = useState([]);
  const [pageLoading, setPageLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const currentPreset = presets.find((p) => p.key === selectedPresetKey);
  const dateRange = useMemo(
    () => (currentPreset ? { start: currentPreset.start, end: currentPreset.end } : null),
    [currentPreset],
  );

  const gmName = useMemo(() => {
    const name = userProfile?.displayName;
    if (!name) return resolveGMName(null, userProfile?.id);
    const nm = normalizeGmName(name);
    const orgMatch = (orgMapping ?? []).find((r) => r.gm && normalizeGmName(r.gm) === nm);
    if (orgMatch) return orgMatch.gm;
    return resolveGMName(name, userProfile?.id);
  }, [userProfile?.displayName, userProfile?.id, orgMapping]);

  const gmOrgRows = useMemo(() => {
    if (!gmName) return orgMapping;
    const nm = normalizeGmName(gmName);
    return orgMapping.filter((r) => r.gm && normalizeGmName(r.gm) === nm);
  }, [orgMapping, gmName]);

  const bmNames = useMemo(() => [...new Set(gmOrgRows.map((r) => r.bm).filter(Boolean))].sort(), [gmOrgRows]);
  const branches = useMemo(() => [...new Set(gmOrgRows.map((r) => r.branch).filter(Boolean))].sort(), [gmOrgRows]);
  const insuranceCompanies = useMemo(
    () => [...new Set((pagedLeads ?? []).map((l) => l.insuranceCompany).filter(Boolean))].sort(),
    [pagedLeads]
  );

  useEffect(() => {
    setOffset(0);
    setSelectedLeadId(null);
  }, [selectedPresetKey, statusFilter, bmFilter, branchFilter, insuranceFilter, searchQuery, gmName]);

  useEffect(() => {
    let cancelled = false;
    setPageLoading(true);
    fetchLeadsPage({
      gmName,
      status: statusFilter === "All" ? null : statusFilter,
      bmName: bmFilter === "All" ? null : bmFilter,
      branch: branchFilter === "All" ? null : branchFilter,
      insurance: insuranceFilter === "All" ? null : insuranceFilter,
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
  }, [
    fetchLeadsPage,
    gmName,
    statusFilter,
    bmFilter,
    branchFilter,
    insuranceFilter,
    searchQuery,
    dateRange?.start,
    dateRange?.end,
    pageSize,
    offset,
    refreshTick,
  ]);

  const selectedLead = selectedLeadId ? pagedLeads.find((l) => l.id === selectedLeadId) : null;

  const handleSelectLead = (id, rowEl) => {
    setSelectedLeadId(id);
    setDirective("");
    setDirectiveSaved(false);
    if (rowEl && typeof rowEl.scrollIntoView === "function") {
      rowEl.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  };

  const [directiveSaving, setDirectiveSaving] = useState(false);

  const handleSaveDirective = async () => {
    if (!directive.trim() || !selectedLeadId) return;
    setDirectiveSaving(true);
    try {
      const updated = await updateLeadDirective(selectedLeadId, directive.trim());
      if (updated) {
        setPagedLeads((prev) => prev.map((lead) => (lead.id === selectedLeadId ? updated : lead)));
      } else {
        setRefreshTick((v) => v + 1);
      }
      setDirective("");
      setDirectiveSaved(true);
      setTimeout(() => setDirectiveSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save directive:", err);
    } finally {
      setDirectiveSaving(false);
    }
  };

  const handleMarkReviewed = async () => {
    if (!selectedLeadId) return;
    try {
      await markLeadReviewed(selectedLeadId);
      setSelectedLeadId(null);
      setRefreshTick((v) => v + 1);
    } catch (err) {
      console.error("Failed to mark lead reviewed:", err);
    }
  };

  const pageReady = usePageTransition();
  if (!initialDataReady || !pageReady) return <GMLeadsPageSkeleton />;

  return (
    <div className="flex flex-col h-full gap-0">
      <BackButton onClick={() => navigate("/gm/work")} label="Back to Work" />
      <div className="flex flex-1 min-h-0 gap-0">
      {/* Left: Table */}
      <div className={`transition-all duration-300 ${selectedLead ? "w-[45%]" : "w-full"}`}>
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--hertz-black)]">Leads</h1>
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="inline-flex rounded-md border border-[var(--neutral-200)] bg-[var(--neutral-50)] p-0.5">
                {presets.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setSelectedPresetKey(p.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                      selectedPresetKey === p.key
                        ? "bg-[var(--hertz-primary)] text-[var(--hertz-black)] shadow-sm"
                        : "text-[var(--neutral-600)] hover:text-[var(--hertz-black)]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {currentPreset && (
                <span className="text-xs text-[var(--neutral-400)] px-1">
                  {formatDateRange(currentPreset)}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <SelectFilter
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_TABS.map((t) => ({ value: t, label: t === "All" ? "All Statuses" : t }))}
              minWidth={160}
            />

            <SelectFilter
              label="BM"
              value={bmFilter}
              onChange={setBmFilter}
              options={[{ value: "All", label: "All BMs" }, ...bmNames.map((n) => ({ value: n, label: n }))]}
              minWidth={160}
            />

            <SelectFilter
              label="Branch"
              value={branchFilter}
              onChange={setBranchFilter}
              options={[{ value: "All", label: "All Branches" }, ...branches.map((b) => ({ value: b, label: b }))]}
              minWidth={160}
            />

            <SelectFilter
              label="Insurance"
              value={insuranceFilter}
              onChange={setInsuranceFilter}
              options={[{ value: "All", label: "All Insurance" }, ...insuranceCompanies.map((c) => ({ value: c, label: c }))]}
              minWidth={160}
            />

            <div className="relative" style={{ minWidth: 160 }}>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--neutral-600)]">Search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or reservation..."
                className="mt-1 w-full px-3 py-2 border border-[var(--neutral-200)] rounded-md bg-white text-sm text-[var(--hertz-black)] focus:outline-none focus:ring-2 focus:ring-[var(--hertz-primary)] hover:border-[var(--neutral-400)] transition-colors"
              />
            </div>
          </div>

          <div className="mt-1 flex items-center justify-between text-xs text-[var(--neutral-600)] px-1">
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

          {/* Table */}
          <div className="border border-[var(--neutral-200)] rounded-xl overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[7%]" />
                <col className="w-[11%]" />
                <col className="w-[8%]" />
                <col className="w-[10%]" />
                <col className="w-[14%]" />
                <col className="w-[11%]" />
                <col className="w-[13%]" />
                <col className="w-[26%]" />
              </colgroup>
              <thead>
                <tr className="bg-[var(--hertz-black)]">
                  <th className="text-center text-white text-xs font-semibold px-2 py-3">Date</th>
                  <th className="text-left text-white text-xs font-semibold px-2 py-3">Confirmation #</th>
                  <th className="text-left text-white text-xs font-semibold px-2 py-3">Last Name</th>
                  <th className="text-center text-white text-xs font-semibold px-2 py-3">Status</th>
                  <th className="text-left text-white text-xs font-semibold px-2 py-3">Branch</th>
                  <th className="text-left text-white text-xs font-semibold px-2 py-3">BM</th>
                  <th className="text-left text-white text-xs font-semibold px-2 py-3">Insurance</th>
                  <th className="text-center text-white text-xs font-semibold px-2 py-3">BM Comment</th>
                </tr>
              </thead>
              <tbody>
                {!pageLoading && pagedLeads.length === 0 && (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-[var(--neutral-500)]">
                      No leads match the current filters
                    </td>
                  </tr>
                )}
                {pageLoading &&
                  Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={`loading-${idx}`} className="border-b border-[var(--neutral-100)] animate-pulse">
                      <td className="px-2 py-3"><div className="h-3 w-14 mx-auto rounded bg-[var(--neutral-200)]" /></td>
                      <td className="px-2 py-3"><div className="h-3 w-20 rounded bg-[var(--neutral-200)]" /></td>
                      <td className="px-2 py-3"><div className="h-3 w-20 rounded bg-[var(--neutral-200)]" /></td>
                      <td className="px-2 py-3"><div className="h-5 w-16 mx-auto rounded-full bg-[var(--neutral-200)]" /></td>
                      <td className="px-2 py-3"><div className="h-3 w-20 rounded bg-[var(--neutral-200)]" /></td>
                      <td className="px-2 py-3"><div className="h-3 w-20 rounded bg-[var(--neutral-200)]" /></td>
                      <td className="px-2 py-3"><div className="h-3 w-20 rounded bg-[var(--neutral-200)]" /></td>
                      <td className="px-2 py-3"><div className="h-3 w-28 mx-auto rounded bg-[var(--neutral-200)]" /></td>
                    </tr>
                  ))}
                {pagedLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={(e) => handleSelectLead(lead.id, e.currentTarget)}
                    className={`border-b border-[var(--neutral-100)] cursor-pointer transition-colors ${
                      selectedLeadId === lead.id
                        ? "bg-[var(--hertz-primary-subtle)]"
                        : "hover:bg-[var(--neutral-50)]"
                    }`}
                  >
                    <td className="px-2 py-3 text-center text-[var(--neutral-600)] text-xs">
                      {lead.initDtFinal ? formatDateShort(new Date(lead.initDtFinal + "T12:00:00Z")) : "—"}
                    </td>
                    <td className="px-2 py-3 font-mono text-[var(--neutral-600)] truncate">{lead.reservationId}</td>
                    <td className="px-2 py-3 font-medium text-[var(--hertz-black)] truncate">{lead.customer}</td>
                    <td className="px-2 py-3 text-center"><StatusBadge status={lead.status} /></td>
                    <td className="px-2 py-3 text-[var(--neutral-600)] truncate">{lead.branch}</td>
                    <td className="px-2 py-3 text-[var(--neutral-600)] truncate">{lead.bmName ?? "—"}</td>
                    <td className="px-2 py-3 text-[var(--neutral-600)] truncate">{lead.insuranceCompany ?? "—"}</td>
                    <td
                      className="px-2 py-3 text-center text-[var(--neutral-600)] truncate"
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

      {/* Right: Slide-in Lead Profile Panel */}
      <AnimatePresence mode="wait">
        {selectedLead && (
          <motion.div
            key={selectedLead.id}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="w-[55%] border-l border-[var(--neutral-200)] bg-white overflow-y-auto pl-6"
          >
            <div className="sticky top-0 bg-white z-10 pb-3 pt-1 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--hertz-black)]">{selectedLead.customer}</h2>
              <button
                onClick={() => setSelectedLeadId(null)}
                className="text-[var(--neutral-500)] hover:text-[var(--hertz-black)] transition-colors cursor-pointer p-1"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>

            <ThreeColumnReview lead={selectedLead} showMismatchWarning={selectedLead.mismatch} />

            {/* GM Directive */}
            <div className="mt-6 border border-[var(--neutral-200)] rounded-xl p-5">
              <h3 className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wide mb-3">GM Directive</h3>
              {selectedLead.gmDirective && (
                <div className="mb-3 px-3 py-2 bg-[var(--neutral-50)] rounded-lg text-sm text-[var(--neutral-600)]">
                  <span className="font-medium text-[var(--hertz-black)]">Previous:</span> {selectedLead.gmDirective}
                </div>
              )}
              <textarea
                value={directive}
                onChange={(e) => setDirective(e.target.value)}
                placeholder="Add directive for BM (e.g., 'Follow up with customer by EOD')"
                rows={3}
                className="w-full border border-[var(--neutral-200)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hertz-primary)] resize-none"
              />
              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={handleSaveDirective}
                  disabled={!directive.trim() || directiveSaving}
                  className="px-4 py-2 bg-[var(--hertz-primary)] text-[var(--hertz-black)] rounded-lg text-sm font-medium hover:bg-[var(--hertz-primary-hover)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {directiveSaving ? "Saving..." : "Send Directive"}
                </button>
                <button
                  onClick={handleMarkReviewed}
                  className="px-4 py-2 border border-[var(--neutral-300)] text-[var(--hertz-black)] rounded-lg text-sm font-medium hover:bg-[var(--neutral-100)] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Mark Reviewed
                </button>
                {directiveSaved && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-[var(--color-success)] font-medium">
                    Directive saved
                  </motion.span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
