import { test, expect } from "@playwright/test";
import { bmLogin } from "../helpers/auth";

test.describe("BM Work Hub — /bm/work", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await bmLogin(page);
    await page.goto("/bm/work");
    await page.waitForSelector("h1, h2, h3", { timeout: 30_000 });
  });

  test("should load Work Hub with heading and 4 tiles", async ({ page }) => {
    const heading = page.locator("h1, h2, h3").filter({ hasText: /work/i });
    await expect(heading.first()).toBeVisible({ timeout: 5000 });

    const tiles = page.locator("button.border-2.rounded-xl, a.border-2.rounded-xl");
    await expect(tiles).toHaveCount(4);
  });

  test("should display correct tile labels", async ({ page }) => {
    const tiles = page.locator("button.border-2.rounded-xl, a.border-2.rounded-xl");
    const labels = ["Meeting Prep", "Leaderboard", "My Leads", "Open Tasks"];
    for (const label of labels) {
      await expect(tiles.filter({ hasText: new RegExp(label, "i") })).toHaveCount(1);
    }
  });

  test("should navigate to Meeting Prep on tile click", async ({ page }) => {
    const tiles = page.locator("button.border-2.rounded-xl, a.border-2.rounded-xl");
    await tiles.filter({ hasText: /meeting prep/i }).click();
    await expect(page).toHaveURL(/\/bm\/meeting-prep/);
  });

  test("should navigate to Leaderboard on tile click", async ({ page }) => {
    const tiles = page.locator("button.border-2.rounded-xl, a.border-2.rounded-xl");
    await tiles.filter({ hasText: /leaderboard/i }).click();
    await expect(page).toHaveURL(/\/bm\/leaderboard/);
  });

  test("should navigate to My Leads on tile click", async ({ page }) => {
    const tiles = page.locator("button.border-2.rounded-xl, a.border-2.rounded-xl");
    await tiles.filter({ hasText: /my leads/i }).click();
    await expect(page).toHaveURL(/\/bm\/leads/);
  });

  test("should navigate to Open Tasks on tile click", async ({ page }) => {
    const tiles = page.locator("button.border-2.rounded-xl, a.border-2.rounded-xl");
    await tiles.filter({ hasText: /open tasks/i }).click();
    await expect(page).toHaveURL(/\/bm\/tasks/);
  });
});
