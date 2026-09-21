'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import { addStock, deductStockFEFO } from '@/lib/inventory'

type PurchaseItemInput = {
  productId: string
  quantity: number
  unitPrice: number
  unit?: string
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

export async function getPurchaseOrders(filters?: { status?: string; supplierId?: string }) {
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
}) {
  try {
    const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const poNumber = `PO-${Date.now()}`;
    const id = `po_${Date.now()}`;
    const targetWarehouse = data.warehouseId || 'gudang-utama';

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

    // Jika autoReceive diaktifkan, langsung proses penambahan stok ke produk dan inventory_logs
    if (isAutoReceive) {
      for (const item of enrichedItems) {
        if (item.productId) {
          const baseStockToAdd = Number(item.quantity || 1) * Number(item.conversion || 1);
          await addStock({
            productId: item.productId,
            amount: baseStockToAdd,
            warehouseId: targetWarehouse,
            batchNumber: data.batchNumber || `${poNumber}-${item.productId.slice(-4)}`,
            expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
            reference: poNumber,
            notes: `Pembelian Langsung (${item.quantity} ${item.unit || 'PCS'}): ${poNumber}`,
            incomingPrice: item.unitPrice,
          });
        }
      }
    }

    revalidatePath('/admin/purchases');
    revalidatePath('/admin/inventory');
    revalidatePath('/admin/products');
    return { success: true, data: { id, ...raw_data } };
  } catch (error: any) {
    console.error('Failed to create purchase order:', error);
    return { success: false, error: error?.message || 'Gagal membuat purchase order' };
  }
}

export async function receivePurchaseOrder(poId: string, warehouseId: string, batchNumber?: string, expiryDate?: string) {
  try {
    const { data: p, error: fetchErr } = await supabaseAdmin.from('purchases').select('*').eq('id', poId).single();
    if (fetchErr || !p) return { success: false, error: 'PO tidak ditemukan' };

    const raw = p.raw_data || {};
    const norm = normalizeStatus(raw.status || p.status);
    if (norm === 'RECEIVED') {
      return { success: false, error: 'PO sudah diterima sebelumnya' };
    }

    const targetWarehouse = warehouseId || raw.warehouseId || 'gudang-utama';
    raw.status = 'DITERIMA';
    raw.receivedAt = new Date().toISOString();
    raw.warehouseId = targetWarehouse;

    const { error: updateErr } = await supabaseAdmin.from('purchases').update({
      raw_data: raw,
      updated_at: new Date().toISOString()
    }).eq('id', poId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Tambah stok ke produk & catat log inventory via supabaseAdmin
    for (const item of (raw.items || [])) {
      const prodId = item.productId || item.product_id || (item.id && !item.id.startsWith('item_') ? item.id : null);
      const qty = Number(item.quantity || 1);
      const conversion = Number(item.conversion || 1);
      const baseStockToAdd = qty * conversion;
      if (prodId) {
        await addStock({
          productId: prodId,
          amount: baseStockToAdd,
          warehouseId: targetWarehouse,
          batchNumber: batchNumber || `${raw.poNumber || poId}-${prodId.slice(-4)}`,
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          reference: raw.poNumber || poId,
          notes: `Penerimaan PO (${qty} ${item.unit || 'PCS'}): ${raw.poNumber || poId}`,
          incomingPrice: item.unitPrice,
        });
      }
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
  }
) {
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
    
    // 1. Calculate Deltas
    const newItems = data.items;
    
    // We only need to adjust stock if PO is already received
    if (normStatus === 'RECEIVED' || data.autoReceive) {
      for (const newItem of newItems) {
        const oldItem = oldItems.find((oi: any) => oi.productId === newItem.productId);
        const oldQty = oldItem ? Number(oldItem.quantity || 1) * Number(oldItem.conversion || 1) : 0;
        const newQty = newItem.quantity;
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
            incomingPrice: newItem.unitPrice,
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

    const updatedRaw = {
      ...raw,
      supplierId: data.supplierId,
      supplierName,
      warehouseId: data.warehouseId,
      notes: data.notes || raw.notes || '',
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

    revalidatePath('/admin/purchases');
    revalidatePath('/admin/inventory');
    revalidatePath('/admin/products');
    return { success: true, data: { id, ...updatedRaw } };
  } catch (error: any) {
    console.error('Failed to update PO:', error);
    return { success: false, error: error?.message || 'Gagal mengubah purchase order' };
  }
}

