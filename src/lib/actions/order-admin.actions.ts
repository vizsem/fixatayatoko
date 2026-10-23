'use server';

import { revalidatePath } from 'next/cache';

import { supabaseAdmin } from '@/lib/supabase';
import { requireStaff } from '@/lib/actions/session';
import { describeDatabaseError } from '@/lib/actions/guard';
import { toPlainRow } from '@/lib/db-schema';
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
        // `toPlainRow` wajib: baris memuat `createdAt` bergaya Firestore yang
        // berisi FUNGSI, dan serializer Server Action menolaknya (React #441).
        order: orderDoc.exists() ? toPlainRow({ id: orderDoc.id, ...orderDoc.data() }) : null,
        settings: settingsDoc.exists() ? toPlainRow(settingsDoc.data()) : null,
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
    return { ok: true, data: doc.exists() ? toPlainRow({ id: doc.id, ...doc.data() }) : null };
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

export type PrintOrderData = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  items: Array<{
    productId?: string;
    name: string;
    quantity: number;
    price: number;
    unit?: string;
  }>;
  total: number;
  subtotal?: number;
  shippingCost?: number;
  discount?: number;
  voucher?: number;
  pointsUsed?: number;
  walletUsed?: number;
  status: string;
  paymentMethod: string;
  deliveryMethod?: string;
  deliveryAddress?: string;
  createdAt: string | null;
  dueDate?: string;
  notes?: string;
  channel?: string;
  storeSettings: {
    name: string;
    address: string;
    phone: string;
    email?: string;
    footerMsg?: string;
    logoUrl?: string;
  };
};

/** Ambil data pesanan dan profil toko secara aman di server untuk dicetak (A4 / Thermal) */
export async function getOrderForPrint(id: string): Promise<ActionResult<PrintOrderData>> {
  await requireStaff();

  try {
    const cleanId = decodeURIComponent(id || '').trim();
    if (!cleanId) {
      return { ok: false, error: 'ID pesanan tidak valid' };
    }

    // 1. Cari pesanan di tabel `orders`
    let orderRow: any = null;
    const { data: byId } = await supabaseAdmin.from('orders').select('*').eq('id', cleanId).maybeSingle();
    if (byId) {
      orderRow = byId;
    } else {
      const { data: byOrderId } = await supabaseAdmin.from('orders').select('*').eq('order_id', cleanId).maybeSingle();
      if (byOrderId) {
        orderRow = byOrderId;
      } else {
        const { data: byRawOrderId } = await supabaseAdmin
          .from('orders')
          .select('*')
          .filter('raw_data->>orderId', 'eq', cleanId)
          .maybeSingle();
        if (byRawOrderId) {
          orderRow = byRawOrderId;
        } else {
          const { data: byRawExtId } = await supabaseAdmin
            .from('orders')
            .select('*')
            .filter('raw_data->>externalOrderId', 'eq', cleanId)
            .maybeSingle();
          orderRow = byRawExtId;
        }
      }
    }

    if (!orderRow) {
      return { ok: false, error: `Pesanan dengan ID "${cleanId}" tidak ditemukan` };
    }

    // 2. Ambil profil toko dari tabel `settings`
    const { data: settingsRow } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('key', 'system')
      .maybeSingle();

    const raw = (orderRow.raw_data && typeof orderRow.raw_data === 'object') ? orderRow.raw_data : {};
    const s = (settingsRow?.value && typeof settingsRow.value === 'object') ? settingsRow.value : {};

    const rawItems = Array.isArray(orderRow.items)
      ? orderRow.items
      : (Array.isArray(raw.items) ? raw.items : []);

    const items = rawItems.map((item: any) => ({
      productId: String(item.productId || item.id || ''),
      name: String(item.name || item.product?.name || item.title || 'Produk'),
      quantity: Number(item.quantity || item.qty || 1),
      price: Number(item.price || item.unitPrice || 0),
      unit: item.unit ? String(item.unit) : undefined,
    }));

    const orderNumber = String(orderRow.order_id || raw.orderId || orderRow.id || cleanId);

    const result: PrintOrderData = {
      id: String(orderRow.id),
      orderNumber,
      customerName: String(orderRow.customer_name || raw.customerName || 'Pelanggan'),
      customerPhone: raw.customerPhone || raw.phone || undefined,
      items,
      total: Number(orderRow.total ?? raw.total ?? 0),
      subtotal: raw.subtotal !== undefined ? Number(raw.subtotal) : undefined,
      shippingCost: raw.shippingCost !== undefined ? Number(raw.shippingCost) : undefined,
      discount: raw.discount !== undefined ? Number(raw.discount) : undefined,
      voucher: raw.voucher !== undefined ? Number(raw.voucher) : undefined,
      pointsUsed: raw.pointsUsed !== undefined ? Number(raw.pointsUsed) : undefined,
      walletUsed: raw.walletUsed !== undefined ? Number(raw.walletUsed) : undefined,
      status: String(orderRow.status || raw.status || 'SELESAI'),
      paymentMethod: String(raw.paymentMethod || 'TUNAI'),
      deliveryMethod: raw.deliveryMethod ? String(raw.deliveryMethod) : undefined,
      deliveryAddress: raw.deliveryAddress ? String(raw.deliveryAddress) : undefined,
      createdAt: orderRow.created_at ? String(orderRow.created_at) : (raw.createdAt ? String(raw.createdAt) : null),
      dueDate: raw.dueDate ? String(raw.dueDate) : undefined,
      notes: raw.notes ? String(raw.notes) : (orderRow.notes ? String(orderRow.notes) : undefined),
      channel: raw.source ? String(raw.source) : (raw.channel ? String(raw.channel) : undefined),
      storeSettings: {
        name: String(s.name || 'ATAYATOKO').toUpperCase(),
        address: String(s.address || 'Jl. Pandan 98, Semen, Kediri'),
        phone: String(s.phone || '0858-5316-1174'),
        email: s.email ? String(s.email) : 'atayatoko2@gmail.com',
        footerMsg: s.footerMsg ? String(s.footerMsg) : 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan',
        logoUrl: s.logoUrl ? String(s.logoUrl) : undefined,
      },
    };

    return {
      ok: true,
      data: toPlainRow(result) as PrintOrderData,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal memuat pesanan untuk dicetak' };
  }
}

