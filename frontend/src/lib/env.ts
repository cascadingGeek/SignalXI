import { z } from "zod";

const blankAsUndefined = (value: unknown): unknown => (value === "" ? undefined : value);

const originUrl = z.url().transform((value) => value.replace(/\/+$/, ""));

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: originUrl,
  NEXT_PUBLIC_API_BASE_URL: z.preprocess(blankAsUndefined, originUrl.optional()),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(blankAsUndefined, originUrl.optional()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(blankAsUndefined, z.string().min(1).optional()),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/** Validates raw env values and throws one readable error listing every bad key. */
export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

// Keys are referenced literally so Next.js can inline them into the browser bundle.
export const env: PublicEnv = parsePublicEnv({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
