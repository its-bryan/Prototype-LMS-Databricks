import { useState, useMemo, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import BackButton from "../BackButton";
import {
  resolveGMName,
  normalizeGmName,
} from "../../selectors/demoSelectors";
import { formatDateShort } from "../../utils/dateTime";
import { GMMeetingPrepSkeleton, usePageTransition } from "../DashboardSkeleton";

const easeOut = [0.4, 0, 0.2, 1];

const pulseKeyframes = `
@keyframes pulse-border {
  0%, 100% { box-shadow: 0 0 0 0 rgba(244, 195, 0, 0.45); }
  50% { box-shadow: 0 0 0 6px rgba(244, 195, 0, 0); }
}
`;


/**
 * Build week objects from backend weekStart strings.
 */
function buildWeeks(weekRows) {
  return weekRows.map((r) => {
    const sat = new Date(r.weekStart + "T12:00:00Z");
    const fri = new Date(sat.getTime() + 6 * 86400000);
    return {
      start: sat,
      end: fri,
      key: r.weekStart,
      endKey: fri.toISOString().slice(0, 10),
      label: `${formatDateShort(sat)} — ${formatDateShort(fri)}`,
    };
  });
}

export default function GMMeetingPrepAllWeeks() {
  const { orgMapping, fetchLeadWeeks, initialDataReady } = useData();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const reduceMotion = useReducedMotion();

  const gmName = useMemo(() => {
    const name = userProfile?.displayName;
    if (!name) return resolveGMName(null, userProfile?.id);
    const nm = normalizeGmName(name);
    if ((orgMapping ?? []).some((r) => r.gm && normalizeGmName(r.gm) === nm)) return name;
    return resolveGMName(name, userProfile?.id);
  }, [userProfile?.displayName, userProfile?.id, orgMapping]);

  const [weeks, setWeeks] = useState([]);
  const [weeksLoading, setWeeksLoading] = useState(true);

  // Highlight the most recent week (first in the list, since sorted newest-first)
  const mostRecentKey = weeks.length > 0 ? weeks[0].key : null;

  useEffect(() => {
    if (!gmName) {
      setWeeks([]);
      setWeeksLoading(false);
      return;
    }
    let cancelled = false;
    setWeeksLoading(true);

    fetchLeadWeeks({ gmName })
      .then((res) => {
        if (cancelled) return;
        setWeeks(buildWeeks(res ?? []));
      })
      .catch(() => {
        if (cancelled) return;
        setWeeks([]);
      })
      .finally(() => {
        if (!cancelled) setWeeksLoading(false);
      });

    return () => { cancelled = true; };
  }, [gmName, fetchLeadWeeks]);

  const pageReady = usePageTransition();
  if (!initialDataReady || !pageReady) return <GMMeetingPrepSkeleton />;

  return (
    <div className="max-w-6xl">
      <style>{pulseKeyframes}</style>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
        <BackButton onClick={() => navigate("/gm/meeting-prep")} label="Back to Meeting Prep" />
        <h1 className="text-2xl font-extrabold text-[var(--hertz-black)] tracking-tight mb-1">
          All Meetings
        </h1>
        <p className="text-sm text-[var(--neutral-600)]">
          Meeting prep for each HLES week (Saturday–Friday).
          {!weeksLoading && ` ${weeks.length} week${weeks.length !== 1 ? "s" : ""} available.`}
        </p>
      </motion.div>

      {weeksLoading ? (
        <div className="border border-[var(--neutral-200)] rounded-xl bg-white px-6 py-12 text-center">
          <p className="text-sm text-[var(--neutral-500)]">Loading weeks...</p>
        </div>
      ) : weeks.length === 0 ? (
        <div className="border border-[var(--neutral-200)] rounded-xl bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-[var(--hertz-black)]">No weeks available</p>
          <p className="text-xs text-[var(--neutral-500)] mt-1">
            Upload an HLES file to see meeting prep data for each week.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {weeks.map((week) => {
            const isCurrent = week.key === mostRecentKey;
            return (
              <motion.div
                key={week.key}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      isCurrent
                        ? "/gm/meeting-prep"
                        : `/gm/meeting-prep?start=${week.key}&end=${week.endKey}`
                    )
                  }
                  className={`w-full border rounded-xl shadow-[var(--shadow-sm)] px-5 py-4 text-left flex items-center justify-between gap-4 transition-colors cursor-pointer ${
                    isCurrent
                      ? "border-[var(--hertz-primary)] bg-[var(--hertz-primary-subtle)] hover:bg-[var(--hertz-primary)]/15"
                      : "border-[var(--neutral-200)] bg-white hover:bg-[var(--neutral-50)]"
                  }`}
                  style={isCurrent ? { animation: "pulse-border 2s ease-in-out infinite" } : undefined}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-[var(--hertz-black)]">
                      Week of {week.label}
                    </h3>
                    <p className="text-xs text-[var(--neutral-500)] mt-0.5">
                      {isCurrent ? "View current meeting prep" : "View meeting prep for this week"}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-[var(--neutral-400)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
