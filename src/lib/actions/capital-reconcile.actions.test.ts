import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyCapitalReconciliation, getCapitalReconciliation } from '@/lib/actions/capital-reconcile.actions';

/**
 * Rekonsiliasi modal — sisi Server Action.
 *
 * Yang dikunci di sini:
 *  1. Kedua aksi memeriksa peran (baca = staf, tulis = admin).
 *  2. `applyCapitalReconciliation` menghitung ulang nominal dari PO di basis
 *     data; angka yang dikirim klien TIDAK dipakai. Kalau ini rusak, permintaan
 *     yang dimanipulasi bisa memindahkan uang ke arah yang salah.
 *  3. Penulisannya idempoten (memakai `rekonsiliasiMutasiModal`).
 */

const state = vi.hoisted(() => ({
  purchaseRows: [] as any[],
  modalRows: [] as any[],
  inserts: [] as { table: string; payload: any }[],
  filters: [] as [string, any][],
  insertError: null as any,
}));

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireStaff: vi.fn(),
}));

vi.mock('@/lib/actions/session', () => ({
  requireAdmin: mocks.requireAdmin,
  requireStaff: mocks.requireStaff,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/supabase', () => {
  const from = (table: string) => {
    let refFilter: string | undefined;
    const builder: any = {};
    builder.select = () => builder;
    builder.order = () => builder;
    builder.range = () => builder;
    builder.limit = () => builder;
    builder.eq = (col: string, val: any) => {
      state.filters.push([col, val]);
      if (col === 'raw_data->>referenceId') refFilter = String(val);
      return builder;
    };
    builder.insert = (payload: any) => {
      state.inserts.push({ table, payload });
      return Promise.resolve({ data: null, error: state.insertError });
    };
    builder.then = (resolve: any) => {
      let rows: any[] = [];
      if (table === 'purchases') rows = state.purchaseRows;
      else if (table === 'capital_transactions') {
        rows = refFilter
          ? state.modalRows.filter((r) => String(r?.raw_data?.referenceId) === refFilter)
          : state.modalRows;
      }
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    };
    return builder;
  };

  const client = { from: vi.fn(from) };
  return { supabase: client, supabaseAdmin: client };
});

/** Baris `purchases` nyata hasil `createPurchaseOrder`. */
const PO_TUNAI = {
  id: 'po_1',
  total: 615000,
  created_at: '2026-10-01T00:00:00.000Z',
  raw_data: {
    poNumber: 'PO-1',
    supplierName: 'PT. Super indo grosir',
    paymentStatus: 'LUNAS',
    paymentMethod: 'CASH',
    total: 615000,
  },
};

const PO_TEMPO = {
  id: 'po_2',
  total: 1200000,
  created_at: '2026-09-30T00:00:00.000Z',
  raw_data: {
    poNumber: 'PO-2',
    supplierName: 'beras wilis',
    paymentStatus: 'HUTANG',
    paymentMethod: 'HUTANG',
    total: 1200000,
  },
};

/** Mutasi modal yang sudah tercatat untuk sebuah PO. */
const MUTASI = (referenceId: string, type: 'WITHDRAWAL' | 'INJECTION', amount: number) => ({
  id: `cap_${referenceId}`,
  raw_data: { referenceId, type, amount },
});

beforeEach(() => {
  vi.clearAllMocks();
  state.purchaseRows = [];
  state.modalRows = [];
  state.inserts = [];
  state.filters = [];
  state.insertError = null;
  mocks.requireAdmin.mockResolvedValue(undefined);
  mocks.requireStaff.mockResolvedValue(undefined);
});

describe('getCapitalReconciliation', () => {
  it('memeriksa peran staf lebih dulu', async () => {
    await getCapitalReconciliation();
    expect(mocks.requireStaff).toHaveBeenCalledTimes(1);
  });

  it('melaporkan PO tunai yang belum tercatat di modal', async () => {
    state.purchaseRows = [PO_TUNAI, PO_TEMPO];

    const hasil = await getCapitalReconciliation();

    expect(hasil.success).toBe(true);
    if (!hasil.success) return;
    expect(hasil.data.baris).toHaveLength(1);
    expect(hasil.data.baris[0]).toMatchObject({
      poId: 'po_1',
      diharapkan: 615000,
      tercatat: 0,
      selisih: 615000,
    });
    expect(hasil.data.ringkasan).toMatchObject({ jumlah: 1, kurangPotong: 615000 });
  });

  it('tidak melaporkan PO yang catatannya sudah cocok', async () => {
    state.purchaseRows = [PO_TUNAI];
    state.modalRows = [MUTASI('po_1', 'WITHDRAWAL', 615000)];

    const hasil = await getCapitalReconciliation();

    expect(hasil.success).toBe(true);
    if (!hasil.success) return;
    expect(hasil.data.baris).toHaveLength(0);
  });
});

describe('applyCapitalReconciliation', () => {
  it('memeriksa peran admin lebih dulu', async () => {
    await applyCapitalReconciliation(['po_1']);
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
  });

  it('menolak daftar kosong', async () => {
    const hasil = await applyCapitalReconciliation([]);
    expect(hasil.success).toBe(false);
    expect(hasil.error).toContain('Tidak ada PO');
    expect(state.inserts).toHaveLength(0);
  });

  it('menghitung nominal dari basis data, bukan dari klien', async () => {
    state.purchaseRows = [PO_TUNAI];

    const hasil = await applyCapitalReconciliation(['po_1']);

    expect(hasil.success).toBe(true);
    expect(state.inserts).toHaveLength(1);
    // Nominal diambil dari PO (Rp615.000) — klien tidak mengirim angka apa pun.
    expect(state.inserts[0].payload.raw_data).toMatchObject({
      type: 'WITHDRAWAL',
      amount: 615000,
      referenceId: 'po_1',
    });
    expect(hasil.data).toMatchObject({ diproses: 1, disesuaikan: 615000, gagal: [] });
  });

  it('idempoten: PO yang sudah cocok tidak menulis apa pun', async () => {
    state.purchaseRows = [PO_TUNAI];
    state.modalRows = [MUTASI('po_1', 'WITHDRAWAL', 615000)];

    const hasil = await applyCapitalReconciliation(['po_1']);

    expect(hasil.data).toMatchObject({ diproses: 1, disesuaikan: 0 });
    expect(state.inserts).toHaveLength(0);
  });

  it('PO tempo tidak menyentuh modal sama sekali', async () => {
    state.purchaseRows = [PO_TEMPO];

    const hasil = await applyCapitalReconciliation(['po_2']);

    expect(hasil.data).toMatchObject({ diproses: 1, disesuaikan: 0 });
    expect(state.inserts).toHaveLength(0);
  });

  it('melaporkan PO yang tidak ditemukan sebagai gagal, tanpa menulis', async () => {
    state.purchaseRows = [PO_TUNAI];

    const hasil = await applyCapitalReconciliation(['po_1', 'po_hantu']);

    expect(hasil.success).toBe(true);
    expect(hasil.data?.gagal).toEqual(['po_hantu (PO tidak ditemukan)']);
    expect(hasil.data?.disesuaikan).toBe(615000);
  });

  it('kegagalan tulis masuk daftar gagal, bukan sukses palsu', async () => {
    state.purchaseRows = [PO_TUNAI];
    state.insertError = { message: 'permission denied' };

    const hasil = await applyCapitalReconciliation(['po_1']);

    expect(hasil.success).toBe(true);
    expect(hasil.data?.diproses).toBe(0);
    expect(hasil.data?.gagal.join(' ')).toContain('permission denied');
  });

  it('permintaan berisi id duplikat hanya diproses sekali', async () => {
    state.purchaseRows = [PO_TUNAI];

    const hasil = await applyCapitalReconciliation(['po_1', 'po_1', 'po_1']);

    expect(hasil.data?.diproses).toBe(1);
    expect(state.inserts).toHaveLength(1);
  });
});
