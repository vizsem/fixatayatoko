/**
 * Titik masuk otorisasi untuk Server Action.
 *
 * Dokumentasi Next.js (`data-security.md`) menyatakan tegas bahwa Server Action
 * adalah endpoint POST publik, dan pemeriksaan di tingkat halaman maupun
 * middleware TIDAK berlaku untuknya:
 *
 *   "A page-level authentication check does not extend to the Server Actions
 *    defined within it. Always re-verify inside the action."
 *
 * Karena itu SETIAP action yang memakai `supabaseAdmin` (yang melewati RLS)
 * wajib memanggil salah satu fungsi di modul ini di baris pertamanya.
 *
 * Cara kerja:
 *   1. Token akses Supabase diambil dari cookie `ataya-access-token`
 *      (atau dari argumen eksplisit bila diberikan).
 *   2. Keasliannya diperiksa Supabase lewat `auth.getUser(token)` — token tidak
 *      bisa dipalsukan karena ditandatangani Supabase.
 *   3. Peran pengguna dibaca dari `public.users.role`.
 *
 * Bila gagal, fungsi melempar `ActionAuthError`. Server Action Next.js tidak
 * mengembalikan pesan error ke klien di produksi, jadi kegagalan di sini
 * bersifat menolak (fail-closed), bukan sekadar peringatan.
 */

import { cookies } from 'next/headers';
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth-cookie';
import { authorize, type AccessLevel, type ActionErrorCode, type AdminIdentity } from '@/lib/actions/guard';

export { ACCESS_TOKEN_COOKIE };

export class ActionAuthError extends Error {
  readonly code: ActionErrorCode;

  constructor(code: ActionErrorCode, message: string) {
    super(message);
    this.name = 'ActionAuthError';
    this.code = code;
  }
}

/**
 * Ambil token akses: argumen eksplisit lebih dulu, lalu cookie.
 * Mengembalikan null bila tidak ada — pemanggil harus memperlakukannya sebagai
 * belum terautentikasi, bukan sebagai izin.
 */
export async function resolveAccessToken(
  explicitToken?: string | null
): Promise<string | null> {
  if (typeof explicitToken === 'string' && explicitToken.trim() !== '') {
    return explicitToken;
  }

  try {
    const store = await cookies();
    const fromCookie = store.get(ACCESS_TOKEN_COOKIE)?.value;
    if (!fromCookie || fromCookie.trim() === '') return null;
    try {
      return decodeURIComponent(fromCookie);
    } catch {
      return fromCookie;
    }
  } catch {
    // `cookies()` hanya tersedia selama permintaan berlangsung.
    return null;
  }
}

/**
 * Verifikasi identitas dan pastikan perannya memadai. Melempar bila tidak.
 *
 * @param level 'admin' untuk operasi tulis/mutasi, 'staff' untuk pembacaan.
 */
export async function requireIdentity(
  level: AccessLevel = 'admin',
  explicitToken?: string | null
): Promise<AdminIdentity> {
  const token = await resolveAccessToken(explicitToken);
  const result = await authorize(token, level);

  if (!result.ok) {
    throw new ActionAuthError(result.code, result.message);
  }

  return result.identity;
}

/** Wajib untuk operasi tulis, hapus, dan perubahan data. */
export function requireAdmin(explicitToken?: string | null): Promise<AdminIdentity> {
  return requireIdentity('admin', explicitToken);
}

/**
 * Untuk pembacaan data internal (laporan, daftar). Mencakup peran operasional
 * seperti kasir dan staf gudang, tetapi bukan pengguna anonim.
 */
export function requireStaff(explicitToken?: string | null): Promise<AdminIdentity> {
  return requireIdentity('staff', explicitToken);
}

/**
 * Pembungkus opsional untuk action yang mengembalikan `ActionResult` alih-alih
 * melempar. Berguna pada action yang ingin memberi pesan ramah ke UI.
 */
export async function authorizeAction<T>(
  level: AccessLevel,
  run: () => Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; code: ActionErrorCode; message: string }> {
  try {
    await requireIdentity(level);
  } catch (error) {
    if (error instanceof ActionAuthError) {
      return { ok: false, code: error.code, message: error.message };
    }
    throw error;
  }
  return { ok: true, data: await run() };
}
