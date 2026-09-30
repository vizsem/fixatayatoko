import { describe, it, expect } from 'vitest';
import { buildInventoryReport, FALLBACK_COST_RATIO } from './inventory-report';

const products = [
  { id: 'p1', name: 'Beras', category: 'Sembako', stock: 10, Modal: 1000, imageUrl: 'a.jpg', warehouseId: 'w1' },
  { id: 'p2', name: 'Gula', category: 'Sembako', stock: 0, purchasePrice: 2000 },
  { id: 'p3', name: 'Kopi', category: 'Minuman', stock: 4, priceEcer: 5000 },
];

const transactions = [
  { productId: 'p1', type: 'STOCK_IN', quantity: 5 },
  { productId: 'p1', type: 'STOCK_IN', quantity: '5' },
  { productId: 'p1', type: 'STOCK_OUT', quantity: 3 },
  { productId: 'p2', type: 'STOCK_OUT', quantity: 7 },
  { productId: 'p3', type: 'STOCK_IN', quantity: 2 },
  { productId: 'p3', type: 'LAINNYA', quantity: 99 }, // tipe tak dikenal -> diabaikan
  { productId: '', type: 'STOCK_IN', quantity: 1 }, // tanpa produk -> diabaikan
];

const warehouses = [{ id: 'w1', name: 'Gudang Utama' }, { id: 'w2' }];

describe('buildInventoryReport', () => {
  it('menjumlahkan stok masuk dan keluar per produk', () => {
    const { inventory } = buildInventoryReport(products, transactions, warehouses);
    const p1 = inventory.find((i) => i.id === 'p1')!;
    expect(p1.stockIn).toBe(10); // 5 + '5'
    expect(p1.stockOut).toBe(3);
  });

  it('mengabaikan tipe transaksi yang tidak dikenal', () => {
    const { inventory } = buildInventoryReport(products, transactions, warehouses);
    const p3 = inventory.find((i) => i.id === 'p3')!;
    expect(p3.stockIn).toBe(2);
    expect(p3.stockOut).toBe(0);
  });

  it('menghitung turnover rate sebagai stok keluar dibagi stok saat ini', () => {
    const { inventory } = buildInventoryReport(products, transactions, warehouses);
    expect(inventory.find((i) => i.id === 'p1')!.turnoverRate).toBeCloseTo(0.3);
  });

  it('turnover rate 0 bila stok kosong (hindari bagi nol)', () => {
    const { inventory } = buildInventoryReport(products, transactions, warehouses);
    const p2 = inventory.find((i) => i.id === 'p2')!;
    expect(p2.currentStock).toBe(0);
    expect(p2.turnoverRate).toBe(0);
    expect(p2.stockValue).toBe(0);
  });

  it('memakai Modal sebagai harga pokok', () => {
    const { inventory } = buildInventoryReport(products, transactions, warehouses);
    expect(inventory.find((i) => i.id === 'p1')!.stockValue).toBe(10 * 1000);
  });

  it('jatuh ke purchasePrice bila Modal tidak ada', () => {
    const { inventory } = buildInventoryReport(
      [{ id: 'p', name: 'X', stock: 3, purchasePrice: 2000 }],
      [],
      []
    );
    expect(inventory[0].stockValue).toBe(6000);
  });

  it('jatuh ke priceEcer x rasio bila Modal & purchasePrice tidak ada', () => {
    const { inventory } = buildInventoryReport(
      [{ id: 'p', name: 'X', stock: 2, priceEcer: 5000 }],
      [],
      []
    );
    expect(inventory[0].stockValue).toBe(2 * 5000 * FALLBACK_COST_RATIO);
  });

  it('Modal bernilai 0 dianggap tidak ada (memakai purchasePrice)', () => {
    const { inventory } = buildInventoryReport(
      [{ id: 'p', name: 'X', stock: 1, Modal: 0, purchasePrice: 700 }],
      [],
      []
    );
    expect(inventory[0].stockValue).toBe(700);
  });

  it('meneruskan imageUrl dan warehouseId', () => {
    const { inventory } = buildInventoryReport(products, transactions, warehouses);
    const p1 = inventory.find((i) => i.id === 'p1')!;
    expect(p1.imageUrl).toBe('a.jpg');
    expect(p1.warehouseId).toBe('w1');
  });

  it('memakai id sebagai nama gudang bila namanya kosong', () => {
    const { warehouses: result } = buildInventoryReport([], [], warehouses);
    expect(result).toEqual([
      { id: 'w1', name: 'Gudang Utama' },
      { id: 'w2', name: 'w2' },
    ]);
  });

  it('mengembalikan daftar kosong bila tidak ada produk', () => {
    const result = buildInventoryReport([], transactions, warehouses);
    expect(result.inventory).toEqual([]);
    expect(result.warehouses).toHaveLength(2);
  });

  it('menangani nilai tidak valid tanpa menghasilkan NaN', () => {
    const { inventory } = buildInventoryReport(
      [{ id: 'p', name: 'X', stock: 'bukan-angka', Modal: 'x' }],
      [{ productId: 'p', type: 'STOCK_IN', quantity: 'y' }],
      []
    );
    expect(inventory[0].currentStock).toBe(0);
    expect(inventory[0].stockIn).toBe(0);
    expect(inventory[0].stockValue).toBe(0);
    expect(Number.isNaN(inventory[0].turnoverRate)).toBe(false);
  });
});
