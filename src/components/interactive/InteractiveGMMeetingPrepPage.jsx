import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import BackButton from "../BackButton";
import {
  getTasksForGMBranches,
  getGMTasksProgress,
  getDateRangePresets,
  getNextComplianceMeetingDate,
  getWinsLearningsForGM,
  resolveGMName,
  getBranchesForGM,
  normalizeGmName,
} from "../../selectors/demoSelectors";
import StatusBadge from "../StatusBadge";

import { formatDateShort } from "../../utils/dateTime";
import ThreeColumnReview from "../ThreeColumnReview";
import BranchComplianceDetailPane from "./BranchComplianceDetailPane";
import GMPresentationMode from "./GMPresentationMode";
import { GMMeetingPrepSkeleton, usePageTransition } from "../DashboardSkeleton";

const easeOut = [0.4, 0, 0.2, 1];

/** Color code modules by progress %: 0-50% red, 50-99% yellow, 100% neutral (done = no attention needed) */
function getProgressModuleColors(progressPct) {
  if (progressPct >= 100) return { bg: "bg-[var(--neutral-50)]", border: "border-[var(--neutral-200)]", bar: "var(--neutral-400)" };
  if (progressPct >= 50) return { bg: "bg-amber-50", border: "border-amber-200", bar: "var(--hertz-primary)" };
  return { bg: "bg-red-50", border: "border-red-200", bar: "#C62828" };
}

const cardAnim = (i, reduced = false) => ({
  initial: reduced ? false : { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: reduced ? 0 : i * 0.06, duration: reduced ? 0.01 : 0.4, ease: easeOut },
});


function formatDueDate(dueStr) {
  if (!dueStr) return "—";
  const d = new Date(dueStr + "T23:59:59");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.ceil((dueDay - today) / 86400000);
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return formatDateShort(d);
}

