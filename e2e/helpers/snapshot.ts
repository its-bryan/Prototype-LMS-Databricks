import { type APIRequestContext } from "@playwright/test";

/** Fetch the dashboard snapshot from the API. */
export async function fetchDashboardSnapshot(
  request: APIRequestContext,
  token: string,
) {
  const res = await request.get("/api/dashboard-snapshot", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

/** Fetch the observatory snapshot from the API. */
export async function fetchObservatorySnapshot(
  request: APIRequestContext,
  token: string,
) {
  const res = await request.get("/api/observatory-snapshot", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

/** Normalize a GM name for case-insensitive comparison. */
function normalizeGmName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Normalize a branch key for case-insensitive comparison. */
export function normalizeBranchKey(branch: string): string {
  return branch.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Extract a GM's data block from the snapshot, matching by display name. */
export function extractGMData(
  snapshot: Record<string, unknown>,
  displayName: string,
): Record<string, unknown> | null {
  const gms = (snapshot as { gms?: Record<string, unknown> }).gms;
  if (!gms) return null;
  const norm = normalizeGmName(displayName);
  const key = Object.keys(gms).find((k) => normalizeGmName(k) === norm);
  return key ? (gms[key] as Record<string, unknown>) : null;
}

/**
 * Compute expected change-tag value for a rate metric (absolute pp change).
 * Returns null when either value is null/undefined.
 */
export function ppChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null) return null;
  return Math.round(current - previous);
}

/**
 * Compute expected change-tag value for a count metric (relative % change).
 * Returns null when the previous value is 0 or either value is null.
 */
export function relChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null) return null;
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Extract a BM's branch data block from the snapshot, matching by branch key. */
export function extractBMData(
  snapshot: Record<string, unknown>,
  branch: string,
): Record<string, unknown> | null {
  const branches = (snapshot as { branches?: Record<string, unknown> }).branches;
  if (!branches) return null;
  const direct = branches[branch] as Record<string, unknown> | undefined;
  if (direct) return direct;
  const norm = normalizeBranchKey(branch);
  const key = Object.keys(branches).find(
    (k) => normalizeBranchKey(k) === norm,
  );
  return key ? (branches[key] as Record<string, unknown>) : null;
}

/**
 * Compute inverted relative change for "lower is better" metrics.
 * Positive result means improvement (value decreased).
 */
export function invertedRelChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null) return null;
  if (previous === 0) return null;
  return Math.round(((previous - current) / previous) * 100);
}

/** Format raw minutes to display string like "1h 15m", "45m", or "2d 3h". */
export function formatMinutesToDisplay(min: number): string {
  if (min == null || min < 0) return "—";
  if (min < 60) return `${Math.round(min)}m`;
  if (min < 24 * 60) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(min / (24 * 60));
  const remainder = min % (24 * 60);
  const h = Math.round(remainder / 60);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}
