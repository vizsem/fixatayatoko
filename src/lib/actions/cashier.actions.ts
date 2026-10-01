'use server'

import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/lib/actions/session'
import { supabaseAdmin } from '@/lib/supabase'
import { addStock, deductStockFEFO } from '@/lib/inventory'
import { cariContainsSatuan, nilaiSnapshotHpp } from '@/lib/hpp'

/**
 * Penyimpanan transaksi KASIR — dipindahkan dari peramban ke server.
 *
 * MENGAPA
 * -------
 * Halaman kasir (`src/app/cashier/page.tsx`) sebelumnya menyimpan sendiri ke
 * Supabase dengan `supabaseAdmin` DI BROWSER. Klien itu dibuat memakai publishable
 * key TANPA sesi, jadi setiap permintaannya berjalan sebagai `anon` dan ditolak
 * RLS. Akibatnya, sejak aplikasi pindah ke Supabase:
 *
 *   - pemotongan stok gagal  -> transaksi berhenti dengan pesan error,
 *   - baris `orders` tidak pernah masuk (terbukti: 0 order ber-`source: CASHIER`,
 *     dan order offline terakhir di database masih dari era Firestore),
 *   - kegagalannya sebagian hanya `console.warn` — tidak terlihat siapa pun.
 *
 * Sekarang seluruh penulisan terjadi di server: stok dipotong lewat
 * `deductStockFEFO` (service role), order disimpan lengkap dengan SNAPSHOT modal
 * per pcs (lihat `src/lib/hpp.ts`), dompet & jurnal ikut dicatat, dan
 * kegagalan MENGEMBALIKAN stok yang sudah terpotong supaya tidak ada stok hilang.
 */

export type ItemKasirInput = {
  id: string
  name?: string
  price?: number
  quantity: number
  unit?: string
  contains?: number
  /** Diabaikan: modal SELALU dihitung ulang di server dari master produk. */
  cost?: number
}

export type TransaksiKasirInput = {
  orderId: string
  items: ItemKasirInput[]
  subtotal: number
  shippingCost?: number
  total: number
  paymentMethod: string
  paymentProofUrl?: string | null
  transactionType?: string
  deliveryMethod?: string
  status?: string
  dueDate?: string | null
  customerName?: string
  customerPhone?: string
  userId?: string | null
  payAmount?: number
  changeAmount?: number
  shiftId?: string | null
  warehouseId: string
  warehouseName?: string
}

export type TransaksiKasirResult = {
  success: boolean
  error?: string
  data?: {
    orderId: string
    items: Array<{ productId: string; newStock: number; newStockByWarehouse: Record<string, number> }>
    hppTotal: number
    itemTanpaModal: number
  }
}

/** Batas aman jumlah baris item dalam satu transaksi kasir. */
const MAKS_ITEM = 200

