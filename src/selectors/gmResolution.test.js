import { describe, it, expect, beforeEach } from "vitest";
import { getBranchesForGM, setOrgMappingSource } from "./demoSelectors";

describe("getBranchesForGM", () => {
  beforeEach(() => {
    setOrgMappingSource([
      { branch: "7401-01 - PERRINE HLE", gm: "Adam Frankel", bm: "Jonathan Hoover", am: "AM1", zone: "FL" },
      { branch: "5567-01 - MIAMI AIRPORT", gm: "Adam Frankel", bm: "Sarah Jones", am: "AM1", zone: "FL" },
      { branch: "8832-01 - ORLANDO MCO", gm: "Bob Smith", bm: "Jane Doe", am: "AM2", zone: "FL" },
      { branch: "9901-01 - TAMPA AIRPORT", gm: null, bm: "Jim Brown", am: "AM2", zone: "FL" },
    ]);
  });

  it("returns branches for a matching GM name", () => {
    const branches = getBranchesForGM("Adam Frankel");
    expect(branches).toHaveLength(2);
    expect(branches).toContain("7401-01 - PERRINE HLE");
    expect(branches).toContain("5567-01 - MIAMI AIRPORT");
  });

  it("is case-insensitive", () => {
    const branches = getBranchesForGM("adam frankel");
    expect(branches).toHaveLength(2);
  });

  it("handles ALL CAPS (database format)", () => {
    const branches = getBranchesForGM("ADAM FRANKEL");
    expect(branches).toHaveLength(2);
  });

  it("returns empty for unknown GM", () => {
    expect(getBranchesForGM("Nobody Here")).toEqual([]);
  });

  it("returns empty for null/empty input", () => {
    expect(getBranchesForGM(null)).toEqual([]);
    expect(getBranchesForGM("")).toEqual([]);
    expect(getBranchesForGM(undefined)).toEqual([]);
  });

  it("does NOT accept a leads parameter (function signature has only gmName)", () => {
    expect(getBranchesForGM.length).toBe(1);
  });

  it("does not include branches with null GM", () => {
    const allBranches = [
      ...getBranchesForGM("Adam Frankel"),
      ...getBranchesForGM("Bob Smith"),
    ];
    expect(allBranches).not.toContain("9901-01 - TAMPA AIRPORT");
  });
});
