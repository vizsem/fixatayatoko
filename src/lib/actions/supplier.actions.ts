'use server';

import { requireAdmin, requireStaff } from '@/lib/actions/session';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';

export interface SupplierEntity {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  category?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankAccountName?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  createdAt: Date;
  _count: {
    purchaseOrders: number;
    totalSpent: number;
  };
}

export async function getSuppliers(): Promise<SupplierEntity[]> {
  await requireStaff();
  try {
    const [suppliersRes, purchasesRes] = await Promise.all([
      supabaseAdmin
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('purchases')
        .select('id, raw_data')
    ]);

    const rows = suppliersRes.data || [];
    const purchases = purchasesRes.data || [];

    // Hitung riwayat PO & Total Pembelian per Supplier
    const poCountMap = new Map<string, number>();
    const totalSpentMap = new Map<string, number>();

    purchases.forEach((p: any) => {
      const raw = p.raw_data || {};
      const sId = raw.supplierId || raw.supplier?.id;
      const sName = (raw.supplierName || raw.supplier?.name || '').trim().toLowerCase();
      const total = Number(raw.total || raw.totalAmount || 0);

      if (sId) {
        poCountMap.set(sId, (poCountMap.get(sId) || 0) + 1);
        totalSpentMap.set(sId, (totalSpentMap.get(sId) || 0) + total);
      }
      if (sName) {
        poCountMap.set(sName, (poCountMap.get(sName) || 0) + 1);
        totalSpentMap.set(sName, (totalSpentMap.get(sName) || 0) + total);
      }
    });

    return rows.map((s: any) => {
      const raw = s.raw_data || {};
      const sNameKey = (s.name || raw.name || raw.supplierName || '').trim().toLowerCase();
      
      const countById = poCountMap.get(s.id) || 0;
      const countByName = sNameKey ? (poCountMap.get(sNameKey) || 0) : 0;
      const poCount = Math.max(countById, countByName);

      const spentById = totalSpentMap.get(s.id) || 0;
      const spentByName = sNameKey ? (totalSpentMap.get(sNameKey) || 0) : 0;
      const totalSpent = Math.max(spentById, spentByName);

      return {
        id: s.id,
        name: s.name || raw.name || raw.supplierName || 'Supplier',
        contactPerson: s.contact || raw.contactPerson || raw.contact || null,
        phone: raw.phone || raw.telepon || null,
        email: raw.email || null,
        address: raw.address || raw.alamat || null,
        category: raw.category || null,
        bankName: raw.bankName || null,
        bankAccount: raw.bankAccount || null,
        bankAccountName: raw.bankAccountName || null,
        paymentTerms: raw.paymentTerms || null,
        notes: raw.notes || null,
        createdAt: s.created_at ? new Date(s.created_at) : new Date(),
        _count: {
          purchaseOrders: poCount,
          totalSpent: totalSpent
        }
      };
    });
  } catch (error) {
    console.error('Failed to fetch suppliers:', error);
    return [];
  }
}

export async function getSupplierById(id: string) {
  await requireStaff();
  try {
    const { data, error } = await supabaseAdmin.from('suppliers').select('*').eq('id', id).single();
    if (error || !data) return null;
    const raw = data.raw_data || {};
    return {
      id: data.id,
      name: data.name || raw.name || raw.supplierName || 'Supplier',
      contactPerson: data.contact || raw.contactPerson || null,
      phone: raw.phone || null,
      email: raw.email || null,
      address: raw.address || null,
      category: raw.category || null,
      bankName: raw.bankName || null,
      bankAccount: raw.bankAccount || null,
      bankAccountName: raw.bankAccountName || null,
      paymentTerms: raw.paymentTerms || null,
      notes: raw.notes || null,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(),
    };
  } catch {
    return null;
  }
}

export async function createSupplier(data: {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  bankName?: string;
  bankAccount?: string;
  bankAccountName?: string;
  paymentTerms?: string;
  notes?: string;
}) {
  await requireAdmin();
  try {
    const id = `sup_${Date.now()}`;
    const raw_data = {
      name: data.name,
      contactPerson: data.contactPerson || '',
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      category: data.category || '',
      bankName: data.bankName || '',
      bankAccount: data.bankAccount || '',
      bankAccountName: data.bankAccountName || '',
      paymentTerms: data.paymentTerms || '',
      notes: data.notes || '',
      createdAt: new Date().toISOString()
    };

    const { error } = await supabaseAdmin.from('suppliers').insert({
      id,
      name: data.name,
      contact: data.contactPerson || null,
      raw_data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    if (error) {
      console.error('Failed to create supplier in supabaseAdmin:', error);
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
  name?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  bankName?: string;
  bankAccount?: string;
  bankAccountName?: string;
  paymentTerms?: string;
  notes?: string;
}) {
  await requireAdmin();
  try {
    const { data: existing } = await supabaseAdmin.from('suppliers').select('*').eq('id', id).single();
    if (!existing) return { success: false, error: 'Supplier tidak ditemukan' };

    const updatedRaw = {
      ...(existing.raw_data || {}),
      ...data,
      updatedAt: new Date().toISOString()
    };

    const { error } = await supabaseAdmin.from('suppliers').update({
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
  await requireAdmin();
  try {
    const { error } = await supabaseAdmin.from('suppliers').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/admin/suppliers');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete supplier:', error);
    return { success: false, error: 'Gagal menghapus supplier' };
  }
}
