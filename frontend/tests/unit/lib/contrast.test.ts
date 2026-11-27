import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");

function block(selector: string): Record<string, string> {
  const start = css.lastIndexOf(`\n${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], (m[2] ?? "").trim()]),
  );
}

type Rgba = [number, number, number, number];

function parse(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1] ?? "", 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(value);
  if (!rgba) throw new Error(`Unparsed colour ${value}`);
  return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Number(rgba[4])];
}

function over(top: Rgba, base: Rgba): Rgba {
  const [r, g, b, a] = top;
  const mix = (t: number, u: number) => t * a + u * (1 - a);
  return [mix(r, base[0]), mix(g, base[1]), mix(b, base[2]), 1];
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a: Rgba, b: Rgba): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const themes = { light: block(":root,\n.light"), midnight: block(".dark") };

describe.each(Object.entries(themes))("%s contrast", (_, t) => {
  const c = (name: string) => {
    const value = t[name];
    if (value === undefined) throw new Error(`Missing token --${name}`);
    return parse(value);
  };
  const surfaces = ["background", "card"];

  it.each(["strong", "moderate", "avoid", "insufficient"])(
    "%s badge text is AA on its tint",
    (tone) => {
      for (const s of surfaces) {
        const bg = over(c(`${tone}-bg`), c(s));
        expect(ratio(c(tone), bg)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it("muted and body text are AA on every surface", () => {
    for (const s of [...surfaces, "raised"]) {
      expect(ratio(c("muted-foreground"), c(s))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c("foreground"), c(s))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("primary buttons are AA and control outlines reach 3:1", () => {
    expect(ratio(c("primary-foreground"), c("primary"))).toBeGreaterThanOrEqual(4.5);
    for (const s of surfaces) expect(ratio(c("input"), c(s))).toBeGreaterThanOrEqual(3);
  });
});
