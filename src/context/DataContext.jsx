/**
 * DataContext — provides leads from Databricks (FastAPI + Lakebase Postgres) or mockData.
 * Data module is databricksData.js; no Supabase.
 *
 * Stale-while-revalidate: on mount, cached data from sessionStorage is shown
 * immediately while fresh data is fetched in the background. The `isRefreshing`
 * flag lets the UI show a subtle "Fetching and updating dashboard" indicator
 * instead of a full skeleton.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  leads as mockLeads,
  winsLearnings as mockWinsLearnings,
  dataAsOfDate as mockDataAsOfDate,
  orgMapping as mockOrgMapping,
  cancellationReasonCategories as mockCancellationReasonCategories,
  nextActions as mockNextActions,
  branchManagers as mockBranchManagers,
  weeklyTrends as mockWeeklyTrends,
  leaderboardData as mockLeaderboardData,
  tasks as mockTasks,
} from "../data/mockData";

// Data service: Databricks (Lakebase Postgres via FastAPI)
const dataModule = await import("../data/databricksData.js");

const {
  fetchDashboardSnapshot: apiFetchDashboardSnapshot,
  fetchObservatorySnapshot: apiFetchObservatorySnapshot,
  fetchLeadById: apiFetchLeadById,
  fetchLeadsPage: apiFetchLeadsPage,
  fetchLeadWeeks: apiFetchLeadWeeks,
  fetchGMMeetingPrepStats: apiFetchGMMeetingPrepStats,
  fetchUploadSummary,
  fetchAllConfig: apiFetchAllConfig,
  fetchOrgMapping: apiFetchOrgMapping,
  fetchBranchManagers: apiFetchBranchManagers,
  fetchWeeklyTrends: apiFetchWeeklyTrends,
  fetchLeaderboardData: apiFetchLeaderboardData,
  fetchCancellationReasonCategories: apiFetchCancellationReasonCategories,
  fetchNextActions: apiFetchNextActions,
  fetchTasksForGM: apiFetchTasksForGM,
  fetchTasksForGMPage: apiFetchTasksForGMPage,
  updateLeadEnrichment: apiUpdateLeadEnrichment,
  updateLeadContact: apiUpdateLeadContact,
  updateLeadDirective: apiUpdateLeadDirective,
  markLeadReviewed: apiMarkLeadReviewed,
  fetchGmDirectives: apiFetchGmDirectives,
  insertGmDirective: apiInsertGmDirective,
  fetchLeadActivities: apiFetchLeadActivities,
  fetchTasksForBranch: apiFetchTasksForBranch,
  fetchTasksForBranchPage: apiFetchTasksForBranchPage,
  fetchTasksForLead: apiFetchTasksForLead,
  fetchTaskById: apiFetchTaskById,
  updateTaskStatus: apiUpdateTaskStatus,
  appendTaskNote: apiAppendTaskNote,
  insertTask: apiInsertTask,
  createComplianceTasksForBranch: apiCreateComplianceTasksForBranch,
  fetchWinsLearnings: apiFetchWinsLearnings,
  submitWinsLearning: apiSubmitWinsLearning,
} = dataModule;

import { setOrgMappingSource, setBranchManagersSource, setWeeklyTrendsSource, setNowFromDate } from "../selectors/demoSelectors";

const DataContext = createContext(null);

// Set VITE_USE_LIVE_API=false to use mock data locally.
const USE_LIVE_API = import.meta.env.VITE_USE_LIVE_API !== "false";
const STORAGE_KEY = "hertz_lms_leads";

// ---------------------------------------------------------------------------
// Session cache (stale-while-revalidate)
// ---------------------------------------------------------------------------
const CACHE_PREFIX = "hertz_lms_c_";

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCache(key, data) {
  try { sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data)); } catch { /* quota */ }
}

// Read all caches once at module load (synchronous).
const _c = USE_LIVE_API
  ? {
      orgMapping: readCache("orgMapping"),
      dataAsOfDate: readCache("dataAsOfDate"),
      branchManagers: readCache("branchManagers"),
      weeklyTrends: readCache("weeklyTrends"),
      leaderboardData: readCache("leaderboardData"),
      winsLearnings: readCache("winsLearnings"),
      cancellationReasons: readCache("cancellationReasons"),
      nextActions: readCache("nextActions"),
      snapshot: readCache("snapshot"),
    }
  : {};

