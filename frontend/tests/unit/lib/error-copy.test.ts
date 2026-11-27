import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";
import { ERROR_KINDS, errorCopy, isErrorKind, toErrorKind } from "@/lib/error-copy";

describe("error copy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("has copy with one action for every backend kind plus offline", () => {
    for (const kind of [...ERROR_KINDS, "offline" as const]) {
      expect(errorCopy[kind].title).not.toBe("");
      expect(errorCopy[kind].action.label).not.toBe("");
    }
  });

  it("maps a known ApiError kind and falls back to internal for anything else", () => {
    expect(toErrorKind(new ApiError(429, "rate_limited", "slow"))).toBe("rate_limited");
    expect(toErrorKind(new ApiError(418, "teapot", "?"))).toBe("internal");
    expect(toErrorKind("boom")).toBe("internal");
    expect(isErrorKind("teapot")).toBe(false);
  });

  it("reports offline for a failed fetch while the browser is offline", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(toErrorKind(new TypeError("Failed to fetch"))).toBe("offline");
  });

  it("does not report offline for a TypeError while online", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(toErrorKind(new TypeError("Failed to fetch"))).toBe("internal");
  });
});
