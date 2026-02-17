// Custom hooks untuk Firebase
import { auth, db, storage } from '@/lib/firebase';

export const useFirebaseAuth = () => {
  return { auth, loading: false, error: null };
};

export const useFirestore = () => {
  return { db, loading: false, error: null };
};

export const useFirebaseStorage = () => {
  return { storage, loading: false, error: null };
};

export const useFirebase = () => {
  return { 
    services: { auth, db, storage }, 
    loading: false, 
    error: null 
  };
};