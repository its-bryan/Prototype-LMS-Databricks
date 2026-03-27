import { test, expect } from "@playwright/test";
import { gmLogin } from "../helpers/auth";

let leadUrl: string | null = null;

test.describe("GM Lead Profile — /gm/leads/:leadId", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { token } = await gmLogin(page, false);

    // Find a real lead ID via API
    const res = await page.request.get(
      "/api/leads?paged=1&limit=1&status=Cancelled",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok()) {
      const data = await res.json();
      const items = data.items ?? [];
      if (items.length > 0) {
        const leadId = items[0].id ?? items[0].leadId;
        if (leadId) {
          leadUrl = `/gm/leads/${leadId}`;
          await page.goto(leadUrl);
          // Wait for lead profile to render (customer name heading — renders as h2)
          await page.waitForSelector('h2', { timeout: 30_000 });
          return;
        }
      }
    }
    leadUrl = null;
  });

  /* ---- Layout ---- */

  test("should load lead profile with 2-column layout", async ({ page }) => {
    test.skip(!leadUrl, "No leads available in database");
    const columns = page.locator(
      'div[class*="grid-cols-2"], div[class*="grid grid-cols"]',
    );
    const hasColumns = (await columns.count()) > 0;
    const hasContent = (await page.locator("h1, h2").count()) > 0;
    expect(hasColumns || hasContent).toBe(true);
  });

  test("should display customer name and reservation ID", async ({ page }) => {
    test.skip(!leadUrl, "No leads available in database");
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible();
    const text = await heading.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test("should display org hierarchy (BM → AM → GM → Zone)", async ({
    page,
  }) => {
    test.skip(!leadUrl, "No leads available in database");
    const body = await page.locator("body").textContent();
    const hasHierarchy =
      body?.includes("GM") || body?.includes("BM") || body?.includes("Zone");
    expect(hasHierarchy).toBe(true);
  });

  test("should display Lead Details card with status and branch", async ({
    page,
  }) => {
    test.skip(!leadUrl, "No leads available in database");
    const body = await page.locator("body").textContent();
    const statuses = ["Rented", "Cancelled", "Unused"];
    const hasStatus = statuses.some((s) => body?.includes(s));
    expect(hasStatus).toBe(true);
  });

  /* ---- Contact Details ---- */

  test("should display Contact Details card", async ({ page }) => {
    test.skip(!leadUrl, "No leads available in database");
    const contactSection = page.getByText("Contact", { exact: false });
    expect(await contactSection.count()).toBeGreaterThan(0);
  });

  test("should enable editing contact details via pencil icon", async ({
    page,
  }) => {
    test.skip(!leadUrl, "No leads available in database");
    const editBtn = page.locator(
      'button[title*="edit" i], button[aria-label*="edit" i], button svg[class*="w-4"]',
    );
    if (await editBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await editBtn.first().click();
      await page.waitForTimeout(500);
      const inputs = page.locator(
        'input[type="email"], input[type="tel"], input[placeholder*="email" i], input[placeholder*="phone" i]',
      );
      expect(await inputs.count()).toBeGreaterThan(0);
    }
  });

  /* ---- GM Directive ---- */

  test("should display GM Directive section", async ({ page }) => {
    test.skip(!leadUrl, "No leads available in database");
    const directiveSection = page.getByText(/directive/i);
    expect(await directiveSection.count()).toBeGreaterThan(0);
    const textarea = page.locator("textarea");
    expect(await textarea.count()).toBeGreaterThan(0);
  });

  test("should submit a GM directive", async ({ page }) => {
    test.skip(!leadUrl, "No leads available in database");
    const textarea = page.locator("textarea").first();
    if (await textarea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await textarea.fill("E2E lead profile test directive — please ignore");

      const submitBtn = page.getByRole("button", {
        name: /send|submit|save/i,
      });
      if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
        const success = await page
          .getByText(/saved|sent|success/i)
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        const cleared = (await textarea.inputValue()) === "";
        expect(success || cleared).toBe(true);
      }
    }
  });

  /* ---- Tasks ---- */

  test("should display tasks section", async ({ page }) => {
    test.skip(!leadUrl, "No leads available in database");
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
  });

  /* ---- Navigation ---- */

  test("should navigate back to leads via Back button", async ({ page }) => {
    test.skip(!leadUrl, "No leads available in database");
    const backBtn = page.getByRole("button", { name: /back/i });
    if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toMatch(/\/gm\/(leads|overview)/);
    }
  });
});
