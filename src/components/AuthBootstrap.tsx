'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { writeAccessTokenCookie } from '@/lib/auth-cookie';

import { auth } from '@/lib/firebase';
export default function AuthBootstrap() {
  useEffect(() => {
    // Salinan sesi untuk sisi server.
    //
    // Server Action dan proxy.ts TIDAK bisa membaca sesi supabase-js karena
    // sesi disimpan di localStorage. Tanpa salinan ini, seluruh action yang
    // memakai service role tidak punya cara memverifikasi pemanggilnya.
    // Cookie ini diperbarui setiap kali sesi berubah (masuk, keluar, atau
    // token diperbarui otomatis).
    supabase.auth.getSession().then(({ data }) => {
      writeAccessTokenCookie(data.session?.access_token ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      writeAccessTokenCookie(session?.access_token ?? null);

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
