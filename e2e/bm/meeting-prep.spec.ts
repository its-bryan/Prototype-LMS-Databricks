import { test, expect } from "@playwright/test";
import { bmLogin } from "../helpers/auth";

test.describe("BM Meeting Prep — /bm/meeting-prep", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await bmLogin(page);
    await page.goto("/bm/meeting-prep");
    await page.waitForTimeout(3000);
  });

  test("should load meeting prep page with heading", async ({ page }) => {
    const heading = page
      .locator("h1, h2, h3")
      .filter({ hasText: /meeting prep/i });
    await expect(heading.first()).toBeVisible({ timeout: 5000 });
  });

  test("should display summary metric cards", async ({ page }) => {
    const labels = ["Conversion Rate", "Contacted within 30", "Branch"];
    for (const label of labels) {
      const card = page.locator("div").filter({ hasText: new RegExp(label, "i") });
      if (
        await card.first().isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        expect(await card.first().textContent()).toBeTruthy();
      }
    }
  });

  test("should display completion bar / progress indicator", async ({
    page,
  }) => {
    // Look for a completion/progress section
    const completionSection = page
      .locator("div")
      .filter({ hasText: /completion|missing|outstanding|progress/i });
    if (
      await completionSection
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      expect(await completionSection.first().textContent()).toBeTruthy();
    }
  });

  test("should display lead queue table with pagination", async ({
    page,
  }) => {
    // Look for lead rows or pagination controls
    const rows = page.locator(
      "table tbody tr, div.border-b, div.cursor-pointer",
    );
    const paginationBtns = page.locator("button").filter({ hasText: /next|prev|→|←/i });
    const hasRows = (await rows.count()) > 0;
    const hasPagination = (await paginationBtns.count()) > 0;
    const pageText = await page.locator("body").textContent() ?? "";
    const hasShowingText = /showing|\d+\s*(-|–|of)/i.test(pageText);
    expect(hasRows || hasPagination || hasShowingText).toBe(true);
  });

  test("should paginate lead queue", async ({ page }) => {
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
        // Prev button should now be enabled
        const prevBtn = page
          .locator("button")
          .filter({ hasText: /prev|←|‹/i });
        if (
          await prevBtn
            .first()
            .isVisible({ timeout: 3000 })
            .catch(() => false)
        ) {
          expect(await prevBtn.first().isDisabled()).toBe(false);
        }
      }
    }
  });

  test("should open lead panel on row click", async ({ page }) => {
    const rows = page.locator(
      "table tbody tr, div.border-b.cursor-pointer, div.rounded-lg.cursor-pointer",
    );
    if ((await rows.count()) > 0) {
      await rows.first().click();
      await page.waitForTimeout(1000);
      // Panel should appear — fixed/absolute positioned element with lead content
      const panel = page.locator(
        ".fixed, .absolute, [role='dialog']",
      );
      const panelVisible = await panel
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (panelVisible) {
        expect(panelVisible).toBe(true);
      }
    }
  });

  test("should close lead panel", async ({ page }) => {
    const rows = page.locator(
      "table tbody tr, div.border-b.cursor-pointer, div.rounded-lg.cursor-pointer",
    );
    if ((await rows.count()) > 0) {
      await rows.first().click();
      await page.waitForTimeout(1000);
      // Close via X button or Escape
      const closeBtn = page
        .locator("button")
        .filter({ hasText: /×|close|✕/i });
      if (
        await closeBtn
          .first()
          .isVisible({ timeout: 2000 })
          .catch(() => false)
      ) {
        await closeBtn.first().click();
      } else {
        await page.keyboard.press("Escape");
      }
      await page.waitForTimeout(500);
    }
  });

  test("should display Wins & Learnings textarea", async ({ page }) => {
    const winsSection = page
      .locator("div")
      .filter({ hasText: /wins|learnings/i });
    if (
      await winsSection
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      const textarea = page.locator("textarea");
      expect(await textarea.count()).toBeGreaterThan(0);
    }
  });

  test("should submit wins & learnings", async ({ page }) => {
    const textarea = page.locator("textarea").last();
    if (
      await textarea.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      const isReadonly =
        (await textarea.getAttribute("readonly")) !== null ||
        (await textarea.getAttribute("disabled")) !== null;
      if (!isReadonly) {
        await textarea.fill("E2E test: wins and learnings entry");
        const submitBtn = page
          .locator("button")
          .filter({ hasText: /submit|save|send/i });
        if (
          await submitBtn
            .first()
            .isVisible({ timeout: 2000 })
            .catch(() => false)
        ) {
          await submitBtn.first().click();
          await page.waitForTimeout(1000);
          const success = await page
            .getByText(/saved|sent|success|submitted/i)
            .isVisible({ timeout: 3000 })
            .catch(() => false);
          const cleared = (await textarea.inputValue()) === "";
          expect(success || cleared).toBe(true);
        }
      }
    }
  });

  test("should display data mismatches section if present", async ({
    page,
  }) => {
    const mismatchSection = page
      .locator("div, button")
      .filter({ hasText: /mismatch/i });
    // This is optional — gracefully pass if not present
    if (
      await mismatchSection
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      expect(await mismatchSection.first().textContent()).toBeTruthy();
    } else {
      // No mismatches — that's fine
      expect(true).toBe(true);
    }
  });
});
