import { describe, it, expect, vi, beforeEach } from 'vitest';

import { buatRetur, prosesRetur } from '@/lib/actions/returns.actions';

/**
 * Uji alur persetujuan retur.
 *
 * Yang dikunci di sini adalah kerusakan nyata pada versi lama (peramban):
 *   1. "Retur disetujui" padahal stok TIDAK berubah (`addStockTx` memakai
 *      service role di peramban = ditolak RLS).
 *   2. Jurnal tidak pernah tercatat (`postJournal` memakai klien anon).
 *   3. Retur bisa disetujui DUA KALI (stok bertambah dua kali) karena
 *      `runTransaction` bridge tidak atomik.
 *   4. Item warisan impor tanpa `productId` ditebak-nebak.
 */

const state = vi.hoisted(() => ({
  returRow: null as any,
  /** Hasil berurutan dari `.update(...).select()`. */
  selectQueue: [] as any[],
  updateCalls: [] as { payload: any; filters: Record<string, unknown> }[],
  ledgerInserts: [] as any[],
  ledgerError: null as string | null,
  addStockCalls: [] as any[],
  deductCalls: [] as any[],
  addStockError: null as string | null,
  insertReturns: [] as { table: string; payload: any }[],
  productRows: [] as any[],
}));

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn().mockResolvedValue({ userId: 'u1', email: 'a@b.c', role: 'superadmin' }),
  requireAdmin: vi.fn().mockResolvedValue({ userId: 'u1', email: 'a@b.c', role: 'superadmin' }),
}));

