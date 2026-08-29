import { test, expect } from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";

const SANDBOX_HOME = path.join(os.tmpdir(), "hooky-e2e-home");
const SETTINGS = path.join(SANDBOX_HOME, ".claude", "settings.json");

test.beforeEach(() => {
  fs.rmSync(SANDBOX_HOME, { recursive: true, force: true });
  fs.mkdirSync(path.join(SANDBOX_HOME, ".claude"), { recursive: true });
});

test("marks wired and unwired events, and preserves foreign hooks", async ({ page }) => {
  fs.writeFileSync(
    SETTINGS,
    JSON.stringify({
      hooks: {
        Stop: [{ matcher: "*", hooks: [{ type: "command", command: "/somewhere/mine.sh" }] }],
      },
    })
  );

  await page.goto("/hooks");
  await expect(page.locator("[data-event]").first()).toBeVisible();

  // Every event gets a row, wired or not -- an event missing from the list
  // would read as "doesn't exist" rather than "isn't wired".
  await expect(page.locator("[data-event]")).toHaveCount(22);

  await expect(page.locator('[data-event="Stop"]')).toHaveAttribute("data-wired", "true");
  await expect(page.locator('[data-event="PreToolUse"]')).toHaveAttribute("data-wired", "false");
  await expect(page.locator('[data-event="PreToolUse"]').getByText("not wired")).toBeVisible();

  // A hook Hooky didn't write is labelled by its own basename, not as ours.
  await expect(page.locator('[data-event="Stop"]').getByText("mine.sh")).toBeVisible();
});

test("shows whether the app is listening for hook events", async ({ page }) => {
  await page.goto("/hooks");
  // SSE connects on mount; until it does the banner must not claim it's live.
  await expect(page.getByText(/Listening for hook events/)).toBeVisible();
  await expect(page.getByText(/events unwired/)).toBeVisible();
});
