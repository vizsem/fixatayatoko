'use server'

import { revalidatePath } from 'next/cache'

import { orderBy, where } from '@/lib/firebase';
export type ProductQueryOptions = {
  isActive?: boolean
  category?: string
  warehouseId?: string
  orderByField?: 'name' | 'updatedAt' | 'sku' | 'createdAt'
  orderDirection?: 'asc' | 'desc'
  search?: string
  limit?: number
}

import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function getProducts(options?: ProductQueryOptions) {
  try {
    let query = supabaseAdmin.from('products').select('*');

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (options?.search && options.search.trim()) {
      const tokens = options.search
        .trim()
        .split(/\s+/)
        .map((t) => t.replace(/[%_,()]/g, '').trim())
        .filter(Boolean);

      tokens.forEach((token) => {
        query = query.or(
          `name.ilike.%${token}%,sku.ilike.%${token}%,barcode.ilike.%${token}%,category.ilike.%${token}%`
        );
      });

      query = query.limit(options.limit || 300);
    } else {
      query = query.limit(options?.limit || 1000);
    }

    const sortField = options?.orderByField === 'name' ? 'name' : 'created_at';
    query = query.order(sortField, { ascending: options?.orderDirection === 'asc' });

    const { data: rows, error } = await query;
    if (error || !rows) {
      console.error('Failed to fetch products from Supabase:', error);
      return [];
    }

    const mapped = rows.map((p: any) => {
      const raw = p.raw_data || {};
      const stock = Number(p.stock ?? raw.stock ?? raw.Stok ?? 0);
      const priceEcer = Number(p.price ?? raw.price ?? raw.Ecer ?? 0);
      const purchasePrice = Number(p.cost_price ?? raw.purchasePrice ?? raw.Modal ?? 0);
      const stockByWarehouse = raw.stockByWarehouse || { 'gudang-utama': stock };
      const isArchivedLegacy = 
        raw.isActive === false || 
        raw.isActive === 'false' || 
        raw.Status === 1 || 
        raw.Status === '1' || 
        raw.status === 'ARCHIVED';

      return {
        id: p.id,
        name: p.name || raw.name || raw.Nama || 'Produk',
        sku: p.sku || raw.sku || raw.Barcode || raw.barcode || p.id,
        barcode: p.barcode || raw.barcode || raw.Barcode || '',
        description: p.description || raw.description || raw.Deskripsi || '',
        category: p.category || raw.category || raw.Kategori || 'Semua',
        categoryId: p.category || 'cat_umum',
        supplierId: raw.supplierId || '',
        supplierName: raw.Supplier || raw.supplierName || '',
        warehouseId: raw.warehouseId || 'gudang-utama',
        stock,
        stockByWarehouse,
        minStock: Number(raw.minStock ?? raw.Min_Stok ?? 5),
        priceEcer,
        priceGrosir: Number(raw.wholesalePrice ?? raw.Harga_Grosir ?? priceEcer),
        unit: p.unit || raw.unit || raw.Satuan || 'pcs',
        isActive: !isArchivedLegacy,
        imageUrl: p.image_url || raw.imageUrl || raw.Link_Foto || raw.image,
        purchasePrice,
        createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
        updatedAt: p.updated_at ? new Date(p.updated_at).getTime() : Date.now(),
        expired_date: raw.expiredDate || raw.Expired || undefined,
        batches: []
      };
    });

    if (options?.isActive !== undefined) {
      return mapped.filter((p) => p.isActive === options.isActive);
    }

    return mapped;
  } catch (error) {
    console.error('Failed to fetch products:', error);
    return [];
  }
}

export async function getProductById(id: string) {
  try {
    const { data: p, error } = await supabaseAdmin.from('products').select('*').eq('id', id).single();
    if (error || !p) return null;
    const raw = p.raw_data || {};
    const stock = Number(p.stock ?? raw.stock ?? raw.Stok ?? 0);
    return {
      id: p.id,
      name: p.name || raw.name || raw.Nama || 'Produk',
      sku: p.sku || raw.sku || raw.Barcode || p.id,
      barcode: p.barcode || raw.barcode || null,
      description: p.description || raw.description || null,
      costPrice: Number(p.cost_price ?? raw.costPrice ?? raw.Modal ?? 0),
      sellPrice: Number(p.price ?? raw.sellPrice ?? raw.Ecer ?? 0),
      unit: p.unit || raw.unit || 'pcs',
      stock,
      category: { id: p.category || raw.category || 'Umum', name: p.category || raw.category || 'Umum' },
      batches: [],
    };
  } catch (error) {
    return null;
  }
}

