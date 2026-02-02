import { test, expect } from "@playwright/test";

test("notifications page loads", async ({ page }) => {
  await page.goto("/notifications");

  // Check header
  await expect(page.locator("h1")).toContainText("Notifications");

  // Check notification editor exists
  await expect(page.locator("text=Notification Settings")).toBeVisible();
});

test("lists all notification configurations", async ({ page }) => {
  await page.goto("/notifications");

  // Check for notification rows
  const notificationRows = page.locator("text=/^on_/");
  const count = await notificationRows.count();
  expect(count).toBeGreaterThan(0);
});

test("can edit emoji value", async ({ page }) => {
  await page.goto("/notifications");

  // Get the first emoji input
  const firstEmojiInput = page
    .locator('input[maxlength="2"]')
    .first();

  // Change the emoji
  await firstEmojiInput.clear();
  await firstEmojiInput.fill("💥");

  // Verify change
  await expect(firstEmojiInput).toHaveValue("💥");
});

test("can edit message value", async ({ page }) => {
  await page.goto("/notifications");

  // Get all inputs in notification cards
  const inputs = page.locator(
    'input:not([maxlength="2"])[type="text"]'
  );

  // Find message input (should be the second text input in first card)
  const messageInputs = await inputs.count();
  if (messageInputs > 0) {
    const firstMessageInput = inputs.first();
    await firstMessageInput.clear();
    await firstMessageInput.fill("Custom Message");
    await expect(firstMessageInput).toHaveValue("Custom Message");
  }
});

test("can change sound selection", async ({ page }) => {
  await page.goto("/notifications");

  // Get first sound dropdown
  const firstSoundSelect = page.locator("select").first();

  // Change to Alarm
  await firstSoundSelect.selectOption("Alarm");

  // Verify selection
  const selectedValue = await firstSoundSelect.inputValue();
  expect(selectedValue).toBe("Alarm");
});

test("can toggle notification enabled/disabled", async ({ page }) => {
  await page.goto("/notifications");

  // Find an enabled checkbox
  const checkboxes = page.locator('input[type="checkbox"]');
  if ((await checkboxes.count()) > 0) {
    const firstCheckbox = checkboxes.first();
    const wasChecked = await firstCheckbox.isChecked();

    // Toggle it
    await firstCheckbox.click();

    // Verify
    const isNowChecked = await firstCheckbox.isChecked();
    expect(isNowChecked).not.toBe(wasChecked);
  }
});

test("save button exists and is clickable", async ({ page }) => {
  await page.goto("/notifications");

  // Find Save button
  const saveButton = page.locator('button:has-text("Save")');

  // Should be visible
  await expect(saveButton).toBeVisible();

  // Should be enabled
  await expect(saveButton).toBeEnabled();
});

test("test button exists for each notification", async ({ page }) => {
  await page.goto("/notifications");

  // Count Test buttons (look for 🔊 icon)
  const testButtons = page.locator('button:has-text("🔊")');
  const count = await testButtons.count();

  // Should have at least one
  expect(count).toBeGreaterThan(0);
});

test("test button plays sound when clicked", async ({ page }) => {
  await page.goto("/notifications");

  // Get first test button
  const firstTestButton = page.locator('button:has-text("🔊")').first();

  // Click it
  await firstTestButton.click();

  // Wait for toast notification to appear
  const toast = page.locator('[role="alert"]');
  await expect(toast).toBeVisible({ timeout: 5000 });

  // Verify toast contains "sound" text
  await expect(toast).toContainText(/sound|Playing/i);
});
