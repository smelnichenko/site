#!/bin/sh
set -e

# Default backend hosts if not set
API_BACKEND_HOST=${API_BACKEND_HOST:-schnappy-gateway}
GAME_BACKEND_HOST=${GAME_BACKEND_HOST:-schnappy-game-scp}

# Substitute environment variables in nginx config
envsubst '${API_BACKEND_HOST} ${GAME_BACKEND_HOST}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g 'daemon off;'
