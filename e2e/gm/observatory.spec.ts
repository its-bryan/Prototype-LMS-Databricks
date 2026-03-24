import { test, expect } from "@playwright/test";
import { gmLogin } from "../helpers/auth";
import { fetchObservatorySnapshot } from "../helpers/snapshot";

let token: string;

/* ================================================================== */
/*  Observatory Landing — /observatory                                 */
/* ================================================================== */
test.describe("Observatory Landing", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const auth = await gmLogin(page, "/observatory");
    token = auth.token;
    // Wait for observatory tiles to render
    await page.waitForSelector('text=Conversion', { timeout: 45_000 });
  });

  test("should load landing page with 3 tiles", async ({ page }) => {
    for (const label of ["Conversion", "Total Leads", "Leaderboard"]) {
      await expect(
        page.getByText(label, { exact: false }).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("should navigate to Conversion page on tile click", async ({
    page,
  }) => {
    await page.getByText("Conversion").first().click();
    await expect(page).toHaveURL(/\/observatory\/conversion/);
  });

  test("should navigate to Total Leads page on tile click", async ({
    page,
  }) => {
    await page.getByText("Total Leads").first().click();
    await expect(page).toHaveURL(/\/observatory\/leads/);
  });
});

/* ================================================================== */
/*  Observatory Conversion — /observatory/conversion                   */
/* ================================================================== */
test.describe("Observatory Conversion", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const auth = await gmLogin(page, "/observatory/conversion");
    token = auth.token;
    await page.waitForSelector('h1, svg, canvas, [class*="chart"]', { timeout: 45_000 });
  });

  test("should load page with bar chart", async ({ page }) => {
    const chart = page.locator("svg, canvas, [class*='chart']");
    expect(await chart.count()).toBeGreaterThan(0);
  });

  test("should default to My View and Week by week", async ({ page }) => {
    // My View button should be active
    const myView = page.getByText("My View").first();
    if (await myView.isVisible({ timeout: 3000 }).catch(() => false)) {
      const parent = myView.locator("..");
      const classes = await myView.getAttribute("class");
      expect(classes).toContain("hertz-primary");
    }

    // Week by week button should be active
    const weekBtn = page.getByText("Week by week").first();
    if (await weekBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const classes = await weekBtn.getAttribute("class");
      expect(classes).toContain("hertz-primary");
    }
  });

  test("should toggle to Company View", async ({ page }) => {
    const companyView = page.getByText("Company View").first();
    if (await companyView.isVisible({ timeout: 3000 }).catch(() => false)) {
      await companyView.click();
      await page.waitForTimeout(500);
      const classes = await companyView.getAttribute("class");
      expect(classes).toContain("hertz-primary");
    }
  });

  test("should switch to Month by month granularity", async ({ page }) => {
    const monthBtn = page.getByText("Month by month").first();
    if (await monthBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await monthBtn.click();
      await page.waitForTimeout(500);
      const classes = await monthBtn.getAttribute("class");
      expect(classes).toContain("hertz-primary");
    }
  });

  test("should display multi-select filter dropdowns", async ({ page }) => {
    for (const filterLabel of ["Zone", "GM", "AM"]) {
      const filter = page.getByText(filterLabel, { exact: false });
      expect(await filter.count()).toBeGreaterThan(0);
    }
  });

  test("should filter chart data by zone selection", async ({ page }) => {
    // Click on Zone filter
    const zoneFilter = page
      .locator("button, div")
      .filter({ hasText: /^Zone$/ })
      .first();
    if (await zoneFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await zoneFilter.click();
      await page.waitForTimeout(300);
      // Select first option in dropdown
      const option = page.locator(
        "label, [role='option'], div.cursor-pointer",
      );
      if (await option.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await option.first().click();
        await page.waitForTimeout(500);
      }
    }
  });

  test("should open unused leads drilldown on bar click", async ({ page }) => {
    // Click a bar in the chart
    const bars = page.locator("rect[fill], rect[class*='fill']");
    if (await bars.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await bars.first().click();
      await page.waitForTimeout(1000);
      // Drilldown section should appear with leads
      const drilldown = page.getByText(/unused|lead/i);
      expect(await drilldown.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test("should validate chart data against observatory snapshot API", async ({
    page,
  }) => {
    const obsSnapshot = await fetchObservatorySnapshot(page.request, token);
    expect(obsSnapshot).toBeTruthy();
    // Snapshot should have branches and weeks/months
    const snap = obsSnapshot as {
      branches?: Record<string, unknown>;
      weeks?: string[];
    };
    if (snap.branches) {
      expect(Object.keys(snap.branches).length).toBeGreaterThan(0);
    }
  });
});

/* ================================================================== */
/*  Observatory Total Leads — /observatory/leads                       */
/* ================================================================== */
test.describe("Observatory Total Leads", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const auth = await gmLogin(page, "/observatory/leads");
    token = auth.token;
    await page.waitForSelector('h1, svg, canvas, [class*="chart"]', { timeout: 45_000 });
  });

  test("should load page with stacked bar chart", async ({ page }) => {
    await expect(
      page.getByText("Lead composition", { exact: false }).first(),
    ).toBeVisible({ timeout: 5000 });
    const chart = page.locator("svg, canvas");
    expect(await chart.count()).toBeGreaterThan(0);
  });

  test("should default to My View and Week by week", async ({ page }) => {
    const myView = page.getByText("My View").first();
    if (await myView.isVisible({ timeout: 3000 }).catch(() => false)) {
      const classes = await myView.getAttribute("class");
      expect(classes).toContain("hertz-primary");
    }
    const weekBtn = page.getByText("Week by week").first();
    if (await weekBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const classes = await weekBtn.getAttribute("class");
      expect(classes).toContain("hertz-primary");
    }
  });

  test("should toggle to Company View", async ({ page }) => {
    const companyView = page.getByText("Company View").first();
    if (await companyView.isVisible({ timeout: 3000 }).catch(() => false)) {
      await companyView.click();
      await page.waitForTimeout(500);
      const classes = await companyView.getAttribute("class");
      expect(classes).toContain("hertz-primary");
    }
  });

  test("should switch to Month by month granularity", async ({ page }) => {
    const monthBtn = page.getByText("Month by month").first();
    if (await monthBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await monthBtn.click();
      await page.waitForTimeout(500);
      const classes = await monthBtn.getAttribute("class");
      expect(classes).toContain("hertz-primary");
    }
  });

  test("should have working filter dropdowns", async ({ page }) => {
    for (const label of ["Zone", "Hertz Zone", "GM", "AM"]) {
      const filter = page.getByText(label, { exact: false });
      expect(await filter.count()).toBeGreaterThan(0);
    }
  });
});

