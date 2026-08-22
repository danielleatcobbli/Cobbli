# Cobbli FastAPI backend — container image.
#
# Portable artifact: runs identically on AWS App Runner now and ECS Fargate
# later (same image, no app changes). App Runner injects PORT; we honor it.
FROM public.ecr.aws/docker/library/python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install deps first for layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App code (api/ Vercel shim is intentionally excluded via .dockerignore).
COPY app ./app

# Non-root runtime user.
RUN useradd --create-home --uid 10001 appuser
USER appuser

# App Runner sets PORT (default 8080). uvicorn binds to it at runtime.
ENV PORT=8080
EXPOSE 8080

# Shell form so ${PORT} expands at container start.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'
