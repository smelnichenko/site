# Site (Frontend)

React single-page application for pmon.dev.

## Architecture

Served by Nginx in production. Authenticates against Keycloak via OIDC Authorization Code + PKCE; the access token is sent on every `/api` request and validated by the Istio ingress gateway. WebSocket connections (chat, chess) are upgraded through the same gateway. Implements client-side Hashcash PoW in a Web Worker (registration anti-abuse) and optional E2E encryption for chat via Web Crypto API.

```
Browser --> Nginx (this service) --> Istio ingress --> backend services
                                 --> /game/ (embedded Godot iframe)
        <-- Keycloak (OIDC PKCE login)
```

## Tech Stack

- React 19, TypeScript, Vite 7
- React Router 7 (client-side routing)
- Recharts (monitoring charts)
- chess.js + react-chessboard + stockfish.js (chess UI + AI)
- OIDC client (Authorization Code + PKCE, manual implementation against Keycloak)
- Spring WebSocket / SockJS-compatible client (chat, chess real-time)
- Web Worker — Hashcash PoW captcha solving
- Web Crypto API — E2E chat encryption (ECDH P-256, AES-256-GCM, PBKDF2)
- Nginx (production server with security headers)
- Vitest (unit tests), Playwright (E2E)

## Pages

| Route | Permission | Purpose |
|-------|------------|---------|
| `/login`, `/auth/callback`, `/verify-email` | public | OIDC login flow |
| `/` | METRICS | Dashboard with monitoring charts |
| `/monitors` | METRICS | CRUD for page and RSS monitors |
| `/page/:pageName`, `/rss`, `/rss/:feedName` | METRICS | Monitor detail views |
| `/chat`, `/chat/:channelId` | CHAT | Real-time messaging |
| `/inbox` | EMAIL | Received emails |
| `/chess` | PLAY | Chess (PvP + AI via Stockfish) |
| `/game` | PLAY | Embedded Godot game |
| `/admin` | MANAGE_USERS | User and group management |

## Development

```bash
npm install
npm run dev            # Dev server at http://localhost:3000, proxies /api to :8080
npm run build          # Production build to dist/
npm run test           # Vitest
npm run test:coverage  # Coverage report
```

## Deployment

Deployed to kubeadm via Argo CD GitOps:

1. Push to master triggers Woodpecker CD
2. `tsc --noEmit` + `vitest run --coverage` validate the build
3. Kaniko builds the container image (Nginx + static assets)
4. Image pushed to Forgejo registry at `git.pmon.dev`
5. Woodpecker commits the new tag to `schnappy/infra`
6. Argo CD syncs the Application

Production at `https://pmon.dev/` in the `schnappy-production-apps` namespace.
