'use server'

import { revalidatePath } from 'next/cache'

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
import { addStock } from '@/lib/inventory';

export async function getProducts(options?: ProductQueryOptions) {
  try {
    let query = supabaseAdmin.from('products').select('*');

    // Filter is_active langsung di database (lebih efisien)
    if (options?.isActive !== undefined) {
      if (options.isActive === true) {
        query = query.or('is_active.eq.true,is_active.is.null');
      } else {
        query = query.eq('is_active', false);
      }
    }

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

      // Gunakan kolom is_active dari DB jika ada, fallback ke heuristik raw_data
      const isActive = typeof p.is_active === 'boolean' ? p.is_active : !isArchivedLegacy;

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
        units: Array.isArray(raw.units) && raw.units.length > 0 ? raw.units : undefined,
        costPrice: purchasePrice,
        isActive,
        imageUrl: p.image_url || raw.imageUrl || raw.Link_Foto || raw.image,
        purchasePrice,
        createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
        updatedAt: p.updated_at ? new Date(p.updated_at).getTime() : Date.now(),
        expired_date: raw.expiredDate || raw.Expired || undefined,
        batches: []
      };
    });

    // Filter sudah dilakukan di level DB via .eq('is_active', ...)
    // Fallback client-side jika kolom belum ada di DB lama
    if (options?.isActive !== undefined && rows.some((r: any) => r.is_active === null || r.is_active === undefined)) {
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

export async function getProductByIdForEdit(id: string) {
  try {
    const { data: spRow, error } = await supabaseAdmin.from('products').select('*').eq('id', id).single();
    if (error || !spRow) return null;
    const raw = spRow.raw_data || {};
    return {
      id: spRow.id,
      name: spRow.name || raw.Nama || raw.name || '',
      category: spRow.category || raw.Kategori || raw.category || 'UMUM',
      unit: spRow.unit || raw.Satuan || raw.unit || 'PCS',
      stock: Number(spRow.stock ?? raw.Stok ?? raw.stock ?? 0),
      cost_price: Number(spRow.cost_price ?? raw.Modal ?? raw.purchasePrice ?? 0),
      price: Number(spRow.price ?? raw.Ecer ?? raw.price ?? 0),
      barcode: spRow.barcode || raw.Barcode || raw.barcode || '',
      image_url: spRow.image_url || raw.Link_Foto || raw.imageUrl || raw.image || raw.URL_Produk || '',
      description: spRow.description || raw.Deskripsi || raw.description || '',
      is_active: typeof spRow.is_active === 'boolean' ? spRow.is_active : raw.isActive !== false && raw.Status !== 1,
      raw_data: raw,
    };
  } catch (err) {
    console.error('Failed to get product for edit:', err);
    return null;
  }
}

export async function saveEditedProduct(id: string, payload: {
  name: string
  category: string
  unit: string
  price: number
  cost_price: number
  stock: number
  barcode: string
  image_url: string
  description: string
  is_active: boolean
  raw_data: any
}) {
  try {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from('products').upsert({
      id,
      name: payload.name,
      category: payload.category,
      unit: payload.unit,
      price: payload.price,
      cost_price: payload.cost_price,
      stock: payload.stock,
      barcode: payload.barcode,
      image_url: payload.image_url,
      description: payload.description,
      is_active: payload.is_active,
      raw_data: {
        ...payload.raw_data,
        updatedAt: now,
      },
      updated_at: now,
    });

    if (error) throw error;

    if (payload.category) {
      const { data: existingCat } = await supabaseAdmin.from('categories').select('id').ilike('name', payload.category).maybeSingle();
      if (!existingCat) {
        const catId = `cat_${Date.now()}`;
        await supabaseAdmin.from('categories').insert({
          id: catId,
          name: payload.category,
          raw_data: { name: payload.category, createdAt: now },
          created_at: now,
          updated_at: now,
        });
      }
    }

    revalidatePath('/admin/products');
    revalidatePath('/admin/inventory');
    revalidatePath(`/admin/products/edit/${id}`);
    revalidatePath(`/produk/${id}`);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to save edited product:', error);
    return { success: false, error: error?.message || 'Gagal menyimpan produk' };
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
      ...(data.costPrice !== undefined ? { costPrice: data.costPrice, Modal: data.costPrice, purchasePrice: data.costPrice } : {}),
      ...(data.sellPrice !== undefined ? { price: data.sellPrice, Ecer: data.sellPrice, priceEcer: data.sellPrice } : {}),
      ...(data.unit ? { unit: data.unit, Satuan: data.unit } : {}),
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
    revalidatePath('/admin/inventory');
    revalidatePath('/admin/products/pricing-hpp');
    return { success: true, data: { id, ...data } };
  } catch (error: any) {
    console.error('Failed to update product:', error);
    return { success: false, error: error?.message || 'Gagal mengupdate produk' };
  }
}

export async function archiveProducts(ids: string[]) {
  return updateProductStatus(ids, 1);
}

export async function deleteProductsBulk(ids: string[]) {
  try {
    if (!ids || ids.length === 0) return { success: true, count: 0 };
    const { error } = await supabaseAdmin.from('products').delete().in('id', ids);
    if (error) throw error;
    revalidatePath('/admin/products');
    return { success: true, count: ids.length };
  } catch (error: any) {
    console.error('Bulk delete error:', error);
    return { success: false, error: error?.message || 'Gagal menghapus produk' };
  }
}

export async function deleteProduct(id: string) {
  return deleteProductsBulk([id]);
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
          is_active: !isArchived,
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

export async function addProductFull(payload: {
  // Identitas
  ID: string;
  Barcode?: string;
  Parent_ID?: string;
  Nama: string;
  Kategori?: string;
  Brand?: string;
  Deskripsi?: string;
  // Stok
  Satuan: string;
  Satuan_Modal?: string;
  Stok: number;
  Min_Stok: number;
  warehouseId?: string;
  minPurchase?: number;
  maxPurchase?: number;
  // Dimensi
  dimLength?: number;
  dimWidth?: number;
  dimHeight?: number;
  volumeInCtn?: number;
  // Harga
  Modal: number;
  Ecer: number;
  Harga_Coret?: number;
  Grosir?: number;
  Min_Grosir?: number;
  // Satuan multi-unit
  units?: Array<{ code: string; contains: number; price?: number; label?: string; minQty?: number }>;
  // Supplier
  Supplier?: string;
  No_WA_Supplier?: string;
  Lokasi?: string;
  // Tanggal
  Expired_Default?: string;
  expired_date?: string;
  tgl_masuk?: string;
  // Media
  imageUrl?: string;
  // Status
  Status: number;
  // Pricing strategy
  pricingStrategy?: Record<string, unknown>;
}) {
  try {
    const now = new Date().toISOString();
    const sku = payload.ID.trim();
    const displayName = payload.Nama.trim().toUpperCase();
    const baseUnit = (payload.Satuan || 'PCS').trim().toUpperCase();
    const totalStock = Number(payload.Stok || 0);
    const isActive = Number(payload.Status) === 1;
    const byWarehouse = payload.warehouseId ? { [payload.warehouseId]: totalStock } : {};

    // Validasi duplikat SKU di Supabase
    const { data: existing } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('sku', sku)
      .maybeSingle();
    if (existing) {
      return { success: false, error: `ID/SKU "${sku}" sudah terdaftar di database!` };
    }

    const id = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const raw_data = {
      ID: sku,
      Barcode: payload.Barcode || '',
      Parent_ID: payload.Parent_ID || '',
      Nama: displayName,
      name: displayName,
      Kategori: payload.Kategori || '',
      category: payload.Kategori || '',
      Brand: payload.Brand || '',
      Deskripsi: payload.Deskripsi || '',
      description: payload.Deskripsi || '',
      Satuan: baseUnit,
      Satuan_Modal: payload.Satuan_Modal || baseUnit,
      unit: baseUnit,
      Stok: totalStock,
      stock: totalStock,
      stockByWarehouse: byWarehouse,
      Min_Stok: Number(payload.Min_Stok || 5),
      minStock: Number(payload.Min_Stok || 5),
      Modal: Number(payload.Modal || 0),
      purchasePrice: Number(payload.Modal || 0),
      Ecer: Number(payload.Ecer || 0),
      price: Number(payload.Ecer || 0),
      priceEcer: Number(payload.Ecer || 0),
      Harga_Coret: Number(payload.Harga_Coret || 0),
      Grosir: Number(payload.Grosir || 0),
      wholesalePrice: Number(payload.Grosir || 0),
      priceGrosir: Number(payload.Grosir || 0),
      Min_Grosir: Number(payload.Min_Grosir || 1),
      minWholesale: Number(payload.Min_Grosir || 1),
      minWholesaleQty: Number(payload.Min_Grosir || 1),
      warehouseId: payload.warehouseId || '',
      minPurchase: Number(payload.minPurchase || 1),
      maxPurchase: Number(payload.maxPurchase || 0),
      dimensions: {
        length: Number(payload.dimLength || 0),
        width: Number(payload.dimWidth || 0),
        height: Number(payload.dimHeight || 0),
      },
      volumeInCtn: Number(payload.volumeInCtn || 0),
      units: payload.units || [{ code: baseUnit, contains: 1, price: Number(payload.Ecer || 0), label: '' }],
      Supplier: payload.Supplier || '',
      supplierName: payload.Supplier || '',
      No_WA_Supplier: payload.No_WA_Supplier || '',
      Lokasi: payload.Lokasi || '',
      Expired_Default: payload.Expired_Default || '',
      expiredDate: payload.expired_date || payload.Expired_Default || '',
      tgl_masuk: payload.tgl_masuk || '',
      imageUrl: payload.imageUrl || '',
      image: payload.imageUrl || '',
      Link_Foto: payload.imageUrl || '',
      // Status flags (compatible with normalization)
      isActive,
      Status: isActive ? 0 : 1,  // 0=active, 1=archived in legacy schema
      status: isActive ? 'ACTIVE' : 'ARCHIVED',
      pricingStrategy: payload.pricingStrategy || { mode: 'manual' },
      createdAt: now,
      updatedAt: now,
    };

    const { error } = await supabaseAdmin.from('products').insert({
      id,
      name: displayName,
      sku,
      barcode: payload.Barcode || null,
      description: payload.Deskripsi || null,
      price: Number(payload.Ecer || 0),
      cost_price: Number(payload.Modal || 0),
      category: payload.Kategori || null,
      unit: baseUnit,
      stock: totalStock,
      image_url: payload.imageUrl || null,
      is_active: isActive,
      raw_data,
      created_at: now,
      updated_at: now,
    });

    if (error) throw error;

    if (payload.Kategori) {
      const { data: existingCat } = await supabaseAdmin.from('categories').select('id').ilike('name', payload.Kategori).maybeSingle();
      if (!existingCat) {
        const catId = `cat_${Date.now()}`;
        await supabaseAdmin.from('categories').insert({
          id: catId,
          name: payload.Kategori,
          raw_data: { name: payload.Kategori, createdAt: now },
          created_at: now,
          updated_at: now,
        });
      }
    }

    revalidatePath('/admin/products');
    return { success: true, data: { id, name: displayName, sku } };
  } catch (error: any) {
    console.error('Failed to add product:', error);
    return { success: false, error: error?.message || 'Gagal menambah produk' };
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

export async function attachBarcodeToProduct(productId: string, barcode: string, unitCode?: string) {
  try {
    const { data: prod, error } = await supabaseAdmin
      .from('products')
      .select('id, name, barcode, raw_data, unit')
      .eq('id', productId)
      .single();

    if (error || !prod) throw new Error('Produk tidak ditemukan');

    const cleanBarcode = barcode.trim();
    const raw = (prod.raw_data || {}) as Record<string, any>;
    const now = new Date().toISOString();

    let updatedBarcode = prod.barcode;
    let updatedRawData: Record<string, any> = { ...raw, updatedAt: now };

    if (!unitCode || unitCode === prod.unit || unitCode === raw.Satuan) {
      // Barcode utama produk
      updatedBarcode = cleanBarcode;
      updatedRawData.Barcode = cleanBarcode;
      updatedRawData.barcode = cleanBarcode;
    } else {
      // Barcode untuk satuan spesifik (multi-unit: BOX, RENCENG, dll)
      const units = Array.isArray(raw.units) ? [...raw.units] : [];
      const unitIndex = units.findIndex((u: any) => (u.code || u.unit) === unitCode);
      if (unitIndex >= 0) {
        units[unitIndex] = { ...units[unitIndex], barcode: cleanBarcode };
      } else {
        units.push({ code: unitCode, barcode: cleanBarcode, contains: 1 });
      }
      updatedRawData.units = units;
    }

    const { error: updateErr } = await supabaseAdmin
      .from('products')
      .update({
        barcode: updatedBarcode,
        raw_data: updatedRawData,
        updated_at: now,
      })
      .eq('id', productId);

    if (updateErr) throw updateErr;

    revalidatePath('/admin/products');
    revalidatePath(`/admin/products/edit/${productId}`);
    return { success: true, productName: prod.name };
  } catch (err: any) {
    console.error('attachBarcodeToProduct error:', err);
    return { success: false, error: err?.message || 'Gagal menautkan barcode' };
  }
}

export async function duplicateProduct(id: string) {
  try {
    const { data: src, error: fetchErr } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !src) throw new Error('Produk tidak ditemukan');

    const newId = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const baseName = src.name || 'Produk';
    const newName = baseName.endsWith('(Duplikat)') ? baseName : `${baseName} (Duplikat)`;
    const newSku = `${src.sku || newId}-DUP-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    const raw_data = {
      ...(src.raw_data || {}),
      name: newName,
      sku: newSku,
      stock: 0,
      createdAt: now,
      updatedAt: now,
    };

    const { error: insertErr } = await supabaseAdmin.from('products').insert({
      id: newId,
      name: newName,
      sku: newSku,
      description: src.description,
      price: src.price,
      cost_price: src.cost_price,
      category: src.category,
      unit: src.unit,
      stock: 0,
      barcode: null, // barcode tidak ikut diduplikat (harus unik)
      is_active: true,
      raw_data,
      created_at: now,
      updated_at: now,
    });

    if (insertErr) throw insertErr;
    revalidatePath('/admin/products');
    return { success: true, newId, name: newName };
  } catch (err: any) {
    console.error('duplicateProduct error:', err);
    return { success: false, error: err?.message || 'Gagal menduplikasi produk' };
  }
}

/**
 * Update harga modal (HPP), harga jual ecer, harga grosir, dan min qty grosir sebuah produk.
 * Digunakan dari Quick Update Harga modal di halaman Struktur HPP.
 * Wajib dijalankan sebagai Server Action agar supabaseAdmin bisa diakses dengan aman.
 */
export async function updateProductPrice(payload: {
  productId: string;
  newCost: number;
  newPrice: number;
  newGrosir: number;
  newMinGrosir: number;
  units?: Array<{ code: string; contains: number; price?: number; minQty?: number; label?: string }>;
  isHppLocked?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { productId, newCost, newPrice, newGrosir, newMinGrosir, units, isHppLocked } = payload;

    // Ambil raw_data saat ini untuk di-merge (jangan overwrite field lain)
    const { data: currentProd, error: fetchErr } = await supabaseAdmin
      .from('products')
      .select('raw_data, cost_price, unit, price')
      .eq('id', productId)
      .single();

    if (fetchErr) throw fetchErr;

    const existingRaw = currentProd?.raw_data || {};
    const now = new Date().toISOString();
    const baseUnit = (currentProd?.unit || existingRaw.unit || existingRaw.Satuan || 'PCS').toUpperCase();

    // Pastikan jika ada units, base unit tersinkron dengan newPrice
    let cleanedUnits = units ? [...units] : (Array.isArray(existingRaw.units) ? [...existingRaw.units] : []);
    if (cleanedUnits.length > 0) {
      cleanedUnits = cleanedUnits.map(u => {
        const code = String(u.code || '').trim().toUpperCase();
        if (code === baseUnit) {
          return { ...u, code, contains: 1, price: newPrice };
        }
        return { ...u, code, contains: Number(u.contains || 1), price: Number(u.price || 0) };
      });
    }

    // Tentukan flag lock HPP: jika eksplisit diberikan gunakan itu, jika tidak tapi cost berubah maka kunci
    const costChanged = Number(currentProd?.cost_price || 0) !== newCost;
    const shouldLock = isHppLocked !== undefined ? isHppLocked : (costChanged ? true : Boolean(existingRaw.isHppLocked));

    const updatedRaw = {
      ...existingRaw,
      Modal: newCost,
      purchasePrice: newCost,
      costPrice: newCost,
      Ecer: newPrice,
      price: newPrice,
      priceEcer: newPrice,
      Grosir: newGrosir,
      wholesalePrice: newGrosir,
      priceGrosir: newGrosir,
      Min_Grosir: newMinGrosir,
      isHppLocked: shouldLock,
      customHpp: shouldLock ? newCost : existingRaw.customHpp,
      customHppUpdatedAt: shouldLock ? now : existingRaw.customHppUpdatedAt,
      updatedAt: now,
    };

    if (cleanedUnits.length > 0) {
      updatedRaw.units = cleanedUnits;
    }

    const { error: updateErr } = await supabaseAdmin
      .from('products')
      .update({
        cost_price: newCost,
        price: newPrice,
        raw_data: updatedRaw,
        updated_at: now,
      })
      .eq('id', productId);

    if (updateErr) throw updateErr;

    revalidatePath('/admin/products/pricing-hpp');
    revalidatePath('/admin/inventory');
    revalidatePath('/admin/products');
    return { success: true };
  } catch (err: any) {
    console.error('updateProductPrice error:', err);
    return { success: false, error: err.message || 'Gagal memperbarui harga produk' };
  }
}

/**
 * Toggle Kunci HPP (Proteksi agar tidak tertimpa saat restart AVG)
 */
export async function toggleLockProductHpp(
  productIds: string[],
  isLocked: boolean,
  adminEmail: string,
): Promise<{ success: boolean; updated: number; error?: string }> {
  if (!productIds.length) return { success: true, updated: 0 };
  try {
    const now = new Date().toISOString();
    let updated = 0;

    for (const pid of productIds) {
      const { data: prod } = await supabaseAdmin
        .from('products')
        .select('raw_data, cost_price')
        .eq('id', pid)
        .single();

      if (!prod) continue;

      const existingRaw = prod.raw_data || {};
      const updatedRaw = {
        ...existingRaw,
        isHppLocked: isLocked,
        customHpp: isLocked ? Number(prod.cost_price || 0) : existingRaw.customHpp,
        customHppUpdatedAt: now,
        lockedBy: adminEmail,
      };

      const { error: upErr } = await supabaseAdmin
        .from('products')
        .update({
          raw_data: updatedRaw,
          updated_at: now,
        })
        .eq('id', pid);

      if (!upErr) updated++;
    }

    revalidatePath('/admin/products/pricing-hpp');
    revalidatePath('/admin/products');
    return { success: true, updated };
  } catch (err: any) {
    console.error('toggleLockProductHpp error:', err);
    return { success: false, updated: 0, error: err.message };
  }
}

export async function restockProductViaSupabase(productId: string, stokMasuk: number, hargaBaru: number, adminId?: string, warehouseId?: string) {
  try {
    await addStock({
      productId,
      amount: stokMasuk,
      incomingPrice: hargaBaru,
      warehouseId: warehouseId || 'gudang-utama',
      reference: 'RESTOCK_MODAL',
      notes: 'Restock (Avg Price) dari Kalkulator',
    });
    revalidatePath('/admin/products');
    revalidatePath('/admin/inventory');
    return { success: true };
  } catch (err: any) {
    console.error('restockProductViaSupabase error:', err);
    return { success: false, error: err.message || 'Gagal melakukan restock' };
  }
}

/**
 * Menghitung AVG HPP semua produk dari riwayat PO (purchases) dalam satu query.
 * Mengembalikan Map: productId -> { avgCost, totalQty, poCount }
 */
export async function getAllProductsAvgHpp(): Promise<
  Record<string, { avgCost: number; totalQty: number; poCount: number }>
> {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('purchases')
      .select('raw_data, created_at')
      .order('created_at', { ascending: false });

    if (error || !rows) return {};

    // productId -> { totalCost, totalQty, poCount }
    const accumulator: Record<string, { totalCost: number; totalQty: number; poCount: number }> = {};

    for (const p of rows) {
      const raw = p.raw_data || {};
      const status = (raw.status || '').toUpperCase();
      // Hanya hitung PO yang sudah RECEIVED/DITERIMA, skip yang dibatalkan
      if (status === 'CANCELLED' || status === 'DIBATALKAN') continue;

      const items: any[] = raw.items || [];
      for (const item of items) {
        const pid: string | undefined =
          item.productId || item.product_id || undefined;
        if (!pid) continue;

        const qty = Number(item.quantity ?? item.qty ?? 1);
        const price = Number(item.unitPrice ?? item.purchasePrice ?? 0);
        if (qty <= 0 || price <= 0) continue;

        if (!accumulator[pid]) {
          accumulator[pid] = { totalCost: 0, totalQty: 0, poCount: 0 };
        }
        accumulator[pid].totalCost += qty * price;
        accumulator[pid].totalQty += qty;
        accumulator[pid].poCount += 1;
      }
    }

    const result: Record<string, { avgCost: number; totalQty: number; poCount: number }> = {};
    for (const [pid, val] of Object.entries(accumulator)) {
      result[pid] = {
        avgCost: val.totalQty > 0 ? Math.round(val.totalCost / val.totalQty) : 0,
        totalQty: val.totalQty,
        poCount: val.poCount,
      };
    }

    return result;
  } catch (err) {
    console.error('getAllProductsAvgHpp error:', err);
    return {};
  }
}

/**
 * Reset HPP (cost_price) produk terpilih ke nilai AVG berdasarkan riwayat PO.
 * Memperbarui cost_price + raw_data.Modal + raw_data.purchasePrice di Supabase.
 * Opsi skipLockedHpp (default true) menjamin produk yang sudah diset manual TIDAK HILANG / TIDAK TERTIMPA!
 */
export async function resetAvgHppForProducts(
  productIds: string[],
  avgMap: Record<string, { avgCost: number; totalQty: number; poCount: number }>,
  adminEmail: string,
  options?: {
    skipLockedHpp?: boolean;
  }
): Promise<{ success: boolean; updated: number; skipped: number; lockedSkipped: number; error?: string }> {
  if (!productIds.length) return { success: true, updated: 0, skipped: 0, lockedSkipped: 0 };

  const skipLocked = options?.skipLockedHpp !== false;

  try {
    const now = new Date().toISOString();
    let updated = 0;
    let skipped = 0;
    let lockedSkipped = 0;

    for (const pid of productIds) {
      const stats = avgMap[pid];
      if (!stats || stats.avgCost <= 0) {
        skipped++;
        continue;
      }

      // Fetch raw_data to check lock and merge
      const { data: prod } = await supabaseAdmin
        .from('products')
        .select('raw_data, cost_price')
        .eq('id', pid)
        .single();

      if (!prod) { skipped++; continue; }

      const existingRaw = prod.raw_data || {};

      // Jika user memilih untuk lewati produk yang terkunci/sudah diset manual
      if (skipLocked && existingRaw.isHppLocked) {
        lockedSkipped++;
        continue;
      }

      const updatedRaw = {
        ...existingRaw,
        Modal: stats.avgCost,
        purchasePrice: stats.avgCost,
        costPrice: stats.avgCost,
        isHppLocked: false, // reset lock jika admin sengaja menimpa dengan AVG
        avgHppResetAt: now,
        avgHppResetBy: adminEmail,
        avgHppPOCount: stats.poCount,
        avgHppTotalQty: stats.totalQty,
      };

      const { error: upErr } = await supabaseAdmin
        .from('products')
        .update({
          cost_price: stats.avgCost,
          raw_data: updatedRaw,
          updated_at: now,
        })
        .eq('id', pid);

      if (upErr) {
        console.error(`resetAvgHpp failed for ${pid}:`, upErr);
        skipped++;
      } else {
        updated++;
      }
    }

    revalidatePath('/admin/products/pricing-hpp');
    revalidatePath('/admin/products');
    revalidatePath('/admin/inventory');

    return { success: true, updated, skipped, lockedSkipped };
  } catch (err: any) {
    console.error('resetAvgHppForProducts error:', err);
    return { success: false, updated: 0, skipped: productIds.length, lockedSkipped: 0, error: err.message };
  }
}

export interface BulkMarginOptions {
  marginType?: 'PERCENT' | 'NOMINAL';
  targetUnitMode?: 'BASE_ONLY' | 'ALL_UNITS' | string;
}

/**
 * Update harga jual berdasarkan target margin (% atau Nominal Rp) dari HPP.
 * Bisa memilih set untuk:
 * - 'BASE_ONLY': Satuan Utama saja (harga ecer dasar)
 * - 'ALL_UNITS': Semua Satuan secara proporsional
 * - Satuan Spesifik Tertentu (misal 'DUS', 'PACK', 'RENCENG')
 */
export async function bulkUpdateTargetMargin(
  productIds: string[],
  marginValue: number,
  adminEmail: string,
  options?: BulkMarginOptions,
): Promise<{ success: boolean; updated: number; error?: string }> {
  if (!productIds.length) return { success: true, updated: 0 };
  
  const marginType = options?.marginType || 'PERCENT';
  const targetUnitMode = (options?.targetUnitMode || 'BASE_ONLY').toUpperCase();

  try {
    const now = new Date().toISOString();
    let updated = 0;

    for (const pid of productIds) {
      const { data: prod } = await supabaseAdmin
        .from('products')
        .select('raw_data, cost_price, name, price, unit')
        .eq('id', pid)
        .single();

      if (!prod) continue;
      
      const cost = Number(prod.cost_price || 0);
      if (cost <= 0) continue; // skip if cost is 0

      const existingRaw = prod.raw_data || {};
      const baseUnit = (prod.unit || existingRaw.unit || existingRaw.Satuan || 'PCS').toUpperCase();

      // Cek apakah harga ecer/satuan utama juga harus diubah
      const shouldUpdateBasePrice = targetUnitMode === 'BASE_ONLY' || targetUnitMode === 'ALL_UNITS' || targetUnitMode === baseUnit;

      let newBasePrice = Number(prod.price || existingRaw.price || cost);
      if (shouldUpdateBasePrice) {
        if (marginType === 'NOMINAL') {
          newBasePrice = cost + marginValue;
        } else {
          // PERCENT
          if (marginValue > 0 && marginValue < 100) {
            newBasePrice = Math.ceil(cost / (1 - (marginValue / 100)));
          } else if (marginValue >= 100) {
            newBasePrice = Math.ceil(cost + (cost * (marginValue / 100)));
          }
        }
        newBasePrice = Math.ceil(newBasePrice / 100) * 100;
      }

      // Perbarui satuan yang relevan di array units
      let updatedUnits = Array.isArray(existingRaw.units) ? [...existingRaw.units] : [];

      if (updatedUnits.length > 0) {
        updatedUnits = updatedUnits.map((u: any) => {
          const code = String(u.code || '').trim().toUpperCase();
          const contains = Number(u.contains || (code === baseUnit ? 1 : 1));

          // Base unit sync jika base price berubah
          if (code === baseUnit || contains <= 1) {
            if (shouldUpdateBasePrice) {
              return { ...u, code, contains: 1, price: newBasePrice };
            }
            return u;
          }

          // Cek apakah satuan spesifik ini yang dipilih atau ALL_UNITS
          const shouldUpdateThisUnit = targetUnitMode === 'ALL_UNITS' || targetUnitMode === code;
          if (shouldUpdateThisUnit) {
            const unitCost = cost * contains;
            let uPrice = unitCost;
            if (marginType === 'NOMINAL') {
              uPrice = unitCost + (marginValue * contains);
            } else {
              if (marginValue > 0 && marginValue < 100) {
                uPrice = Math.ceil(unitCost / (1 - (marginValue / 100)));
              } else if (marginValue >= 100) {
                uPrice = Math.ceil(unitCost + (unitCost * (marginValue / 100)));
              }
            }
            uPrice = Math.ceil(uPrice / 100) * 100;
            return { ...u, code, contains, price: uPrice };
          }

          return u;
        });
      }

      const updatedRaw: Record<string, any> = {
        ...existingRaw,
        updatedAt: now,
      };

      if (shouldUpdateBasePrice) {
        updatedRaw.Ecer = newBasePrice;
        updatedRaw.price = newBasePrice;
        updatedRaw.priceEcer = newBasePrice;
      }

      if (updatedUnits.length > 0) {
        updatedRaw.units = updatedUnits;
      }

      const updatePayload: Record<string, any> = {
        raw_data: updatedRaw,
        updated_at: now,
      };

      if (shouldUpdateBasePrice) {
        updatePayload.price = newBasePrice;
      }

      const { error: upErr } = await supabaseAdmin
        .from('products')
        .update(updatePayload)
        .eq('id', pid);

      if (!upErr) {
        updated++;
      }
    }

    revalidatePath('/admin/products/pricing-hpp');
    revalidatePath('/admin/products');
    
    return { success: true, updated };
  } catch (err: any) {
    console.error('bulkUpdateTargetMargin error:', err);
    return { success: false, updated: 0, error: err.message };
  }
}

/**
 * Inisialisasi Baseline AVG PO = HPP Aktif untuk memulai perhitungan awal Moving Average yang profesional.
 * - Jika produk sudah punya riwayat PO di purchases, semua harga beli di itemnya dinormalisasikan ke HPP aktif saat ini.
 * - Jika produk belum pernah punya PO di purchases, dibuatkan record Saldo Awal (Baseline Purchase) resmi.
 * Hasilnya: Nilai AVG PO terhitung sama persis dengan HPP aktif, selisih (drift) menjadi 0.
 */
export async function syncAvgPoToActiveHpp(
  productIds: string[],
  adminEmail: string,
): Promise<{ success: boolean; updated: number; error?: string }> {
  if (!productIds.length) return { success: true, updated: 0 };

  try {
    const now = new Date().toISOString();
    let updated = 0;

    // Ambil semua purchase orders yang ada
    const { data: allPurchases } = await supabaseAdmin.from('purchases').select('*');
    const purchases = allPurchases || [];

    for (const pid of productIds) {
      const { data: prod } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('id', pid)
        .single();

      if (!prod) continue;

      const cost = Number(prod.cost_price || 0);
      if (cost <= 0) continue; // skip jika HPP 0

      let hasExistingPo = false;

      // 1. Update di riwayat PO yang sudah ada jika ada
      for (const po of purchases) {
        const poRaw = po.raw_data || {};
        const items = poRaw.items || [];
        let poUpdated = false;

        const newItems = items.map((it: any) => {
          if (it.productId === pid || it.product_id === pid || it.id === pid) {
            hasExistingPo = true;
            poUpdated = true;
            const qty = Number(it.quantity || it.qty || 1);
            return {
              ...it,
              unitPrice: cost,
              purchasePrice: cost,
              totalPrice: qty * cost,
            };
          }
          return it;
        });

        if (poUpdated) {
          const newTotal = newItems.reduce((acc: number, it: any) => acc + Number(it.totalPrice || ((it.quantity || 1) * (it.unitPrice || 0))), 0);
          await supabaseAdmin.from('purchases').update({
            total: newTotal,
            raw_data: {
              ...poRaw,
              total: newTotal,
              subtotal: newTotal,
              items: newItems,
              updatedAt: now,
            },
            updated_at: now,
          }).eq('id', po.id);
        }
      }

      // 2. Jika belum pernah ada PO sama sekali untuk produk ini, buat PO Saldo Awal resmi (Baseline)
      if (!hasExistingPo) {
        const stockQty = Math.max(1, Number(prod.stock || 1));
        const poNumber = `INIT-HPP-${Date.now().toString().slice(-6)}`;
        const poId = `po_init_${pid}_${Date.now()}`;
        const totalAmount = cost * stockQty;

        const initPoRaw = {
          poNumber,
          supplierId: 'baseline_initial',
          supplierName: 'SALDO AWAL (BASELINE HPP)',
          createdById: adminEmail,
          warehouseId: 'gudang-utama',
          notes: 'Inisialisasi Saldo Awal HPP untuk perhitungan Moving Average',
          status: 'RECEIVED',
          paymentStatus: 'LUNAS',
          paymentMethod: 'INITIAL_BALANCE',
          total: totalAmount,
          subtotal: totalAmount,
          items: [
            {
              id: `item_init_${pid}`,
              productId: pid,
              name: prod.name,
              unit: prod.unit || 'PCS',
              quantity: stockQty,
              unitPrice: cost,
              purchasePrice: cost,
              totalPrice: totalAmount,
            }
          ],
          createdAt: now,
          updatedAt: now,
          receivedAt: now,
        };

        await supabaseAdmin.from('purchases').insert({
          id: poId,
          total: totalAmount,
          raw_data: initPoRaw,
          created_at: now,
          updated_at: now,
        });
      }

      // 3. Catat audit log
      try {
        await supabaseAdmin.from('product_cost_logs').insert({
          productId: pid,
          productName: prod.name,
          oldCost: cost,
          newCost: cost,
          adminEmail,
          changeDate: now,
          notes: `Inisialisasi Baseline AVG PO = HPP Aktif (Rp ${cost.toLocaleString('id-ID')})`,
        });
      } catch (e) {
        console.warn('Audit log insert error:', e);
      }

      updated++;
    }

    revalidatePath('/admin/products/pricing-hpp');
    revalidatePath('/admin/products');
    revalidatePath('/admin/inventory');

    return { success: true, updated };
  } catch (err: any) {
    console.error('syncAvgPoToActiveHpp error:', err);
    return { success: false, updated: 0, error: err.message };
  }
}

/**
 * Bagi HPP produk secara bulk (Konversi CTN -> PCS dsb).
 * Ini akan membagi `cost_price` dan field modal lainnya dengan angka pembagi (divider),
 * mengunci HPP produk agar tidak tertimpa saat restart AVG,
 * dan mengoreksi riwayat PO.
 */
export async function bulkDivideHpp(
  productIds: string[],
  divider: number,
  adminEmail: string,
): Promise<{ success: boolean; updated: number; error?: string }> {
  if (!productIds.length || divider <= 1) return { success: true, updated: 0 };
  
  try {
    const now = new Date().toISOString();
    let updated = 0;

    // Pre-fetch all purchases to find historical POs to update
    const { data: allPurchases } = await supabaseAdmin.from('purchases').select('*');
    const purchases = allPurchases || [];

    for (const pid of productIds) {
      const { data: prod } = await supabaseAdmin
        .from('products')
        .select('raw_data, cost_price, name')
        .eq('id', pid)
        .single();

      if (!prod) continue;
      
      const oldCost = Number(prod.cost_price || 0);
      if (oldCost <= 0) continue; 

      // Divide and round to nearest whole number
      const newCost = Math.round(oldCost / divider);

      const existingRaw = prod.raw_data || {};
      const updatedRaw = {
        ...existingRaw,
        Modal: newCost,
        purchasePrice: newCost,
        costPrice: newCost,
        isHppLocked: true, // KUNCI HPP agar aman saat restart AVG!
        customHpp: newCost,
        customHppUpdatedAt: now,
        updatedAt: now,
      };

      const { error: upErr } = await supabaseAdmin
        .from('products')
        .update({
          cost_price: newCost,
          raw_data: updatedRaw,
          updated_at: now,
        })
        .eq('id', pid);

      if (!upErr) {
        updated++;
        // Log the change
        try {
          await supabaseAdmin.from('product_cost_logs').insert({
            productId: pid,
            productName: prod.name,
            oldCost,
            newCost,
            adminEmail,
            changeDate: now,
            notes: `Konversi HPP (Dibagi ${divider}) & Koreksi Histori PO [HPP Dikunci]`,
          });
        } catch (e) {
          console.warn('Failed to log cost change:', e);
        }

        // Koreksi riwayat PO agar AVG PO juga ikut turun akurat
        for (const po of purchases) {
          const poRaw = po.raw_data || {};
          const items = poRaw.items || [];
          let poUpdated = false;

          const newItems = items.map((it: any) => {
            if (it.productId === pid || it.product_id === pid || it.id === pid) {
              poUpdated = true;
              return {
                ...it,
                quantity: (Number(it.quantity || it.qty || 1)) * divider,
                qty: (Number(it.quantity || it.qty || 1)) * divider,
                unitPrice: Math.round(Number(it.unitPrice || it.purchasePrice || 0) / divider),
                purchasePrice: Math.round(Number(it.unitPrice || it.purchasePrice || 0) / divider),
              };
            }
            return it;
          });

          if (poUpdated) {
            await supabaseAdmin.from('purchases').update({
              raw_data: {
                ...poRaw,
                items: newItems,
              }
            }).eq('id', po.id);
          }
        }
      }
    }

    revalidatePath('/admin/products/pricing-hpp');
    revalidatePath('/admin/products');
    revalidatePath('/admin/inventory');
    
    return { success: true, updated };
  } catch (err: any) {
    console.error('bulkDivideHpp error:', err);
    return { success: false, updated: 0, error: err.message };
  }
}
