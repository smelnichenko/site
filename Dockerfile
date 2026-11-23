# Build stage
FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS builder

# Build arguments for version info
ARG GIT_HASH=unknown
ARG BUILD_TIME

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build with version info passed as env vars
ENV VITE_GIT_HASH=${GIT_HASH}
ENV VITE_BUILD_TIME=${BUILD_TIME}
RUN npm run build

# Production stage
FROM nginx:alpine@sha256:fb4658584bd9a916ffb6f6e365f97c25cfdb2923801f551ea08356e695f14ff7

# Install envsubst (part of gettext)
RUN apk add --no-cache gettext

# Copy nginx config (override default to drop 'user' directive for non-root)
COPY nginx.conf /etc/nginx/nginx.conf
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY security-headers.conf /etc/nginx/security-headers.conf
COPY security-headers-base.conf /etc/nginx/security-headers-base.conf

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Create necessary directories and set permissions for nginx user
RUN mkdir -p /var/cache/nginx /var/run && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Run as nginx user
USER nginx

# Use custom entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
