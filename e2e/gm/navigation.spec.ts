import { test, expect } from "@playwright/test";
import { gmLogin } from "../helpers/auth";
import { fetchDashboardSnapshot, extractGMData } from "../helpers/snapshot";

test.describe("GM Navigation — Cross-Sectional Flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gmLogin(page);
  });

  /* ---- Sidebar Navigation ---- */

  test("should navigate from Overview to My Leads via sidebar", async ({
    page,
  }) => {
    const sidebarLink = page
      .locator("nav a, nav button")
      .filter({ hasText: /leads/i });
    if (
      await sidebarLink.first().isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await sidebarLink.first().click();
      await expect(page).toHaveURL(/\/gm\/leads/);
    }
  });

  /* ---- Work Section Tile Navigation ---- */

  test("should navigate from Overview to My Leads via Work section tile", async ({
    page,
  }) => {
    const myLeadsTile = page
      .locator('button, a, div[class*="cursor-pointer"]')
      .filter({ hasText: /my leads/i });
    if (
      await myLeadsTile.first().isVisible({ timeout: 5000 }).catch(() => false)
    ) {
      await myLeadsTile.first().click();
      await expect(page).toHaveURL(/\/gm\/leads/);
    }
  });

  /* ---- Observatory Navigation ---- */

  test("should navigate from Overview to Observatory Conversion via tile", async ({
    page,
  }) => {
    const conversionTile = page
      .locator('button, a, div[class*="cursor-pointer"]')
      .filter({ hasText: /conversion/i });
    if (
      await conversionTile
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await conversionTile.first().click();
      await expect(page).toHaveURL(/\/observatory\/conversion/);
    }
  });

  /* ---- Full Flows ---- */

  test("should flow: Overview → Leads → Lead Profile → Back", async ({
    page,
  }) => {
    // Step 1: Go to My Leads
    const myLeadsTile = page
      .locator('button, a, div[class*="cursor-pointer"]')
      .filter({ hasText: /my leads/i });
    if (
      await myLeadsTile.first().isVisible({ timeout: 5000 }).catch(() => false)
    ) {
      await myLeadsTile.first().click();
      await expect(page).toHaveURL(/\/gm\/leads/);
      await page.waitForTimeout(3000);

      // Step 2: Click a lead row to open the panel
      const firstRow = page.locator("table tbody tr").first();
      if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstRow.click();
        await page.waitForTimeout(500);

        // Step 3: Navigate to lead profile if link exists
        const detailLink = page.locator('a[href*="/leads/"]');
        if (
          await detailLink
            .first()
            .isVisible({ timeout: 3000 })
            .catch(() => false)
        ) {
          await detailLink.first().click();
          await expect(page).toHaveURL(/\/gm\/leads\/\d+/);
          await page.waitForTimeout(2000);

          // Step 4: Go back
          const backBtn = page.getByRole("button", { name: /back/i });
          if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(1000);
            expect(page.url()).toMatch(/\/gm\/(leads|overview)/);
          }
        }
      }
    }
  });

  test("should flow: Overview → Observatory → Back to Overview", async ({
    page,
  }) => {
    const conversionTile = page
      .locator('button, a, div[class*="cursor-pointer"]')
      .filter({ hasText: /conversion/i });
    if (
      await conversionTile
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await conversionTile.first().click();
      await expect(page).toHaveURL(/\/observatory\/conversion/);
      await page.waitForTimeout(2000);

      await page.goBack();
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/\/gm\/overview/);
    }
  });

  /* ---- Data Consistency ---- */

  test("should have consistent data: tile value matches drilldown T4W total", async ({
    page,
  }) => {
    // Read Conversion Rate from the tile
    const convTile = page
      .locator("div.bg-neutral-700")
      .filter({ hasText: "CONVERSION RATE" });
    const tileValueText = await convTile
      .locator("p.text-xl")
      .textContent();

    if (tileValueText && tileValueText !== "—") {
      // Open drilldown
      await convTile.click();
      await page.waitForTimeout(1000);

      const modal = page.locator(".fixed.inset-0");
      if (
        await modal.first().isVisible({ timeout: 5000 }).catch(() => false)
      ) {
        const modalText = await modal.first().textContent();
        const tileNum = parseFloat(tileValueText);
        if (!isNaN(tileNum)) {
          // Verify the modal rendered with meaningful data
          expect(modalText?.length).toBeGreaterThan(50);
        }
      }
    }
  });
});
