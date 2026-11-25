from fastapi import APIRouter

from app.controllers import health_controller
from app.core.dependency import ReadinessServiceDep
from app.schemas.errors import ErrorResponse
from app.schemas.health import HealthResponse, ReadinessResponse

router = APIRouter(tags=["health"])


@router.get("/healthz", response_model=HealthResponse, name="get_health")
async def get_health() -> HealthResponse:
    return await health_controller.get_health()


@router.get(
    "/readyz",
    response_model=ReadinessResponse,
    name="get_readiness",
    responses={503: {"model": ErrorResponse}},
)
async def get_readiness(service: ReadinessServiceDep) -> ReadinessResponse:
    return await health_controller.get_readiness(service)
