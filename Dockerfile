# syntax=docker/dockerfile:1
# Stage 1: Build frontend on the builder's native CPU (avoids QEMU+V8 crashes on arm64 targets).
FROM --platform=$BUILDPLATFORM node:20-alpine AS frontend-build
WORKDIR /app
ARG DEV_MODE=false
ARG APP_VERSION=0.6.6-alpha
ENV VITE_DEV_MODE=${DEV_MODE}
ENV VITE_APP_VERSION=${APP_VERSION}
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/. .
RUN npm run build

# Stage 2: Python runtime
FROM python:3.12-slim
WORKDIR /app
ENV APP_VERSION=0.9.8-beta

# Copy backend source
COPY backend/. /app

# Copy built frontend static files
COPY --from=frontend-build /app/dist /app/frontend_dist

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy and make executable the entrypoint script that runs migrations before startup
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 3080

CMD ["/app/entrypoint.sh"]
