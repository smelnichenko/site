# Site (Frontend)

React 19 SPA for pmon.dev. OIDC PKCE auth against Keycloak, REST API behind Nginx, two Web Workers (Hashcash, Stockfish), optional E2E chat encryption via Web Crypto.

## Quick Start

```bash
npm install
npm run dev            # http://localhost:3000 (Vite proxies /api → :8080)
npm run build          # static build → dist/
npm run test           # Vitest (jsdom)
npm run test:coverage  # coverage report
```

Playwright E2E lives in this repo (`@playwright/test`); run from `ops` for the integrated stack.

## Layout

```
src/
  main.tsx, App.tsx              router root + ProtectedRoute wiring
  pages/                         one component per route
    Login, AuthCallback, VerifyEmail        (public — OIDC flow)
    Dashboard, PageDetail                   (METRICS — page-monitor charts)
    RssDashboard, RssFeedDetail             (METRICS — RSS feed views)
    MonitorConfig                           (METRICS — page+RSS CRUD)
    Chat                                    (CHAT)
    Inbox                                   (EMAIL — received mail)
    Chess                                   (PLAY — PvP + AI)
    Game                                    (PLAY — Godot iframe)
    Admin                                   (MANAGE_USERS)
  components/
    ProtectedRoute.tsx           checks isAuthenticated + permission
    chat/                        ChannelList, MessageArea, modals
    chess/                       board UI + game controls
  contexts/
    AuthContext.tsx              auth state + hasPermission(p) helper
    LoadingContext.tsx           global spinner
  services/
    api.ts                       all REST calls + DTOs
    oidcClient.ts                manual OIDC PKCE (no oidc-client lib)
    crypto.ts                    Web Crypto: ECDH P-256, AES-256-GCM, PBKDF2
    keyStore.ts                  in-memory key cache (per-tab, lost on reload)
  hooks/
    useHashcash.ts               registration PoW solver (Web Worker)
    useStockfish.ts              loads stockfish.wasm.js as Worker
  workers/
    hashcash.ts, hashcash.worker.ts   PoW worker entry + algorithm
  config/
    oidc.ts                      Keycloak authority + clientId
public/
  stockfish.wasm, stockfish.wasm.js   loaded by useStockfish at runtime
nginx.conf, nginx.conf.template, security-headers*.conf, docker-entrypoint.sh
```

## Auth (OIDC PKCE, manual)

`config/oidc.ts`:

```ts
authority:  https://auth.pmon.dev/realms/schnappy
clientId:   app
redirectUri: <origin>/auth/callback
```

`services/oidcClient.ts` implements code-verifier / code-challenge by hand using Web Crypto SHA-256 — no `oidc-client-ts` or similar dep. The access token is sent as `Authorization: Bearer …` on every `/api` call; Istio validates it at the edge.

`AuthContext` tracks `{ isAuthenticated, email, permissions[], … }`. `permissions` comes from JWT claims; an empty array means **registered but pending approval** — `App.tsx` shows the pending banner instead of routing.

## Real-time strategy

centrifuge-js connects once at `wss://<origin>/realtime/connection/websocket` and multiplexes per-entity subscriptions. The wrapper is `services/centrifugoClient.ts`:

```ts
import { subscribe } from '../services/centrifugoClient';

const sub = subscribe<ChatMessage>(`chat:room:${channel.id}`, {
  onPublication: (msg) => /* update local state */,
});
// ... on unmount: sub.unsubscribe();
```

- **Connection auth**: `getToken` returns the user's Keycloak access token (from `oidcClient.getAccessToken`); Centrifugo verifies via JWKS at `auth.pmon.dev`. No separate connect mint.
- **Per-channel auth (protected namespaces)**: `getToken({ channel })` calls `POST /api/realtime/sub-token` on admin, which checks membership via the chat/chess `/internal/membership` endpoint and returns a 60 s HS256 sub-token.
- **Channels**:
  - `chat:room:<id>` — protected; subscribed by `MessageArea`. Publication = full `ChatMessage`; the handler decrypts and merges by `messageId`.
  - `chess:game:<uuid>` — protected; subscribed by `Chess.tsx` while the page is waiting on the opponent's move. Publication = full `ChessGameDto`.
