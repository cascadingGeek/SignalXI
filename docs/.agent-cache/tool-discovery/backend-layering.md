# Backend tool discovery (2026-11-24)

Installed skills (`npx skills list`): none in this project.

## Skills (owner/repo@skill, installs)
- FastAPI: fastapi/fastapi@fastapi (16.4K, official repo); wshobson/agents@fastapi-templates (27K); mindrally/skills@fastapi-python (14.2K)
- Pydantic: pydantic/skills@pydantic (3.1K, official org)
- SQLAlchemy 2.0: bobmatnyc/claude-mpm-skills@sqlalchemy-orm (873); yonatangross/orchestkit@sqlalchemy-2-async (31, async-focused)
- asyncpg: davidcastagnetoa/skills@asyncpg (19, weak)
- Supabase: supabase/agent-skills@supabase (373.9K, official); supabase/agent-skills@supabase-postgres-best-practices (496.2K, official); supabase/server@supabase-server (11.4K, official)
- Redis: redis/agent-skills@redis-core (4.7K, official); redis/agent-skills@redis-connections (3.3K, official); redis/agent-skills@redis-development (3.1K, official)
- uv: astral-sh/agent-plugins@uv (6.1K, official Astral); wshobson/agents@uv-package-manager (16.1K)
- pytest: github/awesome-copilot@pytest-coverage (13.1K); manutej/luxor-claude-marketplace@pytest-patterns (875)
- pytest-socket: NONE (exact search and "pytest socket" alias both empty; no relevant match)
- import-linter: davidcastagnetoa/skills@archunit-import-linter (12, weak); forge-it/agent-skills@python-import-linter-setup (2, weak)
- LangGraph: langchain-ai/langchain-skills@langgraph-fundamentals (19.3K, official); langchain-ai/langchain-skills@langgraph-persistence (19.1K, official); langchain-ai/langchain-skills@langgraph-python-quickstart (6.1K, official)
- OpenRouter: openrouterteam/skills@openrouter-models (1K, official); openrouterteam/skills@openrouter-generations (392, official)
- LangFuse: langfuse/skills@langfuse (21.9K, official); langfuse/skills@langfuse-observability (213, official)

## MCP servers
- Supabase: official, hosted at https://mcp.supabase.com/mcp (source: github.com/supabase/mcp); OAuth; append ?read_only=true for read-only
- Redis: official, redis/mcp-redis (PyPI redis-mcp-server, run via uvx; stdio only)
- LangFuse: official, hosted at https://cloud.langfuse.com/api/public/mcp (Basic auth with project keys); docs recommend the LangFuse Agent Skill over MCP for bash-capable agents
