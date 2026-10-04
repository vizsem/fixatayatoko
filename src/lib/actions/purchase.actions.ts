'use server'

import { requireAdmin, requireStaff } from '@/lib/actions/session';

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import { addStock, deductStockFEFO } from '@/lib/inventory'
import { catatMutasiModalPO } from '@/lib/capital-ledger'

type PurchaseItemInput = {
  productId: string
  quantity: number
  unitPrice: number
  unit?: string
}

/**
 * Hasil aksi PO.
 *
 * `warning` dipakai untuk kasus "sebagian berhasil": PO sudah tersimpan tetapi
 * stok belum seluruhnya masuk. Ini BUKAN kegagalan — melaporkannya sebagai
 * `success: false` membuat pengguna mengira PO tidak dibuat, padahal barisnya
 * sudah ada di daftar.
 */
export type PurchaseActionResult = {
  success: boolean
  error?: string
  warning?: string
  data?: any
}

function normalizeStatus(status?: string): string {
  if (!status) return 'RECEIVED';
  const s = status.toUpperCase();
  if (s === 'DITERIMA' || s === 'RECEIVED') return 'RECEIVED';
  if (s === 'DIBATALKAN' || s === 'CANCELLED') return 'CANCELLED';
  if (s === 'MENUNGGU' || s === 'PENDING' || s === 'PENDING_APPROVAL') return 'PENDING_APPROVAL';
  if (s === 'APPROVED' || s === 'DISETUJUI') return 'APPROVED';
  if (s === 'DRAFT') return 'DRAFT';
  return s;
}

