/**
 * Otorisasi untuk Server Action.
 *
 * Latar belakang: seluruh `src/lib/actions/*` memakai `supabaseAdmin` yang
 * MELEWATI RLS. Sebelumnya otorisasi hanya mengandalkan middleware `/admin/*`,
 * dan cookie `admin-token` ternyata hanya berisi string `"true"` yang di-set
 * oleh JavaScript di browser — sehingga bisa dipalsukan siapa saja. Setiap
 * action yang memakai service role karena itu WAJIB memverifikasi identitas
 * sendiri di sini.
 *
 * Verifikasi memakai token akses Supabase milik klien, yang diperiksa
 * keasliannya oleh Supabase (`supabaseAdmin.auth.getUser(token)`). Token ini
 * tidak bisa dipalsukan karena ditandatangani oleh Supabase, berbeda dengan
 * cookie `admin-token`.
 *
 * Alur: klien memanggil `getAccessToken()` (lihat `src/lib/auth-client.ts`),
 * lalu mengirimkannya sebagai argumen pertama ke setiap action.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { isAdminRole, isStaffOrAdmin } from '@/lib/auth-helpers';

// Jaring pengaman: modul ini memegang service role key, jadi tidak boleh
// sampai ikut ter-bundle ke browser karena salah impor.
if (typeof window !== 'undefined') {
  throw new Error(
    'src/lib/actions/guard.ts hanya boleh dijalankan di server. ' +
      'Jangan impor modul ini dari client component.'
  );
}

/** Tingkat izin yang dibutuhkan sebuah action. */
export type AccessLevel = 'admin' | 'staff';

export type ActionErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SCHEMA_NOT_READY'
  | 'INTERNAL';

export interface ActionFailure {
  ok: false;
  code: ActionErrorCode;
  message: string;
}

export interface ActionSuccess<T> {
  ok: true;
  data: T;
}

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export function fail(code: ActionErrorCode, message: string): ActionFailure {
  return { ok: false, code, message };
}

export function succeed<T>(data: T): ActionSuccess<T> {
  return { ok: true, data };
}

export interface AdminIdentity {
  /** `public.users.id` (UUID). */
  userId: string;
  email: string | null;
  role: string;
}

export type AuthorizeResult =
  | { ok: true; identity: AdminIdentity }
  | ActionFailure;

/**
 * Verifikasi token akses Supabase dan pastikan perannya memadai.
 *
 * Peran diambil dari `public.users.role` lebih dulu, lalu metadata token.
 * Pemetaan berdasarkan awalan email SENGAJA TIDAK dipakai: email bisa didaftarkan
 * sendiri, sehingga pola seperti `admin*@...` bukan bukti identitas.
 */
export async function authorize(
  accessToken: string | null | undefined,
  level: AccessLevel = 'admin'
): Promise<AuthorizeResult> {
  if (!accessToken || typeof accessToken !== 'string') {
    return fail('UNAUTHENTICATED', 'Sesi tidak ditemukan. Silakan masuk ulang.');
  }

  // Verifikasi tanda tangan token oleh Supabase (bukan sekadar mempercayai klien).
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user) {
    return fail('UNAUTHENTICATED', 'Sesi tidak valid atau sudah kedaluwarsa. Silakan masuk ulang.');
  }

  const user = data.user;

  const { data: row, error: roleError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (roleError) {
    return fail('INTERNAL', `Gagal membaca peran pengguna: ${roleError.message}`);
  }

  const role =
    (row?.role as string | undefined) ||
    (user.app_metadata?.role as string | undefined) ||
    (user.user_metadata?.role as string | undefined) ||
    null;

  const allowed = level === 'admin' ? isAdminRole(role) : isStaffOrAdmin(role);
  if (!allowed) {
    return fail(
      'FORBIDDEN',
      'Akun Anda tidak memiliki izin untuk tindakan ini.'
    );
  }

  return {
    ok: true,
    identity: { userId: user.id, email: user.email ?? null, role: role as string },
  };
}

/**
 * Terjemahkan error PostgreSQL/PostgREST menjadi pesan yang bisa dibaca admin.
 *
 * Pesan asli dari fungsi `adjust_user_*` sudah ditulis dalam bahasa Indonesia,
 * jadi dipakai apa adanya bila ada.
 */
export function describeDatabaseError(error: unknown): ActionFailure {
  const record = (error ?? {}) as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code : '';
  const message = typeof record.message === 'string' ? record.message : '';

  // 42883 = undefined_function, PGRST202 = fungsi tidak ditemukan oleh PostgREST.
  if (code === '42883' || code === 'PGRST202' || /could not find the function/i.test(message)) {
    return fail(
      'SCHEMA_NOT_READY',
      'Fungsi basis data belum tersedia. Jalankan migrasi ' +
        'supabase/migrations/20261002_loyalty_wallet_hardening.sql di Supabase SQL Editor.'
    );
  }

  // 42703 = undefined_column -> kolom baru belum ada.
  if (code === '42703' || /column .* does not exist/i.test(message)) {
    return fail(
      'SCHEMA_NOT_READY',
      'Kolom baru belum ada di basis data. Jalankan migrasi ' +
        'supabase/migrations/20261002_loyalty_wallet_hardening.sql di Supabase SQL Editor.'
    );
  }

  // Kesalahan validasi dari fungsi SQL.
  if (code === '22023') {
    return fail('INVALID_INPUT', message || 'Masukan tidak valid.');
  }

  // 23514 = check_violation (dipakai untuk saldo tidak mencukupi).
  if (code === '23514') {
    return fail('CONFLICT', message || 'Saldo tidak mencukupi.');
  }

  // P0002 = no_data_found (pengguna tidak ditemukan).
  if (code === 'P0002') {
    return fail('NOT_FOUND', message || 'Pengguna tidak ditemukan.');
  }

  // Kesalahan koneksi/level rendah.
  if (!code && !message) {
    return fail('INTERNAL', 'Terjadi kesalahan yang tidak diketahui.');
  }

  return fail('INTERNAL', message || 'Terjadi kesalahan pada basis data.');
}