export async function simpanTransaksiKasir(data: TransaksiKasirInput): Promise<TransaksiKasirResult> {
  await requireStaff()
  try {
    const orderId = String(data?.orderId || '').trim()
    const items = Array.isArray(data?.items) ? data.items : []

    if (!orderId) return { success: false, error: 'orderId tidak valid' }
    if (items.length === 0) return { success: false, error: 'Keranjang kosong' }
    if (items.length > MAKS_ITEM) return { success: false, error: `Terlalu banyak item (maks ${MAKS_ITEM})` }

    const warehouseId = data.warehouseId || 'gudang-utama'
    const now = new Date().toISOString()

    // 1. Produk dibaca dari basis data — nama, isi satuan, dan MODAL tidak
    //    dipercaya dari klien.
    const ids = Array.from(new Set(items.map((it) => String(it.id || '')).filter(Boolean)))
    const { data: produkRows, error: produkErr } = await supabaseAdmin
      .from('products')
      .select('id, name, unit, cost_price, raw_data')
      .in('id', ids)

    if (produkErr) return { success: false, error: produkErr.message }

    const produkMap = new Map((produkRows || []).map((p: any) => [String(p.id), p]))

    const itemSiap = items.map((it) => {
      const produk: any = produkMap.get(String(it.id))
      const raw = produk?.raw_data || {}

      const containsKlien = Number(it.contains || 0)
      const contains = containsKlien > 0
        ? containsKlien
        : cariContainsSatuan(it.unit ?? produk?.unit, raw.units)

      const quantity = Number(it.quantity || 0)
      const baseQuantity = Math.max(0, Math.round(quantity * contains))

      const snapshot = nilaiSnapshotHpp({
        // Daftar field ditulis EXPLISIT dan `cost` kiriman klien sengaja TIDAK
        // diteruskan: kalau diteruskan, `hpp.ts` akan memperlakukannya sebagai
        // snapshot dan modal dari klien menang atas master produk.
        item: {
          id: it.id,
          price: it.price,
          quantity,
          unit: it.unit,
          contains,
          baseQuantity,
        },
        produk: produk ? { cost_price: produk.cost_price, raw_data: produk.raw_data } : undefined,
      })

      return {
        id: String(it.id),
        name: produk?.name || it.name || `Produk ${it.id}`,
        price: Number(it.price || 0),
        quantity,
        unit: it.unit || produk?.unit || 'PCS',
        contains,
        baseQuantity,
        hppPerPcs: snapshot.hppPerPcs,
        hppTotal: snapshot.hppTotal,
        itemTanpaModal: snapshot.sumber === 'ESTIMASI',
      }
    })

    const tidakValid = itemSiap.filter((it) => !(it.quantity > 0) || it.baseQuantity <= 0)
    if (tidakValid.length > 0) {
      return { success: false, error: `Jumlah item tidak valid: ${tidakValid.map((i) => i.name).join(', ')}` }
    }

    // 2. Potong stok. Kalau ada yang gagal di tengah jalan, yang sudah terpotong
    //    dikembalikan supaya stok tidak berkurang tanpa transaksi.
    const terpotong: Array<{ productId: string; amount: number }> = []
    const hasilDeduction: Array<{
      productId: string
      newStock: number
      newStockByWarehouse: Record<string, number>
    }> = []

    const kembalikanStok = async () => {
      for (const t of terpotong) {
        try {
          await addStock({
            productId: t.productId,
            amount: t.amount,
            warehouseId,
            reference: orderId,
            notes: `Pengembalian otomatis — transaksi kasir ${orderId} gagal disimpan`,
            source: 'CASHIER',
          })
        } catch (e: any) {
          console.error(`Gagal mengembalikan stok ${t.productId}:`, e?.message || e)
        }
      }
    }

    for (const item of itemSiap) {
      const res = await deductStockFEFO({
        productId: item.id,
        amount: item.baseQuantity,
        warehouseId,
        reference: orderId,
        notes: `Transaksi Kasir (${data.paymentMethod}) - ${item.quantity} ${item.unit}${data.warehouseName ? ` [Gudang: ${data.warehouseName}]` : ''}`,
        source: 'CASHIER',
        adminId: data.userId || undefined,
      })

      if (!res.success) {
        await kembalikanStok()
        return { success: false, error: `Gagal memotong stok ${item.name}: ${res.error}` }
      }

      terpotong.push({ productId: item.id, amount: item.baseQuantity })

      const { data: updated } = await supabaseAdmin
        .from('products')
        .select('stock, raw_data')
        .eq('id', item.id)
        .maybeSingle()

      hasilDeduction.push({
        productId: item.id,
        newStock: Number(updated?.stock ?? 0),
        newStockByWarehouse: (updated?.raw_data?.stockByWarehouse || {}) as Record<string, number>,
      })
    }

    // 3. HPP total untuk jurnal (modal SELALU dari server, bukan dari klien).
    const hppTotal = itemSiap.reduce((s, it) => s + (it.hppTotal || 0), 0)
    const itemTanpaModal = itemSiap.filter((it) => it.itemTanpaModal).length

    const status = data.status || (String(data.paymentMethod).toUpperCase() === 'TEMPO' ? 'BELUM_LUNAS' : 'SELESAI')

    const raw_data = {
      customerName: data.customerName || 'Pelanggan Toko',
      customerPhone: data.customerPhone || '',
      items: itemSiap,
      subtotal: Number(data.subtotal || 0),
      shippingCost: Number(data.shippingCost || 0),
      total: Number(data.total || 0),
      paymentMethod: data.paymentMethod,
      paymentProofUrl: data.paymentProofUrl || null,
      transactionType: data.transactionType || 'toko',
      deliveryMethod: data.deliveryMethod || 'pickup',
      status,
      dueDate: data.dueDate || null,
      createdAt: now,
      updatedAt: now,
      userId: data.userId || null,
      payAmount: Number(data.payAmount ?? data.total ?? 0),
      changeAmount: Number(data.changeAmount || 0),
      shiftId: data.shiftId || null,
      warehouseId,
      warehouseName: data.warehouseName || null,
      source: 'CASHIER',
      hppTotal,
    }

    // 4. Simpan order.
    const { error: orderError } = await supabaseAdmin.from('orders').insert({
      id: orderId,
      order_id: orderId,
      user_id: data.userId || null,
      customer_name: raw_data.customerName,
      status,
      total: Number(data.total || 0),
      items: itemSiap,
      raw_data,
      created_at: now,
      updated_at: now,
    })

    if (orderError) {
      await kembalikanStok()
      return { success: false, error: `Gagal menyimpan order: ${orderError.message}` }
    }

    // 5. Pembayaran dompet: saldo pelanggan + log mutasi (server-side).
    if (String(data.paymentMethod).toUpperCase() === 'DOMPET' && data.userId) {
      const total = Number(data.total || 0)

      const { data: pelanggan } = await supabaseAdmin
        .from('customers')
        .select('id, wallet_balance, raw_data')
        .eq('id', data.userId)
        .maybeSingle()

      if (pelanggan) {
        const saldoBaru = Number(pelanggan.wallet_balance || 0) - total
        const { error: walletErr } = await supabaseAdmin
          .from('customers')
          .update({ wallet_balance: saldoBaru, updated_at: now })
          .eq('id', data.userId)

        if (walletErr) {
          console.error('Gagal memperbarui saldo dompet pelanggan:', walletErr.message)
        } else {
          await supabaseAdmin.from('wallet_logs').insert({
            id: `wal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            user_id: data.userId,
            amount: -total,
            description: `Pembayaran pesanan #${orderId}`,
            created_at: now,
            raw_data: { type: 'payment', userId: data.userId, amount: -total, orderId, createdAt: now },
          })
        }
      }
    }

    // 6. Jurnal double-entry. Ditulis dengan service role karena Server Action
    //    tidak membawa sesi pengguna (klien `supabase` di sini = anon).
    const metode = String(data.paymentMethod).toUpperCase()
    const debitAccount = metode === 'TEMPO' ? 'AccountsReceivable' : metode === 'DOMPET' ? 'CustomerWallet' : 'Cash'
    const total = Number(data.total || 0)

    const jurnal = [
      { debitAccount, creditAccount: 'Sales', amount: total, memo: `Penjualan Kasir #${orderId}` },
    ]
    if (hppTotal > 0) {
      jurnal.push({
        debitAccount: 'COGS',
        creditAccount: 'Inventory',
        amount: hppTotal,
        memo: `HPP Penjualan #${orderId}`,
      })
    }

    const { error: ledgerError } = await supabaseAdmin.from('ledger_entries').insert(
      jurnal.map((j, idx) => ({
        id: `ledg_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        created_at: now,
        updated_at: now,
        raw_data: {
          date: now,
          debitAccount: j.debitAccount,
          creditAccount: j.creditAccount,
          amount: j.amount,
          memo: j.memo,
          refType: 'ORDER',
          refId: orderId,
          postedBy: 'kasir',
          extra: {},
          createdAt: now,
          updatedAt: now,
        },
      }))
    )

    if (ledgerError) {
      // Order & stok sudah benar; jurnal bisa disusulkan. Beri tahu, jangan gagalkan.
      console.error('Gagal mencatat jurnal kasir:', ledgerError.message)
    }

    revalidatePath('/admin/orders')
    revalidatePath('/admin/reports/finance')
    revalidatePath('/admin')
    revalidatePath('/admin/audit')

    return {
      success: true,
      data: { orderId, items: hasilDeduction, hppTotal, itemTanpaModal },
    }
  } catch (error: any) {
    console.error('simpanTransaksiKasir error:', error)
    return { success: false, error: error?.message || 'Gagal menyimpan transaksi kasir' }
  }
}
