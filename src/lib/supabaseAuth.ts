// src/lib/supabaseAuth.ts
import { supabase } from './supabase';
import { writeAccessTokenCookie } from './auth-cookie';

/**
 * Salin token akses Supabase ke cookie agar server dapat melihat sesi.
 *
 * supabase-js menyimpan sesi di localStorage, yang tidak terbaca oleh server.
 * Tanpa salinan ini, `proxy.ts` (gerbang halaman admin) dan pemeriksaan
 * otorisasi di dalam Server Action tidak punya cara mengenali pemanggilnya.
 */
export const syncSessionCookie = async () => {
  const { data } = await supabase.auth.getSession();
  const session = data.session ?? null;
  writeAccessTokenCookie(session?.access_token ?? null);
  return session;
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  // Tulis cookie SEKETIKA setelah berhasil masuk. Bila hanya mengandalkan
  // `AuthBootstrap`, ada jeda sepersekian detik ketika halaman admin sudah
  // meminta token padahal cookie-nya belum ada.
  if (!error && data.session?.access_token) {
    writeAccessTokenCookie(data.session.access_token);
  }

  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  writeAccessTokenCookie(null);
  return { error };
};

export const getUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
};

export const signUp = async (email: string, password: string, metadata?: Record<string, any>) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
  return { data, error };
};
