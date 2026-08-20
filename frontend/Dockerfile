# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
ARG APP_VERSION=dev
ENV VITE_APP_VERSION=$APP_VERSION
RUN npm run build

# Stage 2: Serve
FROM nginx:1.27-alpine

# Only substitute listed vars — a bare envsubst would wipe nginx $host / $uri.
ENV BACKEND_URL=http://backend:8000
ENV BACKEND_HOST_PORT=8001
ENV NGINX_ENVSUBST_FILTER=BACKEND_URL|NGINX_LOCAL_RESOLVERS

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.d/14-backend-url.sh /docker-entrypoint.d/14-backend-url.sh
COPY docker-entrypoint.d/16-ensure-resolver.sh /docker-entrypoint.d/16-ensure-resolver.sh
RUN chmod a-x \
    /docker-entrypoint.d/14-backend-url.sh \
    /docker-entrypoint.d/16-ensure-resolver.sh

EXPOSE 80
