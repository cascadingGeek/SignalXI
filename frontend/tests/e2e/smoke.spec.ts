import { expect, test } from "@playwright/test";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000";

test("home page renders with the 18+ notice", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SignalXI" })).toBeVisible();
  await expect(page.getByText(/18\+ only/)).toBeVisible();
});

test("API is ready against local Postgres and Redis", async ({ request }) => {
  const response = await request.get(`${API_URL}/readyz`);

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ready", postgres: "ok", redis: "ok" });
});
