import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import DevUiPage from "@/app/dev/ui/page";
import RouteError from "@/app/error";
import GlobalError from "@/app/global-error";
import NotFound from "@/app/not-found";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_ENV: "production", NEXT_PUBLIC_ADS_ENABLED: false },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

describe("route error page", () => {
  it("shows the internal copy without a reference and retries", () => {
    const retry = vi.fn();
    render(<RouteError error={new Error("x")} retry={retry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.queryByText(/Error reference/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe("dev ui route", () => {
  it("is a 404 in production", () => {
    expect(() => DevUiPage()).toThrow("NEXT_NOT_FOUND");
  });
});

describe("not found page (AC-9)", () => {
  it("says the page is offside and links back to the slate", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This page is offside");
    expect(screen.getByRole("link", { name: "Back to the slate" })).toHaveAttribute("href", "/");
  });
});

describe("global error page (AC-9)", () => {
  it("brings its own document with the internal copy and a Reload button", () => {
    const html = renderToStaticMarkup(<GlobalError />);

    expect(html).toMatch(/^<html lang="en">/);
    expect(html).toContain("Something went wrong");
    expect(html).toContain('<button type="button"');
    expect(html).toContain(">Reload</button>");
    expect(html).not.toContain("Error reference");
  });
});
