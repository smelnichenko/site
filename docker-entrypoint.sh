#!/bin/sh
set -e

# Default backend host if not set
API_BACKEND_HOST=${API_BACKEND_HOST:-schnappy-gateway}
if [ -z "$DNS_RESOLVER" ]; then
  echo "ERROR: DNS_RESOLVER env var not set" >&2
  exit 1
fi

# Substitute environment variables in nginx config
envsubst '${API_BACKEND_HOST} ${DNS_RESOLVER}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g 'daemon off;'
