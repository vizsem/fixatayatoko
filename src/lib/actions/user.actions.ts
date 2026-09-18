'use server'

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function getUsers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((u: any) => {
      const raw = u.raw_data || {};
      return {
        id: u.id,
        name: u.name || raw.name || raw.displayName || u.email?.split('@')[0] || 'User',
        email: u.email || raw.email || '',
        role: u.role || raw.role || 'STAFF',
        createdAt: u.created_at ? new Date(u.created_at) : new Date(),
      };
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return [];
  }
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: 'OWNER' | 'ADMIN' | 'WAREHOUSE' | 'SALES' | 'DRIVER' | 'CASHIER' | 'SUPER_ADMIN';
}) {
  try {
    // Buat user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin?.createUser({
      email: data.email,
      password: data.password,
      user_metadata: { full_name: data.name, role: data.role },
      email_confirm: true,
    }) as any;

    if (authError) {
      // Fallback: simpan ke tabel users saja jika admin API tidak tersedia
      const now = new Date().toISOString();
      const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const { error: insertError } = await supabase.from('users').insert({
        id,
        name: data.name,
        email: data.email,
        role: data.role,
        raw_data: { name: data.name, email: data.email, role: data.role, createdAt: now },
        created_at: now,
        updated_at: now,
      });
      if (insertError) throw insertError;
      revalidatePath('/admin/users');
      return { success: true, data: { id, name: data.name, email: data.email, role: data.role } };
    }

    // Update tabel users dengan role
    if (authData?.user?.id) {
      const now = new Date().toISOString();
      await supabase.from('users').upsert({
        id: authData.user.id,
        name: data.name,
        email: data.email,
        role: data.role,
        raw_data: { name: data.name, email: data.email, role: data.role, createdAt: now },
        created_at: now,
        updated_at: now,
      });
    }

    revalidatePath('/admin/users');
    return {
      success: true,
      data: {
        id: authData?.user?.id || '',
        name: data.name,
        email: data.email,
        role: data.role,
      },
    };
  } catch (error) {
    console.error('Failed to create user:', error);
    return { success: false, error: 'Gagal membuat user' };
  }
}

export async function updateUser(id: string, data: {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
}) {
  try {
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('users')
      .select('raw_data')
      .eq('id', id)
      .single();

    const mergedRaw = {
      ...(existing?.raw_data || {}),
      ...(data.name ? { name: data.name } : {}),
      ...(data.email ? { email: data.email } : {}),
      ...(data.role ? { role: data.role } : {}),
      updatedAt: now,
    };

    const updatePayload: any = {
      raw_data: mergedRaw,
      updated_at: now,
    };
    if (data.name) updatePayload.name = data.name;
    if (data.email) updatePayload.email = data.email;
    if (data.role) updatePayload.role = data.role;

    const { error } = await supabase.from('users').update(updatePayload).eq('id', id);
    if (error) throw error;

    revalidatePath('/admin/users');
    return { success: true, data: { id, ...data } };
  } catch (error) {
    console.error('Failed to update user:', error);
    return { success: false, error: 'Gagal mengupdate user' };
  }
}

export async function deleteUser(id: string) {
  try {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;

    revalidatePath('/admin/users');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal menghapus user' };
  }
}
