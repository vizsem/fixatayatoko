'use server'

import { revalidatePath } from 'next/cache'
import { supabase } from '@/lib/supabase'
import { addStock } from '@/lib/inventory'

type PurchaseItemInput = {
  productId: string
  quantity: number
  unitPrice: number
}

function normalizeStatus(status?: string): string {
  if (!status) return 'RECEIVED';
  const s = status.toUpperCase();
  if (s === 'DITERIMA' || s === 'RECEIVED') return 'RECEIVED';
  if (s === 'DIBATALKAN' || s === 'CANCELLED') return 'CANCELLED';
  if (s === 'PENDING' || s === 'PENDING_APPROVAL') return 'PENDING_APPROVAL';
  if (s === 'APPROVED') return 'APPROVED';
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
    const query = supabase
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
    const { data: p, error } = await supabase.from('purchases').select('*').eq('id', id).single();
    if (error || !p) return null;

    const raw = p.raw_data || {};
    const items = (raw.items || []).map((item: any, idx: number) => {
      const qty = Number(item.quantity ?? 1);
      const price = Number(item.purchasePrice ?? item.unitPrice ?? 0);
      const total = Number(item.totalPrice ?? (qty * price));
      return {
        id: item.id || `item_${idx}`,
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
      totalAmount: Number(p.total ?? raw.total ?? raw.totalAmount ?? 0),
      notes: raw.notes || null,
      createdAt: parseDate(raw.createdAt || p.created_at),
      supplier: {
        name: raw.supplierName || 'Supplier Umum'
      },
      items,
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
}) {
  try {
    const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const poNumber = `PO-${Date.now()}`;
    const id = `po_${Date.now()}`;

    // Cari supplier name
    let supplierName = 'Supplier';
    try {
      const { data: sup } = await supabase.from('suppliers').select('raw_data, name').eq('id', data.supplierId).single();
      if (sup) {
        supplierName = sup.name || sup.raw_data?.name || 'Supplier';
      }
    } catch {}

    // Cari nama produk untuk setiap item
    const enrichedItems = await Promise.all(
      data.items.map(async (item, idx) => {
        let name = `Produk ${item.productId}`;
        let unit = 'PCS';
        try {
          const { data: prod } = await supabase.from('products').select('name, raw_data').eq('id', item.productId).single();
          if (prod) {
            name = prod.name || prod.raw_data?.name || name;
            unit = prod.raw_data?.unit || unit;
          }
        } catch {}
        return {
          id: `item_${idx}_${Date.now()}`,
          productId: item.productId,
          name,
          unit,
          quantity: item.quantity,
          purchasePrice: item.unitPrice,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
        };
      })
    );

    const raw_data = {
      poNumber,
      supplierId: data.supplierId,
      supplierName,
      createdById: data.createdById,
      notes: data.notes || '',
      status: 'APPROVED',
      total: totalAmount,
      subtotal: totalAmount,
      items: enrichedItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { error } = await supabase.from('purchases').insert({
      id,
      total: totalAmount,
      raw_data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to create purchase in supabase:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/purchases');
    return { success: true, data: { id, ...raw_data } };
  } catch (error) {
    console.error('Failed to create purchase order:', error);
    return { success: false, error: 'Gagal membuat purchase order' };
  }
}

export async function receivePurchaseOrder(poId: string, warehouseId: string, batchNumber?: string, expiryDate?: string) {
  try {
    const { data: p } = await supabase.from('purchases').select('*').eq('id', poId).single();
    if (!p) return { success: false, error: 'PO tidak ditemukan' };

    const raw = p.raw_data || {};
    if (raw.status === 'DITERIMA' || raw.status === 'RECEIVED') {
      return { success: false, error: 'PO sudah diterima' };
    }

    raw.status = 'DITERIMA';
    raw.receivedAt = new Date().toISOString();
    raw.warehouseId = warehouseId;

    await supabase.from('purchases').update({
      raw_data: raw,
      updated_at: new Date().toISOString()
    }).eq('id', poId);

    // Tambah stok ke produk & catat log inventory
    for (const item of (raw.items || [])) {
      const prodId = item.productId || item.id;
      const qty = Number(item.quantity || 1);
      if (prodId) {
        await addStock({
          productId: prodId,
          amount: qty,
          warehouseId,
          batchNumber: batchNumber || `${raw.poNumber || poId}-${prodId.slice(-4)}`,
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          reference: raw.poNumber || poId,
          notes: `Penerimaan PO: ${raw.poNumber || poId}`,
        });
      }
    }

    revalidatePath('/admin/purchases');
    revalidatePath('/admin/inventory');
    return { success: true };
  } catch (error) {
    console.error('Failed to receive PO:', error);
    return { success: false, error: 'Gagal menerima purchase order' };
  }
}

export async function updatePurchaseStatus(id: string, status: string) {
  try {
    const { data: p } = await supabase.from('purchases').select('*').eq('id', id).single();
    if (!p) return { success: false, error: 'PO tidak ditemukan' };

    const raw = p.raw_data || {};
    raw.status = status;
    raw.updatedAt = new Date().toISOString();
    await supabase.from('purchases').update({
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
    const { error } = await supabase.from('purchases').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/admin/purchases');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal menghapus PO' };
  }
}