function parseDate(val: any): Date {
  if (!val) return new Date();
  if (val.toDate && typeof val.toDate === 'function') {
    return val.toDate();
  }
  if (val._seconds) {
    return new Date(val._seconds * 1000);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

/** Gabungkan beberapa pesan peringatan opsional menjadi satu kalimat. */
function gabungPeringatan(...pesan: Array<string | null | undefined>): string {
  return pesan.filter((p): p is string => Boolean(p)).join(' ');
}

export async function getPurchaseOrders(filters?: { status?: string; supplierId?: string }) {
  await requireStaff();
  try {
    const query = supabaseAdmin
      .from('purchases')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: rows, error } = await query;

    if (error || !rows) return [];

    let mapped = rows.map((p: any) => {
      const raw = p.raw_data || {};
      const items = (raw.items || []).map((item: any, idx: number) => {
        const qty = Number(item.quantity ?? 1);
        const price = Number(item.purchasePrice ?? item.unitPrice ?? 0);
        const total = Number(item.totalPrice ?? (qty * price));
        return {
          id: item.id || `item_${idx}`,
          productId: item.productId || item.product_id || (item.id && !item.id.startsWith('item_') ? item.id : undefined),
          quantity: qty,
          unitPrice: price,
          totalPrice: total,
          product: {
            name: item.name || item.productName || 'Produk',
            unit: item.unit || 'PCS'
          }
        };
      });

      const status = normalizeStatus(raw.status || p.status);
      const poNumber = raw.poNumber || raw.invoiceNumber || raw.invoiceNo || `PO-${p.id.slice(0, 8).toUpperCase()}`;
      const totalAmount = Number(p.total ?? raw.total ?? raw.totalAmount ?? 0);

      return {
        id: p.id,
        poNumber,
        status,
        warehouseId: raw.warehouseId || null,
        warehouseName: raw.warehouseName || null,
        totalAmount,
        notes: raw.notes || null,
        createdAt: parseDate(raw.createdAt || p.created_at),
        paymentStatus: raw.paymentStatus || p.payment_status || 'LUNAS',
        paymentMethod: raw.paymentMethod || p.payment_method || 'CASH',
        dueDate: raw.dueDate || null,
        supplier: {
          name: raw.supplierName || 'Supplier Umum'
        },
        items,
        supplierId: raw.supplierId || null,
      };
    });

    if (filters?.status && filters.status !== 'all') {
      mapped = mapped.filter(p => p.status === filters.status);
    }
    if (filters?.supplierId) {
      mapped = mapped.filter(p => p.supplierId === filters.supplierId);
    }

    return mapped;
  } catch (error) {
    console.error('Failed to fetch purchase orders:', error);
    return [];
  }
}

export async function getPurchaseOrderById(id: string) {
  await requireStaff();
  try {
    const { data: p, error } = await supabaseAdmin.from('purchases').select('*').eq('id', id).single();
    if (error || !p) return null;

    const raw = p.raw_data || {};
    const items = (raw.items || []).map((item: any, idx: number) => {
      const qty = Number(item.quantity ?? 1);
      const price = Number(item.purchasePrice ?? item.unitPrice ?? 0);
      const total = Number(item.totalPrice ?? (qty * price));
      return {
        id: item.id || `item_${idx}`,
        productId: item.productId || item.product_id || (item.id && !item.id.startsWith('item_') ? item.id : undefined),
        quantity: qty,
        unitPrice: price,
        totalPrice: total,
        product: {
          name: item.name || item.productName || 'Produk',
          unit: item.unit || 'PCS'
        }
      };
    });

    return {
      id: p.id,
      poNumber: raw.poNumber || raw.invoiceNumber || `PO-${p.id.slice(0, 8).toUpperCase()}`,
      status: normalizeStatus(raw.status || p.status),
      warehouseId: raw.warehouseId || 'gudang-utama',
      warehouseName: raw.warehouseName || 'Gudang Utama',
      totalAmount: Number(p.total ?? raw.total ?? raw.totalAmount ?? 0),
      notes: raw.notes || null,
      createdAt: parseDate(raw.createdAt || p.created_at),
      supplier: {
        name: raw.supplierName || 'Supplier Umum'
      },
      items,
      raw_data: raw,
    };
  } catch {
    return null;
  }
}

export async function createPurchaseOrder(data: {
  supplierId: string
  createdById: string
  notes?: string
  items: PurchaseItemInput[]
  autoReceive?: boolean
  warehouseId?: string
  batchNumber?: string
  expiryDate?: string
  paymentStatus?: 'LUNAS' | 'HUTANG' | string
  paymentMethod?: string
  dueDate?: string
}): Promise<PurchaseActionResult> {
  await requireAdmin();
  try {
    const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const poNumber = `PO-${Date.now()}`;
    const id = `po_${Date.now()}`;
    const targetWarehouse = data.warehouseId || 'gudang-utama';
    const paymentStatus = data.paymentStatus || 'LUNAS';
    const paymentMethod = data.paymentMethod || 'CASH';

    // Cari supplier name
    let supplierName = 'Supplier';
    try {
      const { data: sup } = await supabaseAdmin.from('suppliers').select('raw_data, name').eq('id', data.supplierId).single();
      if (sup) {
        supplierName = sup.name || sup.raw_data?.name || 'Supplier';
      }
    } catch {}

    // Cari nama produk untuk setiap item
    const enrichedItems = await Promise.all(
      data.items.map(async (item, idx) => {
        let name = `Produk ${item.productId}`;
        let unit = item.unit || 'PCS';
        let conversion = 1;
        try {
          const { data: prod } = await supabaseAdmin.from('products').select('name, unit, raw_data').eq('id', item.productId).single();
          if (prod) {
            name = prod.name || prod.raw_data?.name || name;
            if (!item.unit) {
              unit = prod.unit || prod.raw_data?.unit || unit;
            }
            const rawUnits = prod.raw_data?.units || [];
            const found = rawUnits.find((u: any) => u.code === unit);
            if (found && found.contains) {
              conversion = Number(found.contains);
            }
          }
        } catch {}
        return {
          id: `item_${idx}_${Date.now()}`,
          productId: item.productId,
          name,
          unit,
          conversion,
          quantity: item.quantity,
          purchasePrice: item.unitPrice,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
        };
      })
    );

    const isAutoReceive = Boolean(data.autoReceive);
    const status = isAutoReceive ? 'DITERIMA' : 'APPROVED';

    const raw_data = {
      poNumber,
      supplierId: data.supplierId,
      supplierName,
      createdById: data.createdById,
      warehouseId: targetWarehouse,
      notes: data.notes || '',
      status,
      paymentStatus,
      paymentMethod,
      dueDate: data.dueDate || undefined,
      total: totalAmount,
      subtotal: totalAmount,
      items: enrichedItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      receivedAt: isAutoReceive ? new Date().toISOString() : undefined,
    };

    const { error } = await supabaseAdmin.from('purchases').insert({
      id,
      total: totalAmount,
      raw_data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to create purchase in supabaseAdmin:', error);
      return { success: false, error: error.message };
    }

    // Catat uang yang keluar dari modal bila dibayar tunai/transfer.
    //
    // Diletakkan SEBELUM stok ditambahkan karena pembayaran terjadi saat PO
    // dibuat, bukan saat barang diterima. Fungsi ini idempoten (dibandingkan
    // dengan posisi modal PO yang sudah tercatat), jadi aman dipanggil ulang.
    // Kegagalannya dikembalikan sebagai `warning`, bukan `success: false`:
    // baris PO-nya sudah tersimpan dan stok tetap harus diproses.
    const peringatanModal = await catatMutasiModalPO({
      poId: id,
      total: totalAmount,
      paymentStatus,
      paymentMethod,
      label: supplierName,
      itemCount: enrichedItems.length,
    });

    // Jika autoReceive diaktifkan, langsung proses penambahan stok ke produk dan inventory_logs.
    //
    // Catatan perbaikan: dulu loop ini TANPA try/catch. Kalau addStock gagal untuk
    // satu produk, error-nya naik ke catch di bawah dan fungsi mengembalikan
    // `success: false` — padahal baris PO-nya SUDAH masuk database sebelum loop ini.
    // Akibatnya pengguna melihat "Gagal membuat PO" sambil PO tetap muncul di
    // daftar, dan stoknya tidak pernah masuk. Sekarang tiap item ditangani
    // terpisah dan kegagalan dilaporkan sebagai `warning`, bukan kegagalan total.
    if (isAutoReceive) {
      const gagal: string[] = [];

      for (const item of enrichedItems) {
        if (!item.productId) continue;
        const baseStockToAdd = Number(item.quantity || 1) * Number(item.conversion || 1);
        try {
          await addStock({
            productId: item.productId,
            amount: baseStockToAdd,
            warehouseId: targetWarehouse,
            batchNumber: data.batchNumber || `${poNumber}-${item.productId.slice(-4)}`,
            expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
            reference: poNumber,
            notes: `Pembelian Langsung (${item.quantity} ${item.unit || 'PCS'}): ${poNumber}`,
            incomingPrice: item.conversion ? (item.unitPrice / item.conversion) : item.unitPrice,
          });
        } catch (e: any) {
          console.error(`addStock gagal saat autoReceive PO ${poNumber} (${item.productId}):`, e);
          gagal.push(`${item.name || item.productId} (${e?.message || 'gagal'})`);
        }
      }

      if (gagal.length > 0) {
        // Stok belum masuk (sebagian). Turunkan status ke APPROVED supaya tombol
        // "Terima" muncul di daftar dan stok bisa disusulkan tanpa membuat PO baru.
        raw_data.status = 'APPROVED';
        raw_data.receivedAt = undefined;

        await supabaseAdmin
          .from('purchases')
          .update({ raw_data, updated_at: new Date().toISOString() })
          .eq('id', id);

        revalidatePath('/admin/purchases');
        revalidatePath('/admin/inventory');
        revalidatePath('/admin/products');
        revalidatePath('/admin/capital');

        return {
          success: true,
          warning: gabungPeringatan(
            `PO tersimpan, tetapi stok gagal ditambahkan untuk ${gagal.length} item: ${gagal.join('; ')}. Status PO dikembalikan ke "Disetujui" — klik "Terima" untuk mencoba lagi.`,
            peringatanModal
          ),
          data: { id, ...raw_data },
        };
      }
    }

    revalidatePath('/admin/purchases');
    revalidatePath('/admin/inventory');
    revalidatePath('/admin/products');
    revalidatePath('/admin/capital');

    if (peringatanModal) {
      return { success: true, warning: peringatanModal, data: { id, ...raw_data } };
    }
    return { success: true, data: { id, ...raw_data } };
  } catch (error: any) {
    console.error('Failed to create purchase order:', error);
    return { success: false, error: error?.message || 'Gagal membuat purchase order' };
  }
}

/**
 * Terima PO: tambahkan stok, lalu tandai PO `DITERIMA`.
 *
 * URUTAN INI PENTING — dulu urutannya terbalik (status diubah lebih dulu, baru
 * addStock dipanggil). Kalau addStock gagal, PO sudah berstatus "DITERIMA"
 * padahal stok tidak masuk, dan percobaan ulang ditolak dengan "PO sudah
 * diterima sebelumnya" — stoknya hilang tanpa bisa disusulkan. Sekarang status
 * hanya berubah SETELAH semua stok berhasil masuk.
 *
 * Supaya aman diklik berulang (mis. gagal separuh jalan, koneksi putus, tombol
 * terklik dua kali), penambahan stok dijaga idempoten lewat `inventory_logs`:
 * kalau sudah ada log MASUK untuk PO + produk yang sama, item itu dilewati.
 */
export async function receivePurchaseOrder(poId: string, warehouseId: string, batchNumber?: string, expiryDate?: string) {
  await requireStaff();
  try {
    const { data: p, error: fetchErr } = await supabaseAdmin.from('purchases').select('*').eq('id', poId).single();
    if (fetchErr || !p) return { success: false, error: 'PO tidak ditemukan' };

    const raw = p.raw_data || {};
    const norm = normalizeStatus(raw.status || p.status);
    if (norm === 'RECEIVED') {
      return { success: false, error: 'PO sudah diterima sebelumnya' };
    }

    const targetWarehouse = warehouseId || raw.warehouseId || 'gudang-utama';
    const poRef = raw.poNumber || poId;
    const gagal: string[] = [];

    // Tambah stok ke produk & catat log inventory via supabaseAdmin
    for (const item of (raw.items || [])) {
      const prodId = item.productId || item.product_id || (item.id && !item.id.startsWith('item_') ? item.id : null);
      if (!prodId) continue;

      // Idempotensi: jangan tambah dua kali untuk PO + produk yang sama.
      const { data: logAda } = await supabaseAdmin
        .from('inventory_logs')
        .select('id')
        .eq('reference_id', poRef)
        .eq('product_id', prodId)
        .eq('type', 'MASUK')
        .limit(1);

      if (logAda && logAda.length > 0) continue;

      const qty = Number(item.quantity || 1);
      const conversion = Number(item.conversion || 1);
      const baseStockToAdd = qty * conversion;

      try {
        await addStock({
          productId: prodId,
          amount: baseStockToAdd,
          warehouseId: targetWarehouse,
          batchNumber: batchNumber || `${poRef}-${prodId.slice(-4)}`,
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          reference: poRef,
          notes: `Penerimaan PO (${qty} ${item.unit || 'PCS'}): ${poRef}`,
          incomingPrice: conversion ? (item.unitPrice / conversion) : item.unitPrice,
        });
      } catch (e: any) {
        console.error(`addStock gagal saat menerima PO ${poRef} (${prodId}):`, e);
        gagal.push(`${item.name || prodId} (${e?.message || 'gagal'})`);
      }
    }

    if (gagal.length > 0) {
      // Status SENGAJA tidak diubah: PO tetap "Disetujui" sehingga tombol "Terima"
      // masih muncul dan stok bisa disusulkan. Item yang sudah berhasil tidak akan
      // ditambahkan dua kali karena guard idempotensi di atas.
      return {
        success: false,
        error: `Stok gagal ditambahkan untuk ${gagal.length} item: ${gagal.join('; ')}. PO belum ditandai diterima — klik "Terima" lagi untuk mencoba item yang gagal.`,
      };
    }

    raw.status = 'DITERIMA';
    raw.receivedAt = new Date().toISOString();
    raw.warehouseId = targetWarehouse;

    const { error: updateErr } = await supabaseAdmin.from('purchases').update({
      raw_data: raw,
      updated_at: new Date().toISOString()
    }).eq('id', poId);

    if (updateErr) {
      // Stok sudah masuk, jadi ini bukan kegagalan total. Klik "Terima" sekali lagi
      // akan menyelesaikan status tanpa menambah stok dua kali.
      return {
        success: false,
        error: `Stok sudah ditambahkan, tetapi status PO gagal disimpan (${updateErr.message}). Klik "Terima" sekali lagi untuk menyelesaikan.`,
      };
    }

    revalidatePath('/admin/purchases');
    revalidatePath('/admin/inventory');
    revalidatePath('/admin/products');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to receive PO:', error);
    return { success: false, error: error?.message || 'Gagal menerima purchase order' };
  }
}

export async function updatePurchaseStatus(id: string, status: string) {
  await requireStaff();
  try {
    const { data: p } = await supabaseAdmin.from('purchases').select('*').eq('id', id).single();
    if (!p) return { success: false, error: 'PO tidak ditemukan' };

    const raw = p.raw_data || {};
    raw.status = status;
    raw.updatedAt = new Date().toISOString();
    await supabaseAdmin.from('purchases').update({
      raw_data: raw,
      updated_at: new Date().toISOString()
    }).eq('id', id);

    revalidatePath('/admin/purchases');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal update status PO' };
  }
}

export async function deletePurchaseOrder(id: string) {
  await requireAdmin();
  try {
    const { error } = await supabaseAdmin.from('purchases').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/admin/purchases');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal menghapus PO' };
  }
}

export async function updatePurchaseOrder(
  id: string,
  data: {
    supplierId: string
    warehouseId: string
    notes?: string
    items: PurchaseItemInput[]
    autoReceive?: boolean
    batchNumber?: string
    expiryDate?: string
    paymentStatus?: string
    paymentMethod?: string
  }
) {
  await requireAdmin();
  try {
    const { data: oldData, error: fetchErr } = await supabaseAdmin
      .from('purchases')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !oldData) return { success: false, error: 'PO tidak ditemukan' };

    const raw = oldData.raw_data || {};
    const normStatus = normalizeStatus(raw.status || oldData.status);

    const oldItems = raw.items || [];
    const oldWarehouseId = raw.warehouseId || 'gudang-utama';
    
    // 1. Calculate Enriched Items first so we have accurate conversions
    let supplierName = raw.supplierName || 'Supplier';
    try {
      const { data: sup } = await supabaseAdmin.from('suppliers').select('raw_data, name').eq('id', data.supplierId).single();
      if (sup) supplierName = sup.name || sup.raw_data?.name || supplierName;
    } catch {}

    const enrichedItems = await Promise.all(
      data.items.map(async (item, idx) => {
        let name = `Produk ${item.productId}`;
        let unit = item.unit || 'PCS';
        let conversion = 1;
        try {
          const { data: prod } = await supabaseAdmin.from('products').select('name, unit, raw_data').eq('id', item.productId).single();
          if (prod) {
            name = prod.name || prod.raw_data?.name || name;
            if (!item.unit) {
              unit = prod.unit || prod.raw_data?.unit || unit;
            }
            const rawUnits = prod.raw_data?.units || [];
            const found = rawUnits.find((u: any) => u.code === unit);
            if (found && found.contains) conversion = Number(found.contains);
          }
        } catch {}
        return {
          id: `item_${idx}_${Date.now()}`,
          productId: item.productId,
          name,
          unit,
          conversion,
          quantity: item.quantity,
          purchasePrice: item.unitPrice,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
        };
      })
    );

    const newItems = enrichedItems;
    
    // We only need to adjust stock if PO is already received
    if (normStatus === 'RECEIVED' || data.autoReceive) {
      for (const newItem of newItems) {
        const oldItem = oldItems.find((oi: any) => oi.productId === newItem.productId);
        const oldQty = oldItem ? Number(oldItem.quantity || 1) * Number(oldItem.conversion || 1) : 0;
        const newQty = Number(newItem.quantity || 1) * Number(newItem.conversion || 1);
        const delta = newQty - oldQty;
        
        if (delta > 0) {
          // Tambah stok
          await addStock({
            productId: newItem.productId,
            amount: delta,
            warehouseId: data.warehouseId,
            batchNumber: data.batchNumber || `${id}-${newItem.productId.slice(-4)}`,
            expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
            reference: id,
            notes: `Edit PO (Penambahan ${delta}): ${id}`,
            incomingPrice: newItem.conversion ? (newItem.unitPrice / newItem.conversion) : newItem.unitPrice,
          });
        } else if (delta < 0) {
          // Kurangi stok
          try {
            await deductStockFEFO({
              productId: newItem.productId,
              amount: Math.abs(delta),
              warehouseId: data.warehouseId,
              reference: id,
              notes: `Edit PO (Pengurangan ${Math.abs(delta)}): ${id}`,
            });
          } catch (e: any) {
            throw new Error(`Gagal mengedit PO. Stok produk ${newItem.productId} tidak mencukupi untuk dikurangi (${e.message}). Harap sesuaikan qty penjualan terlebih dahulu.`);
          }
        }
      }

      // Handle items that were removed completely
      for (const oldItem of oldItems) {
        const stillExists = newItems.find(ni => ni.productId === oldItem.productId);
        if (!stillExists) {
          const oldQty = Number(oldItem.quantity || 1) * Number(oldItem.conversion || 1);
          try {
            await deductStockFEFO({
              productId: oldItem.productId,
              amount: oldQty,
              warehouseId: oldWarehouseId,
              reference: id,
              notes: `Edit PO (Penghapusan item): ${id}`,
            });
          } catch (e: any) {
            throw new Error(`Gagal mengedit PO. Stok produk ${oldItem.productId} tidak mencukupi untuk dihapus (${e.message}).`);
          }
        }
      }
    }

    // 2. Update Purchase Order Record
    const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const updatedRaw = {
      ...raw,
      supplierId: data.supplierId,
      supplierName,
      warehouseId: data.warehouseId,
      notes: data.notes || raw.notes || '',
      // Dua kolom ini WAJIB disimpan di sini. Sebelumnya hanya ditulis oleh blok
      // peramban yang selalu gagal, sehingga mengubah pembayaran HUTANG -> LUNAS
      // (atau sebaliknya) tidak pernah tersimpan ke database.
      paymentStatus: data.paymentStatus || raw.paymentStatus || 'LUNAS',
      paymentMethod: data.paymentMethod || raw.paymentMethod || 'CASH',
      total: totalAmount,
      subtotal: totalAmount,
      items: enrichedItems,
      updatedAt: new Date().toISOString(),
    };

    const { error: updateErr } = await supabaseAdmin.from('purchases').update({
      total: totalAmount,
      raw_data: updatedRaw,
      updated_at: new Date().toISOString()
    }).eq('id', id);

    if (updateErr) throw updateErr;

    // Selaraskan modal dengan cara bayar yang BARU. Bila PO yang tadinya tunai
    // diubah menjadi HUTANG, uangnya otomatis dikembalikan ke modal (INJECTION);
    // bila sebaliknya atau nominalnya berubah, selisihnya dicatat. Idempoten.
    const peringatanModal = await catatMutasiModalPO({
      poId: id,
      total: totalAmount,
      paymentStatus: updatedRaw.paymentStatus,
      paymentMethod: updatedRaw.paymentMethod,
      label: supplierName,
      itemCount: enrichedItems.length,
    });

    revalidatePath('/admin/purchases');
    revalidatePath('/admin/inventory');
    revalidatePath('/admin/products');
    revalidatePath('/admin/capital');

    if (peringatanModal) {
      return { success: true, warning: peringatanModal, data: { id, ...updatedRaw } };
    }
    return { success: true, data: { id, ...updatedRaw } };
  } catch (error: any) {
    console.error('Failed to update PO:', error);
    return { success: false, error: error?.message || 'Gagal mengubah purchase order' };
  }
}

