export interface ApiErrorBody {
  error: { kind: string; message: string };
  request_id?: string | null;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error: unknown = value.error;
  return (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    typeof error.kind === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
}

/** The single shape every API failure takes in the frontend. */
export class ApiError extends Error {
  readonly status: number;
  readonly kind: string;
  readonly requestId: string | null;

  constructor(status: number, kind: string, message: string, requestId: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
    this.requestId = requestId;
  }

  static fromResponse(response: Response, body: unknown): ApiError {
    const requestId = response.headers.get("x-request-id");
    if (isApiErrorBody(body)) {
      return new ApiError(
        response.status,
        body.error.kind,
        body.error.message,
        body.request_id ?? requestId,
      );
    }
    const kind = response.status >= 500 ? "internal" : "invalid";
    return new ApiError(response.status, kind, response.statusText || "request failed", requestId);
  }
}
