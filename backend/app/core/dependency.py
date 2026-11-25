from typing import Annotated, cast

from fastapi import Depends, Request

from app.core import container
from app.core.container import Clients
from app.services.readiness_service import ReadinessService


def get_clients(request: Request) -> Clients:
    return cast(Clients, request.app.state.clients)


ClientsDep = Annotated[Clients, Depends(get_clients)]


def get_readiness_service(clients: ClientsDep) -> ReadinessService:
    return container.readiness_service(clients)


ReadinessServiceDep = Annotated[ReadinessService, Depends(get_readiness_service)]
