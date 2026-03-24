import { useEffect, useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import MultiSelectFilter from "../observatory/MultiSelectFilter";
import SelectFilter from "../observatory/SelectFilter";
import { buildGMLeaderboard, listFilters, metricLabel } from "../observatory/observatoryUtils";
import { resolveGMName, normalizeGmName } from "../../selectors/demoSelectors";

function formatPercent(value) {
  if (value == null) return "—";
  return `${Number(value).toFixed(1)}%`;
}

function formatDelta(value) {
  const delta = Math.round(Number(value || 0));
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}%`;
}

function parseIsoDate(isoDate) {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateShort(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

/**
 * Build T4W timeline options matching snapshot.py _trailing_4_weeks exactly:
 *   current:    (now - 27) .. now          (28-day span)
 *   shifted:    (now - 27 - 7*i) .. (now - 7*i)   per historical step
 *
 * Labels show the raw (now-27)..(now) date span so they match the summary
 * metrics view. The underlying start/end week-label keys select the correct
 * weekly buckets for data aggregation via getWeekIndicesInRange.
 */
function buildTrailingFourWeekOptions(weekLabels, snapshotNow) {
  if (!Array.isArray(weekLabels) || weekLabels.length === 0) return [];

  const weekRows = weekLabels
    .map((week) => {
      const monday = parseIsoDate(week);
      if (!monday) return null;
      return { week, monday };
    })
    .filter(Boolean);
  if (!weekRows.length) return [];

  // Anchor = snapshot.period.end (actual max data date), matching summary metrics
  const anchor = snapshotNow ? parseIsoDate(snapshotNow) : null;
  if (!anchor) return [];

  const firstMonday = weekRows[0].monday;

  const options = [];
  for (let i = 0; i < 8; i++) {
    // Mirror _trailing_4_weeks: end = now - 7*i, start = end - 27
    const periodEnd = addDays(anchor, -(i * 7));
    const periodStart = addDays(periodEnd, -27);

    // Find week-label keys that cover this period for data aggregation:
    // startWeek = Monday of the week containing periodStart
    // endWeek   = Monday of the week containing periodEnd
    const startWeekRow = findWeekContaining(weekRows, periodStart);
    const endWeekRow = findWeekContaining(weekRows, periodEnd);
    if (!startWeekRow || !endWeekRow) break;
    // Stop if we'd go before available data
    if (startWeekRow.monday < firstMonday) break;

    options.push({
      key: `${startWeekRow.week}|${endWeekRow.week}`,
      start: startWeekRow.week,
      end: endWeekRow.week,
      label: `${formatDateShort(periodStart)} - ${formatDateShort(periodEnd)}`,
    });
  }
  return options;
}

/** Find the week row whose Monday..Sunday range contains the given date. */
function findWeekContaining(weekRows, d) {
  for (let i = weekRows.length - 1; i >= 0; i--) {
    if (weekRows[i].monday <= d) return weekRows[i];
  }
  return null;
}

function LeaderboardTable({ title, rows, metricKey, showChangeColumn = false, myRow }) {
  const metricHeader = metricLabel(metricKey);
  const tooltipText = "Compared to the previous week's Trailing 4 weeks";
  const totalColumns = showChangeColumn ? 6 : 5;

  const rankBadge = (rank) => {
    const isTop5 = rank <= 5;
    return (
      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${isTop5 ? "bg-[var(--hertz-primary)] text-[var(--hertz-black)]" : ""}`}>
        {rank}
      </span>
    );
  };

  return (
    <div className="rounded-xl border border-[var(--neutral-200)] bg-white shadow-[var(--shadow-sm)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--neutral-100)] bg-[var(--hertz-primary)]">
        <h3 className="text-sm font-semibold text-[var(--hertz-black)]">{title}</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Your Rank row — aligned to table columns */}
          {myRow && (
            <thead>
              <tr className="bg-[var(--hertz-primary)]/10">
                <td colSpan={totalColumns} className="px-2 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--neutral-500)]">Your Rank — out of {rows.length} GMs</span>
                </td>
              </tr>
              <tr className="bg-[var(--hertz-primary)]/10 border-b border-[var(--neutral-200)]">
                <td className="pl-2 pr-1 py-2 text-center font-semibold whitespace-nowrap">{rankBadge(myRow.rank)}</td>
                <td className="px-1 py-2 font-semibold text-[var(--hertz-black)]">{myRow.gm}</td>
                <td className="px-3 py-2 text-center text-[var(--neutral-600)] whitespace-nowrap">{myRow.zone}</td>
                <td className="px-3 py-2 text-center font-semibold whitespace-nowrap">{formatPercent(myRow.metric)}</td>
                {showChangeColumn && (
                  <td className={`px-3 py-2 text-center text-xs font-semibold whitespace-nowrap ${myRow.delta > 0 ? "text-[var(--color-success)]" : myRow.delta < 0 ? "text-[var(--color-error)]" : "text-[var(--neutral-500)]"}`}>
                    {formatDelta(myRow.delta)}
                  </td>
                )}
                <td className="px-3 py-2 text-center whitespace-nowrap">{myRow.rented}</td>
              </tr>
            </thead>
          )}
          <thead>
            <tr className="bg-[var(--hertz-black)] text-white text-[11px] uppercase tracking-wide">
              <th className="pl-2 pr-1 py-2 text-center whitespace-nowrap" style={{ width: 40 }}>#</th>
              <th className="px-1 py-2 text-left">General Manager</th>
              <th className="px-3 py-2 text-center whitespace-nowrap" style={{ width: 64 }}>Zone</th>
              <th className="px-3 py-2 text-center whitespace-nowrap" style={{ width: 96 }}>{metricHeader}</th>
              {showChangeColumn && (
                <th className="px-3 py-2 text-center whitespace-nowrap" style={{ width: 80 }}>
                  <span className="inline-flex items-center gap-1">
                    Change
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-white/80 text-[10px]" title={tooltipText}>
                      ?
                    </span>
                  </span>
                </th>
              )}
              <th className="px-3 py-2 text-center whitespace-nowrap" style={{ width: 64 }}>Rented</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={totalColumns} className="px-2 py-8 text-center text-[var(--neutral-600)]">No rows for selected timeline.</td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const isMe = myRow && normalizeGmName(row.gm) === normalizeGmName(myRow.gm);
                return (
                  <tr key={`${title}-${row.gm}`} className={`border-t border-[var(--neutral-100)] hover:bg-[var(--neutral-100)] ${isMe ? "bg-[var(--hertz-primary)]/10 font-semibold" : idx % 2 === 1 ? "bg-[var(--neutral-50)]" : ""}`}>
                    <td className="pl-2 pr-1 py-2 text-center font-semibold whitespace-nowrap">{rankBadge(row.rank)}</td>
                    <td className="px-1 py-2 font-medium text-[var(--hertz-black)]">{row.gm}</td>
                    <td className="px-3 py-2 text-center text-[var(--neutral-600)] whitespace-nowrap">{row.zone}</td>
                    <td className="px-3 py-2 text-center font-semibold whitespace-nowrap">{formatPercent(row.metric)}</td>
                    {showChangeColumn && <td className="px-3 py-2 text-center whitespace-nowrap">{formatDelta(row.delta)}</td>}
                    <td className="px-3 py-2 text-center whitespace-nowrap">{row.rented}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ObservatoryLeaderboardPage() {
  const { observatorySnapshot, snapshot, orgMapping } = useData();
  const { userProfile } = useAuth();
  const filters = useMemo(() => listFilters(observatorySnapshot), [observatorySnapshot]);

  const gmName = useMemo(() => {
    const name = userProfile?.displayName;
    if (!name) return resolveGMName(null, userProfile?.id);
    const nm = normalizeGmName(name);
    const orgMatch = (orgMapping ?? []).find((r) => r.gm && normalizeGmName(r.gm) === nm);
    if (orgMatch) return orgMatch.gm;
    return resolveGMName(name, userProfile?.id);
  }, [userProfile?.displayName, userProfile?.id, orgMapping]);

  const weekLabels = observatorySnapshot?.weeks ?? [];
  // Use main snapshot's period.end as anchor (matches summary metrics T4W exactly),
  // falling back to observatorySnapshot.now
  const snapshotNow = snapshot?.period?.end ?? observatorySnapshot?.now ?? null;
  const timelineOptions = useMemo(() => buildTrailingFourWeekOptions(weekLabels, snapshotNow), [weekLabels, snapshotNow]);
  const [selectedTimelineKey, setSelectedTimelineKey] = useState("");
  const [metricKey, setMetricKey] = useState("conversion");
  const [excludeBelow20, setExcludeBelow20] = useState(true);
  const [selectedHertzZones, setSelectedHertzZones] = useState([]);

  useEffect(() => {
    if (!timelineOptions.length) return;
    if (timelineOptions.some((opt) => opt.key === selectedTimelineKey)) return;
    setSelectedTimelineKey(timelineOptions[0].key);
  }, [timelineOptions, selectedTimelineKey]);

  const selectedTimeline = useMemo(
    () => timelineOptions.find((opt) => opt.key === selectedTimelineKey) ?? null,
    [timelineOptions, selectedTimelineKey]
  );

  const data = useMemo(
    () =>
      buildGMLeaderboard({
        snapshot: observatorySnapshot,
        start: selectedTimeline?.start ?? "",
        end: selectedTimeline?.end ?? "",
        metricKey,
        excludeBelow20,
        selectedHertzZones,
      }),
    [observatorySnapshot, selectedTimeline?.start, selectedTimeline?.end, metricKey, excludeBelow20, selectedHertzZones]
  );

  const nmGm = normalizeGmName(gmName);
  const myBestRow = useMemo(() => data.best.find((r) => normalizeGmName(r.gm) === nmGm) ?? null, [data.best, nmGm]);
  const myImprovedRow = useMemo(() => data.improved.find((r) => normalizeGmName(r.gm) === nmGm) ?? null, [data.improved, nmGm]);

  return (
    <div className="px-6 py-5 space-y-4 text-[var(--hertz-black)]">
      <div>
        <h1 className="text-xl font-semibold">Observatory Tower</h1>
        <p className="text-sm text-[var(--neutral-600)] mt-1">GM leaderboard with performance and improvement views.</p>
      </div>

      <div className="rounded-xl border border-[var(--neutral-200)] bg-white p-4 flex flex-wrap items-end gap-6">
        <SelectFilter
          label="Timeline"
          options={timelineOptions.map((opt) => ({ value: opt.key, label: opt.label }))}
          value={selectedTimelineKey}
          onChange={setSelectedTimelineKey}
          minWidth={220}
        />

        <SelectFilter
          label="View"
          options={[
            { value: "conversion", label: "Conversion %" },
            { value: "branchContact", label: "Branch Contact %" },
            { value: "within30", label: "% < 30min First Contact" },
          ]}
          value={metricKey}
          onChange={setMetricKey}
        />

        <MultiSelectFilter
          label="Hertz Zone"
          options={filters.htzRegions}
          selected={selectedHertzZones}
          onChange={setSelectedHertzZones}
        />

        <div className="flex items-end h-full">
          <label className="inline-flex items-center gap-2 px-3 py-2 text-sm text-[var(--neutral-700)] cursor-pointer border border-[var(--neutral-200)] rounded-md hover:border-[var(--neutral-400)] transition-colors">
            <input
              type="checkbox"
              checked={excludeBelow20}
              onChange={(e) => setExcludeBelow20(e.target.checked)}
              className="rounded border-[var(--neutral-300)]"
            />
            Exclude GMs with &lt; 20 leads
          </label>
        </div>
      </div>

      {!observatorySnapshot ? (
        <div className="rounded-xl border border-[var(--neutral-200)] bg-white p-10 text-center text-sm text-[var(--neutral-600)]">
          Observatory snapshot is not available yet. Upload HLES data to generate it.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <LeaderboardTable title="Best Performing" rows={data.best} metricKey={metricKey} myRow={myBestRow} />
          <LeaderboardTable title="Most Improved" rows={data.improved} metricKey={metricKey} showChangeColumn myRow={myImprovedRow} />
        </div>
      )}
    </div>
  );
}
