import pytest
from pydantic import ValidationError

from app.core.config import Settings

BASE = {
    "app_env": "local",
    "database_url": "postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres",
    "redis_url": "redis://127.0.0.1:6379/0",
    "supabase_url": "http://127.0.0.1:54321/",
}


def test_parses_comma_separated_origins_and_trims_supabase_url() -> None:
    settings = Settings(**BASE, cors_allowed_origins="http://a.test, http://b.test")  # type: ignore[arg-type]

    assert settings.cors_allowed_origins == ["http://a.test", "http://b.test"]
    assert settings.supabase_url == "http://127.0.0.1:54321"


@pytest.mark.parametrize(
    "override",
    [
        {"database_url": "postgresql://postgres@127.0.0.1/postgres"},
        {"cors_allowed_origins": "*"},
        {"cors_allowed_origins": "http://a.test/"},
        {"app_env": "staging"},
    ],
)
def test_rejects_bad_values(override: dict[str, str]) -> None:
    with pytest.raises(ValidationError):
        Settings(**{**BASE, **override})  # type: ignore[arg-type]
