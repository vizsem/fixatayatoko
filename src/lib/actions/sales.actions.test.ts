import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMarketplaceOrder } from '@/lib/actions/sales.actions';

/**
 * Dua hal yang dikunci test ini:
 *
 *  1. Server Action TIDAK boleh memakai klien anon (`supabase`) untuk menulis.
 *     Action berjalan di server tanpa sesi pengguna, sehingga klien anon hanya
 *     punya hak SELECT (bahkan itu pun dibatasi RLS). Inilah sebab tombol
 *     "Simpan Pesanan" di /admin/marketplace-orders selalu gagal dengan pesan
 *     yang terbaca seperti masalah izin, walau akunnya superadmin.
 *
 *  2. Kalau order gagal disimpan SETELAH stok terpotong, stok itu harus
 *     dikembalikan. Tanpa ini, setiap kegagalan menyimpan mengurangi stok
 *     tanpa menghasilkan order — kerugian yang tidak terlihat.
 */

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  deductStockFEFO: vi.fn(),
  addStock: vi.fn(),
  addInventoryLog: vi.fn(),
  revalidatePath: vi.fn(),
  anonFrom: vi.fn(),
  insertError: null as any,
  insertCalls: [] as any[],
}));

vi.mock('@/lib/actions/session', () => ({
  requireStaff: mocks.requireStaff,
  requireAdmin: vi.fn(),
  requireIdentity: vi.fn(),
  resolveAccessToken: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/inventory', () => ({
  deductStockFEFO: mocks.deductStockFEFO,
  addStock: mocks.addStock,
  addInventoryLog: mocks.addInventoryLog,
}));

// Klien anon: kalau action memanggil ini, test akan menangkapnya.
vi.mock('@/lib/supabase', () => {
  const makeBuilder = (table: string, isAnon: boolean) => {
    const builder: any = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.neq = () => builder;
    builder.order = () => builder;
    builder.limit = () => builder;
    builder.single = async () => ({ data: null, error: null });
    builder.insert = (payload: any) => {
      mocks.insertCalls.push({ table, payload, isAnon });
      return Promise.resolve({ error: mocks.insertError });
    };
    builder.update = () => Promise.resolve({ error: null });
    builder.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve);
    return builder;
  };

  return {
    supabase: { from: (t: string) => mocks.anonFrom(t) },
    supabaseAdmin: { from: (t: string) => makeBuilder(t, false) },
  };
});

vi.mock('@/lib/firebase', () => ({ limit: vi.fn() }));

const orderInput = {
  orderId: 'MKT-1',
  externalOrderId: 'EXT-1',
  customerName: 'Pembeli',
  items: [
    { id: 'p1', name: 'Produk A', quantity: 2, baseQuantity: 24, price: 1000, total: 2000 },
    { id: 'p2', name: 'Produk B', quantity: 1, baseQuantity: 5, price: 3000, total: 3000 },
  ],
  subtotal: 5000,
  shippingCost: 0,
  total: 5000,
  channel: 'SHOPEE',
  paymentMethod: 'TRANSFER',
  warehouseId: 'wh-1',
  warehouseName: 'Gudang 1',
  adminId: 'admin-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insertError = null;
  mocks.insertCalls = [];
  mocks.requireStaff.mockResolvedValue({ userId: 'admin-1', role: 'superadmin' });
  mocks.deductStockFEFO.mockResolvedValue({ success: true });
  mocks.addStock.mockResolvedValue({ success: true });
});

describe('createMarketplaceOrder', () => {
  it('tidak memakai klien anon untuk menyimpan order', async () => {
    const hasil = await createMarketplaceOrder(orderInput);

    expect(hasil.success).toBe(true);
    expect(mocks.anonFrom).not.toHaveBeenCalled();
    expect(mocks.insertCalls).toHaveLength(1);
    expect(mocks.insertCalls[0].isAnon).toBe(false);
    expect(mocks.insertCalls[0].table).toBe('orders');
  });

  it('memotong stok sebesar baseQuantity (satuan dasar), bukan quantity', async () => {
    await createMarketplaceOrder(orderInput);

    expect(mocks.deductStockFEFO).toHaveBeenCalledTimes(2);
    expect(mocks.deductStockFEFO.mock.calls[0][0]).toMatchObject({
      productId: 'p1',
      amount: 24,
      source: 'MARKETPLACE',
      warehouseId: 'wh-1',
    });
    expect(mocks.addStock).not.toHaveBeenCalled();
  });

  it('mengembalikan stok kalau order gagal disimpan setelah stok terpotong', async () => {
    mocks.insertError = { message: 'database sedang sibuk' };

    const hasil = await createMarketplaceOrder(orderInput);

    expect(hasil.success).toBe(false);
    // Kedua item dikembalikan, dengan jumlah yang sama seperti saat dipotong.
    expect(mocks.addStock).toHaveBeenCalledTimes(2);
    expect(mocks.addStock.mock.calls.map((c) => c[0].productId)).toEqual(['p1', 'p2']);
    expect(mocks.addStock.mock.calls[0][0]).toMatchObject({ amount: 24, warehouseId: 'wh-1' });
    expect(mocks.addStock.mock.calls[1][0]).toMatchObject({ amount: 5 });
  });

  it('mengembalikan stok yang sudah terpotong kalau item berikutnya gagal', async () => {
    mocks.deductStockFEFO
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'Stok tidak cukup' });

    const hasil = await createMarketplaceOrder(orderInput);

    expect(hasil.success).toBe(false);
    expect(hasil.error).toContain('Stok tidak cukup');
    // Hanya item pertama yang terlanjur terpotong, dan itulah yang dikembalikan.
    expect(mocks.addStock).toHaveBeenCalledTimes(1);
    expect(mocks.addStock.mock.calls[0][0]).toMatchObject({ productId: 'p1', amount: 24 });
    expect(mocks.insertCalls).toHaveLength(0);
  });

  it('tetap melaporkan kegagalan walau pengembalian stok ikut gagal', async () => {
    mocks.insertError = { message: 'gagal' };
    mocks.addStock.mockRejectedValue(new Error('pengembalian gagal'));

    const hasil = await createMarketplaceOrder(orderInput);

    expect(hasil.success).toBe(false);
    expect(mocks.addStock).toHaveBeenCalledTimes(2);
  });
});
