import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

const GLOBAL_INCREMENT_MARKER = Symbol('supabase_increment');
vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  storage: {},
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => null })),
  getDocs: vi.fn(async () => ({ docs: [], size: 0 })),
  onSnapshot: vi.fn(() => () => {}),
  onAuthStateChanged: vi.fn(() => () => {}),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  startAt: vi.fn(),
  endAt: vi.fn(),
  endBefore: vi.fn(),
  serverTimestamp: vi.fn(() => new Date().toISOString()),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(),
  })),
  runTransaction: vi.fn(async (_db, fn) => {
    const tx = { get: vi.fn(), set: vi.fn(), update: vi.fn(), delete: vi.fn() };
    return await fn(tx);
  }),
  increment: (n: number) => ({ [GLOBAL_INCREMENT_MARKER as any]: true, delta: n }),
  INCREMENT_MARKER: GLOBAL_INCREMENT_MARKER,
  arrayUnion: vi.fn((v) => v),
  arrayRemove: vi.fn((v) => v),
  ref: vi.fn(),
}));

vi.mock('@/lib/supabase', () => {
  const createQueryBuilder = (defaultData: any = []) => {
    const builder: any = {};
    builder.select = vi.fn().mockReturnValue(builder);
    builder.eq = vi.fn().mockReturnValue(builder);
    builder.neq = vi.fn().mockReturnValue(builder);
    builder.gt = vi.fn().mockReturnValue(builder);
    builder.lt = vi.fn().mockReturnValue(builder);
    builder.gte = vi.fn().mockReturnValue(builder);
    builder.lte = vi.fn().mockReturnValue(builder);
    builder.order = vi.fn().mockReturnValue(builder);
    builder.limit = vi.fn().mockReturnValue(builder);
    builder.range = vi.fn().mockReturnValue(builder);
    builder.single = vi.fn().mockResolvedValue({ data: null, error: null });
    builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    builder.insert = vi.fn().mockReturnValue(builder);
    builder.update = vi.fn().mockReturnValue(builder);
    builder.delete = vi.fn().mockReturnValue(builder);
    builder.upsert = vi.fn().mockReturnValue(builder);
    builder.in = vi.fn().mockReturnValue(builder);
    builder.contains = vi.fn().mockReturnValue(builder);
    builder.containedBy = vi.fn().mockReturnValue(builder);
    builder.rangeGt = vi.fn().mockReturnValue(builder);
    builder.rangeGte = vi.fn().mockReturnValue(builder);
    builder.rangeLt = vi.fn().mockReturnValue(builder);
    builder.rangeLte = vi.fn().mockReturnValue(builder);
    builder.rangeAdjacent = vi.fn().mockReturnValue(builder);
    builder.overlaps = vi.fn().mockReturnValue(builder);
    builder.match = vi.fn().mockReturnValue(builder);
    builder.ilike = vi.fn().mockReturnValue(builder);
    builder.like = vi.fn().mockReturnValue(builder);
    builder.not = vi.fn().mockReturnValue(builder);
    builder.or = vi.fn().mockReturnValue(builder);
    builder.and = vi.fn().mockReturnValue(builder);
    builder.filter = vi.fn().mockReturnValue(builder);
    builder.set = vi.fn().mockResolvedValue({ data: null, error: null });
    builder.then = (onfulfilled: any, onrejected?: any) =>
      Promise.resolve({ data: defaultData, error: null }).then(onfulfilled, onrejected);
    return builder;
  };

  return {
    supabase: {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'test-user', app_metadata: { role: 'admin' } } },
          error: null,
        })),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        signInWithPassword: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
        signOut: vi.fn(async () => ({ error: null })),
      },
      from: vi.fn(() => createQueryBuilder([])),
      storage: {},
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    supabaseAdmin: {
      from: vi.fn(() => createQueryBuilder([])),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'admin-user', app_metadata: { role: 'admin' } } },
          error: null,
        })),
      },
    },
  };
});

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));