export async function cancelPurchaseOrder(id: string) {
  await requireAdmin();
  try {
    const { data: oldData, error: fetchErr } = await supabaseAdmin
      .from('purchases')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !oldData) return { success: false, error: 'PO tidak ditemukan' };

    const raw = oldData.raw_data || {};
    const normStatus = normalizeStatus(raw.status || oldData.status);

    if (normStatus === 'CANCELLED') {
      return { success: false, error: 'PO sudah dibatalkan sebelumnya' };
    }

    // Jika PO sudah RECEIVED, kembalikan (kurangi) stok barang yang pernah masuk
    if (normStatus === 'RECEIVED') {
      const oldItems = raw.items || [];
      const warehouseId = raw.warehouseId || 'gudang-utama';

      for (const item of oldItems) {
        const qty = Number(item.quantity || 1) * Number(item.conversion || 1);
        try {
          await deductStockFEFO({
            productId: item.productId,
            amount: qty,
            warehouseId,
            reference: id,
            notes: `Pembatalan PO (${id}): Kurangi stok`,
          });
        } catch (e: any) {
          throw new Error(`Gagal membatalkan PO. Stok produk ${item.productId} tidak mencukupi untuk dikurangi (${e.message}).`);
        }
      }
    }

    const updatedRaw = {
      ...raw,
      status: 'CANCELLED',
      updatedAt: new Date().toISOString(),
    };

    const { error: updateErr } = await supabaseAdmin.from('purchases').update({
      raw_data: updatedRaw,
      updated_at: new Date().toISOString()
    }).eq('id', id);

    if (updateErr) throw updateErr;

    // Kembalikan uang ke modal bila PO ini pernah mengurangi modal (tunai /
    // transfer). PO tempo tidak punya catatan keluar, jadi tidak ada yang
    // dikembalikan. Idempoten: membatalkan ulang tidak menggandakan refund.
    const peringatanModal = await catatMutasiModalPO({
      poId: id,
      total: Number(oldData.total ?? raw.total ?? 0),
      paymentStatus: raw.paymentStatus,
      paymentMethod: raw.paymentMethod,
      label: raw.supplierName || 'Supplier',
      itemCount: (raw.items || []).length,
      dibatalkan: true,
    });

    revalidatePath('/admin/purchases');
    revalidatePath('/admin/inventory');
    revalidatePath('/admin/products');
    revalidatePath('/admin/capital');

    if (peringatanModal) {
      return { success: true, warning: peringatanModal };
    }
    return { success: true };
  } catch (error: any) {
    console.error('Failed to cancel PO:', error);
    return { success: false, error: error?.message || 'Gagal membatalkan PO' };
  }
}

