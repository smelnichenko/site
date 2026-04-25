# Site (Frontend)

React single-page application for pmon.dev.

## Architecture

Served by Nginx, proxies all `/api` requests to the API gateway. Communicates with backend services exclusively through the gateway. Uses STOMP/SockJS WebSocket for real-time chat and chess. Implements client-side Hashcash PoW in a Web Worker and optional E2E encryption via Web Crypto API.

```
Browser --> Nginx (this service) --> API Gateway --> Backend services
                                 --> /game/ (embedded Godot iframe)
```

## Tech Stack

- React 18, TypeScript, Vite 5
- Recharts (monitoring charts)
- React Router (client-side routing)
- STOMP/SockJS (real-time chat and chess)
- Web Worker (Hashcash PoW captcha solving)
- Web Crypto API (E2E encryption: ECDH P-256, AES-256-GCM, PBKDF2)
- Nginx (production server with security headers)
- Vitest (unit tests)

## Pages

| Route | Permission | Purpose |
|-------|------------|---------|
| `/login`, `/register` | public | Authentication |
| `/` | METRICS | Dashboard with monitoring charts |
| `/monitors` | METRICS | CRUD for page and RSS monitors |
| `/chat` | CHAT | Real-time messaging |
| `/inbox` | EMAIL | Received emails |
| `/game` | PLAY | Embedded Godot game |
| `/admin` | MANAGE_USERS | User and group management |

## Development

```bash
npm install
npm run dev       # Dev server at http://localhost:3000, proxies /api to :8080
npm run build     # Production build to dist/
npm run test      # Run vitest
npm run coverage  # Test coverage report
```

## Deployment

Deployed to kubeadm via Argo CD GitOps:

1. Push to master triggers Woodpecker CD pipeline
2. `tsc --noEmit` and `vitest run --coverage` validate the build
3. Kaniko builds the container image (Nginx + static assets)
4. Image pushed to Forgejo registry at `git.pmon.dev`
5. Woodpecker commits new image tag to the `schnappy/infra` repo
6. Argo CD detects the change and syncs the Application

Production at `https://pmon.dev/` in the `monitor` namespace.
