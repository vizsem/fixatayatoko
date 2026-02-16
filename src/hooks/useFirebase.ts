// Custom hooks untuk Firebase
import { useState, useEffect } from 'react';
import { Auth, User } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { FirebaseStorage } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';

export const useFirebaseAuth = () => {
  const [authInstance, setAuth] = useState<Auth | null>(auth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setAuth(auth);
  }, []);

  return { auth: authInstance, loading, error };
};

export const useFirestore = () => {
  const [dbInstance, setDb] = useState<Firestore | null>(db);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setDb(db);
  }, []);

  return { db: dbInstance, loading, error };
};

export const useFirebaseStorage = () => {
  const [storageInstance, setStorage] = useState<FirebaseStorage | null>(storage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setStorage(storage);
  }, []);

  return { storage: storageInstance, loading, error };
};

export const useFirebase = () => {
  const [services, setServices] = useState<{
    auth: Auth | null;
    db: Firestore | null;
    storage: FirebaseStorage | null;
  }>({ auth, db, storage });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setServices({ auth, db, storage });
  }, []);

  return { services, loading, error };
};