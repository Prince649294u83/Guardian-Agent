# ── Guardian OpenEnv — Hugging Face Docker Space ──────────────────────────
# Build:  docker build -t guardian-openenv .
# Run:    docker run --rm -p 8000:8000 guardian-openenv
# ---------------------------------------------------------------------------
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Create a non-root user required by Hugging Face Spaces
RUN useradd -m -u 1000 appuser

WORKDIR /app

# ── Step 1: Install all deps EXCEPT openenv-core (avoids openai>=2 conflict)
COPY requirements.txt pyproject.toml ./
RUN pip install --no-cache-dir \
    fastapi>=0.115.0 \
    "httpx>=0.28.0,<1.0.0" \
    "openai>=1.60.0,<2.0.0" \
    "pydantic>=2.9.0,<3.0.0" \
    PyYAML>=6.0.0 \
    "uvicorn[standard]>=0.30.0"

# ── Step 2: Install openenv-core without its conflicting transitive deps
#    (openenv-core 0.2.x requires openai>=2.7.2 which conflicts with our 1.x pin)
RUN pip install --no-cache-dir --no-deps "openenv-core>=0.2.0"

# ── Step 3: Copy source and install the package itself
COPY guardian_openenv/ ./guardian_openenv/
COPY server/ ./server/
COPY openenv.yaml inference.py validate_submission.py README.md ./

RUN pip install --no-cache-dir --no-deps -e .

# Pre-create the outputs directory with correct permissions
RUN mkdir -p /app/outputs && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "8000"]
