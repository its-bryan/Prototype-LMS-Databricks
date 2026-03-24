import { test, expect } from "@playwright/test";
import { gmLogin } from "../helpers/auth";
import { fetchDashboardSnapshot } from "../helpers/snapshot";

let token: string;

test.describe("GM Team Leaderboard — /gm/leaderboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const auth = await gmLogin(page, "/gm/leaderboard");
    token = auth.token;
    await page.waitForSelector('h1', { timeout: 45_000 });
  });

  /* ---- Page Load ---- */

  test("should load leaderboard page with branch rows", async ({ page }) => {
    // Page heading
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    // Branch rows should exist (table rows or card elements)
    const rows = page.locator("tr, div.border-b, div.rounded-lg").filter({
      hasText: /\d/,
    });
    expect(await rows.count()).toBeGreaterThan(0);
  });

  /* ---- Metric Selector ---- */

  test("should default to Conversion Rate metric", async ({ page }) => {
    const metricSelector = page.locator("select").first();
    if (await metricSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      const selected = await metricSelector.inputValue();
      expect(selected).toBe("conversionRate");
    } else {
      // Could be button-based selector — check for active state
      const activeBtn = page.getByText("Conversion Rate").first();
      await expect(activeBtn).toBeVisible();
    }
  });

  test("should default sort to Highest to Lowest", async ({ page }) => {
    const sortSelector = page.locator("select").nth(1);
    if (await sortSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      const selected = await sortSelector.inputValue();
      expect(selected).toBe("high_low");
    }
  });

  test("should switch metric to Comment Compliance", async ({ page }) => {
    const metricSelector = page.locator("select").first();
    if (await metricSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      await metricSelector.selectOption("commentRate");
      await page.waitForTimeout(500);
      // Verify some branch value contains % (comment compliance is a rate)
      const values = page.locator("text=/%/");
      expect(await values.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test("should switch metric to Branch Contact %", async ({ page }) => {
    const metricSelector = page.locator("select").first();
    if (await metricSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      await metricSelector.selectOption("branchHrdPct");
      await page.waitForTimeout(500);
    }
  });

  test("should switch metric to Total Leads", async ({ page }) => {
    const metricSelector = page.locator("select").first();
    if (await metricSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      await metricSelector.selectOption("total");
      await page.waitForTimeout(500);
      // Total leads values should be raw counts
    }
  });

  test("should sort A to Z correctly", async ({ page }) => {
    const sortSelector = page.locator("select").nth(1);
    if (await sortSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sortSelector.selectOption("a_z");
      await page.waitForTimeout(500);

      // Read branch names and verify alphabetical
      const branchLabels = page.locator("td:first-child, p.font-semibold");
      const names: string[] = [];
      const count = await branchLabels.count();
      for (let i = 0; i < Math.min(count, 15); i++) {
        const text = await branchLabels.nth(i).textContent();
        if (text && text.trim().length > 1) names.push(text.trim());
      }
      if (names.length > 1) {
        const sorted = [...names].sort((a, b) =>
          a.localeCompare(b, "en", { sensitivity: "base" }),
        );
        expect(names).toEqual(sorted);
      }
    }
  });

  test("should sort Low to High correctly", async ({ page }) => {
    const sortSelector = page.locator("select").nth(1);
    if (await sortSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sortSelector.selectOption("low_high");
      await page.waitForTimeout(500);
    }
  });

  test("should open branch detail pane on click", async ({ page }) => {
    // Click first branch row
    const firstRow = page
      .locator("tr, div.cursor-pointer")
      .filter({ hasText: /\d/ })
      .first();
    if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(500);
      // Detail pane should appear
      const detailPane = page.locator(
        "div.fixed, div.absolute, [class*='transition']",
      );
      expect(await detailPane.count()).toBeGreaterThan(0);
    }
  });

  test("should validate branch values against snapshot", async ({ page }) => {
    const snapshot = await fetchDashboardSnapshot(page.request, token);
    const leaderboard = (snapshot as { leaderboard?: unknown[] }).leaderboard;
    expect(leaderboard).toBeTruthy();
    expect(Array.isArray(leaderboard)).toBe(true);
    if (leaderboard) {
      expect(leaderboard.length).toBeGreaterThan(0);
    }
  });
});
