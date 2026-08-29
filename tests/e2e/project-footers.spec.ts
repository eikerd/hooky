import { test, expect } from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";

// Mirrors playwright.config.ts. Assertions here read the files the app writes.
const SANDBOX_HOME = path.join(os.tmpdir(), "hooky-e2e-home");
const SETTINGS = path.join(SANDBOX_HOME, ".claude", "settings.json");
const PROJECTS = path.join(SANDBOX_HOME, ".claude", "hooky-projects.json");

/** Scratch tree the footers point at. Separate from the sandbox home. */
const WORKSPACE = path.join(os.tmpdir(), "hooky-e2e-workspace");
const PROJECT_A = path.join(WORKSPACE, "alpha");
const PROJECT_B = path.join(WORKSPACE, "alpha", "inner");

test.beforeEach(() => {
  fs.rmSync(SANDBOX_HOME, { recursive: true, force: true });
  fs.rmSync(WORKSPACE, { recursive: true, force: true });
  fs.mkdirSync(path.join(SANDBOX_HOME, ".claude"), { recursive: true });
  fs.mkdirSync(PROJECT_B, { recursive: true });
});

/** Install the runner, which the footer feature depends on. */
async function installRunner(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Install Hooky/ }).click();
  await expect(page.getByText(/Hooky is live/)).toBeVisible();
}

test("registering a project writes the registry and wires Stop", async ({ page }) => {
  await installRunner(page);
  await page.goto("/projects");

  await page.getByPlaceholder("~/repos/my-project").fill(PROJECT_A);
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.locator(`[data-project="${PROJECT_A}"]`)).toBeVisible();

  const registry = JSON.parse(fs.readFileSync(PROJECTS, "utf8"));
  expect(Object.keys(registry.projects)).toContain(PROJECT_A);
  expect(registry.projects[PROJECT_A].enabled).toBe(true);

  const settings = JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
  expect(settings.hooks.Stop[0].hooks.some((h: any) => h.command.includes("hooky-notify.sh")))
    .toBe(true);
});

test("a footer keeps Stop wired even when its sound is muted", async ({ page }) => {
  await installRunner(page);

  await page.goto("/projects");
  await page.getByPlaceholder("~/repos/my-project").fill(PROJECT_A);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(`[data-project="${PROJECT_A}"]`)).toBeVisible();

  // Mute the Stop sound entirely.
  await page.goto("/");
  await page.getByLabel("Enable Response Complete").uncheck();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/unsaved change/)).toHaveCount(0);

  // Stop must survive: the footer is a second, independent reason to wire it.
  // Without this the footer would silently disappear when a user mutes Stop.
  const settings = JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
  expect(settings.hooks.Stop, "Stop stays wired for the footer").toBeDefined();

  const config = JSON.parse(fs.readFileSync(path.join(SANDBOX_HOME, ".claude", "hooky.json"), "utf8"));
  expect(config.events.Stop.enabled, "but the sound really is off").toBe(false);
});

test("editing a footer is not persisted until saved", async ({ page }) => {
  await installRunner(page);
  await page.goto("/projects");
  await page.getByPlaceholder("~/repos/my-project").fill(PROJECT_A);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(`[data-project="${PROJECT_A}"]`)).toBeVisible();

  await page.locator("button[aria-expanded]").first().click();
  await page.getByPlaceholder("Falls back to the directory name").fill("Renamed Project");

  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
  let registry = JSON.parse(fs.readFileSync(PROJECTS, "utf8"));
  expect(registry.projects[PROJECT_A].title).toBe("alpha");

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);

  registry = JSON.parse(fs.readFileSync(PROJECTS, "utf8"));
  expect(registry.projects[PROJECT_A].title).toBe("Renamed Project");
});

test("preview renders through the real runner, resolving tokens", async ({ page }) => {
  await installRunner(page);
  await page.goto("/projects");
  await page.getByPlaceholder("~/repos/my-project").fill(PROJECT_A);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(`[data-project="${PROJECT_A}"]`)).toBeVisible();

  await page.locator("button[aria-expanded]").first().click();
  await page.getByPlaceholder("Falls back to the directory name").fill("Alpha");
  await page.getByRole("button", { name: /Preview footer/ }).click();

  const preview = page.locator("pre");
  await expect(preview).toBeVisible();
  // The starter footer carries a {cwd} status line; the runner must resolve it
  // rather than echoing the token back.
  await expect(preview).toContainText("Alpha");
  await expect(preview).toContainText(PROJECT_A);
  await expect(preview).not.toContainText("{cwd}");
});

