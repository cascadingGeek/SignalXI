import { ApiError } from "@/lib/api-error";

/** Mirrors `ErrorKind` in backend/app/core/errors.py. */
export const ERROR_KINDS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "unavailable",
  "internal",
] as const;

export type ErrorKind = (typeof ERROR_KINDS)[number];
export type DisplayErrorKind = ErrorKind | "offline";

export interface ErrorCopy {
  title: string;
  body: string;
  action: { label: string; type: "callback" } | { label: string; type: "link"; href: string };
}

export const errorCopy: Record<DisplayErrorKind, ErrorCopy> = {
  offline: {
    title: "You're offline",
    body: "Check your data or WiFi. We'll show the last saved slate where we can.",
    action: { label: "Retry", type: "callback" },
  },
  internal: {
    title: "Something went wrong",
    body: "This is on our side, not yours. Try again in a moment.",
    action: { label: "Try again", type: "callback" },
  },
  unavailable: {
    title: "We're having trouble right now",
    body: "A service we rely on isn't responding. This is on our side, not yours.",
    action: { label: "Try again", type: "callback" },
  },
  rate_limited: {
    title: "Slow down a little",
    body: "Too many requests in a short time. Wait about 30 seconds, then try again.",
    action: { label: "Try again", type: "callback" },
  },
  unauthorized: {
    title: "You've been signed out",
    body: "Your session ended. Sign in again to carry on.",
    action: { label: "Sign in", type: "link", href: "/" },
  },
  forbidden: {
    title: "This isn't available on your plan",
    body: "Upgrade to see it, or go back to today's free picks.",
    action: { label: "See plans", type: "link", href: "/" },
  },
  not_found: {
    title: "We couldn't find that",
    body: "It may have moved or expired.",
    action: { label: "Go to today's slate", type: "link", href: "/" },
  },
  invalid: {
    title: "Something in that request wasn't right",
    body: "Check what you entered and try again.",
    action: { label: "Try again", type: "callback" },
  },
  conflict: {
    title: "That changed while you were looking",
    body: "Refresh to see the latest.",
    action: { label: "Refresh", type: "callback" },
  },
};

export function isErrorKind(kind: string): kind is ErrorKind {
  return (ERROR_KINDS as readonly string[]).includes(kind);
}

/** Maps any thrown value to the kind whose copy the user should see. */
export function toErrorKind(error: unknown): DisplayErrorKind {
  if (error instanceof TypeError && typeof navigator !== "undefined" && !navigator.onLine) {
    return "offline";
  }
  if (error instanceof ApiError && isErrorKind(error.kind)) return error.kind;
  return "internal";
}
