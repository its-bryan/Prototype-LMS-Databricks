import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useData } from "../../context/DataContext";

export default function InteractiveOrgMapping() {
  const { orgMapping } = useData();
  const [rows, setRows] = useState(() => orgMapping.map((r) => ({ ...r })));
  const [editingRow, setEditingRow] = useState(null);
  const [editBmValue, setEditBmValue] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [filterZone, setFilterZone] = useState("All");
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [seedStatus, setSeedStatus] = useState(null); // null | "loading" | { ok, total, bm_assigned, hles_file, employee_file } | { error }
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(0);

  const zones = useMemo(
    () => ["All", ...new Set(rows.map((r) => r.zone).filter(Boolean))],
    [rows],
  );

  const unassignedCount = rows.filter((r) => !r.bm || r.bm === "— Unassigned —").length;

  const filteredRows = useMemo(() => {
    let result = rows;
    if (filterZone !== "All") result = result.filter((r) => r.zone === filterZone);
    if (filterUnassigned) result = result.filter((r) => !r.bm || r.bm === "— Unassigned —");
    return result;
  }, [rows, filterZone, filterUnassigned]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedRows = filteredRows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const handleEditStart = (row) => {
    setEditingRow(row.branch);
    setEditBmValue(row.bm || "");
  };

  const handleEditSave = async (branch) => {
    const newBm = editBmValue.trim();
    setRows((prev) => prev.map((r) => (r.branch === branch ? { ...r, bm: newBm } : r)));
    setEditingRow(null);
    setEditBmValue("");
    // Persist to DB
    try {
      await fetch(`/api/config/org-mapping/${encodeURIComponent(branch)}/bm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bm: newBm }),
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch {
      // best-effort; local state already updated
    }
  };

  const handleSeedFromProdfiles = async () => {
    setSeedStatus("loading");
    try {
      const res = await fetch("/api/config/org-mapping/seed-from-prodfiles", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSeedStatus({ error: data.detail || "Seed failed" });
      } else {
        setSeedStatus(data);
        // Refresh rows from updated DB via page reload (simplest since DataContext loads on mount)
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (e) {
      setSeedStatus({ error: String(e) });
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--hertz-black)]">Organisation Mapping</h2>
          <p className="text-sm text-[var(--neutral-500)] mt-1">
            Branch, AM, GM, and Zone are sourced from the HLES file. BM names come from the March 2026 employee listing.
            Click any BM cell to edit manually.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isSaved && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-[var(--color-success)] text-sm font-medium"
            >
              Saved
            </motion.span>
          )}
          <button
            onClick={handleSeedFromProdfiles}
            disabled={seedStatus === "loading"}
            className="px-4 py-2 bg-[var(--hertz-black)] text-white rounded-lg text-sm font-semibold hover:bg-[#333] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {seedStatus === "loading" ? "Refreshing…" : "Refresh from Source Files"}
          </button>
        </div>
      </div>

      {/* Seed result banner */}
      {seedStatus && seedStatus !== "loading" && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${seedStatus.error ? "bg-[#FFEBEE] text-[var(--color-error)] border border-[#FFCDD2]" : "bg-[#E8F5E9] text-[var(--color-success)] border border-[#C8E6C9]"}`}>
          {seedStatus.error ? (
            <span>Seed failed: {seedStatus.error}</span>
          ) : (
            <span>
              Refreshed {seedStatus.total} branches — {seedStatus.bm_assigned} BMs assigned from{" "}
              <span className="font-medium">{seedStatus.employee_file}</span> ×{" "}
              <span className="font-medium">{seedStatus.hles_file}</span>. Reloading…
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 mb-5">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[var(--neutral-500)]">Zone</label>
          <select
            value={filterZone}
            onChange={(e) => { setFilterZone(e.target.value); setPage(0); }}
            className="text-sm border border-[var(--neutral-200)] rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-[var(--hertz-primary)]"
          >
            {zones.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { setFilterUnassigned(!filterUnassigned); setPage(0); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
            filterUnassigned
              ? "border-[var(--color-error)] bg-[#FFEBEE] text-[var(--color-error)]"
              : "border-[var(--neutral-200)] text-[var(--neutral-500)] hover:border-[var(--neutral-400)]"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${unassignedCount > 0 ? "bg-[var(--color-error)]" : "bg-[var(--neutral-300)]"}`} />
          {unassignedCount} Unassigned
        </button>
        <span className="text-xs text-[var(--neutral-400)]">
          {filteredRows.length} of {rows.length} branches
        </span>
      </div>

      {/* Table */}
      <div className="border border-[var(--neutral-200)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--hertz-black)] text-white text-xs uppercase tracking-wide">
              <th className="px-4 py-2.5 text-left font-medium">Branch Manager</th>
              <th className="px-4 py-2.5 text-left font-medium">Branch Location</th>
              <th className="px-4 py-2.5 text-left font-medium">
                Area Manager
                <span className="ml-1 text-[10px] font-normal text-[var(--neutral-400)]">(HLES)</span>
              </th>
              <th className="px-4 py-2.5 text-left font-medium">
                General Manager
                <span className="ml-1 text-[10px] font-normal text-[var(--neutral-400)]">(HLES)</span>
              </th>
              <th className="px-4 py-2.5 text-left font-medium">
                Zone
                <span className="ml-1 text-[10px] font-normal text-[var(--neutral-400)]">(HLES)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, i) => {
              const isUnassigned = !row.bm || row.bm === "— Unassigned —";
              const isEditing = editingRow === row.branch;
              return (
                <motion.tr
                  key={row.branch}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className={`border-t border-[var(--neutral-100)] ${
                    isEditing
                      ? "bg-[var(--hertz-primary-subtle)]"
                      : isUnassigned
                        ? "bg-[#FFF8F8]"
                        : "hover:bg-[var(--neutral-50)]"
                  }`}
                >
                  <td className="px-4 py-2.5">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editBmValue}
                          onChange={(e) => setEditBmValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSave(row.branch);
                            if (e.key === "Escape") { setEditingRow(null); setEditBmValue(""); }
                          }}
                          placeholder="Enter BM name"
                          className="border border-[var(--hertz-primary)] rounded px-2 py-1 bg-white text-sm focus:outline-none w-48"
                          autoFocus
                        />
                        <button
                          onClick={() => handleEditSave(row.branch)}
                          className="text-xs font-medium text-[var(--hertz-black)] bg-[var(--hertz-primary)] px-2 py-1 rounded hover:bg-[var(--hertz-primary-hover)] cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingRow(null); setEditBmValue(""); }}
                          className="text-xs text-[var(--neutral-500)] hover:text-[var(--hertz-black)] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : isUnassigned ? (
                      <button
                        onClick={() => handleEditStart(row)}
                        className="text-[var(--color-error)] italic cursor-pointer hover:underline text-sm"
                      >
                        — Unassigned — click to assign
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEditStart(row)}
                        className="cursor-pointer hover:text-[var(--hertz-primary)] transition-colors text-sm font-medium"
                      >
                        {row.bm}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--neutral-600)]">{row.branch}</td>
                  <td className="px-4 py-2.5 text-[var(--neutral-500)]">{row.am || "—"}</td>
                  <td className="px-4 py-2.5 text-[var(--neutral-500)]">{row.gm || "—"}</td>
                  <td className="px-4 py-2.5 text-[var(--neutral-500)]">{row.zone || "—"}</td>
                </motion.tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--neutral-400)] text-sm">
                  No branches match the current filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-[var(--neutral-500)]">
            Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={safePage === 0}
              className="px-2 py-1 text-xs rounded border border-[var(--neutral-200)] hover:bg-[var(--neutral-50)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              First
            </button>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="px-2 py-1 text-xs rounded border border-[var(--neutral-200)] hover:bg-[var(--neutral-50)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Prev
            </button>
            <span className="px-2 text-xs font-medium text-[var(--hertz-black)]">
              {safePage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="px-2 py-1 text-xs rounded border border-[var(--neutral-200)] hover:bg-[var(--neutral-50)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={safePage >= totalPages - 1}
              className="px-2 py-1 text-xs rounded border border-[var(--neutral-200)] hover:bg-[var(--neutral-50)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Last
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--neutral-400)] mt-3">
        AM, GM, and Zone are sourced from the HLES file (read-only here). BM names come from the employee listing and can be edited manually.
        Use <span className="font-medium">Refresh from Source Files</span> to re-sync from the latest prodfiles.
      </p>
    </div>
  );
}
