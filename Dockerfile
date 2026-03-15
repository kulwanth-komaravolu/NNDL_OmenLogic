# Stage 1: Build environment
FROM python:3.13-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
# Copy dependency files
COPY pyproject.toml uv.lock ./
# This ensures uv installs exactly what's in your lockfile
RUN uv sync --frozen --no-install-project

# Stage 2: Runtime environment
FROM python:3.13-slim
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY . .

ENV PATH="/app/.venv/bin:$PATH"
CMD uvicorn src.omenlogic.main:app --host 0.0.0.0 --port ${PORT:-8000}
