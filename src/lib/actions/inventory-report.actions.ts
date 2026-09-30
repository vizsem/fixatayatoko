'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { normalizeRow } from '@/lib/supabase-helpers';
import { getProducts } from '@/lib/actions/product.actions';
import {
  buildInventoryReport,
  type InventoryReportResult,
} from '@/lib/inventory-report';

/**
 * Laporan valuasi & perputaran stok untuk `admin/reports/inventory`.
 *
 * Sebelumnya halaman ini membaca `inventory_transactions` dan `warehouses`
 * langsung dari browser, lalu menghitungnya di klien. Sekarang seluruhnya
 * dihitung di server; klien hanya menerima hasil akhirnya.
 *
 * Produk diambil lewat Server Action `getProducts` yang sudah ada, sehingga
 * bentuk data (sudah dinormalisasi) identik dengan yang diterima halaman
 * sebelumnya — tidak ada perubahan bentuk di sisi klien.
 *
 * Otorisasi: mengandalkan middleware `/admin/*` (lihat catatan di
 * `actions/stock-sync.actions.ts`).
 */
export async function getInventoryReport(): Promise<InventoryReportResult> {
  const products = await getProducts({ isActive: true, orderByField: 'name' });

  const [transactionsRes, warehousesRes] = await Promise.all([
    supabaseAdmin.from('inventory_transactions').select('*'),
    supabaseAdmin.from('warehouses').select('*'),
  ]);

  const error = transactionsRes.error || warehousesRes.error;
  if (error) {
    throw new Error(`Gagal memuat data inventori: ${error.message}`);
  }

  return buildInventoryReport(
    products as unknown as Record<string, any>[],
    (transactionsRes.data ?? []).map(normalizeRow),
    (warehousesRes.data ?? []).map(normalizeRow)
  );
}
