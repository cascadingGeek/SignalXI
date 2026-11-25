from app.schemas.health import HealthResponse, ReadinessResponse
from app.services.readiness_service import ReadinessService


async def get_health() -> HealthResponse:
    return HealthResponse()


async def get_readiness(service: ReadinessService) -> ReadinessResponse:
    return await service.check()
