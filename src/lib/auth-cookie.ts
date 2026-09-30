/**
 * Kontrak cookie token akses Supabase.
 *
 * Modul ini SENGAJA tidak mengimpor apa pun dari server maupun klien, supaya
 * aman dipakai di kedua sisi:
 *   - `src/components/AuthBootstrap.tsx` (klien) menulis cookie ini
 *   - `src/lib/actions/session.ts` dan `proxy.ts` (server) membacanya
 *
 * Jangan pindahkan konstanta ini ke `src/lib/actions/session.ts`: modul itu
 * mengimpor `next/headers` dan service role, sehingga akan meledak bila ikut
 * ter-bundle ke browser.
 */

/** Nama cookie yang membawa token akses Supabase. */
export const ACCESS_TOKEN_COOKIE = 'ataya-access-token';

/**
 * Umur cookie dalam detik. Token akses Supabase berlaku sekitar 1 jam dan
 * diperbarui otomatis oleh supabase-js, yang akan memicu penulisan ulang
 * cookie lewat event `TOKEN_REFRESHED`.
 */
export const ACCESS_TOKEN_MAX_AGE = 3600;

/** Tulis/hapus cookie token akses. Hanya no-op bila dijalankan di server. */
export function writeAccessTokenCookie(token: string | null): void {
  if (typeof document === 'undefined') return;

  if (token) {
    document.cookie =
      `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; ` +
      `path=/; max-age=${ACCESS_TOKEN_MAX_AGE}; SameSite=Lax`;
  } else {
    document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}
