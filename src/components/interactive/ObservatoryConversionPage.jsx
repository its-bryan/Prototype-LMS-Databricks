import { useEffect, useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import MultiSelectFilter from "../observatory/MultiSelectFilter";
import ObservatoryBarChart from "../observatory/ObservatoryBarChart";
import UnusedLeadsDrilldown from "../observatory/UnusedLeadsDrilldown";
import { leadInDateRange } from "../../selectors/demoSelectors";
import { buildTrendPoints, listFilters, periodToDateRange } from "../observatory/observatoryUtils";

export default function ObservatoryConversionPage() {
  const { observatorySnapshot, leads, demandLeads } = useData();

  const [granularity, setGranularity] = useState("week");
  const [selectedZones, setSelectedZones] = useState([]);
  const [selectedGms, setSelectedGms] = useState([]);
  const [selectedAms, setSelectedAms] = useState([]);
  const [selectedHertzZones, setSelectedHertzZones] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  const filters = useMemo(() => listFilters(observatorySnapshot), [observatorySnapshot]);
  useEffect(() => {
    demandLeads();
  }, [demandLeads]);

  const points = useMemo(
    () =>
      buildTrendPoints({
        snapshot: observatorySnapshot,
        granularity,
        metricMode: "conversion",
        selectedZones,
        selectedGms,
        selectedAms,
        selectedHertzZones,
      }),
    [observatorySnapshot, granularity, selectedZones, selectedGms, selectedAms, selectedHertzZones]
  );

  useEffect(() => {
    if (!selectedPeriod) return;
    const stillVisible = points.some((p) => p.rawLabel === selectedPeriod.rawLabel);
    if (!stillVisible) setSelectedPeriod(null);
  }, [points, selectedPeriod]);

  const filteredBranchSet = useMemo(() => {
    if (!observatorySnapshot?.branches) return new Set();
    const zoneSet = new Set(selectedZones);
    const gmSet = new Set(selectedGms);
    const amSet = new Set(selectedAms);
    const hertzZoneSet = new Set(selectedHertzZones);
    const zoneFiltered = zoneSet.size > 0;
    const gmFiltered = gmSet.size > 0;
    const amFiltered = amSet.size > 0;
    const hertzZoneFiltered = hertzZoneSet.size > 0;

    const selectedBranches = new Set();
    for (const [branchKey, branchData] of Object.entries(observatorySnapshot.branches)) {
      if (zoneFiltered && !zoneSet.has(branchData.zone)) continue;
      if (gmFiltered && !gmSet.has(branchData.gm)) continue;
      if (amFiltered && !amSet.has(branchData.am)) continue;
      if (hertzZoneFiltered && !hertzZoneSet.has(branchData.hertzZone || "�")) continue;
      selectedBranches.add(branchData.branch || branchKey);
    }
    return selectedBranches;
  }, [observatorySnapshot, selectedZones, selectedGms, selectedAms, selectedHertzZones]);

  const unusedLeads = useMemo(() => {
    if (!selectedPeriod?.rawLabel) return [];
    const range = periodToDateRange(selectedPeriod.rawLabel, granularity);
    if (!range) return [];

    return (leads ?? [])
      .filter((lead) => lead.status === "Unused")
      .filter((lead) => filteredBranchSet.has(lead.branch))
      .filter((lead) => leadInDateRange(lead, range.start, range.end))
      .sort((a, b) => (b.daysOpen ?? 0) - (a.daysOpen ?? 0));
  }, [leads, selectedPeriod, granularity, filteredBranchSet]);

  const handleBarClick = (point, barType) => {
    if (barType !== "unused") return;
    setSelectedPeriod((prev) => (prev?.rawLabel === point.rawLabel ? null : point));
  };

  const title = "Conversion %";
  const subtitle = granularity === "month" ? "Last 12 months" : "Last 24 weeks";

  return (
    <div className="px-6 py-5 space-y-4 text-[var(--hertz-black)]">
      <div>
        <h1 className="text-xl font-semibold">Observatory Tower</h1>
        <p className="text-sm text-[var(--neutral-600)] mt-1">Company-wide trends for conversion and lead volume.</p>
      </div>

      <div className="rounded-xl border border-[var(--neutral-200)] bg-white p-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--neutral-600)]">Timeline</span>
          <div className="inline-flex rounded-md border border-[var(--neutral-200)] bg-[var(--neutral-50)] p-0.5">
            <button
              type="button"
              onClick={() => setGranularity("month")}
              className={`px-3 py-1.5 text-xs font-semibold rounded ${granularity === "month" ? "bg-white text-[var(--hertz-black)] shadow-sm" : "text-[var(--neutral-600)]"}`}
            >
              Month by month
            </button>
            <button
              type="button"
              onClick={() => setGranularity("week")}
              className={`px-3 py-1.5 text-xs font-semibold rounded ${granularity === "week" ? "bg-white text-[var(--hertz-black)] shadow-sm" : "text-[var(--neutral-600)]"}`}
            >
              Week by week
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <MultiSelectFilter label="Zone" options={filters.zones} selected={selectedZones} onChange={setSelectedZones} />
          <MultiSelectFilter
            label="Hertz Zone"
            options={filters.htzRegions}
            selected={selectedHertzZones}
            onChange={setSelectedHertzZones}
          />
          <MultiSelectFilter label="GM" options={filters.gms} selected={selectedGms} onChange={setSelectedGms} />
          <MultiSelectFilter label="AM" options={filters.ams} selected={selectedAms} onChange={setSelectedAms} />
        </div>
      </div>

      {!observatorySnapshot ? (
        <div className="rounded-xl border border-[var(--neutral-200)] bg-white p-10 text-center text-sm text-[var(--neutral-600)]">
          Observatory snapshot is not available yet. Upload HLES data to generate it.
        </div>
      ) : points.every((p) => (p.value ?? 0) === 0) ? (
        <div className="rounded-xl border border-[var(--neutral-200)] bg-white p-10 text-center text-sm text-[var(--neutral-600)]">
          No data for the selected filters.
        </div>
      ) : (
        <ObservatoryBarChart
          points={points}
          mode="cluster"
          yAxis="percent"
          title={title}
          subtitle={subtitle}
          onBarClick={handleBarClick}
        />
      )}

      {observatorySnapshot && points.some((p) => (p.value ?? 0) > 0 || (p.unusedPct ?? 0) > 0) && (
        <p className="text-sm italic text-[var(--neutral-600)] px-1">
          The Unused % represent opportunity that is yet to be converted to rented. A high Unused % means there is still a chance to improve
          the conversion numbers for that period - Let&apos;s go get it!
        </p>
      )}

      {selectedPeriod && (
        <UnusedLeadsDrilldown
          periodLabel={selectedPeriod.label}
          leads={unusedLeads}
          onClose={() => setSelectedPeriod(null)}
        />
      )}
    </div>
  );
}
