# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:1.27-alpine

# Only substitute BACKEND_URL — a bare envsubst would wipe nginx $host / $uri.
ENV BACKEND_URL=http://backend:8000
ENV BACKEND_HOST_PORT=8001
ENV NGINX_ENVSUBST_FILTER=BACKEND_URL

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.d/15-backend-url.sh /docker-entrypoint.d/15-backend-url.sh

EXPOSE 80
