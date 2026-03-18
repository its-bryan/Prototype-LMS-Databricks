import { describe, it, expect, beforeEach } from "vitest";
import {
  setOrgMappingSource,
  leadCancelledWithoutBmComment,
  leadUnusedWithoutBmTouchInPeriod,
  hasBmActivityInDateRange,
  getGMMeetingPrepData,
  getLeadsWithOutstandingItemsForBranch,
} from "./demoSelectors";

const weekStart = new Date(2026, 2, 10); // Mar 10 2026
const weekEnd = new Date(2026, 2, 16); // Mar 16 2026
const dateRange = { start: weekStart, end: weekEnd };

beforeEach(() => {
  setOrgMappingSource([
    { branch: "7401-01 - TEST BRANCH", gm: "Test GM", bm: "Test BM", am: "AM", zone: "FL" },
  ]);
});

describe("leadCancelledWithoutBmComment", () => {
  it("true when cancelled, not archived, no reason/notes", () => {
    expect(
      leadCancelledWithoutBmComment({
        status: "Cancelled",
        archived: false,
        enrichment: {},
      })
    ).toBe(true);
  });
  it("false when BM left notes", () => {
    expect(
      leadCancelledWithoutBmComment({
        status: "Cancelled",
        archived: false,
        enrichment: { notes: "Called customer" },
      })
    ).toBe(false);
  });
  it("false when archived", () => {
    expect(
      leadCancelledWithoutBmComment({
        status: "Cancelled",
        archived: true,
        enrichment: {},
      })
    ).toBe(false);
  });
});

describe("hasBmActivityInDateRange", () => {
  it("true when enrichment_log entry ts in range", () => {
    const t = new Date(2026, 2, 12).getTime();
    expect(
      hasBmActivityInDateRange(
        { enrichmentLog: [{ action: "Updated reason", timestamp: t }], enrichment: {} },
        weekStart,
        weekEnd
      )
    ).toBe(true);
  });
  it("false when only activity outside range", () => {
    const t = new Date(2026, 1, 1).getTime();
    expect(
      hasBmActivityInDateRange(
        { enrichmentLog: [{ action: "note", timestamp: t }], enrichment: { notes: "x" } },
        weekStart,
        weekEnd
      )
    ).toBe(false);
  });
});

describe("leadUnusedWithoutBmTouchInPeriod", () => {
  it("outstanding when unused and no log in period", () => {
    expect(
      leadUnusedWithoutBmTouchInPeriod(
        { status: "Unused", archived: false, enrichmentLog: [], enrichment: {} },
        weekStart,
        weekEnd
      )
    ).toBe(true);
  });
  it("not outstanding when log in period", () => {
    const t = new Date(2026, 2, 11).getTime();
    expect(
      leadUnusedWithoutBmTouchInPeriod(
        {
          status: "Unused",
          archived: false,
          enrichmentLog: [{ action: "Added note", timestamp: t }],
          enrichment: {},
        },
        weekStart,
        weekEnd
      )
    ).toBe(false);
  });
});

describe("getGMMeetingPrepData (E2E-style)", () => {
  it("counts old cancelled without comment — not limited to leads received this week", () => {
    const leads = [
      {
        branch: "7401-01 - TEST BRANCH",
        status: "Cancelled",
        archived: false,
        enrichment: {},
        weekOf: "2025-11-01",
        initDtFinal: "2025-11-01",
      },
      {
        branch: "7401-01 - TEST BRANCH",
        status: "Rented",
        archived: false,
        weekOf: "2026-03-12",
        initDtFinal: "2026-03-12",
      },
    ];
    const data = getGMMeetingPrepData(leads, dateRange, "Test GM");
    expect(data.totalBranches).toBe(1);
    const row = data.branchChecklist[0];
    expect(row.cancelledNoBmComment).toBe(1);
    expect(row.outstanding).toBeGreaterThanOrEqual(1);
    expect(row.isComplete).toBe(false);
  });

  it("unused without weekly touch counts toward outstanding", () => {
    const leads = [
      {
        branch: "7401-01 - TEST BRANCH",
        status: "Unused",
        archived: false,
        enrichment: {},
        enrichmentLog: [],
        initDtFinal: "2025-01-01",
      },
    ];
    const data = getGMMeetingPrepData(leads, dateRange, "Test GM");
    expect(data.branchChecklist[0].unusedNoBmThisPeriod).toBe(1);
    expect(data.branchChecklist[0].outstanding).toBeGreaterThanOrEqual(1);
  });

  it("branch with no issues is complete", () => {
    const t = new Date(2026, 2, 11).getTime();
    const leads = [
      {
        branch: "7401-01 - TEST BRANCH",
        status: "Unused",
        archived: false,
        enrichment: { notes: "ok" },
        enrichmentLog: [{ action: "note", timestamp: t }],
        mismatch: false,
      },
    ];
    const data = getGMMeetingPrepData(leads, dateRange, "Test GM");
    expect(data.branchChecklist[0].unusedNoBmThisPeriod).toBe(0);
    expect(data.branchChecklist[0].cancelledNoBmComment).toBe(0);
    expect(data.branchChecklist[0].isComplete).toBe(true);
  });

  it("per-branch isolation: cancelled on branch B does not count on branch A", () => {
    setOrgMappingSource([
      { branch: "7401-01 - BRANCH A", gm: "Test GM", bm: "BM A", am: "AM", zone: "FL" },
      { branch: "5567-01 - BRANCH B", gm: "Test GM", bm: "BM B", am: "AM", zone: "FL" },
    ]);
    const leads = [
      {
        branch: "5567-01 - BRANCH B",
        status: "Cancelled",
        archived: false,
        enrichment: {},
      },
    ];
    const data = getGMMeetingPrepData(leads, dateRange, "Test GM");
    const rowA = data.branchChecklist.find((r) => r.branch.includes("7401"));
    const rowB = data.branchChecklist.find((r) => r.branch.includes("5567"));
    expect(rowB.cancelledNoBmComment).toBe(1);
    expect(rowB.isComplete).toBe(false);
    expect(rowA.cancelledNoBmComment).toBe(0);
    expect(rowA.isComplete).toBe(true);
  });
});

describe("getLeadsWithOutstandingItemsForBranch", () => {
  it("returns cancelled + unused needing touch for branch", () => {
    const leads = [
      {
        id: 1,
        branch: "7401-01 - TEST BRANCH",
        status: "Cancelled",
        archived: false,
        enrichment: {},
      },
      {
        id: 2,
        branch: "7401-01 - TEST BRANCH",
        status: "Unused",
        archived: false,
        enrichment: {},
        enrichmentLog: [],
      },
    ];
    const out = getLeadsWithOutstandingItemsForBranch(leads, dateRange, "7401-01 - TEST BRANCH");
    expect(out.map((l) => l.id).sort()).toEqual([1, 2]);
  });
});
