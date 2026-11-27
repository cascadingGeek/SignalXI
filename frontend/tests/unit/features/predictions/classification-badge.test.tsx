import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClassificationBadge } from "@/features/predictions/classification-badge";

describe("ClassificationBadge", () => {
  it.each([
    ["STRONG", "Strong Candidate", "3"],
    ["MODERATE", "Moderate Candidate", "2"],
    ["HIGH_RISK_AVOID", "High Risk (Avoid)", "1"],
    ["INSUFFICIENT_DATA", "Insufficient Data", "0"],
  ] as const)(
    "labels %s as %s in text, with %s decorative signal bars lit",
    (classification, label, lit) => {
      const { container } = render(<ClassificationBadge classification={classification} />);

      expect(screen.getByText(label)).toBeInTheDocument();
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("data-lit", lit);
    },
  );
});
