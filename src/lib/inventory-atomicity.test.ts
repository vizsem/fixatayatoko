import { describe, it, expect, vi } from 'vitest';
import { transferStockTx, adjustStockTx } from '@/lib/inventory';

// Mock Firebase (still imported by inventory.ts)
vi.mock('@/lib/firebase', () => {
  const M = Symbol('supabase_increment');
  return {
    db: {},
    doc: vi.fn((_db: any, collection: any, id: any) => ({ path: `${collection}/${id}` })),
    collection: vi.fn((_db: any, path: any) => ({ path })),
    serverTimestamp: vi.fn(() => 'mocked-timestamp'),
    INCREMENT_MARKER: M,
    increment: (n: any) => ({ [M]: true, delta: n }),
  };
});

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: any, collection: any, id: any) => ({ path: `${collection}/${id}` })),
  collection: vi.fn((_db: any, path: any) => ({ path })),
  serverTimestamp: vi.fn(() => 'mocked-timestamp'),
  increment: vi.fn((n: any) => `incremented-${n}`),
}));

// vi.mock factories are hoisted — everything must be inline (no external references)
vi.mock('@/lib/supabase', () => {
  const productData = {
    id: 'prod-1',
    name: 'Produk A',
    raw_data: {
      stock: 100,
      stockByWarehouse: { 'gudang-A': 60, 'gudang-B': 40 },
      name: 'Produk A',
      volumeInCtn: 1,
    },
  };

  const makeFrom = () =>
    vi.fn((_table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: productData, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: productData, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (f: any) => Promise.resolve({ data: null, error: null }).then(f),
    }));

  return {
    supabase: { auth: { getUser: vi.fn() } },
    supabaseAdmin: { from: makeFrom() },
  };
});

vi.mock('@/lib/supabase-admin', () => {
  const productData = {
    id: 'prod-1',
    name: 'Produk A',
    raw_data: {
      stock: 100,
      stockByWarehouse: { 'gudang-A': 60, 'gudang-B': 40 },
      name: 'Produk A',
      volumeInCtn: 1,
    },
  };

  return {
    supabaseAdmin: {
      from: vi.fn((_table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: productData, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: productData, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (f: any) => Promise.resolve({ data: null, error: null }).then(f),
      })),
    },
  };
});

describe('Inventory Atomicity (Unit & Logic Check)', () => {
  it('transferStockTx should move stock between warehouses without changing total stock', async () => {
    await expect(
      transferStockTx({
        productId: 'prod-1',
        amount: 15,
        fromWarehouseId: 'gudang-A',
        toWarehouseId: 'gudang-B',
        adminId: 'admin-1',
        source: 'TRANSFER',
      })
    ).resolves.toEqual({ success: true });
  });

  it('transferStockTx should fail if insufficient stock in source warehouse', async () => {
    // 200 >> gudang-A stock (60), so should throw
    await expect(
      transferStockTx({
        productId: 'prod-1',
        amount: 200,
        fromWarehouseId: 'gudang-A',
        toWarehouseId: 'gudang-B',
        adminId: 'admin-1',
        source: 'TRANSFER',
      })
    ).rejects.toThrow(/Stok di gudang asal tidak cukup/);
  });

  it('adjustStockTx (Opname) should calculate correct difference and update total stock', async () => {
    await expect(
      adjustStockTx({
        productId: 'prod-1',
        newStock: 95,
        warehouseId: 'gudang-A',
        adminId: 'admin-1',
        source: 'OPNAME',
      })
    ).resolves.toMatchObject({ success: true });
  });
});
