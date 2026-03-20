import { useEffect, useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import MultiSelectFilter from "../observatory/MultiSelectFilter";
import ObservatoryBarChart from "../observatory/ObservatoryBarChart";
import UnusedLeadsDrilldown from "../observatory/UnusedLeadsDrilldown";
import { buildTrendPoints, listFilters, periodToDateRange } from "../observatory/observatoryUtils";

const DRILL_PAGE = 50;

export default function ObservatoryConversionPage() {
  const { observatorySnapshot, fetchLeadsPage } = useData();

  const [granularity, setGranularity] = useState("week");
  const [selectedZones, setSelectedZones] = useState([]);
  const [selectedGms, setSelectedGms] = useState([]);
  const [selectedAms, setSelectedAms] = useState([]);
  const [selectedHertzZones, setSelectedHertzZones] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  const [unusedDrillItems, setUnusedDrillItems] = useState([]);
  const [unusedDrillTotal, setUnusedDrillTotal] = useState(0);
  const [unusedDrillOffset, setUnusedDrillOffset] = useState(0);
  const [unusedDrillLoading, setUnusedDrillLoading] = useState(false);

  const filters = useMemo(() => listFilters(observatorySnapshot), [observatorySnapshot]);

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
      if (hertzZoneFiltered && !hertzZoneSet.has(branchData.hertzZone || "\x9d")) continue;
      selectedBranches.add(branchData.branch || branchKey);
    }
    return selectedBranches;
  }, [observatorySnapshot, selectedZones, selectedGms, selectedAms, selectedHertzZones]);

  const branchesParam = useMemo(() => {
    const list = [...filteredBranchSet].filter(Boolean);
    return list.length ? list.join(",") : null;
  }, [filteredBranchSet]);

  useEffect(() => {
    if (!selectedPeriod?.rawLabel) {
      setUnusedDrillItems([]);
      setUnusedDrillTotal(0);
      setUnusedDrillOffset(0);
      return;
    }
    const range = periodToDateRange(selectedPeriod.rawLabel, granularity);
    if (!range || !branchesParam) {
      setUnusedDrillItems([]);
      setUnusedDrillTotal(0);
      return;
    }

    let cancelled = false;
    setUnusedDrillLoading(true);
    fetchLeadsPage({
      status: "Unused",
      branches: branchesParam,
      startDate: range.start,
      endDate: range.end,
      limit: DRILL_PAGE,
      offset: unusedDrillOffset,
    })
      .then((res) => {
        if (cancelled) return;
        const items = res?.items ?? [];
        setUnusedDrillItems(
          [...items].sort((a, b) => (b.daysOpen ?? 0) - (a.daysOpen ?? 0))
        );
        setUnusedDrillTotal(res?.total ?? items.length);
      })
      .catch(() => {
        if (cancelled) return;
        setUnusedDrillItems([]);
        setUnusedDrillTotal(0);
      })
      .finally(() => {
        if (!cancelled) setUnusedDrillLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPeriod, granularity, branchesParam, unusedDrillOffset, fetchLeadsPage]);

  useEffect(() => {
    setUnusedDrillOffset(0);
  }, [selectedPeriod?.rawLabel, granularity, branchesParam]);

  const handleBarClick = (point, barType) => {
    if (barType !== "unused") return;
    setSelectedPeriod((prev) => (prev?.rawLabel === point.rawLabel ? null : point));
  };

  const title = "Conversion %";
  const subtitle = granularity === "month" ? "Last 12 months" : "Last 24 weeks";

  const drillFooter =
    selectedPeriod && branchesParam ? (
      <div className="px-5 py-3 border-t border-[var(--neutral-100)] flex items-center justify-between text-xs text-[var(--neutral-600)]">
        <span>
          {unusedDrillTotal === 0
            ? "0 results"
            : `Showing ${unusedDrillOffset + 1}-${Math.min(unusedDrillOffset + DRILL_PAGE, unusedDrillTotal)} of ${unusedDrillTotal}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUnusedDrillOffset((o) => Math.max(0, o - DRILL_PAGE))}
            disabled={unusedDrillOffset === 0 || unusedDrillLoading}
            className="px-2.5 py-1 rounded border border-[var(--neutral-200)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--neutral-50)]"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setUnusedDrillOffset((o) => o + DRILL_PAGE)}
            disabled={unusedDrillLoading || unusedDrillOffset + DRILL_PAGE >= unusedDrillTotal}
            className="px-2.5 py-1 rounded border border-[var(--neutral-200)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--neutral-50)]"
          >
            Next
          </button>
        </div>
      </div>
    ) : null;

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
          leads={unusedDrillItems}
          totalCount={branchesParam ? unusedDrillTotal : 0}
          loading={unusedDrillLoading && branchesParam != null}
          footer={drillFooter}
          onClose={() => setSelectedPeriod(null)}
        />
      )}
    </div>
  );
}
