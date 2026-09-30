'use server';

import { requireStaff } from '@/lib/actions/session';

import { supabaseAdmin } from '@/lib/supabase';
import { normalizeRow } from '@/lib/supabase-helpers';
import {
  buildOperationsMetrics,
  activeUserCutoffFrom,
  type OperationalMetric,
} from '@/lib/operations-metrics';

/**
 * Hitung metrik laporan operasional di server.
 *
 * Sebelumnya halaman `admin/reports/operations` mengunduh seluruh isi 7 tabel ke
 * browser lalu menghitung 8 angka di sana. Sekarang datanya dibaca dengan service
 * role di server dan yang dikirim ke klien hanya 8 baris metrik.
 *
 * Catatan: tabel `inventory_transactions` juga diambil oleh kode lama tetapi
 * **tidak pernah dipakai** dalam perhitungan mana pun, jadi tidak lagi di-query.
 *
 * Otorisasi: mengandalkan middleware `/admin/*` (lihat catatan di
 * `actions/stock-sync.actions.ts`).
 */
export async function getOperationsMetrics(): Promise<OperationalMetric[]> {
  await requireStaff();
  const [employeesRes, usersRes, warehousesRes, productsRes, ordersRes, expensesRes] =
    await Promise.all([
      supabaseAdmin.from('employees').select('*'),
      supabaseAdmin.from('users').select('*'),
      supabaseAdmin.from('warehouses').select('*'),
      // Setara dengan bridge: where('isActive', '==', true) -> kolom `is_active`
      supabaseAdmin.from('products').select('*').eq('is_active', true).limit(100),
      supabaseAdmin.from('orders').select('*'),
      supabaseAdmin.from('operational_expenses').select('*'),
    ]);

  const error =
    employeesRes.error ||
    usersRes.error ||
    warehousesRes.error ||
    productsRes.error ||
    ordersRes.error ||
    expensesRes.error;

  if (error) {
    throw new Error(`Gagal memuat data laporan operasional: ${error.message}`);
  }

  const rows = (res: { data: unknown }) =>
    ((res.data ?? []) as Record<string, any>[]).map(normalizeRow);

  return buildOperationsMetrics({
    employees: rows(employeesRes),
    users: rows(usersRes),
    warehouses: rows(warehousesRes),
    products: rows(productsRes),
    orders: rows(ordersRes),
    expenses: rows(expensesRes),
    activeUserCutoff: activeUserCutoffFrom(Date.now()),
  });
}
