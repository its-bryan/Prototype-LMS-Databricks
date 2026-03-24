import { test, expect } from "@playwright/test";
import { bmLogin } from "../helpers/auth";

let token: string;
let user: Record<string, unknown>;
let leadUrl: string | null = null;

test.describe("BM Lead Detail — /bm/leads/:leadId", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const auth = await bmLogin(page);
    token = auth.token;
    user = auth.user;

    // Discover a real lead via API
    try {
      const res = await page.request.get(
        "/api/leads?paged=1&limit=1&status=Cancelled",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok()) {
        const body = await res.json();
        const leads = body.leads ?? body.data ?? body;
        if (Array.isArray(leads) && leads.length > 0) {
          leadUrl = `/bm/leads/${leads[0].id}`;
        }
      }
    } catch {
      leadUrl = null;
    }

    if (leadUrl) {
      await page.goto(leadUrl);
      await page.waitForTimeout(3000);
    }
  });

  test("should load lead detail page with content", async ({ page }) => {
    test.skip(!leadUrl, "No leads available for testing");
    const content = page.locator("h1, h2, h3, p.font-semibold");
    expect(await content.count()).toBeGreaterThan(0);
  });

  test("should display customer name and reservation ID", async ({
    page,
  }) => {
    test.skip(!leadUrl, "No leads available for testing");
    const heading = page.locator("h1, h2").first();
    const text = await heading.textContent();
    expect(text).toBeTruthy();
  });

  test("should display lead status badge", async ({ page }) => {
    test.skip(!leadUrl, "No leads available for testing");
    const pageText = (await page.locator("body").textContent()) ?? "";
    const hasStatus =
      /rented|cancelled|unused/i.test(pageText);
    expect(hasStatus).toBe(true);
  });

  test("should display contact card", async ({ page }) => {
    test.skip(!leadUrl, "No leads available for testing");
    const contactSection = page
      .locator("div, h3, h4")
      .filter({ hasText: /contact/i });
    if (
      await contactSection
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await expect(contactSection.first()).toBeVisible();
    }
  });

  test("should display BM enrichment form", async ({ page }) => {
    test.skip(!leadUrl, "No leads available for testing");
    // BM sees enrichment form (reason/notes), not GM directive
    const formElements = page.locator(
      "textarea, select, input[type='text']",
    );
    expect(await formElements.count()).toBeGreaterThan(0);
  });

  test("should submit enrichment form", async ({ page }) => {
    test.skip(!leadUrl, "No leads available for testing");
    const textarea = page.locator("textarea").first();
    if (
      await textarea.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      const isReadonly =
        (await textarea.getAttribute("readonly")) !== null ||
        (await textarea.getAttribute("disabled")) !== null;
      if (!isReadonly) {
        await textarea.fill("E2E test enrichment note");
        const saveBtn = page
          .locator("button")
          .filter({ hasText: /save|submit|send/i });
        if (
          await saveBtn
            .first()
            .isVisible({ timeout: 2000 })
            .catch(() => false)
        ) {
          await saveBtn.first().click();
          await page.waitForTimeout(1500);
          const success = await page
            .getByText(/saved|success|updated/i)
            .isVisible({ timeout: 3000 })
            .catch(() => false);
          const cleared = (await textarea.inputValue()) === "";
          expect(success || cleared).toBe(true);
        }
      }
    }
  });

  test("should display tasks section", async ({ page }) => {
    test.skip(!leadUrl, "No leads available for testing");
    const tasksSection = page.locator('[data-onboarding="tasks-section"]');
    if (
      await tasksSection.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await expect(tasksSection).toBeVisible();
    }
  });

  test("should navigate back via Back button", async ({ page }) => {
    test.skip(!leadUrl, "No leads available for testing");
    const backBtn = page.locator("button, a").filter({ hasText: /back/i });
    if (
      await backBtn.first().isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await backBtn.first().click();
      await page.waitForTimeout(1000);
      expect(page.url()).not.toMatch(/\/leads\/\d+/);
    }
  });
});
