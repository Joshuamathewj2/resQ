/**
 * @file tests/setup.ts
 * @description Global test setup for Vitest. Provides browser API mocks
 * that are unavailable in the jsdom environment.
 */

// Mock IndexedDB for incidentLogger tests
import 'fake-indexeddb/auto';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock navigator.geolocation
Object.defineProperty(global.navigator, 'geolocation', {
  value: {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(() => 1),
    clearWatch: vi.fn(),
  },
  writable: true,
});

// Mock DeviceMotionEvent
(global as unknown as { DeviceMotionEvent: unknown }).DeviceMotionEvent = class {
  static requestPermission = vi.fn().mockResolvedValue('granted');
};

// Suppress console output during tests (logger uses these internally)
vi.spyOn(console, 'log').mockImplementation(() => undefined);
vi.spyOn(console, 'warn').mockImplementation(() => undefined);
vi.spyOn(console, 'error').mockImplementation(() => undefined);
