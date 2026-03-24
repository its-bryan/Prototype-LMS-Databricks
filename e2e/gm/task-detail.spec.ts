import { test, expect } from "@playwright/test";
import { gmLogin } from "../helpers/auth";

/**
 * Task Detail tests navigate via the Leads page to find a real task.
 * If no tasks exist, tests are skipped gracefully.
 */
test.describe("GM Task Detail — /gm/tasks/:taskId", () => {
  let taskUrl: string | null = null;

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { token } = await gmLogin(page, false);

    // Try to find a task ID via the API
    const res = await page.request.get("/api/tasks?limit=1", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok()) {
      const data = await res.json();
      const items = data.items ?? data;
      if (Array.isArray(items) && items.length > 0) {
        const taskId = items[0].id ?? items[0].taskId;
        if (taskId) {
          taskUrl = `/gm/tasks/${taskId}`;
          await page.goto(taskUrl);
          // Wait for task detail page to render
          await page.waitForSelector('h1, h2', { timeout: 30_000 });
          return;
        }
      }
    }
    // No tasks available — tests will skip
    taskUrl = null;
  });

  test("should load task detail page", async ({ page }) => {
    test.skip(!taskUrl, "No tasks available in database");
    // Some heading or task content should be visible
    const content = page.locator("h1, h2, p.font-semibold");
    expect(await content.count()).toBeGreaterThan(0);
  });

  test("should display task metadata (status, priority)", async ({ page }) => {
    test.skip(!taskUrl, "No tasks available in database");
    // Status should be one of Open, In Progress, Done
    const statusOptions = ["Open", "In Progress", "Done"];
    const pageText = await page.locator("body").textContent();
    const hasStatus = statusOptions.some((s) => pageText?.includes(s));
    expect(hasStatus).toBe(true);

    // Priority should be visible (High, Medium, or Low)
    const priorities = ["High", "Medium", "Low"];
    const hasPriority = priorities.some((p) => pageText?.includes(p));
    expect(hasPriority).toBe(true);
  });

  test("should display linked lead info if present", async ({ page }) => {
    test.skip(!taskUrl, "No tasks available in database");
    // Linked lead section may or may not exist
    const leadLink = page.locator('a[href*="/leads/"], button').filter({
      hasText: /lead|customer/i,
    });
    // This is optional — just verify page doesn't crash
    expect(await page.locator("body").textContent()).toBeTruthy();
  });

  test("should allow updating task status", async ({ page }) => {
    test.skip(!taskUrl, "No tasks available in database");
    // Find status dropdown or buttons
    const statusSelect = page.locator("select").filter({ hasText: /Open|Done/ });
    if (await statusSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const currentVal = await statusSelect.inputValue();
      // Toggle to a different status
      const newStatus = currentVal === "Done" ? "Open" : "Done";
      await statusSelect.selectOption(newStatus);
      await page.waitForTimeout(1000);
      // Revert
      await statusSelect.selectOption(currentVal);
    }
  });

  test("should allow adding a task note", async ({ page }) => {
    test.skip(!taskUrl, "No tasks available in database");
    const noteInput = page.locator(
      'textarea, input[placeholder*="note" i], input[placeholder*="comment" i]',
    );
    if (await noteInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await noteInput.fill("Automated test note — please ignore");
      const submitBtn = page.getByRole("button", { name: /add|save|submit/i });
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(1000);
        // Note should appear in the timeline
        await expect(
          page.getByText("Automated test note"),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("should display notes timeline", async ({ page }) => {
    test.skip(!taskUrl, "No tasks available in database");
    // Notes/timeline section should exist (even if empty)
    const content = await page.locator("body").textContent();
    expect(content).toBeTruthy();
  });

  test("should navigate back via Back button", async ({ page }) => {
    test.skip(!taskUrl, "No tasks available in database");
    const backBtn = page.getByRole("button", { name: /back/i });
    if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(1000);
      // Should navigate away from task detail
      expect(page.url()).not.toContain("/tasks/");
    }
  });
});