export type PurchaseSupplierHistory = {
  name: string;
  phone: string | null;
  count: number;
  totalQty: number;
  lastPrice: number;
  lastDate: string | null;
};

export async function getPurchaseStatsByProductId(productId: string) {
  await requireAdmin();
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('purchases')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !rows) {
      return {
        count: 0,
        avgCost: 0,
        latestSupplier: null,
        latestSupplierWa: null,
        latestPrice: 0,
        totalQty: 0,
        suppliers: [] as PurchaseSupplierHistory[],
      };
    }

    let totalQty = 0;
    let totalCost = 0;
    let count = 0;
    let latestSupplier: string | null = null;
    let latestSupplierWa: string | null = null;
    let latestPrice = 0;

    const supplierMap = new Map<string, PurchaseSupplierHistory>();

    for (const p of rows) {
      const raw = p.raw_data || {};
      const items = raw.items || [];
      const match = items.find((it: any) => 
        it.productId === productId || 
        it.product_id === productId || 
        it.id === productId
      );

      if (match) {
        count++;
        const qty = Number(match.quantity ?? match.qty ?? 1);
        const price = Number(match.unitPrice ?? match.purchasePrice ?? 0);
        totalQty += qty;
        totalCost += (qty * price);

        const sName = (
          raw.supplierName || 
          raw.supplier?.name || 
          (typeof p.supplier === 'object' ? p.supplier?.name : (typeof p.supplier === 'string' ? p.supplier : null)) || 
          ''
        ).trim();

        const sPhone = raw.supplierPhone || raw.supplierWa || raw.No_WA_Supplier || p.supplier_phone || null;

        if (sName) {
          const key = sName.toLowerCase();
          const existing = supplierMap.get(key);
          if (!existing) {
            supplierMap.set(key, {
              name: sName,
              phone: sPhone,
              count: 1,
              totalQty: qty,
              lastPrice: price,
              lastDate: p.created_at || raw.createdAt || null,
            });
          } else {
            existing.count += 1;
            existing.totalQty += qty;
            if (!existing.phone && sPhone) existing.phone = sPhone;
          }

          if (!latestSupplier) {
            latestSupplier = sName;
            latestSupplierWa = sPhone;
            latestPrice = price;
          }
        }
      }
    }

    const avgCost = totalQty > 0 ? Math.round(totalCost / totalQty) : 0;
    const suppliers = Array.from(supplierMap.values());

    return {
      count,
      avgCost,
      latestSupplier,
      latestSupplierWa,
      latestPrice,
      totalQty,
      suppliers,
    };
  } catch (err) {
    console.error('Failed to get purchase stats by product id:', err);
    return {
      count: 0,
      avgCost: 0,
      latestSupplier: null,
      latestSupplierWa: null,
      latestPrice: 0,
      totalQty: 0,
      suppliers: [] as PurchaseSupplierHistory[],
    };
  }
}

