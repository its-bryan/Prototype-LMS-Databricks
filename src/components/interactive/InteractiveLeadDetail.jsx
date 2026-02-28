import { useState, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { getLeadById, getTasksForLead } from "../../selectors/demoSelectors";
import LeadDetail from "../LeadDetail";
import LeadContactCard from "../LeadContactCard";
import ContactButtons from "../ContactButtons";
import InteractiveEnrichmentForm from "./InteractiveEnrichmentForm";

export default function InteractiveLeadDetail() {
  const { selectedLeadId, navigateTo, selectTask } = useApp();
  const { userProfile } = useAuth();
  const { leads, fetchLeadActivities, fetchTasksForLead, refetchLeads, useSupabase } = useData();
  const lead = getLeadById(leads, selectedLeadId);
  const [contactActivities, setContactActivities] = useState([]);
  const [leadTasks, setLeadTasks] = useState([]);

  const loadActivities = useCallback(async () => {
    if (!lead?.id || !fetchLeadActivities) return;
    try {
      const activities = await fetchLeadActivities(lead.id);
      setContactActivities(activities);
      refetchLeads?.();
    } catch (err) {
      console.error("[InteractiveLeadDetail] Failed to fetch activities:", err);
      setContactActivities([]);
    }
  }, [lead?.id, fetchLeadActivities, refetchLeads]);

  const loadTasks = useCallback(async () => {
    if (!lead?.id) return;
    if (useSupabase) {
      try {
        const t = await fetchTasksForLead(lead.id);
        setLeadTasks(t);
      } catch (err) {
        console.error("[InteractiveLeadDetail] Failed to fetch tasks:", err);
        setLeadTasks([]);
      }
    } else {
      setLeadTasks(getTasksForLead(lead.id));
    }
  }, [lead?.id, useSupabase, fetchTasksForLead]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  if (!lead) {
    return (
      <div className="h-full flex items-center justify-center text-[#6E6E6E]">
        No lead selected.
        <button
          onClick={() => navigateTo("bm-leads")}
          className="ml-2 text-[var(--hertz-primary)] hover:underline cursor-pointer"
        >
          Back to leads
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigateTo("bm-leads")}
        className="text-sm text-[var(--neutral-600)] hover:text-[var(--hertz-black)] mb-4 inline-block cursor-pointer"
      >
        ← Back to leads
      </button>
      <LeadDetail
        lead={lead}
        contactSlot={<LeadContactCard lead={lead} />}
        contactButtonsSlot={
          <ContactButtons
            lead={lead}
            agentPhone={userProfile?.phone}
            userProfile={userProfile}
            onContactSuccess={loadActivities}
          />
        }
        enrichmentSlot={<InteractiveEnrichmentForm lead={lead} />}
        tasksSlot={
          <div data-onboarding="tasks-section">
            <h3 className="text-xs font-bold text-[var(--neutral-600)] uppercase tracking-wider mb-3">Tasks</h3>
            {leadTasks.length === 0 ? (
              <p className="text-sm text-[var(--neutral-600)]">No tasks for this lead.</p>
            ) : (
              <ul className="space-y-2">
                {leadTasks.map((task) => (
                  <li
                    key={task.id}
                    onClick={() => {
                      selectTask?.(task.id);
                      navigateTo("bm-task-detail");
                      window.dispatchEvent(new CustomEvent("onboarding:action", { detail: { actionType: "open_task" } }));
                    }}
                    className="flex items-center justify-between p-2 rounded border border-[var(--neutral-200)] hover:bg-[var(--neutral-50)] cursor-pointer transition-colors"
                  >
                    <span className="font-medium text-sm text-[var(--hertz-black)] truncate">{task.title}</span>
                    <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-semibold ${
                      task.status === "Done" ? "bg-[var(--color-success)]/15 text-[var(--color-success)]" :
                      task.status === "In Progress" ? "bg-[var(--hertz-primary)]/25 text-[var(--hertz-black)]" :
                      "bg-[var(--color-error)]/15 text-[var(--color-error)]"
                    }`}>
                      {task.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        }
        contactActivities={contactActivities}
      />
    </div>
  );
}
