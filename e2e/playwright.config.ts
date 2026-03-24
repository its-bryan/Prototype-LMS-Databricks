import { defineConfig } from "@playwright/test";
import { config } from "dotenv";
import { resolve } from "path";

// Load test credentials from .env.test (gitignored)
config({ path: resolve(__dirname, "../.env.test") });

export default defineConfig({
  testDir: ".",
  testMatch: ["gm/**/*.spec.ts", "bm/**/*.spec.ts", "admin/**/*.spec.ts"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 90_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: "http://localhost:5173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],

  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
