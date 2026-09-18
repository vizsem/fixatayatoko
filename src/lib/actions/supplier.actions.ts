'use server'

import { revalidatePath } from 'next/cache'
import { supabase } from '@/lib/supabase'

export async function getSuppliers() {
  try {
    const { data: rows, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !rows) return [];

    return rows.map((s: any) => {
      const raw = s.raw_data || {};
      return {
        id: s.id,
        name: s.name || raw.name || raw.supplierName || 'Supplier',
        contactPerson: s.contact || raw.contactPerson || raw.contact || null,
        phone: raw.phone || raw.telepon || null,
        email: raw.email || null,
        address: raw.address || raw.alamat || null,
        createdAt: s.created_at ? new Date(s.created_at) : new Date(),
        _count: { purchaseOrders: 0, products: 0 }
      };
    });
  } catch (error) {
    console.error('Failed to fetch suppliers:', error);
    return [];
  }
}

export async function getSupplierById(id: string) {
  try {
    const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).single();
    if (error || !data) return null;
    const raw = data.raw_data || {};
    return {
      id: data.id,
      name: data.name || raw.name || raw.supplierName || 'Supplier',
      contactPerson: data.contact || raw.contactPerson || null,
      phone: raw.phone || null,
      email: raw.email || null,
      address: raw.address || null,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(),
    };
  } catch {
    return null;
  }
}

export async function createSupplier(data: {
  name: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
}) {
  try {
    const id = `sup_${Date.now()}`;
    const raw_data = {
      name: data.name,
      contactPerson: data.contactPerson || '',
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      createdAt: new Date().toISOString()
    };

    const { error } = await supabase.from('suppliers').insert({
      id,
      name: data.name,
      contact: data.contactPerson || null,
      raw_data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    if (error) {
      console.error('Failed to create supplier in supabase:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/suppliers');
    return { success: true, data: { id, ...data, createdAt: new Date() } };
  } catch (error) {
    console.error('Failed to create supplier:', error);
    return { success: false, error: 'Gagal membuat supplier' };
  }
}

export async function updateSupplier(id: string, data: {
  name?: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
}) {
  try {
    const { data: existing } = await supabase.from('suppliers').select('*').eq('id', id).single();
    if (!existing) return { success: false, error: 'Supplier tidak ditemukan' };

    const updatedRaw = {
      ...(existing.raw_data || {}),
      ...data,
      updatedAt: new Date().toISOString()
    };

    const { error } = await supabase.from('suppliers').update({
      name: data.name ?? existing.name,
      contact: data.contactPerson ?? existing.contact,
      raw_data: updatedRaw,
      updated_at: new Date().toISOString()
    }).eq('id', id);

    if (error) throw error;

    revalidatePath('/admin/suppliers');
    return { success: true, data: { id, ...data } };
  } catch (error) {
    console.error('Failed to update supplier:', error);
    return { success: false, error: 'Gagal mengupdate supplier' };
  }
}

export async function deleteSupplier(id: string) {
  try {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/admin/suppliers');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete supplier:', error);
    return { success: false, error: 'Gagal menghapus supplier' };
  }
}
