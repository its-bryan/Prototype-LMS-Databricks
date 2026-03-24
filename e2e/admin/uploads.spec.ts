import { test, expect, type Page } from "@playwright/test";
import { adminLogin } from "../helpers/auth";
import path from "path";

const FIXTURE_CSV = path.resolve(__dirname, "../fixtures/test-hles.csv");

let token: string;

test.describe("HLES Upload — /admin/uploads", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const auth = await adminLogin(page, "/admin/uploads");
    token = auth.token;
  });

  /* ==================================================================
   * JTBD 1: Initial State
   * ================================================================== */

  test("should display upload page with step indicator on Select step", async ({ page }) => {
    await expect(page.getByText("Data Upload")).toBeVisible();

    const stepIndicator = page.locator('[data-testid="upload-step-indicator"]');
    await expect(stepIndicator).toBeVisible();

    // First step should be active (has the primary color class)
    const selectStep = page.locator('[data-testid="upload-step-select"]');
    await expect(selectStep).toBeVisible();
  });

  test("should display upload history section", async ({ page }) => {
    const history = page.locator('[data-testid="upload-history"]');
    await expect(history).toBeVisible();
    await expect(page.getByText("Upload history")).toBeVisible();
  });

  /* ==================================================================
   * JTBD 2: File Selection — Step 1 (SELECT)
   * ================================================================== */

  test("should display file drop zone with HLES label", async ({ page }) => {
    const dropzone = page.locator('[data-testid="upload-dropzone-hles"]');
    await expect(dropzone).toBeVisible();
    await expect(page.getByText("HLES Conversion Data")).toBeVisible();
    await expect(page.getByText("Drop HLES CSV file here")).toBeVisible();
  });

  test("should disable Upload & Validate button when no file selected", async ({ page }) => {
    const btn = page.locator('[data-testid="upload-validate-btn"]');
    await expect(btn).toBeDisabled();
  });

  test("should accept CSV file via file input and show file name", async ({ page }) => {
    const input = page.locator('[data-testid="upload-file-input"]');
    await input.setInputFiles(FIXTURE_CSV);

    await expect(page.locator('[data-testid="upload-file-name"]')).toHaveText("test-hles.csv");
    await expect(page.locator('[data-testid="upload-file-remove"]')).toBeVisible();
  });

  test("should enable Upload & Validate button after file selection", async ({ page }) => {
    await page.locator('[data-testid="upload-file-input"]').setInputFiles(FIXTURE_CSV);
    await expect(page.locator('[data-testid="upload-validate-btn"]')).toBeEnabled();
  });

  test("should allow removing selected file", async ({ page }) => {
    await page.locator('[data-testid="upload-file-input"]').setInputFiles(FIXTURE_CSV);
    await expect(page.locator('[data-testid="upload-file-name"]')).toBeVisible();

    await page.locator('[data-testid="upload-file-remove"]').click();

    // Drop zone should return to empty state
    await expect(page.getByText("Drop HLES CSV file here")).toBeVisible();
    await expect(page.locator('[data-testid="upload-validate-btn"]')).toBeDisabled();
  });

  /* ==================================================================
   * JTBD 3: Validation — Step 2 (VALIDATE)
   * ================================================================== */

  test("should show validation progress loader after clicking Upload & Validate", async ({ page }) => {
    await page.locator('[data-testid="upload-file-input"]').setInputFiles(FIXTURE_CSV);
    await page.locator('[data-testid="upload-validate-btn"]').click();

    await expect(page.locator('[data-testid="upload-validate-loader"]')).toBeVisible();
    await expect(page.getByText("Validating your file(s)")).toBeVisible();
  });

  test("should complete validation and show parse results", async ({ page }) => {
    await page.locator('[data-testid="upload-file-input"]').setInputFiles(FIXTURE_CSV);
    await page.locator('[data-testid="upload-validate-btn"]').click();

    // Wait for validation to finish (loader disappears, card appears)
    await expect(page.locator('[data-testid="upload-validation-card"]')).toBeVisible({ timeout: 30_000 });

    // Check stats are present with numeric values
    await expect(page.getByText("Rows parsed")).toBeVisible();
    await expect(page.getByText("Valid leads")).toBeVisible();
    await expect(page.getByText("Branches found")).toBeVisible();
  });

  test("should show Continue to Preview button after validation", async ({ page }) => {
    await page.locator('[data-testid="upload-file-input"]').setInputFiles(FIXTURE_CSV);
    await page.locator('[data-testid="upload-validate-btn"]').click();
    await expect(page.locator('[data-testid="upload-validation-card"]')).toBeVisible({ timeout: 30_000 });

    await expect(page.locator('[data-testid="upload-continue-preview"]')).toBeVisible();
    await expect(page.getByText("Back")).toBeVisible();
  });

  test("should allow going back to file selection from validation", async ({ page }) => {
    await page.locator('[data-testid="upload-file-input"]').setInputFiles(FIXTURE_CSV);
    await page.locator('[data-testid="upload-validate-btn"]').click();
    await expect(page.locator('[data-testid="upload-validation-card"]')).toBeVisible({ timeout: 30_000 });

    await page.getByText("Back").click();

    // Should return to select step with drop zone visible
    await expect(page.locator('[data-testid="upload-dropzone-hles"]')).toBeVisible();
  });

  /* ==================================================================
   * JTBD 4: Preview & Reconciliation — Step 3 (PREVIEW)
   * ================================================================== */

  async function navigateToPreview(page: Page) {
    await page.locator('[data-testid="upload-file-input"]').setInputFiles(FIXTURE_CSV);
    await page.locator('[data-testid="upload-validate-btn"]').click();
    await expect(page.locator('[data-testid="upload-validation-card"]')).toBeVisible({ timeout: 30_000 });
    await page.locator('[data-testid="upload-continue-preview"]').click();
  }

  test("should display preview summary tiles with correct categories", async ({ page }) => {
    await navigateToPreview(page);

    const tiles = page.locator('[data-testid="upload-preview-tiles"]');
    await expect(tiles).toBeVisible();

    // 5 summary tiles
    await expect(page.locator('[data-testid="upload-tile-total-rows"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-tile-new-leads"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-tile-updated"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-tile-conflicts"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-tile-orphaned"]')).toBeVisible();

    // Total should show a number > 0
    const totalText = await page.locator('[data-testid="upload-tile-total-rows"] p.text-2xl').textContent();
    expect(Number(totalText)).toBeGreaterThan(0);
  });

  test("should display category tabs", async ({ page }) => {
    await navigateToPreview(page);

    await expect(page.locator('[data-testid="upload-tabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-tab-all"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-tab-new"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-tab-updated"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-tab-conflicts"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-tab-orphaned"]')).toBeVisible();
  });

  test("should display preview table with lead data rows", async ({ page }) => {
    await navigateToPreview(page);

    const table = page.locator('[data-testid="upload-preview-table"]');
    await expect(table).toBeVisible();

    // Table should have headers
    await expect(table.locator("th")).toHaveCount(6);

    // Should have at least one data row
    const rows = table.locator("tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("should switch between category tabs and update table content", async ({ page }) => {
    await navigateToPreview(page);

    // Click "New" tab
    await page.locator('[data-testid="upload-tab-new"]').click();
    // If there are new leads, all visible rows should show "new" badge
    const newBadges = page.locator('[data-testid="upload-preview-table"] tbody span');
    const newCount = await newBadges.count();
    if (newCount > 0) {
      for (let i = 0; i < Math.min(newCount, 5); i++) {
        const text = (await newBadges.nth(i).textContent())?.toLowerCase();
        if (text) expect(text).toBe("new");
      }
    }

    // Switch back to "All"
    await page.locator('[data-testid="upload-tab-all"]').click();
    const allRows = page.locator('[data-testid="upload-preview-table"] tbody tr');
    expect(await allRows.count()).toBeGreaterThan(0);
  });

  test("should show Commit Changes button", async ({ page }) => {
    await navigateToPreview(page);

    // The commit button should be present (may be disabled if conflicts exist)
    const commitBtn = page.locator('[data-testid="upload-commit-btn"]');
    await expect(commitBtn).toBeVisible();
  });

  /* ==================================================================
   * JTBD 5: Commit & Ingestion — Step 4 (COMMIT)
   * Full pipeline test — actually uploads the file to the backend
   * ================================================================== */

  test("should show commit progress and transition to summary", async ({ page }) => {
    test.setTimeout(120_000); // Extended timeout for backend processing

    await navigateToPreview(page);

    // Resolve conflicts if any exist
    const conflictsSection = page.locator('[data-testid="upload-conflicts"]');
    if (await conflictsSection.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await page.locator('[data-testid="upload-conflicts-keep-all"]').click();
    }

    const commitBtn = page.locator('[data-testid="upload-commit-btn"]');
    await expect(commitBtn).toBeEnabled();
    await commitBtn.click();

    // Commit progress should appear
    await expect(page.locator('[data-testid="upload-commit-progress"]')).toBeVisible();

    // Wait for summary step to appear (backend processes the upload)
    await expect(page.locator('[data-testid="upload-summary-title"]')).toBeVisible({ timeout: 90_000 });
  });

  /* ==================================================================
   * JTBD 6: Summary & Results — Step 5 (SUMMARY)
   * ================================================================== */

  test("should display upload result with success status", async ({ page }) => {
    test.setTimeout(120_000);

    await navigateToPreview(page);

    const conflictsSection = page.locator('[data-testid="upload-conflicts"]');
    if (await conflictsSection.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await page.locator('[data-testid="upload-conflicts-keep-all"]').click();
    }

    await page.locator('[data-testid="upload-commit-btn"]').click();
    await expect(page.locator('[data-testid="upload-summary-title"]')).toBeVisible({ timeout: 90_000 });

    // Title should be one of: "Upload complete", "Upload accepted", "Upload complete with errors"
    const title = await page.locator('[data-testid="upload-summary-title"]').textContent();
    expect(title).toMatch(/Upload (complete|accepted)/);
  });

  test("should display HLES Results breakdown card", async ({ page }) => {
    test.setTimeout(120_000);

    await navigateToPreview(page);

    const conflictsSection = page.locator('[data-testid="upload-conflicts"]');
    if (await conflictsSection.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await page.locator('[data-testid="upload-conflicts-keep-all"]').click();
    }

    await page.locator('[data-testid="upload-commit-btn"]').click();
    await expect(page.locator('[data-testid="upload-summary-title"]')).toBeVisible({ timeout: 90_000 });

    // HLES Results card
    await expect(page.locator('[data-testid="upload-hles-results"]')).toBeVisible();
    await expect(page.getByText("New leads inserted")).toBeVisible();
    await expect(page.getByText("Existing leads updated")).toBeVisible();
  });

  test("should reset wizard when clicking Start New Upload", async ({ page }) => {
    test.setTimeout(120_000);

    await navigateToPreview(page);

    const conflictsSection = page.locator('[data-testid="upload-conflicts"]');
    if (await conflictsSection.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await page.locator('[data-testid="upload-conflicts-keep-all"]').click();
    }

    await page.locator('[data-testid="upload-commit-btn"]').click();
    await expect(page.locator('[data-testid="upload-summary-title"]')).toBeVisible({ timeout: 90_000 });

    await page.locator('[data-testid="upload-reset-btn"]').click();

    // Should return to select step
    await expect(page.locator('[data-testid="upload-dropzone-hles"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-validate-btn"]')).toBeDisabled();
  });

  test("should navigate to admin dashboard when clicking Back to Dashboard", async ({ page }) => {
    test.setTimeout(120_000);

    await navigateToPreview(page);

    const conflictsSection = page.locator('[data-testid="upload-conflicts"]');
    if (await conflictsSection.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await page.locator('[data-testid="upload-conflicts-keep-all"]').click();
    }

    await page.locator('[data-testid="upload-commit-btn"]').click();
    await expect(page.locator('[data-testid="upload-summary-title"]')).toBeVisible({ timeout: 90_000 });

    await page.locator('[data-testid="upload-back-dashboard"]').click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  /* ==================================================================
   * JTBD 7: Upload History
   * ================================================================== */

  test("should show upload entries in history table", async ({ page }) => {
    const history = page.locator('[data-testid="upload-history"]');
    await expect(history).toBeVisible();

    // Either the table or "No uploads yet" should be present
    const hasTable = await page.locator('[data-testid="upload-history-table"]').isVisible().catch(() => false);
    const hasEmpty = await page.getByText("No uploads yet").isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);

    if (hasTable) {
      // Table should have header columns
      const headers = page.locator('[data-testid="upload-history-table"] thead th');
      expect(await headers.count()).toBeGreaterThanOrEqual(5);
    }
  });

  test("should expand upload history row to show metadata", async ({ page }) => {
    const hasTable = await page.locator('[data-testid="upload-history-table"]').isVisible().catch(() => false);
    test.skip(!hasTable, "No upload history available");

    // Click the first expand button
    const expandBtn = page.locator('[data-testid="upload-history-table"] tbody button[aria-expanded]').first();
    await expandBtn.click();

    // Expanded detail should show metadata
    await expect(page.getByText("Metadata & logs")).toBeVisible();
    await expect(page.getByText("Rows parsed")).toBeVisible();
  });
});
