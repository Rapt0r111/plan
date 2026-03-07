import { test, expect } from "@playwright/test";

test.describe("Smoke: app loads without errors", () => {
  test("root redirect works — ends up on /dashboard", async ({ page }) => {
    const response = await page.goto("/");
    // After redirect the final URL should be /dashboard
    expect(page.url()).toContain("/dashboard");
    // Must not be a 5xx
    expect(response?.status() ?? 200).toBeLessThan(500);
  });

  test("/dashboard returns 200 and shows key content", async ({ page }) => {
    const response = await page.goto("/dashboard");
    expect(response?.status()).toBe(200);

    // Page title should be present (set in app/layout.tsx metadata)
    await expect(page).toHaveTitle(/TaskFlow/i);

    // Header landmark renders
    await expect(page.locator("header")).toBeVisible();
  });

  test("/board returns 200", async ({ page }) => {
    const response = await page.goto("/board");
    expect(response?.status()).toBe(200);
    await expect(page.locator("header")).toBeVisible();
  });

  test("no unhandled console errors on dashboard", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/dashboard");
    // Wait for any lazy-loaded widgets to settle
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Warning:") && !e.includes("ResizeObserver")
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