test("a link condition hides a row when it does not hold", async ({ page }) => {
  await installRunner(page);
  await page.goto("/projects");
  await page.getByPlaceholder("~/repos/my-project").fill(PROJECT_A);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(`[data-project="${PROJECT_A}"]`)).toBeVisible();

  await page.locator("button[aria-expanded]").first().click();
  await page.getByRole("button", { name: "+ Add link" }).click();

  await page.getByPlaceholder("Label").fill("Dead server");
  await page.getByPlaceholder("https://…").fill("http://localhost:59999");
  await page.getByPlaceholder("always").fill("port:59999");

  await page.getByRole("button", { name: /Preview footer/ }).click();
  const preview = page.locator("pre");
  await expect(preview).toBeVisible();
  await expect(preview).not.toContainText("Dead server");

  // Negating the same condition must bring it back, proving the probe ran
  // rather than the row being dropped for some unrelated reason.
  await page.getByPlaceholder("always").fill("!port:59999");
  await page.getByRole("button", { name: /Preview footer/ }).click();
  await expect(preview).toContainText("Dead server");
});

test("nested projects resolve to the innermost registered path", async ({ page }) => {
  await installRunner(page);

  fs.writeFileSync(
    PROJECTS,
    JSON.stringify({
      version: 1,
      enabled: true,
      default: null,
      projects: {
        [PROJECT_A]: { enabled: true, icon: "🅰", title: "Outer", meta: [], links: [], notes: [] },
        [PROJECT_B]: { enabled: true, icon: "🅱", title: "Inner", meta: [], links: [], notes: [] },
      },
    })
  );

  await page.goto("/projects");
  const outerRow = page.locator(`[data-project="${PROJECT_A}"]`);
  const innerRow = page.locator(`[data-project="${PROJECT_B}"]`);
  await expect(outerRow).toBeVisible();
  await expect(innerRow).toBeVisible();

  // Preview the inner project: it must win over the enclosing one.
  await innerRow.locator("button[aria-expanded]").click();
  await innerRow.getByRole("button", { name: /Preview footer/ }).click();

  const preview = innerRow.locator("pre");
  await expect(preview).toContainText("Inner");
  await expect(preview).not.toContainText("Outer");
});

test("imports legacy footer.json files written for project-footer.sh", async ({ page }) => {
  fs.mkdirSync(path.join(PROJECT_A, ".claude"), { recursive: true });
  fs.writeFileSync(
    path.join(PROJECT_A, ".claude", "footer.json"),
    JSON.stringify({
      icon: "🩺",
      title: "Health Auto Export",
      links: [{ label: "Activity", url: "http://chungus.local/activity/" }],
      notes: ["web/ dev server: npm run dev"],
    })
  );

  await installRunner(page);
  await page.goto("/projects");

  await page.getByText(/Import existing/).click();
  await page.getByPlaceholder(/leave blank for the defaults/).fill(WORKSPACE);
  await page.getByRole("button", { name: "Scan" }).click();

  await expect(page.getByText("Health Auto Export")).toBeVisible();
  await page.getByRole("button", { name: "Import selected" }).click();

  // Wait for the project row itself, not merely the path text -- the path also
  // appears in the scan results above, so that would match before the import
  // had actually written anything.
  await expect(page.locator(`[data-project="${PROJECT_A}"]`)).toBeVisible();

  const registry = JSON.parse(fs.readFileSync(PROJECTS, "utf8"));
  const imported = registry.projects[PROJECT_A];
  expect(imported.title).toBe("Health Auto Export");
  expect(imported.icon).toBe("🩺");
  expect(imported.links).toHaveLength(1);
  // Legacy links had no conditions, so they must import as unconditional.
  expect(imported.links[0].when).toBe("");
  expect(imported.notes).toEqual(["web/ dev server: npm run dev"]);
});

test("the old project-footer.sh hook is detected as legacy", async ({ page }) => {
  fs.writeFileSync(
    SETTINGS,
    JSON.stringify({
      hooks: {
        Stop: [
          {
            matcher: "*",
            hooks: [{ type: "command", command: "bash ~/.claude/hooks/project-footer.sh" }],
          },
        ],
      },
    })
  );

  await page.goto("/");
  // Hooky now draws the footer itself, so leaving the old script wired would
  // print two boxes per turn -- it must be offered for removal.
  await expect(page.getByText(/older hand-written notifier script/)).toBeVisible();
  await page.getByRole("button", { name: /Install & replace old script/ }).click();
  await expect(page.getByText(/Hooky is live/)).toBeVisible();

  const settings = JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
  const stopCommands = settings.hooks.Stop.flatMap((g: any) => g.hooks).map((h: any) => h.command);
  expect(stopCommands.some((c: string) => c.includes("project-footer.sh"))).toBe(false);
  expect(stopCommands.some((c: string) => c.includes("hooky-notify.sh"))).toBe(true);
});

test("renders the footer inside a mock terminal, in either shell", async ({ page }) => {
  await installRunner(page);
  await page.goto("/projects");
  await page.getByPlaceholder("~/repos/my-project").fill(PROJECT_A);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(`[data-project="${PROJECT_A}"]`)).toBeVisible();

  await page.getByRole("button", { name: /Compare in terminal/ }).click();

  // The prompt is macOS's real default for each shell, not a themed one --
  // a two-line powerline prompt would change how the footer reads beneath it.
  await expect(page.getByText("alpha %").first()).toBeVisible({ timeout: 20000 });

  await page.getByRole("button", { name: "bash", exact: true }).click();
  await expect(page.getByText("bash-3.2$").first()).toBeVisible();
});