const _hasCachedLeads = !!(_c.leads?.length);
const _hasCachedOrgMapping = !!(_c.orgMapping?.length);
const _hasCachedSnapshot = !!_c.snapshot;
const _cachedObsSnapshot = readCache("obsSnapshot");

// Hydrate selector module-level variables from cache so stats compute
// correctly even before the background refresh finishes.
if (_c.snapshot?.now) setNowFromDate(_c.snapshot.now);
if (_c.orgMapping?.length) setOrgMappingSource(_c.orgMapping);
if (_c.branchManagers?.length) setBranchManagersSource(_c.branchManagers);
if (_c.weeklyTrends) setWeeklyTrendsSource(_c.weeklyTrends);

// ---------------------------------------------------------------------------
// localStorage helpers (mock mode only)
// ---------------------------------------------------------------------------
function loadLeadsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveLeadsToStorage(leads) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads ?? []));
  } catch {
    // Ignore quota / privacy errors
  }
}

/** Ensure Maria Santos (Santa Monica) is a mismatch demo lead for Meeting Prep. Patches stored data that may have old values. */
function ensureMismatchDemoLead(leads) {
  if (!Array.isArray(leads)) return leads;
  const maria = leads.find((l) => l.reservationId === "HL-2026-001243" || l.id === 10);
  if (!maria) return leads;
  if (maria.mismatch && (maria.weekOf === "2026-02-16" || maria.week_of === "2026-02-16")) return leads;
  return leads.map((l) => {
    if (l.reservationId !== "HL-2026-001243" && l.id !== 10) return l;
    return {
      ...l,
      mismatch: true,
      mismatchReason: "HLES says 'Unable to reach' but TRANSLOG shows 2 contact attempts. Add clarifying notes before the meeting.",
      weekOf: "2026-02-16",
      week_of: "2026-02-16",
    };
  });
}

