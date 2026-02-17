import { describe, it, expect, vi } from 'vitest';
import { useFirebaseAuth, useFirestore, useFirebaseStorage, useFirebase } from './useFirebase';

// Mock Firebase services
const mockAuth = {};
const mockDb = {};
const mockStorage = {};

// Mock the firebase module
vi.mock('@/lib/firebase', () => ({
  auth: mockAuth,
  db: mockDb,
  storage: mockStorage
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
      
      expect(result.auth).toBe(mockAuth);
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
      
      expect(result.db).toBe(mockDb);
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
      
      expect(result.storage).toBe(mockStorage);
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
      
      expect(result.services.auth).toBe(mockAuth);
      expect(result.services.db).toBe(mockDb);
      expect(result.services.storage).toBe(mockStorage);
    });
  });
});