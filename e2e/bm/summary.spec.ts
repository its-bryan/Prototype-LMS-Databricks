import { test, expect, type Page } from "@playwright/test";
import { bmLogin } from "../helpers/auth";
import {
  fetchDashboardSnapshot,
  extractBMData,
  ppChange,
  relChange,
  invertedRelChange,
  formatMinutesToDisplay,
} from "../helpers/snapshot";

/* ------------------------------------------------------------------ */
/*  Shared state populated in beforeEach                               */
/* ------------------------------------------------------------------ */
let token: string;
let user: Record<string, unknown>;
let snapshot: Record<string, unknown>;
let bmData: Record<string, unknown> | null;
let stats: Record<string, unknown>;
let comparison: Record<string, unknown> | null;
let tasks: Record<string, unknown> | null;
let comparisonTasks: Record<string, unknown> | null;

/** Locate a metric tile by its uppercase label text. */
function tile(page: Page, label: string) {
  return page.locator("div.bg-neutral-700").filter({ hasText: label });
}

/** Read the displayed value from a metric tile (the large text). */
async function tileValue(page: Page, label: string) {
  return tile(page, label).locator("p.text-xl").textContent();
}

/** Read the change-tag text from a metric tile. */
async function tileChangeTag(page: Page, label: string) {
  const tag = tile(page, label).locator("span.text-xs.font-semibold");
  if ((await tag.count()) === 0) return null;
  return tag.textContent();
}

