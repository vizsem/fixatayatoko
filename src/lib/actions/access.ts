import { ActionAuthError, requireAdmin, requireStaff } from '@/lib/actions/session';
import type { ActionErrorCode } from '@/lib/actions/guard';

/**
 * Verifikasi izin yang GAGAL DENGAN HASIL, bukan dengan lemparan.
 *
 * MENGAPA BUKAN MELEMPAR (pelajaran `/admin/settings`, 2026-10-02)
 * ---------------------------------------------------------------
 * Di produksi, Server Action yang melempar tidak mengirim pesannya ke peramban:
 * yang sampai hanya "An error occurred in the Server Components render..."
 * (React #441) tanpa penjelasan. Halaman lalu tampak rusak / menggantung, dan
 * pengguna tidak punya cara tahu bahwa sesinya sudah kedaluwarsa.
 *
 * Sifat FAIL-CLOSED tetap: verifikasi dijalankan LEBIH DULU, dan bila gagal
 * fungsi ini mengembalikan kegagalan sehingga tidak ada satu baris pun dibaca
 * atau ditulis.
 *
 * Modul ini sengaja TIDAK ber-`'use server'`: ia hanya alat bantu internal,
 * sehingga boleh mengekspor nilai non-async.
 */

/** Kegagalan verifikasi izin, sudah berbentuk hasil (bukan lemparan). */
export type IzinGagal = { ok: false; error: string; code: ActionErrorCode };

export function kegagalanIzin(error: unknown): IzinGagal {
  if (error instanceof ActionAuthError) {
    return { ok: false, error: error.message, code: error.code };
  }
  return {
    ok: false,
    error: error instanceof Error ? error.message : 'Verifikasi izin gagal.',
    code: 'INTERNAL',
  };
}

/** `null` = diizinkan (staf maupun admin). Selain itu = kegagalan siap dikembalikan. */
export async function cekAksesStaf(): Promise<IzinGagal | null> {
  try {
    await requireStaff();
    return null;
  } catch (error) {
    return kegagalanIzin(error);
  }
}

/** `null` = diizinkan (hanya admin/owner). Selain itu = kegagalan. */
export async function cekAksesAdmin(): Promise<IzinGagal | null> {
  try {
    await requireAdmin();
    return null;
  } catch (error) {
    return kegagalanIzin(error);
  }
}