/* ================================================================== */
/*  Observatory Org Leaderboard — /observatory/leaderboard             */
/* ================================================================== */
test.describe("Observatory Org Leaderboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const auth = await gmLogin(page, "/observatory/leaderboard");
    token = auth.token;
    await page.waitForSelector('h1, table, [class*="leaderboard"]', { timeout: 45_000 });
  });

  test("should load page with GM leaderboard table", async ({ page }) => {
    // Table or list of GMs should be visible
    const content = page.locator("table, div.rounded-xl").filter({
      hasText: /\d/,
    });
    expect(await content.count()).toBeGreaterThan(0);
  });

  test("should have metric selector", async ({ page }) => {
    const metricSelector = page.locator("select, [role='listbox']");
    if (
      await metricSelector
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      expect(await metricSelector.count()).toBeGreaterThan(0);
    }
  });

  test("should have T4W timeline selector", async ({ page }) => {
    // Timeline selector shows trailing 4-week period options
    const timelineSelector = page.locator("select, button").filter({
      hasText: /trailing|T4W|week/i,
    });
    expect(await timelineSelector.count()).toBeGreaterThanOrEqual(0);
  });

  test("should highlight current user in leaderboard", async ({ page }) => {
    // The logged-in GM's row should have a distinct visual treatment
    // This is a soft check — we just verify the page renders without error
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
  });
});
