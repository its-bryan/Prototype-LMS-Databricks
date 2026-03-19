import { formatDateRange as formatDateRangePST, formatDateOnly } from "./dateTime";

export const easeOut = [0.4, 0, 0.2, 1];

export const cardAnim = (i, reduced = false) => ({
  initial: reduced ? false : { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: reduced ? 0 : i * 0.06, duration: reduced ? 0.01 : 0.4, ease: easeOut },
});

export function getTimeOfDayGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function formatDateRange(preset, customStart, customEnd) {
  if (preset?.key === "custom" && customStart && customEnd) {
    return formatDateRangePST(new Date(customStart), new Date(customEnd));
  }
  if (preset?.start && preset?.end) {
    return formatDateRangePST(preset.start, preset.end);
  }
  return preset?.label ?? "";
}

export function formatDateDisplay(isoStr) {
  if (!isoStr) return "—";
  return formatDateOnly(isoStr);
}

export function leadToHlesRow(lead, org) {
  const rentInd = lead.status === "Rented" ? 1 : 0;
  const cancelId = lead.status === "Cancelled" ? 1 : 0;
  const unusedInd = lead.status === "Unused" ? 1 : 0;
  return {
    INIT_DT_FINAL: formatDateDisplay(lead.initDtFinal),
    CONFIRM_NUM: lead.reservationId ?? "—",
    RENTER_LAST: lead.customer ?? "—",
    CLAIM: lead.claim ?? "—",
    CDP: lead.cdp ?? lead.insuranceCompany ?? "—",
    RENT_LOC: lead.branch ?? "—",
    RES_ID: lead.reservationId ?? "—",
    RENT_IND: rentInd,
    CANCEL_ID: cancelId,
    UNUSED_IND: unusedInd,
    STATUS: lead.status,
    CANCEL_REASON: lead.hlesReason ?? "—",
    COMMENTS: lead.enrichment?.reason ?? lead.enrichment?.notes ?? "—",
    AREA_MGR: org?.am ?? "—",
    GENERAL_MGR: org?.gm ?? "—",
    DAYS_OPEN: lead.daysOpen ?? "—",
    DT_FROM_ALPHA1: formatDateDisplay(lead.dtFromAlpha1),
    TIME_TO_CONTACT: lead.timeToFirstContact ?? "—",
  };
}
