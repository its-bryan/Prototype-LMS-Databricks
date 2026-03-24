import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import BackButton from "../BackButton";
import StatusBadge from "../StatusBadge";
import { formatDateShort } from "../../utils/dateTime";
import { getDefaultBranchForDemo } from "../../selectors/demoSelectors";

const STATUS_ORDER = { Open: 0, "In Progress": 1, Done: 2 };
const TABS = ["All", "Open", "Done"];

const taskStatusClass = {
  Open: "bg-[var(--color-warning-light)] text-[var(--color-warning)]",
  "In Progress": "bg-[var(--color-info-light)] text-[var(--color-info)]",
  Done: "bg-[var(--color-success-light)] text-[var(--color-success)]",
};

const sourceLabels = {
  gm_assigned: "GM Assigned",
  bm_created: "BM Created",
  compliance: "Compliance",
  system: "System",
};

export default function BMTasksPage() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const {
    fetchTasksForBranchPage,
    updateTaskStatus,
    loading,
    initialDataReady,
  } = useData();

  const branch = userProfile?.branch?.trim() || getDefaultBranchForDemo();
  const pageSize = 20;

  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [offset, setOffset] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);

  useEffect(() => {
    setOffset(0);
  }, [activeTab, search, branch]);

  useEffect(() => {
    if (!branch) return;
    let cancelled = false;
    setTasksLoading(true);
    const statuses = activeTab === "All" ? null : activeTab === "Open" ? "Open,In Progress" : "Done";
    fetchTasksForBranchPage(branch, { limit: pageSize, offset, statuses, search: search.trim() || null })
      .then((result) => {
        if (cancelled) return;
        setTasks(result?.items ?? []);
        setTotalTasks(result?.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setTasks([]);
          setTotalTasks(0);
        }
      })
      .finally(() => {
        if (!cancelled) setTasksLoading(false);
      });
    return () => { cancelled = true; };
  }, [branch, fetchTasksForBranchPage, activeTab, search, offset]);

  const handleMarkDone = useCallback(
    async (taskId) => {
      setUpdatingId(taskId);
      try {
        const updated = await updateTaskStatus(taskId, "Done");
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? updated ?? { ...t, status: "Done", completedAt: new Date().toISOString() }
              : t
          )
        );
      } catch {
        // silently fail
      } finally {
        setUpdatingId(null);
      }
    },
    [updateTaskStatus]
  );

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const t of tasks) {
      const key = t.leadId ?? "__no_lead__";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    for (const [, arr] of groups) {
      arr.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
    }
    return [...groups.entries()].map(([leadId, items]) => {
      const lead = items[0]?.lead ?? null;
      return { leadId, lead, tasks: items };
    });
  }, [tasks]);

  const isLoading = loading || tasksLoading || !initialDataReady;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <BackButton onClick={() => navigate(-1)} label="Back" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--hertz-black)]">My Tasks</h1>
        <p className="text-sm text-[var(--neutral-500)] mt-1">
          Tasks assigned to {branch}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="flex gap-1 bg-[var(--neutral-100)] rounded-lg p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === tab
                  ? "bg-white text-[var(--hertz-black)] shadow-sm"
                  : "text-[var(--neutral-500)] hover:text-[var(--neutral-700)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--neutral-400)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by customer or task…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-[var(--neutral-200)] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[var(--hertz-yellow)]"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-[var(--neutral-200)] overflow-hidden">
              <div className="h-12 bg-[var(--neutral-100)]" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-[var(--neutral-100)] rounded w-3/4" />
                <div className="h-3 bg-[var(--neutral-100)] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16">
          <svg
            className="mx-auto w-12 h-12 text-[var(--neutral-300)] mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-[var(--neutral-500)] font-medium">No tasks assigned to your branch</p>
          <p className="text-sm text-[var(--neutral-400)] mt-1">
            {activeTab !== "All" || search ? "Try changing your filters" : "Tasks will appear here when assigned by your GM"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ leadId, lead, tasks: groupTasks }) => (
            <div key={leadId} className="rounded-xl border border-[var(--neutral-200)] overflow-hidden">
              <div className="bg-[var(--neutral-50)] px-4 py-3 flex items-center justify-between gap-3 border-b border-[var(--neutral-200)]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--hertz-black)] truncate">
                      {lead?.customer ?? "Unknown Customer"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[var(--neutral-500)]">
                      {lead?.reservationId && <span>{lead.reservationId}</span>}
                      {lead?.branch && <span>· {lead.branch}</span>}
                    </div>
                  </div>
                </div>
                {lead?.status && <StatusBadge status={lead.status} />}
              </div>

              <div className="divide-y divide-[var(--neutral-100)]">
                {groupTasks.map((task) => (
                  <div key={task.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${taskStatusClass[task.status] ?? "bg-[var(--neutral-100)] text-[var(--neutral-700)]"}`}>
                          {task.status}
                        </span>
                        {task.source && task.source !== "gm_assigned" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--neutral-100)] text-[var(--neutral-500)]">
                            {sourceLabels[task.source] ?? task.source}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-[var(--hertz-black)] mt-1">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-[var(--neutral-500)] mt-0.5 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-xs text-[var(--neutral-400)]">
                        {task.dueDate && (
                          <span>Due {formatDateShort(task.dueDate)}</span>
                        )}
                        {task.createdBy && task.createdBy !== "—" && (
                          <span>From {task.createdBy}</span>
                        )}
                        {task.priority && task.priority !== "Normal" && (
                          <span className="text-[var(--color-error)] font-medium">{task.priority}</span>
                        )}
                      </div>
                    </div>

                    {task.status !== "Done" && (
                      <button
                        onClick={() => handleMarkDone(task.id)}
                        disabled={updatingId === task.id}
                        className="shrink-0 mt-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-success)]/40 text-[var(--color-success)] bg-[var(--color-success-light)] hover:bg-[var(--color-success-light)] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {updatingId === task.id ? "Saving…" : "Mark Done"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between text-xs text-[var(--neutral-600)]">
        <span>
          {totalTasks === 0 ? "0 results" : `Showing ${offset + 1}-${Math.min(offset + pageSize, totalTasks)} of ${totalTasks}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOffset((prev) => Math.max(0, prev - pageSize))}
            disabled={offset === 0 || tasksLoading}
            className="px-2.5 py-1 rounded border border-[var(--neutral-200)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--neutral-50)]"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setOffset((prev) => prev + pageSize)}
            disabled={tasksLoading || offset + pageSize >= totalTasks}
            className="px-2.5 py-1 rounded border border-[var(--neutral-200)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--neutral-50)]"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
