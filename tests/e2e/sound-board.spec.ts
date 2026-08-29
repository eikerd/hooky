import { test, expect } from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";

// Mirrors playwright.config.ts. Assertions here read the files the app writes.
const SANDBOX_HOME = path.join(os.tmpdir(), "hooky-e2e-home");
const SETTINGS = path.join(SANDBOX_HOME, ".claude", "settings.json");
const SOUND_CONFIG = path.join(SANDBOX_HOME, ".claude", "hooky.json");

const SOSUMI = "/System/Library/Sounds/Sosumi.aiff";

// Mirrors HOOK_EVENTS_ORDERED in src/types/soundEvents.ts.
const ALL_EVENTS = [
  "Stop", "StopFailure", "Notification", "UserPromptSubmit",
  "PermissionRequest", "PermissionDenied", "Elicitation",
  "TeammateIdle", "TaskCompleted", "TaskCreated", "SubagentStart", "SubagentStop",
  "PreToolUse", "PostToolUse", "PostToolUseFailure",
  "SessionStart", "SessionEnd", "Setup",
  "PreCompact", "PostCompact", "WorktreeCreate", "WorktreeRemove",
];

// Events enabled in DEFAULT_SOUND_CONFIG.
const ACTIVE_BY_DEFAULT = 13;

test.beforeEach(() => {
  fs.rmSync(SANDBOX_HOME, { recursive: true, force: true });
  fs.mkdirSync(path.join(SANDBOX_HOME, ".claude"), { recursive: true });
});

test("lists every hook event with its sound", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Hook Sounds/ })).toBeVisible();

  for (const event of ALL_EVENTS) {
    await expect(page.locator(`text=${event}`).first()).toBeVisible();
  }
  await expect(page.getByLabel("Notification sound")).toHaveCount(ALL_EVENTS.length);
});

test("noisy events ship disabled so hooks aren't unbearable by default", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByText(new RegExp(`${ACTIVE_BY_DEFAULT} of ${ALL_EVENTS.length} events active`))
  ).toBeVisible();

  // Anchored on data-event, not row text: the compact row renders the event
  // name as a span inside the label, so `hasText: /^PreToolUse$/` matched no
  // element once the row collapsed to one line.
  await expect(page.locator('[data-event="PreToolUse"]')).toBeVisible();
  await expect(page.getByLabel("Enable Before Tool Runs")).not.toBeChecked();
});

test("changing a sound is not persisted until saved", async ({ page }) => {
  await page.goto("/");

  const stopSound = page.getByLabel("Notification sound").first();
  await stopSound.selectOption(SOSUMI);

  await expect(page.getByText(/unsaved change/)).toBeVisible();
  expect(fs.existsSync(SOUND_CONFIG)).toBe(false);

  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByText(/unsaved change/)).toHaveCount(0);
});

test("saving writes hooky.json and wires only enabled events", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Notification sound").first().selectOption(SOSUMI);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/unsaved change/)).toHaveCount(0);

  const config = JSON.parse(fs.readFileSync(SOUND_CONFIG, "utf8"));
  expect(config.events.Stop.soundPath).toContain("Sosumi");

  const settings = JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
  expect(settings.hooks.Stop[0].hooks[0].command).toContain("hooky-notify.sh");
  // Disabled events must not be wired at all -- a hook that only exits early
  // still costs a bash+jq spawn on every single tool call.
  expect(settings.hooks.PreToolUse).toBeUndefined();
});

test("preserves settings keys Hooky does not manage", async ({ page }) => {
  fs.writeFileSync(
    SETTINGS,
    JSON.stringify({
      env: { SOME_VAR: "1" },
      statusLine: { type: "command", command: "echo hi" },
      permissions: { allow: ["Bash(ls:*)"], deny: [], defaultMode: "dontAsk" },
      hooks: { Stop: [{ matcher: "*", hooks: [{ type: "command", command: "other.sh" }] }] },
    }, null, 2)
  );

  await page.goto("/");
  await page.getByLabel("Notification sound").first().selectOption(SOSUMI);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/unsaved change/)).toHaveCount(0);

  const settings = JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
  expect(settings.env).toEqual({ SOME_VAR: "1" });
  expect(settings.statusLine).toEqual({ type: "command", command: "echo hi" });
  expect(settings.permissions.defaultMode).toBe("dontAsk");

  const stopCommands = settings.hooks.Stop.flatMap((g: any) => g.hooks).map((h: any) => h.command);
  expect(stopCommands).toContain("other.sh");
});

