import { expect, test, type Page } from "@playwright/test";

// Needs a production build: E2E_BUDGET=1 E2E_WEB_URL=<next start url> pnpm test:e2e budget
test.skip(!process.env.E2E_BUDGET, "runs only against `next build && next start`");
test.use({ serviceWorkers: "block" });

async function coldLoadBytes(page: Page, path: string) {
  const pending: Promise<{ url: string; bytes: number }>[] = [];
  page.on("requestfinished", (request) => {
    pending.push(
      request.sizes().then((s) => ({
        url: request.url(),
        bytes: s.responseBodySize + s.responseHeadersSize,
      })),
    );
  });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const sizes = await Promise.all(pending);
  const sum = (list: typeof sizes) => list.reduce((total, s) => total + s.bytes, 0);
  return { total: sum(sizes), fonts: sum(sizes.filter((s) => s.url.endsWith(".woff2"))) };
}

for (const path of ["/", "/dev/ui"]) {
  test(`a cold load of ${path} stays under 2MB, with fonts under 150KB`, async ({ page }) => {
    const { total, fonts } = await coldLoadBytes(page, path);
    console.log(`${path}: total ${total} bytes, fonts ${fonts} bytes`);
    expect(total).toBeLessThan(2 * 1024 * 1024);
    expect(fonts).toBeLessThan(150 * 1024);
  });
}
