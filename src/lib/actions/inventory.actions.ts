'use server'
import { revalidatePath } from 'next/cache'

import { increment, limit, orderBy, where } from '@/lib/firebase';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function getInventoryBatches(warehouseId?: string) {
  try {
    const { data: products } = await supabaseAdmin.from('products').select('*');
    if (!products) return [];

    const batches: any[] = [];
    products.forEach((p: any) => {
      const raw = p.raw_data || {};
      const stock = Number(p.stock ?? raw.stock ?? raw.Stok ?? 0);
      const stockByWarehouse = raw.stockByWarehouse || { 'gudang-utama': stock };

      const isArchivedLegacy = 
        raw.isActive === false || 
        raw.isActive === 'false' || 
        raw.Status === 1 || 
        raw.Status === '1' || 
        raw.status === 'ARCHIVED';
      const isActive = typeof p.is_active === 'boolean' ? p.is_active : !isArchivedLegacy;

      Object.entries(stockByWarehouse).forEach(([whId, qty]: [string, any]) => {
        const qNum = Number(qty || 0);
        if (warehouseId && whId !== warehouseId) return;

        batches.push({
          id: `${p.id}-${whId}`,
          batchNumber: `BATCH-${p.sku || p.id.substring(0, 6).toUpperCase()}`,
          quantity: qNum,
          expiryDate: raw.expiredDate || raw.Expired ? new Date(raw.expiredDate || raw.Expired) : null,
          createdAt: p.created_at ? new Date(p.created_at) : new Date(),
          warehouseId: whId,
          product: {
            id: p.id,
            name: p.name || raw.name || raw.Nama || 'Produk',
            sku: p.sku || raw.sku || raw.Barcode || p.id,
            unit: p.unit || raw.unit || 'pcs',
            isActive
          },
          warehouse: {
            name: whId === 'gudang-utama' ? 'Gudang Utama' : whId
          }
        });
      });
    });

    return batches;
  } catch (error) {
    console.error('Failed to fetch inventory:', error);
    return [];
  }
}

export async function getLowStockProducts(threshold: number = 10) {
  try {
    const { data: products } = await supabaseAdmin.from('products').select('*');
    if (!products) return [];

    return products
      .map((p: any) => {
        const raw = p.raw_data || {};
        const stock = Number(p.stock ?? raw.stock ?? raw.Stok ?? 0);
        const isArchivedLegacy = 
          raw.isActive === false || 
          raw.isActive === 'false' || 
          raw.Status === 1 || 
          raw.Status === '1' || 
          raw.status === 'ARCHIVED';
        const isActive = typeof p.is_active === 'boolean' ? p.is_active : !isArchivedLegacy;
        return {
          id: p.id,
          name: p.name || raw.name || raw.Nama || 'Produk',
          sku: p.sku || raw.sku || raw.Barcode || p.id,
          category: { name: p.category || raw.category || 'Umum' },
          stock,
          unit: p.unit || raw.unit || 'pcs',
          isActive
        };
      })
      .filter((p: any) => p.stock <= threshold)
      .slice(0, 10);
  } catch (error) {
    console.error('Failed to fetch low stock:', error);
    return [];
  }
}

export async function getInventoryMovements(filters?: { productId?: string; warehouseId?: string; limit?: number }) {
  try {
    let query = supabase.from('inventory_logs').select('*');
    if (filters?.productId) query = query.eq('raw_data->>productId', filters.productId);
    query = query.order('created_at', { ascending: false }).limit(filters?.limit || 100);

    const { data: logs } = await query;
    if (!logs) return [];

    return logs.map((l: any) => {
      const raw = l.raw_data || {};
      return {
        id: l.id,
        type: raw.type || raw.action || 'ADJUSTMENT',
        quantity: Number(raw.quantity || raw.qty || raw.stockChange || 0),
        reference: raw.reference || raw.orderId || l.id,
        notes: raw.notes || raw.reason || '',
        createdAt: l.created_at ? new Date(l.created_at) : new Date(),
        product: {
          name: raw.productName || 'Produk',
          sku: raw.sku || ''
        },
        warehouse: {
          name: raw.warehouseName || raw.warehouseId || 'Gudang Utama'
        },
        batch: {
          batchNumber: raw.batchNumber || 'BATCH-DEFAULT'
        }
      };
    });
  } catch (error) {
    console.error('Failed to fetch movements:', error);
    return [];
  }
}

