import { describe, it, expect } from 'vitest';
import { buildDuplicateCart, productIdDariItem } from '@/lib/purchase-duplicate';

/**
 * Item di bawah adalah bentuk NYATA yang disimpan `createPurchaseOrder`,
 * diambil dari PO `po_1790830010255` di database.
 *
 * Perhatikan `id` = `item_0_...` (ID BARIS ITEM) sedangkan `productId` berisi
 * ID PRODUK. Versi lama memakai `item.id` untuk mencari produk, sehingga
 * "Re Order" selalu menghasilkan keranjang yang menunjuk produk tidak ada.
 */
const itemPoNyata = [
  {
    id: 'item_0_1790830010255',
    productId: 'prod_1790116375652_1scuq',
    name: 'KOPI GOOD DAY FREEZE MOCAFRIO',
    unit: 'CTN',
    conversion: 120,
    quantity: 1,
    purchasePrice: 264960,
    unitPrice: 264960,
    totalPrice: 264960,
  },
  {
    id: 'item_1_1790830010255',
    productId: 'fF47GQ2BEGFhqinMY7t5',
    name: 'ROSE BRAND GULA KRISTAL TEBU (KUNING) 1KG',
    unit: 'CTN',
    conversion: 20,
    quantity: 1,
    purchasePrice: 350000,
    unitPrice: 350000,
    totalPrice: 350000,
  },
];

const produk = [
  {
    id: 'prod_1790116375652_1scuq',
    name: 'KOPI GOOD DAY FREEZE MOCAFRIO',
    unit: 'PCS',
    purchasePrice: 2208,
    units: [
      { code: 'PCS', contains: 1 },
      { code: 'CTN', contains: 120 },
    ],
  },
  {
    id: 'fF47GQ2BEGFhqinMY7t5',
    name: 'ROSE BRAND GULA KRISTAL TEBU (KUNING) 1KG',
    unit: 'PCS',
    purchasePrice: 17500,
    units: [
      { code: 'PCS', contains: 1 },
      { code: 'CTN', contains: 20 },
    ],
  },
];

describe('productIdDariItem', () => {
  it('memakai productId, bukan id baris item', () => {
    expect(productIdDariItem(itemPoNyata[0])).toBe('prod_1790116375652_1scuq');
  });

  it('menolak id baris item yang tidak punya productId', () => {
    expect(productIdDariItem({ id: 'item_3_1790830010255' })).toBeNull();
  });

  it('menerima id produk gaya lama (tanpa prefix item_)', () => {
    expect(productIdDariItem({ id: '9wauX027oF0sLvQXsrcA' })).toBe('9wauX027oF0sLvQXsrcA');
  });

  it('menerima product_id (snake_case)', () => {
    expect(productIdDariItem({ product_id: 'abc123' })).toBe('abc123');
  });
});

describe('buildDuplicateCart', () => {
  it('memetakan item PO nyata ke keranjang dengan id produk yang benar', () => {
    const { cart, dilewati } = buildDuplicateCart(itemPoNyata, produk);

    expect(dilewati).toBe(0);
    expect(cart).toHaveLength(2);
    expect(cart.map((c) => c.id)).toEqual([
      'prod_1790116375652_1scuq',
      'fF47GQ2BEGFhqinMY7t5',
    ]);
    // Tidak boleh ada id baris item yang bocor ke keranjang.
    expect(cart.some((c) => c.id.startsWith('item_'))).toBe(false);
  });

  it('mempertahankan satuan beli dan konversi asli', () => {
    const { cart } = buildDuplicateCart(itemPoNyata, produk);

    expect(cart[0].unit).toBe('CTN');
    expect(cart[0].conversion).toBe(120);
    expect(cart[0].quantity).toBe(1);
    expect(cart[0].purchasePrice).toBe(264960);
  });

  it('memakai opsi unit milik produk agar dropdown satuan lengkap', () => {
    const { cart } = buildDuplicateCart(itemPoNyata, produk);

    expect(cart[0].availableUnits.map((u) => u.code)).toEqual(['PCS', 'CTN']);
  });

  it('melewati item tanpa id produk dan melaporkan jumlahnya', () => {
    const { cart, dilewati } = buildDuplicateCart(
      [...itemPoNyata, { id: 'item_2_1790830010255', quantity: 5 }],
      produk
    );

    expect(cart).toHaveLength(2);
    expect(dilewati).toBe(1);
  });

  it('melengkapi nama dan satuan dari daftar produk bila item tidak punya', () => {
    const { cart } = buildDuplicateCart(
      [{ productId: 'fF47GQ2BEGFhqinMY7t5', quantity: 2 }],
      produk
    );

    expect(cart[0].name).toBe('ROSE BRAND GULA KRISTAL TEBU (KUNING) 1KG');
    expect(cart[0].unit).toBe('PCS');
    expect(cart[0].conversion).toBe(1);
  });

  it('memakai unitPrice sebagai cadangan bila purchasePrice tidak ada', () => {
    const { cart } = buildDuplicateCart(
      [{ productId: 'abc', unitPrice: 5000, quantity: 3 }],
      []
    );

    expect(cart[0].purchasePrice).toBe(5000);
    expect(cart[0].availableUnits).toEqual([{ code: 'PCS', contains: 1 }]);
  });

  it('mengembalikan keranjang kosong untuk input kosong', () => {
    expect(buildDuplicateCart(undefined, produk)).toEqual({ cart: [], dilewati: 0 });
    expect(buildDuplicateCart([], produk)).toEqual({ cart: [], dilewati: 0 });
  });
});
