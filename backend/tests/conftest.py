import os

TEST_ENV = {
    "APP_ENV": "local",
    "DATABASE_URL": "postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres",
    "REDIS_URL": "redis://127.0.0.1:6379/0",
    "SUPABASE_URL": "http://127.0.0.1:54321",
    "CORS_ALLOWED_ORIGINS": "http://localhost:3000",
}

for key, value in TEST_ENV.items():
    os.environ.setdefault(key, value)
