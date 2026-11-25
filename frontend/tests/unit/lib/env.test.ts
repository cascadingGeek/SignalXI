import { describe, expect, it } from "vitest";

import { parsePublicEnv } from "@/lib/env";

describe("parsePublicEnv", () => {
  it("accepts a preview env with no API or Supabase values", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SITE_URL: "https://preview.example.com/",
      NEXT_PUBLIC_API_BASE_URL: "",
    });

    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://preview.example.com");
    expect(env.NEXT_PUBLIC_API_BASE_URL).toBeUndefined();
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeUndefined();
  });

  it("fails fast when the site URL is missing or malformed", () => {
    expect(() => parsePublicEnv({})).toThrow(/NEXT_PUBLIC_SITE_URL/);
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SITE_URL: "http://x.test",
        NEXT_PUBLIC_API_BASE_URL: "nope",
      }),
    ).toThrow(/NEXT_PUBLIC_API_BASE_URL/);
  });
});
