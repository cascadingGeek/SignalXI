import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClassificationBadge } from "@/features/predictions/classification-badge";

describe("ClassificationBadge", () => {
  it.each([
    ["STRONG", "Strong Candidate"],
    ["MODERATE", "Moderate Candidate"],
    ["HIGH_RISK_AVOID", "High Risk (Avoid)"],
    ["INSUFFICIENT_DATA", "Insufficient Data"],
  ] as const)("labels %s as %s in text, with a decorative icon", (classification, label) => {
    const { container } = render(<ClassificationBadge classification={classification} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
