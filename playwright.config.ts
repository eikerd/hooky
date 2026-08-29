import { defineConfig, devices } from "@playwright/test";
import os from "os";
import path from "path";

/**
 * Every test run gets a throwaway home directory. Hooky reads and writes real
 * files (~/.claude/settings.json, ~/.claude/hooky.json), so without this the
 * suite would mutate the developer's live Claude Code configuration.
 */
const SANDBOX_HOME = path.join(os.tmpdir(), "hooky-e2e-home");

const PORT = Number(process.env.PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // Serial by necessity: every test mutates the same sandbox home directory
  // (settings.json / hooky.json), so parallel workers delete each other's
  // fixtures mid-run.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: `bun run dev --port ${PORT}`,
    url: BASE_URL,
    // Never reuse a server the developer started by hand: it wouldn't have
    // HOOKY_HOME set, and the tests would write to the real config.
    reuseExistingServer: false,
    env: { HOOKY_HOME: SANDBOX_HOME },
  },
});
