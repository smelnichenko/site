#!/bin/sh
set -e

# Default backend host if not set
API_BACKEND_HOST=${API_BACKEND_HOST:-monitor-monitor-app}

# Substitute environment variables in nginx config
envsubst '${API_BACKEND_HOST}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g 'daemon off;'
