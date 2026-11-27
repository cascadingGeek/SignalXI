import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandLoader } from "@/components/brand-loader";

describe("BrandLoader", () => {
  it("announces its label as a polite status and keeps the logo decorative", () => {
    const { container } = render(<BrandLoader label="Loading today's slate" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading today's slate");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("animates only when the viewer allows motion", () => {
    const { container } = render(<BrandLoader />);

    const animated = container.querySelectorAll("[class*='animate-signal']");
    expect(animated).toHaveLength(4);
    for (const el of animated) expect(el.getAttribute("class")).toMatch(/motion-safe:animate-/);
  });
});