vi.mock('@/lib/actions/session', () => ({
  requireStaff: mocks.requireStaff,
  requireAdmin: mocks.requireAdmin,
  requireIdentity: vi.fn(),
  resolveAccessToken: vi.fn(),
  ActionAuthError: class ActionAuthError extends Error {},
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

vi.mock('@/lib/inventory', () => ({
  addStock: async (params: any) => {
    if (state.addStockError) throw new Error(state.addStockError);
    state.addStockCalls.push(params);
  },
  deductStockFEFO: async (params: any) => {
    if (state.addStockError) throw new Error(state.addStockError);
    state.deductCalls.push(params);
  },
}));

vi.mock('@/lib/supabase-helpers', () => ({
  sbInsertDoc: async (table: string, payload: any) => {
    state.insertReturns.push({ table, payload });
    return { id: 'ret_1' };
  },
  sbGetDocs: async () => ({ docs: [], size: 0, empty: true }),
}));

vi.mock('@/lib/supabase', () => {
  /** Builder tiruan bergaya PostgREST yang bisa di-`await` di tahap mana pun. */
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    let payload: any;

    const builder: any = {
      select: () => builder,
      eq: (k: string, v: unknown) => {
        filters[k] = v;
        return builder;
      },
      in: () => builder,
      or: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({
        data: table === 'returns' ? state.returRow : null,
        error: null,
      }),
      update: (next: any) => {
        payload = next;
        return builder;
      },
      insert: async (rows: any) => {
        if (table === 'ledger_entries') {
          state.ledgerInserts.push(rows);
          return { error: state.ledgerError ? { message: state.ledgerError } : null };
        }
        return { error: null };
      },
      then: (resolve: (value: any) => unknown) => {
        if (payload !== undefined) {
          state.updateCalls.push({ payload, filters: { ...filters } });
          const data = state.selectQueue.length > 0 ? state.selectQueue.shift() : [{ id: 'ret_1' }];
          return resolve({ data, error: null });
        }
        return resolve({ data: table === 'products' ? state.productRows : [], error: null });
      },
    };

    return builder;
  };

  return { supabaseAdmin: { from }, supabase: { from } };
});

beforeEach(() => {
  state.returRow = {
    id: 'ret_1',
    created_at: '2026-07-09T18:12:23.403+00:00',
    raw_data: {
      type: 'SALES_RETURN',
      refId: 'ORD-9',
      customerOrSupplierName: 'Budi',
      reason: 'rusak',
      status: 'PENDING',
      penyelesaian: 'TIDAK_DIRINCIKAN',
      items: [{ productId: 'p1', productName: 'Kopi', quantity: 2, price: 10000 }],
      totalValue: 20000,
      createdAt: '2026-07-09T18:12:23.403Z',
    },
  };
  state.selectQueue = [];
  state.updateCalls = [];
  state.ledgerInserts = [];
  state.ledgerError = null;
  state.addStockCalls = [];
  state.deductCalls = [];
  state.addStockError = null;
  state.insertReturns = [];
  state.productRows = [];
  mocks.requireStaff.mockResolvedValue({ userId: 'u1', email: 'a@b.c', role: 'superadmin' });
  mocks.requireAdmin.mockResolvedValue({ userId: 'u1', email: 'a@b.c', role: 'superadmin' });
});

describe('prosesRetur — menyetujui', () => {
  it('menambah stok untuk retur penjualan dan mencatat jurnal saat dananya tunai', async () => {
    const hasil = await prosesRetur('ret_1', 'SETUJUI', 'TUNAI', 'barang diterima');

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;

    expect(hasil.data.status).toBe('APPROVED');
    expect(hasil.data.stokDisesuaikan).toBe(1);
    expect(hasil.data.jurnalDicatat).toBe(true);
    expect(hasil.data.peringatan).toEqual([]);

    expect(state.addStockCalls).toEqual([
      expect.objectContaining({ productId: 'p1', amount: 2, reference: 'RETUR-ret_1', source: 'MANUAL' }),
    ]);
    expect(state.deductCalls).toEqual([]);

    const jurnal = state.ledgerInserts[0];
    expect(jurnal.raw_data).toMatchObject({
      debitAccount: 'Sales',
      creditAccount: 'Cash',
      amount: 20000,
      refType: 'RETURN',
      refId: 'ret_1',
    });
  });

  it('mengurangi stok untuk retur pembelian', async () => {
    state.returRow.raw_data.type = 'PURCHASE_RETURN';

    const hasil = await prosesRetur('ret_1', 'SETUJUI', 'POTONG_HUTANG');

    expect(hasil.ok).toBe(true);
    expect(state.deductCalls).toHaveLength(1);
    expect(state.addStockCalls).toHaveLength(0);
    expect(state.ledgerInserts[0].raw_data).toMatchObject({
      debitAccount: 'AccountsPayable',
      creditAccount: 'Inventory',
    });
  });

  it('TIDAK membuat jurnal bila dananya tidak dirincikan', async () => {
    const hasil = await prosesRetur('ret_1', 'SETUJUI', 'TIDAK_DIRINCIKAN');

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.data.jurnalDicatat).toBe(false);
    expect(state.ledgerInserts).toHaveLength(0);
    expect(state.addStockCalls).toHaveLength(1);
  });

  it('melewati item tanpa ID produk dan melaporkannya (tidak menebak)', async () => {
    state.returRow.raw_data.items = [
      { productId: '', productName: 'SEDAAP GORENG (40)', quantity: 35, price: 122000 },
    ];
    state.returRow.raw_data.totalValue = 4270000;

    const hasil = await prosesRetur('ret_1', 'SETUJUI', 'TIDAK_DIRINCIKAN');

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.data.stokDisesuaikan).toBe(0);
    expect(hasil.data.itemDilewati).toEqual(['SEDAAP GORENG (40)']);
    expect(hasil.data.peringatan[0]).toMatch(/tidak punya ID produk/i);
    expect(state.addStockCalls).toHaveLength(0);
  });

  it('mengembalikan status ke PENDING bila stok gagal disesuaikan', async () => {
    state.addStockError = 'Produk tidak ditemukan: p1';
    state.selectQueue = [[{ id: 'ret_1' }]]; // klaim berhasil, pemulihan juga berhasil

    const hasil = await prosesRetur('ret_1', 'SETUJUI', 'TUNAI');

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.error).toMatch(/Stok tidak berubah/);

    // Panggilan update terakhir harus mengembalikan status ke PENDING.
    const terakhir = state.updateCalls[state.updateCalls.length - 1];
    expect(terakhir.payload.raw_data.status).toBe('PENDING');
    // Dan TIDAK ada jurnal yang ikut tercatat.
    expect(state.ledgerInserts).toHaveLength(0);
  });

  it('idempoten: klaim yang gagal tidak menyentuh stok maupun jurnal', async () => {
    state.selectQueue = [[]]; // filter PENDING tidak menemukan baris -> sudah diproses

    const hasil = await prosesRetur('ret_1', 'SETUJUI', 'TUNAI');

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.code).toBe('CONFLICT');
    expect(state.addStockCalls).toHaveLength(0);
    expect(state.ledgerInserts).toHaveLength(0);
  });

  it('menolak memproses retur yang statusnya sudah bukan PENDING', async () => {
    state.returRow.raw_data.status = 'APPROVED';

    const hasil = await prosesRetur('ret_1', 'SETUJUI', 'TUNAI');

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.code).toBe('CONFLICT');
    expect(hasil.error).toMatch(/sudah disetujui/i);
    expect(state.updateCalls).toHaveLength(0);
    expect(state.addStockCalls).toHaveLength(0);
  });

  it('tetap sukses walau jurnal gagal, tetapi memberi peringatan', async () => {
    state.ledgerError = 'relation tidak menerima insert';

    const hasil = await prosesRetur('ret_1', 'SETUJUI', 'TUNAI');

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.data.jurnalDicatat).toBe(false);
    expect(hasil.data.peringatan.join(' ')).toMatch(/jurnal gagal dicatat/i);
    expect(state.addStockCalls).toHaveLength(1);
  });
});