export async function adjustStock(data: {
  productId: string
  warehouseId: string
  quantity: number // Positif = tambah, Negatif = kurangi
  notes?: string
  createdById?: string
}) {
  try {
    const { data: p, error: fetchErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', data.productId)
      .single();

    if (fetchErr || !p) {
      return { success: false, error: 'Produk tidak ditemukan' };
    }

    const raw = p.raw_data || {};
    const currentStock = Number(p.stock ?? raw.stock ?? raw.Stok ?? 0);
    const newStock = Math.max(0, currentStock + data.quantity);
    const stockByWarehouse = { ...(raw.stockByWarehouse || { 'gudang-utama': currentStock }) };
    const curWhStock = Number(stockByWarehouse[data.warehouseId] ?? currentStock);
    stockByWarehouse[data.warehouseId] = Math.max(0, curWhStock + data.quantity);

    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('products')
      .update({
        stock: newStock,
        raw_data: { ...raw, stock: newStock, stockByWarehouse, updatedAt: now },
        updated_at: now,
      })
      .eq('id', data.productId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    await supabase.from('inventory_logs').insert({
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      raw_data: {
        productId: data.productId,
        productName: p.name || raw.name || 'Produk',
        warehouseId: data.warehouseId,
        quantity: data.quantity,
        amount: Math.abs(data.quantity),
        type: data.quantity >= 0 ? 'MASUK' : 'KELUAR',
        action: 'ADJUSTMENT',
        notes: data.notes || 'Penyesuaian stok manual',
        createdById: data.createdById,
        prevStock: currentStock,
        nextStock: newStock,
        createdAt: now,
      },
      created_at: now,
      updated_at: now,
    });

    revalidatePath('/admin/inventory');
    return { success: true };
  } catch (error) {
    console.error('Failed to adjust stock:', error);
    return { success: false, error: 'Gagal melakukan penyesuaian stok' };
  }
}

export async function getWarehouses() {
  try {
    const { data: rows } = await supabase.from('warehouses').select('*').order('name', { ascending: true });
    if (!rows) return [];

    return rows.map((w: any) => {
      const raw = w.raw_data || {};
      return {
        id: w.id,
        name: w.name || raw.name || w.id,
        address: w.location || raw.location || raw.address || null,
        createdAt: w.created_at ? new Date(w.created_at) : new Date(),
        _count: { batches: 1 }
      };
    });
  } catch (error) {
    console.error('Failed to fetch warehouses:', error);
    return [];
  }
}

export async function createWarehouse(data: { name: string; address?: string }) {
  try {
    const id = `wh_${Date.now()}`;
    const now = new Date().toISOString();
    const { error } = await supabase.from('warehouses').insert({
      id,
      name: data.name,
      location: data.address || null,
      raw_data: { ...data, createdAt: now },
      created_at: now,
      updated_at: now,
    });

    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/warehouses');
    return { success: true, data: { id, ...data } };
  } catch (error) {
    return { success: false, error: 'Gagal membuat gudang' };
  }
}

export async function updateWarehouse(id: string, data: { name?: string; address?: string }) {
  try {
    const now = new Date().toISOString();
    const { error } = await supabase.from('warehouses').update({
      name: data.name,
      location: data.address,
      updated_at: now,
    }).eq('id', id);

    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/warehouses');
    return { success: true, data: { id, ...data } };
  } catch (error) {
    return { success: false, error: 'Gagal mengupdate gudang' };
  }
}