test("offers only the placeholders an event's payload actually carries", async ({ page }) => {
  await page.goto("/");

  // Stop carries no teammate/task fields; TeammateIdle does.
  const stop = page.locator('[data-event="Stop"]');
  await stop.locator("button[aria-expanded]").click();
  await expect(stop.getByRole("button", { name: "{model}" })).toBeVisible();
  await expect(stop.getByRole("button", { name: "{teammate}" })).toHaveCount(0);

  const teammate = page.locator('[data-event="TeammateIdle"]');
  await teammate.locator("button[aria-expanded]").click();
  await expect(teammate.getByRole("button", { name: "{teammate}" })).toBeVisible();
  await expect(teammate.getByRole("button", { name: "{tool}" })).toHaveCount(0);
});

test("wires the newly supported agent-team events", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Notification sound").first().selectOption(SOSUMI);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/unsaved change/)).toHaveCount(0);

  const settings = JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
  // Enabled by default because they report things you can't see on screen.
  for (const event of ["TeammateIdle", "TaskCompleted", "StopFailure", "Elicitation"]) {
    expect(settings.hooks[event], `${event} should be wired`).toBeDefined();
  }
  // Disabled by default: bookkeeping, or too chatty.
  for (const event of ["TaskCreated", "PostCompact", "WorktreeCreate", "Setup"]) {
    expect(settings.hooks[event], `${event} should not be wired`).toBeUndefined();
  }
});

test("learn mode wires every event silently, and leaving it restores the exact config", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Install/ }).first().click();
  await expect(page.getByText(/Hooky is live/)).toBeVisible();

  // Make one deliberate edit first: an exact restore is only meaningful if
  // there was something non-default to restore.
  await page.locator('[data-event="Stop"] select').selectOption(SOSUMI);
  await page.getByRole("button", { name: /Save changes/ }).click();
  await expect(page.getByText(/Saved and re-wired/)).toBeVisible();

  const before = JSON.parse(fs.readFileSync(SOUND_CONFIG, "utf-8"));
  expect(Object.keys(JSON.parse(fs.readFileSync(SETTINGS, "utf-8")).hooks)).toHaveLength(
    ACTIVE_BY_DEFAULT
  );

  await page.getByRole("button", { name: /Learn mode/ }).click();
  await expect(page.getByRole("button", { name: /Learn mode on/ })).toBeVisible();

  // Every event wired, and nothing audible: the trace is the only output.
  const learnSettings = JSON.parse(fs.readFileSync(SETTINGS, "utf-8"));
  expect(Object.keys(learnSettings.hooks)).toHaveLength(ALL_EVENTS.length);
  const learnConfig = JSON.parse(fs.readFileSync(SOUND_CONFIG, "utf-8"));
  for (const event of ALL_EVENTS) {
    expect(learnConfig.events[event].enabled).toBe(true);
    expect(learnConfig.events[event].soundPath).toBe("");
    expect(learnConfig.events[event].banner).toBe(false);
  }

  await page.getByRole("button", { name: /Learn mode on/ }).click();
  await expect(page.getByRole("button", { name: /^🎓 Learn mode$/ })).toBeVisible();

  // Exact, not reconstructed: the Sosumi edit and every untouched field survive.
  expect(JSON.parse(fs.readFileSync(SOUND_CONFIG, "utf-8"))).toEqual(before);
  expect(Object.keys(JSON.parse(fs.readFileSync(SETTINGS, "utf-8")).hooks)).toHaveLength(
    ACTIVE_BY_DEFAULT
  );
});
