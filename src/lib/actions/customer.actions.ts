'use server';

import { revalidatePath } from 'next/cache';

import { supabaseAdmin } from '@/lib/supabase';
import { requireStaff } from '@/lib/actions/session';

/**
 * Aksi server untuk data pelanggan.
 *
 * CATATAN PERBAIKAN (2026-10-01)
 * Seluruh fungsi di berkas ini sebelumnya memakai klien `supabase` (kunci
 * anon). Di server, klien itu tidak membawa sesi pengguna, sehingga RLS
 * memperlakukannya sebagai `anon` dan menolak akses ke tabel `customers` —
 * daftar pelanggan selalu kosong dan penyimpanan selalu gagal.
 *
 * Karena itu dipakai `supabaseAdmin` (kunci service role) yang memang
 * tersedia di server, dengan syarat setiap fungsi memverifikasi peran
 * pemanggilnya lebih dulu lewat `requireStaff()`. Tanpa syarat itu, berkas ini
 * akan menjadi jalur tanpa otorisasi ke seluruh data pelanggan.
 */

export interface CustomerSummary {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  type: string;
  totalOrders: number;
  totalSpent: number;
  points: number;
  walletBalance: number;
  createdAt: Date;
  _count: { salesOrders: number };
}

interface CustomerRow extends Record<string, unknown> {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  type?: string;
  total_orders?: number;
  total_spent?: number;
  points?: number;
  wallet_balance?: number;
  created_at?: string;
  raw_data?: Record<string, unknown>;
}

function toSummary(row: CustomerRow): CustomerSummary {
  const raw = (row.raw_data ?? {}) as Record<string, unknown>;
  const pick = (a: unknown, b: unknown, c?: unknown) => a ?? b ?? c ?? null;

  return {
    id: String(row.id),
    name: String(pick(row.name, raw.name, raw.Nama) ?? 'Pelanggan'),
    phone: (pick(row.phone, raw.phone, raw.HP) as string | null) ?? null,
    email: (pick(row.email, raw.email) as string | null) ?? null,
    address: (pick(row.address, raw.address, raw.Alamat) as string | null) ?? null,
    type: String(pick(row.type, raw.type) ?? 'RETAIL'),
    totalOrders: Number(row.total_orders ?? raw.totalOrders ?? 0),
    totalSpent: Number(row.total_spent ?? raw.totalSpent ?? 0),
    points: Number(row.points ?? raw.points ?? 0),
    walletBalance: Number(row.wallet_balance ?? raw.walletBalance ?? 0),
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    _count: { salesOrders: Number(row.total_orders ?? raw.totalOrders ?? 0) },
  };
}

export async function getCustomers(): Promise<CustomerSummary[]> {
  await requireStaff();
  try {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => toSummary(row as CustomerRow));
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    return [];
  }
}

export async function getCustomerById(id: string): Promise<CustomerSummary | null> {
  await requireStaff();
  try {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return toSummary(data as CustomerRow);
  } catch (error) {
    console.error('Failed to fetch customer:', error);
    return null;
  }
}

/** Bentuk data yang dipakai halaman edit pelanggan. */
export interface CustomerEditData {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  type: string;
  creditLimit: number;
  notes: string;
}

export async function getCustomerForEdit(id: string): Promise<CustomerEditData | null> {
  await requireStaff();
  try {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;

    const raw = ((data as CustomerRow).raw_data ?? {}) as Record<string, unknown>;
    const text = (v: unknown) => (v === null || v === undefined ? '' : String(v));

    return {
      id: String((data as CustomerRow).id),
      name: text((data as CustomerRow).name ?? raw.name),
      phone: text((data as CustomerRow).phone ?? raw.phone),
      email: text((data as CustomerRow).email ?? raw.email),
      address: text((data as CustomerRow).address ?? raw.address),
      type: text((data as CustomerRow).type ?? raw.type) || 'ecer',
      creditLimit: Number(raw.creditLimit ?? 0),
      notes: text(raw.notes),
    };
  } catch (error) {
    console.error('Failed to fetch customer for edit:', error);
    return null;
  }
}

/**
 * Simpan perubahan pelanggan.
 *
 * `raw_data` digabung dengan isi sebelumnya supaya kunci yang tidak dikirim
 * formulir (mis. `createdAt`, `totalOrders`) tidak ikut hilang.
 */
export async function saveCustomer(
  id: string,
  data: {
    name: string;
    phone: string;
    email: string;
    address: string;
    type: string;
    creditLimit: number;
    notes: string;
  }
): Promise<{ success: boolean; error?: string }> {
  await requireStaff();

  if (!id) return { success: false, error: 'ID pelanggan tidak valid' };

  try {
    const now = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from('customers')
      .select('raw_data')
      .eq('id', id)
      .maybeSingle();

    const mergedRaw = {
      ...((existing as CustomerRow | null)?.raw_data ?? {}),
      ...data,
      updatedAt: now,
    };

    const { error } = await supabaseAdmin
      .from('customers')
      .update({
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        raw_data: mergedRaw,
        updated_at: now,
      })
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/admin/customers');
    revalidatePath(`/admin/customers/edit/${id}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to save customer:', error);
    return { success: false, error: 'Gagal memperbarui data pelanggan' };
  }
}

export async function createCustomer(data: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  type?: string;
}) {
  await requireStaff();
  try {
    const now = new Date().toISOString();
    const id = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const { error } = await supabaseAdmin.from('customers').insert({
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
  await requireStaff();
  try {
    const now = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from('customers')
      .select('raw_data')
      .eq('id', id)
      .maybeSingle();

    const mergedRaw = {
      ...((existing as CustomerRow | null)?.raw_data ?? {}),
      ...data,
      updatedAt: now,
    };

    const { error } = await supabaseAdmin
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
  await requireStaff();
  try {
    const { error } = await supabaseAdmin.from('customers').delete().eq('id', id);
    if (error) throw error;

    revalidatePath('/admin/customers');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete customer:', error);
    return { success: false, error: 'Gagal menghapus pelanggan' };
  }
}
