import { Centrifuge, Subscription, type SubscriptionState } from 'centrifuge';
import { getAccessToken } from './oidcClient';

// Centrifugo WebSocket endpoint. Path-based on the existing pmon.dev
// host so we share the wildcard cert and don't need a separate gateway
// hostname. The realtime chart's HTTPRoute attaches the same path prefix.
const WS_URL = `wss://${globalThis.location.host}/realtime/connection/websocket`;

// Per-channel subscription tokens are minted by admin's sub-token endpoint.
// Sub-token namespaces (chat, chess) are `protected: true` in Centrifugo,
// so the SDK calls this when subscribing.
async function fetchSubToken(channel: string): Promise<string> {
  const accessToken = await getAccessToken();
  const res = await fetch('/api/realtime/sub-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ channel }),
  });
  if (!res.ok) {
    throw new Error(`sub-token mint failed: ${res.status}`);
  }
  const body = (await res.json()) as { token: string; expires_in: number };
  return body.token;
}

let client: Centrifuge | null = null;

/**
 * Returns a singleton Centrifuge client wired with the user's Keycloak
 * access token for connection auth and the sub-token mint endpoint for
 * protected namespaces. Reuses the connection across pages.
 */
export function getCentrifugo(): Centrifuge {
  if (client) return client;

  client = new Centrifuge(WS_URL, {
    getToken: async () => {
      // Connection token = the same Keycloak access token used for REST.
      // Centrifugo verifies via JWKS against the Keycloak realm.
      const t = await getAccessToken();
      if (!t) throw new Error('not authenticated');
      return t;
    },
  });

  client.on('connecting', (ctx) => console.debug('[centrifugo] connecting', ctx));
  client.on('connected', (ctx) => console.debug('[centrifugo] connected', ctx));
  client.on('disconnected', (ctx) => console.debug('[centrifugo] disconnected', ctx));
  client.on('error', (ctx) => console.warn('[centrifugo] error', ctx));

  client.connect();
  return client;
}

export interface SubscribeOptions<T> {
  /** Called for each publication on the channel. */
  onPublication: (data: T) => void;
  /** Optional: called when the subscription state changes. */
  onState?: (state: SubscriptionState) => void;
}

/**
 * Subscribe to a protected namespace channel (chat, chess). The Centrifuge
 * SDK fetches a per-channel sub-token via getToken on subscribe; admin
 * mints it after a membership check.
 *
 * Returns the Subscription so the caller can unsubscribe on cleanup.
 */
export function subscribe<T>(channel: string, opts: SubscribeOptions<T>): Subscription {
  const c = getCentrifugo();
  const existing = c.getSubscription(channel);
  // Reuse if the page already subscribed (e.g. StrictMode double-effect).
  const sub = existing ?? c.newSubscription(channel, {
    getToken: () => fetchSubToken(channel),
  });

  sub.on('publication', (ctx) => opts.onPublication(ctx.data as T));
  if (opts.onState) {
    sub.on('state', (ctx) => opts.onState!(ctx.newState));
  }

  if (sub.state !== 'subscribed' && sub.state !== 'subscribing') {
    sub.subscribe();
  }
  return sub;
}

/** Tear down the Centrifuge client (test cleanup, logout). */
export function disconnectCentrifugo(): void {
  if (client) {
    client.disconnect();
    client = null;
  }
}
