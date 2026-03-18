/**
 * databricksData.js
 *
 * Drop-in replacement for supabaseData.js that talks to the FastAPI backend
 * running against the Databricks / Lakebase Postgres database.
 *
 * Every exported function name matches the imports in DataContext.jsx so the
 * swap is a single import-path change.
 *
 * The FastAPI backend returns snake_case JSON; this module transforms every
 * response into the camelCase shape the React components expect.
 */

const API_BASE = "/api";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${options.method ?? "GET"} ${url} → ${res.status}: ${text}`);
  }
  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

function apiGet(path) {
  return apiFetch(path);
}

function apiPut(path, body) {
  return apiFetch(path, { method: "PUT", body: JSON.stringify(body) });
}

function apiPost(path, body) {
  return apiFetch(path, { method: "POST", body: JSON.stringify(body) });
}

// ─────────────────────────────────────────────────────────────────────────────
// Row transformers  (snake_case → camelCase)
// ─────────────────────────────────────────────────────────────────────────────

function leadFromRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    customer: r.customer,
    reservationId: r.confirm_num ?? r.reservation_id,
    confirmNum: r.confirm_num ?? r.reservation_id,
    knum: r.knum ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
    sourceEmail: r.source_email ?? null,
    sourcePhone: r.source_phone ?? null,
    sourceStatus: r.source_status ?? null,
    status: r.status,
    archived: r.archived ?? false,
    enrichmentComplete: r.enrichment_complete ?? false,
    branch: r.branch,
    bmName: r.bm_name,
    daysOpen: r.days_open ?? 0,
    mismatch: r.mismatch ?? false,
    mismatchReason: r.mismatch_reason ?? null,
    gmDirective: r.gm_directive,
    insuranceCompany: r.insurance_company,
    bodyShop: r.body_shop,
    timeToFirstContact: r.time_to_first_contact,
    firstContactBy: r.first_contact_by,
    timeToCancel: r.time_to_cancel,
    hlesReason: r.hles_reason,
    translog: r.translog ?? [],
    lastActivity: r.last_activity,
    enrichment: r.enrichment,
    enrichmentLog: r.enrichment_log ?? [],
    initDtFinal: r.init_dt_final ?? null,
    weekOf: r.week_of ?? null,
    contactRange: r.contact_range ?? null,
    lastUploadId: r.last_upload_id ?? null,
    cdpName: r.cdp_name ?? null,
    htzRegion: r.htz_region ?? null,
    setState: r.set_state ?? null,
    zone: r.zone ?? null,
    areaMgr: r.area_mgr ?? null,
    generalMgr: r.general_mgr ?? null,
    rentLoc: r.rent_loc ?? null,
  };
}

function taskFromRow(r) {
  if (!r) return null;
  // The GM endpoint joins leads and returns lead_branch/customer/reservation_id
  const lead = r.lead_branch ? {
    id: r.lead_id,
    customer: r.customer,
    reservationId: r.reservation_id,
    branch: r.lead_branch,
  } : null;
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? null,
    notes: r.notes ?? null,
    notesLog: r.notes_log ?? [],
    dueDate: r.due_date ? r.due_date.slice(0, 10) : null,
    dueDateRaw: r.due_date,
    status: r.status,
    priority: r.priority ?? "Normal",
    assignedTo: r.assigned_to,
    assignedToName: r.assigned_to_name ?? "—",
    assignedBranch: lead?.branch ?? r.assigned_branch ?? null,
    createdBy: r.created_by_name ?? "—",
    leadId: r.lead_id,
    lead: lead,
    source: r.source ?? "gm_assigned",
    translogEventId: r.translog_event_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at ?? null,
  };
}

function activityFromRow(r) {
  if (!r) return null;
  const typeToAction = {
    email: "Email sent",
    sms: "SMS sent",
    call: "Call initiated",
  };
  const dt = r.created_at ? new Date(r.created_at) : new Date();
  return {
    id: r.id,
    type: r.type,
    author: r.performed_by_name || "Unknown",
    metadata: r.metadata ?? {},
    createdAt: r.created_at,
    time: dt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
    timestamp: dt.getTime(),
    action: typeToAction[r.type] ?? "Contact",
    source: "contact",
  };
}

function orgMappingFromRow(r) {
  if (!r) return null;
  return {
    bm: r.bm,
    branch: r.branch,
    am: r.am,
    gm: r.gm,
    zone: r.zone,
    gmUserId: r.gm_user_id,
    bmUserId: r.bm_user_id,
  };
}

function branchManagerFromRow(r) {
  if (!r) return null;
  return {
    name: r.name,
    conversionRate: r.conversion_rate,
    quartile: r.quartile,
  };
}

function weeklyTrendBmFromRow(r) {
  return {
    weekLabel: r.week_label,
    totalLeads: r.total_leads,
    conversionRate: r.conversion_rate,
    commentRate: r.comment_rate,
  };
}

function weeklyTrendGmFromRow(r) {
  return {
    weekLabel: r.week_label,
    cancelledUnreviewed: r.cancelled_unreviewed,
    commentCompliance: r.comment_compliance,
    zoneConversionRate: r.zone_conversion_rate,
    timeToContact: r.time_to_contact,
    branchContactRate: r.branch_contact_rate,
    hrdContactRate: r.hrd_contact_rate,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported data-fetching functions
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch the latest pre-computed dashboard snapshot (trailing 4 weeks). */
export async function fetchDashboardSnapshot() {
  const data = await apiGet("/dashboard-snapshot");
  return data ?? null;
}

/** Fetch leads, optionally filtered by branches. */
export async function fetchLeads(branches = null) {
  const path = branches?.length
    ? `/leads?branches=${branches.map(encodeURIComponent).join(",")}`
    : "/leads";
  const rows = await apiGet(path);
  return (rows ?? []).map(leadFromRow);
}

/** Fetch the upload / data-freshness summary. */
export async function fetchUploadSummary() {
  const data = await apiGet("/config/upload-summary");
  if (!data) return null;
  return {
    hles: data.hles,
    translog: data.translog,
    dataAsOfDate: data.created_at ?? data.data_as_of_date,
  };
}

/**
 * Fetch full upload history for the upload page (past files, date, who, status, metadata).
 * Returns list of { id, createdAt, filename, uploadedBy, status, metadata, logs }.
 */
export async function fetchUploadHistory() {
  const rows = await apiGet("/upload/history");
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const hles = r.hles ?? {};
    const failed = Number(hles.failed ?? 0);
    const rowsParsedNum = Number(hles.rows_parsed ?? hles.rowsParsed) || 0;
    const status =
      failed > 0 && failed === rowsParsedNum
        ? "failed"
        : failed > 0
          ? "partial"
          : "success";
    return {
      id: r.id,
      createdAt: r.created_at,
      filename: hles.filename ?? hles.landedPath ?? "—",
      uploadedBy: hles.uploaded_by ?? hles.uploadedBy ?? "—",
      status,
      metadata: {
        rowsParsed: hles.rows_parsed ?? hles.rowsParsed ?? 0,
        newLeads: hles.new_leads ?? hles.newLeads ?? 0,
        updated: hles.updated ?? 0,
        failed: hles.failed ?? 0,
      },
      dataAsOfDate: r.data_as_of_date ?? null,
      landedPath: hles.landed_path ?? hles.landedPath ?? null,
    };
  });
}

/**
 * Upload HLES Excel file via backend. File is landed in the UC Volume
 * (datalabs.lab_lms_prod.hles_landing_prod) then ETL runs into Lakebase Postgres.
 * Returns { rowsParsed, newLeads, updated, failed, landedPath? }.
 */
/**
 * @param {File} file - HLES file to upload
 * @param {{ uploadedBy?: string }} [options] - Optional uploaded_by for history
 */
export async function uploadHlesFile(file, options = {}) {
  const formData = new FormData();
  formData.append("file", file);
  if (options.uploadedBy) formData.append("uploaded_by", options.uploadedBy);
  const url = `${API_BASE}/upload/hles`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    // Do not set Content-Type; browser sets multipart/form-data with boundary
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Fetch ALL config tables in a single request (1 connection, 8 queries).
 * Returns { orgMapping, branchManagers, weeklyTrends, uploadSummary,
 *           leaderboard, cancelReasons, nextActions, winsLearnings }.
 */
export async function fetchAllConfig() {
  const data = await apiGet("/config/all");
  if (!data) return null;

  const rawTrends = data.weeklyTrends;
  let weeklyTrends;
  if (Array.isArray(rawTrends)) {
    const bm = rawTrends.filter((r) => r.total_leads !== undefined).map(weeklyTrendBmFromRow);
    const gm = rawTrends.filter((r) => r.cancelled_unreviewed !== undefined).map(weeklyTrendGmFromRow);
    weeklyTrends = { bm, gm };
  } else {
    weeklyTrends = {
      bm: (rawTrends?.bm ?? []).map(weeklyTrendBmFromRow),
      gm: (rawTrends?.gm ?? []).map(weeklyTrendGmFromRow),
    };
  }

  const rawNextActions = data.nextActions ?? [];
  const nextActions = rawNextActions.length === 0
    ? []
    : typeof rawNextActions[0] === "string"
      ? rawNextActions
      : rawNextActions.map((r) => r.action ?? r.name ?? r.label ?? "");

  return {
    orgMapping: (data.orgMapping ?? []).map(orgMappingFromRow),
    branchManagers: (data.branchManagers ?? []).map(branchManagerFromRow),
    weeklyTrends,
    uploadSummary: data.uploadSummary ?? {},
    leaderboard: data.leaderboard ?? {},
    cancelReasons: (data.cancelReasons ?? []).map((r) => ({ category: r.category, reasons: r.reasons })),
    nextActions,
    winsLearnings: (data.winsLearnings ?? []).map(winsLearningFromRow),
  };
}

/** Fetch the org-mapping (branch → BM/AM/GM/zone). */
export async function fetchOrgMapping() {
  const rows = await apiGet("/config/org-mapping");
  return (rows ?? []).map(orgMappingFromRow);
}

/** Fetch branch-manager performance rows. */
export async function fetchBranchManagers() {
  const rows = await apiGet("/config/branch-managers");
  return (rows ?? []).map(branchManagerFromRow);
}

/** Fetch weekly trend data; return { bm: [...], gm: [...] }. */
export async function fetchWeeklyTrends() {
  const data = await apiGet("/config/weekly-trends");
  if (!data) return { bm: [], gm: [] };

  // The backend may return { bm: [...], gm: [...] } already split, or it may
  // return a flat array. Handle both shapes.
  if (Array.isArray(data)) {
    // Heuristic: if the first row has `total_leads` it's a BM row.
    const bm = data.filter((r) => r.total_leads !== undefined).map(weeklyTrendBmFromRow);
    const gm = data.filter((r) => r.cancelled_unreviewed !== undefined).map(weeklyTrendGmFromRow);
    return { bm, gm };
  }

  return {
    bm: (data.bm ?? []).map(weeklyTrendBmFromRow),
    gm: (data.gm ?? []).map(weeklyTrendGmFromRow),
  };
}

/** Fetch leaderboard rows. */
export async function fetchLeaderboardData() {
  const rows = await apiGet("/config/leaderboard");
  return rows ?? [];
}

/** Fetch cancellation-reason categories → [{ category, reasons }]. */
export async function fetchCancellationReasonCategories() {
  const rows = await apiGet("/config/cancel-reasons");
  return (rows ?? []).map((r) => ({ category: r.category, reasons: r.reasons }));
}

/** Fetch the list of next-action strings. */
export async function fetchNextActions() {
  const rows = await apiGet("/config/next-actions");
  // May arrive as [{ action: "..." }, ...] or ["...", ...].
  if (!rows || rows.length === 0) return [];
  if (typeof rows[0] === "string") return rows;
  return rows.map((r) => r.action ?? r.name ?? r.label ?? "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Lead mutation functions
// ─────────────────────────────────────────────────────────────────────────────

/** Update the enrichment fields on a lead. Matches supabaseData signature. */
export async function updateLeadEnrichment(leadId, enrichment, enrichmentLogEntry = null, status = null) {
  const row = await apiPut(`/leads/${leadId}/enrichment`, {
    enrichment,
    enrichment_log_entry: enrichmentLogEntry,
    enrichment_complete: !!enrichment && Object.keys(enrichment).length > 0,
    status,
  });
  return leadFromRow(row);
}

/** Update the contact fields on a lead. Matches supabaseData signature. */
export async function updateLeadContact(leadId, { email, phone }, enrichmentLogEntry = null) {
  const row = await apiPut(`/leads/${leadId}/contact`, {
    email,
    phone,
    enrichment_log_entry: enrichmentLogEntry,
  });
  return leadFromRow(row);
}

/** Update the directive on a lead. */
export async function updateLeadDirective(leadId, gmDirective) {
  const row = await apiPut(`/leads/${leadId}/directive`, { gm_directive: gmDirective });
  return leadFromRow(row);
}

/** Mark a lead as reviewed (status="Reviewed", archived=true). */
export async function markLeadReviewed(leadId) {
  const row = await apiPut(`/leads/${leadId}/review`, {});
  return leadFromRow(row);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lead activities
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch the activity log for a specific lead. */
export async function fetchLeadActivities(leadId) {
  const rows = await apiGet(`/leads/${leadId}/activities`);
  return (rows ?? []).map(activityFromRow);
}

// ─────────────────────────────────────────────────────────────────────────────
// Task functions
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch tasks for a specific branch. */
export async function fetchTasksForBranch(branch) {
  const rows = await apiGet(`/tasks?branch=${encodeURIComponent(branch)}`);
  return (rows ?? []).map(taskFromRow);
}

/** Fetch tasks linked to a specific lead. */
export async function fetchTasksForLead(leadId) {
  const rows = await apiGet(`/tasks?lead_id=${encodeURIComponent(leadId)}`);
  return (rows ?? []).map(taskFromRow);
}

/** Fetch a single task by ID. */
export async function fetchTaskById(taskId) {
  const row = await apiGet(`/tasks/${taskId}`);
  return taskFromRow(row);
}

/** Update the status of a task. */
export async function updateTaskStatus(taskId, status) {
  const row = await apiPut(`/tasks/${taskId}/status`, { status });
  return taskFromRow(row);
}

/** Append a note to a task's notes log. */
export async function appendTaskNote(taskId, noteText, author) {
  const row = await apiPost(`/tasks/${taskId}/notes`, { note: noteText, author });
  return taskFromRow(row);
}

/**
 * Fetch all tasks for a GM's branches.
 * @param {string[]} gmBranches - array of branch names the GM oversees
 */
export async function fetchTasksForGM(gmBranches) {
  if (!gmBranches || gmBranches.length === 0) return [];
  const rows = await apiGet(`/tasks/gm?branches=${gmBranches.map(encodeURIComponent).join(",")}`);
  return (rows ?? []).map(taskFromRow);
}

/** Create a new task. */
export async function insertTask({
  title, description = null, dueDate, leadId, assignedTo = null,
  assignedToName, assignedBranch = null, createdBy = null,
  createdByName, source = "gm_assigned", priority = "Normal",
}) {
  const dueDateStr = dueDate instanceof Date ? dueDate.toISOString().slice(0, 10) : dueDate;
  const row = await apiPost("/tasks", {
    title,
    description,
    due_date: dueDateStr,
    lead_id: leadId ?? null,
    assigned_to: assignedTo,
    assigned_to_name: assignedToName,
    assigned_branch: assignedBranch,
    created_by: createdBy,
    created_by_name: createdByName,
    source,
    priority,
  });
  return taskFromRow(row);
}

/** Create compliance tasks for outstanding leads in a branch. */
export async function createComplianceTasksForBranch(params) {
  return apiPost("/tasks/compliance", {
    branch: params.branch,
    bm_name: params.bmName,
    due_date: params.dueDateStr,
    gm_name: params.gmName,
    gm_user_id: params.gmUserId,
    outstandingLeads: params.outstandingLeads,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GM Directives
// ─────────────────────────────────────────────────────────────────────────────

function directiveFromRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    leadId: r.lead_id,
    directiveText: r.directive_text,
    priority: r.priority,
    dueDate: r.due_date ? String(r.due_date).slice(0, 10) : null,
    createdBy: r.created_by,
    createdByName: r.created_by_name ?? "GM",
    createdAt: r.created_at,
  };
}

/** Fetch GM directives for a lead. */
export async function fetchGmDirectives(leadId) {
  const rows = await apiGet(`/leads/${leadId}/directives`);
  return (rows ?? []).map(directiveFromRow);
}

/** Insert a new GM directive. */
export async function insertGmDirective(params) {
  const row = await apiPost(`/leads/${params.leadId}/directives`, {
    directive_text: params.directiveText,
    priority: params.priority ?? "normal",
    due_date: params.dueDate,
    created_by: params.createdBy,
    created_by_name: params.createdByName,
  });
  return directiveFromRow(row);
}

// ─────────────────────────────────────────────────────────────────────────────
// Wins & Learnings
// ─────────────────────────────────────────────────────────────────────────────

function winsLearningFromRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    bmName: r.bm_name,
    branch: r.branch,
    gmName: r.gm_name,
    content: r.content,
    weekOf: r.week_of ? String(r.week_of).slice(0, 10) : null,
    createdAt: r.created_at,
  };
}

/** Fetch all wins/learnings entries. */
export async function fetchWinsLearnings() {
  const rows = await apiGet("/wins-learnings");
  return (rows ?? []).map(winsLearningFromRow);
}

/** Submit a new wins/learning entry. */
export async function submitWinsLearning(entry) {
  const row = await apiPost("/wins-learnings", {
    bm_name: entry.bmName,
    branch: entry.branch,
    gm_name: entry.gmName,
    content: entry.content,
    week_of: entry.weekOf,
  });
  return winsLearningFromRow(row);
}
