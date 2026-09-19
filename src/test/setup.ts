import '@testing-library/jest-dom';

// Formatted dates in assertions must not depend on the machine: the workstation is Europe/Tallinn, CI is UTC.
process.env.TZ = 'Europe/Tallinn';

// jsdom 28+ changed localStorage to use a Proxy that doesn't expose standard methods.
// Provide a proper localStorage mock for tests that need it.
if (typeof globalThis.localStorage?.clear !== 'function') {
  const store: Record<string, string> = {};
  const localStorageMock: Storage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((key) => delete store[key]);
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
}
