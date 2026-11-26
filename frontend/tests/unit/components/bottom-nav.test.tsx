import { render, screen, within } from "@testing-library/react";
import { ChartColumn, House, Receipt } from "lucide-react";
import { describe, expect, it } from "vitest";

import { BottomNav } from "@/components/bottom-nav";

const items = [
  { href: "/", label: "Slate", icon: House },
  { href: "/slip-audit", label: "Slip audit", icon: Receipt },
  { href: "/ledger", label: "Ledger", icon: ChartColumn },
];

describe("BottomNav", () => {
  it("lists every item as a named link inside the Primary navigation (AC-6)", () => {
    render(<BottomNav items={items} activeHref="/" />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Slate", "/"],
      ["Slip audit", "/slip-audit"],
      ["Ledger", "/ledger"],
    ]);
  });

  it("marks only the active item as the current page", () => {
    render(<BottomNav items={items} activeHref="/ledger" />);

    expect(screen.getByRole("link", { name: "Ledger" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Slate" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Slip audit" })).not.toHaveAttribute("aria-current");
  });

  it("marks nothing as current when no active route is given", () => {
    render(<BottomNav items={items} />);

    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("keeps icons out of the accessible name", () => {
    render(<BottomNav items={items} />);

    const svgs = screen.getByRole("navigation").querySelectorAll("svg");
    expect(svgs).toHaveLength(3);
    for (const svg of svgs) expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("carries the marker the root layout uses to reserve its height", () => {
    render(<BottomNav items={items} />);

    expect(screen.getByRole("navigation")).toHaveAttribute("data-bottom-nav");
  });
});
