# Site (Frontend)

React 19 single-page application for pmon.dev.

## Architecture

Built with Vite, served by Nginx in production. Authenticates against Keycloak via OIDC Authorization Code + PKCE (manual implementation, no external OIDC library) and sends the access token as a `Bearer` header on every `/api` call. Istio validates the JWT at the ingress and forwards to backend services.

```
Browser --> Nginx (this service) --> Istio ingress --> backend services
                                 --> /game/ (embedded Godot iframe)
        <-- Keycloak (OIDC PKCE login at auth.pmon.dev)
```

Real-time updates (chat messages, chess board state) are delivered by **REST polling** today — the backends expose STOMP/SockJS but the site does not connect to it. Plan 066 (`schnappy-realtime`) will migrate this to a Centrifugo SSE/WS subscription.

Two Web Workers run alongside the SPA: a **Hashcash PoW solver** for the registration anti-abuse challenge and a **Stockfish engine** for the human-vs-AI chess flow (the server still validates every move with `chesslib`, regardless of whether the AI or a human submitted it).

## Tech Stack

- React 19, TypeScript 5.9, Vite 7
- React Router 7
- Recharts (monitoring charts)
- chess.js + react-chessboard + stockfish.js (chess UI + AI)
- Web Crypto API — E2E chat encryption (ECDH P-256, AES-256-GCM, PBKDF2)
- Web Worker — Hashcash registration PoW
- Manual OIDC PKCE client (no `oidc-client-ts` dep)
- Nginx (alpine, rootless, runtime config templating via `envsubst`)
- Vitest (unit), Playwright (E2E)

## Pages

| Route | Permission | Purpose |
|-------|------------|---------|
| `/login`, `/auth/callback`, `/verify-email` | public | OIDC login flow |
| `/` | METRICS | Dashboard with monitoring charts |
| `/page/:pageName`, `/rss`, `/rss/:feedName` | METRICS | Monitor detail views |
| `/monitors` | METRICS | CRUD for page and RSS monitors |
| `/chat`, `/chat/:channelId` | CHAT | Real-time messaging |
| `/inbox` | EMAIL | Received emails |
| `/chess` | PLAY | Chess (PvP + AI via Stockfish) |
| `/game` | PLAY | Embedded Godot game |
| `/admin` | MANAGE_USERS | User and group management |

`ProtectedRoute` enforces both authentication and the per-route permission. A registered user with no permissions yet sees a pending-approval banner instead of any protected route.

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

1. Push to `main` triggers Woodpecker CD
2. `tsc --noEmit` + `vitest run --coverage` validate the build
3. Kaniko builds the container image (Node 22 builder → Nginx alpine runtime)
4. `GIT_HASH` and `BUILD_TIME` Docker build-args bake the version banner
5. Image pushed to Forgejo registry at `git.pmon.dev`
6. Woodpecker commits the new tag to `schnappy/infra`; Argo CD syncs

Production at `https://pmon.dev/` in the `schnappy-production-apps` namespace.
