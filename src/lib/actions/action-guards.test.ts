import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getDashboardStats } from '@/lib/actions/dashboard.actions';
import { getReportSummary } from '@/lib/actions/report.actions';
import { getExpenses, createExpense, deleteExpense, getExpenseSummary } from '@/lib/actions/expense.actions';
import { getUsers, createUser, updateUser, deleteUser } from '@/lib/actions/user.actions';

/**
 * Action di bawah ini memakai klien service role (MELEWATI RLS). Karena Server
 * Action adalah endpoint POST publik, penjagaan peran di dalam action adalah
 * satu-satunya pengaman.
 *
 * Test ini mengunci sifat FAIL-CLOSED: kalau verifikasi identitas gagal, action
 * harus MELEMPAR — bukan menelan kegagalan lalu mengembalikan nilai default
 * (array kosong / tujuan sukses). Kegagalan senyap jenis itu pernah terjadi di
 * `customer.actions.ts` (lihat docs/MIGRATION_STATUS.md) dan berubah jadi
 * "data kosong" yang tampak wajar.
 *
 * Klien `supabaseAdmin` sengaja dibuat melempar: kalau sebuah action menyentuh
 * basis data SEBELUM memverifikasi identitas, test akan gagal.
 */

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock('@/lib/actions/session', () => ({
  requireStaff: mocks.requireStaff,
  requireAdmin: mocks.requireAdmin,
  requireIdentity: vi.fn(),
  resolveAccessToken: vi.fn(),
  ActionAuthError: class ActionAuthError extends Error {},
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => {
      throw new Error('Basis data tersentuh sebelum identitas diverifikasi');
    },
    auth: { admin: { createUser: () => { throw new Error('auth.admin tersentuh tanpa otorisasi'); } } },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const KASUS: { nama: string; level: 'staff' | 'admin'; jalankan: () => Promise<unknown> }[] = [
  { nama: 'getDashboardStats', level: 'staff', jalankan: () => getDashboardStats() },
  { nama: 'getReportSummary', level: 'staff', jalankan: () => getReportSummary(new Date(), new Date()) },
  { nama: 'getExpenses', level: 'staff', jalankan: () => getExpenses() },
  { nama: 'getExpenseSummary', level: 'staff', jalankan: () => getExpenseSummary() },
  { nama: 'createExpense', level: 'admin', jalankan: () => createExpense({ category: 'X', amount: 1, date: new Date() }) },
  { nama: 'deleteExpense', level: 'admin', jalankan: () => deleteExpense('exp_1') },
  { nama: 'getUsers', level: 'admin', jalankan: () => getUsers() },
  { nama: 'createUser', level: 'admin', jalankan: () => createUser({ name: 'A', email: 'a@b.c', password: 'x'.repeat(8), role: 'STAFF' as any }) },
  { nama: 'updateUser', level: 'admin', jalankan: () => updateUser('u1', { name: 'B' }) },
  { nama: 'deleteUser', level: 'admin', jalankan: () => deleteUser('u1') },
];

describe('penjagaan peran pada action service-role', () => {
  it.each(KASUS)('$nama menolak (melempar) bila belum terautentikasi', async ({ nama, level, jalankan }) => {
    const tolak = new Error('Sesi tidak ditemukan. Silakan masuk ulang.');
    mocks.requireStaff.mockRejectedValue(tolak);
    mocks.requireAdmin.mockRejectedValue(tolak);

    await expect(jalankan(), `${nama} seharusnya melempar, bukan mengembalikan nilai default`).rejects.toThrow(
      /Sesi tidak ditemukan/
    );

    // Guard yang benar harus dipanggil sesuai tingkat aksesnya.
    if (level === 'staff') {
      expect(mocks.requireStaff, `${nama} harus memanggil requireStaff`).toHaveBeenCalled();
    } else {
      expect(mocks.requireAdmin, `${nama} harus memanggil requireAdmin`).toHaveBeenCalled();
    }
  });

  it('tidak menyentuh basis data sebelum verifikasi identitas berhasil', async () => {
    mocks.requireStaff.mockRejectedValue(new Error('ditolak'));
    mocks.requireAdmin.mockRejectedValue(new Error('ditolak'));

    // Kalau salah satu action menyentuh `supabaseAdmin` lebih dulu, mock akan
    // melempar error yang berbeda dan assertion di bawah gagal.
    for (const kasus of KASUS) {
      await expect(kasus.jalankan()).rejects.toThrow(/Sesi tidak ditemukan|ditolak/);
    }
  });
});
