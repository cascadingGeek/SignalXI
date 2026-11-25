from enum import StrEnum
from functools import lru_cache
from typing import Annotated

from pydantic import Field, PostgresDsn, RedisDsn, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class AppEnv(StrEnum):
    LOCAL = "local"
    PRODUCTION = "production"


class Settings(BaseSettings):
    """Runtime configuration; the only place the backend reads env."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", frozen=True
    )

    app_env: AppEnv
    database_url: PostgresDsn
    redis_url: RedisDsn
    supabase_url: str
    cors_allowed_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)

    db_statement_timeout_ms: int = 15_000
    db_api_pool_size: int = 5
    db_api_max_overflow: int = 2
    db_worker_pool_size: int = 3
    redis_socket_timeout_s: float = 2.0
    readiness_timeout_s: float = 2.0
    scheduler_lock_poll_s: float = 5.0

    @field_validator("database_url")
    @classmethod
    def _require_asyncpg(cls, value: PostgresDsn) -> PostgresDsn:
        if value.scheme != "postgresql+asyncpg":
            raise ValueError("DATABASE_URL must use the postgresql+asyncpg:// scheme")
        return value

    @field_validator("supabase_url")
    @classmethod
    def _strip_trailing_slash(cls, value: str) -> str:
        if not value.startswith(("http://", "https://")):
            raise ValueError("SUPABASE_URL must be an http(s) URL")
        return value.rstrip("/")

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        origins = [item.strip() for item in value.split(",") if item.strip()]
        if any(origin == "*" or origin.endswith("/") for origin in origins):
            raise ValueError("CORS_ALLOWED_ORIGINS takes exact origins: no wildcard or slash")
        return origins

    @property
    def is_production(self) -> bool:
        return self.app_env is AppEnv.PRODUCTION


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
