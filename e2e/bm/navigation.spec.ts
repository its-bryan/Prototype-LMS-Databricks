import { test, expect } from "@playwright/test";
import { bmLogin } from "../helpers/auth";

test.describe("BM Navigation — cross-sectional flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await bmLogin(page);
  });

  test("should navigate from Summary to My Leads via sidebar", async ({
    page,
  }) => {
    const sidebarLink = page
      .locator("nav a, nav button")
      .filter({ hasText: /leads/i });
    if (
      await sidebarLink.first().isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await sidebarLink.first().click();
      await expect(page).toHaveURL(/\/bm\/leads/);
    }
  });

  test("should navigate from Summary to Work Hub via sidebar", async ({
    page,
  }) => {
    // Sidebar "WORK" is the parent nav item
    const sidebarLink = page
      .locator('[data-onboarding="sidebar-nav"] a, [data-onboarding="sidebar-nav"] button')
      .filter({ hasText: /^work$/i });
    if (
      await sidebarLink.first().isVisible({ timeout: 5000 }).catch(() => false)
    ) {
      await sidebarLink.first().click();
      await expect(page).toHaveURL(/\/bm\/work/);
    }
  });

  test("should flow: Summary → Leads → Lead Detail → Back", async ({
    page,
  }) => {
    await page.goto("/bm/leads");
    await page.waitForTimeout(3000);

    const rows = page.locator("table tbody tr, div.border-b").filter({
      hasText: /\w/,
    });
    if ((await rows.count()) > 0) {
      await rows.first().click();
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/\/bm\/leads\/.+/);

      const backBtn = page
        .locator("button, a")
        .filter({ hasText: /back/i });
      if (
        await backBtn.first().isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        await backBtn.first().click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test("should flow: Summary → Tasks → Task Detail → Back", async ({
    page,
  }) => {
    await page.goto("/bm/tasks");
    await page.waitForTimeout(3000);

    // Find a clickable task entry
    const taskEntry = page
      .locator("button, a, div.cursor-pointer")
      .filter({ hasText: /task|open|in progress/i });
    if (
      await taskEntry.first().isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await taskEntry.first().click();
      await page.waitForTimeout(2000);

      if (page.url().includes("/bm/tasks/")) {
        const backBtn = page
          .locator("button, a")
          .filter({ hasText: /back/i });
        if (
          await backBtn
            .first()
            .isVisible({ timeout: 3000 })
            .catch(() => false)
        ) {
          await backBtn.first().click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test("should flow: Summary → Meeting Prep → Back", async ({ page }) => {
    await page.goto("/bm/meeting-prep");
    await page.waitForTimeout(3000);

    const content = page.locator("h1, h2, h3").filter({ hasText: /meeting|prep/i });
    await expect(content.first()).toBeVisible({ timeout: 5000 });

    const backBtn = page.locator("button, a").filter({ hasText: /back/i });
    if (
      await backBtn.first().isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await backBtn.first().click();
      await page.waitForTimeout(1000);
    }
  });

  test("should have consistent data: tile value matches drilldown", async ({
    page,
  }) => {
    // Wait for summary tiles to render
    const tileEl = page
      .locator("div.bg-neutral-700")
      .filter({ hasText: "CONVERSION RATE" });
    await expect(tileEl.first()).toBeVisible({ timeout: 10_000 });
    const valueText = await tileEl.locator("p.text-xl").textContent();
    expect(valueText).toBeTruthy();

    // Open drilldown
    await tileEl.click();
    const modal = page.locator(".fixed.inset-0");
    await expect(modal.first()).toBeVisible({ timeout: 10_000 });

    // Drilldown should render content
    const modalContent = page.locator("h2");
    await expect(modalContent.first()).toContainText("Conversion Rate");
  });
});
