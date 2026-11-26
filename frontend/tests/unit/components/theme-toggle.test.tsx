import { fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "@/components/theme-toggle";

const setTheme = vi.fn();
let resolvedTheme: string | undefined;

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme, setTheme }),
}));

beforeEach(() => {
  setTheme.mockReset();
  resolvedTheme = "dark";
});

describe("ThemeToggle", () => {
  it("offers Light while Midnight is active and switches to it (AC-2)", () => {
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));

    expect(setTheme).toHaveBeenCalledExactlyOnceWith("light");
  });

  it("offers Midnight while Light is active and switches back (AC-2)", () => {
    resolvedTheme = "light";
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Switch to midnight mode" }));

    expect(setTheme).toHaveBeenCalledExactlyOnceWith("dark");
  });

  it("treats an unresolved theme as Midnight, the default (AC-1)", () => {
    resolvedTheme = undefined;
    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  });

  it("renders a neutral, named button on the server so markup never guesses the stored theme", () => {
    const html = renderToString(<ThemeToggle />);

    expect(html).toContain('aria-label="Switch theme"');
    expect(html).not.toContain("<svg");
  });
});
