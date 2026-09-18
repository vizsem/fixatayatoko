'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

import { auth } from '@/lib/firebase';
export default function AuthBootstrap() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        try {
          localStorage.setItem('temp_user_id', session.user.id);
        } catch {}
      } else {
        // Guest/anonymous: generate a temp ID if not already set
        try {
          if (!localStorage.getItem('temp_user_id')) {
            localStorage.setItem('temp_user_id', crypto.randomUUID());
          }
        } catch {}
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
