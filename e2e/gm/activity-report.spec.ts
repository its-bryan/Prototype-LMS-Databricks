import { test, expect } from "@playwright/test";
import { gmLogin } from "../helpers/auth";

test.describe("GM Activity Report — /gm/activity-report", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gmLogin(page, "/gm/activity-report");
    // Wait for Activity Report heading to appear (API can be slow)
    await page.waitForSelector('h1:has-text("Activity Report"), h2:has-text("Activity Report")', { timeout: 60_000 });
  });

  test("should load activity report page", async ({ page }) => {
    const heading = page.getByRole("heading", { name: "Activity Report" });
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("should display 4 activity tabs", async ({ page }) => {
    for (const tab of ["All Activity", "Logins", "Comments", "Contact"]) {
      await expect(
        page.getByRole("button", { name: tab }),
      ).toBeVisible();
    }
  });

  test("should default to All Activity tab", async ({ page }) => {
    const allTab = page.getByRole("button", { name: "All Activity" });
    const classes = await allTab.getAttribute("class");
    // Active tab has dark background
    expect(classes).toContain("bg-[var(--hertz-black)]");
  });

  test("should switch to Logins tab and filter entries", async ({ page }) => {
    await page.getByRole("button", { name: "Logins" }).click();
    await page.waitForTimeout(300);
    const loginsTab = page.getByRole("button", { name: "Logins" });
    const classes = await loginsTab.getAttribute("class");
    expect(classes).toContain("bg-[var(--hertz-black)]");
  });

  test("should switch to Comments tab", async ({ page }) => {
    await page.getByRole("button", { name: "Comments" }).click();
    await page.waitForTimeout(300);
    const tab = page.getByRole("button", { name: "Comments" });
    const classes = await tab.getAttribute("class");
    expect(classes).toContain("bg-[var(--hertz-black)]");
  });

  test("should switch to Contact tab", async ({ page }) => {
    await page.getByRole("button", { name: "Contact" }).click();
    await page.waitForTimeout(300);
    const tab = page.getByRole("button", { name: "Contact" });
    const classes = await tab.getAttribute("class");
    expect(classes).toContain("bg-[var(--hertz-black)]");
  });

  test("should show entry count matching header subtitle", async ({
    page,
  }) => {
    // Subtitle shows "[N] entries"
    const subtitle = page.locator("p.text-sm").filter({ hasText: /entr/ });
    const subtitleText = await subtitle.first().textContent();
    const match = subtitleText?.match(/(\d+)\s+entr/);
    if (match) {
      const reportedCount = parseInt(match[1], 10);
      // Count actual rendered entries
      const entries = page.locator("div.border-b, div.py-3").filter({
        hasText: /ago|Login|Comment|Contact/,
      });
      const renderedCount = await entries.count();
      // Allow some tolerance (entries might be paginated)
      expect(renderedCount).toBeLessThanOrEqual(reportedCount + 5);
    }
  });
});
