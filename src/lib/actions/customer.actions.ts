'use server'

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function getCustomers() {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((c: any) => {
      const raw = c.raw_data || {};
      return {
        id: c.id,
        name: c.name || raw.name || raw.Nama || 'Pelanggan',
        phone: c.phone || raw.phone || raw.HP || null,
        email: c.email || raw.email || null,
        address: c.address || raw.address || raw.Alamat || null,
        type: c.type || raw.type || 'RETAIL',
        totalOrders: Number(c.total_orders || raw.totalOrders || 0),
        totalSpent: Number(c.total_spent || raw.totalSpent || 0),
        points: Number(c.points || raw.points || 0),
        walletBalance: Number(c.wallet_balance || raw.walletBalance || 0),
        createdAt: c.created_at ? new Date(c.created_at) : new Date(),
        _count: { salesOrders: Number(c.total_orders || raw.totalOrders || 0) },
      };
    });
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    return [];
  }
}

export async function getCustomerById(id: string) {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    const raw = data.raw_data || {};
    return {
      id: data.id,
      name: data.name || raw.name || 'Pelanggan',
      phone: data.phone || raw.phone || null,
      email: data.email || raw.email || null,
      address: data.address || raw.address || null,
      type: data.type || raw.type || 'RETAIL',
      points: Number(data.points || raw.points || 0),
      walletBalance: Number(data.wallet_balance || raw.walletBalance || 0),
      createdAt: data.created_at ? new Date(data.created_at) : new Date(),
      salesOrders: [],
    };
  } catch (error) {
    console.error('Failed to fetch customer:', error);
    return null;
  }
}

export async function createCustomer(data: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  type?: string;
}) {
  try {
    const now = new Date().toISOString();
    const id = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const { error } = await supabase.from('customers').insert({
      id,
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      raw_data: {
        ...data,
        createdAt: now,
        updatedAt: now,
        points: 0,
        walletBalance: 0,
        totalOrders: 0,
        totalSpent: 0,
      },
      created_at: now,
      updated_at: now,
    });

    if (error) throw error;

    revalidatePath('/admin/customers');
    return { success: true, data: { id, ...data } };
  } catch (error) {
    console.error('Failed to create customer:', error);
    return { success: false, error: 'Gagal membuat pelanggan' };
  }
}

export async function updateCustomer(id: string, data: {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  type?: string;
}) {
  try {
    const now = new Date().toISOString();

    // Fetch existing raw_data
    const { data: existing } = await supabase
      .from('customers')
      .select('raw_data')
      .eq('id', id)
      .single();

    const mergedRaw = { ...(existing?.raw_data || {}), ...data, updatedAt: now };

    const { error } = await supabase
      .from('customers')
      .update({
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        raw_data: mergedRaw,
        updated_at: now,
      })
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/admin/customers');
    return { success: true, data: { id, ...data } };
  } catch (error) {
    console.error('Failed to update customer:', error);
    return { success: false, error: 'Gagal mengupdate pelanggan' };
  }
}

export async function deleteCustomer(id: string) {
  try {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;

    revalidatePath('/admin/customers');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete customer:', error);
    return { success: false, error: 'Gagal menghapus pelanggan' };
  }
}