export async function createProduct(data: {
  name: string
  sku: string
  description?: string
  categoryId: string
  supplierId?: string
  costPrice: number
  sellPrice: number
  unit: string
}) {
  try {
    const id = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const raw_data = {
      name: data.name,
      sku: data.sku,
      description: data.description || '',
      category: data.categoryId,
      supplierId: data.supplierId || null,
      costPrice: data.costPrice,
      price: data.sellPrice,
      unit: data.unit,
      stock: 0,
      createdAt: now,
      updatedAt: now,
    };

    const { error } = await supabaseAdmin.from('products').insert({
      id,
      name: data.name,
      sku: data.sku,
      description: data.description || null,
      price: data.sellPrice,
      cost_price: data.costPrice,
      category: data.categoryId,
      unit: data.unit,
      stock: 0,
      raw_data,
      created_at: now,
      updated_at: now,
    });

    if (error) throw error;
    revalidatePath('/admin/products');
    return { success: true, data: { id, ...data, stock: 0 } };
  } catch (error: any) {
    console.error('Failed to create product:', error);
    return { success: false, error: error?.message || 'Gagal membuat produk' };
  }
}

export async function updateProduct(id: string, data: {
  name?: string
  sku?: string
  description?: string
  categoryId?: string
  supplierId?: string
  costPrice?: number
  sellPrice?: number
  unit?: string
}) {
  try {
    const now = new Date().toISOString();
    const { data: existing } = await supabaseAdmin.from('products').select('*').eq('id', id).single();
    const raw = existing?.raw_data || {};

    const updatedRaw = {
      ...raw,
      ...(data.name ? { name: data.name } : {}),
      ...(data.sku ? { sku: data.sku } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.categoryId ? { category: data.categoryId } : {}),
      ...(data.supplierId ? { supplierId: data.supplierId } : {}),
      ...(data.costPrice !== undefined ? { costPrice: data.costPrice } : {}),
      ...(data.sellPrice !== undefined ? { price: data.sellPrice } : {}),
      ...(data.unit ? { unit: data.unit } : {}),
      updatedAt: now,
    };

    const payload: any = {
      raw_data: updatedRaw,
      updated_at: now,
    };
    if (data.name) payload.name = data.name;
    if (data.sku) payload.sku = data.sku;
    if (data.description !== undefined) payload.description = data.description;
    if (data.sellPrice !== undefined) payload.price = data.sellPrice;
    if (data.costPrice !== undefined) payload.cost_price = data.costPrice;
    if (data.categoryId) payload.category = data.categoryId;
    if (data.unit) payload.unit = data.unit;

    const { error } = await supabaseAdmin.from('products').update(payload).eq('id', id);
    if (error) throw error;

    revalidatePath('/admin/products');
    return { success: true, data: { id, ...data } };
  } catch (error: any) {
    console.error('Failed to update product:', error);
    return { success: false, error: error?.message || 'Gagal mengupdate produk' };
  }
}

export async function archiveProducts(ids: string[]) {
  return updateProductStatus(ids, 1);
}

export async function deleteProduct(id: string) {
  try {
    const { error } = await supabaseAdmin.from('products').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/admin/products');
    return { success: true };
  } catch (error: any) {
    console.error('Delete error:', error);
    return { success: false, error: error?.message || 'Gagal menghapus produk' };
  }
}

export async function updateProductStatus(ids: string[], status: string | number) {
  try {
    if (!ids || ids.length === 0) return { success: true };
    const now = new Date().toISOString();
    const isArchived = Number(status) === 1 || String(status).toUpperCase() === 'ARCHIVED';

    const { data: products, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('id, raw_data')
      .in('id', ids);

    if (fetchError) {
      console.error('Error fetching products for status update:', fetchError);
      throw fetchError;
    }

    for (const p of products || []) {
      const raw = (p.raw_data && typeof p.raw_data === 'object') ? { ...p.raw_data } : {};
      raw.isActive = !isArchived;
      raw.Status = isArchived ? 1 : 0;
      raw.status = isArchived ? 'ARCHIVED' : 'ACTIVE';

      const { error: updateError } = await supabaseAdmin
        .from('products')
        .update({
          raw_data: raw,
          updated_at: now,
        })
        .eq('id', p.id);

      if (updateError) {
        console.error(`Failed to update status for product ${p.id}:`, updateError);
        throw updateError;
      }
    }

    revalidatePath('/admin/products');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to update product status:', error);
    return { success: false, error: error?.message || 'Gagal mengubah status produk' };
  }
}

export async function getCategories() {
  try {
    const { data: rows, error } = await supabaseAdmin.from('categories').select('*').order('name', { ascending: true });
    if (error || !rows) return [];
    return rows.map((c: any) => ({
      id: c.id,
      name: c.name || c.raw_data?.name || 'Kategori',
      description: c.raw_data?.description || null,
      _count: { products: 0 }
    }));
  } catch (error) {
    return [];
  }
}

export async function createCategory(data: { name: string; description?: string }) {
  try {
    const id = `cat_${Date.now()}`;
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from('categories').insert({
      id,
      name: data.name,
      raw_data: { ...data, createdAt: now },
      created_at: now,
      updated_at: now,
    });
    if (error) throw error;
    revalidatePath('/admin/products');
    revalidatePath('/admin/kategori');
    return { success: true, data: { id, ...data } };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Gagal membuat kategori' };
  }
}