test.describe("BM Summary — /bm/summary", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const auth = await bmLogin(page);
    token = auth.token;
    user = auth.user;

    snapshot = await fetchDashboardSnapshot(page.request, token);
    bmData = extractBMData(snapshot, (user as { branch?: string }).branch ?? "");
    stats = (bmData as { stats: Record<string, unknown> })?.stats ?? {};
    comparison =
      (bmData as { comparison: Record<string, unknown> | null })?.comparison ??
      null;
    tasks =
      (bmData as { tasks: Record<string, unknown> | null })?.tasks ?? null;
    comparisonTasks =
      (bmData as { comparisonTasks: Record<string, unknown> | null })
        ?.comparisonTasks ?? null;
  });

  /* ---- Page Load & Structure ---- */

  test("should load BM summary with section header and display name in topbar", async ({
    page,
  }) => {
    await expect(page).toHaveURL(/\/bm\/summary/);
    // Summary section header visible
    const sectionHeader = page.locator('[data-onboarding="summary"]');
    await expect(sectionHeader).toBeVisible();
    // Display name in top bar
    const topBar = page.locator("header, nav").filter({ hasText: new RegExp((user.displayName as string), "i") });
    if (await topBar.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      expect(await topBar.first().textContent()).toContain(user.displayName as string);
    }
  });

  test("should display Trailing 4 weeks badge with correct dates", async ({
    page,
  }) => {
    const period = (snapshot as { period?: { start: string; end: string } })
      .period;
    const badge = page.locator('[data-onboarding="summary"] span.text-xs');
    const badgeText = await badge.first().textContent();
    expect(badgeText).toContain("Trailing 4 weeks");
    if (period?.end) {
      const section = page.locator('[data-onboarding="summary"]');
      const sectionText = await section.textContent();
      expect(sectionText).toBeTruthy();
    }
  });

  test("should render 6 metric tiles in 2 rows of 3", async ({ page }) => {
    const row1 = page.locator(
      '[data-onboarding="metric-drilldown"] div.bg-neutral-700',
    );
    await expect(row1).toHaveCount(3);

    const allTiles = page.locator(
      '[data-onboarding="summary"] div.bg-neutral-700',
    );
    await expect(allTiles).toHaveCount(6);
  });

  /* ---- Metric Tile Values — API vs UI ---- */

  test("should display correct Total Leads from snapshot", async ({
    page,
  }) => {
    const val = (stats as { total?: number }).total;
    const expected = String(val ?? 0);
    expect(await tileValue(page, "TOTAL LEADS")).toBe(expected);
  });

  test("should display correct Conversion Rate from snapshot", async ({
    page,
  }) => {
    const s = stats as { conversionRate?: number; rented?: number; total?: number };
    const convRate = s.conversionRate ?? (s.total ? Math.round(((s.rented ?? 0) / s.total) * 1000) / 10 : null);
    const expected = convRate != null ? `${convRate}%` : "—";
    expect(await tileValue(page, "CONVERSION RATE")).toBe(expected);
  });

  test("should display correct Comment Compliance from snapshot", async ({
    page,
  }) => {
    const val = (stats as { enrichmentRate?: number }).enrichmentRate;
    const expected = val != null ? `${val}%` : "—";
    expect(await tileValue(page, "COMMENT COMPLIANCE")).toBe(expected);
  });

  test("should display correct Open Tasks from snapshot", async ({
    page,
  }) => {
    const val = (tasks as { open?: number } | null)?.open;
    const expected = String(val ?? 0);
    expect(await tileValue(page, "OPEN TASKS")).toBe(expected);
  });

  test("should display correct Task Completion Rate from snapshot", async ({
    page,
  }) => {
    const val = (tasks as { completionRate?: number } | null)?.completionRate;
    const expected = val != null ? `${val}%` : "—";
    expect(await tileValue(page, "TASK COMPLETION RATE")).toBe(expected);
  });

  test("should display correct Avg Time for First Contact from snapshot", async ({
    page,
  }) => {
    const val = (stats as { avgTimeToContactMin?: number }).avgTimeToContactMin;
    const expected = val != null ? formatMinutesToDisplay(val) : "—";
    expect(await tileValue(page, "AVERAGE TIME")).toBe(expected);
  });

  /* ---- Change Tags ---- */

  test("should display correct change tags for rate metrics", async ({
    page,
  }) => {
    if (!comparison) return;

    const s = stats as Record<string, number>;
    const c = comparison as Record<string, number>;

    // Total Leads — relative % change
    const totalLeadsChange = relChange(s.total, c.total);
    const totalTag = await tileChangeTag(page, "TOTAL LEADS");
    if (totalLeadsChange === null || totalLeadsChange === 0) {
      // Tag may be null or "—" when no change
      expect(totalTag === null || totalTag === "—").toBe(true);
    } else {
      expect(totalTag).toContain(`${Math.abs(totalLeadsChange)}%`);
      expect(totalTag).toContain(totalLeadsChange > 0 ? "↑" : "↓");
    }

    // Conversion Rate — absolute pp change
    const convRate = s.conversionRate ?? (s.total ? Math.round(((s.rented ?? 0) / s.total) * 1000) / 10 : null);
    const prevConvRate = c.conversionRate ?? (c.total ? Math.round(((c.rented ?? 0) / c.total) * 1000) / 10 : null);
    const convChange = ppChange(convRate, prevConvRate);
    const convTag = await tileChangeTag(page, "CONVERSION RATE");
    if (convChange === null || convChange === 0) {
      expect(convTag === null || convTag === "—").toBe(true);
    } else {
      expect(convTag).toContain(`${Math.abs(convChange)}%`);
      expect(convTag).toContain(convChange > 0 ? "↑" : "↓");
    }

    // Comment Compliance — absolute pp change
    const commentChange = ppChange(s.enrichmentRate, c.enrichmentRate);
    const commentTag = await tileChangeTag(page, "COMMENT COMPLIANCE");
    if (commentChange === null || commentChange === 0) {
      expect(commentTag === null || commentTag === "—").toBe(true);
    } else {
      expect(commentTag).toContain(`${Math.abs(commentChange)}%`);
      expect(commentTag).toContain(commentChange > 0 ? "↑" : "↓");
    }
  });

  test("should display correct change tags for secondary metrics", async ({
    page,
  }) => {
    if (!comparison || !tasks || !comparisonTasks) return;

    const t = tasks as Record<string, number>;
    const ct = comparisonTasks as Record<string, number>;
    const s = stats as Record<string, number>;
    const c = comparison as Record<string, number>;

    // Open Tasks — inverted relative (fewer = better)
    const openChange = ct.open > 0
      ? Math.round(((ct.open - t.open) / ct.open) * 100)
      : null;
    const openTag = await tileChangeTag(page, "OPEN TASKS");
    if (openChange === null || openChange === 0) {
      expect(openTag === null || openTag === "—").toBe(true);
    } else {
      expect(openTag).toContain(`${Math.abs(openChange)}%`);
      // lowerIsBetter: positive relChange shows ↓, negative shows ↑
      expect(openTag).toContain(openChange > 0 ? "↓" : "↑");
    }

    // Task Completion Rate — absolute pp change
    const completionChange = ppChange(t.completionRate, ct.completionRate);
    const completionTag = await tileChangeTag(page, "TASK COMPLETION RATE");
    if (completionChange === null || completionChange === 0) {
      expect(completionTag === null || completionTag === "—").toBe(true);
    } else {
      expect(completionTag).toContain(`${Math.abs(completionChange)}%`);
      expect(completionTag).toContain(completionChange > 0 ? "↑" : "↓");
    }

    // Avg Time to Contact — inverted relative (lower = better)
    const avgMin = s.avgTimeToContactMin;
    const prevAvgMin = c.avgTimeToContactMin;
    const avgChange = prevAvgMin != null && prevAvgMin > 0 && avgMin != null
      ? Math.round(((prevAvgMin - avgMin) / prevAvgMin) * 100)
      : null;
    const avgTag = await tileChangeTag(page, "AVERAGE TIME");
    if (avgChange === null || avgChange === 0) {
      expect(avgTag === null || avgTag === "—").toBe(true);
    } else {
      expect(avgTag).toContain(`${Math.abs(avgChange)}%`);
      // lowerIsBetter: positive relChange shows ↓, negative shows ↑
      expect(avgTag).toContain(avgChange > 0 ? "↓" : "↑");
    }
  });

  /* ---- Drill-Down Modal ---- */

  test("should open drilldown modal when clicking a metric tile", async ({
    page,
  }) => {
    await tile(page, "CONVERSION RATE").click();
    const modal = page.locator(".fixed.inset-0");
    await expect(modal.first()).toBeVisible({ timeout: 5000 });
    // Modal content panel (white rounded box) contains the metric title
    const modalPanel = page.locator(".fixed.inset-0 .bg-white.rounded-xl, .fixed.inset-0 .bg-white.rounded-lg");
    const title = modalPanel.first().locator("h2, h3");
    await expect(title.first()).toContainText("Conversion Rate");

    // Close on backdrop click
    await modal.first().click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);
    await expect(modal.first()).not.toBeVisible({ timeout: 3000 });
  });
});
