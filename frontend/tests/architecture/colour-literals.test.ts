import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOTS = ["src/app", "src/components", "src/features"];
// globals.css defines the tokens; global-error.tsx has no stylesheet; layout.tsx sets the first paint theme colour.
const ALLOWED = new Set(["src/app/globals.css", "src/app/global-error.tsx", "src/app/layout.tsx"]);
const BANNED =
  /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|\b(?:rgba?|hsla?|oklch)\(|-\[(?:#|rgb|hsl|oklch|color)/i;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (path === join("src/components", "ui") || ALLOWED.has(path)) return [];
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("colour tokens only", () => {
  it("components and features carry no colour literals", () => {
    const offenders = ROOTS.flatMap(files).filter((f) => BANNED.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
