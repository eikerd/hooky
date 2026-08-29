import { test, expect } from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";

const SANDBOX_HOME = path.join(os.tmpdir(), "hooky-e2e-home");

test.beforeEach(() => {
  fs.rmSync(SANDBOX_HOME, { recursive: true, force: true });
  fs.mkdirSync(path.join(SANDBOX_HOME, ".claude"), { recursive: true });
});

test("lists every playable sound and filters by name", async ({ page }) => {
  await page.goto("/library");

  const rows = page.locator("[data-sound]");
  await expect(rows.first()).toBeVisible();
  const total = await rows.count();
  // The 14 stock macOS sounds are always present; a dev machine may have more.
  expect(total).toBeGreaterThanOrEqual(14);

  await page.getByLabel("Filter sounds by name").fill("gla");
  await expect(page.locator('[data-sound="Glass"]')).toBeVisible();
  await expect(rows).toHaveCount(1);

  await page.getByLabel("Filter sounds by name").fill("zzzznope");
  await expect(rows).toHaveCount(0);
  await expect(page.getByText(/Nothing matches/)).toBeVisible();
});

test("shows which events already claim a sound", async ({ page }) => {
  // No save needed first: soundConfigService.read() falls back to the defaults
  // when hooky.json is absent, and Stop points at Hero there.
  await page.goto("/library");
  await page.getByLabel("Filter sounds by name").fill("hero");

  const heroRow = page.locator('[data-sound="Hero"]');
  await expect(heroRow).toBeVisible();
  await expect(heroRow.getByText("Response Complete")).toBeVisible();
});

test("clicking a sound previews it without touching config", async ({ page }) => {
  await page.goto("/library");
  await page.getByLabel("Filter sounds by name").fill("tink");

  const before = fs.existsSync(path.join(SANDBOX_HOME, ".claude", "hooky.json"))
    ? fs.readFileSync(path.join(SANDBOX_HOME, ".claude", "hooky.json"), "utf-8")
    : null;

  await page.locator('[data-sound="Tink"]').click();

  // Auditioning is not configuring: the library must never write hooky.json.
  const after = fs.existsSync(path.join(SANDBOX_HOME, ".claude", "hooky.json"))
    ? fs.readFileSync(path.join(SANDBOX_HOME, ".claude", "hooky.json"), "utf-8")
    : null;
  expect(after).toEqual(before);
});
