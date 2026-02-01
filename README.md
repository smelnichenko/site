# Monitor Frontend

React dashboard for the Monitor application, displaying value graphs and monitoring statistics.

## Directory Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── PageCard.tsx         # Summary card for monitored pages
│   │   └── ValueChart.tsx       # Recharts line chart for values
│   ├── pages/
│   │   ├── Dashboard.tsx        # Main dashboard with all pages
│   │   └── PageDetail.tsx       # Detailed view for single page
│   ├── services/
│   │   └── api.ts               # API client for backend
│   ├── App.tsx                  # Main app with routing
│   ├── main.tsx                 # Entry point
│   └── index.css                # Global styles
├── Dockerfile                   # Multi-stage Docker build
├── nginx.conf.template          # Nginx config with security headers
├── docker-entrypoint.sh         # Runtime config injection
├── package.json                 # Dependencies
├── vite.config.ts               # Vite configuration
└── tsconfig.json                # TypeScript configuration
```

## Features

- **Dashboard View**: Overview of all monitored pages with current values
- **Value Graphs**: Historical line charts using Recharts
- **Page Details**: Detailed statistics and recent results table
- **Manual Checks**: Trigger immediate checks from the UI
- **Auto-refresh**: Dashboard updates every 60 seconds

## Prerequisites

- Node.js 20+
- npm or yarn

## Development

### Install dependencies

```bash
npm install
```

### Start development server

```bash
npm run dev
```

The dev server runs at http://localhost:3000 and proxies `/api` requests to the backend at http://localhost:8080.

### Build for production

```bash
npm run build
```

Output is in the `dist/` directory.

## Docker

### Build image

```bash
# Build for local architecture
docker build -t ghcr.io/schnappy/monitor-frontend:latest .

# Build multi-arch and push
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/schnappy/monitor-frontend:latest --push .
```

### Run locally

```bash
docker run -p 8080:8080 \
  -e API_BACKEND_HOST=host.docker.internal:8080 \
  ghcr.io/schnappy/monitor-frontend:latest
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BACKEND_HOST` | `monitor-monitor-app` | Backend API service hostname |

## Kubernetes Deployment

The frontend is deployed as part of the Monitor Helm chart. See [backend/deploy/README.md](../backend/deploy/README.md) for full deployment instructions.

### Helm Values

```yaml
frontend:
  enabled: true
  image:
    repository: ghcr.io/schnappy/monitor-frontend
    tag: latest
    pullPolicy: Always
  replicas: 1
  resources:
    requests:
      memory: "64Mi"
      cpu: "50m"
    limits:
      memory: "128Mi"
      cpu: "200m"
  service:
    type: ClusterIP
    port: 8080
```

### Ingress Routing

When frontend is enabled, the ingress routes:
- `/api/*` → Backend API service
- `/*` → Frontend service

### Access after deployment

```bash
# Via ingress (if configured)
curl http://monitor.local

# Via port-forward
kubectl port-forward svc/monitor-monitor-frontend 3000:8080 -n monitor
# Open http://localhost:3000
```

## Security

### Nginx Security Headers

The frontend nginx configuration includes:

- `X-Frame-Options: SAMEORIGIN` - Clickjacking protection
- `X-Content-Type-Options: nosniff` - MIME type sniffing protection
- `X-XSS-Protection: 1; mode=block` - XSS filter
- `Referrer-Policy: strict-origin-when-cross-origin` - Referrer control
- `Content-Security-Policy` - CSP restricting sources

### Container Security

- Runs as non-root user (nginx:101)
- Drops all Linux capabilities
- Security context enforced in Kubernetes

### API Security

- All user inputs are URL-encoded via `encodeURIComponent()`
- No sensitive data stored in frontend
- API calls proxied through nginx (no CORS issues)

## API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/monitor/pages` | GET | List all monitored page names |
| `/api/monitor/results` | GET | Get all results (paginated) |
| `/api/monitor/results/{pageName}` | GET | Get results for specific page |
| `/api/monitor/results/{pageName}/latest` | GET | Get latest result for page |
| `/api/monitor/stats/{pageName}` | GET | Get 24h statistics |
| `/api/monitor/check/{pageName}` | POST | Trigger manual check |

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Recharts** - Charting library
- **React Router** - Client-side routing
- **Nginx** - Production web server

## Troubleshooting

### Check frontend logs

```bash
kubectl logs -f deployment/monitor-monitor-frontend -n monitor
```

### Verify API connectivity

```bash
# From within the frontend pod
kubectl exec -it deployment/monitor-monitor-frontend -n monitor -- \
  wget -qO- http://monitor-monitor-app:8080/api/monitor/pages
```

### Check nginx config

```bash
kubectl exec -it deployment/monitor-monitor-frontend -n monitor -- \
  cat /etc/nginx/conf.d/default.conf
```

### Restart frontend

```bash
kubectl rollout restart deployment/monitor-monitor-frontend -n monitor
```
