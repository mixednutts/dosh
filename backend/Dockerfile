# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
ARG DEV_MODE=false
ARG APP_VERSION=0.6.0-alpha
ENV VITE_DEV_MODE=${DEV_MODE}
ENV VITE_APP_VERSION=${APP_VERSION}
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/. .
RUN npm run build

# Stage 2: Python runtime
FROM python:3.12-slim
WORKDIR /app
ENV APP_VERSION=0.6.4-alpha

# Copy backend source
COPY backend/. /app

# Copy built frontend static files
COPY --from=frontend-build /app/dist /app/frontend_dist

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 80

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80"]
