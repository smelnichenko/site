# Site (Frontend)

React 18 + TypeScript + Vite 5 frontend for the monitor application. Keycloak PKCE auth, Recharts for data visualization.

## Quick Start

```bash
npm install
npm run dev          # http://localhost:3000 (proxies /api to backend)
npm run build        # Production build to dist/
npm run test         # Vitest
npm run test:cov     # Vitest with coverage
```

## Key Directories

```
src/
├── components/     # React components
├── pages/          # Route pages (Dashboard, Chat, Admin, etc.)
├── hooks/          # Custom React hooks
├── services/       # API client functions
├── auth/           # Keycloak PKCE integration
├── crypto.ts       # E2E encryption (Web Crypto API)
└── keyStore.ts     # In-memory key cache for E2E
```

## Pages

| Route | Component | Permission | Purpose |
|-------|-----------|------------|---------|
| `/` | Dashboard | METRICS | Overview with charts |
| `/page/:name` | PageDetail | METRICS | Stats, history |
| `/rss` | RssDashboard | METRICS | RSS feeds |
| `/monitors` | MonitorConfig | METRICS | CRUD for monitors |
| `/chat` | Chat | CHAT | Messaging |
| `/inbox` | Inbox | EMAIL | Received emails |
| `/game` | Game | PLAY | Game |
| `/admin` | Admin | MANAGE_USERS | User management |

## Build Info

Header tooltip shows `FE: abc1234 · Feb 1, 14:30` via Vite env vars (`VITE_GIT_HASH`, `VITE_BUILD_TIME`).

## Full Infrastructure Docs

See `schnappy/ops` repo `CLAUDE.md` for complete infrastructure documentation.
