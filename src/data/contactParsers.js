/**
 * HLES/TRANSLOG contact parsers — extract email/phone for leads.
 * Used by upload pipeline when ingesting HLES and TRANSLOG exports.
 *
 * Column mapping based on docs/hles_sample_500.csv, docs/translog_sample_5000.csv.
 * Real exports may differ; adjust when production data is available.
 */

// Email regex — simple validation
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Phone — digits, optional + prefix, 10+ digits
const PHONE_RE = /\+?[\d\s\-().]{10,}/;

/**
 * Parse HLES row for contact info.
 * HLES sample has CONFIRM_NUM, RENTER_LAST, etc. — no explicit email/phone columns.
 * If real HLES export has EMAIL/PHONE columns, add mapping here.
 *
 * @param {Record<string, string>} row - HLES CSV row (keys may have \n prefix)
 * @returns {{ email?: string, phone?: string }}
 */
export function parseHlesForContact(row) {
  const result = {};
  const emailCol = row?.EMAIL ?? row?.email ?? row?.["EMAIL\n"] ?? row?.["email\n"];
  const phoneCol = row?.PHONE ?? row?.phone ?? row?.["PHONE\n"] ?? row?.["phone\n"];
  if (emailCol && EMAIL_RE.test(String(emailCol))) result.email = String(emailCol).trim();
  if (phoneCol && PHONE_RE.test(String(phoneCol).replace(/\D/g, ""))) result.phone = String(phoneCol).trim();
  return result;
}

/**
 * Parse TRANSLOG events for contact info.
 * Contact info may be embedded in MSG1–MSG10. Key patterns:
 * - EventType 4, BGN01=52: "Successfully entered customer email address" — email in MSG9
 * - RCUBSNOTES: MSG9 has RO_NUMBER, RFP (phone), RFN
 *
 * @param {Array<Record<string, unknown>>} events - TRANSLOG events for a lead (by CONFIRM_NUM/Knum)
 * @returns {{ email?: string, phone?: string }}
 */
export function parseTranslogForContact(events) {
  const result = {};
  if (!Array.isArray(events)) return result;

  for (const ev of events) {
    const msg9 = String(ev?.MSG9 ?? ev?.Msg9 ?? "").trim();
    const msg10 = String(ev?.MSG10 ?? ev?.Msg10 ?? "").trim();
    const combined = `${msg9} ${msg10}`;

    // Email: "Successfully entered customer email address" or EMAIL_REDACTED pattern
    const emailMatch = combined.match(EMAIL_RE);
    if (emailMatch && !result.email) result.email = emailMatch[0];

    // Phone: RO_NUMBER:, RFP:, or standalone phone pattern
    const roMatch = combined.match(/RO_NUMBER:\s*([+\d\s\-().]{10,})/i);
    const rfpMatch = combined.match(/RFP:\s*([+\d\s\-().]{10,})/i);
    const phoneMatch = combined.match(PHONE_RE);
    if (roMatch && !result.phone) result.phone = roMatch[1].replace(/\s+/g, "").trim();
    else if (rfpMatch && !result.phone) result.phone = rfpMatch[1].replace(/\s+/g, "").trim();
    else if (phoneMatch && !result.phone && phoneMatch[0].replace(/\D/g, "").length >= 10) {
      result.phone = phoneMatch[0].replace(/\s+/g, "").trim();
    }
  }
  return result;
}

/**
 * Merge contact info: HLES first, TRANSLOG overlays when HLES missing.
 *
 * @param {{ email?: string, phone?: string }} hles
 * @param {{ email?: string, phone?: string }} translog
 * @returns {{ email?: string, phone?: string }}
 */
export function mergeContactInfo(hles, translog) {
  return {
    email: hles?.email || translog?.email,
    phone: hles?.phone || translog?.phone,
  };
}
