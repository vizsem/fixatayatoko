import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getSettingsPageData } from '@/lib/actions/settings.actions';

/**
 * UJI BATAS SERIALISASI untuk halaman pengaturan.
 *
 * Latar belakang (kejadian 2026-10-02): `/admin/settings` TIDAK BISA DIBUKA.
 * Di konsol hanya muncul `Uncaught (in promise) Error: Minified React error
 * #441` — yang artinya "An error occurred in the Server Components render",
 * tanpa penjelasan apa pun karena pesan aslinya disembunyikan di build produksi.
 *
 * Penyebabnya: `normalizeRow()` menempelkan `createdAt` sebagai objek bergaya
 * Firestore yang berisi FUNGSI (`toDate`, `toISOString`, ...). Server Action
 * mengirim nilai baliknya lewat serializer React Server Components, dan
 * serializer itu MENOLAK fungsi -> server melempar -> halaman gagal render.
 *
 * Uji ini menjalankan action yang sesungguhnya (dengan basis data tiruan) dan
 * memastikan nilai baliknya benar-benar bisa diserialisasi.
 */

const state = vi.hoisted(() => ({
  rows: {} as Record<string, any[]>,
  docRows: {} as Record<string, any>,
}));

vi.mock('@/lib/actions/session', () => ({
  requireStaff: vi.fn().mockResolvedValue({ userId: 'u1', email: null, role: 'superadmin' }),
  requireAdmin: vi.fn().mockResolvedValue({ userId: 'u1', email: null, role: 'superadmin' }),
  requireIdentity: vi.fn(),
  resolveAccessToken: vi.fn(),
  ActionAuthError: class ActionAuthError extends Error {},
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

/**
 * Builder tiruan yang bisa di-`await` di tahap mana pun, seperti PostgREST.
 * Baris yang dikembalikan sengaja memuat `created_at` supaya `normalizeRow`
 * benar-benar membuat objek timestamp bergaya Firestore.
 */
vi.mock('@/lib/supabase', () => {
  const from = (table: string) => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({ data: state.docRows[table] ?? null, error: null }),
      then: (resolve: (value: any) => unknown) =>
        resolve({ data: state.rows[table] ?? [], error: null }),
    };
    return builder;
  };

  return {
    supabase: { from },
    supabaseAdmin: { from, auth: { getUser: vi.fn() } },
  };
});

beforeEach(() => {
  state.rows = {
    categories: [{ id: 'cat_1', name: 'Minuman', created_at: '2026-10-02T03:00:00.000Z' }],
    employees: [{ id: 'emp_1', name: 'Budi', role: 'kasir', created_at: '2026-10-02T03:00:00.000Z' }],
    banners: [{ id: 'ban_1', title: 'Promo', created_at: '2026-10-02T03:00:00.000Z' }],
    warehouses: [{ id: 'wh_1', name: 'Gudang Utama', created_at: '2026-10-02T03:00:00.000Z' }],
  };
  state.docRows = {
    settings: { id: 'system', store: { name: 'Atayatoko2' }, created_at: '2026-10-02T03:00:00.000Z' },
  };
});

/** Cari fungsi yang tersisa di dalam struktur apa pun. */
function fungsiTersisa(value: unknown, jalur = 'akar'): string[] {
  if (typeof value === 'function') return [jalur];
  if (Array.isArray(value)) return value.flatMap((v, i) => fungsiTersisa(v, `${jalur}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => fungsiTersisa(v, `${jalur}.${k}`));
  }
  return [];
}

describe('getSettingsPageData', () => {
  it('baris mentah dari helper MEMANG tidak bisa dikirim ke klien', async () => {
    // Bukti bahwa uji di bawah ini berarti: sumber datanya benar-benar
    // menghasilkan objek berisi fungsi (bukan fixture yang mengada-ada).
    const { sbGetDoc } = await import('@/lib/supabase-helpers');
    const doc = await sbGetDoc('settings', 'system');
    expect(fungsiTersisa(doc.data()).length).toBeGreaterThan(0);
  });

  it('mengembalikan data yang bisa diserialisasi ke klien (bukan React #441)', async () => {
    const hasil = await getSettingsPageData();

    expect(hasil.ok, hasil.ok ? '' : `action gagal: ${hasil.error}`).toBe(true);
    if (!hasil.ok) return;

    // Inilah yang gagal sebelum perbaikan: baris memuat fungsi timestamp.
    expect(fungsiTersisa(hasil.data)).toEqual([]);
    expect(() => structuredClone(hasil.data)).not.toThrow();
  });

  it('isi data tetap utuh setelah dibersihkan', async () => {
    const hasil = await getSettingsPageData();
    if (!hasil.ok) throw new Error('action harus berhasil');

    expect(hasil.data.categories).toHaveLength(1);
    expect(hasil.data.categories[0].name).toBe('Minuman');
    expect(hasil.data.employees[0].role).toBe('kasir');
    expect(hasil.data.system?.id).toBe('system');
  });

  it('tanggal menjadi string ISO supaya tetap bisa ditampilkan', async () => {
    const hasil = await getSettingsPageData();
    if (!hasil.ok) throw new Error('action harus berhasil');

    expect(hasil.data.categories[0].createdAt).toBe('2026-10-02T03:00:00.000Z');
  });
});
