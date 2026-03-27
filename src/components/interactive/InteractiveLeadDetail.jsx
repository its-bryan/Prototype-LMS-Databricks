import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import BackButton from "../BackButton";
import { useData } from "../../context/DataContext";
import LeadDetail from "../LeadDetail";
import LeadContactCard from "../LeadContactCard";
import InteractiveEnrichmentForm from "./InteractiveEnrichmentForm";
import GMDirectiveSection from "../GMDirectiveSection";
import { LeadDetailSkeleton, usePageTransition } from "../DashboardSkeleton";

export default function InteractiveLeadDetail() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { leadId } = useParams();
  const isGMContext = pathname.startsWith("/gm/");
  const isAdminContext = pathname.startsWith("/admin/");
  const userRole = isAdminContext ? "admin" : isGMContext ? "gm" : "bm";
  const backLabel = isGMContext ? "Back to Lead Review" : "Back to leads";
  const { fetchLeadById, fetchTasksForLead, updateTaskStatus, fetchLeadTranslog, initialDataReady } = useData();
  const resolvedLeadId = Number.isNaN(Number(leadId)) ? leadId : Number(leadId);
  const [lead, setLead] = useState(null);
  const [leadLoading, setLeadLoading] = useState(true);
  const [leadTasks, setLeadTasks] = useState([]);
  const [translogEvents, setTranslogEvents] = useState([]);

  /* eslint-disable react-hooks/set-state-in-effect -- fetch lead + tasks on id change */
  useEffect(() => {
    if (!leadId) {
      setLead(null);
      setLeadLoading(false);
      return;
    }
    let cancelled = false;
    setLeadLoading(true);
    fetchLeadById(resolvedLeadId)
      .then((l) => { if (!cancelled) setLead(l ?? null); })
      .catch(() => { if (!cancelled) setLead(null); })
      .finally(() => { if (!cancelled) setLeadLoading(false); });
    return () => { cancelled = true; };
  }, [leadId, resolvedLeadId, fetchLeadById]);

  const loadTasks = useCallback(async () => {
    if (!lead?.id) return;
    try {
      const t = await fetchTasksForLead(lead.id);
      setLeadTasks(t);
    } catch (err) {
      console.error("[InteractiveLeadDetail] Failed to fetch tasks:", err);
      setLeadTasks([]);
    }
  }, [lead, fetchTasksForLead]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!lead?.id || !fetchLeadTranslog) return;
    let cancelled = false;
    fetchLeadTranslog(lead.id, { limit: 200, role: userRole })
      .then((result) => { if (!cancelled) setTranslogEvents(result?.events ?? []); })
      .catch(() => { if (!cancelled) setTranslogEvents([]); });
    return () => { cancelled = true; };
  }, [lead?.id, fetchLeadTranslog, userRole]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const pageReady = usePageTransition();
  if (!initialDataReady || !pageReady || leadLoading) return <LeadDetailSkeleton />;

  if (!lead) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--neutral-600)]">
        No lead selected.
        <BackButton onClick={() => navigate(-1)} label={backLabel} className="ml-2 mb-0" />
      </div>
    );
  }

  return (
    <div>
      <BackButton onClick={() => navigate(-1)} label={backLabel} />
      <LeadDetail
        lead={lead}
        translogEvents={translogEvents}
        userRole={userRole}
        contactSlot={<LeadContactCard lead={lead} />}
        enrichmentSlot={
          isGMContext
            ? <GMDirectiveSection lead={lead} />
            : <InteractiveEnrichmentForm lead={lead} />
        }
        tasksSlot={
          <div data-onboarding="tasks-section">
            <h3 className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wider mb-3">Tasks</h3>
            {leadTasks.length === 0 ? (
              <p className="text-sm text-[var(--neutral-600)]">No tasks for this lead.</p>
            ) : (
              <ul className="space-y-2">
                {leadTasks.map((task) => {
                  const isDone = task.status === "Done";
                  const handleCheckboxClick = (e) => {
                    e.stopPropagation();
                    const newStatus = isDone ? "Open" : "Done";
                    if (updateTaskStatus) {
                      updateTaskStatus(task.id, newStatus).then(() => loadTasks());
                    } else {
                      setLeadTasks((prev) =>
                        prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
                      );
                    }
                  };
                  return (
                    <li
                      key={task.id}
                        onClick={() => {
                        navigate(isGMContext ? `/gm/tasks/${task.id}` : `/bm/tasks/${task.id}`);
                        window.dispatchEvent(new CustomEvent("onboarding:action", { detail: { actionType: "open_task" } }));
                      }}
                      className={`flex items-center gap-3 p-2 rounded border border-[var(--neutral-200)] hover:bg-[var(--neutral-50)] cursor-pointer transition-colors ${isDone ? "opacity-75" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={handleCheckboxClick}
                        className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                          isDone
                            ? "bg-[var(--color-success)] border-[var(--color-success)] text-white"
                            : "border-[var(--neutral-300)] hover:border-[var(--neutral-400)]"
                        }`}
                        aria-label={isDone ? "Mark as open" : "Mark as done"}
                      >
                        {isDone && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span className="font-medium text-sm text-[var(--hertz-black)] truncate flex-1 min-w-0">{task.title}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        }
      />
    </div>
  );
}
