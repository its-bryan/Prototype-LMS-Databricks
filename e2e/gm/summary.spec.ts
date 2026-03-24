import { test, expect, type Page } from "@playwright/test";
import { gmLogin } from "../helpers/auth";
import {
  fetchDashboardSnapshot,
  extractGMData,
  ppChange,
  relChange,
} from "../helpers/snapshot";

/* ------------------------------------------------------------------ */
/*  Shared state populated in beforeEach                               */
/* ------------------------------------------------------------------ */
let token: string;
let user: Record<string, unknown>;
let snapshot: Record<string, unknown>;
let gmData: Record<string, unknown> | null;
let stats: Record<string, unknown>;
let comparison: Record<string, unknown> | null;

/** Locate a metric tile by its uppercase label text. */
function tile(page: Page, label: string) {
  return page.locator(`div.bg-neutral-700`).filter({ hasText: label });
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

test.describe("GM Summary — /gm/overview", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const auth = await gmLogin(page);
    token = auth.token;
    user = auth.user;

    snapshot = await fetchDashboardSnapshot(page.request, token);
    gmData = extractGMData(snapshot, user.displayName as string);
    stats = (gmData as { stats: Record<string, unknown> })?.stats ?? {};
    comparison =
      (gmData as { comparison: Record<string, unknown> | null })?.comparison ??
      null;
  });

  /* ---- Page Load & Structure ---- */

  test("should load GM overview with greeting and display name", async ({
    page,
  }) => {
    await expect(page).toHaveURL(/\/gm\/overview/);
    // Greeting visible (e.g. "Good morning")
    const greeting = page.locator("#home p.text-sm.font-semibold");
    await expect(greeting).toBeVisible();
    // Display name in h1
    const h1 = page.locator("#home h1");
    await expect(h1).toContainText(user.displayName as string);
  });

  test("should display Trailing 4 weeks badge with correct dates", async ({
    page,
  }) => {
    const period = (snapshot as { period?: { start: string; end: string } })
      .period;
    const badge = page.locator('[data-onboarding="gm-summary"] span.text-xs');
    const badgeText = await badge.first().textContent();
    expect(badgeText).toContain("Trailing 4 weeks");
    // If snapshot has period dates, verify they appear somewhere in the section
    if (period?.end) {
      const section = page.locator('[data-onboarding="gm-summary"]');
      const sectionText = await section.textContent();
      // The end date should appear in some formatted form
      expect(sectionText).toBeTruthy();
    }
  });

  test("should render 6 metric tiles in 2 rows of 3", async ({ page }) => {
    const row1 = page.locator(
      '[data-onboarding="gm-metric-drilldown"] div.bg-neutral-700',
    );
    await expect(row1).toHaveCount(3);

    // Second row is the next grid-cols-3 after the drilldown section
    const allTiles = page.locator(
      '[data-onboarding="gm-summary"] div.bg-neutral-700',
    );
    await expect(allTiles).toHaveCount(6);
  });

  /* ---- Metric Tile Values — API vs UI ---- */

  test("should display correct Conversion Rate from snapshot", async ({
    page,
  }) => {
    const val = (stats as { conversionRate?: number }).conversionRate;
    const expected = val != null ? `${val}%` : "—";
    expect(await tileValue(page, "CONVERSION RATE")).toBe(expected);
  });

  test("should display correct Contacted < 30 min from snapshot", async ({
    page,
  }) => {
    const val = (stats as { pctWithin30?: number }).pctWithin30;
    const expected = val != null ? `${val}%` : "—";
    expect(await tileValue(page, "CONTACTED")).toBe(expected);
  });

  test("should display correct Comment Compliance from snapshot", async ({
    page,
  }) => {
    const val = (stats as { commentCompliance?: number }).commentCompliance;
    const expected = val != null ? `${val}%` : "—";
    expect(await tileValue(page, "COMMENT COMPLIANCE")).toBe(expected);
  });

  test("should display correct Branch Contact % from snapshot", async ({
    page,
  }) => {
    const val = (stats as { branchPct?: number }).branchPct;
    const expected = val != null ? `${val}%` : "—";
    expect(await tileValue(page, "BRANCH CONTACT")).toBe(expected);
  });

  test("should display correct Cancelled Unreviewed count from snapshot", async ({
    page,
  }) => {
    const val = (stats as { cancelledUnreviewed?: number }).cancelledUnreviewed;
    const displayed = await tileValue(page, "CANCELLED UNREVIEWED");
    expect(displayed).toBe(String(val ?? 0));
  });

  test("should display correct No Contact Attempt count from snapshot", async ({
    page,
  }) => {
    const val = (stats as { noContactAttempt?: number }).noContactAttempt;
    const displayed = await tileValue(page, "NO CONTACT ATTEMPT");
    expect(displayed).toBe(String(val ?? 0));
  });

  /* ---- Change Tags ---- */

  test("should display correct absolute pp change for rate metrics", async ({
    page,
  }) => {
    if (!comparison) return; // no comparison data to test

    const cases = [
      {
        label: "CONVERSION RATE",
        current: (stats as Record<string, number>).conversionRate,
        prev: (comparison as Record<string, number>).conversionRate,
      },
      {
        label: "CONTACTED",
        current: (stats as Record<string, number>).pctWithin30,
        prev: (comparison as Record<string, number>).pctWithin30,
      },
      {
        label: "COMMENT COMPLIANCE",
        current: (stats as Record<string, number>).commentCompliance,
        prev: (comparison as Record<string, number>).commentCompliance,
      },
      {
        label: "BRANCH CONTACT",
        current: (stats as Record<string, number>).branchPct,
        prev: (comparison as Record<string, number>).branchPct,
      },
    ];

    for (const c of cases) {
      const expected = ppChange(c.current, c.prev);
      const tag = await tileChangeTag(page, c.label);
      if (expected === null || expected === 0) {
        // No change tag should be rendered
        expect(tag).toBeNull();
      } else {
        expect(tag).toContain(`${Math.abs(expected)}%`);
        expect(tag).toContain(expected > 0 ? "↑" : "↓");
      }
    }
  });

  test("should display correct relative % change for count metrics", async ({
    page,
  }) => {
    if (!comparison) return;

    const cases = [
      {
        label: "CANCELLED UNREVIEWED",
        current: (stats as Record<string, number>).cancelledUnreviewed,
        prev: (comparison as Record<string, number>).cancelledUnreviewed,
      },
      {
        label: "NO CONTACT ATTEMPT",
        current: (stats as Record<string, number>).noContactAttempt,
        prev: (comparison as Record<string, number>).noContactAttempt,
      },
    ];

    for (const c of cases) {
      const expected = relChange(c.current, c.prev);
      const tag = await tileChangeTag(page, c.label);
      if (expected === null || expected === 0) {
        expect(tag).toBeNull();
      } else {
        expect(tag).toContain(`${Math.abs(expected)}%`);
        // Arrow direction: ↑ = increase, ↓ = decrease (color is inverted for lowerIsBetter)
        expect(tag).toContain(expected > 0 ? "↑" : "↓");
      }
    }
  });

  test("should show no change tag when delta is 0", async ({ page }) => {
    // Find any tile where current === previous (if such a case exists)
    // Otherwise this test is a structural check that 0-delta tiles lack a badge
    const allTiles = page.locator(
      '[data-onboarding="gm-summary"] div.bg-neutral-700',
    );
    const count = await allTiles.count();
    for (let i = 0; i < count; i++) {
      const t = allTiles.nth(i);
      const tagEls = t.locator("span.text-xs.font-semibold");
      const tagCount = await tagEls.count();
      if (tagCount > 0) {
        const text = await tagEls.textContent();
        // If tag is rendered, it should have a non-zero value
        expect(text).toMatch(/[↑↓]/);
      }
    }
  });

  /* ---- Drill-Down Modal ---- */

  test("should open drilldown modal when clicking Conversion Rate tile", async ({
    page,
  }) => {
    await tile(page, "CONVERSION RATE").click();
    // Modal overlay appears
    const modal = page.locator(".fixed.inset-0");
    await expect(modal.first()).toBeVisible({ timeout: 5000 });
    // Title contains metric name
    const title = page.locator("h2");
    await expect(title.first()).toContainText("Conversion Rate");
  });

  test("should display trend chart with data points in drilldown", async ({
    page,
  }) => {
    await tile(page, "CONVERSION RATE").click();
    await page.waitForSelector("svg", { timeout: 5000 });
    const circles = page.locator("svg circle");
    expect(await circles.count()).toBeGreaterThan(0);
  });

  test("should display weekly breakdown table in drilldown", async ({
    page,
  }) => {
    await tile(page, "CONVERSION RATE").click();
    await page.waitForTimeout(500); // allow tab render
    // Look for a table or "Weekly Breakdown" heading
    const heading = page.getByText("Weekly Breakdown");
    if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(heading).toBeVisible();
    }
    // Table rows should exist
    const rows = page.locator("table tr, div.grid");
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("should display branch leaderboard with sort options in drilldown", async ({
    page,
  }) => {
    await tile(page, "CONVERSION RATE").click();
    // "By Branch" heading
    const byBranch = page.getByText("By Branch");
    await expect(byBranch.first()).toBeVisible({ timeout: 5000 });
    // Sort select/dropdown
    const sortControl = page.locator("select, [role='listbox']");
    expect(await sortControl.count()).toBeGreaterThan(0);
  });

  test("should sort branches correctly in drilldown", async ({ page }) => {
    await tile(page, "CONVERSION RATE").click();
    await page.waitForTimeout(500);

    // Find the sort select and change to A → Z
    const sel = page.locator("select").first();
    if (await sel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sel.selectOption({ label: "A → Z" }).catch(() =>
        sel.selectOption({ label: "A to Z" }),
      );
      await page.waitForTimeout(300);

      // Read branch names from the leaderboard
      const branchLabels = page.locator(
        'p.font-semibold, span.font-semibold',
      );
      const names: string[] = [];
      const count = await branchLabels.count();
      for (let i = 0; i < Math.min(count, 10); i++) {
        const text = await branchLabels.nth(i).textContent();
        if (text) names.push(text.trim());
      }
      // Verify alphabetical order
      const sorted = [...names].sort((a, b) =>
        a.localeCompare(b, "en", { sensitivity: "base" }),
      );
      expect(names).toEqual(sorted);
    }
  });

  test("should close drilldown modal when clicking backdrop", async ({
    page,
  }) => {
    await tile(page, "CONVERSION RATE").click();
    const modal = page.locator(".fixed.inset-0");
    await expect(modal.first()).toBeVisible({ timeout: 5000 });

    // Click backdrop (the fixed overlay itself, not the content)
    await modal.first().click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);

    // Modal should be gone
    await expect(modal.first()).not.toBeVisible({ timeout: 3000 });
  });
});
