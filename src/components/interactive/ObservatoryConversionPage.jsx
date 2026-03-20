import { useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import MultiSelectFilter from "../observatory/MultiSelectFilter";
import ObservatoryBarChart from "../observatory/ObservatoryBarChart";
import { buildTrendPoints, listFilters } from "../observatory/observatoryUtils";

export default function ObservatoryConversionPage() {
  const { observatorySnapshot } = useData();

  const [granularity, setGranularity] = useState("week");
  const [selectedZones, setSelectedZones] = useState([]);
  const [selectedGms, setSelectedGms] = useState([]);
  const [selectedAms, setSelectedAms] = useState([]);
  const [selectedHertzZones, setSelectedHertzZones] = useState([]);

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
          mode="single"
          yAxis="percent"
          title={title}
          subtitle={subtitle}
        />
      )}
    </div>
  );
}
