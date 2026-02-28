/**
 * DataContext — provides leads from Supabase or mockData.
 * When VITE_USE_SUPABASE=true: fetches from Supabase, refetches after updates (persistent).
 * When false: uses mockData with localStorage persistence so enrichment survives logout/restart.
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { leads as mockLeads } from "../data/mockData";
import {
  fetchLeads,
  updateLeadEnrichment as apiUpdateLeadEnrichment,
  updateLeadContact as apiUpdateLeadContact,
  fetchLeadActivities as apiFetchLeadActivities,
  fetchTasksForBranch as apiFetchTasksForBranch,
  fetchTasksForLead as apiFetchTasksForLead,
  fetchTaskById as apiFetchTaskById,
  updateTaskStatus as apiUpdateTaskStatus,
  appendTaskNote as apiAppendTaskNote,
} from "../data/supabaseData";

const DataContext = createContext(null);

const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE === "true";
const STORAGE_KEY = "hertz_lms_leads";

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

export function DataProvider({ children }) {
  const [leads, setLeads] = useState(() => {
    if (USE_SUPABASE) return [];
    const stored = loadLeadsFromStorage();
    return stored ?? [...mockLeads];
  });
  const [loading, setLoading] = useState(USE_SUPABASE);
  const [error, setError] = useState(null);

  // Persist leads to localStorage whenever they change (mock mode only)
  useEffect(() => {
    if (!USE_SUPABASE && leads.length > 0) {
      saveLeadsToStorage(leads);
    }
  }, [USE_SUPABASE, leads]);

  const refetchLeads = useCallback(async () => {
    if (!USE_SUPABASE) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLeads();
      setLeads(data ?? []);
    } catch (err) {
      setError(err?.message ?? "Failed to fetch leads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (USE_SUPABASE) refetchLeads();
  }, [refetchLeads]);

  const updateLeadEnrichment = useCallback(
    async (leadId, enrichment, enrichmentLogEntry, status = null) => {
      if (USE_SUPABASE) {
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
    [USE_SUPABASE]
  );

  const updateLeadContact = useCallback(
    async (leadId, { email, phone }, enrichmentLogEntry = null) => {
      if (USE_SUPABASE) {
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
    [USE_SUPABASE]
  );

  const fetchLeadActivities = useCallback(
    async (leadId) => {
      if (!USE_SUPABASE) return [];
      return apiFetchLeadActivities(leadId);
    },
    [USE_SUPABASE]
  );

  const fetchTasksForBranch = useCallback(
    async (branch) => {
      if (!USE_SUPABASE) return [];
      return apiFetchTasksForBranch(branch);
    },
    [USE_SUPABASE]
  );

  const fetchTasksForLead = useCallback(
    async (leadId) => {
      if (!USE_SUPABASE) return [];
      return apiFetchTasksForLead(leadId);
    },
    [USE_SUPABASE]
  );

  const fetchTaskById = useCallback(
    async (taskId) => {
      if (!USE_SUPABASE) return null;
      return apiFetchTaskById(taskId);
    },
    [USE_SUPABASE]
  );

  const updateTaskStatus = useCallback(
    async (taskId, status) => {
      if (!USE_SUPABASE) return null;
      return apiUpdateTaskStatus(taskId, status);
    },
    [USE_SUPABASE]
  );

  const appendTaskNote = useCallback(
    async (taskId, noteText, author) => {
      if (!USE_SUPABASE) return null;
      return apiAppendTaskNote(taskId, noteText, author);
    },
    [USE_SUPABASE]
  );

  const value = {
    leads,
    loading,
    error,
    refetchLeads,
    updateLeadEnrichment,
    updateLeadContact,
    fetchLeadActivities,
    fetchTasksForBranch,
    fetchTasksForLead,
    fetchTaskById,
    updateTaskStatus,
    appendTaskNote,
    useSupabase: USE_SUPABASE,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
