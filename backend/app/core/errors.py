from enum import StrEnum


class ErrorKind(StrEnum):
    INVALID = "invalid"
    UNAUTHORIZED = "unauthorized"
    FORBIDDEN = "forbidden"
    NOT_FOUND = "not_found"
    CONFLICT = "conflict"
    RATE_LIMITED = "rate_limited"
    UNAVAILABLE = "unavailable"
    INTERNAL = "internal"


class AppError(Exception):
    """Expected failure raised below the controllers; `app.http` maps `kind` to a status."""

    kind: ErrorKind = ErrorKind.INTERNAL

    def __init__(self, message: str, *, kind: ErrorKind | None = None) -> None:
        super().__init__(message)
        self.message = message
        if kind is not None:
            self.kind = kind


class DependencyUnavailable(AppError):
    kind = ErrorKind.UNAVAILABLE
