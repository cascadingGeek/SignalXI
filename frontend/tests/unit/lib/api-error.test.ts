import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-error";

describe("ApiError.fromResponse", () => {
  it("reads the backend error envelope", () => {
    const response = new Response(null, { status: 503 });
    const error = ApiError.fromResponse(response, {
      error: { kind: "unavailable", message: "unavailable: redis" },
      request_id: "abc",
    });

    expect(error).toMatchObject({
      status: 503,
      kind: "unavailable",
      message: "unavailable: redis",
      requestId: "abc",
    });
  });

  it("falls back to the status for an unknown body", () => {
    const response = new Response(null, {
      status: 502,
      statusText: "Bad Gateway",
      headers: { "x-request-id": "r1" },
    });
    const error = ApiError.fromResponse(response, "<html>");

    expect(error).toMatchObject({
      status: 502,
      kind: "internal",
      requestId: "r1",
    });
  });
});
