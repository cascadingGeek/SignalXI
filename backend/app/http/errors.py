import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.errors import AppError, ErrorKind
from app.schemas.errors import ErrorDetail, ErrorResponse

_log = structlog.get_logger("app.http")

STATUS_BY_KIND: dict[ErrorKind, int] = {
    ErrorKind.INVALID: 422,
    ErrorKind.UNAUTHORIZED: 401,
    ErrorKind.FORBIDDEN: 403,
    ErrorKind.NOT_FOUND: 404,
    ErrorKind.CONFLICT: 409,
    ErrorKind.RATE_LIMITED: 429,
    ErrorKind.UNAVAILABLE: 503,
    ErrorKind.INTERNAL: 500,
}


def _respond(request: Request, kind: ErrorKind, message: str) -> JSONResponse:
    body = ErrorResponse(
        error=ErrorDetail(kind=kind.value, message=message),
        request_id=getattr(request.state, "request_id", None),
    )
    return JSONResponse(body.model_dump(), status_code=STATUS_BY_KIND[kind])


async def _app_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    if STATUS_BY_KIND[exc.kind] >= 500:
        _log.warning("app_error", kind=exc.kind.value, message=exc.message)
    return _respond(request, exc.kind, exc.message)


async def _validation_error(request: Request, exc: Exception) -> JSONResponse:
    return _respond(request, ErrorKind.INVALID, "request validation failed")


async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
    _log.exception("unhandled_error", exc_info=exc)
    return _respond(request, ErrorKind.INTERNAL, "internal error")


def install_error_handlers(app: FastAPI) -> None:
    """Every failure leaves the API as one `ErrorResponse` body."""
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(Exception, _unhandled)
