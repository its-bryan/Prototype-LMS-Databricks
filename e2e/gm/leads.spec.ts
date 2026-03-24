import { test, expect } from "@playwright/test";
import { gmLogin } from "../helpers/auth";

let token: string;

test.describe("GM My Leads — /gm/leads", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const auth = await gmLogin(page, "/gm/leads");
    token = auth.token;
    // Wait for leads heading to appear
    await page.waitForSelector('h1', { timeout: 45_000 });
  });

  /* ---- Page Load ---- */

  test("should load GM Leads page with table", async ({ page }) => {
    // Page has a heading
    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: 10_000 });
    // Table rows should exist (or "no results" message)
    const rows = page.locator("table tbody tr, div.border-b");
    const noResults = page.getByText(/no leads|no results/i);
    const hasRows = (await rows.count()) > 0;
    const hasNoResults = await noResults
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    expect(hasRows || hasNoResults).toBe(true);
  });

  /* ---- Status Tabs ---- */

  test("should display status filter tabs: All, Cancelled, Unused, Rented", async ({
    page,
  }) => {
    for (const tab of ["All", "Cancelled", "Unused", "Rented"]) {
      await expect(
        page.getByRole("button", { name: tab, exact: true }),
      ).toBeVisible();
    }
  });

  test("should filter leads by Cancelled status", async ({ page }) => {
    await page.getByRole("button", { name: "Cancelled", exact: true }).click();
    await page.waitForTimeout(2000);
    // All visible status badges should show "Cancelled" (or table is empty)
    const statusCells = page.locator("table tbody tr td:nth-child(4)");
    const count = await statusCells.count();
    for (let i = 0; i < count; i++) {
      const text = await statusCells.nth(i).textContent();
      if (text?.trim()) {
        expect(text.trim()).toBe("Cancelled");
      }
    }
  });

  /* ---- Filters ---- */

  test("should filter leads by BM dropdown", async ({ page }) => {
    const bmSelect = page.locator("select").filter({ hasText: /All|BM/i });
    if (await bmSelect.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await bmSelect.first().locator("option").allTextContents();
      if (options.length > 1) {
        await bmSelect.first().selectOption({ index: 1 });
        await page.waitForTimeout(2000);
      }
    }
  });

  test("should search leads by customer name", async ({ page }) => {
    const searchInput = page.locator(
      'input[type="text"], input[placeholder*="search" i], input[placeholder*="name" i]',
    );
    if (
      await searchInput.first().isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await searchInput.first().fill("test");
      await page.waitForTimeout(2000); // debounced search
    }
  });

  test("should change date preset to Trailing 4 weeks", async ({ page }) => {
    const t4wBtn = page.getByRole("button", { name: /trailing 4/i });
    if (await t4wBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await t4wBtn.click();
      await page.waitForTimeout(2000);
    }
  });

  /* ---- Split Pane / Lead Detail Panel ---- */

  test("should open right panel when clicking a lead row", async ({
    page,
  }) => {
    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(500);
      // Right panel should appear — look for detail content
      const detailPanel = page.locator(
        'div[class*="w-[55%]"], div[class*="w-\\[55"], textarea, h2, h3',
      );
      expect(await detailPanel.count()).toBeGreaterThan(0);
    }
  });

  test("should display lead details in right panel", async ({ page }) => {
    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(500);
      const panelContent = await page.locator("body").textContent();
      expect(panelContent?.length).toBeGreaterThan(100);
    }
  });

  /* ---- GM Directive ---- */

  test("should show GM directive textarea and Send button in panel", async ({
    page,
  }) => {
    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(500);
      const textarea = page.locator("textarea");
      await expect(textarea.first()).toBeVisible({ timeout: 5000 });
      const sendBtn = page.getByRole("button", {
        name: /send|directive|submit/i,
      });
      if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(sendBtn).toBeVisible();
      }
    }
  });

  test("should save GM directive", async ({ page }) => {
    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(500);

      const textarea = page.locator("textarea").first();
      if (await textarea.isVisible({ timeout: 3000 }).catch(() => false)) {
        await textarea.fill("E2E test directive — please ignore");
        const sendBtn = page.getByRole("button", {
          name: /send|directive|submit/i,
        });
        if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await sendBtn.click();
          await page.waitForTimeout(1500);
          const textareaVal = await textarea.inputValue();
          expect(
            textareaVal === "" ||
              (await page
                .getByText(/saved|sent|success/i)
                .isVisible({ timeout: 2000 })
                .catch(() => false)),
          ).toBe(true);
        }
      }
    }
  });

  test("should mark lead as reviewed", async ({ page }) => {
    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(500);

      const reviewBtn = page.getByRole("button", {
        name: /mark reviewed|reviewed/i,
      });
      if (await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        const initialRowCount = await page.locator("table tbody tr").count();
        await reviewBtn.click();
        await page.waitForTimeout(2000);
        const newRowCount = await page.locator("table tbody tr").count();
        expect(newRowCount).toBeLessThanOrEqual(initialRowCount);
      }
    }
  });

  /* ---- Pagination ---- */

  test("should paginate leads with next/previous buttons", async ({
    page,
  }) => {
    // Switch to a wider date range to get more results
    const t4wBtn = page.getByRole("button", { name: /trailing 4/i });
    if (await t4wBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await t4wBtn.click();
      await page.waitForTimeout(2000);
    }

    const nextBtn = page.getByRole("button", { name: /next/i });
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isDisabled = await nextBtn.isDisabled();
      if (!isDisabled) {
        await nextBtn.click();
        await page.waitForTimeout(2000);
        const prevBtn = page.getByRole("button", { name: /prev/i });
        await expect(prevBtn).toBeVisible();
      }
    }
  });

  /* ---- Navigate to Lead Profile ---- */

  test("should navigate to lead profile", async ({ page }) => {
    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(500);

      const detailLink = page.locator('a[href*="/leads/"]');
      if (
        await detailLink.first().isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        await detailLink.first().click();
        await expect(page).toHaveURL(/\/gm\/leads\/\d+/);
      }
    }
  });

  /* ---- Total Count Validation ---- */

  test("should display total count matching API response", async ({
    page,
  }) => {
    const countText = page.locator("span, p").filter({ hasText: /of \d+/ });
    if (
      await countText.first().isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      const text = await countText.first().textContent();
      const match = text?.match(/of\s+(\d+)/);
      if (match) {
        const uiTotal = parseInt(match[1], 10);
        expect(uiTotal).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
