import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import * as oidcClient from './oidcClient';

vi.mock('./oidcClient', () => ({
  getAccessToken: vi.fn(),
}));

type Handler = (ctx: unknown) => void;

interface MockSubscription {
  state: string;
  getToken?: () => Promise<string>;
  handlers: Record<string, Handler>;
  on: Mock<(event: string, handler: Handler) => MockSubscription>;
  subscribe: Mock<() => void>;
  unsubscribe: Mock<() => void>;
}

interface MockCentrifuge {
  getToken: () => Promise<string>;
  subscriptions: Record<string, MockSubscription>;
  handlers: Record<string, Handler>;
  on: Mock<(event: string, handler: Handler) => MockCentrifuge>;
  connect: Mock<() => void>;
  disconnect: Mock<() => void>;
  getSubscription: Mock<(channel: string) => MockSubscription | null>;
  newSubscription: Mock<
    (channel: string, subOpts?: { getToken?: () => Promise<string> }) => MockSubscription
  >;
}

// Track how many clients were constructed plus the most recent
// client/subscription so tests can drive the SDK callbacks (getToken,
// publication, state) without touching real WebSockets.
let clientCount = 0;
let currentClient: MockCentrifuge | null = null;
let currentSubscription: MockSubscription | null = null;

function makeSubscription(opts?: { getToken?: () => Promise<string> }): MockSubscription {
  const handlers: Record<string, Handler> = {};
  const sub: MockSubscription = {
    state: 'unsubscribed',
    getToken: opts?.getToken,
    handlers,
    on: vi.fn((event: string, handler: Handler) => {
      handlers[event] = handler;
      return sub;
    }),
    subscribe: vi.fn(() => {
      sub.state = 'subscribing';
    }),
    unsubscribe: vi.fn(() => {
      sub.state = 'unsubscribed';
    }),
  };
  currentSubscription = sub;
  return sub;
}