describe('prosesRetur — menolak', () => {
  it('hanya mengubah status', async () => {
    const hasil = await prosesRetur('ret_1', 'TOLAK', undefined, 'barang sudah dipakai');

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.data.status).toBe('REJECTED');
    expect(state.addStockCalls).toHaveLength(0);
    expect(state.deductCalls).toHaveLength(0);
    expect(state.ledgerInserts).toHaveLength(0);

    const update = state.updateCalls[0];
    expect(update.payload.raw_data.status).toBe('REJECTED');
    expect(update.payload.raw_data.processNote).toBe('barang sudah dipakai');
    // Penjaga idempoten juga dipakai saat menolak.
    expect(update.filters['raw_data->>status']).toBe('PENDING');
  });
});

describe('prosesRetur — penjagaan izin', () => {
  it('menolak (tanpa menyentuh data) bila peran tidak memadai', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Akun Anda tidak memiliki izin.'));

    const hasil = await prosesRetur('ret_1', 'SETUJUI', 'TUNAI');

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.error).toMatch(/tidak memiliki izin/i);
    expect(state.updateCalls).toHaveLength(0);
    expect(state.addStockCalls).toHaveLength(0);
  });
});

describe('buatRetur', () => {
  const input = {
    jenis: 'SALES_RETURN' as const,
    refId: 'ORD-9',
    pihak: 'Budi',
    alasan: 'rusak',
    items: [{ productId: 'p1', productName: 'NAMA DARI KLIEN', quantity: 2, price: 1 }],
    penyelesaian: 'TIDAK_DIRINCIKAN' as const,
  };

  it('memakai nama & harga dari master produk, bukan kiriman klien', async () => {
    state.productRows = [{ id: 'p1', name: 'Kopi Susu', price: 10000 }];

    const hasil = await buatRetur(input);

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.data.totalNilai).toBe(20000);

    expect(state.insertReturns).toHaveLength(1);
    const payload = state.insertReturns[0].payload;
    expect(payload.items).toEqual([
      { productId: 'p1', productName: 'Kopi Susu', quantity: 2, price: 10000 },
    ]);
    expect(payload.totalValue).toBe(20000);
    expect(payload.status).toBe('PENDING');
  });

  it('menolak input tanpa item (tidak menulis apa pun)', async () => {
    const hasil = await buatRetur({ ...input, items: [] });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.code).toBe('INVALID_INPUT');
    expect(state.insertReturns).toHaveLength(0);
  });
});
