#!/bin/sh
set -e

# Default backend hosts if not set
API_BACKEND_HOST=${API_BACKEND_HOST:-schnappy-gateway}
GAME_BACKEND_HOST=${GAME_BACKEND_HOST:-schnappy-game-scp}
DNS_RESOLVER=$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf 2>/dev/null)
DNS_RESOLVER=${DNS_RESOLVER:-10.43.0.10}

# Substitute environment variables in nginx config
envsubst '${API_BACKEND_HOST} ${GAME_BACKEND_HOST} ${DNS_RESOLVER}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g 'daemon off;'
