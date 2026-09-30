import { describe, it, expect } from 'vitest';
import { buildSyncMatrix, OUT_OF_SYNC_THRESHOLD } from './stock-sync-matrix';

const products = [
  { id: 'p1', name: 'Beras', stockByWarehouse: { w1: 10, w2: 0 } },
  { id: 'p2', name: 'Gula', stockByWarehouse: { w1: 7 } },
];

const warehouses = [
  { id: 'w1', name: 'Gudang Utama' },
  { id: 'w2', name: 'Gudang Cabang' },
];

const stocks = [
  { productId: 'p1', warehouseId: 'w1', quantity: 10 }, // sama -> SYNCED
  { productId: 'p1', warehouseId: 'w2', quantity: 3 }, // selisih 3 -> PENDING
  { productId: 'p2', warehouseId: 'w1', quantity: 20 }, // selisih 13 -> OUT_OF_SYNC
];

describe('buildSyncMatrix', () => {
  it('menghasilkan perkalian kartesian produk x gudang', () => {
    const rows = buildSyncMatrix(products, warehouses, stocks);
    expect(rows).toHaveLength(2 * 2);
    expect(rows.map((r) => r.id).sort()).toEqual(['p1_w1', 'p1_w2', 'p2_w1', 'p2_w2']);
  });

  it('menandai SYNCED bila stok sistem dan gudang sama', () => {
    const rows = buildSyncMatrix(products, warehouses, stocks);
    const row = rows.find((r) => r.id === 'p1_w1')!;
    expect(row.status).toBe('SYNCED');
    expect(row.difference).toBe(0);
  });

  it('menandai PENDING bila selisih 1..ambang batas', () => {
    const row = buildSyncMatrix(products, warehouses, stocks).find((r) => r.id === 'p1_w2')!;
    expect(row.difference).toBe(3);
    expect(row.status).toBe('PENDING');
  });

  it('menandai OUT_OF_SYNC bila selisih melebihi ambang batas', () => {
    const row = buildSyncMatrix(products, warehouses, stocks).find((r) => r.id === 'p2_w1')!;
    expect(row.difference).toBe(13);
    expect(row.status).toBe('OUT_OF_SYNC');
  });

  it('memperlakukan selisih tepat di ambang batas sebagai PENDING, bukan OUT_OF_SYNC', () => {
    const rows = buildSyncMatrix(
      [{ id: 'p', name: 'X', stockByWarehouse: { w: 0 } }],
      [{ id: 'w', name: 'W' }],
      [{ productId: 'p', warehouseId: 'w', quantity: OUT_OF_SYNC_THRESHOLD }]
    );
    expect(rows[0].difference).toBe(OUT_OF_SYNC_THRESHOLD);
    expect(rows[0].status).toBe('PENDING');
  });

  it('memakai stok gudang 0 bila baris warehouseStock tidak ada', () => {
    const rows = buildSyncMatrix(products, warehouses, []);
    expect(rows.find((r) => r.id === 'p1_w1')!.warehouseStock).toBe(0);
    expect(rows.find((r) => r.id === 'p1_w1')!.difference).toBe(10);
    expect(rows.find((r) => r.id === 'p1_w1')!.status).toBe('OUT_OF_SYNC');
  });

  it('memakai stok sistem 0 bila stockByWarehouse tidak memuat gudang itu', () => {
    const row = buildSyncMatrix(products, warehouses, stocks).find((r) => r.id === 'p2_w2')!;
    expect(row.systemStock).toBe(0);
    expect(row.warehouseStock).toBe(0);
  });

  it('mengubah nilai numerik berbentuk string menjadi angka', () => {
    const rows = buildSyncMatrix(
      [{ id: 'p', name: 'X', stockByWarehouse: { w: '4' } }],
      [{ id: 'w', name: 'W' }],
      [{ productId: 'p', warehouseId: 'w', quantity: '9' }]
    );
    expect(rows[0].systemStock).toBe(4);
    expect(rows[0].warehouseStock).toBe(9);
    expect(rows[0].difference).toBe(5);
    expect(rows[0].status).toBe('PENDING');
  });

  it('memakai nama cadangan bila nama produk/gudang kosong', () => {
    const rows = buildSyncMatrix([{ id: 'p1' }], [{ id: 'w1' }], []);
    expect(rows[0].productName).toBe('Untitled');
    expect(rows[0].warehouseName).toBe('Unknown');
  });

  it('mengembalikan array kosong bila tidak ada produk atau gudang', () => {
    expect(buildSyncMatrix([], warehouses, stocks)).toEqual([]);
    expect(buildSyncMatrix(products, [], stocks)).toEqual([]);
  });
});
