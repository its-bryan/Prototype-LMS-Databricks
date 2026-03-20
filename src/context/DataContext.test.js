import { describe, it, expect } from "vitest";

/**
 * Guardrail tests: verify that the DataContext module no longer exports
 * or references the deprecated unbounded-data functions.
 *
 * These tests read the source file as text and check for the absence of
 * removed patterns, since importing DataContext requires a React environment
 * and a running backend.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const ctxSource = readFileSync(
  resolve(import.meta.dirname, "DataContext.jsx"),
  "utf-8"
);

describe("DataContext guardrails", () => {
  it("does not export demandLeads", () => {
    expect(ctxSource).not.toMatch(/demandLeads/);
  });

  it("does not export refetchLeads", () => {
    expect(ctxSource).not.toMatch(/refetchLeads/);
  });

  it("does not use readCache('leads')", () => {
    expect(ctxSource).not.toMatch(/readCache\s*\(\s*['"]leads['"]\s*\)/);
  });

  it("does not use writeCache('leads', ...)", () => {
    expect(ctxSource).not.toMatch(/writeCache\s*\(\s*['"]leads['"]/);
  });

  it("imports fetchLeadById from databricksData", () => {
    expect(ctxSource).toMatch(/fetchLeadById/);
  });

  it("imports fetchLeadsPage from databricksData", () => {
    expect(ctxSource).toMatch(/fetchLeadsPage/);
  });

  it("provides fetchLeadById in context value", () => {
    expect(ctxSource).toMatch(/fetchLeadById/);
  });
});

describe("databricksData module guardrails", () => {
  const dataSource = readFileSync(
    resolve(import.meta.dirname, "../data/databricksData.js"),
    "utf-8"
  );

  it("has toApiDate helper", () => {
    expect(dataSource).toMatch(/function toApiDate/);
  });

  it("has fetchLeadsPage export", () => {
    expect(dataSource).toMatch(/export async function fetchLeadsPage/);
  });

  it("has fetchLeadById export", () => {
    expect(dataSource).toMatch(/export async function fetchLeadById/);
  });

  it("has fetchActivityReport export", () => {
    expect(dataSource).toMatch(/export async function fetchActivityReport/);
  });

  it("fetchLeadsPage uses paged param", () => {
    expect(dataSource).toMatch(/paged:\s*1/);
  });

  it("fetchLeadsPage normalizes dates with toApiDate", () => {
    expect(dataSource).toMatch(/toApiDate\(startDate\)/);
    expect(dataSource).toMatch(/toApiDate\(endDate\)/);
  });
});
