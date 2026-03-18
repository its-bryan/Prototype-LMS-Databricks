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
  fetchLeads,
  fetchUploadSummary,
  fetchOrgMapping: apiFetchOrgMapping,
  fetchBranchManagers: apiFetchBranchManagers,
  fetchWeeklyTrends: apiFetchWeeklyTrends,
  fetchLeaderboardData: apiFetchLeaderboardData,
  fetchCancellationReasonCategories: apiFetchCancellationReasonCategories,
  fetchNextActions: apiFetchNextActions,
  fetchTasksForGM: apiFetchTasksForGM,
  updateLeadEnrichment: apiUpdateLeadEnrichment,
  updateLeadContact: apiUpdateLeadContact,
  updateLeadDirective: apiUpdateLeadDirective,
  markLeadReviewed: apiMarkLeadReviewed,
  fetchGmDirectives: apiFetchGmDirectives,
  insertGmDirective: apiInsertGmDirective,
  fetchLeadActivities: apiFetchLeadActivities,
  fetchTasksForBranch: apiFetchTasksForBranch,
  fetchTasksForLead: apiFetchTasksForLead,
  fetchTaskById: apiFetchTaskById,
  updateTaskStatus: apiUpdateTaskStatus,
  appendTaskNote: apiAppendTaskNote,
  insertTask: apiInsertTask,
  createComplianceTasksForBranch: apiCreateComplianceTasksForBranch,
  fetchWinsLearnings: apiFetchWinsLearnings,
  submitWinsLearning: apiSubmitWinsLearning,
} = dataModule;

import { setOrgMappingSource, setBranchManagersSource, setWeeklyTrendsSource, setNowFromLeads, setNowFromDate } from "../selectors/demoSelectors";

const DataContext = createContext(null);

// true = use live Databricks API; false = use mock data
const USE_LIVE_API = true;
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
      leads: readCache("leads"),
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

// Hydrate selector module-level variables from cache so stats compute
// correctly even before the background refresh finishes.
if (_c.snapshot?.now) setNowFromDate(_c.snapshot.now);
else if (_c.leads?.length) setNowFromLeads(_c.leads);
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
  // --- State initialised from cache (instant render) or empty (skeleton) ---
  const [leads, setLeads] = useState(() => {
    if (USE_LIVE_API) return _c.leads ?? [];
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
  const [loading, setLoading] = useState(USE_LIVE_API && !_hasCachedSnapshot && !_hasCachedLeads);
  const [orgMappingReady, setOrgMappingReady] = useState(!USE_LIVE_API || _hasCachedOrgMapping);
  const [leadsReady, setLeadsReady] = useState(_hasCachedLeads);
  const leadsRequestedRef = useRef(_hasCachedLeads);

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

  const refetchLeads = useCallback(async () => {
    if (!USE_LIVE_API) return;
    bumpPending(1);
    setError(null);
    try {
      const data = await fetchLeads();
      setLeads(data ?? []);
      writeCache("leads", data ?? []);
      if (data?.length) setNowFromLeads(data);
      setLeadsReady(true);
    } catch (err) {
      setError(err?.message ?? "Failed to fetch leads");
    } finally {
      setLoading(false);
      bumpPending(-1);
    }
  }, []);

  /** Load leads on-demand. Call from views that need individual lead data
   *  (Meeting Prep, Lead Detail, Spot Check, etc.). No-op if already loaded. */
  const demandLeads = useCallback(() => {
    if (leadsRequestedRef.current) return;
    leadsRequestedRef.current = true;
    refetchLeads();
  }, [refetchLeads]);

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

  // --- Initial data load ---
  // Snapshot + config load on mount. Leads are deferred (loaded on-demand by
  // drill-down views) because the snapshot already has pre-computed metrics for
  // all dashboard/summary pages. This cuts GM initial load from ~32s to ~1s.
  useEffect(() => {
    if (!USE_LIVE_API) return;

    refetchSnapshot();
    refetchOrgMapping();
    refetchDataAsOfDate();

    const wrap = (promise, key, setter, extra) => {
      bumpPending(1);
      promise
        .then((data) => {
          const val = data ?? (key === "weeklyTrends" ? { bm: [], gm: [] } : key === "leaderboardData" ? { branches: [], gms: [], ams: [], zones: [] } : []);
          setter(val);
          writeCache(key, val);
          extra?.(val);
        })
        .catch((err) => console.error(`[DataContext] fetch ${key} failed:`, err))
        .finally(() => bumpPending(-1));
    };

    wrap(apiFetchWinsLearnings(), "winsLearnings", setWinsLearnings);
    wrap(apiFetchCancellationReasonCategories(), "cancellationReasons", setCancellationReasonCategories);
    wrap(apiFetchNextActions(), "nextActions", setNextActions);
    wrap(apiFetchBranchManagers(), "branchManagers", setBranchManagers, (v) => setBranchManagersSource(v));
    wrap(apiFetchWeeklyTrends(), "weeklyTrends", setWeeklyTrends, (v) => setWeeklyTrendsSource(v));
    wrap(apiFetchLeaderboardData(), "leaderboardData", setLeaderboardData);
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

  /** Mark a lead as reviewed (status=Reviewed, archived=true) */
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
          updatedLead = { ...l, status: "Reviewed", archived: true };
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
    leadsReady,
    demandLeads,
    initialDataReady,
    isRefreshing,
    error,
    dataAsOfDate,
    snapshot,
    orgMapping,
    gmTasks,
    refetchLeads,
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
    fetchTasksForBranch,
    fetchTasksForLead,
    fetchTaskById,
    fetchGMTasks,
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
