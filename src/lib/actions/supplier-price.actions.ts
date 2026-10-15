'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { requireStaff } from '@/lib/actions/session';
import { ParsedSupplierItem, parseSupplierPriceBroadcast } from '@/lib/supplier-price-parser';

export interface SupplierItemMatchResult extends ParsedSupplierItem {
  matchedProductId?: string;
  matchedProductName?: string;
  matchedProductSku?: string;
  existingCostPrice?: number;
  existingSellingPrice?: number;
  existingIsActive?: boolean;
  matchType?: 'EXACT' | 'FUZZY' | 'NONE';
}

export interface ImportSupplierDraftPayload {
  supplierName: string;
  supplierPeriod?: string;
  items: Array<{
    name: string;
    category: string;
    price: number;
    unit: string;
    unitCount?: number;
    suggestedPrice: number;
    isKosong: boolean;
    notes?: string;
    matchedProductId?: string;
    action: 'CREATE_DRAFT' | 'UPDATE_PRICE' | 'SKIP';
  }>;
}

/**
 * Normalisasi string nama untuk perbandingan fuzzy sederhana
 */
function cleanForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mencocokkan daftar item supplier dengan katalog produk di database toko
 */
export async function matchSupplierBroadcastItems(items: ParsedSupplierItem[]): Promise<SupplierItemMatchResult[]> {
  await requireStaff();

  // Ambil semua produk aktif maupun non-aktif dari database untuk pencocokan
  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('id, name, sku, barcode, price, cost_price, unit, is_active, raw_data');

  if (error || !products) {
    console.error('Error fetching products for supplier matching:', error);
    // Kembalikan items apa adanya jika query gagal
    return items.map(it => ({ ...it, matchType: 'NONE' }));
  }

  // Siapkan map pencocokan cepat
  const exactNameMap = new Map<string, any>();
  const normalizedList: Array<{ cleanName: string; product: any }> = [];

  for (const p of products) {
    const rawName = String(p.name || '').trim();
    if (rawName) {
      exactNameMap.set(rawName.toUpperCase(), p);
      normalizedList.push({
        cleanName: cleanForComparison(rawName),
        product: p,
      });
    }
  }

  return items.map((item) => {
    const itemNameUpper = item.name.trim().toUpperCase();
    const itemClean = cleanForComparison(item.name);

    // 1. Cek Exact Match
    const exactMatch = exactNameMap.get(itemNameUpper);
    if (exactMatch) {
      return {
        ...item,
        matchedProductId: exactMatch.id,
        matchedProductName: exactMatch.name,
        matchedProductSku: exactMatch.sku,
        existingCostPrice: exactMatch.cost_price || exactMatch.raw_data?.Modal || exactMatch.raw_data?.costPrice,
        existingSellingPrice: exactMatch.price || exactMatch.raw_data?.Ecer,
        existingIsActive: exactMatch.is_active,
        matchType: 'EXACT',
      };
    }

    // 2. Cek Fuzzy Match (jika nama produk mengandung kata-kata penting yang sama)
    const fuzzyMatch = normalizedList.find((entry) => {
      if (entry.cleanName === itemClean) return true;
      if (entry.cleanName.length > 5 && itemClean.length > 5) {
        if (entry.cleanName.includes(itemClean) || itemClean.includes(entry.cleanName)) return true;
      }
      return false;
    });

    if (fuzzyMatch) {
      const p = fuzzyMatch.product;
      return {
        ...item,
        matchedProductId: p.id,
        matchedProductName: p.name,
        matchedProductSku: p.sku,
        existingCostPrice: p.cost_price || p.raw_data?.Modal || p.raw_data?.costPrice,
        existingSellingPrice: p.price || p.raw_data?.Ecer,
        existingIsActive: p.is_active,
        matchType: 'FUZZY',
      };
    }

    return {
      ...item,
      matchType: 'NONE',
    };
  });
}

/**
 * Menyimpan / Memproses Hasil Import Broadcast Supplier:
 * - Membuat produk baru sebagai DRAFT (is_active: false, stock: 0)
 * - Mengupdate acuan harga beli supplier untuk produk yang sudah terdaftar
 */
