'use server'

import { requireAdmin, requireStaff } from '@/lib/actions/session';
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase';

const BATCH_COLS =
  'id,name,sku,stock,cost_price,unit,is_active,created_at,updated_at,' +
  'raw_stockByWarehouse:raw_data->stockByWarehouse,' +
  'raw_expiredDate:raw_data->>expiredDate,' +
  'raw_Expired:raw_data->>Expired,' +
  'raw_costPrice:raw_data->>costPrice,' +
  'raw_Modal:raw_data->>Modal,' +
  'raw_units:raw_data->units';

export async function getInventoryBatches(warehouseId?: string) {
  await requireStaff();
  try {
    const { data: products } = await supabaseAdmin
      .from('products')
      .select(BATCH_COLS)
      .order('is_active', { ascending: false })
      .order('updated_at', { ascending: false });
    if (!products) return [];

    const batches: any[] = [];
    products.forEach((p: any) => {
      const stock = Number(p.stock ?? 0);
      let stockByWarehouse = p.raw_stockByWarehouse;

      if (!stockByWarehouse || typeof stockByWarehouse !== 'object' || Object.keys(stockByWarehouse).length === 0) {
        stockByWarehouse = { 'gudang-utama': stock };
      } else {
        const sum = Object.values(stockByWarehouse).reduce((a: number, b: any) => a + Number(b || 0), 0);
        if (sum !== stock) {
          const k = Object.keys(stockByWarehouse)[0] || 'gudang-utama';
          stockByWarehouse[k] = Math.max(0, Number(stockByWarehouse[k] || 0) + (stock - sum));
        }
      }

      const isActive = typeof p.is_active === 'boolean' ? p.is_active : true;
      const cost = Number(p.cost_price ?? p.raw_costPrice ?? p.raw_Modal ?? 0);
      const expDate = p.raw_expiredDate || p.raw_Expired ? new Date(p.raw_expiredDate || p.raw_Expired) : null;
      const units = Array.isArray(p.raw_units) ? p.raw_units : undefined;

      Object.entries(stockByWarehouse).forEach(([whId, qty]: [string, any]) => {
        const qNum = Number(qty || 0);
        if (warehouseId && whId !== warehouseId) return;

        batches.push({
          id: `${p.id}-${whId}`,
          batchNumber: `BATCH-${p.sku || p.id.substring(0, 6).toUpperCase()}`,
          quantity: qNum,
          incomingPrice: cost,
          expiryDate: expDate,
          createdAt: p.created_at ? new Date(p.created_at) : new Date(),
          warehouseId: whId,
          product: {
            id: p.id,
            name: p.name || 'Produk',
            sku: p.sku || p.id,
            unit: (p.unit || 'pcs').toUpperCase(),
            units,
            costPrice: cost,
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
  await requireStaff();
  try {
    const LOW_STOCK_COLS = 'id,name,sku,stock,unit,is_active,category,raw_units:raw_data->units';
    const { data: products } = await supabaseAdmin
      .from('products')
      .select(LOW_STOCK_COLS)
      .lte('stock', threshold)
      .order('is_active', { ascending: false })
      .order('stock', { ascending: true })
      .limit(50);
    if (!products) return [];

    return products.map((p: any) => ({
      id: p.id,
      name: p.name || 'Produk',
      sku: p.sku || p.id,
      category: { name: p.category || 'Umum' },
      stock: Number(p.stock || 0),
      unit: (p.unit || 'pcs').toUpperCase(),
      units: Array.isArray(p.raw_units) ? p.raw_units : undefined,
      isActive: p.is_active !== false
    }));
  } catch (error) {
    console.error('Failed to fetch low stock:', error);
    return [];
  }
}

export async function getInventoryMovements(filters?: { productId?: string; warehouseId?: string; limit?: number }) {
  await requireStaff();
  try {
    let query = supabaseAdmin.from('inventory_logs').select('*');
    if (filters?.productId) {
      query = query.or(`product_id.eq.${filters.productId},raw_data->>productId.eq.${filters.productId}`);
    }
    query = query.order('created_at', { ascending: false }).limit(filters?.limit || 100);

    const { data: logs, error } = await query;
    if (error || !logs) return [];

    return logs.map((l: any) => {
      const raw = l.raw_data || {};
      return {
        id: l.id,
        type: l.type || raw.type || raw.action || 'ADJUSTMENT',
        quantity: Number(l.quantity || l.amount || raw.quantity || raw.qty || raw.stockChange || 0),
        reference: l.reference_id || raw.reference || raw.orderId || l.id,
        notes: l.note || raw.notes || raw.reason || '',
        createdAt: l.created_at ? new Date(l.created_at) : new Date(),
        product: {
          name: l.product_name || raw.productName || 'Produk',
          sku: raw.sku || ''
        },
        warehouse: {
          name: l.warehouse_id === 'gudang-utama' ? 'Gudang Utama' : (raw.warehouseName || l.warehouse_id || 'Gudang Utama')
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
  quantity?: number // Positif = tambah, Negatif = kurangi (jika mode DELTA)
  targetStock?: number // Alternatif: jika ingin langsung menyetel stok fisik aktual
  mode?: 'DELTA' | 'SET'
  notes?: string
  createdById?: string
}) {
  await requireStaff();
  try {
    const { data: p, error: fetchErr } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', data.productId)
      .single();

    if (fetchErr || !p) {
      return { success: false, error: 'Produk tidak ditemukan' };
    }

    const raw = p.raw_data || {};
    const unit = p.unit || raw.unit || 'pcs';
    const currentStock = Number(p.stock ?? raw.stock ?? raw.Stok ?? 0);
    const stockByWarehouse = { ...(raw.stockByWarehouse || { 'gudang-utama': currentStock }) };
    const curWhStock = Number(stockByWarehouse[data.warehouseId] ?? currentStock);

    // Hitung quantity delta yang akan diterapkan
    let deltaQty = 0;
    if (data.mode === 'SET' && data.targetStock !== undefined) {
      const target = Number(data.targetStock);
      if (isNaN(target) || target < 0) {
        return { success: false, error: 'Stok target fisik tidak boleh negatif' };
      }
      deltaQty = target - curWhStock;
    } else {
      deltaQty = Number(data.quantity || 0);
    }

    if (isNaN(deltaQty) || deltaQty === 0) {
      return { success: false, error: 'Jumlah perubahan stok tidak boleh 0 atau kosong' };
    }

    // 🛑 VALIDASI KETAT: Cegah produk quantity keluar melebihi stok asli!
    const nextWhStock = curWhStock + deltaQty;
    const nextTotalStock = currentStock + deltaQty;

    if (nextWhStock < 0) {
      return {
        success: false,
        error: `Pengurangan gagal: Jumlah keluar (${Math.abs(deltaQty)} ${unit}) melebihi stok asli yang tersedia di gudang terpilih (${curWhStock} ${unit}). Stok tidak boleh negatif!`,
      };
    }

    if (nextTotalStock < 0) {
      return {
        success: false,
        error: `Pengurangan gagal: Jumlah keluar (${Math.abs(deltaQty)} ${unit}) melebihi total stok produk (${currentStock} ${unit}). Stok tidak boleh negatif!`,
      };
    }

    stockByWarehouse[data.warehouseId] = nextWhStock;

    const now = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from('products')
      .update({
        stock: nextTotalStock,
        raw_data: { ...raw, stock: nextTotalStock, stockByWarehouse, updatedAt: now },
        updated_at: now,
      })
      .eq('id', data.productId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    await supabaseAdmin.from('inventory_logs').insert({
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      product_id: data.productId,
      product_name: p.name || raw.name || 'Produk',
      warehouse_id: data.warehouseId,
      quantity: deltaQty,
      amount: Math.abs(deltaQty),
      type: deltaQty >= 0 ? 'MASUK' : 'KELUAR',
      source: 'OPNAME',
      prev_stock: currentStock,
      next_stock: nextTotalStock,
      note: data.notes || (data.mode === 'SET' ? `Set stok fisik ke ${data.targetStock} ${unit}` : 'Penyesuaian stok manual'),
      raw_data: {
        productId: data.productId,
        productName: p.name || raw.name || 'Produk',
        warehouseId: data.warehouseId,
        quantity: deltaQty,
        amount: Math.abs(deltaQty),
        type: deltaQty >= 0 ? 'MASUK' : 'KELUAR',
        action: 'ADJUSTMENT',
        notes: data.notes || (data.mode === 'SET' ? `Set stok fisik ke ${data.targetStock} ${unit}` : 'Penyesuaian stok manual'),
        createdById: data.createdById,
        prevStock: currentStock,
        nextStock: nextTotalStock,
        createdAt: now,
      },
      created_at: now,
      updated_at: now,
    });

    revalidatePath('/admin/inventory');
    revalidatePath('/admin/products');
    return { success: true, newStock: nextTotalStock, newWhStock: nextWhStock };
  } catch (error) {
    console.error('Failed to adjust stock:', error);
    return { success: false, error: 'Gagal melakukan penyesuaian stok' };
  }
}

export async function getWarehouses() {
  await requireStaff();
  try {
    const [whRes, prodRes] = await Promise.all([
      supabaseAdmin.from('warehouses').select('*').order('name', { ascending: true }),
      supabaseAdmin.from('products').select('id, stock, raw_data->stockByWarehouse').limit(5000),
    ]);

    const rows = whRes.data || [];
    const products = prodRes.data || [];

    // Hitung statistik produk & unit per gudang
    const stats: Record<string, { skus: number; totalQty: number }> = {};
    products.forEach((p: any) => {
      const stock = Number(p.stock || 0);
      const stockByWarehouse = p.stockByWarehouse && typeof p.stockByWarehouse === 'object'
        ? p.stockByWarehouse
        : { 'gudang-utama': stock };

      Object.entries(stockByWarehouse).forEach(([whId, qty]) => {
        const qNum = Number(qty || 0);
        if (!stats[whId]) stats[whId] = { skus: 0, totalQty: 0 };
        if (qNum > 0) {
          stats[whId].skus += 1;
          stats[whId].totalQty += qNum;
        }
      });
    });

    return rows.map((w: any) => {
      const raw = w.raw_data || {};
      const whStats = stats[w.id] || { skus: 0, totalQty: 0 };
      const isMain = w.id === 'gudang-utama' || !!raw.isMain || w.name?.toLowerCase().includes('utama');
      const capacity = Number(raw.capacity || 0);
      const pic = raw.contactPerson || raw.pic || raw.adminName || null;
      const phone = raw.phone || raw.contactPhone || null;
      const isActive = typeof raw.isActive === 'boolean' ? raw.isActive : true;

      return {
        id: w.id,
        name: w.name || raw.name || w.id,
        address: w.location || raw.location || raw.address || null,
        pic,
        phone,
        capacity,
        isActive,
        isMain,
        totalSku: whStats.skus,
        totalStock: whStats.totalQty,
        createdAt: w.created_at ? new Date(w.created_at) : new Date(),
        _count: { batches: whStats.skus || 1 }
      };
    });
  } catch (error) {
    console.error('Failed to fetch warehouses:', error);
    return [];
  }
}

export async function createWarehouse(data: {
  name: string;
  address?: string;
  pic?: string;
  phone?: string;
  capacity?: number;
  isMain?: boolean;
}) {
  await requireAdmin();
  try {
    const id = `wh_${Date.now()}`;
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from('warehouses').insert({
      id,
      name: data.name,
      location: data.address || null,
      raw_data: {
        id,
        name: data.name,
        location: data.address || null,
        address: data.address || null,
        contactPerson: data.pic || null,
        phone: data.phone || null,
        capacity: Number(data.capacity || 0),
        isMain: !!data.isMain,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      created_at: now,
      updated_at: now,
    });

    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/warehouses');
    revalidatePath('/admin/inventory');
    return { success: true, data: { id, ...data } };
  } catch (error) {
    return { success: false, error: 'Gagal membuat gudang' };
  }
}

export async function updateWarehouse(id: string, data: {
  name?: string;
  address?: string;
  pic?: string;
  phone?: string;
  capacity?: number;
  isMain?: boolean;
  isActive?: boolean;
}) {
  await requireAdmin();
  try {
    const now = new Date().toISOString();
    const { data: existing } = await supabaseAdmin.from('warehouses').select('raw_data').eq('id', id).maybeSingle();
    const prevRaw = existing?.raw_data || {};

    const updatedRaw = {
      ...prevRaw,
      ...(data.name ? { name: data.name } : {}),
      ...(data.address !== undefined ? { address: data.address, location: data.address } : {}),
      ...(data.pic !== undefined ? { contactPerson: data.pic, pic: data.pic } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.capacity !== undefined ? { capacity: Number(data.capacity || 0) } : {}),
      ...(data.isMain !== undefined ? { isMain: data.isMain } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      updatedAt: now,
    };

    const updatePayload: any = {
      updated_at: now,
      raw_data: updatedRaw,
    };
    if (data.name) updatePayload.name = data.name;
    if (data.address !== undefined) updatePayload.location = data.address;

    const { error } = await supabaseAdmin.from('warehouses').update(updatePayload).eq('id', id);

    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/warehouses');
    revalidatePath('/admin/inventory');
    return { success: true, data: { id, ...data } };
  } catch (error) {
    return { success: false, error: 'Gagal mengupdate gudang' };
  }
}
