import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPurchaseOrder, receivePurchaseOrder, updatePurchaseOrder, cancelPurchaseOrder, deletePurchaseOrder,
  payPurchaseDebt, payBulkPurchaseDebt
} from '@/lib/actions/purchase.actions';

/**
 * Test ini mengunci dua perbaikan penting pada alur PO:
 *
 *  1. `receivePurchaseOrder` TIDAK boleh menandai PO "DITERIMA" kalau stok gagal
 *     ditambahkan. Dulu status diubah lebih dulu, sehingga PO berstatus diterima
 *     padahal stok tidak masuk, dan percobaan ulang ditolak dengan
 *     "PO sudah diterima sebelumnya" — stoknya hilang permanen.
 *
 *  2. `createPurchaseOrder` dengan autoReceive TIDAK boleh melaporkan
 *     "Gagal membuat PO" kalau baris PO-nya sudah tersimpan. Dulu error addStock
 *     naik ke catch luar, sehingga pengguna melihat pesan gagal sementara PO
 *     tetap ada di daftar dan stoknya tidak pernah masuk.
 */

const state = vi.hoisted(() => ({
  purchaseRow: null as any,
  purchaseError: null as any,
  updateError: null as any,
  insertError: null as any,
  existingLog: [] as any[],
  supplierRow: null as any,
  productRows: {} as Record<string, any>,
  insertCalls: [] as { table: string; payload: any }[],
  updateCalls: [] as { table: string; payload: any; filters: Record<string, any> }[],
  deleteCalls: [] as string[],
}));

const mocks = vi.hoisted(() => ({
  addStock: vi.fn(),
  deductStockFEFO: vi.fn(),
  requireAdmin: vi.fn(),
  requireStaff: vi.fn(),
}));

vi.mock('@/lib/actions/session', () => ({
  requireAdmin: mocks.requireAdmin,
  requireStaff: mocks.requireStaff,
}));

