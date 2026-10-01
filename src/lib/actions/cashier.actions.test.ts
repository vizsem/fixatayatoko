import { describe, it, expect, vi, beforeEach } from 'vitest';

import { simpanTransaksiKasir } from '@/lib/actions/cashier.actions';

/**
 * Penyimpanan transaksi KASIR.
 *
 * Yang dikunci di sini:
 *  1. Seluruh penulisan terjadi di server (dulu peramban memakai klien anon,
 *     sehingga stok gagal dipotong dan order tidak pernah tersimpan).
 *  2. MODAL selalu dihitung dari master produk, bukan dari kiriman klien.
 *  3. Kalau salah satu pemotongan stok gagal, stok yang sudah terpotong
 *     DIKEMBALIKAN dan order tidak disimpan.
 */

const state = vi.hoisted(() => ({
  produk: [] as any[],
  stok: {} as Record<string, number>,
  inserts: [] as { table: string; payload: any }[],
  updates: [] as { table: string; payload: any; filters: Record<string, any> }[],
  orderError: null as any,
  pelanggan: null as any,
}));

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  addStock: vi.fn(),
  deductStockFEFO: vi.fn(),
}));

vi.mock('@/lib/actions/session', () => ({ requireStaff: mocks.requireStaff, requireAdmin: vi.fn() }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

vi.mock('@/lib/inventory', () => ({
  addStock: mocks.addStock,
  deductStockFEFO: mocks.deductStockFEFO,
}));

vi.mock('@/lib/supabase', () => {
  const from = (table: string) => {
    const filters: Record<string, any> = {};
    let mode: 'select' | 'insert' | 'update' = 'select';
    let pakaiIn = false;

    const builder: any = {};
    builder.select = () => builder;
    builder.in = () => {
      pakaiIn = true;
      return builder;
    };
    builder.eq = (col: string, val: any) => {
      filters[col] = val;
      return builder;
    };
    builder.limit = () => builder;
    builder.order = () => builder;
    builder.insert = (payload: any) => {
      mode = 'insert';
      state.inserts.push({ table, payload });
      return Promise.resolve({ data: null, error: table === 'orders' ? state.orderError : null });
    };
    builder.update = (payload: any) => {
      mode = 'update';
      state.updates.push({ table, payload, filters });
      return builder;
    };
    builder.maybeSingle = async () => {
      if (table === 'products') {
        const p = state.produk.find((x) => x.id === filters.id);
        return { data: p ? { stock: state.stok[p.id] ?? 0, raw_data: p.raw_data } : null, error: null };
      }
      if (table === 'customers') return { data: state.pelanggan, error: null };
      return { data: null, error: null };
    };
    builder.single = builder.maybeSingle;
    builder.then = (resolve: any) => {
      if (mode !== 'select') return Promise.resolve({ data: null, error: null }).then(resolve);
      if (table === 'products' && pakaiIn) return Promise.resolve({ data: state.produk, error: null }).then(resolve);
      return Promise.resolve({ data: null, error: null }).then(resolve);
    };
    return builder;
  };

  const client = { from: vi.fn(from) };
  return { supabase: client, supabaseAdmin: client };
});

const PRODUK_KOPI = {
  id: 'prod_kopi',
  name: 'TOP COFFEE TOP MINI 6G',
  unit: 'PCS',
  cost_price: 665,
  raw_data: { units: [{ code: 'PCS', contains: 1 }, { code: 'CTN', contains: 200 }] },
};

const transaksiDasar = {
  orderId: 'ord_test_1',
  items: [{ id: 'prod_kopi', name: 'TOP COFFEE', price: 155000, quantity: 1, unit: 'CTN', contains: 200 }],
  subtotal: 155000,
  total: 155000,
  paymentMethod: 'CASH',
  warehouseId: 'gudang-utama',
};

beforeEach(() => {
  vi.clearAllMocks();
  state.produk = [PRODUK_KOPI];
  state.stok = { prod_kopi: 500 };
  state.inserts = [];
  state.updates = [];
  state.orderError = null;
  state.pelanggan = null;
  mocks.requireStaff.mockResolvedValue(undefined);
  mocks.deductStockFEFO.mockResolvedValue({ success: true, newStock: 300 });
  mocks.addStock.mockResolvedValue({ success: true });
});

describe('simpanTransaksiKasir', () => {
  it('memeriksa peran staf lebih dulu', async () => {
    await simpanTransaksiKasir(transaksiDasar);
    expect(mocks.requireStaff).toHaveBeenCalledTimes(1);
  });

  it('memotong stok sejumlah pcs dan menyimpan order + jurnal', async () => {
    const hasil = await simpanTransaksiKasir(transaksiDasar);

    expect(hasil.success).toBe(true);
    // 1 CTN = 200 pcs
    expect(mocks.deductStockFEFO).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'prod_kopi', amount: 200, warehouseId: 'gudang-utama' })
    );

    const order = state.inserts.find((i) => i.table === 'orders');
    expect(order).toBeTruthy();
    expect(order!.payload.raw_data.source).toBe('CASHIER');
    // Snapshot modal direkam di baris item (tidak berubah walau Modal diubah).
    expect(order!.payload.items[0].hppPerPcs).toBe(665);
    expect(order!.payload.items[0].baseQuantity).toBe(200);
    expect(order!.payload.raw_data.hppTotal).toBe(665 * 200);

    const jurnal = state.inserts.find((i) => i.table === 'ledger_entries');
    expect(jurnal).toBeTruthy();
  });

  it('MODAL diambil dari server, bukan dari kiriman klien', async () => {
    await simpanTransaksiKasir({
      ...transaksiDasar,
      // Klien mencoba mengirim modal Rp1 per pcs.
      items: [{ ...transaksiDasar.items[0], cost: 1 }],
    });

    const order = state.inserts.find((i) => i.table === 'orders');
    expect(order!.payload.items[0].hppPerPcs).toBe(665);
  });

  it('mengembalikan stok & tidak menyimpan order bila pemotongan gagal', async () => {
    mocks.deductStockFEFO
      .mockResolvedValueOnce({ success: true, newStock: 300 })
      .mockResolvedValueOnce({ success: false, error: 'stok habis' });

    state.produk = [
      PRODUK_KOPI,
      { ...PRODUK_KOPI, id: 'prod_2', name: 'Produk Dua' },
    ];

    const hasil = await simpanTransaksiKasir({
      ...transaksiDasar,
      items: [
        transaksiDasar.items[0],
        { id: 'prod_2', price: 1000, quantity: 1, unit: 'PCS', contains: 1 },
      ],
    });

    expect(hasil.success).toBe(false);
    expect(hasil.error).toContain('Gagal memotong stok');
    expect(mocks.addStock).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'prod_kopi', amount: 200 })
    );
    expect(state.inserts.find((i) => i.table === 'orders')).toBeUndefined();
  });

  it('mengembalikan stok bila penyimpanan order gagal', async () => {
    state.orderError = { message: 'duplicate key' };

    const hasil = await simpanTransaksiKasir(transaksiDasar);

    expect(hasil.success).toBe(false);
    expect(hasil.error).toContain('Gagal menyimpan order');
    expect(mocks.addStock).toHaveBeenCalled();
  });

  it('menolak keranjang kosong tanpa menyentuh stok', async () => {
    const hasil = await simpanTransaksiKasir({ ...transaksiDasar, items: [] });

    expect(hasil.success).toBe(false);
    expect(mocks.deductStockFEFO).not.toHaveBeenCalled();
  });

  it('pembayaran DOMPET memotong saldo pelanggan di server', async () => {
    state.pelanggan = { id: 'cust_1', wallet_balance: 500000 };

    const hasil = await simpanTransaksiKasir({
      ...transaksiDasar,
      paymentMethod: 'DOMPET',
      userId: 'cust_1',
      total: 155000,
    });

    expect(hasil.success).toBe(true);
    const update = state.updates.find((u) => u.table === 'customers');
    expect(update?.payload.wallet_balance).toBe(345000);
    expect(state.inserts.find((i) => i.table === 'wallet_logs')).toBeTruthy();
  });
});
