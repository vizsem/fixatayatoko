// lib/productService.ts - Rewritten for Supabase
import { supabase } from '@/lib/supabase';
import { Product } from './types';

import { query } from '@/lib/firebase';
// ✅ Membuat Produk Baru
export async function createProduct(product: Omit<Product, 'id'>): Promise<string> {
  const payload: any = { ...product };
  // Remove undefined ID so Supabase generates one
  if (!payload.ID) delete payload.ID;

  const { data, error } = await supabase
    .from('products')
    .insert(payload)
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// ✅ Mengambil Satu Produk
export async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return { id: data.id, ...data } as Product;
}

// ✅ Update Produk (Mendukung Partial Update)
export async function updateProduct(id: string, product: Partial<Product>): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ ...product, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

// ✅ Hapus Produk
export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ✅ Ambil Semua Produk (Bisa difilter yang aktif saja)
export async function getProducts(onlyActive = false): Promise<Product[]> {
  let query = supabase.from('products').select('*');

  if (onlyActive) {
    query = query.eq('Status', 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Product[];
}

// ✅ Ambil Produk Berdasarkan Parent_ID (Untuk Variasi)
export async function getProductVariations(parentId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('Parent_ID', parentId);

  if (error) throw error;
  return (data || []) as Product[];
}
