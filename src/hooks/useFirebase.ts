// Custom hooks untuk Supabase (menggantikan Firebase)
import { supabase } from '@/lib/supabase';

export const useFirebaseAuth = () => {
  return { auth: supabase.auth, loading: false, error: null };
};

export const useFirestore = () => {
  return { db: supabase, loading: false, error: null };
};

export const useFirebaseStorage = () => {
  return { storage: supabase.storage, loading: false, error: null };
};

export const useFirebase = () => {
  return { 
    services: { auth: supabase.auth, db: supabase, storage: supabase.storage }, 
    loading: false, 
    error: null 
  };
};
