/**
 * Smoke checks for Atlas React app — run with:
 *   npx playwright test web/e2e/smoke.spec.ts
 * (Playwright is optional; CI can adopt later.)
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.ATLAS_BASE_URL || "http://127.0.0.1:43221/app";

test.describe("Atlas smoke", () => {
  test("login page renders", async ({ page }) => {
    await page.goto(`${BASE}/login/`);
    await expect(page.getByRole("heading", { name: /sign in|create desk/i })).toBeVisible();
  });

  test("feature parity shows 100%", async ({ page }) => {
    await page.goto(`${BASE}/login/`);
    // mock mode often auto-fills ganny/demo
    const user = page.getByLabel(/username/i).or(page.locator('input[autocomplete="username"]'));
    if (await user.count()) {
      await user.first().fill("ganny");
      await page.locator('input[type="password"]').fill("demo");
      await page.getByRole("button", { name: /enter workspace|sign in/i }).click();
    }
    await page.goto(`${BASE}/feature-parity/`);
    await expect(page.getByText(/100%|120/)).toBeVisible({ timeout: 15000 });
  });
});