export async function importSupplierDraftProducts(payload: ImportSupplierDraftPayload) {
  await requireStaff();
  const now = new Date().toISOString();

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const item of payload.items) {
    if (item.action === 'SKIP' || item.isKosong) {
      skippedCount++;
      continue;
    }

    try {
      if (item.action === 'CREATE_DRAFT' && !item.matchedProductId) {
        // Buat produk baru dengan status DRAFT (non-aktif)
        const id = `prod_${Date.now()}_${randomUUID().slice(0, 8)}`;
        const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const sku = `DRAFT-${randomCode}`;
        const unitName = (item.unit || 'CTN').toUpperCase();

        const rawData = {
          ID: sku,
          Nama: item.name.toUpperCase(),
          Kategori: item.category,
          Satuan: unitName,
          Stok: 0,
          Modal: item.price,
          purchasePrice: item.price,
          Ecer: item.suggestedPrice,
          price: item.suggestedPrice,
          costPrice: item.price,
          Supplier: payload.supplierName,
          supplierPriceDate: payload.supplierPeriod,
          Status: 0, // Legacy non-aktif / draft
          isActive: false,
          status: 'DRAFT',
          importedFromBroadcast: true,
          units: [
            {
              code: unitName,
              contains: 1,
              price: item.suggestedPrice,
              costPrice: item.price,
              label: unitName,
            },
          ],
          createdAt: now,
          updatedAt: now,
        };

        const { error: insertError } = await supabaseAdmin.from('products').insert({
          id,
          sku,
          name: item.name.toUpperCase(),
          category: item.category,
          unit: unitName,
          price: item.suggestedPrice,
          cost_price: item.price,
          stock: 0,
          is_active: false, // DRAFT: Tidak muncul di kasir / publik
          raw_data: rawData,
          created_at: now,
          updated_at: now,
        });

        if (insertError) {
          console.error(`Gagal membuat draft produk "${item.name}":`, insertError);
          errors.push(`Gagal membuat ${item.name}: ${insertError.message}`);
        } else {
          createdCount++;
        }
      } else if (item.action === 'UPDATE_PRICE' && item.matchedProductId) {
        // Update harga acuan beli supplier di produk yang sudah ada
        const { data: existingProd, error: fetchErr } = await supabaseAdmin
          .from('products')
          .select('id, raw_data, cost_price')
          .eq('id', item.matchedProductId)
          .single();

        if (fetchErr || !existingProd) {
          errors.push(`Produk ID ${item.matchedProductId} tidak ditemukan.`);
          continue;
        }

        const raw = existingProd.raw_data && typeof existingProd.raw_data === 'object'
          ? { ...existingProd.raw_data }
          : {};

        raw.lastSupplierPrice = item.price;
        raw.lastSupplierName = payload.supplierName;
        raw.lastSupplierDate = payload.supplierPeriod;
        raw.lastSupplierUnit = item.unit;

        // Simpan riwayat penawaran harga supplier
        if (!Array.isArray(raw.supplierPriceQuotes)) {
          raw.supplierPriceQuotes = [];
        }
        raw.supplierPriceQuotes.unshift({
          supplier: payload.supplierName,
          period: payload.supplierPeriod,
          price: item.price,
          unit: item.unit,
          date: now,
        });
        raw.supplierPriceQuotes = raw.supplierPriceQuotes.slice(0, 10); // Simpan 10 riwayat terakhir

        const { error: updateErr } = await supabaseAdmin
          .from('products')
          .update({
            raw_data: raw,
            updated_at: now,
          })
          .eq('id', item.matchedProductId);

        if (updateErr) {
          errors.push(`Gagal mengupdate acuan harga ${item.name}: ${updateErr.message}`);
        } else {
          updatedCount++;
        }
      }
    } catch (err: any) {
      console.error(`Error processing item ${item.name}:`, err);
      errors.push(`Error ${item.name}: ${err?.message || 'Unknown error'}`);
    }
  }

  revalidatePath('/admin/products');
  revalidatePath('/admin/purchases');

  return {
    success: true,
    createdCount,
    updatedCount,
    skippedCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Helper untuk mem-parsing teks dan langsung mencocokkan ke database dalam satu panggilan
 */
export async function parseAndMatchSupplierBroadcast(text: string) {
  await requireStaff();
  const parsed = parseSupplierPriceBroadcast(text);
  const matchedItems = await matchSupplierBroadcastItems(parsed.items);

  return {
    ...parsed,
    items: matchedItems,
  };
}
