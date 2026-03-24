import { useData } from "../../context/DataContext";
import { formatDate, formatTime } from "../../utils/dateTime";

function formatDataTimestamp(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${formatDate(d)} at ${formatTime(d)} ET`;
  } catch {
    return dateStr;
  }
}

/**
 * Fixed banner at top of every page.
 * Shows the last HLES upload timestamp, and a "Fetching and updating dashboard"
 * indicator when stale cached data is being refreshed in the background.
 */
export default function DataBanner() {
  const { dataAsOfDate, isRefreshing, initialDataReady } = useData();

  const showRefreshing = isRefreshing && initialDataReady;

  if (!dataAsOfDate && !showRefreshing) return null;

  return (
    <div
      className="shrink-0 flex items-center justify-center gap-2 py-1.5 px-4 bg-[var(--color-info-light)] border-2 border-[var(--color-info)]/40 text-sm text-[var(--color-info)]"
      role="status"
      aria-live="polite"
    >
      <svg className="w-4 h-4 text-[var(--color-info)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className="font-medium">
        {dataAsOfDate
          ? `Last HLES file upload ${formatDataTimestamp(dataAsOfDate)}`
          : "No HLES data uploaded yet"}
      </span>
      {showRefreshing && (
        <>
          <span className="text-[var(--color-info)]/60 mx-1">|</span>
          <div className="w-3.5 h-3.5 border-2 border-[var(--color-info)]/40 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="font-medium text-[var(--color-info)]">Fetching and updating dashboard&hellip;</span>
        </>
      )}
    </div>
  );
}
