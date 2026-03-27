import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatTranslogTimestamp } from "../utils/dateTime";

// ─── Category configuration ─────────────────────────────────────────────────

const categoryConfig = {
  location:         { label: "Location",         color: "var(--hertz-primary)",   bg: "var(--hertz-primary)",     textClass: "bg-blue-50 text-blue-700 border-blue-200" },
  reservation:      { label: "Reservation",      color: "var(--color-warning)",   bg: "var(--color-warning)",     textClass: "bg-amber-50 text-amber-700 border-amber-200" },
  mmr:              { label: "MMR",              color: "var(--color-info, #6366f1)", bg: "var(--color-info, #6366f1)", textClass: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  rental_agreement: { label: "Rental Agreement", color: "var(--neutral-600)",     bg: "var(--neutral-600)",       textClass: "bg-gray-100 text-gray-600 border-gray-200" },
  extension:        { label: "Extension",        color: "var(--color-warning)",   bg: "var(--color-warning)",     textClass: "bg-amber-50 text-amber-700 border-amber-200" },
  edi:              { label: "EDI",              color: "var(--neutral-400)",     bg: "var(--neutral-400)",       textClass: "bg-gray-50 text-gray-500 border-gray-200" },
  employee:         { label: "Employee",         color: "var(--neutral-400)",     bg: "var(--neutral-400)",       textClass: "bg-gray-50 text-gray-500 border-gray-200" },
  system:           { label: "System",           color: "var(--neutral-400)",     bg: "var(--neutral-400)",       textClass: "bg-gray-50 text-gray-500 border-gray-200" },
  enrichment:       { label: "Enrichment",       color: "var(--color-success)",   bg: "var(--color-success)",     textClass: "bg-[var(--color-success-light)] text-[var(--color-success)] border-[var(--color-success)]/30" },
  contact:          { label: "Contact",          color: "var(--hertz-primary)",   bg: "var(--hertz-primary)",     textClass: "bg-blue-50 text-blue-700 border-blue-200" },
  other:            { label: "Other",            color: "var(--neutral-400)",     bg: "var(--neutral-400)",       textClass: "bg-gray-50 text-gray-500 border-gray-200" },
};

const sourceConfig = {
  translog:   { label: "TRANSLOG",   className: "bg-[var(--neutral-100)] text-[var(--neutral-600)] border-[var(--neutral-200)]" },
  enrichment: { label: "Enrichment", className: "bg-[var(--color-success-light)] text-[var(--color-success)] border-[var(--color-success)]/30" },
  contact:    { label: "Contact",    className: "bg-blue-50 text-blue-700 border-blue-200" },
};

// BM/GM see these filters; admin sees all
const BM_FILTERS = ["all", "location", "reservation", "mmr", "rental_agreement", "extension", "enrichment", "contact"];
const ADMIN_FILTERS = ["all", "location", "reservation", "mmr", "rental_agreement", "extension", "edi", "employee", "system", "enrichment", "contact", "other"];

// ─── MSG1 humanization ──────────────────────────────────────────────────────

const MSG1_LABELS = {
  "Loc-Customer Contact":           "Customer contacted",
  "Loc-Initial Customer Contact":   "First customer contact",
  "Rez-Reservation Opened Into RA": "Reservation converted to rental",
  "Rez-Cancelled":                  "Reservation cancelled",
  "Rez-Changed Return Date":        "Return date changed",
  "Rez-Changed Rent Date":          "Pickup date changed",
  "Rez-Add/Update Repair Shop":     "Repair shop updated",
  "Rez-Add/Update Employer":        "Employer updated",
  "Rez-Add/Update Renter`s Insurance": "Insurance updated",
  "Rez-CDP Messaging":              "MMR message sent",
  "R/A-Rent Opened":                "Rental opened",
  "R/A-Post Returned":              "Vehicle post-returned",
  "R/A-Returned":                   "Vehicle returned",
  "R/A-Upsell Made":                "Upsell completed",
  "R/A-Credit Auth Failed":         "Credit authorization failed",
  "R/A-Unit Assigned at Open":      "Vehicle assigned",
  "R/A-Changed Return Date":        "Return date changed",
  "R/A-Rate Update":                "Rate updated",
  "Request Extensions-Edit Request":"Extension request submitted",
};

function humanizeMsg1(msg1) {
  if (!msg1) return "Unknown event";
  if (MSG1_LABELS[msg1]) return MSG1_LABELS[msg1];
  // Fallback: strip prefix and clean up
  return msg1.replace(/^(Loc-|Rez-|R\/A-|RA-|Edi-|Emp-|Sys-)/, "").trim() || msg1;
}

// ─── Location formatting ────────────────────────────────────────────────────

function formatLocation(locCode, rentLoc) {
  if (!locCode) return null;
  if (rentLoc) {
    // rentLoc is like "4940-07 - COVINGTON HLE"
    const match = rentLoc.match(/-\s+(.+)/);
    if (match) {
      const name = match[1].replace(/\s+HLE$/i, "").trim();
      // Title-case: "COVINGTON" → "Covington"
      return name.charAt(0) + name.slice(1).toLowerCase();
    }
  }
  return `Branch ${locCode}`;
}

// ─── Compact summary (replaces msg10 preview) ──────────────────────────────

function getCompactSummary(ev) {
  const msg1 = ev.msg1 || ev._event || "";
  // Contact events — show outcome from msg3
  if (msg1.startsWith("Loc-") && ev.msg3) return ev.msg3;
  // Extension requests — show reason from msg2
  if (msg1.startsWith("Request Extensions") && ev.msg2) return ev.msg2;
  // Credit auth failures — show msg2 (card/reason)
  if (msg1.includes("Credit Auth Failed") && ev.msg2) return ev.msg2;
  // Date changes — show msg2 (new date info)
  if (msg1.includes("Changed Return Date") && ev.msg2) return ev.msg2;
  if (msg1.includes("Changed Rent Date") && ev.msg2) return ev.msg2;
  // Rate update — show rate/vehicle class from msg2
  if (msg1.includes("Rate Update") && ev.msg2) return ev.msg2;
  // Upsell — show class info from msg2
  if (msg1.includes("Upsell Made") && ev.msg2) return ev.msg2;
  // Cancellation — show reason from msg2
  if (msg1.includes("Cancelled") && ev.msg2) return ev.msg2;
  return null;
}

// ─── Event deduplication ────────────────────────────────────────────────────

function deduplicateEvents(sorted) {
  const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  const result = [];
  for (const ev of sorted) {
    if (ev._source !== "translog" || !ev.msg1) {
      result.push({ ...ev });
      continue;
    }
    // Look back through recent results for a matching msg1 within the time window
    let merged = false;
    for (let j = result.length - 1; j >= 0; j--) {
      const prev = result[j];
      if (prev._source !== "translog") continue;
      if (Math.abs(prev._sortTs - ev._sortTs) >= WINDOW_MS) break; // outside window
      if (prev.msg1 === ev.msg1) {
        prev._dupeCount = (prev._dupeCount || 1) + 1;
        merged = true;
        break;
      }
    }
    if (!merged) result.push({ ...ev });
  }
  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Derive category from msg1 prefix and msg10 content (client-side fallback if API doesn't provide it). */
function deriveCategory(msg1, msg10) {
  if (!msg1) return "other";
  if (msg10 && msg10.toUpperCase().includes("MMR")) return "mmr";
  if (msg1.startsWith("Loc-")) return "location";
  if (msg1.startsWith("Rez-")) return "reservation";
  if (msg1.startsWith("R/A-") || msg1.startsWith("RA-")) return "rental_agreement";
  if (msg1.startsWith("Edi-")) return "edi";
  if (msg1.startsWith("Emp-")) return "employee";
  if (msg1.startsWith("Sys-")) return "system";
  if (msg1.startsWith("Request Extensions")) return "extension";
  return "other";
}

/** Parse translog time to timestamp for sorting. */
function parseTimeToTs(timeStr) {
  if (!timeStr) return 0;
  try {
    const raw = String(timeStr).replace(/\D/g, "");
    if (raw.length >= 14) {
      const y = parseInt(raw.slice(0, 4), 10);
      const m = parseInt(raw.slice(4, 6), 10) - 1;
      const d = parseInt(raw.slice(6, 8), 10);
      const h = parseInt(raw.slice(8, 10), 10);
      const min = parseInt(raw.slice(10, 12), 10);
      const sec = parseInt(raw.slice(12, 14), 10);
      const date = new Date(y, m, d, h, min, sec);
      return isNaN(date.getTime()) ? 0 : date.getTime();
    }
    const year = new Date().getFullYear();
    const d = new Date(`${timeStr}, ${year}`);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  } catch {
    return 0;
  }
}

function formatValue(v) {
  return v && String(v).trim() ? v : "—";
}

function formatTimestamp(timeStr, isNewFormat) {
  if (!timeStr) return "—";
  if (isNewFormat) {
    const d = new Date(timeStr);
    return isNaN(d.getTime()) ? String(timeStr) : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  if (String(timeStr).match(/^\d{14}$/)) return formatTranslogTimestamp(timeStr);
  return timeStr;
}

// ─── Badge components ────────────────────────────────────────────────────────

function CategoryBadge({ category }) {
  const cfg = categoryConfig[category] || categoryConfig.other;
  return (
    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border ${cfg.textClass}`}>
      {cfg.label}
    </span>
  );
}

function SourceBadge({ source, contactType }) {
  const cfg = sourceConfig[source] || sourceConfig.translog;
  const label = source === "contact" && contactType
    ? contactType.charAt(0).toUpperCase() + contactType.slice(1)
    : cfg.label;
  return (
    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border ${cfg.className}`}>
      {label}
    </span>
  );
}

// ─── Filter pills ────────────────────────────────────────────────────────────

function FilterPills({ filters, activeFilter, onFilterChange, counts }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {filters.map((f) => {
        const isActive = activeFilter === f;
        const label = f === "all" ? "All" : (categoryConfig[f]?.label ?? f);
        const count = f === "all" ? null : counts[f] ?? 0;
        return (
          <button
            key={f}
            type="button"
            onClick={() => onFilterChange(f)}
            className={`text-[10px] font-medium px-2 py-1 rounded-full border transition-colors ${
              isActive
                ? "bg-[var(--hertz-black)] text-[var(--hertz-white)] border-[var(--hertz-black)]"
                : "bg-[var(--hertz-white)] text-[var(--neutral-600)] border-[var(--neutral-200)] hover:bg-[var(--neutral-50)]"
            }`}
          >
            {label}{count != null && count > 0 ? ` (${count})` : ""}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function TranslogTimeline({ events = [], enrichmentLog = [], contactActivities = [], animate = true, showHeader = true, userRole = "bm", rentLoc = null }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");

  // Merge and normalize all activity sources
  const merged = useMemo(() => {
    const translogItems = (events ?? []).map((ev) => {
      const isNewFormat = ev.systemDate !== undefined || ev.msg1 !== undefined;
      const time = isNewFormat ? ev.systemDate : (ev.time ?? ev.date);
      const event = isNewFormat ? (ev.msg1 ?? "—") : (ev.event ?? ev.type ?? ev.detail ?? "—");
      const outcome = isNewFormat ? (ev.msg2 ?? null) : (ev.outcome ?? (ev.detail && ev.detail !== event ? ev.detail : null));
      const sortTs = isNewFormat && ev.systemDate
        ? new Date(ev.systemDate).getTime() || 0
        : parseTimeToTs(time);
      const category = ev.category || deriveCategory(ev.msg1, ev.msg10);
      return { ...ev, _time: time, _event: event, _outcome: outcome, _sortTs: sortTs, _source: "translog", _isNewFormat: isNewFormat, _category: category };
    });
    const enrichmentItems = (enrichmentLog ?? []).map((ev) => ({
      ...ev, _sortTs: ev.timestamp ?? parseTimeToTs(ev.time) ?? 0, _source: "enrichment", _category: "enrichment",
    }));
    const contactItems = (contactActivities ?? []).map((ev) => ({
      ...ev, _sortTs: ev.timestamp ?? 0, _source: "contact", _category: "contact",
    }));
    const sorted = [...translogItems, ...enrichmentItems, ...contactItems].sort((a, b) => b._sortTs - a._sortTs);
    return deduplicateEvents(sorted);
  }, [events, enrichmentLog, contactActivities]);

  // Count per category for filter pills
  const counts = useMemo(() => {
    const c = {};
    for (const ev of merged) { c[ev._category] = (c[ev._category] ?? 0) + 1; }
    return c;
  }, [merged]);

  // Apply filter
  const filtered = activeFilter === "all" ? merged : merged.filter((ev) => ev._category === activeFilter);
  const filterList = userRole === "admin" ? ADMIN_FILTERS : BM_FILTERS;

  return (
    <div className="space-y-2">
      {showHeader && (
        <h3 className="text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wide mb-2">
          Activity Timeline
        </h3>
      )}

      {/* Filter pills */}
      {merged.length > 0 && (
        <FilterPills filters={filterList} activeFilter={activeFilter} onFilterChange={setActiveFilter} counts={counts} />
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--neutral-600)] italic">
          {merged.length === 0 ? "No activity recorded" : "No activities match this filter"}
        </p>
      ) : (
        <div className="space-y-1">
          {filtered.map((ev, i) => {
            const key = ev._source === "contact"
              ? `contact-${i}-${ev.id ?? ev.timestamp}`
              : ev._source === "enrichment"
                ? `enrich-${i}-${ev.timestamp}`
                : `trans-${i}-${ev.id ?? ev._time ?? i}`;
            const catCfg = categoryConfig[ev._category] || categoryConfig.other;
            return (
              <ActivityCard
                key={key}
                ev={ev}
                itemKey={key}
                catCfg={catCfg}
                expandedKey={expandedKey}
                setExpandedKey={setExpandedKey}
                animate={animate}
                index={i}
                isLast={i === filtered.length - 1}
                rentLoc={rentLoc}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Activity card ───────────────────────────────────────────────────────────

function ActivityCard({ ev, itemKey, catCfg, expandedKey, setExpandedKey, animate, index, isLast, rentLoc }) {
  const isExpanded = expandedKey === itemKey;

  if (ev._source === "contact") return <ContactCard ev={ev} itemKey={itemKey} isExpanded={isExpanded} setExpandedKey={setExpandedKey} animate={animate} index={index} isLast={isLast} catCfg={catCfg} />;
  if (ev._source === "enrichment") return <EnrichmentCard ev={ev} itemKey={itemKey} isExpanded={isExpanded} setExpandedKey={setExpandedKey} animate={animate} index={index} isLast={isLast} catCfg={catCfg} />;
  return <TranslogCard ev={ev} itemKey={itemKey} isExpanded={isExpanded} setExpandedKey={setExpandedKey} animate={animate} index={index} isLast={isLast} catCfg={catCfg} rentLoc={rentLoc} />;
}

// ─── Translog card (enhanced) ────────────────────────────────────────────────

function TranslogCard({ ev, itemKey, isExpanded, setExpandedKey, animate, index, isLast, catCfg, rentLoc }) {
  const header = humanizeMsg1(ev._event);
  const empName = ev.empName;
  const timestamp = formatTimestamp(ev._time, ev._isNewFormat);
  const location = formatLocation(ev.locCode, rentLoc);
  const summary = getCompactSummary(ev);
  const hasExpandableDetails = ev.msg10 || ev.msg3 || ev.msg4;

  return (
    <motion.div
      key={itemKey}
      initial={animate ? { opacity: 0, x: -10 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex gap-3 items-start"
    >
      <div className="flex flex-col items-center">
        <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: catCfg.color }} />
        {!isLast && <div className="w-px h-6 bg-[var(--neutral-200)]" />}
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <button
          type="button"
          onClick={() => hasExpandableDetails && setExpandedKey(isExpanded ? null : itemKey)}
          className={`text-left w-full ${hasExpandableDetails ? "cursor-pointer hover:opacity-90" : "cursor-default"}`}
        >
          <p className="text-sm font-medium text-[var(--hertz-black)] leading-snug">
            {header}
            {ev._dupeCount > 1 && (
              <span className="text-[10px] font-normal bg-[var(--neutral-100)] text-[var(--neutral-500)] px-1.5 py-0.5 rounded ml-2 border border-[var(--neutral-200)]">
                x{ev._dupeCount}
              </span>
            )}
          </p>
          <p className="text-xs text-[var(--neutral-600)] mt-0.5">
            {empName && <>By {empName} · </>}{timestamp}
            {ev._isNewFormat && location && <> · {location}</>}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <CategoryBadge category={ev._category} />
          </div>
          {summary && (
            <p className="text-xs text-[var(--neutral-600)] mt-1.5 leading-relaxed line-clamp-1">{summary}</p>
          )}
          {hasExpandableDetails && (
            <span className="inline-block mt-1 text-[9px] text-[var(--neutral-600)] px-1.5 py-0.5 rounded bg-[var(--neutral-100)] border border-[var(--neutral-200)]">
              {isExpanded ? "▼" : "▶"} Click to {isExpanded ? "collapse" : "view details"}
            </span>
          )}
        </button>
        <AnimatePresence>
          {hasExpandableDetails && isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 pl-3 border-l-2 border-[var(--neutral-200)] space-y-2 overflow-hidden"
            >
              <div className="text-xs space-y-2">
                {ev.msg10 && (
                  <div>
                    <p className="font-medium text-[var(--neutral-600)] uppercase mb-0.5">Details</p>
                    <p className="text-[var(--hertz-black)] whitespace-pre-wrap leading-relaxed">{ev.msg10}</p>
                  </div>
                )}
                {ev.msg3 && (
                  <div>
                    <p className="font-medium text-[var(--neutral-600)] uppercase mb-0.5">Outcome</p>
                    <p className="text-[var(--hertz-black)]">{ev.msg3}</p>
                  </div>
                )}
                {ev.msg4 && (
                  <div>
                    <p className="font-medium text-[var(--neutral-600)] uppercase mb-0.5">Follow-up</p>
                    <p className="text-[var(--hertz-black)]">{ev.msg4}</p>
                  </div>
                )}
                {/* Raw event code + location for traceability */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[var(--neutral-500)] pt-1 border-t border-[var(--neutral-100)]">
                  {ev._event && <span>Event: {ev._event}</span>}
                  {ev.locCode && <span>Loc: {ev.locCode}</span>}
                  {ev.empCode && <span>Emp: {ev.empCode}</span>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Enrichment card (preserved + badges) ────────────────────────────────────

function EnrichmentCard({ ev, itemKey, isExpanded, setExpandedKey, animate, index, isLast, catCfg }) {
  const hasEnrichmentDetails = ev.previous && ev.updated;

  return (
    <motion.div
      key={itemKey}
      initial={animate ? { opacity: 0, x: -10 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex gap-3 items-start"
    >
      <div className="flex flex-col items-center">
        <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: catCfg.color }} />
        {!isLast && <div className="w-px h-6 bg-[var(--neutral-200)]" />}
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <button
          type="button"
          onClick={() => hasEnrichmentDetails && setExpandedKey(isExpanded ? null : itemKey)}
          className={`text-left w-full ${hasEnrichmentDetails ? "cursor-pointer hover:opacity-90" : "cursor-default"}`}
        >
          <p className="text-sm font-medium text-[var(--hertz-black)]">{ev.action}</p>
          <p className="text-xs text-[var(--neutral-600)] mt-0.5">By {ev.author} · {ev.time}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <CategoryBadge category="enrichment" />
          </div>
          {ev.notes && (
            <p className="text-xs text-[var(--neutral-600)] mt-1.5 italic line-clamp-2">{ev.notes}</p>
          )}
          {hasEnrichmentDetails && (
            <span className="inline-block mt-1 text-[9px] text-[var(--neutral-600)] px-1.5 py-0.5 rounded bg-[var(--neutral-100)] border border-[var(--neutral-200)]">
              {isExpanded ? "▼" : "▶"} Click to {isExpanded ? "collapse" : "view changes"}
            </span>
          )}
        </button>
        <AnimatePresence>
          {hasEnrichmentDetails && isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 pl-3 border-l-2 border-[var(--neutral-200)] space-y-2 overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div>
                  <p className="font-medium text-[var(--neutral-600)] uppercase">Previous</p>
                  <p className="text-[var(--hertz-black)]">Email: {formatValue(ev.previous?.email)}</p>
                  <p className="text-[var(--hertz-black)]">Phone: {formatValue(ev.previous?.phone)}</p>
                </div>
                <div>
                  <p className="font-medium text-[var(--neutral-600)] uppercase">Updated</p>
                  <p className="text-[var(--hertz-black)]">Email: {formatValue(ev.updated?.email)}</p>
                  <p className="text-[var(--hertz-black)]">Phone: {formatValue(ev.updated?.phone)}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Contact card (preserved + badges) ───────────────────────────────────────

function ContactCard({ ev, itemKey, isExpanded, setExpandedKey, animate, index, isLast, catCfg }) {
  const hasEmailDetails = ev.type === "email" && ev.metadata?.subject;

  return (
    <motion.div
      key={itemKey}
      initial={animate ? { opacity: 0, x: -10 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex gap-3 items-start"
    >
      <div className="flex flex-col items-center">
        <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: catCfg.color }} />
        {!isLast && <div className="w-px h-6 bg-[var(--neutral-200)]" />}
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <button
          type="button"
          onClick={() => hasEmailDetails && setExpandedKey(isExpanded ? null : itemKey)}
          className={`text-left w-full ${hasEmailDetails ? "cursor-pointer hover:opacity-90" : "cursor-default"}`}
        >
          <p className="text-sm font-medium text-[var(--hertz-black)]">{ev.action}</p>
          <p className="text-xs text-[var(--neutral-600)] mt-0.5">By {ev.author} · {ev.time}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <CategoryBadge category="contact" />
            <SourceBadge source="contact" contactType={ev.type} />
          </div>
          {hasEmailDetails && (
            <span className="inline-block mt-1 text-[9px] text-[var(--neutral-600)] px-1.5 py-0.5 rounded bg-[var(--neutral-100)] border border-[var(--neutral-200)]">
              {isExpanded ? "▼" : "▶"} Click to {isExpanded ? "collapse" : "view email"}
            </span>
          )}
        </button>
        <AnimatePresence>
          {hasEmailDetails && isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 pl-3 border-l-2 border-[var(--color-warning)]/40 space-y-2 overflow-hidden"
            >
              <div className="text-xs">
                <p className="font-medium text-[var(--neutral-600)] uppercase mb-0.5">Subject</p>
                <p className="text-[var(--hertz-black)] mb-2">{ev.metadata.subject}</p>
                {ev.metadata.to && (
                  <>
                    <p className="font-medium text-[var(--neutral-600)] uppercase mb-0.5">To</p>
                    <p className="text-[var(--hertz-black)] mb-2">{ev.metadata.to}</p>
                  </>
                )}
                <p className="font-medium text-[var(--neutral-600)] uppercase mb-0.5">Body</p>
                <p className="text-[var(--hertz-black)] whitespace-pre-wrap">{ev.metadata.body || "—"}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
