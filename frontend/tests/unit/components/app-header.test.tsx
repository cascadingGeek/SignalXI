import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppHeader } from "@/components/app-header";

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }),
}));

describe("AppHeader", () => {
  it("links the SignalXI wordmark home and always offers the theme toggle (AC-6)", () => {
    render(<AppHeader />);

    expect(screen.getByRole("link", { name: "SignalXI" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  });

  it("renders no Main navigation when there are no nav items", () => {
    render(<AppHeader />);

    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
  });

  it("renders each nav item as a link in the Main navigation", () => {
    render(
      <AppHeader
        nav={[
          { href: "/", label: "Slate" },
          { href: "/ledger", label: "Ledger" },
        ]}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav).toContainElement(screen.getByRole("link", { name: "Ledger" }));
    expect(screen.getByRole("link", { name: "Ledger" })).toHaveAttribute("href", "/ledger");
  });

  it("renders the caller's actions beside the toggle", () => {
    render(<AppHeader actions={<button type="button">Sign in</button>} />);

    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("marks the active nav link as the current page and keeps the logo decorative", () => {
    const { container } = render(
      <AppHeader
        nav={[
          { href: "/", label: "Slate" },
          { href: "/ledger", label: "Ledger" },
        ]}
        activeHref="/ledger"
      />,
    );

    expect(screen.getByRole("link", { name: "Ledger" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Slate" })).not.toHaveAttribute("aria-current");
    expect(container.querySelector("a[href='/'] svg")).toHaveAttribute("aria-hidden", "true");
  });
});
