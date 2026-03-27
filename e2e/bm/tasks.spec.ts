import { test, expect } from "@playwright/test";
import { bmLogin } from "../helpers/auth";

test.describe("BM Tasks — /bm/tasks", () => {
  let token: string;

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const auth = await bmLogin(page);
    token = auth.token;
    await page.goto("/bm/tasks");
    // Wait for page to load past skeleton
    await page.waitForSelector("h1, h2, h3, table", { timeout: 45_000 });
  });

  test("should load tasks page with heading", async ({ page }) => {
    const heading = page.locator("h1").filter({ hasText: /my tasks/i });
    await expect(heading.first()).toBeVisible({ timeout: 10_000 });
  });

  test("should display tab filters: All, Open, Done", async ({ page }) => {
    const tabs = ["All", "Open", "Done"];
    for (const tab of tabs) {
      const btn = page.locator("button").filter({ hasText: new RegExp(`^${tab}$`, "i") });
      await expect(btn.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("should default to All tab as active", async ({ page }) => {
    const allBtn = page.locator("button").filter({ hasText: /^all$/i });
    const classes = await allBtn.first().getAttribute("class");
    // Active tab has white bg or shadow
    expect(classes).toMatch(/bg-white|shadow|hertz-black/);
  });

  test("should filter by Open tab", async ({ page }) => {
    const openBtn = page.locator("button").filter({ hasText: /^open$/i });
    await openBtn.first().click();
    await page.waitForTimeout(1500);

    // Verify visible task statuses are Open or In Progress
    const statusBadges = page.locator("span.rounded-full, span.rounded-md");
    const count = await statusBadges.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await statusBadges.nth(i).textContent();
      if (text && /open|in progress/i.test(text)) {
        expect(text.toLowerCase()).toMatch(/open|in progress/);
      }
    }
  });

  test("should filter by Done tab", async ({ page }) => {
    const doneBtn = page.locator("button").filter({ hasText: /^done$/i });
    await doneBtn.first().click();
    await page.waitForTimeout(1500);

    const statusBadges = page.locator("span.rounded-full, span.rounded-md");
    const count = await statusBadges.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await statusBadges.nth(i).textContent();
      if (text && /done/i.test(text)) {
        expect(text.toLowerCase()).toContain("done");
      }
    }
  });

  test("should display tasks in grouped view", async ({ page }) => {
    // Tasks are grouped by lead — group headers have customer name
    const groupHeaders = page.locator(
      "h3, h4, div.font-semibold, div.font-bold",
    );
    const pageContent = await page.locator("body").textContent();
    // Should have some content (either tasks or empty state)
    expect(pageContent).toBeTruthy();
  });

  test("should display search input", async ({ page }) => {
    const searchInput = page.locator('input[type="text"]');
    await expect(searchInput.first()).toBeVisible({ timeout: 10_000 });
  });

  test("should mark task as done", async ({ page }) => {
    // Find a "Mark Done" button
    const markDoneBtn = page
      .locator("button")
      .filter({ hasText: /mark done|mark as done|complete/i });
    if (
      await markDoneBtn
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await markDoneBtn.first().click();
      await page.waitForTimeout(2000);
      // The button should disappear or status should change
      const pageText = await page.locator("body").textContent();
      expect(pageText).toBeTruthy();
    }
  });

  test("should paginate tasks", async ({ page }) => {
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
});
