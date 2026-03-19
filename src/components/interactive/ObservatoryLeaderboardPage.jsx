import { useEffect, useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import ObservatoryDateRangePicker from "../observatory/ObservatoryDateRangePicker";
import { buildGMLeaderboard, metricLabel } from "../observatory/observatoryUtils";

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function LeaderboardTable({ title, rows, metricKey }) {
  const metricHeader = metricLabel(metricKey);

  return (
    <div className="rounded-xl border border-[var(--neutral-200)] bg-white shadow-[var(--shadow-sm)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--neutral-100)] bg-[var(--neutral-50)]">
        <h3 className="text-sm font-semibold text-[var(--hertz-black)]">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--hertz-black)] text-white text-[11px] uppercase tracking-wide">
              <th className="px-3 py-2 text-left">Ranking</th>
              <th className="px-3 py-2 text-left">General Manager</th>
              <th className="px-3 py-2 text-left">Zone</th>
              <th className="px-3 py-2 text-right">{metricHeader}</th>
              <th className="px-3 py-2 text-right">Rented</th>
              <th className="px-3 py-2 text-right">Cancelled</th>
              <th className="px-3 py-2 text-right">Opportunity</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[var(--neutral-600)]">No rows for selected timeline.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${title}-${row.gm}`} className="border-t border-[var(--neutral-100)] hover:bg-[var(--neutral-50)]">
                  <td className="px-3 py-2 font-semibold">{row.rank}</td>
                  <td className="px-3 py-2 font-medium text-[var(--hertz-black)]">{row.gm}</td>
                  <td className="px-3 py-2 text-[var(--neutral-600)]">{row.zone}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatPercent(row.metric)}</td>
                  <td className="px-3 py-2 text-right">{row.rented}</td>
                  <td className="px-3 py-2 text-right">{row.cancelled}</td>
                  <td className="px-3 py-2 text-right">{row.opportunity}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ObservatoryLeaderboardPage() {
  const { observatorySnapshot } = useData();

  const weekLabels = observatorySnapshot?.weeks ?? [];
  const defaultStart = weekLabels.length > 12 ? weekLabels[weekLabels.length - 12] : weekLabels[0] ?? "";
  const defaultEnd = weekLabels[weekLabels.length - 1] ?? "";

  const [timeline, setTimeline] = useState({ start: defaultStart, end: defaultEnd });
  const [metricKey, setMetricKey] = useState("conversion");
  const [excludeBelow20, setExcludeBelow20] = useState(true);

  useEffect(() => {
    if (!weekLabels.length) return;
    setTimeline((prev) => {
      if (prev.start && prev.end) return prev;
      return { start: defaultStart, end: defaultEnd };
    });
  }, [weekLabels.length, defaultStart, defaultEnd]);

  const data = useMemo(
    () =>
      buildGMLeaderboard({
        snapshot: observatorySnapshot,
        start: timeline.start,
        end: timeline.end,
        metricKey,
        excludeBelow20,
      }),
    [observatorySnapshot, timeline.start, timeline.end, metricKey, excludeBelow20]
  );

  return (
    <div className="px-6 py-5 space-y-4 text-[var(--hertz-black)]">
      <div>
        <h1 className="text-xl font-semibold">Observatory Tower</h1>
        <p className="text-sm text-[var(--neutral-600)] mt-1">GM leaderboard with performance and improvement views.</p>
      </div>

      <div className="rounded-xl border border-[var(--neutral-200)] bg-white p-4 flex flex-wrap items-end gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--neutral-600)]">Timeline</span>
          <div className="mt-1">
            <ObservatoryDateRangePicker
              start={timeline.start}
              end={timeline.end}
              onChange={(next) => setTimeline(next)}
            />
          </div>
        </div>

        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--neutral-600)]">Metric</span>
          <select
            value={metricKey}
            onChange={(e) => setMetricKey(e.target.value)}
            className="mt-1 px-3 py-2 border border-[var(--neutral-200)] rounded-md bg-white text-sm"
          >
            <option value="conversion">Conversion %</option>
            <option value="branchContact">% Branch First Contact</option>
            <option value="within30">% &lt; 30min First Contact</option>
          </select>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-[var(--neutral-700)] cursor-pointer">
          <input
            type="checkbox"
            checked={excludeBelow20}
            onChange={(e) => setExcludeBelow20(e.target.checked)}
            className="rounded border-[var(--neutral-300)]"
          />
          Exclude GMs with &lt; 20 leads
        </label>
      </div>

      {!observatorySnapshot ? (
        <div className="rounded-xl border border-[var(--neutral-200)] bg-white p-10 text-center text-sm text-[var(--neutral-600)]">
          Observatory snapshot is not available yet. Upload HLES data to generate it.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <LeaderboardTable title="Best Performing" rows={data.best} metricKey={metricKey} />
          <LeaderboardTable title="Most Improved" rows={data.improved} metricKey={metricKey} />
        </div>
      )}
    </div>
  );
}
