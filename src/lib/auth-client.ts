'use client';

import { supabase } from '@/lib/supabase';

/**
 * Ambil token akses Supabase dari sesi yang tersimpan di browser.
 *
 * Token ini dikirim sebagai argumen ke Server Action, lalu diverifikasi
 * keasliannya di server dengan `supabaseAdmin.auth.getUser(token)`.
 *
 * Ini menggantikan cookie `admin-token` sebagai dasar otorisasi: cookie itu
 * hanya berisi string `"true"` yang di-set oleh JavaScript, sehingga siapa pun
 * bisa memalsukannya. Token akses tidak bisa dipalsukan karena ditandatangani
 * oleh Supabase.
 *
 * Mengembalikan `null` bila tidak ada sesi (pemanggil harus menanganinya).
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
