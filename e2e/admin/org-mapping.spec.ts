import { test, expect, type Page } from "@playwright/test";
import { adminLogin } from "../helpers/auth";
import { fetchOrgMapping, patchBranchBm } from "../helpers/admin";

let token: string;
let apiRows: Array<{ branch: string; bm: string; am: string; gm: string; zone: string }>;

// Track edits made during tests so we can restore in afterEach
let editedBranch: string | null = null;
let originalBm: string | null = null;

test.describe("Org Mapping — /admin/org-mapping", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const auth = await adminLogin(page, "/admin/org-mapping");
    token = auth.token;
    apiRows = await fetchOrgMapping(page.request, token);
    editedBranch = null;
    originalBm = null;
  });

  test.afterEach(async ({ page }) => {
    // Restore any BM edits made during the test
    if (editedBranch && originalBm !== null) {
      await patchBranchBm(page.request, token, editedBranch, originalBm);
    }
  });

  /* ---- JTBD 1: Page Structure ---- */

  test("should display Org Mapping page with title and description", async ({ page }) => {
    await expect(page.locator('[data-testid="org-mapping-title"]')).toHaveText("Organisation Mapping");
    await expect(page.locator('[data-testid="org-mapping-page"]')).toContainText("Click any BM cell to edit manually");
  });

  test("should display table with 5 columns", async ({ page }) => {
    const headers = page.locator('[data-testid="org-mapping-table"] thead th');
    await expect(headers).toHaveCount(5);
    await expect(headers.nth(0)).toContainText("Branch Manager");
    await expect(headers.nth(1)).toContainText("Branch Location");
    await expect(headers.nth(2)).toContainText("Area Manager");
    await expect(headers.nth(3)).toContainText("General Manager");
    await expect(headers.nth(4)).toContainText("Zone");
  });

  test("should display correct row count matching API data", async ({ page }) => {
    const countText = await page.locator('[data-testid="org-mapping-count"]').textContent();
    expect(countText).toContain(`${apiRows.length} of ${apiRows.length} branches`);
  });

  /* ---- JTBD 2: Pagination ---- */

  test("should paginate at 20 rows per page", async ({ page }) => {
    const rows = page.locator('[data-testid="org-mapping-table"] tbody tr[data-testid^="org-mapping-row-"]');
    const rowCount = await rows.count();
    expect(rowCount).toBeLessThanOrEqual(20);

    if (apiRows.length > 20) {
      const pageInfo = await page.locator('[data-testid="org-mapping-page-info"]').textContent();
      expect(pageInfo).toContain("Showing 1–20");
      expect(pageInfo).toContain(`of ${apiRows.length}`);
    }
  });

  test("should navigate between pages", async ({ page }) => {
    test.skip(apiRows.length <= 20, "Not enough rows for pagination");

    const indicator = page.locator('[data-testid="org-mapping-page-indicator"]');
    await expect(indicator).toContainText("1 /");

    await page.locator('[data-testid="org-mapping-page-next"]').click();
    await expect(indicator).toContainText("2 /");

    await page.locator('[data-testid="org-mapping-page-prev"]').click();
    await expect(indicator).toContainText("1 /");
  });

  test("should jump to first and last page", async ({ page }) => {
    test.skip(apiRows.length <= 20, "Not enough rows for pagination");

    const totalPages = Math.ceil(apiRows.length / 20);
    const indicator = page.locator('[data-testid="org-mapping-page-indicator"]');

    await page.locator('[data-testid="org-mapping-page-last"]').click();
    await expect(indicator).toContainText(`${totalPages} / ${totalPages}`);

    await page.locator('[data-testid="org-mapping-page-first"]').click();
    await expect(indicator).toContainText(`1 / ${totalPages}`);
  });

  /* ---- JTBD 3: Zone Filter ---- */

  test("should display zone filter dropdown with All as default", async ({ page }) => {
    const filter = page.locator('[data-testid="org-mapping-zone-filter"]');
    await expect(filter).toBeVisible();
    await expect(filter).toHaveValue("All");
  });

  test("should filter table by zone selection", async ({ page }) => {
    const zones = [...new Set(apiRows.map((r) => r.zone).filter(Boolean))];
    test.skip(zones.length === 0, "No zones available");

    const targetZone = zones[0];
    const expectedCount = apiRows.filter((r) => r.zone === targetZone).length;

    await page.locator('[data-testid="org-mapping-zone-filter"]').selectOption(targetZone);

    const countText = await page.locator('[data-testid="org-mapping-count"]').textContent();
    expect(countText).toContain(`${expectedCount} of ${apiRows.length} branches`);
  });

  test("should restore all rows when zone filter returns to All", async ({ page }) => {
    const zones = [...new Set(apiRows.map((r) => r.zone).filter(Boolean))];
    test.skip(zones.length === 0, "No zones available");

    await page.locator('[data-testid="org-mapping-zone-filter"]').selectOption(zones[0]);
    await page.locator('[data-testid="org-mapping-zone-filter"]').selectOption("All");

    const countText = await page.locator('[data-testid="org-mapping-count"]').textContent();
    expect(countText).toContain(`${apiRows.length} of ${apiRows.length} branches`);
  });

  /* ---- JTBD 4: Unassigned Filter ---- */

  test("should display unassigned filter button with count badge", async ({ page }) => {
    const btn = page.locator('[data-testid="org-mapping-unassigned-filter"]');
    await expect(btn).toBeVisible();
    const text = await btn.textContent();
    expect(text).toMatch(/\d+ Unassigned/);
  });

  test("should filter to only unassigned rows when toggled", async ({ page }) => {
    const unassignedCount = apiRows.filter((r) => !r.bm || r.bm === "— Unassigned —").length;
    test.skip(unassignedCount === 0, "No unassigned rows");

    await page.locator('[data-testid="org-mapping-unassigned-filter"]').click();

    // All visible BM cells should show unassigned text
    const bmCells = page.locator('[data-testid="org-mapping-table"] tbody td:first-child button');
    const count = await bmCells.count();
    for (let i = 0; i < Math.min(count, 20); i++) {
      const text = await bmCells.nth(i).textContent();
      expect(text).toContain("Unassigned");
    }
  });

  /* ---- JTBD 5: Inline BM Edit ---- */

  test("should enter edit mode when clicking a BM cell", async ({ page }) => {
    // Find a row with an assigned BM to click
    const assignedRow = apiRows.find((r) => r.bm && r.bm !== "— Unassigned —");
    test.skip(!assignedRow, "No assigned BM rows");

    await page.locator(`[data-testid="org-mapping-bm-${assignedRow!.branch}"]`).click();

    await expect(page.locator('[data-testid="org-mapping-bm-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-mapping-bm-save"]')).toBeVisible();
    await expect(page.locator('[data-testid="org-mapping-bm-cancel"]')).toBeVisible();
  });

  test("should save BM name on Enter keypress and show Saved toast", async ({ page }) => {
    const assignedRow = apiRows.find((r) => r.bm && r.bm !== "— Unassigned —");
    test.skip(!assignedRow, "No assigned BM rows");

    editedBranch = assignedRow!.branch;
    originalBm = assignedRow!.bm;
    const newName = `Test BM ${Date.now()}`;

    await page.locator(`[data-testid="org-mapping-bm-${assignedRow!.branch}"]`).click();
    const input = page.locator('[data-testid="org-mapping-bm-input"]');
    await input.fill(newName);
    await input.press("Enter");

    // Input should disappear and new name should show
    await expect(page.locator('[data-testid="org-mapping-bm-input"]')).not.toBeVisible();
    await expect(page.locator(`[data-testid="org-mapping-bm-${assignedRow!.branch}"]`)).toHaveText(newName);

    // Saved toast
    await expect(page.locator('[data-testid="org-mapping-saved-toast"]')).toBeVisible();
  });

  test("should save BM name on Save button click", async ({ page }) => {
    const assignedRow = apiRows.find((r) => r.bm && r.bm !== "— Unassigned —");
    test.skip(!assignedRow, "No assigned BM rows");

    editedBranch = assignedRow!.branch;
    originalBm = assignedRow!.bm;
    const newName = `Test Save ${Date.now()}`;

    await page.locator(`[data-testid="org-mapping-bm-${assignedRow!.branch}"]`).click();
    await page.locator('[data-testid="org-mapping-bm-input"]').fill(newName);
    await page.locator('[data-testid="org-mapping-bm-save"]').click();

    await expect(page.locator(`[data-testid="org-mapping-bm-${assignedRow!.branch}"]`)).toHaveText(newName);
  });

  test("should cancel edit on Escape keypress", async ({ page }) => {
    const assignedRow = apiRows.find((r) => r.bm && r.bm !== "— Unassigned —");
    test.skip(!assignedRow, "No assigned BM rows");

    await page.locator(`[data-testid="org-mapping-bm-${assignedRow!.branch}"]`).click();
    const input = page.locator('[data-testid="org-mapping-bm-input"]');
    await input.fill("Should Not Save");
    await input.press("Escape");

    await expect(page.locator('[data-testid="org-mapping-bm-input"]')).not.toBeVisible();
    await expect(page.locator(`[data-testid="org-mapping-bm-${assignedRow!.branch}"]`)).toHaveText(assignedRow!.bm);
  });

  test("should cancel edit on Cancel button click", async ({ page }) => {
    const assignedRow = apiRows.find((r) => r.bm && r.bm !== "— Unassigned —");
    test.skip(!assignedRow, "No assigned BM rows");

    await page.locator(`[data-testid="org-mapping-bm-${assignedRow!.branch}"]`).click();
    await page.locator('[data-testid="org-mapping-bm-input"]').fill("Should Not Save");
    await page.locator('[data-testid="org-mapping-bm-cancel"]').click();

    await expect(page.locator(`[data-testid="org-mapping-bm-${assignedRow!.branch}"]`)).toHaveText(assignedRow!.bm);
  });

  test("should persist BM name after page reload", async ({ page }) => {
    const assignedRow = apiRows.find((r) => r.bm && r.bm !== "— Unassigned —");
    test.skip(!assignedRow, "No assigned BM rows");

    editedBranch = assignedRow!.branch;
    originalBm = assignedRow!.bm;
    const newName = `Persist ${Date.now()}`;

    await page.locator(`[data-testid="org-mapping-bm-${assignedRow!.branch}"]`).click();
    await page.locator('[data-testid="org-mapping-bm-input"]').fill(newName);
    await page.locator('[data-testid="org-mapping-bm-input"]').press("Enter");
    await expect(page.locator('[data-testid="org-mapping-saved-toast"]')).toBeVisible();

    // Wait briefly for API call, then reload
    await page.waitForTimeout(1000);
    await page.reload();
    await page.waitForSelector('[data-testid="org-mapping-table"]', { timeout: 30_000 });

    // The edited name should still be there
    await expect(page.locator(`[data-testid="org-mapping-bm-${assignedRow!.branch}"]`)).toHaveText(newName);
  });

  /* ---- JTBD 6: Data Integrity ---- */

  test("should match API org mapping data in the table", async ({ page }) => {
    // Verify first page of rows matches API data
    const rows = page.locator('[data-testid="org-mapping-table"] tbody tr[data-testid^="org-mapping-row-"]');
    const displayCount = await rows.count();

    for (let i = 0; i < Math.min(displayCount, 5); i++) {
      const row = rows.nth(i);
      const cells = row.locator("td");

      const branchText = (await cells.nth(1).textContent())?.trim() ?? "";
      const apiRow = apiRows.find((r) => r.branch === branchText);
      if (!apiRow) continue;

      const amText = (await cells.nth(2).textContent())?.trim() ?? "";
      const gmText = (await cells.nth(3).textContent())?.trim() ?? "";
      const zoneText = (await cells.nth(4).textContent())?.trim() ?? "";

      expect(amText).toBe(apiRow.am || "—");
      expect(gmText).toBe(apiRow.gm || "—");
      expect(zoneText).toBe(apiRow.zone || "—");
    }
  });
});
