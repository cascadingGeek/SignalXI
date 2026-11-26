import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorState } from "@/components/error-state";
import type { DisplayErrorKind } from "@/lib/error-copy";

describe("ErrorState", () => {
  it("shows the copy, the reference and calls the action", () => {
    const onAction = vi.fn();
    render(<ErrorState kind="internal" requestId="SX-500-7F3A" onAction={onAction} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByText("Error reference SX-500-7F3A")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("hides the reference line when there is no request id", () => {
    render(<ErrorState kind="rate_limited" requestId={null} />);
    expect(screen.queryByText(/Error reference/)).not.toBeInTheDocument();
  });

  it("renders link actions as links", () => {
    render(<ErrorState kind="unauthorized" />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/");
  });

  it("falls back to the internal copy for an unknown kind", () => {
    render(<ErrorState kind={"teapot" as DisplayErrorKind} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });
});
