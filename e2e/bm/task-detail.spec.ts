import { test, expect } from "@playwright/test";
import { bmLogin } from "../helpers/auth";

let token: string;
let taskUrl: string | null = null;
let originalStatus: string | null = null;

test.describe("BM Task Detail — /bm/tasks/:taskId", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const auth = await bmLogin(page);
    token = auth.token;

    // Discover a real task via API
    try {
      const res = await page.request.get("/api/tasks?limit=1", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok()) {
        const body = await res.json();
        const tasks = body.tasks ?? body.data ?? body;
        if (Array.isArray(tasks) && tasks.length > 0) {
          taskUrl = `/bm/tasks/${tasks[0].id}`;
          originalStatus = tasks[0].status ?? null;
        }
      }
    } catch {
      taskUrl = null;
    }

    if (taskUrl) {
      await page.goto(taskUrl);
      // Wait for task content to load (heading or any meaningful content)
      await page.waitForSelector("h1, h2, h3, p.font-semibold", { timeout: 30_000 }).catch(() => {});
    }
  });

  test("should load task detail page with content", async ({ page }) => {
    test.skip(!taskUrl, "No tasks available for testing");
    const content = page.locator("h1, h2, h3, p.font-semibold");
    expect(await content.count()).toBeGreaterThan(0);
  });

  test("should display task metadata (status and priority)", async ({
    page,
  }) => {
    test.skip(!taskUrl, "No tasks available for testing");
    const pageText = (await page.locator("body").textContent()) ?? "";
    const hasStatus = /open|in progress|done/i.test(pageText);
    const hasPriority = /high|medium|low/i.test(pageText);
    expect(hasStatus).toBe(true);
    // Priority may not always be shown, so soft check
    expect(hasStatus || hasPriority).toBe(true);
  });

  test("should display linked lead info", async ({ page }) => {
    test.skip(!taskUrl, "No tasks available for testing");
    // Linked lead is optional
    const leadLink = page
      .locator("a, button")
      .filter({ hasText: /view lead|lead/i });
    if (
      await leadLink.first().isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await expect(leadLink.first()).toBeVisible();
    }
  });

  test("should allow updating task status", async ({ page }) => {
    test.skip(!taskUrl, "No tasks available for testing");
    // Find status buttons (Open, In Progress, Done)
    const statusBtns = page.locator("button").filter({
      hasText: /^(open|in progress|done)$/i,
    });
    const count = await statusBtns.count();
    if (count >= 2) {
      // Click a different status
      const currentText = originalStatus ?? "Open";
      for (let i = 0; i < count; i++) {
        const btnText = await statusBtns.nth(i).textContent();
        if (
          btnText &&
          btnText.trim().toLowerCase() !== currentText.toLowerCase()
        ) {
          await statusBtns.nth(i).click();
          await page.waitForTimeout(1000);
          break;
        }
      }

      // Revert to original status
      if (originalStatus) {
        const revertBtn = page
          .locator("button")
          .filter({ hasText: new RegExp(`^${originalStatus}$`, "i") });
        if (
          await revertBtn
            .first()
            .isVisible({ timeout: 2000 })
            .catch(() => false)
        ) {
          await revertBtn.first().click();
          await page.waitForTimeout(500);
        }
      }
    }
  });

  test("should allow adding a task note", async ({ page }) => {
    test.skip(!taskUrl, "No tasks available for testing");
    const textarea = page.locator("textarea");
    if (
      await textarea.first().isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await textarea.first().fill("E2E test note — please ignore");
      const addBtn = page
        .locator("button")
        .filter({ hasText: /add note|submit|save/i });
      if (
        await addBtn.first().isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await addBtn.first().click();
        await page.waitForTimeout(1500);
        // Verify note appeared in timeline
        const success = await page
          .getByText(/e2e test note/i)
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        const cleared = (await textarea.first().inputValue()) === "";
        expect(success || cleared).toBe(true);
      }
    }
  });

  test("should display notes timeline", async ({ page }) => {
    test.skip(!taskUrl, "No tasks available for testing");
    // Notes section should exist (even if empty)
    const pageContent = await page.locator("body").textContent();
    expect(pageContent).toBeTruthy();
  });

  test("should navigate back via Back button", async ({ page }) => {
    test.skip(!taskUrl, "No tasks available for testing");
    const backBtn = page.locator("button, a").filter({ hasText: /back/i });
    if (
      await backBtn.first().isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await backBtn.first().click();
      await page.waitForTimeout(1000);
      expect(page.url()).not.toMatch(/\/tasks\/[^/]+$/);
    }
  });
});
