import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "@/components/empty-state";

const copy = { title: "No picks for this filter yet", body: "Try another league." };

describe("EmptyState", () => {
  it("shows the title as a heading and the body text", () => {
    render(<EmptyState {...copy} />);

    expect(screen.getByRole("heading", { name: copy.title })).toBeInTheDocument();
    expect(screen.getByText(copy.body)).toBeInTheDocument();
  });

  it("offers no action when none is given", () => {
    render(<EmptyState {...copy} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders a link action as a link to its href", () => {
    render(<EmptyState {...copy} action={{ label: "See all leagues", href: "/" }} />);

    expect(screen.getByRole("link", { name: "See all leagues" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a callback action as a button that calls it once", () => {
    const onClick = vi.fn();
    render(<EmptyState {...copy} action={{ label: "Clear filters", onClick }} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("keeps the icon decorative", () => {
    const { container } = render(<EmptyState {...copy} />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
