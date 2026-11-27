import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResponsibleGamblingNote } from "@/components/responsible-gambling-note";
import { SiteFooter } from "@/components/site-footer";

const DISCLOSURE = "18+ only. Statistical analysis, not guaranteed outcomes. Bet responsibly.";

describe("ResponsibleGamblingNote", () => {
  it("states the full 18+ and responsible gambling disclosure (AC-6)", () => {
    const { container } = render(<ResponsibleGamblingNote />);

    expect(container).toHaveTextContent(DISCLOSURE);
    expect(screen.getByText("18+ only.").tagName).toBe("STRONG");
  });
});

describe("SiteFooter", () => {
  it("carries the disclosure inside the page footer landmark", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("contentinfo")).toHaveTextContent(DISCLOSURE);
  });
});
