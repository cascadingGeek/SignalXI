import { readFileSync } from "node:fs";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton } from "@/components/ui/skeleton";

describe("Skeleton", () => {
  it("pulses only when motion is allowed, on the skeleton token", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass("motion-safe:animate-skeleton-pulse", "bg-skeleton");
  });

  it("uses a 1.4s pulse", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/--animate-skeleton-pulse: pulse 1\.4s/);
  });
});
