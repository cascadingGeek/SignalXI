import httpx
import pytest

from app.core.config import get_settings
from app.main import create_app


@pytest.fixture
def client() -> httpx.AsyncClient:
    app = create_app(get_settings())
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


async def test_healthz_is_ok_without_io(client: httpx.AsyncClient) -> None:
    response = await client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["x-request-id"]


async def test_request_id_is_echoed(client: httpx.AsyncClient) -> None:
    response = await client.get("/healthz", headers={"X-Request-ID": "abc123"})

    assert response.headers["x-request-id"] == "abc123"


async def test_cors_allows_only_listed_origin(client: httpx.AsyncClient) -> None:
    allowed = await client.get("/healthz", headers={"Origin": "http://localhost:3000"})
    blocked = await client.get("/healthz", headers={"Origin": "https://evil.example"})

    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "access-control-allow-origin" not in blocked.headers


async def test_unknown_route_returns_404(client: httpx.AsyncClient) -> None:
    response = await client.get("/nope")

    assert response.status_code == 404
