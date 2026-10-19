# Stage 1: Build
FROM node:20-alpine AS builder

# Enable corepack so pnpm is available without a separate install step
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ARG APP_VERSION=dev
ENV VITE_APP_VERSION=$APP_VERSION
RUN pnpm run build

# Stage 2: Serve
FROM nginx:1.27-alpine

# Only substitute BACKEND_URL — a bare envsubst would wipe nginx $host / $uri.
ENV BACKEND_URL=http://backend:8000
ENV BACKEND_HOST_PORT=8001
ENV NGINX_ENVSUBST_FILTER=BACKEND_URL

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.d/14-backend-url.envsh /docker-entrypoint.d/14-backend-url.envsh
RUN chmod +x /docker-entrypoint.d/14-backend-url.envsh

EXPOSE 80
