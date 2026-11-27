import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const theme of ["dark", "light"] as const) {
  test(`the preview has no axe violations with the ${theme} theme saved`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("sx-theme", value), theme);
    await page.goto("/dev/ui");
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`),
    ).toEqual([]);
  });
}

test("every visible control is at least 44 by 44", async ({ page }) => {
  await page.goto("/dev/ui");
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("button, a, [role=checkbox], [role=tab]")]
      .filter((el) => el.offsetParent !== null && !el.closest("p"))
      .map((el) => {
        const target = el.matches("[role=checkbox]") ? (el.closest("label") ?? el) : el;
        const box = target.getBoundingClientRect();
        return {
          name: el.textContent?.trim() || el.getAttribute("aria-label"),
          w: box.width,
          h: box.height,
        };
      })
      .filter((b) => b.w < 44 || b.h < 44),
  );
  expect(small).toEqual([]);
});

test("fonts are self hosted: nothing is requested from Google at runtime", async ({ page }) => {
  const hosts: string[] = [];
  page.on("request", (r) => hosts.push(new URL(r.url()).hostname));
  await page.goto("/dev/ui");
  await page.waitForLoadState("networkidle");

  expect(hosts.filter((h) => h.includes("googleapis") || h.includes("gstatic"))).toEqual([]);
});

test("the mobile bottom nav never covers the footer's 18+ notice", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/ui");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  const overlap = await page.evaluate(() => {
    const nav = document.querySelector("[data-bottom-nav]")?.getBoundingClientRect();
    const footer = document.querySelector("footer")?.getBoundingClientRect();
    return nav && footer ? footer.bottom - nav.top : Number.NaN;
  });
  expect(overlap).toBeLessThanOrEqual(0);
  await expect(page.getByText("18+ only.").last()).toBeInViewport({ ratio: 1 });
});

test("space for the bottom nav is reserved only where it shows", async ({ page }) => {
  const bodyPadding = () => page.evaluate(() => getComputedStyle(document.body).paddingBottom);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dev/ui");
  expect(await bodyPadding()).toBe("0px");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/does-not-exist");
  expect(await bodyPadding()).toBe("0px");
});
