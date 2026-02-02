import { test, expect } from "@playwright/test";

test("dashboard displays all 12 hook types", async ({ page }) => {
  await page.goto("/");

  // Check header
  await expect(page.locator("h1")).toContainText("Hook Management");

  // Check table exists
  const table = page.locator("table");
  await expect(table).toBeVisible();

  // Count hook rows (should be 12)
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(12);
});

test("dashboard shows correct hook types", async ({ page }) => {
  await page.goto("/");

  const expectedHooks = [
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PermissionRequest",
    "PostToolUse",
    "PostToolUseFailure",
    "Notification",
    "SubagentStart",
    "SubagentStop",
    "Stop",
    "PreCompact",
    "SessionEnd",
  ];

  for (const hookType of expectedHooks) {
    await expect(page.locator(`text=${hookType}`)).toBeVisible();
  }
});

test("can toggle hook enabled/disabled", async ({ page }) => {
  await page.goto("/");

  // Find the first hook's checkbox
  const firstCheckbox = page.locator("input[type='checkbox']").first();
  const isChecked = await firstCheckbox.isChecked();

  // Toggle it
  await firstCheckbox.click();

  // Verify it's unchecked
  if (isChecked) {
    await expect(firstCheckbox).not.toBeChecked();
  } else {
    await expect(firstCheckbox).toBeChecked();
  }
});

test("navigates to hook editor on edit link click", async ({ page }) => {
  await page.goto("/");

  // Click the first Edit link
  const firstEditLink = page.locator('a:has-text("Edit")').first();
  await firstEditLink.click();

  // Should be on hook editor page
  await expect(page).toHaveURL(/\/hooks\//);
});

test("sidebar navigation works", async ({ page }) => {
  await page.goto("/");

  // Click Notifications link
  await page.locator('a:has-text("Notifications")').click();

  // Should be on notifications page
  await expect(page).toHaveURL("/notifications");

  // Click Dashboard link
  await page.locator('a:has-text("Dashboard")').click();

  // Should be back on dashboard
  await expect(page).toHaveURL("/");
});
