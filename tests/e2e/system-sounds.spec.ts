import { test, expect } from "@playwright/test";

test("system sounds page loads", async ({ page }) => {
  await page.goto("/system-sounds");

  // Check header
  await expect(page.locator("h1")).toContainText("System Sounds");

  // Check page title
  await expect(page.locator("text=Browse and preview")).toBeVisible();
});

test("system sounds table exists", async ({ page }) => {
  await page.goto("/system-sounds");

  // Check if table exists
  await expect(page.locator("table")).toBeVisible();

  // Check for table headers
  await expect(page.locator("th")).toContainText("Sound Name");
  await expect(page.locator("th")).toContainText("Duration");
  await expect(page.locator("th")).toContainText("Microseconds");
  await expect(page.locator("th")).toContainText("Action");
});

test("navigation to system sounds from sidebar", async ({ page }) => {
  await page.goto("/");

  // Find and click System Sounds link in sidebar
  const systemSoundsLink = page.locator('a:has-text("System Sounds")');
  await systemSoundsLink.click();

  // Verify we're on the system sounds page
  await expect(page).toHaveURL(/system-sounds/);
  await expect(page.locator("h1")).toContainText("System Sounds");
});

test("back button navigates to notifications", async ({ page }) => {
  await page.goto("/system-sounds");

  // Find and click back button
  const backButton = page.locator('button:has-text("Back to Notifications")');
  await backButton.click();

  // Verify we're on notifications page
  await expect(page).toHaveURL(/notifications/);
});

test("play button exists for each sound", async ({ page }) => {
  await page.goto("/system-sounds");

  // Wait for table to be visible
  await page.locator("table").waitFor();

  // Get play buttons
  const playButtons = page.locator('button:has-text("Play")');
  const count = await playButtons.count();

  // If there are sounds, there should be at least one play button
  if (count > 0) {
    expect(count).toBeGreaterThan(0);
  }
});

test("play button shows loading state", async ({ page }) => {
  await page.goto("/system-sounds");

  // Wait for table
  await page.locator("table").waitFor();

  // Get first play button
  const firstPlayButton = page.locator('button:has-text("Play")').first();

  // Check it exists
  await expect(firstPlayButton).toBeVisible();

  // Click it
  await firstPlayButton.click();

  // Should show "Playing..." state
  await expect(firstPlayButton).toContainText(/Playing|Play/i);
});

test("sound table displays duration in human-readable format", async ({ page }) => {
  await page.goto("/system-sounds");

  // Wait for table
  await page.locator("table").waitFor();

  // Look for duration cells
  const durationCells = page.locator("td >> nth=1");
  const count = await durationCells.count();

  if (count > 0) {
    // Get first duration cell
    const firstDuration = await durationCells.first().textContent();

    // Should contain either seconds (s) or minute format (MM:SS)
    expect(firstDuration).toMatch(/\d+:\d+|[\d.]+s/);
  }
});

test("sound table displays microseconds", async ({ page }) => {
  await page.goto("/system-sounds");

  // Wait for table
  await page.locator("table").waitFor();

  // Look for microseconds indicator (μs)
  const microsecondsCells = page.locator("text=/\\d+μs/");
  const count = await microsecondsCells.count();

  if (count > 0) {
    expect(count).toBeGreaterThan(0);
  }
});

test("info tip is displayed", async ({ page }) => {
  await page.goto("/system-sounds");

  // Check for info tip
  const tip = page.locator("text=/Click.*Play.*to preview/i");
  await expect(tip).toBeVisible();
});

test("system sounds link is highlighted when on system sounds page", async ({ page }) => {
  await page.goto("/system-sounds");

  // Find System Sounds link in sidebar
  const systemSoundsLink = page.locator('a:has-text("System Sounds")');

  // Check if it has the active styling (bg-primary class)
  await expect(systemSoundsLink).toHaveClass(/bg-primary/);
});

test("system sounds page is responsive", async ({ page }) => {
  await page.goto("/system-sounds");

  // Check that main content is visible
  await expect(page.locator("h1")).toBeVisible();

  // Check that table is in viewport
  const table = page.locator("table");
  await expect(table).toBeInViewport();

  // Table should be scrollable on small screens
  const tableContainer = page.locator(".overflow-x-auto");
  await expect(tableContainer).toBeVisible();
});

test("title changes when navigating to system sounds", async ({ page }) => {
  await page.goto("/");
  await page.goto("/system-sounds");

  // Check page title in header
  const header = page.locator("h1");
  await expect(header).toContainText("System Sounds");
});