function makeCentrifuge(opts: { getToken: () => Promise<string> }): MockCentrifuge {
  const handlers: Record<string, Handler> = {};
  const channels: Record<string, MockSubscription> = {};
  const client: MockCentrifuge = {
    getToken: opts.getToken,
    subscriptions: channels,
    handlers,
    on: vi.fn((event: string, handler: Handler) => {
      handlers[event] = handler;
      return client;
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    getSubscription: vi.fn((channel: string) => channels[channel] ?? null),
    newSubscription: vi.fn((channel: string, subOpts?: { getToken?: () => Promise<string> }) => {
      const sub = makeSubscription(subOpts);
      channels[channel] = sub;
      return sub;
    }),
  };
  clientCount += 1;
  currentClient = client;
  return client;
}

vi.mock('centrifuge', () => ({
  // The SDK is used with `new Centrifuge(...)`; a function returning an object
  // satisfies that call form.
  Centrifuge: function Centrifuge(_url: string, opts: { getToken: () => Promise<string> }) {
    return makeCentrifuge(opts);
  },
}));

// Import after the mocks are registered so the singleton picks up the mock.
const { getCentrifugo, subscribe, disconnectCentrifugo } = await import('./centrifugoClient');

function lastClient(): MockCentrifuge {
  if (!currentClient) throw new Error('no client constructed');
  return currentClient;
}

function lastSubscription(): MockSubscription {
  if (!currentSubscription) throw new Error('no subscription constructed');
  return currentSubscription;
}

beforeEach(() => {
  vi.clearAllMocks();
  clientCount = 0;
  currentClient = null;
  currentSubscription = null;
  disconnectCentrifugo();
  vi.mocked(oidcClient.getAccessToken).mockReset();
  vi.spyOn(globalThis, 'fetch');
});

describe('centrifugoClient', () => {
  describe('getCentrifugo', () => {
    it('constructs a single client and connects', () => {
      const client = getCentrifugo();
      expect(clientCount).toBe(1);
      expect(lastClient().connect).toHaveBeenCalled();
      expect(client).toBe(lastClient());
    });

    it('reuses the singleton on repeated calls', () => {
      const first = getCentrifugo();
      const second = getCentrifugo();
      expect(first).toBe(second);
      expect(clientCount).toBe(1);
    });

    it('registers connection lifecycle listeners', () => {
      getCentrifugo();
      const events = lastClient().on.mock.calls.map((c) => c[0]);
      expect(events).toEqual(
        expect.arrayContaining(['connecting', 'connected', 'disconnected', 'error']),
      );
      // Exercise the listener bodies (they only log).
      lastClient().handlers.connecting({});
      lastClient().handlers.connected({});
      lastClient().handlers.disconnected({});
      lastClient().handlers.error({});
    });

    it('connection getToken returns the Keycloak access token', async () => {
      vi.mocked(oidcClient.getAccessToken).mockResolvedValue('kc-token');
      getCentrifugo();
      await expect(lastClient().getToken()).resolves.toBe('kc-token');
    });

    it('connection getToken throws when not authenticated', async () => {
      vi.mocked(oidcClient.getAccessToken).mockResolvedValue(null);
      getCentrifugo();
      await expect(lastClient().getToken()).rejects.toThrow('not authenticated');
    });
  });

  describe('subscribe', () => {
    it('creates a subscription and subscribes when not already active', () => {
      const onPublication = vi.fn();
      const sub = subscribe('chat:room:1', { onPublication });
      expect(lastClient().newSubscription).toHaveBeenCalledWith('chat:room:1', expect.any(Object));
      expect(sub.subscribe).toHaveBeenCalled();
    });

    it('dispatches publication data to onPublication', () => {
      const onPublication = vi.fn();
      subscribe<{ value: number }>('chat:room:1', { onPublication });
      lastSubscription().handlers.publication({ data: { value: 42 } });
      expect(onPublication).toHaveBeenCalledWith({ value: 42 });
    });

    it('forwards state changes to onState when provided', () => {
      const onState = vi.fn();
      subscribe('chat:room:1', { onPublication: vi.fn(), onState });
      lastSubscription().handlers.state({ newState: 'subscribed' });
      expect(onState).toHaveBeenCalledWith('subscribed');
    });

    it('does not register a state listener when onState is omitted', () => {
      subscribe('chat:room:1', { onPublication: vi.fn() });
      const events = lastSubscription().on.mock.calls.map((c) => c[0]);
      expect(events).not.toContain('state');
    });

    it('reuses an existing subscription instead of recreating it', () => {
      subscribe('chat:room:1', { onPublication: vi.fn() });
      const created = lastClient().newSubscription.mock.calls.length;
      // Mark as already subscribed so subscribe() is not called again.
      lastSubscription().state = 'subscribed';
      subscribe('chat:room:1', { onPublication: vi.fn() });
      expect(lastClient().newSubscription.mock.calls.length).toBe(created);
    });

    it('does not call subscribe again when already subscribing', () => {
      subscribe('chat:room:1', { onPublication: vi.fn() });
      const sub = lastSubscription();
      sub.subscribe.mockClear();
      sub.state = 'subscribing';
      subscribe('chat:room:1', { onPublication: vi.fn() });
      expect(sub.subscribe).not.toHaveBeenCalled();
    });

    it('mints a sub-token via the subscription getToken', async () => {
      vi.mocked(oidcClient.getAccessToken).mockResolvedValue('kc-token');
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ token: 'sub-token', expires_in: 60 }), { status: 200 }),
      );
      subscribe('chat:room:1', { onPublication: vi.fn() });

      const token = await lastSubscription().getToken?.();
      expect(token).toBe('sub-token');
      const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(url).toBe('/api/realtime/sub-token');
      expect(init?.method).toBe('POST');
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer kc-token');
    });

    it('omits the Authorization header when there is no access token', async () => {
      vi.mocked(oidcClient.getAccessToken).mockResolvedValue(null);
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ token: 'sub-token', expires_in: 60 }), { status: 200 }),
      );
      subscribe('chat:room:1', { onPublication: vi.fn() });

      await lastSubscription().getToken?.();
      const headers = vi.mocked(globalThis.fetch).mock.calls[0][1]?.headers as Record<
        string,
        string
      >;
      expect(headers.Authorization).toBeUndefined();
    });

    it('throws when sub-token mint fails', async () => {
      vi.mocked(oidcClient.getAccessToken).mockResolvedValue('kc-token');
      vi.mocked(globalThis.fetch).mockResolvedValue(new Response('nope', { status: 403 }));
      subscribe('chat:room:1', { onPublication: vi.fn() });

      await expect(lastSubscription().getToken?.()).rejects.toThrow('sub-token mint failed: 403');
    });
  });

  describe('disconnectCentrifugo', () => {
    it('disconnects and clears the singleton', () => {
      const client = getCentrifugo();
      disconnectCentrifugo();
      expect(client.disconnect).toHaveBeenCalled();
      // A fresh client is constructed after teardown.
      getCentrifugo();
      expect(clientCount).toBe(2);
    });

    it('is a no-op when no client exists', () => {
      expect(() => disconnectCentrifugo()).not.toThrow();
    });
  });
});
