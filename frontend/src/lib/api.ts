import createClient, { type Client, type Middleware } from "openapi-fetch";

import { ApiError } from "@/lib/api-error";
import { env } from "@/lib/env";
import type { paths } from "@/types/api.gen";

export type AccessTokenGetter = () => Promise<string | null>;

export type ApiClient = Client<paths>;

const apiUnavailable: Middleware = {
  onRequest() {
    throw new ApiError(503, "unavailable", "The API is not configured in this environment.");
  },
};

/** Typed API client: Bearer token only, never cookies. */
export function createApiClient(getAccessToken?: AccessTokenGetter): ApiClient {
  const client = createClient<paths>({
    baseUrl: env.NEXT_PUBLIC_API_BASE_URL ?? "",
    credentials: "omit",
  });
  if (!env.NEXT_PUBLIC_API_BASE_URL) {
    client.use(apiUnavailable);
    return client;
  }
  if (getAccessToken) {
    client.use({
      async onRequest({ request }) {
        const token = await getAccessToken();
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
        return request;
      },
    });
  }
  return client;
}

export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.response.ok && result.data !== undefined) return result.data;
  throw ApiError.fromResponse(result.response, result.error);
}
