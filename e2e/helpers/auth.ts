import { type Page } from "@playwright/test";

const GM_EMAIL = "rachel.leo@hertz.com";
const GM_PASSWORD = "demo123";

const BM_EMAIL = "jeri.leo@hertz.com";
const BM_PASSWORD = "demo123";

/**
 * Log in as the GM test user.
 *
 * Because the app stores the JWT in sessionStorage (not cookies/localStorage),
 * Playwright's storageState cannot carry it across tests.  Each test must call
 * this helper in its beforeEach.
 *
 * Returns the JWT token and user profile for API-level assertions.
 */
export async function gmLogin(
  page: Page,
  /** Optional path to navigate to instead of /gm/overview.
   *  Pass `false` to skip navigation entirely (auth-only). */
  targetPath?: string | false,
): Promise<{ token: string; user: Record<string, unknown> }> {
  // 1. Obtain JWT via API
  const res = await page.request.post("/api/auth/login", {
    data: { email: GM_EMAIL, password: GM_PASSWORD },
  });
  if (!res.ok()) throw new Error(`Login failed: ${res.status()}`);
  const body = await res.json();
  const { token, user } = body;

  // 2. Inject token via addInitScript so it's in sessionStorage BEFORE the
  //    React app mounts. This avoids the race where DataContext fires API
  //    calls before the token is available (causing net::ERR_ABORTED).
  await page.addInitScript((t: string) => {
    sessionStorage.setItem("leo_token", t);
  }, token);

  // 3. Navigate to target page (default: /gm/overview) and wait for data
  if (targetPath !== false) {
    const path = targetPath ?? "/gm/overview";
    await page.goto(path);
    // Wait for the app to finish loading — sidebar renders once AuthGuard/DataContext resolve
    await page.waitForSelector('nav, [data-onboarding="gm-summary"]', { timeout: 45_000 });
  }

  // 4. Dismiss onboarding tour if present
  const skipBtn = page.getByText("Skip");
  if (await skipBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skipBtn.click();
  }

  return { token, user };
}

/**
 * Log in as the BM test user.
 *
 * Same pattern as gmLogin but for the Branch Manager role.
 * Each test must call this helper in its beforeEach.
 */
export async function bmLogin(
  page: Page,
): Promise<{ token: string; user: Record<string, unknown> }> {
  const res = await page.request.post("/api/auth/login", {
    data: { email: BM_EMAIL, password: BM_PASSWORD },
  });
  if (!res.ok()) throw new Error(`BM Login failed: ${res.status()}`);
  const body = await res.json();
  const { token, user } = body;

  await page.addInitScript((t: string) => {
    sessionStorage.setItem("leo_token", t);
  }, token);

  await page.goto("/bm/summary");
  // Wait for the app to finish loading — sidebar renders once AuthGuard/DataContext resolve
  await page.waitForSelector('nav, [data-onboarding="summary"]', { timeout: 45_000 });

  const skipBtn = page.getByText("Skip");
  if (await skipBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skipBtn.click();
  }

  return { token, user };
}
