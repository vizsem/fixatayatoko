import { describe, it, expect, vi } from 'vitest';
import { useFirebaseAuth, useFirestore, useFirebaseStorage, useFirebase } from './useFirebase';

// Mock the firebase module
vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  storage: {}
}));

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