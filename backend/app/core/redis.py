from redis.asyncio import Redis

from app.core.config import Settings


def make_redis(settings: Settings) -> Redis:
    return Redis.from_url(
        settings.redis_url.unicode_string(),
        decode_responses=True,
        socket_timeout=settings.redis_socket_timeout_s,
        socket_connect_timeout=settings.redis_socket_timeout_s,
        health_check_interval=30,
    )
