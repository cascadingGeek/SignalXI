import { expect, test } from "@playwright/test";

test.use({ colorScheme: "light" });

test("first visit is Midnight before any app script runs, even on a light phone", async ({
  page,
}) => {
  await page.route("**/_next/static/chunks/**", (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});

test("the toggle switches to Light and the choice survives a reload", async ({ page }) => {
  await page.goto("/dev/ui");
  await page.getByRole("button", { name: "Switch to light mode" }).click();

  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await expect(page.getByRole("button", { name: "Switch to midnight mode" })).toBeVisible();
});

test("a theme change syncs to other open tabs", async ({ context }) => {
  const first = await context.newPage();
  const second = await context.newPage();
  await first.goto("/dev/ui");
  await second.goto("/dev/ui");

  await first.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(second.locator("html")).toHaveClass(/\blight\b/);
});

test("the browser bar colour follows the theme", async ({ page }) => {
  const themeColor = page.locator('meta[name="theme-color"]');
  await page.goto("/dev/ui");
  await expect(themeColor).toHaveAttribute("content", "#070b12");

  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(themeColor).toHaveAttribute("content", "#f3f5f8");
});
