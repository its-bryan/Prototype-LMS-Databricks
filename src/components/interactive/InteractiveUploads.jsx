import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { parseHlesCsv } from "../../utils/csvParsers";
import { reconcileHlesUpload, buildCommitPlan } from "../../utils/reconciliation";
import { leads as mockLeads } from "../../data/mockData";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { uploadHlesFile, fetchUploadHistory, fetchUploadIngestionStatus } from "../../data/databricksData";

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------
function exportToCsv(filename, headers, rows) {
  const escape = (val) => {
    const str = String(val ?? "");
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(row.map(escape).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------
const STEPS = [
  { key: "select", label: "Select Files" },
  { key: "validate", label: "Validate" },
  { key: "preview", label: "Preview & Resolve" },
  { key: "commit", label: "Commit" },
  { key: "summary", label: "Summary" },
];

function StepIndicator({ currentStep }) {
  const idx = STEPS.findIndex((s) => s.key === currentStep);
  return (
    <div className="flex items-center gap-1 mb-8">
      {STEPS.map((step, i) => {
        const isActive = i === idx;
        const isDone = i < idx;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-[var(--hertz-primary)] text-[var(--hertz-black)]"
                    : isDone
                      ? "bg-[var(--hertz-black)] text-white"
                      : "bg-[var(--neutral-100)] text-[var(--neutral-400)]"
                }`}
              >
                {isDone ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs font-medium hidden sm:inline ${
                  isActive ? "text-[var(--hertz-black)]" : isDone ? "text-[var(--neutral-600)]" : "text-[var(--neutral-400)]"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px mx-2 ${i < idx ? "bg-[var(--hertz-black)]" : "bg-[var(--neutral-200)]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ingestionBadge(status) {
  if (status === "in_progress") {
    return { label: "In progress", className: "bg-blue-100 text-blue-800" };
  }
  if (status === "failed") {
    return { label: "Failed", className: "bg-red-100 text-red-800" };
  }
  return { label: "Success", className: "bg-emerald-100 text-emerald-800" };
}

// ---------------------------------------------------------------------------
// File drop zone
// ---------------------------------------------------------------------------
function FileDropZone({ label, accept, file, onFileSelect, disabled }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) onFileSelect(dropped);
    },
    [onFileSelect],
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
        dragOver
          ? "border-[var(--hertz-primary)] bg-[var(--hertz-primary-subtle)]"
          : file
            ? "border-[var(--hertz-black)] bg-[var(--neutral-50)]"
            : "border-[var(--neutral-200)] hover:border-[var(--neutral-400)]"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
      />
      {file ? (
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--hertz-black)] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-[var(--hertz-black)]">{file.name}</p>
            <p className="text-xs text-[var(--neutral-500)]">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onFileSelect(null); }}
            className="ml-2 text-xs text-[var(--neutral-500)] hover:text-[#C62828] cursor-pointer"
          >
            Remove
          </button>
        </div>
      ) : (
        <>
          <svg className="w-8 h-8 text-[var(--neutral-400)] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm font-medium text-[var(--hertz-black)] mb-1">{label}</p>
          <p className="text-xs text-[var(--neutral-500)]">Drag & drop or click to browse (.csv, .xlsx)</p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Validate step: loader with progress bar (shown while parsing)
// ---------------------------------------------------------------------------
function ValidateStepLoader({ progress }) {
  const { phase, pct } = progress;
  return (
    <div
      className="border border-[var(--neutral-200)] rounded-lg p-6 bg-[var(--neutral-100)] shadow-sm"
      role="status"
      aria-live="polite"
      aria-label="Validating upload"
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-8 h-8 border-2 border-[var(--hertz-primary)] border-t-transparent rounded-full animate-spin shrink-0"
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-semibold text-[var(--hertz-black)]">Validating your file(s)</p>
          <p className="text-sm text-[var(--neutral-600)]">{phase || "Starting…"}</p>
        </div>
      </div>
      <div className="h-2.5 bg-[var(--neutral-200)] rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-[var(--hertz-primary)] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      </div>
      <p className="text-xs font-medium text-[var(--neutral-600)] mt-2">{Math.round(pct)}%</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Validation summary card
// ---------------------------------------------------------------------------
function ValidationCard({ title, stats, errors, isLoading }) {
  const [showErrors, setShowErrors] = useState(false);

  if (isLoading) {
    return (
      <div className="border border-[var(--neutral-200)] rounded-lg p-5">
        <p className="text-sm font-semibold text-[var(--hertz-black)] mb-3">{title}</p>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[var(--hertz-primary)] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[var(--neutral-500)]">Parsing and validating...</span>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-[var(--neutral-200)] rounded-lg p-5"
    >
      <p className="text-sm font-semibold text-[var(--hertz-black)] mb-3">{title}</p>
      <div className="space-y-1.5">
        {stats.map((s, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-[var(--neutral-500)]">{s.label}</span>
            <span className={`font-medium ${s.color || "text-[var(--hertz-black)]"}`}>{s.value}</span>
          </div>
        ))}
      </div>
      {errors?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--neutral-100)]">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="text-xs font-medium text-[#C62828] hover:underline cursor-pointer flex items-center gap-1"
          >
            <svg className={`w-3 h-3 transition-transform ${showErrors ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {errors.length} row{errors.length !== 1 ? "s" : ""} skipped due to missing or invalid data
          </button>
          <AnimatePresence>
            {showErrors && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <p className="text-xs text-[#C62828] opacity-80 mt-2 mb-1">
                  These rows were excluded from the upload. Fix the issues in your CSV file and re-upload to include them.
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {errors.map((err, i) => (
                    <p key={i} className="text-xs text-[#C62828] font-mono">{err}</p>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Preview table
// ---------------------------------------------------------------------------
function PreviewTable({ reconciliation }) {
  const { summary } = reconciliation;
  const [activeTab, setActiveTab] = useState("all");

  const items = {
    all: [
      ...reconciliation.newLeads.map((i) => ({ ...i, category: "new" })),
      ...reconciliation.updatedLeads.map((i) => ({ ...i, category: "updated" })),
      ...reconciliation.conflicts.map((i) => ({ ...i, category: "conflict" })),
      ...reconciliation.unchangedLeads.map((i) => ({ ...i, category: "unchanged" })),
    ],
    new: reconciliation.newLeads.map((i) => ({ ...i, category: "new" })),
    updated: reconciliation.updatedLeads.map((i) => ({ ...i, category: "updated" })),
    conflicts: reconciliation.conflicts.map((i) => ({ ...i, category: "conflict" })),
    orphaned: reconciliation.orphanedLeads.map((lead) => ({ existing: lead, category: "orphaned" })),
  };

  const tabs = [
    { key: "all", label: "All", count: summary.total },
    { key: "new", label: "New", count: summary.new },
    { key: "updated", label: "Updated", count: summary.updated },
    { key: "conflicts", label: "Conflicts", count: summary.conflicts, color: summary.conflicts > 0 ? "text-[#E65100]" : "" },
    { key: "orphaned", label: "Orphaned", count: summary.orphaned, color: summary.orphaned > 0 ? "text-[#E65100]" : "" },
  ];

  const displayItems = items[activeTab] || [];
  const categoryColors = {
    new: "bg-[var(--neutral-100)] text-[var(--neutral-600)]",
    updated: "bg-[var(--neutral-100)] text-[var(--neutral-600)]",
    conflict: "bg-[#FFF3E0] text-[#E65100]",
    unchanged: "bg-[var(--neutral-100)] text-[var(--neutral-500)]",
    orphaned: "bg-[#FFF3E0] text-[#E65100]",
  };

  return (
    <div>
      {/* Summary tiles */}
      <div className="grid grid-cols-5 gap-3 mb-2">
        {[
          { label: "Total Rows", value: summary.total, bg: "bg-[var(--neutral-100)]", text: "text-[var(--hertz-black)]" },
          { label: "New Leads", value: summary.new, bg: "bg-[var(--neutral-100)]", text: "text-[var(--hertz-black)]" },
          { label: "Updated", value: summary.updated, bg: "bg-[var(--neutral-100)]", text: "text-[var(--hertz-black)]" },
          { label: "Conflicts", value: summary.conflicts, bg: summary.conflicts > 0 ? "bg-[#FFF3E0] alert-pulse" : "bg-[var(--neutral-100)]", text: summary.conflicts > 0 ? "text-[#E65100]" : "text-[var(--hertz-black)]" },
          { label: "Orphaned", value: summary.orphaned, bg: summary.orphaned > 0 ? "bg-[#FFF3E0] alert-pulse" : "bg-[var(--neutral-100)]", text: summary.orphaned > 0 ? "text-[#E65100]" : "text-[var(--hertz-black)]" },
        ].map((tile) => (
          <div key={tile.label} className={`${tile.bg} rounded-lg p-3`}>
            <p className={`text-2xl font-bold ${tile.text}`}>{tile.value}</p>
            <p className={`text-xs ${tile.text} opacity-70`}>{tile.label}</p>
          </div>
        ))}
      </div>
      {(summary.conflicts > 0 || summary.orphaned > 0) && (
        <div className="mb-5 space-y-1">
          {summary.conflicts > 0 && (
            <p className="text-xs text-[#E65100]">
              {summary.conflicts} lead{summary.conflicts !== 1 ? "s have" : " has"} conflicting data between BM comments and this upload. Resolve each conflict below before committing.
            </p>
          )}
          {summary.orphaned > 0 && (
            <p className="text-xs text-[#E65100]">
              {summary.orphaned} lead{summary.orphaned !== 1 ? "s exist" : " exists"} in the database but not in this upload. Choose to keep, archive, or remove them below.
            </p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-[var(--neutral-200)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.key
                ? "border-[var(--hertz-primary)] text-[var(--hertz-black)]"
                : "border-transparent text-[var(--neutral-500)] hover:text-[var(--hertz-black)]"
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 ${tab.color || ""}`}>({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-[var(--neutral-200)] rounded-lg overflow-hidden max-h-80 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-[var(--hertz-black)] text-white sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Reservation ID</th>
              <th className="px-3 py-2 text-left font-medium">Customer</th>
              <th className="px-3 py-2 text-left font-medium">Branch</th>
              <th className="px-3 py-2 text-left font-medium">Lead Status</th>
              <th className="px-3 py-2 text-left font-medium">Changes</th>
            </tr>
          </thead>
          <tbody>
            {displayItems.slice(0, 100).map((item, i) => {
              const lead = item.parsed || item.existing;
              return (
                <tr key={i} className="border-t border-[var(--neutral-100)] hover:bg-[var(--neutral-50)]">
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${categoryColors[item.category]}`}>
                      {item.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono">{lead?.reservationId || lead?.confirmNum || "—"}</td>
                  <td className="px-3 py-2">{lead?.customer || "—"}</td>
                  <td className="px-3 py-2">{lead?.branch || "—"}</td>
                  <td className="px-3 py-2">{lead?.status || "—"}</td>
                  <td className="px-3 py-2 text-[var(--neutral-500)]">
                    {item.sourceChanges?.length
                      ? item.sourceChanges.map((c) => c.field).join(", ")
                      : item.enrichmentConflicts?.length
                        ? `${item.enrichmentConflicts.length} conflict(s)`
                        : "—"}
                  </td>
                </tr>
              );
            })}
            {displayItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[var(--neutral-400)]">
                  No items in this category
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {displayItems.length > 100 && (
          <div className="px-3 py-2 bg-[var(--neutral-50)] text-xs text-[var(--neutral-500)] text-center">
            Showing first 100 of {displayItems.length} rows
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conflict resolution
// ---------------------------------------------------------------------------
function ConflictResolver({ conflicts, resolutions, onResolve }) {
  if (!conflicts?.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-[var(--hertz-black)]">
            {conflicts.length} Enrichment Conflict{conflicts.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-[var(--neutral-500)]">
            These leads have been enriched by BMs but the new HLES upload has different source values.
            Choose how to handle each conflict.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => conflicts.forEach((_, i) => onResolve(i, "keep_enriched"))}
            className="px-3 py-1.5 text-xs font-medium border border-[var(--neutral-300)] rounded hover:bg-[var(--neutral-50)] cursor-pointer"
          >
            Keep All Enriched
          </button>
          <button
            onClick={() => conflicts.forEach((_, i) => onResolve(i, "use_source"))}
            className="px-3 py-1.5 text-xs font-medium border border-[var(--neutral-300)] rounded hover:bg-[var(--neutral-50)] cursor-pointer"
          >
            Use All Source
          </button>
        </div>
      </div>

      {conflicts.map((conflict, idx) => {
        const resolution = resolutions[idx];
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`border rounded-lg p-4 ${
              resolution
                ? "border-[var(--neutral-200)] bg-[var(--neutral-50)]"
                : "border-[#E65100] bg-[#FFF3E0] alert-pulse"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-[var(--hertz-black)]">
                  {conflict.existing?.customer || conflict.parsed?.customer} &mdash;{" "}
                  <span className="font-mono text-xs">{conflict.parsed?.reservationId}</span>
                </p>
                <p className="text-xs text-[var(--neutral-500)]">{conflict.existing?.branch}</p>
              </div>
              {resolution && (
                <span className="text-xs font-medium text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded">
                  Resolved: {resolution === "keep_enriched" ? "Keep Enriched" : resolution === "use_source" ? "Use Source" : "Skip"}
                </span>
              )}
            </div>

            {conflict.enrichmentConflicts?.map((ec, ecIdx) => (
              <div key={ecIdx} className="mb-3 p-3 bg-white rounded border border-[var(--neutral-200)]">
                <p className="text-xs font-semibold text-[var(--hertz-black)] mb-2">{ec.field}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--neutral-500)] mb-1">New (HLES Source)</p>
                    <p className="text-sm font-medium text-[#1565C0]">{ec.sourceValue || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--neutral-500)] mb-1">Current (Enriched)</p>
                    <p className="text-sm font-medium text-[#E65100]">{ec.enrichedValue || "—"}</p>
                  </div>
                </div>
                <p className="text-xs text-[var(--neutral-500)] mt-2">{ec.detail}</p>
              </div>
            ))}

            <div className="flex gap-2 mt-2">
              {["keep_enriched", "use_source", "skip"].map((action) => (
                <button
                  key={action}
                  onClick={() => onResolve(idx, action)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                    resolution === action
                      ? "bg-[var(--hertz-black)] text-white"
                      : "border border-[var(--neutral-300)] hover:bg-[var(--neutral-50)]"
                  }`}
                >
                  {action === "keep_enriched" ? "Keep Enriched" : action === "use_source" ? "Use Source" : "Skip Lead"}
                </button>
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orphan action selector
// ---------------------------------------------------------------------------
function OrphanActionSelector({ orphanedLeads, orphanAction, onOrphanAction }) {
  if (!orphanedLeads?.length) return null;

  return (
    <div className="border border-[#FFEBEE] rounded-lg p-5 bg-[#FFF8F8]">
      <p className="text-sm font-semibold text-[var(--hertz-black)] mb-1">
        {orphanedLeads.length} Orphaned Lead{orphanedLeads.length !== 1 ? "s" : ""}
      </p>
      <p className="text-xs text-[var(--neutral-500)] mb-1">
        These leads exist in the database but were not in this HLES upload.
        This usually means they've fallen outside the rolling 8-week reporting window.
      </p>
      <p className="text-xs text-[var(--neutral-500)] mb-4">
        Choose what to do with them before committing.
      </p>
      <div className="flex gap-2">
        {[
          { value: "keep", label: "Keep As-Is", desc: "No changes — leads stay active in BM and GM views" },
          { value: "archive", label: "Archive All", desc: "Hide from active views but preserve data for reporting" },
          { value: "delete", label: "Remove All", desc: "Permanently delete — this cannot be undone", destructive: true },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => onOrphanAction(opt.value)}
            className={`flex-1 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
              orphanAction === opt.value
                ? opt.destructive
                  ? "border-[#C62828] bg-[#FFEBEE]"
                  : "border-[var(--hertz-black)] bg-[var(--neutral-50)]"
                : "border-[var(--neutral-200)] hover:border-[var(--neutral-400)]"
            }`}
          >
            <p className={`text-sm font-medium ${opt.destructive && orphanAction === opt.value ? "text-[#C62828]" : "text-[var(--hertz-black)]"}`}>{opt.label}</p>
            <p className="text-xs text-[var(--neutral-500)]">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Upload Wizard
// ---------------------------------------------------------------------------
export default function InteractiveUploads() {
  const navigate = useNavigate();
  const { leads: contextLeads, refetchLeads, refetchOrgMapping, refetchDataAsOfDate, refetchSnapshot } = useData();
  const { userProfile } = useAuth();

  const [step, setStep] = useState("select");
  const [hlesFile, setHlesFile] = useState(null);

  // Parse results
  const [hlesParsed, setHlesParsed] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [validateStarting, setValidateStarting] = useState(false);
  const [validateProgress, setValidateProgress] = useState({ phase: "", pct: 0 });

  // Reconciliation
  const [hlesReconciliation, setHlesReconciliation] = useState(null);

  // Conflict resolution
  const [conflictResolutions, setConflictResolutions] = useState({});
  const [orphanAction, setOrphanAction] = useState("keep");

  // Commit
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState(null);
  const [commitError, setCommitError] = useState(null);
  const [commitProgress, setCommitProgress] = useState({ phase: "", pct: 0, detail: "" });

  // Upload history (past uploads list)
  const [uploadHistory, setUploadHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyExpandedId, setHistoryExpandedId] = useState(null);

  // Load upload history on mount and when returning to the page
  const loadUploadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const list = await fetchUploadHistory();
      setUploadHistory(list);
    } catch {
      setUploadHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);
  useEffect(() => {
    loadUploadHistory();
  }, [loadUploadHistory]);

  // Use Supabase leads when available, fall back to mock leads
  const existingLeads = useMemo(() => {
    const source = contextLeads.length > 0 ? contextLeads : mockLeads;
    return source.map((l) => ({ ...l, confirmNum: l.confirmNum || l.reservationId }));
  }, [contextLeads]);

  // ---- Step: Validate ----
  const handleValidate = useCallback(async () => {
    setValidateStarting(true);
    setHlesParsed(null);
    setHlesReconciliation(null);
    setParsing(true);
    setValidateProgress({ phase: "Preparing…", pct: 5 });
    setStep("validate");

    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));

    try {
      setValidateProgress({ phase: "Reading and parsing HLES file…", pct: 15 });
      const hResult = await parseHlesCsv(hlesFile);
      setHlesParsed(hResult);
      setValidateProgress({ phase: "Running reconciliation…", pct: 70 });

      if (hResult?.leads?.length) {
        const recon = reconcileHlesUpload(hResult.leads, existingLeads);
        setHlesReconciliation(recon);
      }

      setValidateProgress({ phase: "Validation complete", pct: 100 });
    } catch (err) {
      console.error("Parse error:", err);
      setValidateProgress({ phase: "Validation failed", pct: 100 });
    }

    setParsing(false);
    setValidateStarting(false);
  }, [hlesFile, existingLeads]);

  // ---- Step: Commit ----
  const handleCommit = useCallback(async () => {
    setCommitting(true);
    setCommitError(null);
    setStep("commit");

    const plan = hlesReconciliation
      ? buildCommitPlan(hlesReconciliation, conflictResolutions, orphanAction)
      : { inserts: [], updates: [], archives: [], skips: [] };

    // Databricks: send HLES file to backend (lands in Volume + ETL to Postgres)
    if (hlesFile) {
      try {
        setCommitProgress({
          phase: "Uploading HLES",
          pct: 20,
          detail: "Landing in Volume & running ETL…",
        });
        const result = await uploadHlesFile(hlesFile, {
          uploadedBy: userProfile?.displayName ?? undefined,
        });
        setCommitResult({
          hles: {
            inserted: result.newLeads ?? 0,
            updated: result.updated ?? 0,
            failed: result.failed ?? 0,
            rowsParsed: result.rowsParsed ?? 0,
            landedPath: result.landedPath ?? null,
            archived: 0,
            skipped: 0,
          },
          ingestion: {
            uploadId: result.uploadId ?? null,
            state: result.ingestion_status ?? "in_progress",
            error: null,
          },
          translog: null,
          orgMapping: null,
        });
        refetchLeads?.();
        refetchOrgMapping?.();
        refetchDataAsOfDate?.();
        setStep("summary");
      } catch (err) {
        setCommitError(err?.message ?? "Upload failed");
        setStep("preview");
      } finally {
        setCommitting(false);
      }
      return;
    }
    setCommitting(false);
    setStep("summary");
  }, [hlesReconciliation, conflictResolutions, orphanAction, hlesFile, refetchLeads, refetchOrgMapping, refetchDataAsOfDate, refetchSnapshot, userProfile?.displayName, loadUploadHistory]);

  const handleResolveConflict = useCallback((idx, resolution) => {
    setConflictResolutions((prev) => ({ ...prev, [idx]: resolution }));
  }, []);

  useEffect(() => {
    const uploadId = commitResult?.ingestion?.uploadId;
    const state = commitResult?.ingestion?.state;
    if (!uploadId || state !== "in_progress") return;

    let isCancelled = false;
    let attempts = 0;
    const maxAttempts = 40;

    const poll = async () => {
      attempts += 1;
      try {
        const status = await fetchUploadIngestionStatus(uploadId);
        if (isCancelled) return;
        setCommitResult((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            ingestion: {
              ...(prev.ingestion ?? {}),
              uploadId,
              state: status.state,
              error: status.error ?? null,
              startedAt: status.startedAt ?? null,
              updatedAt: status.updatedAt ?? null,
            },
          };
        });
        if (status.state === "success") {
          loadUploadHistory();
          refetchSnapshot?.({ poll: true });
          return;
        }
        if (status.state === "failed") {
          loadUploadHistory();
          return;
        }
      } catch {
        // Keep polling quietly; upload summary will still reflect final status.
      }

      if (!isCancelled && attempts < maxAttempts) {
        setTimeout(poll, 3000);
      }
    };

    poll();
    return () => {
      isCancelled = true;
    };
  }, [commitResult?.ingestion?.uploadId, commitResult?.ingestion?.state, loadUploadHistory, refetchSnapshot]);

  const allConflictsResolved =
    !hlesReconciliation?.conflicts?.length ||
    hlesReconciliation.conflicts.every((_, i) => conflictResolutions[i]);

  const canProceedFromPreview = allConflictsResolved;

  const handleReset = useCallback(() => {
    setStep("select");
    setValidateProgress({ phase: "", pct: 0 });
    setValidateStarting(false);
    setHlesFile(null);
    setHlesParsed(null);
    setHlesReconciliation(null);
    setConflictResolutions({});
    setOrphanAction("keep");
    setCommitting(false);
    setCommitResult(null);
    setCommitProgress({ phase: "", pct: 0, detail: "" });
  }, []);

  // ---- Render ----
  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--hertz-black)]">Data Uploads</h2>
        <p className="text-sm text-[var(--neutral-500)] mt-1">
          Upload HLES CSV files to refresh lead data. The system will validate,
          detect conflicts with enriched data, and let you resolve them before committing.
        </p>
      </div>

      <StepIndicator currentStep={step} />

      <AnimatePresence mode="wait">
        {/* ---- STEP: SELECT FILES ---- */}
        {step === "select" && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="max-w-md mb-6">
              <p className="text-sm font-semibold text-[var(--hertz-black)] mb-2">HLES Conversion Data</p>
              <FileDropZone
                label="Drop HLES CSV file here"
                accept=".csv,.xlsx"
                file={hlesFile}
                onFileSelect={setHlesFile}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleValidate}
                disabled={!hlesFile || validateStarting}
                className="px-5 py-2.5 bg-[var(--hertz-primary)] text-[var(--hertz-black)] rounded-lg text-sm font-semibold hover:bg-[#E6BC00] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {validateStarting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-[var(--hertz-black)] border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </span>
                ) : (
                  "Upload & Validate"
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ---- STEP: VALIDATE ---- */}
        {step === "validate" && (
          <motion.div
            key="validate"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-[200px]"
          >
            {parsing || (hlesFile && !hlesParsed) ? (
              <ValidateStepLoader progress={validateProgress} />
            ) : (
              <>
                <div className="max-w-md">
                  <ValidationCard
                    title="HLES Conversion Data"
                    isLoading={false}
                    stats={
                      hlesParsed
                        ? [
                            { label: "Rows parsed", value: hlesParsed.rawRowCount.toLocaleString() },
                            { label: "Valid leads", value: hlesParsed.leads.length.toLocaleString() },
                            { label: "Branches found", value: hlesParsed.orgRows.length.toLocaleString() },
                            { label: "Validation errors", value: hlesParsed.errors.length.toString(), color: hlesParsed.errors.length ? "text-[#C62828] alert-pulse-red" : "" },
                          ]
                        : null
                    }
                    errors={hlesParsed?.errors}
                  />
                </div>
                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => setStep("select")}
                    className="px-4 py-2 text-sm text-[var(--neutral-500)] hover:text-[var(--hertz-black)] cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep("preview")}
                    className="px-5 py-2.5 bg-[var(--hertz-primary)] text-[var(--hertz-black)] rounded-lg text-sm font-semibold hover:bg-[#E6BC00] transition-colors cursor-pointer"
                  >
                    Continue to Preview
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ---- STEP: PREVIEW ---- */}
        {step === "preview" && hlesReconciliation && (
          <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PreviewTable reconciliation={hlesReconciliation} />

            {commitError && (
              <div className="mt-6 rounded-lg p-4 bg-[#FFEBEE] alert-pulse-red">
                <p className="text-sm font-semibold text-[#C62828] mb-1">Commit Failed</p>
                <p className="text-xs text-[#C62828] mb-2">{commitError}</p>
                <p className="text-xs text-[#C62828] opacity-80">
                  Try committing again. If the error persists, check the browser console for details or contact your system administrator.
                </p>
              </div>
            )}

            {hlesReconciliation.conflicts.length > 0 && (
              <div className="mt-6">
                <ConflictResolver
                  conflicts={hlesReconciliation.conflicts}
                  resolutions={conflictResolutions}
                  onResolve={handleResolveConflict}
                />
              </div>
            )}

            {hlesReconciliation.orphanedLeads.length > 0 && (
              <div className="mt-6">
                <OrphanActionSelector
                  orphanedLeads={hlesReconciliation.orphanedLeads}
                  orphanAction={orphanAction}
                  onOrphanAction={setOrphanAction}
                />
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button
                onClick={() => setStep("select")}
                className="px-4 py-2 text-sm text-[var(--neutral-500)] hover:text-[var(--hertz-black)] cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleCommit}
                disabled={!canProceedFromPreview}
                className="px-5 py-2.5 bg-[var(--hertz-primary)] text-[var(--hertz-black)] rounded-lg text-sm font-semibold hover:bg-[#E6BC00] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {hlesReconciliation.conflicts.length > 0 && !allConflictsResolved
                  ? `Resolve ${hlesReconciliation.conflicts.length - Object.keys(conflictResolutions).length} Conflict(s) to Continue`
                  : "Commit Changes"}
              </button>
            </div>
          </motion.div>
        )}

        {/* No data to preview */}
        {step === "preview" && !hlesReconciliation && !parsing && (
          <motion.div key="preview-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="text-center py-12 text-[var(--neutral-400)]">
              <p>No data to preview. Go back and select a file.</p>
              <button onClick={() => setStep("select")} className="mt-4 text-sm text-[var(--hertz-primary)] hover:underline cursor-pointer">
                Back to File Selection
              </button>
            </div>
          </motion.div>
        )}

        {/* ---- STEP: COMMIT ---- */}
        {step === "commit" && committing && (
          <motion.div key="commit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="py-12 max-w-md mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 border-2 border-[var(--hertz-primary)] border-t-transparent rounded-full animate-spin shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[var(--hertz-black)]">{commitProgress.phase || "Preparing..."}</p>
                  {commitProgress.detail && (
                    <p className="text-xs text-[var(--neutral-500)] mt-0.5">{commitProgress.detail}</p>
                  )}
                </div>
              </div>

              <div className="w-full h-2 bg-[var(--neutral-100)] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[var(--hertz-primary)] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${commitProgress.pct}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>
              <p className="text-xs text-[var(--neutral-400)] text-right mt-1.5">{commitProgress.pct}%</p>
            </div>
          </motion.div>
        )}

        {/* ---- STEP: SUMMARY ---- */}
        {step === "summary" && !commitResult && !committing && (
          <motion.div key="summary-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="text-center py-8 border border-[var(--neutral-200)] rounded-lg bg-[var(--neutral-50)]">
              <p className="text-sm text-[var(--neutral-600)]">No summary data available. You can start a new upload.</p>
              <button
                onClick={handleReset}
                className="mt-4 px-4 py-2 text-sm font-medium text-[var(--hertz-primary)] hover:underline cursor-pointer"
              >
                Back to File Selection
              </button>
            </div>
          </motion.div>
        )}
        {step === "summary" && commitResult && (
          <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {(() => {
              const ingestion = commitResult.ingestion ?? { state: "success" };
              const badge = ingestionBadge(ingestion.state);
              const title =
                ingestion.state === "in_progress"
                  ? "Upload accepted"
                  : ingestion.state === "failed"
                    ? "Upload complete with ingestion errors"
                    : "Upload complete";
              const subtitle =
                ingestion.state === "in_progress"
                  ? "File upload succeeded. Data ingestion jobs are still running in the background."
                  : ingestion.state === "failed"
                    ? "File upload succeeded, but one or more downstream ingestion jobs failed."
                    : "Data has been processed and committed successfully. It is now visible across all views.";

              return (
                <div className="text-center mb-8">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    ingestion.state === "failed" ? "bg-[#FFEBEE]" : "bg-[#E8F5E9]"
                  }`}>
                    {ingestion.state === "failed" ? (
                      <svg className="w-8 h-8 text-[#C62828]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : ingestion.state === "in_progress" ? (
                      <div className="w-8 h-8 border-2 border-[var(--hertz-primary)] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-8 h-8 text-[#2E7D32]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-[var(--hertz-black)]">{title}</h3>
                  <p className="text-sm text-[var(--neutral-500)] mt-1">{subtitle}</p>

                  <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--neutral-200)] bg-white px-3 py-2">
                    <span className="text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wide">Data ingestion status</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                      {ingestion.state === "in_progress" && (
                        <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                      )}
                      {badge.label}
                    </span>
                  </div>
                  {ingestion.error && (
                    <p className="text-xs text-[#C62828] mt-2">{ingestion.error}</p>
                  )}
                </div>
              );
            })()}

            {commitResult.hles && (
              <div className="border border-[var(--neutral-200)] rounded-lg p-5 mb-8 max-w-md">
                <p className="text-sm font-semibold text-[var(--hertz-black)] mb-3">HLES Results</p>
                <div className="space-y-2">
                  {[
                    { label: "New leads inserted", value: commitResult.hles.inserted },
                    { label: "Existing leads updated", value: commitResult.hles.updated },
                    { label: "Leads archived", value: commitResult.hles.archived ?? 0 },
                    commitResult.hles.deleted > 0 && { label: "Leads removed", value: commitResult.hles.deleted, color: "text-[#C62828]" },
                    { label: "Leads skipped", value: commitResult.hles.skipped ?? 0 },
                    commitResult.hles.rowsParsed != null && { label: "Rows parsed", value: commitResult.hles.rowsParsed },
                    (commitResult.hles.failed ?? 0) > 0 && { label: "Rows failed", value: commitResult.hles.failed, color: "text-[#C62828]" },
                    commitResult.hles.landedPath && { label: "Landed in Volume", value: commitResult.hles.landedPath },
                  ].filter(Boolean).map((s) => (
                    <div key={s.label} className="flex justify-between text-sm">
                      <span className="text-[var(--neutral-500)]">{s.label}</span>
                      <span className={`font-medium ${s.color || ""}`}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {commitResult.orgMapping && (
              <div className="border border-[var(--neutral-200)] rounded-lg p-5 mb-6">
                <p className="text-sm font-semibold text-[var(--hertz-black)] mb-1">Org Mapping Updated</p>
                <p className="text-xs text-[var(--neutral-500)]">
                  {commitResult.orgMapping.branchesFound} branch hierarchy records auto-derived from HLES data.
                </p>
              </div>
            )}

            {commitResult.hles?.errors?.length > 0 && (
              <div className="rounded-lg p-5 mb-6 bg-[#FFF3E0] alert-pulse">
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-semibold text-[#E65100]">Some records failed to save</p>
                  <button
                    onClick={() => {
                      const rows = [];
                      (commitResult.hles?.errors ?? []).forEach((e) =>
                        rows.push(["HLES", e.reservationId ?? "", e.error ?? ""]),
                      );
                      exportToCsv("failed-records.csv", ["Source", "ID", "Error"], rows);
                    }}
                    className="text-xs font-medium text-[#E65100] hover:underline cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export CSV
                  </button>
                </div>
                <p className="text-xs text-[#E65100] opacity-80 mb-3">
                  Most data was committed successfully, but the rows below had errors. Fix the source data in your CSV and re-upload, or update these leads manually.
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {(commitResult.hles?.errors ?? []).map((e, i) => (
                    <p key={`h-${i}`} className="text-xs text-[#E65100] font-mono">
                      HLES {e.reservationId}: {e.error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-3">
              <button
                onClick={handleReset}
                className="px-5 py-2.5 bg-[var(--hertz-primary)] text-[var(--hertz-black)] rounded-lg text-sm font-semibold hover:bg-[#E6BC00] transition-colors cursor-pointer"
              >
                Start New Upload
              </button>
              <button
                onClick={() => navigate("/admin")}
                className="px-5 py-2.5 border border-[var(--neutral-300)] text-[var(--hertz-black)] rounded-lg text-sm font-semibold hover:bg-[var(--neutral-50)] transition-colors cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload history: placed below the upload workflow */}
      <section className="mt-10">
        <h3 className="text-sm font-semibold text-[var(--hertz-black)] mb-3">Upload history</h3>
        {historyLoading ? (
          <p className="text-sm text-[var(--neutral-500)]">Loading history…</p>
        ) : uploadHistory.length === 0 ? (
          <p className="text-sm text-[var(--neutral-500)]">No uploads yet.</p>
        ) : (
          <div className="border border-[var(--neutral-200)] rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--neutral-100)] sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-[var(--neutral-600)]">Date</th>
                    <th className="text-left py-2 px-3 font-medium text-[var(--neutral-600)]">File</th>
                    <th className="text-left py-2 px-3 font-medium text-[var(--neutral-600)]">Uploaded by</th>
                    <th className="text-left py-2 px-3 font-medium text-[var(--neutral-600)]">Upload status</th>
                    <th className="text-left py-2 px-3 font-medium text-[var(--neutral-600)]">Data ingestion</th>
                    <th className="text-left py-2 px-3 font-medium text-[var(--neutral-600)] w-8" aria-label="Expand" />
                  </tr>
                </thead>
                <tbody>
                  {uploadHistory.map((row) => {
                    const isExpanded = historyExpandedId === row.id;
                    const dateStr =
                      row.createdAt != null
                        ? new Date(row.createdAt).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—";
                    const statusLabel =
                      row.status === "success"
                        ? "Success"
                        : row.status === "partial"
                          ? "Partial"
                          : "Failed";
                    const statusClass =
                      row.status === "success"
                        ? "bg-emerald-100 text-emerald-800"
                        : row.status === "partial"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800";
                    const ingestion = ingestionBadge(row.ingestionStatus);
                    const m = row.metadata ?? {};
                    return (
                      <React.Fragment key={row.id}>
                        <tr className="border-t border-[var(--neutral-200)] hover:bg-[var(--neutral-50)]">
                          <td className="py-2 px-3 text-[var(--neutral-700)]">{dateStr}</td>
                          <td className="py-2 px-3 text-[var(--hertz-black)]">{row.filename}</td>
                          <td className="py-2 px-3 text-[var(--neutral-700)]">{row.uploadedBy}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${ingestion.className}`}>
                              {row.ingestionStatus === "in_progress" && (
                                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                              )}
                              {ingestion.label}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <button
                              type="button"
                              onClick={() => setHistoryExpandedId(isExpanded ? null : row.id)}
                              className="text-[var(--neutral-500)] hover:text-[var(--hertz-black)] p-1 rounded"
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              )}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`detail-${row.id}`} className="border-t border-[var(--neutral-200)] bg-[var(--neutral-50)]">
                            <td colSpan={6} className="px-3 py-3 text-sm">
                              <p className="font-medium text-[var(--hertz-black)] mb-2">Metadata &amp; logs</p>
                              <ul className="space-y-1 text-[var(--neutral-700)]">
                                <li>Rows parsed: {Number(m.rowsParsed ?? 0).toLocaleString()}</li>
                                <li>New leads: {Number(m.newLeads ?? 0).toLocaleString()}</li>
                                <li>Updated: {Number(m.updated ?? 0).toLocaleString()}</li>
                                <li>Skipped / failed: {Number(m.failed ?? 0).toLocaleString()}</li>
                                {row.dataAsOfDate && <li>Data as of: {row.dataAsOfDate}</li>}
                                {row.landedPath && <li className="truncate" title={row.landedPath}>Landed: {row.landedPath}</li>}
                                {row.ingestionError && <li className="text-[#C62828]">Ingestion error: {row.ingestionError}</li>}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
