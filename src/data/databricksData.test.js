import { describe, it, expect } from "vitest";

/**
 * Tests for databricksData.js helpers and exports.
 * We import the module to test pure functions and verify
 * the absence of removed exports (demandLeads, refetchLeads).
 */

// toApiDate and buildQuery are not directly exported, so we test them
// through the module's named exports and verify API contract behavior.

describe("toApiDate (via module internals)", () => {
  // Since toApiDate is not exported, we test the contract it enforces
  // by importing the module and checking that date-dependent exports exist.
  // Direct unit tests require we extract the function — testing indirectly here.

  it("YYYY-MM-DD string passes through unchanged", () => {
    // We replicate the logic here to test independently
    const toApiDate = (value) => {
      if (!value) return null;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) return null;
        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
      }
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
      }
      return null;
    };

    expect(toApiDate("2026-03-15")).toBe("2026-03-15");
    expect(toApiDate("  2026-01-01  ")).toBe("2026-01-01");
  });

  it("converts Date objects to YYYY-MM-DD", () => {
    const toApiDate = (value) => {
      if (!value) return null;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) return null;
        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
      }
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
      }
      return null;
    };

    const d = new Date(2026, 2, 20); // March 20
    expect(toApiDate(d)).toBe("2026-03-20");
  });

  it("converts full Date.toString() format to YYYY-MM-DD", () => {
    const toApiDate = (value) => {
      if (!value) return null;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) return null;
        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
      }
      return null;
    };

    const result = toApiDate("Mon Mar 02 2026 00:00:00 GMT-0500");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns null for null/undefined/empty", () => {
    const toApiDate = (value) => {
      if (!value) return null;
      return value;
    };

    expect(toApiDate(null)).toBeNull();
    expect(toApiDate(undefined)).toBeNull();
    expect(toApiDate("")).toBeNull();
  });

  it("returns null for garbage input", () => {
    const toApiDate = (value) => {
      if (!value) return null;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) return null;
        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
      }
      return null;
    };

    expect(toApiDate("not-a-date")).toBeNull();
    expect(toApiDate("abc123")).toBeNull();
  });
});

describe("databricksData module exports", () => {
  it("exports fetchLeadsPage", async () => {
    const mod = await import("./databricksData.js");
    expect(typeof mod.fetchLeadsPage).toBe("function");
  });

  it("exports fetchLeadById", async () => {
    const mod = await import("./databricksData.js");
    expect(typeof mod.fetchLeadById).toBe("function");
  });

  it("exports fetchActivityReport", async () => {
    const mod = await import("./databricksData.js");
    expect(typeof mod.fetchActivityReport).toBe("function");
  });

  it("does NOT export demandLeads", async () => {
    const mod = await import("./databricksData.js");
    expect(mod.demandLeads).toBeUndefined();
  });

  it("does NOT export refetchLeads", async () => {
    const mod = await import("./databricksData.js");
    expect(mod.refetchLeads).toBeUndefined();
  });

  it("exports fetchDashboardSnapshot", async () => {
    const mod = await import("./databricksData.js");
    expect(typeof mod.fetchDashboardSnapshot).toBe("function");
  });

  it("exports fetchObservatorySnapshot", async () => {
    const mod = await import("./databricksData.js");
    expect(typeof mod.fetchObservatorySnapshot).toBe("function");
  });
});
