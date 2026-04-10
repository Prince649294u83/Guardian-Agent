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

# Install Python dependencies first (cached layer)
COPY requirements.txt pyproject.toml ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source and install the package itself in non-editable mode
COPY guardian_openenv/ ./guardian_openenv/
COPY server/ ./server/
COPY openenv.yaml inference.py validate_submission.py README.md ./

# Install the guardian_openenv package so its entry-points are discoverable
RUN pip install --no-cache-dir --no-deps -e .

# Pre-create the outputs directory with correct permissions
RUN mkdir -p /app/outputs && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "8000"]
