'use server';

import { requireStaff } from '@/lib/actions/session';

import { supabaseAdmin } from '@/lib/supabase';
import { normalizeRow } from '@/lib/supabase-helpers';
import { buildSyncMatrix, type StockSyncRow } from '@/lib/stock-sync-matrix';

/**
 * Ambil matriks sinkronisasi stok untuk halaman Sync Monitor.
 *
 * Sebelumnya ketiga tabel ini dibaca langsung dari browser (`sbGetDocs`) memakai
 * kunci anon. Sekarang dibaca di server dengan service role, lalu hanya hasil
 * akhirnya yang dikirim ke klien — sehingga:
 *   - tidak perlu memberi akses `anon` ke `products` / `warehouses` / `warehouseStock`
 *   - payload yang dikirim jauh lebih kecil (matriks, bukan seluruh tabel mentah)
 *   - perhitungannya bisa diuji (lihat src/lib/stock-sync-matrix.ts)
 *
 * Otorisasi: action ini disimpan di bawah route `/admin/*`, sehingga middleware
 * (NextAuth JWT / cookie `admin-token`) tetap berjalan saat action dipanggil.
 * ⚠️ Belum ada pemeriksaan peran di dalam action — ini celah yang berlaku di
 * SELURUH `src/lib/actions/*` dan menjadi bagian Fase 1 berikutnya
 * (butuh klien Supabase yang sadar-cookie untuk membaca sesi di server).
 */
export async function getStockSyncMatrix(): Promise<StockSyncRow[]> {
  await requireStaff();
  const [productsRes, warehousesRes, stockRes] = await Promise.all([
    supabaseAdmin.from('products').select('*'),
    supabaseAdmin.from('warehouses').select('*'),
    supabaseAdmin.from('warehouseStock').select('*'),
  ]);

  const error = productsRes.error || warehousesRes.error || stockRes.error;
  if (error) {
    throw new Error(`Gagal memuat data sinkronisasi: ${error.message}`);
  }

  return buildSyncMatrix(
    (productsRes.data ?? []).map(normalizeRow),
    (warehousesRes.data ?? []).map(normalizeRow),
    (stockRes.data ?? []).map(normalizeRow)
  );
}
