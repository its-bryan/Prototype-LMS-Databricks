function parseDate(val) {
  if (!val) return null;
  const d = new Date(`${val}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeDivide(n, d) {
  if (!d) return 0;
  return (n / d) * 100;
}

function compactWeekLabel(isoDate) {
  const d = parseDate(isoDate);
  if (!d) return isoDate;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function compactMonthLabel(monthKey) {
  const [y, m] = String(monthKey).split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(d.getTime())) return monthKey;
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function listFilters(snapshot) {
  return {
    zones: snapshot?.filters?.zones ?? [],
    gms: snapshot?.filters?.gms ?? [],
    ams: snapshot?.filters?.ams ?? [],
    htzRegions: snapshot?.filters?.htzRegions ?? [],
  };
}

export function buildTrendPoints({
  snapshot,
  granularity,
  metricMode,
  selectedZones,
  selectedGms,
  selectedAms,
  selectedHertzZones,
}) {
  if (!snapshot?.branches) return [];

  const labels = granularity === "month" ? (snapshot.months ?? []) : (snapshot.weeks ?? []);
  const points = labels.map((rawLabel) => ({
    label: granularity === "month" ? compactMonthLabel(rawLabel) : compactWeekLabel(rawLabel),
    rawLabel,
    total: 0,
    rented: 0,
    cancelled: 0,
    unused: 0,
  }));

  const zoneSet = new Set(selectedZones);
  const gmSet = new Set(selectedGms);
  const amSet = new Set(selectedAms);
  const hertzZoneSet = new Set(selectedHertzZones);
  const zoneFiltered = zoneSet.size > 0;
  const gmFiltered = gmSet.size > 0;
  const amFiltered = amSet.size > 0;
  const hertzZoneFiltered = hertzZoneSet.size > 0;

  for (const branchData of Object.values(snapshot.branches)) {
    if (zoneFiltered && !zoneSet.has(branchData.zone)) continue;
    if (gmFiltered && !gmSet.has(branchData.gm)) continue;
    if (amFiltered && !amSet.has(branchData.am)) continue;
    if (hertzZoneFiltered && !hertzZoneSet.has(branchData.hertzZone || "�")) continue;

    const series = granularity === "month" ? (branchData.monthly ?? []) : (branchData.weekly ?? []);
    for (let i = 0; i < points.length; i++) {
      const row = series[i];
      if (!row) continue;
      points[i].total += row.total ?? 0;
      points[i].rented += row.rented ?? 0;
      points[i].cancelled += row.cancelled ?? 0;
      points[i].unused += row.unused ?? 0;
    }
  }

  if (metricMode === "conversion") {
    return points.map((p) => {
      const value = safeDivide(p.rented, p.total);
      const unusedPct = safeDivide(p.unused, p.total);
      return {
        label: p.label,
        rawLabel: p.rawLabel,
        value: Number(value.toFixed(1)),
        unusedPct: Number(unusedPct.toFixed(1)),
        rented: p.rented,
        unused: p.unused,
        total: p.total,
        tooltip: `${p.label}: ${value.toFixed(1)}% conversion, ${unusedPct.toFixed(1)}% unused (${p.rented}R / ${p.unused}U / ${p.total || 0}T)`,
      };
    });
  }

  if (metricMode === "totalLeadsSingle") {
    return points.map((p) => ({
      label: p.label,
      value: p.total,
      tooltip: `${p.label}: ${p.total} total leads`,
    }));
  }

  return points.map((p) => ({
    label: p.label,
    total: p.total,
    rented: p.rented,
    cancelled: p.cancelled,
    unused: p.unused,
    tooltip: `${p.label}: ${p.total} leads (${p.rented} rented, ${p.cancelled} cancelled, ${p.unused} unused)`,
  }));
}

function getWeekIndicesInRange(weeks, start, end) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return [];
  const min = startDate <= endDate ? startDate : endDate;
  const max = startDate <= endDate ? endDate : startDate;

  const indices = [];
  for (let i = 0; i < weeks.length; i++) {
    const d = parseDate(weeks[i]);
    if (!d) continue;
    if (d >= min && d <= max) indices.push(i);
  }
  return indices;
}

function aggregateRows(rows) {
  return rows.reduce(
    (acc, row) => {
      if (!row) return acc;
      acc.total += row.total ?? 0;
      acc.rented += row.rented ?? 0;
      acc.cancelled += row.cancelled ?? 0;
      acc.unused += row.unused ?? 0;
      acc.branchContact += row.branchContact ?? 0;
      acc.totalContact += row.totalContact ?? 0;
      acc.within30 += row.within30 ?? 0;
      return acc;
    },
    { total: 0, rented: 0, cancelled: 0, unused: 0, branchContact: 0, totalContact: 0, within30: 0 }
  );
}

function metricValue(metricKey, stats) {
  if (metricKey === "conversion") return safeDivide(stats.rented, stats.total);
  if (metricKey === "branchContact") return safeDivide(stats.branchContact, stats.total);
  if (metricKey === "within30") return safeDivide(stats.within30, stats.total);
  return 0;
}

export function buildGMLeaderboard({
  snapshot,
  start,
  end,
  metricKey,
  excludeBelow20,
  selectedHertzZones = [],
}) {
  if (!snapshot?.branches || !Array.isArray(snapshot.weeks)) return { best: [], improved: [] };

  const currentIndices = getWeekIndicesInRange(snapshot.weeks, start, end);
  if (!currentIndices.length) return { best: [], improved: [] };

  const span = currentIndices.length;
  const first = currentIndices[0];
  const comparisonIndices = [];
  const hertzZoneSet = new Set(selectedHertzZones);
  const hertzZoneFiltered = hertzZoneSet.size > 0;
  for (let i = first - 1; i < first - 1 + span; i++) {
    if (i >= 0) comparisonIndices.push(i);
  }

  const byGM = new Map();

  for (const branchData of Object.values(snapshot.branches)) {
    if (hertzZoneFiltered && !hertzZoneSet.has(branchData.hertzZone || "�")) continue;
    const gm = branchData.gm && branchData.gm !== "�" ? branchData.gm : "Unassigned";
    if (!byGM.has(gm)) {
      byGM.set(gm, {
        gm,
        zone: branchData.zone || "�",
        currentRows: [],
        prevRows: [],
      });
    }

    const gmEntry = byGM.get(gm);
    const weekly = branchData.weekly ?? [];

    currentIndices.forEach((idx) => {
      gmEntry.currentRows.push(weekly[idx]);
    });
    comparisonIndices.forEach((idx) => {
      gmEntry.prevRows.push(weekly[idx]);
    });
  }

  const rows = [];
  for (const entry of byGM.values()) {
    const current = aggregateRows(entry.currentRows);
    const prev = aggregateRows(entry.prevRows);
    if (excludeBelow20 && current.total < 20) continue;

    const metric = metricValue(metricKey, current);
    const prevMetric = metricValue(metricKey, prev);
    const delta = metric - prevMetric;

    rows.push({
      gm: entry.gm,
      zone: entry.zone,
      metric,
      prevMetric,
      delta,
      rented: current.rented,
      cancelled: current.cancelled,
      opportunity: current.unused,
      total: current.total,
    });
  }

  const best = [...rows]
    .sort((a, b) => b.metric - a.metric)
    .map((row, idx) => ({ ...row, rank: idx + 1 }));

  const improved = [...rows]
    .sort((a, b) => b.delta - a.delta)
    .map((row, idx) => ({ ...row, rank: idx + 1 }));

  return { best, improved };
}

export function metricLabel(metricKey) {
  if (metricKey === "conversion") return "Conversion %";
  if (metricKey === "branchContact") return "Branch Contact %";
  if (metricKey === "within30") return "% < 30min First Contact";
  return "Metric";
}

function toIsoDate(d) {
  return d.toISOString().slice(0, 10);
}

export function periodToDateRange(rawLabel, granularity) {
  if (!rawLabel) return null;
  if (granularity === "month") {
    const [year, month] = String(rawLabel).split("-").map(Number);
    if (!year || !month) return null;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }

  const start = parseDate(rawLabel);
  if (!start) return null;
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}
