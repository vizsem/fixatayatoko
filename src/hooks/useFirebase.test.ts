import { describe, it, expect, vi } from 'vitest';
import { useFirebaseAuth, useFirestore, useFirebaseStorage, useFirebase } from './useFirebase';
// Mock the firebase module
vi.mock('@/lib/firebase', () => {
  const M = Symbol('supabase_increment');
  return {
    auth: {},
    db: {},
    storage: {},
    INCREMENT_MARKER: M,
    increment: (n: any) => ({ [M]: true, delta: n }),
  };
});

vi.mock('@/lib/supabase', () => {
  const createQueryBuilder = () => {
    const builder: any = {};
    builder.select = vi.fn().mockReturnValue(builder);
    builder.eq = vi.fn().mockReturnValue(builder);
    builder.then = (onfulfilled: any, onrejected?: any) =>
      Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected);
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
      storage: {},
      from: vi.fn(() => createQueryBuilder()),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    supabaseAdmin: {
      from: vi.fn(() => createQueryBuilder()),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  };
});

describe('Firebase Hooks', () => {
  describe('useFirebaseAuth', () => {
    it('should return auth instance with correct structure', () => {
      const result = useFirebaseAuth();
      
      expect(result).toEqual({
        auth: expect.any(Object),
        loading: false,
        error: null
      });
      
      expect(result.auth).toEqual(expect.any(Object));
    });
  });

  describe('useFirestore', () => {
    it('should return firestore instance with correct structure', () => {
      const result = useFirestore();
      
      expect(result).toEqual({
        db: expect.any(Object),
        loading: false,
        error: null
      });
      
      expect(result.db).toEqual(expect.any(Object));
    });
  });

  describe('useFirebaseStorage', () => {
    it('should return storage instance with correct structure', () => {
      const result = useFirebaseStorage();
      
      expect(result).toEqual({
        storage: expect.any(Object),
        loading: false,
        error: null
      });
      
      expect(result.storage).toEqual(expect.any(Object));
    });
  });

  describe('useFirebase', () => {
    it('should return all firebase services with correct structure', () => {
      const result = useFirebase();
      
      expect(result).toEqual({
        services: {
          auth: expect.any(Object),
          db: expect.any(Object),
          storage: expect.any(Object)
        },
        loading: false,
        error: null
      });
      
      expect(result.services.auth).toEqual(expect.any(Object));
      expect(result.services.db).toEqual(expect.any(Object));
      expect(result.services.storage).toEqual(expect.any(Object));
    });
  });
});