/**
 * Lunasi tagihan hutang PO (Pembayaran Hutang Tempo).
 * Mengubah paymentStatus menjadi 'LUNAS', memperbarui metode pembayaran,
 * dan mencatat pengeluaran modal di buku besar kas/modal secara otomatis.
 */
export async function payPurchaseDebt(
  id: string,
  paymentMethod: string = 'CASH',
  notes?: string
): Promise<PurchaseActionResult> {
  try {
    await requireStaff();
    const { data: p, error: fetchErr } = await supabaseAdmin
      .from('purchases')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !p) return { success: false, error: 'Purchase Order tidak ditemukan' };

    const raw = p.raw_data || {};
    const currentStatus = raw.paymentStatus || p.payment_status || 'LUNAS';
    if (currentStatus === 'LUNAS') {
      return { success: false, error: 'Tagihan PO ini sudah berstatus LUNAS' };
    }

    const totalAmount = Number(p.total ?? raw.total ?? raw.totalAmount ?? 0);
    const supplierName = raw.supplierName || raw.supplier?.name || 'Supplier';

    const updatedRaw = {
      ...raw,
      paymentStatus: 'LUNAS',
      paymentMethod: paymentMethod || raw.paymentMethod || 'CASH',
      paidAt: new Date().toISOString(),
      notes: notes
        ? (raw.notes ? `${raw.notes}\n[Pelunasan]: ${notes}` : `[Pelunasan]: ${notes}`)
        : raw.notes,
      updatedAt: new Date().toISOString(),
    };

    const { error: updateErr } = await supabaseAdmin
      .from('purchases')
      .update({
        raw_data: updatedRaw,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    // Catat mutasi modal pengeluaran pelunasan hutang
    const peringatanModal = await catatMutasiModalPO({
      poId: id,
      total: totalAmount,
      paymentStatus: 'LUNAS',
      paymentMethod: paymentMethod || 'CASH',
      label: `Pelunasan Hutang PO ${raw.poNumber || id.slice(0, 8)} - ${supplierName}`,
      itemCount: (raw.items || []).length,
    });

    revalidatePath('/admin/purchases');
    revalidatePath('/admin/reports/hutang');
    revalidatePath('/admin/reports/finance');
    revalidatePath('/admin/capital');

    if (peringatanModal) {
      return { success: true, warning: peringatanModal, data: { id, ...updatedRaw } };
    }
    return { success: true, data: { id, ...updatedRaw } };
  } catch (error: any) {
    console.error('Failed to pay purchase debt:', error);
    return { success: false, error: error?.message || 'Gagal melunasi hutang PO' };
  }
}

/**
 * Lunasi beberapa tagihan hutang PO sekaligus (Pelunasan Masal).
 */
export async function payBulkPurchaseDebt(
  ids: string[],
  paymentMethod: string = 'CASH',
  notes?: string
): Promise<{ success: boolean; updatedCount: number; errors: string[]; warnings: string[] }> {
  try {
    await requireStaff();
  } catch (error: any) {
    return { success: false, updatedCount: 0, errors: [error?.message || 'Akses ditolak'], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  let updatedCount = 0;

  for (const id of ids) {
    try {
      const res = await payPurchaseDebt(id, paymentMethod, notes);
      if (res.success) {
        updatedCount++;
        if (res.warning) {
          warnings.push(res.warning);
        }
      } else if (res.error && res.error !== 'Tagihan PO ini sudah berstatus LUNAS') {
        errors.push(`PO ${id.slice(0, 8)}: ${res.error}`);
      }
    } catch (err: any) {
      errors.push(`PO ${id.slice(0, 8)}: ${err?.message || 'Gagal melunasi'}`);
    }
  }

  revalidatePath('/admin/purchases');
  revalidatePath('/admin/reports/hutang');
  revalidatePath('/admin/reports/finance');
  revalidatePath('/admin/capital');

  return {
    success: updatedCount > 0,
    updatedCount,
    errors,
    warnings,
  };
}

/**
 * Ambil beberapa Purchase Order berdasarkan array ID (untuk Cetak Masal).
 */
export async function getPurchaseOrdersByIds(ids: string[]) {
  await requireStaff();
  if (!ids || ids.length === 0) return [];
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('purchases')
      .select('*')
      .in('id', ids);

    if (error || !rows) return [];

    return rows.map((p: any) => {
      const raw = p.raw_data || {};
      const items = (raw.items || []).map((item: any, idx: number) => {
        const qty = Number(item.quantity ?? 1);
        const price = Number(item.purchasePrice ?? item.unitPrice ?? 0);
        const total = Number(item.totalPrice ?? (qty * price));
        return {
          id: item.id || `item_${idx}`,
          productId: item.productId || item.product_id || (item.id && !item.id.startsWith('item_') ? item.id : undefined),
          name: item.name || item.productName || 'Produk',
          quantity: qty,
          unitPrice: price,
          totalPrice: total,
          unit: item.unit || 'PCS'
        };
      });

      return {
        id: p.id,
        poNumber: raw.poNumber || raw.invoiceNumber || `PO-${p.id.slice(0, 8).toUpperCase()}`,
        status: normalizeStatus(raw.status || p.status),
        warehouseId: raw.warehouseId || 'gudang-utama',
        warehouseName: raw.warehouseName || 'Gudang Utama',
        totalAmount: Number(p.total ?? raw.total ?? raw.totalAmount ?? 0),
        notes: raw.notes || null,
        createdAt: parseDate(raw.createdAt || p.created_at),
        paymentStatus: raw.paymentStatus || p.payment_status || 'LUNAS',
        paymentMethod: raw.paymentMethod || p.payment_method || 'CASH',
        dueDate: raw.dueDate || null,
        supplier: {
          name: raw.supplierName || 'Supplier Umum',
          phone: raw.supplierPhone || raw.supplier?.phone,
          address: raw.supplierAddress || raw.supplier?.address,
          contactPerson: raw.supplierContact || raw.supplier?.contactPerson,
        },
        items,
      };
    });
  } catch (error) {
    console.error('Failed to get purchases by ids:', error);
    return [];
  }
}



