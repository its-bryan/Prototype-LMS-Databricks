import { test, expect } from "@playwright/test";
import { gmLogin } from "../helpers/auth";

test.describe("GM Work Hub — /gm/work", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gmLogin(page, "/gm/work");
    await page.waitForSelector('h1:has-text("Work")', { timeout: 45_000 });
  });

  test("should load Work Hub with 4 tiles", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Work" })).toBeVisible();
    const tiles = page.locator("button.border-2.rounded-xl");
    await expect(tiles).toHaveCount(4);
  });

  test("should display correct tile labels", async ({ page }) => {
    const tiles = page.locator("button.border-2.rounded-xl");
    for (const label of [
      "Meeting Prep",
      "My Leads",
      "Team Leaderboard",
      "Activity Report",
    ]) {
      await expect(tiles.filter({ hasText: label })).toHaveCount(1);
    }
  });

  test("should navigate to Meeting Prep on tile click", async ({ page }) => {
    await page.locator("button.border-2.rounded-xl").filter({ hasText: "Meeting Prep" }).click();
    await expect(page).toHaveURL(/\/gm\/meeting-prep/);
  });

  test("should navigate to My Leads on tile click", async ({ page }) => {
    await page.locator("button.border-2.rounded-xl").filter({ hasText: "My Leads" }).click();
    await expect(page).toHaveURL(/\/gm\/leads/);
  });

  test("should navigate to Team Leaderboard on tile click", async ({
    page,
  }) => {
    await page.locator("button.border-2.rounded-xl").filter({ hasText: "Team Leaderboard" }).click();
    await expect(page).toHaveURL(/\/gm\/leaderboard/);
  });
});
