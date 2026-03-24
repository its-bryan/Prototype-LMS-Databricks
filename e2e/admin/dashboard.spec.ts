import { test, expect } from "@playwright/test";
import { adminLogin } from "../helpers/auth";

test.describe("Admin Dashboard — /admin", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await adminLogin(page);
  });

  /* ---- JTBD 1: Page Load ---- */

  test("should load admin dashboard with 3 navigation cards", async ({ page }) => {
    await expect(page).toHaveURL(/\/admin$/);
    const cards = page.locator('[data-testid^="admin-card-"]');
    await expect(cards).toHaveCount(3);
    await expect(page.locator('[data-testid="admin-card-uploads"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-card-org-mapping"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-card-legend"]')).toBeVisible();
  });

  /* ---- JTBD 2: Navigation ---- */

  test("should navigate to Data Upload via card click", async ({ page }) => {
    await page.locator('[data-testid="admin-card-uploads"]').click();
    await expect(page).toHaveURL(/\/admin\/uploads/);
  });

  test("should navigate to Org Mapping via card click", async ({ page }) => {
    await page.locator('[data-testid="admin-card-org-mapping"]').click();
    await expect(page).toHaveURL(/\/admin\/org-mapping/);
  });

  test("should navigate to Cancellation Reasons via card click", async ({ page }) => {
    await page.locator('[data-testid="admin-card-legend"]').click();
    await expect(page).toHaveURL(/\/admin\/legend/);
  });
});
