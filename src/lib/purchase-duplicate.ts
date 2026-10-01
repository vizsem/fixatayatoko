import type { UnitOption } from '@/lib/normalize';

/**
 * Pemetaan "Re Order" (duplikat PO) menjadi isi keranjang halaman pembelian.
 *
 * Dipisah dari komponen agar bisa diuji tanpa React.
 *
 * Latar belakang bug yang diperbaiki di sini:
 *
 *  1. Item PO hasil `createPurchaseOrder` disimpan dalam bentuk
 *       { id: 'item_0_1790830010255', productId: 'prod_...', quantity, unit, conversion }
 *     `id` adalah ID BARIS ITEM, bukan ID produk. Versi lama memakai `item.id`
 *     untuk mencari produk, sehingga tidak pernah ketemu. Id produk yang benar
 *     ada di `productId` (atau `product_id`).
 *
 *  2. Item PO lama (hasil impor Firestore) kadang tidak punya `productId`,
 *     melainkan `id` berisi id produk asli. Itu tetap diterima selama bukan
 *     id baris item (tidak diawali `item_`).
 */

export type PurchaseItemForDuplicate = {
  id?: string;
  productId?: string;
  product_id?: string;
  name?: string;
  productName?: string;
  purchasePrice?: number;
  unitPrice?: number;
  quantity?: number;
  unit?: string;
  conversion?: number;
  availableUnits?: UnitOption[];
};

export type DuplicateProductLookup = {
  id: string;
  name?: string;
  unit?: string;
  purchasePrice?: number;
  units?: UnitOption[];
};

export type DuplicateCartItem = {
  id: string;
  name: string;
  purchasePrice: number;
  quantity: number;
  unit: string;
  conversion: number;
  availableUnits: UnitOption[];
};

function angka(nilai: unknown, cadangan = 0): number {
  const n = Number(nilai);
  return Number.isFinite(n) ? n : cadangan;
}

/**
 * Ambil ID produk dari sebuah item PO.
 *
 * Mengembalikan `null` bila tidak ada ID produk yang bisa dipakai — lebih baik
 * item itu dilewati daripada membuat baris keranjang yang menunjuk produk
 * tidak ada (yang akan gagal saat PO disimpan).
 */
export function productIdDariItem(item: PurchaseItemForDuplicate): string | null {
  const kandidat = (item.productId || item.product_id || '').trim();
  if (kandidat) return kandidat;

  const fallback = (item.id || '').trim();
  if (fallback && !fallback.startsWith('item_')) return fallback;

  return null;
}

/**
 * Bangun isi keranjang dari item-item PO sumber.
 *
 * @param items   item dari `raw_data.items` PO sumber
 * @param products daftar produk aktif (untuk melengkapi nama, satuan, & opsi unit)
 */
export function buildDuplicateCart(
  items: PurchaseItemForDuplicate[] | undefined,
  products: DuplicateProductLookup[]
): { cart: DuplicateCartItem[]; dilewati: number } {
  if (!Array.isArray(items) || items.length === 0) return { cart: [], dilewati: 0 };

  const byId = new Map(products.map((p) => [p.id, p]));
  const cart: DuplicateCartItem[] = [];
  let dilewati = 0;

  for (const item of items) {
    const productId = productIdDariItem(item);
    if (!productId) {
      dilewati++;
      continue;
    }

    const produk = byId.get(productId);
    const unit = item.unit || produk?.unit || 'PCS';
    const conversion = angka(item.conversion, 1) || 1;

    // Utamakan opsi unit milik produk (agar pilihan satuan di dropdown lengkap).
    // Kalau produk tidak punya, pakai opsi yang tersimpan di item PO, lalu
    // terakhir bikin satu opsi dari data item itu sendiri.
    let availableUnits: UnitOption[] = [];
    if (produk?.units && produk.units.length > 0) {
      availableUnits = produk.units;
    } else if (item.availableUnits && item.availableUnits.length > 0) {
      availableUnits = item.availableUnits;
    } else {
      availableUnits = [{ code: unit, contains: conversion }];
    }

    cart.push({
      id: productId,
      name: item.name || item.productName || produk?.name || 'Produk',
      purchasePrice: angka(item.purchasePrice ?? item.unitPrice),
      quantity: angka(item.quantity, 1) || 1,
      unit,
      conversion,
      availableUnits,
    });
  }

  return { cart, dilewati };
}
