import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import BackButton from "../BackButton";
import { useData } from "../../context/DataContext";
import { usePageTransition } from "../DashboardSkeleton";

function StatsCard({ label, value, color = "var(--hertz-black)" }) {
  return (
    <div className="rounded-lg border border-[var(--neutral-200)] bg-[var(--hertz-white)] p-4">
      <p className="text-xs font-medium text-[var(--neutral-600)] uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}

function OrphanRow({ orphan, onMap, onDelete, onExpand, expanded }) {
  return (
    <div className="border border-[var(--neutral-200)] rounded-lg bg-[var(--hertz-white)] overflow-hidden">
      <div
        className="flex items-center justify-between gap-4 px-4 py-3 cursor-pointer hover:bg-[var(--neutral-50)] transition-colors"
        onClick={() => onExpand(orphan.knum)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-medium text-[var(--hertz-black)]">{orphan.knum}</p>
          <p className="text-xs text-[var(--neutral-600)] mt-0.5">
            {orphan.eventCount} event{orphan.eventCount !== 1 ? "s" : ""}
            {orphan.locCode && <span> · Loc {orphan.locCode}</span>}
            {orphan.earliestEvent && (
              <span> · {new Date(orphan.earliestEvent).toLocaleDateString()} – {new Date(orphan.latestEvent).toLocaleDateString()}</span>
            )}
          </p>
          {orphan.sampleEvents?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {orphan.sampleEvents.slice(0, 3).map((evt, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--neutral-100)] text-[var(--neutral-600)] border border-[var(--neutral-200)]">
                  {evt}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onMap(orphan.knum); }}
            className="text-xs font-medium px-3 py-1.5 rounded border border-[var(--hertz-primary)] text-[var(--hertz-black)] bg-[var(--hertz-primary)]/10 hover:bg-[var(--hertz-primary)]/20 transition-colors cursor-pointer"
          >
            Map to Lead
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(orphan.knum); }}
            className="text-xs font-medium px-3 py-1.5 rounded border border-[var(--color-error)]/30 text-[var(--color-error)] hover:bg-[var(--color-error-light)] transition-colors cursor-pointer"
          >
            Delete
          </button>
          <svg
            className={`w-4 h-4 text-[var(--neutral-400)] transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {expanded && <OrphanEventList knum={orphan.knum} />}
    </div>
  );
}

function OrphanEventList({ knum }) {
  const { fetchOrphanEvents } = useData();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchOrphanEvents(knum, { limit: 30 })
      .then((data) => { if (!cancelled) setEvents(data ?? []); })
      .catch(() => { if (!cancelled) setEvents([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [knum, fetchOrphanEvents]);

  if (loading) {
    return <div className="px-4 pb-3 text-xs text-[var(--neutral-500)]">Loading events...</div>;
  }

  return (
    <div className="border-t border-[var(--neutral-200)] px-4 pb-3 pt-2 max-h-60 overflow-y-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[var(--neutral-500)] uppercase">
            <th className="text-left pb-1 font-medium">Date</th>
            <th className="text-left pb-1 font-medium">Event</th>
            <th className="text-left pb-1 font-medium">Detail</th>
            <th className="text-left pb-1 font-medium">Location</th>
            <th className="text-left pb-1 font-medium">Employee</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => (
            <tr key={ev.id} className="border-t border-[var(--neutral-100)]">
              <td className="py-1 text-[var(--neutral-600)] whitespace-nowrap">
                {ev.systemDate ? new Date(ev.systemDate).toLocaleString() : "—"}
              </td>
              <td className="py-1 font-medium text-[var(--hertz-black)]">{ev.msg1 ?? "—"}</td>
              <td className="py-1 text-[var(--neutral-600)] truncate max-w-[200px]">{ev.msg2 ?? "—"}</td>
              <td className="py-1 text-[var(--neutral-600)]">{ev.locCode ?? "—"}</td>
              <td className="py-1 text-[var(--neutral-600)]">{ev.empName ?? ev.empCode ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MapDialog({ knum, onClose, onConfirm }) {
  const [leadId, setLeadId] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const id = parseInt(leadId, 10);
    if (!id || isNaN(id)) {
      setError("Enter a valid lead ID");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(knum, id);
      onClose();
    } catch (err) {
      setError(err?.message ?? "Failed to map");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[var(--hertz-white)] rounded-xl border border-[var(--neutral-200)] shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-[var(--hertz-black)] mb-1">Map Translog to Lead</h3>
        <p className="text-sm text-[var(--neutral-600)] mb-4">
          All events for <span className="font-mono font-medium">{knum}</span> will be permanently assigned to this lead.
        </p>
        <label className="block text-xs font-medium text-[var(--neutral-600)] uppercase mb-1">Lead ID</label>
        <input
          type="number"
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
          placeholder="e.g. 12345"
          className="w-full border border-[var(--neutral-300)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hertz-primary)]/40"
          autoFocus
        />
        {error && <p className="text-xs text-[var(--color-error)] mt-1">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg border border-[var(--neutral-300)] text-[var(--neutral-600)] hover:bg-[var(--neutral-50)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="text-sm px-4 py-2 rounded-lg bg-[var(--hertz-primary)] text-[var(--hertz-black)] font-medium hover:bg-[var(--hertz-primary)]/80 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Mapping..." : "Confirm Map"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function InteractiveTranslogAdmin() {
  const navigate = useNavigate();
  const { fetchTranslogStats, fetchTranslogOrphans, mapOrphanToLead, deleteOrphanEvents, relinkTranslogEvents } = useData();
  const pageReady = usePageTransition();

  const [stats, setStats] = useState(null);
  const [orphans, setOrphans] = useState([]);
  const [totalKnums, setTotalKnums] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [expandedKnum, setExpandedKnum] = useState(null);
  const [mapKnum, setMapKnum] = useState(null);
  const [relinking, setRelinking] = useState(false);
  const PAGE_SIZE = 50;

  const loadStats = useCallback(async () => {
    try {
      const s = await fetchTranslogStats();
      setStats(s);
    } catch { setStats(null); }
  }, [fetchTranslogStats]);

  const loadOrphans = useCallback(async () => {
    try {
      const result = await fetchTranslogOrphans({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, search: search || null });
      setOrphans(result?.orphans ?? []);
      setTotalKnums(result?.totalKnums ?? 0);
    } catch {
      setOrphans([]);
      setTotalKnums(0);
    }
  }, [fetchTranslogOrphans, page, search]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadOrphans(); }, [loadOrphans]);

  const handleDelete = async (knum) => {
    if (!confirm(`Permanently delete all orphan events for ${knum}?`)) return;
    try {
      await deleteOrphanEvents(knum);
      loadOrphans();
      loadStats();
    } catch (err) {
      alert(err?.message ?? "Delete failed");
    }
  };

  const handleMapConfirm = async (knum, leadId) => {
    await mapOrphanToLead(knum, leadId);
    loadOrphans();
    loadStats();
  };

  const handleRelink = async () => {
    setRelinking(true);
    try {
      const result = await relinkTranslogEvents();
      alert(`Re-linked ${result?.relinked ?? 0} events to leads.`);
      loadOrphans();
      loadStats();
    } catch (err) {
      alert(err?.message ?? "Relink failed");
    } finally {
      setRelinking(false);
    }
  };

  if (!pageReady) return null;

  return (
    <div className="space-y-6">
      <BackButton onClick={() => navigate("/admin")} label="Back to Admin" />

      <div>
        <h1 className="text-2xl font-bold text-[var(--hertz-black)]">Translog Management</h1>
        <p className="text-sm text-[var(--neutral-600)] mt-1">
          Review and reconcile unassigned translog events. Map them to leads or delete irrelevant data.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <StatsCard label="Total Events" value={stats.total} />
          <StatsCard label="Matched" value={stats.matched} color="var(--color-success)" />
          <StatsCard label="Unassigned" value={stats.orphan} color="var(--color-error)" />
          <StatsCard label="Unique Reservations" value={stats.uniqueKnums} />
          <StatsCard label="Linked Leads" value={stats.uniqueLeads} />
        </div>
      )}

      {/* Actions bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by Knum (reservation ID)..."
            className="w-full border border-[var(--neutral-300)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hertz-primary)]/40"
          />
        </div>
        <button
          onClick={handleRelink}
          disabled={relinking}
          className="text-sm font-medium px-4 py-2 rounded-lg border border-[var(--hertz-primary)] text-[var(--hertz-black)] bg-[var(--hertz-primary)]/10 hover:bg-[var(--hertz-primary)]/20 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {relinking ? "Re-linking..." : "Re-link All Orphans"}
        </button>
      </div>

      {/* Orphan list */}
      <div>
        <p className="text-xs text-[var(--neutral-600)] mb-2">
          {totalKnums.toLocaleString()} unassigned reservation{totalKnums !== 1 ? "s" : ""}
          {search && <span> matching "{search}"</span>}
        </p>
        <div className="space-y-2">
          {orphans.map((orphan) => (
            <OrphanRow
              key={orphan.knum}
              orphan={orphan}
              expanded={expandedKnum === orphan.knum}
              onExpand={(k) => setExpandedKnum(expandedKnum === k ? null : k)}
              onMap={(k) => setMapKnum(k)}
              onDelete={handleDelete}
            />
          ))}
          {orphans.length === 0 && (
            <p className="text-sm text-[var(--neutral-500)] py-4 text-center">
              {search ? "No orphan reservations match your search." : "No unassigned translog events."}
            </p>
          )}
        </div>

        {/* Pagination */}
        {totalKnums > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-sm px-3 py-1.5 rounded border border-[var(--neutral-300)] disabled:opacity-30 cursor-pointer"
            >
              Previous
            </button>
            <span className="text-xs text-[var(--neutral-600)]">
              Page {page + 1} of {Math.ceil(totalKnums / PAGE_SIZE)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= totalKnums}
              className="text-sm px-3 py-1.5 rounded border border-[var(--neutral-300)] disabled:opacity-30 cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Map dialog */}
      {mapKnum && (
        <MapDialog
          knum={mapKnum}
          onClose={() => setMapKnum(null)}
          onConfirm={handleMapConfirm}
        />
      )}
    </div>
  );
}