- **Fallback poll**: each subscribing component still runs a 30 s REST poll while the subscription path soaks (was 3 s polling before Centrifugo). Drop after a clean week.

The Chat page (channel list) still uses REST + 10 s poll — the channel list isn't tied to a single broadcast channel and adding a per-user notifications subscription is deferred.

## Workers

- **Hashcash** (`workers/hashcash.worker.ts`, driven by `useHashcash`): SHA-256 PoW for registration anti-abuse. Solves off-thread; ~30k–300k hashes depending on difficulty from server.
- **Stockfish** (`hooks/useStockfish.ts` → `new Worker('/stockfish.wasm.js')`): browser chess engine for human-vs-AI. The site computes the AI move client-side, then submits to `POST /api/chess/games/{uuid}/ai-move` where the server validates with `chesslib` before broadcasting. Server **never** runs an engine.

## E2E chat encryption (opt-in)

`services/crypto.ts` and `services/keyStore.ts`. ECDH P-256 for shared-secret derivation, AES-256-GCM for message content, PBKDF2 for password-derived wrapping keys. Public keys go to the server (`POST /api/chat/keys`); private keys live in `keyStore` (in-memory, per-tab) — there's no IndexedDB persistence yet, so reload = re-derive from password.

Backend gate: `monitor.chat.e2e-enabled` env (per chat-service). When off, ciphertext fields are absent and the server stores plaintext.

## Production server (Nginx)

Multi-stage Docker (`Dockerfile`): Node 22 builder → `nginx:alpine` runtime. The runtime image runs as the `nginx` user on port 8080 (rootless container).

`nginx.conf.template` is rendered at container start by `docker-entrypoint.sh` via `envsubst`:

- `${API_BACKEND_HOST}` — defaults to `schnappy-gateway`, set per-env in the Helm chart
- `${DNS_RESOLVER}` — required, no fallback (entrypoint exits 1)

Nginx serves the SPA, proxies `/api/` to the backend, and includes `/etc/nginx/games.conf` — that file is mounted from a Helm ConfigMap and contains the `/game/...` proxy locations (currently the `game-scp` Godot export, served as static assets from the embedded game container).

CSP allows `frame-src https://auth.pmon.dev` (Keycloak iframe), `script-src 'self' 'wasm-unsafe-eval'` (Stockfish + Hashcash WebAssembly), and `connect-src 'self' https://auth.pmon.dev`. Don't add inline scripts — there's no `'unsafe-inline'` for `script-src`.

## Build info banner

Header tooltip shows `FE: <git-hash> · <build-time>`. Both come from Vite env vars baked at build time:

```dockerfile
ARG GIT_HASH=unknown
ARG BUILD_TIME
ENV VITE_GIT_HASH=${GIT_HASH}
ENV VITE_BUILD_TIME=${BUILD_TIME}
```

Woodpecker passes `GIT_HASH=$CI_COMMIT_SHA` and a Bash-generated `BUILD_TIME` at Kaniko `--build-arg`.

## Conventions specific to this service

- Routing assumes the backend permission set; if you add a new route, add it to `App.tsx` with the right `permission` and update `CLAUDE.md` here.
- All REST calls go through `services/api.ts` so DTO types are centralized — don't `fetch()` from components directly.
- The OIDC code is intentionally minimal/manual; if you find yourself wanting a library, first check whether the missing feature is silent token refresh (see `oidcClient.refreshToken`).
- Keycloak realm changes (claims, scopes, redirect URIs) are made in the `schnappy/keycloak-theme` repo's realm export and applied via `task deploy:keycloak-clients`.

## Full Infrastructure Docs

See `schnappy/ops` repo `CLAUDE.md`.