vi.mock('@/lib/inventory', () => ({
  addStock: mocks.addStock,
  deductStockFEFO: mocks.deductStockFEFO,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/supabase', () => {
  /**
   * Builder tiruan yang bisa di-`await` pada tahap mana pun, meniru
   * PostgREST: `.update(x).eq(y)` dan `.insert(x)` keduanya thenable.
   */
  const from = (table: string) => {
    const filters: Record<string, any> = {};
    let mode: 'select' | 'insert' | 'update' = 'select';

    const resolveSelect = () => {
      if (table === 'purchases') return { data: state.purchaseRow, error: state.purchaseError };
      if (table === 'inventory_logs') {
        return {
          data: state.existingLog.filter((row: any) => Object.entries(filters).every(([key, value]) => row[key] === value)),
          error: null,
        };
      }
      if (table === 'suppliers') return { data: state.supplierRow, error: null };
      if (table === 'products') return { data: state.productRows[filters.id] ?? null, error: null };
      return { data: null, error: null };
    };

    const resolveWrite = () => {
      if (table === 'purchases') {
        if (mode === 'update' && !state.updateError && state.purchaseRow) {
          const update = [...state.updateCalls].reverse().find((call) => call.table === 'purchases');
          if (update) state.purchaseRow = { ...state.purchaseRow, ...update.payload };
        }
        return { data: null, error: mode === 'insert' ? state.insertError : state.updateError };
      }
      return { data: null, error: null };
    };

    const resolve = () => (mode === 'select' ? resolveSelect() : resolveWrite());

    const builder: any = {};
    builder.select = () => builder;
    builder.eq = (col: string, val: any) => {
      filters[col] = val;
      return builder;
    };
    builder.limit = () => builder;
    builder.order = () => builder;
    builder.insert = (payload: any) => {
      mode = 'insert';
      state.insertCalls.push({ table, payload });
      return builder;
    };
    builder.update = (payload: any) => {
      mode = 'update';
      state.updateCalls.push({ table, payload, filters });
      return builder;
    };
    builder.delete = () => {
      mode = 'delete';
      state.deleteCalls.push(table);
      return builder;
    };
    builder.single = async () => resolve();
    builder.maybeSingle = async () => resolve();
    builder.then = (onFulfilled: any, onRejected: any) =>
      Promise.resolve(resolve()).then(onFulfilled, onRejected);
    return builder;
  };

  return {
    supabase: { auth: { getUser: vi.fn() } },
    supabaseAdmin: { from: vi.fn(from) },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  state.purchaseRow = null;
  state.purchaseError = null;
  state.updateError = null;
  state.insertError = null;
  state.existingLog = [];
  state.supplierRow = { name: 'Supplier A', raw_data: { name: 'Supplier A' } };
  state.productRows = {
    p1: { name: 'Produk A', unit: 'PCS', raw_data: { units: [{ code: 'PCS', contains: 1 }] } },
    p2: { name: 'Produk B', unit: 'PCS', raw_data: { units: [{ code: 'PCS', contains: 1 }] } },
  };
  state.insertCalls = [];
  state.updateCalls = [];
  state.deleteCalls = [];
  mocks.requireAdmin.mockResolvedValue(undefined);
  mocks.requireStaff.mockResolvedValue(undefined);
  mocks.addStock.mockImplementation(async (params: any) => {
    state.existingLog.push({
      id: `log-${state.existingLog.length + 1}`,
      reference_id: params.inventoryReference || params.reference,
      product_id: params.productId,
      type: 'MASUK',
    });
    return { success: true, newStock: 10 };
  });
});

/** Payload update terakhir untuk tabel `purchases`. */
const lastPurchaseUpdate = () =>
  [...state.updateCalls].reverse().find((c) => c.table === 'purchases');

/** Insert yang ditujukan ke satu tabel (kini setiap PO juga menyentuh modal). */
const insertKe = (table: string) => state.insertCalls.filter((c) => c.table === table);

describe('receivePurchaseOrder', () => {
  it('menambahkan stok dengan konversi satuan, lalu menandai PO diterima', async () => {
    state.purchaseRow = {
      id: 'po1',
      raw_data: {
        status: 'APPROVED',
        poNumber: 'PO-1',
        items: [{ productId: 'p1', quantity: 2, unit: 'CTN', conversion: 12, unitPrice: 1200, name: 'Produk A' }],
      },
    };

    const hasil = await receivePurchaseOrder('po1', 'wh-1');

    expect(hasil.success).toBe(true);
    expect(mocks.addStock).toHaveBeenCalledTimes(1);
    expect(mocks.addStock.mock.calls[0][0]).toMatchObject({
      productId: 'p1',
      amount: 24, // 2 CTN x 12
      warehouseId: 'wh-1',
      reference: 'PO-1',
    });
    expect(lastPurchaseUpdate()?.payload.raw_data.status).toBe('DITERIMA');
  });

  it('menyimpan operasi penerimaan agar item gagal dapat dicoba ulang', async () => {
    state.purchaseRow = {
      id: 'po1',
      raw_data: {
        status: 'APPROVED',
        poNumber: 'PO-1',
        items: [{ productId: 'p1', quantity: 1, unit: 'PCS', conversion: 1, unitPrice: 100, name: 'Produk A' }],
      },
    };
    mocks.addStock.mockRejectedValue(new Error('Produk tidak ditemukan: p1'));

    const hasil = await receivePurchaseOrder('po1', 'wh-1');

    expect(hasil.success).toBe(false);
    expect(hasil.error).toContain('Tekan terima lagi');
    expect(state.purchaseRow?.raw_data.status).toBe('APPROVED');
    expect(state.purchaseRow?.raw_data.pendingReceipt).toMatchObject({ completedItemIds: [] });
  });

  it('idempoten: melewati produk yang sudah punya log MASUK untuk PO yang sama', async () => {
    state.purchaseRow = {
      id: 'po1',
      raw_data: {
        status: 'APPROVED',
        poNumber: 'PO-1',
        items: [{ productId: 'p1', quantity: 5, unit: 'PCS', conversion: 1, unitPrice: 100, name: 'Produk A' }],
      },
    };
    // Item ini sudah pernah ditambahkan sebelum referensi penerimaan unik dipakai.
    state.existingLog = [{ id: 'log-1', reference_id: 'PO-1', product_id: 'p1', type: 'MASUK' }];

    const hasil = await receivePurchaseOrder('po1', 'wh-1');

    expect(hasil.success).toBe(true);
    expect(mocks.addStock).not.toHaveBeenCalled();
    expect(lastPurchaseUpdate()?.payload.raw_data.status).toBe('DITERIMA');
  });

  it('menolak PO yang sudah diterima', async () => {
    state.purchaseRow = { id: 'po1', raw_data: { status: 'DITERIMA', poNumber: 'PO-1', items: [] } };

    const hasil = await receivePurchaseOrder('po1', 'wh-1');

    expect(hasil.success).toBe(false);
    expect(hasil.error).toContain('sudah diterima');
    expect(mocks.addStock).not.toHaveBeenCalled();
  });

  it('tidak mengubah stok jika operasi penerimaan belum berhasil disimpan', async () => {
    state.purchaseRow = {
      id: 'po1',
      raw_data: {
        status: 'APPROVED',
        poNumber: 'PO-1',
        items: [{ productId: 'p1', quantity: 1, unit: 'PCS', conversion: 1, unitPrice: 100, name: 'Produk A' }],
      },
    };
    state.updateError = { message: 'koneksi terputus' };

    const hasil = await receivePurchaseOrder('po1', 'wh-1');

    expect(hasil.success).toBe(false);
    expect(hasil.error).toContain('Gagal menyiapkan penerimaan');
    expect(mocks.addStock).not.toHaveBeenCalled();
  });

  it('menerima jumlah aktual parsial dalam satuan dasar lalu melanjutkan sisanya', async () => {
    state.purchaseRow = {
      id: 'po1',
      raw_data: {
        status: 'APPROVED',
        poNumber: 'PO-1',
        items: [
          { id: 'item-1', productId: 'p1', quantity: 2, unit: 'CTN', conversion: 12, unitPrice: 1200, name: 'Produk A' },
          { id: 'item-2', productId: 'p2', quantity: 5, unit: 'PCS', conversion: 1, unitPrice: 100, name: 'Produk B' },
        ],
      },
    };

    const first = await receivePurchaseOrder('po1', 'wh-1', undefined, undefined, [
      { itemId: 'item-1', quantityBase: 5 },
    ]);

    expect(first).toMatchObject({ success: true, partial: true });
    expect(mocks.addStock).toHaveBeenCalledTimes(1);
    expect(mocks.addStock.mock.calls[0][0]).toMatchObject({ productId: 'p1', amount: 5 });
    expect(state.purchaseRow?.raw_data.receivedQuantitiesBase['item-1']).toBe(5);
    expect(state.purchaseRow?.raw_data.status).toBe('PARTIALLY_RECEIVED');

    const second = await receivePurchaseOrder('po1', 'wh-1', undefined, undefined, [
      { itemId: 'item-1', quantityBase: 19 },
      { itemId: 'item-2', quantityBase: 5 },
    ]);

    expect(second).toMatchObject({ success: true, partial: false });
    expect(mocks.addStock).toHaveBeenCalledTimes(3);
    expect(state.purchaseRow?.raw_data.status).toBe('DITERIMA');
    expect(state.purchaseRow?.raw_data.receivedQuantitiesBase).toEqual({ 'item-1': 24, 'item-2': 5 });
  });

  it('melanjutkan operasi tertunda tanpa menambahkan ulang item yang sudah berhasil', async () => {
    state.purchaseRow = {
      id: 'po1',
      raw_data: {
        status: 'APPROVED',
        poNumber: 'PO-1',
        items: [
          { id: 'item-1', productId: 'p1', quantity: 1, unit: 'PCS', conversion: 1, unitPrice: 100, name: 'Produk A' },
          { id: 'item-2', productId: 'p2', quantity: 1, unit: 'PCS', conversion: 1, unitPrice: 100, name: 'Produk B' },
        ],
      },
    };
    let failP2 = true;
    mocks.addStock.mockImplementation(async (params: any) => {
      if (params.productId === 'p2' && failP2) {
        failP2 = false;
        throw new Error('gagal sementara');
      }
      state.existingLog.push({
        id: `log-${state.existingLog.length + 1}`,
        reference_id: params.inventoryReference,
        product_id: params.productId,
        type: 'MASUK',
      });
      return { success: true, newStock: 10 };
    });

    const request = [
      { itemId: 'item-1', quantityBase: 1 },
      { itemId: 'item-2', quantityBase: 1 },
    ];
    const first = await receivePurchaseOrder('po1', 'wh-1', undefined, undefined, request);
    expect(first.success).toBe(false);
    expect(state.purchaseRow?.raw_data.pendingReceipt.completedItemIds).toContain('item-1');

    const retry = await receivePurchaseOrder('po1', 'wh-1', undefined, undefined, request);
    expect(retry).toMatchObject({ success: true, partial: false });
    expect(mocks.addStock.mock.calls.filter(([params]) => params.productId === 'p1')).toHaveLength(1);
    expect(mocks.addStock.mock.calls.filter(([params]) => params.productId === 'p2')).toHaveLength(2);
  });

  it('menolak edit dan hapus setelah sebagian barang diterima', async () => {
    state.purchaseRow = {
      id: 'po1',
      raw_data: {
        status: 'PARTIALLY_RECEIVED',
        receivedQuantitiesBase: { item_0: 3 },
        items: [{ id: 'item_0', productId: 'p1', quantity: 1, conversion: 12 }],
      },
    };

    const edit = await updatePurchaseOrder('po1', {
      supplierId: 'sup-1', warehouseId: 'wh-1', items: [{ productId: 'p1', quantity: 1, unitPrice: 100 }],
    });
    const hapus = await deletePurchaseOrder('po1');

    expect(edit).toMatchObject({ success: false });
    expect(hapus).toMatchObject({ success: false });
    expect(state.updateCalls).toHaveLength(0);
    expect(state.deleteCalls).toHaveLength(0);
  });

  it('membatalkan PO parsial hanya dengan mengurangi jumlah yang sudah diterima', async () => {
    state.purchaseRow = {
      id: 'po1',
      total: 1200,
      raw_data: {
        status: 'PARTIALLY_RECEIVED',
        poNumber: 'PO-1',
        warehouseId: 'wh-1',
        receivedQuantitiesBase: { item_0: 5 },
        items: [{ id: 'item_0', productId: 'p1', quantity: 2, unit: 'CTN', conversion: 12, unitPrice: 1200 }],
      },
    };

    const result = await cancelPurchaseOrder('po1');

    expect(result.success).toBe(true);
    expect(mocks.deductStockFEFO).toHaveBeenCalledWith(expect.objectContaining({
      productId: 'p1', amount: 5, warehouseId: 'wh-1',
    }));
  });
});

describe('createPurchaseOrder', () => {
  const orderBaru = {
    supplierId: 'sup-1',
    createdById: 'admin',
    items: [{ productId: 'p1', quantity: 3, unitPrice: 1000, unit: 'PCS' }],
    autoReceive: true,
    warehouseId: 'wh-1',
  };

  it('menyimpan PO dan menambah stok saat autoReceive berhasil', async () => {
    const hasil = await createPurchaseOrder(orderBaru);

    expect(hasil.success).toBe(true);
    expect(hasil.warning).toBeUndefined();
    expect(insertKe('purchases')).toHaveLength(1);
    expect(insertKe('purchases')[0].payload.raw_data.status).toBe('DITERIMA');
    expect(mocks.addStock).toHaveBeenCalledTimes(1);
  });

  it('PO tunai (default LUNAS + CASH) mencatat WITHDRAWAL modal', async () => {
    // `orderBaru` tidak mengirim paymentStatus/paymentMethod -> default
    // LUNAS + CASH, jadi uangnya HARUS tercatat keluar dari modal.
    await createPurchaseOrder(orderBaru);

    const mutasi = insertKe('capital_transactions');
    expect(mutasi).toHaveLength(1);
    expect(mutasi[0].payload.raw_data).toMatchObject({
      type: 'WITHDRAWAL',
      amount: 3000, // 3 x Rp1.000
      recordedBy: 'system',
    });
    expect(mutasi[0].payload.raw_data.referenceId).toMatch(/^po_/);
  });

  it('PO tempo (HUTANG) tidak menyentuh modal', async () => {
    await createPurchaseOrder({ ...orderBaru, paymentStatus: 'HUTANG', paymentMethod: 'HUTANG' });

    expect(insertKe('capital_transactions')).toHaveLength(0);
  });

  it('melaporkan warning (bukan gagal) bila stok tidak bisa ditambahkan', async () => {
    mocks.addStock.mockRejectedValue(new Error('kolom stock tidak ada'));

    const hasil = await createPurchaseOrder(orderBaru);

    // PO sudah tersimpan, jadi ini BUKAN kegagalan total.
    expect(hasil.success).toBe(true);
    expect(hasil.warning).toContain('stok gagal ditambahkan');
    expect(insertKe('purchases')).toHaveLength(1);
    // Status dikembalikan ke APPROVED supaya tombol "Terima" muncul lagi.
    expect(lastPurchaseUpdate()?.payload.raw_data.status).toBe('APPROVED');
    expect(lastPurchaseUpdate()?.payload.raw_data.receivedAt).toBeUndefined();
  });

  it('satu produk gagal tidak menggagalkan produk lain', async () => {
    state.productRows.p2 = { name: 'Produk B', unit: 'PCS', raw_data: { units: [{ code: 'PCS', contains: 1 }] } };
    mocks.addStock.mockImplementation(async ({ productId }: any) => {
      if (productId === 'p1') throw new Error('gagal p1');
      return { success: true, newStock: 5 };
    });

    const hasil = await createPurchaseOrder({
      ...orderBaru,
      items: [
        { productId: 'p1', quantity: 1, unitPrice: 1000, unit: 'PCS' },
        { productId: 'p2', quantity: 1, unitPrice: 2000, unit: 'PCS' },
      ],
    });

    expect(mocks.addStock).toHaveBeenCalledTimes(2);
    expect(hasil.success).toBe(true);
    expect(hasil.warning).toContain('1 item');
  });

  it('tidak menyentuh stok bila autoReceive tidak diaktifkan', async () => {
    const hasil = await createPurchaseOrder({ ...orderBaru, autoReceive: false });

    expect(hasil.success).toBe(true);
    expect(hasil.warning).toBeUndefined();
    expect(mocks.addStock).not.toHaveBeenCalled();
    expect(insertKe('purchases')[0].payload.raw_data.status).toBe('APPROVED');
  });
});

describe('payPurchaseDebt', () => {
  it('berhasil melunasi PO berstatus HUTANG dan mengubah paymentStatus menjadi LUNAS', async () => {
    state.purchaseRow = {
      id: 'po-hutang-1',
      total: 500000,
      payment_status: 'HUTANG',
      raw_data: {
        poNumber: 'PO-HUTANG-01',
        paymentStatus: 'HUTANG',
        paymentMethod: 'TEMPO',
        supplierName: 'PT Sumber Berkah',
        items: [{ id: 'item-1', name: 'Minyak Goreng', quantity: 10, unitPrice: 50000, totalPrice: 500000 }],
      },
    };

    const hasil = await payPurchaseDebt('po-hutang-1', 'TRANSFER', 'Lunas via BCA');

    expect(hasil.success).toBe(true);
    const update = lastPurchaseUpdate();
    expect(update).toBeDefined();
    expect(update!.payload.raw_data.paymentStatus).toBe('LUNAS');
    expect(update!.payload.raw_data.paymentMethod).toBe('TRANSFER');
    expect(update!.payload.raw_data.notes).toContain('Lunas via BCA');
  });

  it('menolak pelunasan jika PO sudah berstatus LUNAS', async () => {
    state.purchaseRow = {
      id: 'po-lunas-1',
      total: 300000,
      payment_status: 'LUNAS',
      raw_data: {
        poNumber: 'PO-LUNAS-01',
        paymentStatus: 'LUNAS',
      },
    };

    const hasil = await payPurchaseDebt('po-lunas-1', 'CASH');

    expect(hasil.success).toBe(false);
    expect(hasil.error).toContain('sudah berstatus LUNAS');
  });
});

describe('payBulkPurchaseDebt', () => {
  it('berhasil memproses pelunasan beberapa PO sekaligus', async () => {
    state.purchaseRow = {
      id: 'po-bulk-1',
      total: 250000,
      payment_status: 'HUTANG',
      raw_data: {
        poNumber: 'PO-BULK-01',
        paymentStatus: 'HUTANG',
        supplierName: 'Supplier Maju',
      },
    };

    const hasil = await payBulkPurchaseDebt(['po-bulk-1'], 'CASH', 'Pelunasan masal');

    expect(hasil.success).toBe(true);
    expect(hasil.updatedCount).toBe(1);
  });
});

