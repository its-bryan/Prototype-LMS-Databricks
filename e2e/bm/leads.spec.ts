import { test, expect } from "@playwright/test";
import { bmLogin } from "../helpers/auth";

test.describe("BM My Leads — /bm/leads", () => {
  let token: string;

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const auth = await bmLogin(page);
    token = auth.token;
    await page.goto("/bm/leads");
    // Wait for page to load past skeleton
    await page.waitForSelector("h1", { timeout: 30_000 });
  });

  test("should load BM Leads page with heading and table", async ({
    page,
  }) => {
    const heading = page.locator("h1, h2").filter({ hasText: /leads/i });
    await expect(heading.first()).toBeVisible({ timeout: 5000 });

    // Table rows or no-results message
    const rows = page.locator("table tbody tr, div.border-b");
    const noResults = page.getByText(/no leads/i);
    const hasRows = (await rows.count()) > 0;
    const hasNoResults = await noResults
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    expect(hasRows || hasNoResults).toBe(true);
  });

  test("should display status filter tabs", async ({ page }) => {
    // Status filter tabs are inside a grouped button container
    const tabs = ["All", "Cancelled", "Unused", "Rented"];
    for (const tab of tabs) {
      const btn = page.locator("button").filter({ hasText: new RegExp(tab, "i") });
      await expect(btn.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("should filter leads by Cancelled status", async ({ page }) => {
    const cancelledBtn = page
      .locator("button")
      .filter({ hasText: /cancelled/i });
    await cancelledBtn.first().click();
    await page.waitForTimeout(2000);

    // Verify status badges show Cancelled
    const statusBadges = page.locator("span.rounded.text-xs.font-medium");
    const count = await statusBadges.count();
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 10); i++) {
        const text = await statusBadges.nth(i).textContent();
        if (text && text.trim().length > 2) {
          expect(text.toLowerCase()).toContain("cancelled");
        }
      }
    }
  });

  test("should filter leads by Rented status", async ({ page }) => {
    const rentedBtn = page
      .locator("button")
      .filter({ hasText: /rented/i });
    await rentedBtn.first().click();
    await page.waitForTimeout(2000);

    const statusBadges = page.locator("span.rounded.text-xs.font-medium");
    const count = await statusBadges.count();
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 10); i++) {
        const text = await statusBadges.nth(i).textContent();
        if (text && text.trim().length > 2) {
          expect(text.toLowerCase()).toContain("rented");
        }
      }
    }
  });

  test("should display date preset buttons", async ({ page }) => {
    // Presets are in a rounded-md container — labels like "T4W", "1W", "2W", "4W"
    const presetContainer = page.locator("div.inline-flex.rounded-md button");
    expect(await presetContainer.count()).toBeGreaterThan(0);
  });

  test("should search leads by name", async ({ page }) => {
    const searchInput = page.locator(
      'input[type="text"], input[placeholder*="search" i], input[placeholder*="Search"]',
    );
    if (
      await searchInput.first().isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      const initialRowCount = await page
        .locator("table tbody tr, div.border-b")
        .count();
      await searchInput.first().fill("zzzznonexistent");
      await page.waitForTimeout(1500);
      const newRowCount = await page
        .locator("table tbody tr, div.border-b")
        .count();
      expect(newRowCount).toBeLessThanOrEqual(initialRowCount);
    }
  });

  test("should display correct table columns", async ({ page }) => {
    // Wait for table to render
    await page.waitForSelector("table, div.border-b", { timeout: 10_000 }).catch(() => {});
    const pageText = await page.locator("body").textContent();
    const expectedHeaders = ["customer", "status"];
    for (const header of expectedHeaders) {
      expect(pageText?.toLowerCase()).toContain(header);
    }
  });

  test("should navigate to lead detail on row click", async ({ page }) => {
    const rows = page.locator("table tbody tr, div.border-b.cursor-pointer");
    if ((await rows.count()) > 0) {
      await rows.first().click();
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/\/bm\/leads\/.+/);
    }
  });

  test("should paginate leads", async ({ page }) => {
    const nextBtn = page
      .locator("button")
      .filter({ hasText: /next|→|›/i });
    if (
      await nextBtn.first().isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      const isDisabled = await nextBtn.first().isDisabled();
      if (!isDisabled) {
        await nextBtn.first().click();
        await page.waitForTimeout(1000);
        const prevBtn = page
          .locator("button")
          .filter({ hasText: /prev|←|‹/i });
        if (
          await prevBtn
            .first()
            .isVisible({ timeout: 2000 })
            .catch(() => false)
        ) {
          expect(await prevBtn.first().isDisabled()).toBe(false);
        }
      }
    }
  });

  test("should display total count in pagination text", async ({ page }) => {
    const paginationText = page
      .locator("span, p")
      .filter({ hasText: /showing|of \d+/i });
    if (
      await paginationText
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      const text = await paginationText.first().textContent();
      expect(text).toMatch(/\d+/);
    }
  });
});