export function DataProvider({ children }) {
  const orgMappingRef = useRef(_c.orgMapping ?? []);

  // leads state kept only for mock mode and single-lead mutations (directive, enrichment, review)
  const [leads, setLeads] = useState(() => {
    if (USE_LIVE_API) return [];
    const stored = loadLeadsFromStorage();
    const initial = stored ?? [...mockLeads];
    return ensureMismatchDemoLead(initial);
  });
  const [winsLearnings, setWinsLearnings] = useState(
    USE_LIVE_API ? (_c.winsLearnings ?? []) : [...mockWinsLearnings],
  );
  const [orgMapping, setOrgMapping] = useState(
    USE_LIVE_API ? (_c.orgMapping ?? []) : [...mockOrgMapping],
  );
  const [snapshot, setSnapshot] = useState(USE_LIVE_API ? (_c.snapshot ?? null) : null);
  const [observatorySnapshot, setObservatorySnapshot] = useState(USE_LIVE_API ? (_cachedObsSnapshot ?? null) : null);
  const [gmTasks, setGmTasks] = useState(() => (USE_LIVE_API ? null : [...mockTasks]));
  const [cancellationReasonCategories, setCancellationReasonCategories] = useState(
    USE_LIVE_API ? (_c.cancellationReasons ?? []) : [...mockCancellationReasonCategories],
  );
  const [nextActions, setNextActions] = useState(
    USE_LIVE_API ? (_c.nextActions ?? []) : [...mockNextActions],
  );
  const [branchManagers, setBranchManagers] = useState(
    USE_LIVE_API ? (_c.branchManagers ?? []) : [...mockBranchManagers],
  );
  const [weeklyTrends, setWeeklyTrends] = useState(
    USE_LIVE_API ? (_c.weeklyTrends ?? { bm: [], gm: [] }) : mockWeeklyTrends,
  );
  const [leaderboardData, setLeaderboardData] = useState(
    USE_LIVE_API
      ? (_c.leaderboardData ?? { branches: [], gms: [], ams: [], zones: [] })
      : mockLeaderboardData,
  );

  // `loading` controls skeletons — resolves once snapshot (or cached leads) is available.
  // Leads are loaded on-demand for drill-down views, not on mount.
  const [loading, setLoading] = useState(USE_LIVE_API && !_hasCachedSnapshot);
  const [orgMappingReady, setOrgMappingReady] = useState(!USE_LIVE_API || _hasCachedOrgMapping);

  // `isRefreshing` — true while a background data refresh is in-flight.
  // The DataBanner shows "Fetching and updating dashboard" when this is true.
  const [isRefreshing, setIsRefreshing] = useState(USE_LIVE_API);
  const pendingRef = useRef(0);
  const bumpPending = (delta) => {
    pendingRef.current = Math.max(0, pendingRef.current + delta);
    if (delta > 0) setIsRefreshing(true);
    else if (pendingRef.current === 0) setIsRefreshing(false);
  };

  const [error, setError] = useState(null);
  const [dataAsOfDate, setDataAsOfDate] = useState(
    USE_LIVE_API ? (_c.dataAsOfDate ?? null) : mockDataAsOfDate,
  );

  const initialDataReady = !loading && orgMappingReady;

  // --- Refetch helpers (used on mount AND after HLES upload) ---

  const refetchDataAsOfDate = useCallback(async () => {
    if (!USE_LIVE_API) return;
    bumpPending(1);
    try {
      const { dataAsOfDate: d } = await fetchUploadSummary();
      setDataAsOfDate(d ?? null);
      writeCache("dataAsOfDate", d ?? null);
    } catch {
      setDataAsOfDate(null);
    } finally {
      bumpPending(-1);
    }
  }, []);

  // Persist leads to localStorage whenever they change (mock mode only)
  useEffect(() => {
    if (!USE_LIVE_API && leads.length > 0) {
      saveLeadsToStorage(leads);
    }
  }, [USE_LIVE_API, leads]);

  const fetchLeadsPage = useCallback(
    async (params = {}) => {
      if (USE_LIVE_API) return apiFetchLeadsPage(params);
      const limit = params.limit ?? 20;
      const offset = params.offset ?? 0;
      const items = (leads ?? []).slice(offset, offset + limit);
      return {
        items,
        total: (leads ?? []).length,
        limit,
        offset,
        hasNext: offset + limit < (leads ?? []).length,
      };
    },
    [USE_LIVE_API, leads]
  );

  const fetchLeadWeeks = useCallback(
    async (params = {}) => {
      if (USE_LIVE_API) return apiFetchLeadWeeks(params);
      return [];
    },
    [USE_LIVE_API]
  );

  const fetchLeadById = useCallback(
    async (leadId) => {
      if (!USE_LIVE_API) {
        return (leads ?? []).find((l) => l.id === leadId) ?? null;
      }
      return apiFetchLeadById(leadId);
    },
    [USE_LIVE_API, leads]
  );

  const fetchGMMeetingPrepStats = useCallback(
    async (params = {}) => {
      if (USE_LIVE_API) return apiFetchGMMeetingPrepStats(params);
      return {
        leadsToReviewTotal: 0,
        leadsReviewed: 0,
        meetingPrepData: { branchChecklist: [], totalOutstanding: 0, branchesComplete: 0, totalBranches: 0 },
        unreachableStats: { count: 0, pct: 0, total: 0, branchBreakdown: [], leads: [] },
      };
    },
    [USE_LIVE_API]
  );

  const refetchOrgMapping = useCallback(async () => {
    if (!USE_LIVE_API) return;
    bumpPending(1);
    try {
      const data = await apiFetchOrgMapping();
      const mapping = data ?? [];
      setOrgMapping(mapping);
      setOrgMappingSource(mapping);
      writeCache("orgMapping", mapping);
    } catch (err) {
      console.error("[DataContext] fetchOrgMapping failed:", err);
    } finally {
      setOrgMappingReady(true);
      bumpPending(-1);
    }
  }, []);

  const refetchSnapshot = useCallback(async ({ poll = false } = {}) => {
    if (!USE_LIVE_API) return;
    const maxAttempts = poll ? 8 : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 5000));
      bumpPending(1);
      try {
        const data = await apiFetchDashboardSnapshot();
        if (data) {
          setSnapshot(data);
          writeCache("snapshot", data);
          if (data.now) setNowFromDate(data.now);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("[DataContext] snapshot fetch error:", err);
      } finally {
        bumpPending(-1);
      }
    }
  }, []);

  const refetchObservatorySnapshot = useCallback(async ({ poll = false } = {}) => {
    if (!USE_LIVE_API) return;
    const maxAttempts = poll ? 8 : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 5000));
      bumpPending(1);
      try {
        const data = await apiFetchObservatorySnapshot();
        if (data) {
          setObservatorySnapshot(data);
          writeCache("obsSnapshot", data);
          return;
        }
      } catch (err) {
        console.error("[DataContext] observatory snapshot fetch error:", err);
      } finally {
        bumpPending(-1);
      }
    }
  }, []);

  // --- Initial data load ---
  // Snapshot + config load on mount. Leads are deferred (loaded on-demand by
  // drill-down views) because the snapshot already has pre-computed metrics for
  // all dashboard/summary pages. This cuts GM initial load from ~32s to ~1s.
  //
  // Config data is fetched in a single batch request (/api/config/all) which
  // runs 8 queries on one pooled connection instead of 8 separate HTTP calls
  // each opening their own connection.
  useEffect(() => {
    if (!USE_LIVE_API) return;

    refetchSnapshot();
    refetchObservatorySnapshot();

    bumpPending(1);
    apiFetchAllConfig()
      .then((cfg) => {
        if (!cfg) return;

        setOrgMapping(cfg.orgMapping);
        orgMappingRef.current = cfg.orgMapping;
        setOrgMappingSource(cfg.orgMapping);
        writeCache("orgMapping", cfg.orgMapping);
        setOrgMappingReady(true);

        setBranchManagers(cfg.branchManagers);
        setBranchManagersSource(cfg.branchManagers);
        writeCache("branchManagers", cfg.branchManagers);

        setWeeklyTrends(cfg.weeklyTrends);
        setWeeklyTrendsSource(cfg.weeklyTrends);
        writeCache("weeklyTrends", cfg.weeklyTrends);

        setLeaderboardData(cfg.leaderboard);
        writeCache("leaderboardData", cfg.leaderboard);

        setCancellationReasonCategories(cfg.cancelReasons);
        writeCache("cancellationReasons", cfg.cancelReasons);

        setNextActions(cfg.nextActions);
        writeCache("nextActions", cfg.nextActions);

        setWinsLearnings(cfg.winsLearnings);
        writeCache("winsLearnings", cfg.winsLearnings);

        const d = cfg.uploadSummary?.created_at ?? cfg.uploadSummary?.data_as_of_date ?? null;
        setDataAsOfDate(d);
        writeCache("dataAsOfDate", d);
      })
      .catch((err) => {
        console.error("[DataContext] fetchAllConfig failed, falling back:", err);
        refetchOrgMapping();
        refetchDataAsOfDate();
      })
      .finally(() => {
        setOrgMappingReady(true);
        bumpPending(-1);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Fetch GM tasks for all branches under a GM. Call from GM views on mount. */
  const fetchGMTasks = useCallback(
    async (gmBranches) => {
      if (!USE_LIVE_API) return;
      try {
        const tasks = await apiFetchTasksForGM(gmBranches);
        setGmTasks(tasks);
      } catch (err) {
        console.error("[DataContext] fetchTasksForGM failed:", err);
      }
    },
    [USE_LIVE_API]
  );

  /** Save a GM directive on a lead */
  const updateLeadDirective = useCallback(
    async (leadId, directiveText) => {
      if (USE_LIVE_API) {
        const updated = await apiUpdateLeadDirective(leadId, directiveText);
        setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
        return updated;
      }
      // Mock mode: optimistic local update
      let updatedLead = null;
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId) return l;
          updatedLead = { ...l, gmDirective: directiveText };
          return updatedLead;
        })
      );
      return updatedLead;
    },
    [USE_LIVE_API]
  );

  /** Archive a lead (mark it as reviewed). Sets archived=true only. */
  const markLeadReviewed = useCallback(
    async (leadId) => {
      if (USE_LIVE_API) {
        const updated = await apiMarkLeadReviewed(leadId);
        setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
        return updated;
      }
      // Mock mode: optimistic local update
      let updatedLead = null;
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId) return l;
          updatedLead = { ...l, archived: true };
          return updatedLead;
        })
      );
      return updatedLead;
    },
    [USE_LIVE_API]
  );

  const updateLeadEnrichment = useCallback(
    async (leadId, enrichment, enrichmentLogEntry, status = null) => {
      if (USE_LIVE_API) {
        const updated = await apiUpdateLeadEnrichment(leadId, enrichment, enrichmentLogEntry, status);
        setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
        return updated;
      }
      // Mock mode: optimistic local update
      let updatedLead = null;
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId) return l;
          const newLog = enrichmentLogEntry ? [...(l.enrichmentLog ?? []), enrichmentLogEntry] : (l.enrichmentLog ?? []);
          updatedLead = {
            ...l,
            enrichment: enrichment ?? l.enrichment,
            enrichmentComplete: !!enrichment && Object.keys(enrichment ?? {}).length > 0,
            enrichmentLog: newLog,
            status: status ?? l.status,
            ...(status === "Cancelled" && enrichment?.reason ? { hlesReason: enrichment.reason } : {}),
          };
          return updatedLead;
        })
      );
      return updatedLead;
    },
    [USE_LIVE_API]
  );

  const updateLeadContact = useCallback(
    async (leadId, { email, phone }, enrichmentLogEntry = null) => {
      if (USE_LIVE_API) {
        const updated = await apiUpdateLeadContact(leadId, { email, phone }, enrichmentLogEntry);
        setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
        return updated;
      }
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId) return l;
          const newLog = enrichmentLogEntry ? [...(l.enrichmentLog ?? []), enrichmentLogEntry] : (l.enrichmentLog ?? []);
          return {
            ...l,
            email: email !== undefined ? (email || null) : l.email,
            phone: phone !== undefined ? (phone || null) : l.phone,
            enrichmentLog: newLog,
          };
        })
      );
      return null;
    },
    [USE_LIVE_API]
  );

  const fetchLeadActivities = useCallback(
    async (leadId) => {
      if (!USE_LIVE_API) return [];
      return apiFetchLeadActivities(leadId);
    },
    [USE_LIVE_API]
  );

  const fetchGmDirectives = useCallback(
    async (leadId) => {
      if (!USE_LIVE_API) return [];
      return apiFetchGmDirectives(leadId);
    },
    [USE_LIVE_API]
  );

  const insertGmDirective = useCallback(
    async (params) => {
      if (!USE_LIVE_API) {
        const mock = {
          id: `gmd-mock-${Date.now()}`,
          leadId: params.leadId,
          directiveText: params.directiveText,
          priority: params.priority ?? "normal",
          dueDate: params.dueDate ?? null,
          createdBy: params.createdBy ?? null,
          createdByName: params.createdByName ?? "GM",
          createdAt: new Date().toISOString(),
        };
        setLeads((prev) =>
          prev.map((l) => (l.id === params.leadId ? { ...l, gmDirective: params.directiveText } : l))
        );
        return mock;
      }
      const result = await apiInsertGmDirective(params);
      setLeads((prev) =>
        prev.map((l) => (l.id === params.leadId ? { ...l, gmDirective: params.directiveText } : l))
      );
      return result;
    },
    [USE_LIVE_API]
  );

  const fetchTasksForBranch = useCallback(
    async (branch) => {
      if (!USE_LIVE_API) return [];
      return apiFetchTasksForBranch(branch);
    },
    [USE_LIVE_API]
  );

  const fetchTasksForBranchPage = useCallback(
    async (branch, params = {}) => {
      if (USE_LIVE_API) return apiFetchTasksForBranchPage(branch, params);
      return { items: [], total: 0, limit: params.limit ?? 20, offset: params.offset ?? 0, hasNext: false };
    },
    [USE_LIVE_API]
  );

  const fetchTasksForLead = useCallback(
    async (leadId) => {
      if (!USE_LIVE_API) return [];
      return apiFetchTasksForLead(leadId);
    },
    [USE_LIVE_API]
  );

  const fetchTaskById = useCallback(
    async (taskId) => {
      if (!USE_LIVE_API) return null;
      return apiFetchTaskById(taskId);
    },
    [USE_LIVE_API]
  );

  const fetchGMTasksPage = useCallback(
    async (gmBranches, params = {}) => {
      if (USE_LIVE_API) return apiFetchTasksForGMPage(gmBranches, params);
      return { items: [], total: 0, limit: params.limit ?? 20, offset: params.offset ?? 0, hasNext: false };
    },
    [USE_LIVE_API]
  );

  const updateTaskStatus = useCallback(
    async (taskId, status) => {
      if (!USE_LIVE_API) return null;
      return apiUpdateTaskStatus(taskId, status);
    },
    [USE_LIVE_API]
  );

  const appendTaskNote = useCallback(
    async (taskId, noteText, author) => {
      if (!USE_LIVE_API) return null;
      return apiAppendTaskNote(taskId, noteText, author);
    },
    [USE_LIVE_API]
  );

  const insertTask = useCallback(
    async (params) => {
      if (!USE_LIVE_API) {
        const mockTask = {
          id: `task-mock-${Date.now()}`,
          title: params.title,
          description: params.description ?? null,
          dueDate: params.dueDate,
          dueDateRaw: params.dueDate,
          status: "Open",
          priority: params.priority ?? "Medium",
          leadId: params.leadId ?? null,
          assignedTo: params.assignedTo ?? null,
          assignedToName: params.assignedToName ?? null,
          assignedBranch: params.assignedBranch ?? null,
          createdBy: params.createdBy ?? null,
          createdByName: params.createdByName ?? null,
          source: params.source ?? "bm_created",
          createdAt: new Date().toISOString(),
          notesLog: [],
        };
        return mockTask;
      }
      return apiInsertTask(params);
    },
    [USE_LIVE_API]
  );

  const createComplianceTasksForBranch = useCallback(
    async (params) => {
      if (!USE_LIVE_API) return { created: 0, errors: [{ error: "Live API required" }] };
      return apiCreateComplianceTasksForBranch(params);
    },
    [USE_LIVE_API]
  );

  const submitWinsLearning = useCallback(
    async ({ bmName, branch, gmName, content, weekOf }) => {
      const entry = { bmName, branch, gmName, content, weekOf };
      if (USE_LIVE_API) {
        const created = await apiSubmitWinsLearning(entry);
        setWinsLearnings((prev) => [created, ...prev]);
        return created;
      }
      // Mock mode: optimistic local add — use demo NOW so date ordering is consistent
      const mockEntry = {
        ...entry,
        id: `wl-mock-${Date.now()}`,
        createdAt: new Date("2026-02-22T09:00:00").toISOString(),
      };
      setWinsLearnings((prev) => [mockEntry, ...prev]);
      return mockEntry;
    },
    [USE_LIVE_API]
  );

  const value = {
    leads,
    loading,
    initialDataReady,
    isRefreshing,
    error,
    dataAsOfDate,
    snapshot,
    observatorySnapshot,
    refetchObservatorySnapshot,
    orgMapping,
    gmTasks,
    refetchOrgMapping,
    refetchDataAsOfDate,
    refetchSnapshot,
    updateLeadEnrichment,
    updateLeadContact,
    updateLeadDirective,
    markLeadReviewed,
    fetchGmDirectives,
    insertGmDirective,
    fetchLeadActivities,
    fetchLeadsPage,
    fetchLeadWeeks,
    fetchGMMeetingPrepStats,
    fetchLeadById,
    fetchTasksForBranch,
    fetchTasksForBranchPage,
    fetchTasksForLead,
    fetchTaskById,
    fetchGMTasks,
    fetchGMTasksPage,
    updateTaskStatus,
    appendTaskNote,
    insertTask,
    createComplianceTasksForBranch,
    winsLearnings,
    submitWinsLearning,
    cancellationReasonCategories,
    nextActions,
    branchManagers,
    weeklyTrends,
    leaderboardData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
