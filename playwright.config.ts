import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
/**
 * 127.0.0.1 rather than localhost on purpose: the local Supabase stack allows
 * redirects to http://127.0.0.1:3000 (site_url in supabase/config.toml), and a
 * magic link redirect must stay on the same host as the session cookies.
 */
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