export default function InteractiveGMMeetingPrepPage() {
  const { loading, orgMapping, createComplianceTasksForBranch, winsLearnings, updateLeadDirective, markLeadReviewed, gmTasks, fetchGMTasks, fetchLeadsPage, fetchGMTasksPage, fetchGMMeetingPrepStats, initialDataReady } = useData();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const reduceMotion = useReducedMotion();
  const presets = useMemo(() => getDateRangePresets(), [loading]);
  const selectedPresetKey = "trailing_4_weeks";
  const [branchComplianceExpanded, setBranchComplianceExpanded] = useState(false);
  const [selectedBranchForDetail, setSelectedBranchForDetail] = useState(null);
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [leadsExpanded, setLeadsExpanded] = useState(false);
  const [unreachableExpanded, setUnreachableExpanded] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const pageSize = 20;
  const [leadsPageOffset, setLeadsPageOffset] = useState(0);
  const [leadsPageTotal, setLeadsPageTotal] = useState(0);
  const [pagedLeadsToReview, setPagedLeadsToReview] = useState([]);
  const [leadsPageLoading, setLeadsPageLoading] = useState(false);
  const [tasksPageOffset, setTasksPageOffset] = useState(0);
  const [tasksPageTotal, setTasksPageTotal] = useState(0);
  const [pagedOpenTasks, setPagedOpenTasks] = useState([]);
  const [tasksPageLoading, setTasksPageLoading] = useState(false);
  const [meetingPrepData, setMeetingPrepData] = useState({
    branchChecklist: [],
    totalOutstanding: 0,
    branchesComplete: 0,
    totalBranches: 0,
  });
  const [unreachableStats, setUnreachableStats] = useState({
    count: 0,
    pct: 0,
    total: 0,
    branchBreakdown: [],
    leads: [],
  });
  const [leadsToReviewTotal, setLeadsToReviewTotal] = useState(0);
  const [leadsReviewed, setLeadsReviewed] = useState(0);

  const [directive, setDirective] = useState("");
  const [directiveSaved, setDirectiveSaved] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [presentationSnapshot, setPresentationSnapshot] = useState(null);
  const panelRef = useRef(null);

  const currentPreset = presets.find((p) => p.key === selectedPresetKey);
  const dateRange = useMemo(
    () => (currentPreset ? { start: currentPreset.start, end: currentPreset.end } : null),
    [currentPreset],
  );

  const gmName = useMemo(() => {
    const name = userProfile?.displayName;
    if (!name) return resolveGMName(null, userProfile?.id);
    const nm = normalizeGmName(name);
    if ((orgMapping ?? []).some((r) => r.gm && normalizeGmName(r.gm) === nm)) return name;
    return resolveGMName(name, userProfile?.id);
  }, [userProfile?.displayName, userProfile?.id, orgMapping]);
  const gmBranches = useMemo(() => getBranchesForGM(gmName), [gmName]);

  useEffect(() => {
    if (gmBranches.length > 0 && fetchGMTasks) {
      fetchGMTasks(gmBranches);
    }
  }, [gmBranches, fetchGMTasks]);

  useEffect(() => {
    setLeadsPageOffset(0);
  }, [gmName, dateRange?.start, dateRange?.end]);

  useEffect(() => {
    setTasksPageOffset(0);
  }, [gmBranches.join(",")]);

  useEffect(() => {
    let cancelled = false;
    if (!gmName) {
      setMeetingPrepData({
        branchChecklist: [],
        totalOutstanding: 0,
        branchesComplete: 0,
        totalBranches: 0,
      });
      setUnreachableStats({
        count: 0,
        pct: 0,
        total: 0,
        branchBreakdown: [],
        leads: [],
      });
      setLeadsToReviewTotal(0);
      setLeadsReviewed(0);
      return;
    }
    fetchGMMeetingPrepStats({
      gmName,
      startDate: dateRange?.start ?? null,
      endDate: dateRange?.end ?? null,
    })
      .then((res) => {
        if (cancelled) return;
        setMeetingPrepData(res?.meetingPrepData ?? {
          branchChecklist: [],
          totalOutstanding: 0,
          branchesComplete: 0,
          totalBranches: 0,
        });
        setUnreachableStats(res?.unreachableStats ?? {
          count: 0,
          pct: 0,
          total: 0,
          branchBreakdown: [],
          leads: [],
        });
        setLeadsToReviewTotal(res?.leadsToReviewTotal ?? 0);
        setLeadsReviewed(res?.leadsReviewed ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setMeetingPrepData({
          branchChecklist: [],
          totalOutstanding: 0,
          branchesComplete: 0,
          totalBranches: 0,
        });
        setUnreachableStats({
          count: 0,
          pct: 0,
          total: 0,
          branchBreakdown: [],
          leads: [],
        });
        setLeadsToReviewTotal(0);
        setLeadsReviewed(0);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchGMMeetingPrepStats, gmName, dateRange?.start, dateRange?.end]);

  useEffect(() => {
    let cancelled = false;
    if (!gmName) {
      setPagedLeadsToReview([]);
      setLeadsPageTotal(0);
      return;
    }
    setLeadsPageLoading(true);
    fetchLeadsPage({
      gmName,
      startDate: dateRange?.start ?? null,
      endDate: dateRange?.end ?? null,
      limit: pageSize,
      offset: leadsPageOffset,
    })
      .then((res) => {
        if (cancelled) return;
        setPagedLeadsToReview(res?.items ?? []);
        setLeadsPageTotal(res?.total ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setPagedLeadsToReview([]);
        setLeadsPageTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLeadsPageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchLeadsPage, gmName, dateRange?.start, dateRange?.end, leadsPageOffset]);

  useEffect(() => {
    let cancelled = false;
    if (!gmBranches.length) {
      setPagedOpenTasks([]);
      setTasksPageTotal(0);
      return;
    }
    setTasksPageLoading(true);
    fetchGMTasksPage(gmBranches, {
      statuses: "Open,In Progress",
      limit: pageSize,
      offset: tasksPageOffset,
    })
      .then((res) => {
        if (cancelled) return;
        setPagedOpenTasks(res?.items ?? []);
        setTasksPageTotal(res?.total ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setPagedOpenTasks([]);
        setTasksPageTotal(0);
      })
      .finally(() => {
        if (!cancelled) setTasksPageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchGMTasksPage, gmBranches, tasksPageOffset]);

  const gmTasksLoading = gmTasks === null;
  const effectiveGmTasks = gmTasksLoading ? [] : gmTasks;
  const openTasks = useMemo(() => getTasksForGMBranches(effectiveGmTasks, gmName), [effectiveGmTasks, gmName]);
  const tasksProgress = useMemo(() => getGMTasksProgress(effectiveGmTasks, gmName), [effectiveGmTasks, gmName]);
  const leadsProgressPct = leadsToReviewTotal > 0 ? Math.round((leadsReviewed / leadsToReviewTotal) * 100) : 100;
  const { dateStr: meetingDateStr, daysLeft, date: meetingDate } = useMemo(() => getNextComplianceMeetingDate(), []);
  const meetingDueDateStr = meetingDate ? meetingDate.toISOString().slice(0, 10) : null;

  const selectedLead = selectedLeadId ? pagedLeadsToReview.find((l) => l.id === selectedLeadId) : null;
  const winsLearningsForGM = useMemo(() => getWinsLearningsForGM(winsLearnings ?? [], gmName), [winsLearnings, gmName]);

  // Freeze data snapshot when opening presentation so it can't change mid-meeting
  const handleOpenPresentation = useCallback(() => {
    setPresentationSnapshot({
      frozenLeads: [...pagedLeadsToReview],
      frozenWinsLearnings: [...(winsLearnings ?? [])],
      dateRange,
      compRange: null,
      meetingDateStr,
      gmName,
    });
    setShowPresentation(true);
  }, [pagedLeadsToReview, winsLearnings, dateRange, meetingDateStr, gmName]);

  useEffect(() => {
    if (selectedLead && panelRef.current) {
      panelRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [selectedLeadId]);

  const [directiveSaving, setDirectiveSaving] = useState(false);
  const [reviewedLeadId, setReviewedLeadId] = useState(null);

  const handleSaveDirective = async () => {
    if (!directive.trim() || !selectedLeadId) return;
    setDirectiveSaving(true);
    try {
      await updateLeadDirective(selectedLeadId, directive.trim());
      setDirective("");
      setDirectiveSaved(true);
      setTimeout(() => setDirectiveSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save directive:", err);
    } finally {
      setDirectiveSaving(false);
    }
  };

  const handleMarkReviewed = async (leadId) => {
    const targetId = leadId ?? selectedLeadId;
    if (!targetId) return;
    try {
      await markLeadReviewed(targetId);
      setReviewedLeadId(targetId);
      if (targetId === selectedLeadId) setSelectedLeadId(null);
      setTimeout(() => setReviewedLeadId(null), 3000);
    } catch (err) {
      console.error("Failed to mark lead reviewed:", err);
    }
  };

  const handleViewTask = (taskId) => {
    navigate(`/gm/tasks/${taskId}`);
  };

  const handleViewLead = (leadId) => {
    navigate(`/gm/leads/${leadId}`);
  };

  const pageReady = usePageTransition();
  if (!initialDataReady || !pageReady) return <GMMeetingPrepSkeleton />;

  return (
    <div className="max-w-6xl">
      {/* Fullscreen presentation overlay — rendered above everything */}
      <AnimatePresence>
        {showPresentation && presentationSnapshot && (
          <GMPresentationMode
            {...presentationSnapshot}
            onClose={() => setShowPresentation(false)}
          />
        )}
      </AnimatePresence>


      {/* Header — GM chase-up framing */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
        <BackButton onClick={() => navigate("/gm/work")} label="Back to Work" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-[var(--hertz-black)] tracking-tight mb-1">
              Meeting Prep — Chase Up
            </h1>
            <p className="text-sm text-[var(--neutral-600)]">
              Review outstanding tasks assigned to your team and follow up before the Thursday compliance meeting.
              Weekly Compliance Meeting: {meetingDateStr}
              {daysLeft >= 0 && (
                <span className="font-semibold text-[var(--hertz-black)]">
                  — {daysLeft === 0 ? "today" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}
                </span>
              )}
            </p>
          </div>
          {/* Present button — opens fullscreen branded slide deck */}
          <motion.button
            onClick={handleOpenPresentation}
            whileHover={!reduceMotion ? { scale: 1.03 } : {}}
            whileTap={!reduceMotion ? { scale: 0.97 } : {}}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm bg-[var(--hertz-black)] text-[var(--hertz-primary)] border border-[var(--hertz-black)] hover:bg-[var(--hertz-primary)] hover:text-[var(--hertz-black)] transition-all duration-200 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            Present
          </motion.button>
        </div>
      </motion.div>

      {/* 1. Leads needing review — first */}
      <motion.div {...cardAnim(1, reduceMotion)} className="mb-6">
        <h3 className="text-sm font-bold text-[var(--hertz-black)] uppercase tracking-wider mb-3">
          Leads Needing Review
        </h3>
        {(() => {
          const colors = getProgressModuleColors(leadsProgressPct);
          return (
            <>
              <button
                type="button"
                onClick={() => setLeadsExpanded((prev) => !prev)}
                className={`w-full rounded-lg px-5 py-4 text-left transition-colors cursor-pointer flex items-center justify-between gap-4 ${colors.bg} border ${colors.border} hover:opacity-90`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--hertz-black)]">
                    {leadsToReviewTotal === 0
                      ? "No leads to review"
                      : `${leadsReviewed} of ${leadsToReviewTotal} leads reviewed`}
                  </p>
                  <p className="text-xs text-[var(--neutral-600)] mt-0.5">
                    {leadsToReviewTotal === 0
                      ? "No cancelled or unused leads in this period."
                      : leadsToReviewTotal - leadsReviewed > 0
                        ? `${leadsToReviewTotal - leadsReviewed} cancelled and unused lead${leadsToReviewTotal - leadsReviewed !== 1 ? "s" : ""} — add directives or review before the meeting`
                        : "All leads reviewed — no outstanding items."}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-32 h-2 bg-[var(--neutral-200)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${leadsProgressPct}%`,
                        backgroundColor: colors.bar,
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-[var(--hertz-black)] w-8">
                    {leadsProgressPct}%
                  </span>
                  <motion.svg
                    className="w-5 h-5 text-[var(--hertz-black)] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    animate={{ rotate: leadsExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </motion.svg>
                </div>
              </button>

              <AnimatePresence>
                {leadsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: easeOut }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 flex gap-4">
                      <div className={`border border-[var(--neutral-200)] rounded-lg overflow-hidden bg-white ${selectedLead ? "w-1/2" : "w-full"} transition-all duration-300`}>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-[var(--hertz-black)] text-xs text-white font-semibold uppercase tracking-wider">
                              <th className="px-4 py-3 text-left">Date</th>
                              <th className="px-4 py-3 text-left">Customer</th>
                              <th className="px-4 py-3 text-left">Status</th>
                              <th className="px-4 py-3 text-left">Branch</th>
                            </tr>
                          </thead>
                          <tbody>
                            {!leadsPageLoading && pagedLeadsToReview.length === 0 ? (
                              <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--neutral-500)]">No leads to review.</td></tr>
                            ) : (
                              pagedLeadsToReview.map((lead) => (
                                <tr
                                  key={lead.id}
                                  onClick={() => { setSelectedLeadId(lead.id); setDirective(""); setDirectiveSaved(false); }}
                                  className={`border-t border-[var(--neutral-100)] cursor-pointer transition-colors ${selectedLeadId === lead.id ? "bg-[var(--hertz-primary-subtle)]" : "hover:bg-[var(--neutral-50)]"}`}
                                >
                                  <td className="px-4 py-3 text-[var(--neutral-600)] text-xs">
                                    {lead.initDtFinal ? formatDateShort(new Date(lead.initDtFinal + "T12:00:00")) : "—"}
                                  </td>
                                  <td className="px-4 py-3 font-semibold text-[var(--hertz-black)]">{lead.customer}</td>
                                  <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                                  <td className="px-4 py-3 text-[var(--neutral-600)]">{lead.branch}</td>
                                </tr>
                              ))
                            )}
                            {leadsPageLoading &&
                              Array.from({ length: 6 }).map((_, idx) => (
                                <tr key={`lp-${idx}`} className="border-t border-[var(--neutral-100)] animate-pulse">
                                  <td className="px-4 py-3"><div className="h-3 w-16 rounded bg-[var(--neutral-200)]" /></td>
                                  <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-[var(--neutral-200)]" /></td>
                                  <td className="px-4 py-3"><div className="h-5 w-16 rounded-full bg-[var(--neutral-200)]" /></td>
                                  <td className="px-4 py-3"><div className="h-3 w-20 rounded bg-[var(--neutral-200)]" /></td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        <div className="px-4 py-2 border-t border-[var(--neutral-200)] flex items-center justify-between text-xs text-[var(--neutral-600)]">
                          <span>
                            {leadsPageTotal === 0
                              ? "0 results"
                              : `Showing ${leadsPageOffset + 1}-${Math.min(leadsPageOffset + pageSize, leadsPageTotal)} of ${leadsPageTotal}`}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setLeadsPageOffset((prev) => Math.max(0, prev - pageSize))}
                              disabled={leadsPageOffset === 0 || leadsPageLoading}
                              className="px-2.5 py-1 rounded border border-[var(--neutral-200)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--neutral-50)]"
                            >
                              Prev
                            </button>
                            <button
                              type="button"
                              onClick={() => setLeadsPageOffset((prev) => prev + pageSize)}
                              disabled={leadsPageLoading || leadsPageOffset + pageSize >= leadsPageTotal}
                              className="px-2.5 py-1 rounded border border-[var(--neutral-200)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--neutral-50)]"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {selectedLead && (
                          <motion.div
                            ref={panelRef}
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: "50%", opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: easeOut }}
                            className="border border-[var(--neutral-200)] rounded-lg bg-white overflow-y-auto"
                            style={{ maxHeight: 600 }}
                          >
                            <div className="px-5 py-4">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-bold text-[var(--hertz-black)]">{selectedLead.customer}</h4>
                                <button
                                  onClick={() => setSelectedLeadId(null)}
                                  className="text-[var(--neutral-400)] hover:text-[var(--hertz-black)] transition-colors cursor-pointer"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>

                              <ThreeColumnReview lead={selectedLead} showMismatchWarning={!!selectedLead.mismatch} />

                              <div className="mt-4 pt-4 border-t border-[var(--neutral-200)]">
                                <label className="text-xs font-bold text-[var(--hertz-black)] uppercase tracking-wider">GM Directive</label>
                                {selectedLead.gmDirective && (
                                  <div className="mt-2 mb-2 px-3 py-2 bg-[var(--neutral-50)] rounded-lg text-sm text-[var(--neutral-600)]">
                                    <span className="font-medium text-[var(--hertz-black)]">Previous:</span> {selectedLead.gmDirective}
                                  </div>
                                )}
                                <textarea
                                  value={directive}
                                  onChange={(e) => setDirective(e.target.value)}
                                  placeholder="Add a directive for this lead..."
                                  className="w-full mt-2 px-3 py-2 border border-[var(--neutral-200)] rounded-lg text-sm resize-none focus:outline-none focus:border-[var(--hertz-primary)] focus:ring-1 focus:ring-[var(--hertz-primary)]"
                                  rows={3}
                                />
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    onClick={handleSaveDirective}
                                    disabled={!directive.trim() || directiveSaving}
                                    className="px-4 py-1.5 bg-[var(--hertz-primary)] text-[var(--hertz-black)] rounded-lg text-sm font-medium hover:bg-[var(--hertz-primary-hover)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {directiveSaving ? "Saving..." : "Send Directive"}
                                  </button>
                                  <button
                                    onClick={() => handleMarkReviewed()}
                                    className="px-4 py-1.5 border border-[var(--neutral-300)] text-[var(--hertz-black)] rounded-lg text-sm font-medium hover:bg-[var(--neutral-100)] transition-colors cursor-pointer flex items-center gap-1.5"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Mark Reviewed
                                  </button>
                                  {directiveSaved && (
                                    <span className="text-xs text-[var(--color-success)] font-medium">Directive saved</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          );
        })()}
      </motion.div>

      {/* 2. Branch compliance — second */}
      <motion.div {...cardAnim(2, reduceMotion)} className="mb-6">
        <h3 className="text-sm font-bold text-[var(--hertz-black)] uppercase tracking-wider mb-3">
          Branch Compliance — Who Needs Follow Up
        </h3>
        {(() => {
          const branchProgressPct =
            meetingPrepData.totalBranches > 0
              ? Math.round((meetingPrepData.branchesComplete / meetingPrepData.totalBranches) * 100)
              : meetingPrepData.totalOutstanding > 0
                ? 0
                : 100;
          const colors = getProgressModuleColors(branchProgressPct);
          return (
            <button
              type="button"
              onClick={() => setBranchComplianceExpanded((prev) => !prev)}
              className={`w-full rounded-lg px-5 py-4 text-left transition-colors cursor-pointer flex items-center justify-between gap-4 ${colors.bg} border ${colors.border} hover:opacity-90`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--hertz-black)]">
                  {meetingPrepData.branchesComplete} of {meetingPrepData.totalBranches} branches are fully compliant
                </p>
                <p className="text-xs text-[var(--neutral-600)] mt-0.5">
                  {meetingPrepData.totalOutstanding > 0
                    ? `${meetingPrepData.totalOutstanding} lead${meetingPrepData.totalOutstanding !== 1 ? "s" : ""} need action (cancelled without BM comment, unused without BM activity in ${currentPreset?.label ?? "the selected period"}, or data mismatch)`
                    : "All branches are up to date for those rules."}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-32 h-2 bg-[var(--neutral-200)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${branchProgressPct}%`,
                      backgroundColor: colors.bar,
                    }}
                  />
                </div>
                <span className="text-xs font-semibold text-[var(--hertz-black)] w-8">
                  {branchProgressPct}%
                </span>
                <motion.svg
                  className="w-5 h-5 text-[var(--hertz-black)] shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  animate={{ rotate: branchComplianceExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </motion.svg>
              </div>
            </button>
          );
        })()}

        {/* Expandable per-branch breakdown — revealed when module is clicked */}
        <AnimatePresence>
          {branchComplianceExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: easeOut }}
              className="overflow-hidden"
            >
              <div className="mt-3 border border-[var(--neutral-200)] rounded-lg overflow-hidden bg-white">
                <p className="px-4 py-2 text-xs text-[var(--neutral-500)] bg-[var(--neutral-50)] border-b border-[var(--neutral-200)]">
                  Compliance counts all open cancelled (no BM notes) and unused (no BM activity in {currentPreset?.label ?? "selected range"}), not just leads received in that range.
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--hertz-black)] text-xs text-white font-semibold uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Branch</th>
                      <th className="px-4 py-3 text-left">BM</th>
                      <th className="px-4 py-3 text-center">Outstanding</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center gap-1">
                          Actions
                          <span className="relative group/tip cursor-help">
                            <svg className="w-3.5 h-3.5 opacity-60" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 text-xs font-normal normal-case tracking-normal text-white bg-[var(--hertz-black)] rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                              When you click &quot;Create Tasks&quot;, it will send a task/reminder for all leads that need a comment to the branch manager
                            </span>
                          </span>
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetingPrepData.branchChecklist.map((row) => (
                      <BranchChecklistRow
                        key={row.branch}
                        row={row}
                        outstandingLeads={row.outstandingLeads ?? []}
                        meetingDueDateStr={meetingDueDateStr}
                        gmName={resolveGMName(userProfile?.displayName, userProfile?.id)}
                        gmUserId={userProfile?.id ?? null}
                        createComplianceTasksForBranch={createComplianceTasksForBranch}
                        onRowClick={() => setSelectedBranchForDetail(row)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 3. Tasks to chase — last */}
      <motion.div {...cardAnim(3, reduceMotion)}>
        <h3 className="text-sm font-bold text-[var(--hertz-black)] uppercase tracking-wider mb-3">
          Tasks to Chase
        </h3>
        {(() => {
          const colors = getProgressModuleColors(tasksProgress.progressPct);
          return (
            <>
              <button
                type="button"
                onClick={() => setTasksExpanded((prev) => !prev)}
                className={`w-full rounded-lg px-5 py-4 text-left transition-colors cursor-pointer flex items-center justify-between gap-4 ${colors.bg} border ${colors.border} hover:opacity-90`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--hertz-black)]">
                    {tasksProgress.completed} of {tasksProgress.total} tasks complete
                  </p>
                  <p className="text-xs text-[var(--neutral-600)] mt-0.5">
                    {openTasks.length > 0
                      ? `${openTasks.length} open task${openTasks.length !== 1 ? "s" : ""} across your branches — chase these before the meeting`
                      : "All tasks assigned to your team are complete."}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-32 h-2 bg-[var(--neutral-200)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${tasksProgress.progressPct}%`,
                        backgroundColor: colors.bar,
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-[var(--hertz-black)] w-8">
                    {tasksProgress.progressPct}%
                  </span>
                  <motion.svg
                    className="w-5 h-5 text-[var(--hertz-black)] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    animate={{ rotate: tasksExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </motion.svg>
                </div>
              </button>

              <AnimatePresence>
                {tasksExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: easeOut }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 border border-[var(--neutral-200)] rounded-lg overflow-hidden bg-white">
                      {gmTasksLoading || tasksPageLoading ? (
                        <div className="px-6 py-8 text-center">
                          <p className="text-[var(--neutral-600)]">Loading tasks…</p>
                        </div>
                      ) : tasksPageTotal === 0 ? (
                        <div className="px-6 py-8 text-center">
                          <p className="text-[var(--neutral-600)]">No open tasks to chase. All tasks assigned to your team are complete.</p>
                        </div>
                      ) : (
                        <>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-[var(--hertz-black)] text-xs text-white font-semibold uppercase tracking-wider">
                                <th className="px-4 py-3 text-left">Follow up with</th>
                                <th className="px-4 py-3 text-left">Task</th>
                                <th className="px-4 py-3 text-left">Lead</th>
                                <th className="px-4 py-3 text-center">Due</th>
                                <th className="px-4 py-3 text-center">Priority</th>
                                <th className="px-4 py-3 text-center w-10"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {pagedOpenTasks.map((task) => {
                                const lead = task.lead ?? null;
                                const overdue = task.dueDate && new Date(task.dueDate + "T23:59:59") < new Date();
                                return (
                                  <tr
                                    key={task.id}
                                    onClick={() => handleViewTask(task.id)}
                                    className={`border-t border-[var(--neutral-100)] cursor-pointer transition-colors hover:bg-[var(--neutral-50)] ${
                                      overdue ? "bg-red-50/50" : ""
                                    }`}
                                  >
                                    <td className="px-4 py-3">
                                      <div className="font-semibold text-[var(--hertz-black)]">{task.assignedToName ?? "—"}</div>
                                      <div className="text-xs text-[var(--neutral-500)]">{task.assignedBranch}</div>
                                    </td>
                                    <td className="px-4 py-3 text-[var(--neutral-700)]">{task.title}</td>
                                    <td className="px-4 py-3 text-[var(--neutral-600)]">
                                      {lead ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewLead(lead.id);
                                          }}
                                          className="text-left hover:underline font-medium text-[var(--hertz-black)]"
                                        >
                                          {lead.customer}
                                        </button>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={overdue ? "text-red-600 font-semibold" : "text-[var(--neutral-600)]"}>
                                        {formatDueDate(task.dueDate)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span
                                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                          task.priority === "High"
                                            ? "bg-amber-100 text-amber-800"
                                            : task.priority === "Medium"
                                              ? "bg-[var(--neutral-100)] text-[var(--neutral-600)]"
                                              : "bg-[var(--neutral-100)] text-[var(--neutral-500)]"
                                        }`}
                                      >
                                        {task.priority}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className="text-[var(--neutral-400)]">
                                        <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <div className="px-4 py-2 text-xs text-[var(--neutral-500)] border-t border-[var(--neutral-100)] flex items-center justify-between">
                            <span>
                              {tasksPageTotal === 0
                                ? "0 results"
                                : `Showing ${tasksPageOffset + 1}-${Math.min(tasksPageOffset + pageSize, tasksPageTotal)} of ${tasksPageTotal}`}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setTasksPageOffset((prev) => Math.max(0, prev - pageSize))}
                                disabled={tasksPageOffset === 0 || tasksPageLoading}
                                className="px-2.5 py-1 rounded border border-[var(--neutral-200)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--neutral-50)]"
                              >
                                Prev
                              </button>
                              <button
                                type="button"
                                onClick={() => setTasksPageOffset((prev) => prev + pageSize)}
                                disabled={tasksPageLoading || tasksPageOffset + pageSize >= tasksPageTotal}
                                className="px-2.5 py-1 rounded border border-[var(--neutral-200)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--neutral-50)]"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          );
        })()}
      </motion.div>

      {/* 4. Unreachable leads — cancelled/unused with zero contact attempt (David's Bucket 3) */}
      <motion.div {...cardAnim(4, reduceMotion)} className="mt-6">
        <h3 className="text-sm font-bold text-[var(--hertz-black)] uppercase tracking-wider mb-3">
          Leads With No Contact Attempt
        </h3>
        {(() => {
          const hasLeads = unreachableStats.count > 0;
          // This is an alert state — even 1 lead here is a problem worth surfacing
          const alertColors = hasLeads
            ? { bg: "bg-red-50", border: "border-red-200" }
            : { bg: "bg-[var(--neutral-50)]", border: "border-[var(--neutral-200)]" };
          return (
            <>
              <button
                type="button"
                onClick={() => setUnreachableExpanded((prev) => !prev)}
                className={`w-full rounded-lg px-5 py-4 text-left transition-colors cursor-pointer flex items-center justify-between gap-4 ${alertColors.bg} border ${alertColors.border} hover:opacity-90`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--hertz-black)]">
                    {hasLeads
                      ? `${unreachableStats.count} lead${unreachableStats.count !== 1 ? "s" : ""} — no contact ever attempted`
                      : "No unreachable leads — all cancelled/unused leads had at least one contact attempt"}
                  </p>
                  <p className="text-xs text-[var(--neutral-600)] mt-0.5">
                    {hasLeads
                      ? `${unreachableStats.pct}% of cancelled/unused leads — these slipped through without a single call, email, or SMS from branch or HRD`
                      : "Good news — every lead in this period received at least one contact attempt."}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {hasLeads && (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#C62828]/15 text-[#C62828] text-xs font-bold">
                      {unreachableStats.count}
                    </span>
                  )}
                  <motion.svg
                    className="w-5 h-5 text-[var(--hertz-black)] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    animate={{ rotate: unreachableExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </motion.svg>
                </div>
              </button>

              <AnimatePresence>
                {unreachableExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: easeOut }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 border border-[var(--neutral-200)] rounded-lg overflow-hidden bg-white">
                      {!hasLeads ? (
                        <div className="px-6 py-8 text-center text-[var(--neutral-500)]">
                          No unreachable leads in this period.
                        </div>
                      ) : (
                        <>
                          {/* Per-branch summary header */}
                          {unreachableStats.branchBreakdown.length > 1 && (
                            <div className="px-4 py-3 bg-[var(--neutral-50)] border-b border-[var(--neutral-200)] flex flex-wrap gap-3">
                              {unreachableStats.branchBreakdown.map(({ branch, count }) => (
                                <span
                                  key={branch}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#C62828]/10 text-[#C62828]"
                                >
                                  {branch}
                                  <span className="font-bold">{count}</span>
                                </span>
                              ))}
                            </div>
                          )}
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-[var(--hertz-black)] text-xs text-white font-semibold uppercase tracking-wider">
                                <th className="px-4 py-3 text-left">Date</th>
                                <th className="px-4 py-3 text-left">Customer</th>
                                <th className="px-4 py-3 text-left">Status</th>
                                <th className="px-4 py-3 text-left">Branch</th>
                                <th className="px-4 py-3 text-left">BM</th>
                                <th className="px-4 py-3 text-left">HLES Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {unreachableStats.leads.map((lead) => (
                                <tr
                                  key={lead.id}
                                  onClick={() => handleViewLead(lead.id)}
                                  className="border-t border-[var(--neutral-100)] cursor-pointer transition-colors hover:bg-[var(--neutral-50)] group"
                                >
                                  <td className="px-4 py-3 text-[var(--neutral-600)] text-xs">
                                    {lead.initDtFinal ? formatDateShort(new Date(lead.initDtFinal + "T12:00:00")) : "—"}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-semibold text-[var(--hertz-black)]">{lead.customer}</div>
                                    {lead.reservationId && (
                                      <div className="text-xs text-[var(--neutral-500)]">{lead.reservationId}</div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                                  <td className="px-4 py-3 text-[var(--neutral-600)]">{lead.branch}</td>
                                  <td className="px-4 py-3 text-[var(--neutral-600)]">{lead.bmName ?? "—"}</td>
                                  <td className="px-4 py-3 text-[var(--neutral-500)] text-xs max-w-[200px] truncate" title={lead.hlesReason ?? ""}>
                                    {lead.hlesReason ?? "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="px-4 py-2 text-xs text-[var(--neutral-500)] border-t border-[var(--neutral-100)] flex items-center justify-between">
                            <span>Click a row to view the full lead detail</span>
                            <span>{unreachableStats.count} lead{unreachableStats.count !== 1 ? "s" : ""}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          );
        })()}
      </motion.div>

      {/* Section: Wins & Learnings — BM submissions displayed for GM review */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="mt-6"
      >
        <div className="border border-[var(--neutral-200)] rounded-xl bg-white shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--neutral-100)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--hertz-primary)] flex items-center justify-center text-[var(--hertz-black)] shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--hertz-black)]">Wins &amp; Learnings</h3>
                <p className="text-xs text-[var(--neutral-500)]">Submitted by your BMs — surfaces in the meeting presentation</p>
              </div>
            </div>
            {winsLearningsForGM.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--hertz-primary-subtle)] text-[var(--hertz-black)]">
                {winsLearningsForGM.length} submission{winsLearningsForGM.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {winsLearningsForGM.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-semibold text-[var(--hertz-black)]">No submissions yet</p>
              <p className="text-xs text-[var(--neutral-500)] mt-1">
                BMs can submit wins and learnings from their Meeting Prep page before Thursday.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--neutral-100)]">
              {winsLearningsForGM.slice(0, 6).map((entry) => (
                <div key={entry.id} className="px-5 py-3.5 flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--hertz-primary)] mt-2 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--hertz-black)] leading-relaxed">{entry.content}</p>
                    <p className="text-xs text-[var(--neutral-400)] mt-1">{entry.branch}</p>
                  </div>
                </div>
              ))}
              {winsLearningsForGM.length > 6 && (
                <p className="px-5 py-3 text-xs text-[var(--neutral-500)] text-center">
                  + {winsLearningsForGM.length - 6} more — all shown in the presentation
                </p>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Branch compliance detail pane — line-level data from row click */}
      <AnimatePresence>
        {selectedBranchForDetail && (
          <BranchComplianceDetailPane
            branchRow={selectedBranchForDetail}
            dateRange={dateRange}
            onClose={() => setSelectedBranchForDetail(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BranchChecklistRow({
  row,
  outstandingLeads = [],
  meetingDueDateStr,
  gmName,
  gmUserId,
  createComplianceTasksForBranch,
  onRowClick,
}) {
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState(null);

  const canCreate = !row.isComplete && outstandingLeads.length > 0;
  const isDisabled = !canCreate || creating;

  const handleCreateTasks = async (e) => {
    e.stopPropagation();
    if (!canCreate || creating) return;
    setCreating(true);
    setCreateResult(null);
    try {
      const result = await createComplianceTasksForBranch({
        branch: row.branch,
        bmName: row.bmName,
        outstandingLeads,
        dueDateStr: meetingDueDateStr,
        gmName,
        gmUserId,
      });
      setCreateResult(result);
    } catch (err) {
      setCreateResult({ created: 0, errors: [{ error: err?.message ?? String(err) }] });
    } finally {
      setCreating(false);
    }
  };

  return (
    <tr
      onClick={onRowClick}
      className="border-t border-[var(--neutral-100)] cursor-pointer transition-colors hover:bg-[var(--neutral-50)] group"
      title="Click to view line-level data"
    >
      <td className="px-4 py-3 font-semibold text-[var(--hertz-black)]">{row.branch}</td>
      <td className="px-4 py-3 text-[var(--neutral-600)]">{row.bmName}</td>
      <td className="px-4 py-3 text-center">
        {row.outstanding > 0 ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--hertz-primary-subtle)] text-[var(--hertz-black)]">
            {row.outstanding}
          </span>
        ) : (
          <span className="text-xs text-[var(--neutral-400)]">0</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {row.isComplete ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Complete
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
            Pending
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={handleCreateTasks}
          disabled={isDisabled}
          title={
            row.isComplete
              ? "Branch is compliant — no tasks needed"
              : outstandingLeads.length === 0
                ? "No outstanding items"
                : `Create ${outstandingLeads.length} task${outstandingLeads.length !== 1 ? "s" : ""} for ${row.bmName}`
          }
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            isDisabled
              ? "bg-[var(--neutral-100)] text-[var(--neutral-400)] cursor-not-allowed"
              : "bg-[var(--hertz-primary)] text-[var(--hertz-black)] hover:bg-[var(--hertz-primary-hover)]"
          }`}
        >
          {creating ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Creating…
            </>
          ) : createResult ? (
            (createResult.created > 0 || createResult.reminded > 0) ? (
              <span className="text-[var(--color-success)]">
                ✓ {[createResult.created > 0 && `${createResult.created} created`, createResult.reminded > 0 && `${createResult.reminded} reminded`].filter(Boolean).join(", ")}
              </span>
            ) : (
              <span className="text-red-600" title={createResult.errors?.[0]?.error ?? "Request failed"}>
                {createResult.errors?.length ? "Failed: " + (createResult.errors[0].error || "see tooltip").slice(0, 60) : "Failed"}
              </span>
            )
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Tasks
            </>
          )}
        </button>
      </td>
    </tr>
  );
}
