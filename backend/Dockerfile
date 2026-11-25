# One image for both Render services: the API (default CMD) and the scheduler
# worker (render.yaml overrides the start command). Built with uv, per spec _root 0001.

# ---- build: resolve and install locked dependencies into /app/.venv
FROM ghcr.io/astral-sh/uv:0.9.8-python3.13-bookworm-slim AS build
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /app
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-dev --no-install-project
COPY app ./app

# ---- runtime: slim Python, no uv, non root user
FROM python:3.13-slim-bookworm AS runtime
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000
RUN groupadd --system app && useradd --system --gid app --home-dir /app app
WORKDIR /app
COPY --from=build --chown=app:app /app /app
USER app
EXPOSE 8000
# exec form through sh so $PORT expands and uvicorn still receives SIGTERM directly
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
