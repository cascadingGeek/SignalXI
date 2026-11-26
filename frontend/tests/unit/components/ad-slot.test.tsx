import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdSlot, type AdSize } from "@/components/ad-slot";
import { env } from "@/lib/env";

vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_ADS_ENABLED: true } }));

describe("AdSlot", () => {
  beforeEach(() => {
    (env as { NEXT_PUBLIC_ADS_ENABLED: boolean }).NEXT_PUBLIC_ADS_ENABLED = true;
  });

  it("reserves a labelled box for guests and free members", () => {
    const { container } = render(<AdSlot size="300x250" viewerTier="free" />);
    const slot = container.querySelector("[data-ad-slot]");
    if (!slot) throw new Error("ad slot not rendered");
    expect(slot).toHaveTextContent("ADVERTISEMENT");
    expect(slot.tagName).toBe("ASIDE");
    expect(slot).toHaveAttribute("aria-label", "Advertisement");
    expect(slot.querySelector("div")).toHaveClass("h-[250px]", "w-[300px]");
  });

  it("names the landmark after its placement so several slots stay unique", () => {
    const { container } = render(<AdSlot size="320x50" viewerTier="guest" placement="slate top" />);
    expect(container.querySelector("aside")).toHaveAttribute(
      "aria-label",
      "Advertisement, slate top",
    );
  });

  it("renders nothing for premium even when ads are on", () => {
    const { container } = render(<AdSlot size="300x250" viewerTier="premium" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for anyone when the flag is off", () => {
    (env as { NEXT_PUBLIC_ADS_ENABLED: boolean }).NEXT_PUBLIC_ADS_ENABLED = false;
    const { container } = render(<AdSlot size="320x50" viewerTier="guest" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("hides wide sizes below their breakpoint and ignores unknown sizes", () => {
    const wide = render(<AdSlot size="728x90" viewerTier="guest" />);
    expect(wide.container.querySelector("[data-ad-slot]")).toHaveClass("hidden", "md:flex");
    const { container } = render(<AdSlot size={"1x1" as AdSize} viewerTier="guest" />);
    expect(container).toBeEmptyDOMElement();
  });
});
