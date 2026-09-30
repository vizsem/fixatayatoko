'use server';

import { revalidatePath } from 'next/cache';

import { supabaseAdmin } from '@/lib/supabase';
import { requireStaff } from '@/lib/actions/session';
import { describeDatabaseError } from '@/lib/actions/guard';
import { sbGetDoc, sbInsertDoc, sbUpdateDoc } from '@/lib/supabase-helpers';

/**
 * Aksi server untuk halaman detail pesanan (`admin/orders/[id]`).
 *
 * Halaman itu sebelumnya membaca dan menulis `orders`, `products`, `users`,
 * `settings`, `wallet_logs`, dan `returns` langsung dari browser. Di browser
 * klien tersebut jatuh ke kunci anon tanpa sesi pengguna, sehingga RLS
 * menolaknya dan setiap operasi gagal.
 *
 * Berbeda dari modul HR yang memakai fungsi generik ber-allowlist, di sini
 * setiap fungsi memakai TABEL TETAP. Karena tidak ada parameter nama tabel,
 * fungsi-fungsi ini tidak mungkin dipakai untuk menyentuh tabel lain — bahkan
 * bila pemanggilnya menyerahkan argumen yang aneh.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Ambil pesanan beserta pengaturan toko yang dipakai halaman ini. */
export async function getOrderDetail(id: string): Promise<
  ActionResult<{
    order: Record<string, unknown> | null;
    settings: Record<string, unknown> | null;
  }>
> {
  await requireStaff();

  try {
    const [orderDoc, settingsDoc] = await Promise.all([
      sbGetDoc('orders', id),
      sbGetDoc('settings', 'system'),
    ]);

    return {
      ok: true,
      data: {
        order: orderDoc.exists() ? { id: orderDoc.id, ...orderDoc.data() } : null,
        settings: settingsDoc.exists() ? settingsDoc.data() : null,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal memuat pesanan' };
  }
}

/** Ambil satu produk (mis. untuk menghitung perubahan stok). */
export async function getProductForOrder(
  id: string
): Promise<ActionResult<Record<string, unknown> | null>> {
  await requireStaff();
  try {
    const doc = await sbGetDoc('products', id);
    return { ok: true, data: doc.exists() ? { id: doc.id, ...doc.data() } : null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal memuat produk' };
  }
}

/** Perbarui sebagian data pesanan. */
export async function updateOrder(
  id: string,
  patch: Record<string, unknown>
): Promise<ActionResult> {
  await requireStaff();
  try {
    await sbUpdateDoc('orders', id, patch);
    revalidatePath(`/admin/orders/${id}`);
    return { ok: true, data: undefined };
  } catch (error) {
    const described = describeDatabaseError(error);
    return { ok: false, error: described.message };
  }
}

/** Perbarui sebagian data produk (stok, harga). */
export async function updateProductForOrder(
  id: string,
  patch: Record<string, unknown>
): Promise<ActionResult> {
  await requireStaff();
  try {
    await sbUpdateDoc('products', id, patch);
    return { ok: true, data: undefined };
  } catch (error) {
    const described = describeDatabaseError(error);
    return { ok: false, error: described.message };
  }
}

/**
 * Kembalikan dana ke dompet pelanggan secara ATOMIK.
 *
 * Versi lama membaca saldo dari browser, menjumlahkannya sendiri, lalu
 * menulis nilai absolut hasil hitungan itu. Dua masalah:
 *
 *   1. Baca-lalu-tulis dari klien kehilangan pembaruan bila dua admin
 *      mengembalikan dana hampir bersamaan.
 *   2. Karena pembacaan dilakukan klien tanpa sesi, RLS menolak dan saldo
 *      terbaca 0 — sehingga bila penulisan sempat berhasil, saldo pelanggan
 *      akan DITIMPA dengan nilai refund saja dan sisa saldonya hilang.
 *
 * Fungsi SQL `adjust_user_wallet` menambah nilai secara langsung di dalam
 * satu transaksi bersama baris ledger-nya.
 *
 * Catatan: penulisan ledger lama (`sbInsertDoc('wallet_logs', ...)`) juga
 * selalu gagal karena tabel itu tidak punya kolom `updated_at` sementara
 * `buildWritePayload` selalu menuliskannya. Kini ledger ditulis oleh fungsi
 * SQL tersebut, jadi tidak ada lagi penulisan terpisah.
 */
export async function creditWalletRefund(
  userId: string,
  amount: number,
  orderId: string
): Promise<ActionResult<{ newBalance: number }>> {
  await requireStaff();

  const nominal = Math.abs(Number(amount));
  if (!userId || userId === 'guest') {
    return { ok: false, error: 'Pesanan ini tidak terhubung ke akun pelanggan.' };
  }
  if (!Number.isFinite(nominal) || nominal <= 0) {
    return { ok: false, error: 'Nominal pengembalian tidak valid.' };
  }

  const { data, error } = await supabaseAdmin.rpc('adjust_user_wallet', {
    p_user_id: userId,
    p_delta: nominal,
    p_type: 'REFUND_STOCK',
    p_description: 'Pengembalian dana karena stok tidak sesuai',
    p_order_id: orderId,
  });

  if (error) {
    const described = describeDatabaseError(error);
    return { ok: false, error: described.message };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true, data: { newBalance: Number(data ?? 0) } };
}

/** Buat permintaan retur penjualan. */
export async function createReturnRequest(
  data: Record<string, unknown>
): Promise<ActionResult<{ id: string }>> {
  await requireStaff();
  try {
    const result = await sbInsertDoc('returns', data);
    return { ok: true, data: { id: result.id } };
  } catch (error) {
    const described = describeDatabaseError(error);
    return { ok: false, error: described.message };
  }
}
