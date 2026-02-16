// Custom hooks untuk Firebase dengan lazy loading
import { useState, useEffect } from 'react';
import { Auth, User } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { FirebaseStorage } from 'firebase/storage';
import { getFirebaseServices, getFirebaseAuth, getFirestoreDB, getFirebaseStorage } from '@/lib/firebase-lazy';

export const useFirebaseAuth = () => {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);
        const authInstance = await getFirebaseAuth();
        setAuth(authInstance);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  return { auth, loading, error };
};

export const useFirestore = () => {
  const [db, setDb] = useState<Firestore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeFirestore = async () => {
      try {
        setLoading(true);
        const dbInstance = await getFirestoreDB();
        setDb(dbInstance);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    initializeFirestore();
  }, []);

  return { db, loading, error };
};

export const useFirebaseStorage = () => {
  const [storage, setStorage] = useState<FirebaseStorage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeStorage = async () => {
      try {
        setLoading(true);
        const storageInstance = await getFirebaseStorage();
        setStorage(storageInstance);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    initializeStorage();
  }, []);

  return { storage, loading, error };
};

export const useFirebase = () => {
  const [services, setServices] = useState<{
    auth: Auth | null;
    db: Firestore | null;
    storage: FirebaseStorage | null;
  }>({ auth: null, db: null, storage: null });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeAll = async () => {
      try {
        setLoading(true);
        const firebaseServices = await getFirebaseServices();
        setServices(firebaseServices);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    initializeAll();
  }, []);

  return { ...services, loading, error };
};