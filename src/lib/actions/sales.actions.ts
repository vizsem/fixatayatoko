'use server'

import { requireStaff } from '@/lib/actions/session';

import { deductStockFEFO, addStock } from '../inventory'
import { revalidatePath } from 'next/cache'

type SalesItemInput = {
  productId: string
  quantity: number
  unitPrice: number
}

import { supabaseAdmin } from '@/lib/supabase';
import { lengkapiSnapshotHpp } from '@/lib/hpp-server';
import { TARIF_DEFAULT, hitungBiayaAdmin, type TarifMarketplace } from '@/lib/marketplace-fee';

export async function getSalesOrders(filters?: { status?: string; customerId?: string; limit?: number }) {
  await requireStaff();
  try {
    let query = supabaseAdmin.from('orders').select('*');
    if (filters?.status && filters.status !== 'SEMUA') {
      query = query.eq('status', filters.status);
    }
    if (filters?.customerId) {
      query = query.eq('user_id', filters.customerId);
    }
    query = query.order('created_at', { ascending: false }).limit(filters?.limit || 200);

    const { data: rows, error } = await query;
    if (error || !rows) {
      console.error('Failed to fetch sales orders from Supabase:', error);
      return [];
    }

    return rows.map((o: any) => {
      const raw = o.raw_data || {};
      const items = Array.isArray(o.items) ? o.items : (raw.items || []);
      const totalAmount = Number(o.total ?? raw.total ?? raw.totalAmount ?? 0);

      return {
        id: o.id,
        soNumber: o.order_id || raw.orderId || o.id,
        status: o.status || raw.status || 'PENDING',
        totalAmount,
        createdAt: o.created_at ? new Date(o.created_at) : new Date(),
        customer: {
          name: o.customer_name || raw.customerName || raw.name || 'Pelanggan',
          phone: o.customer_phone || raw.phone || raw.customerPhone || null,
        },
        items: items.map((it: any) => ({
          productId: it.productId || it.id || null,
          quantity: Number(it.quantity || it.qty || 1),
          unitPrice: Number(it.price || it.unitPrice || 0),
          product: { name: it.name || it.productName || 'Produk' },
        })),
        paymentMethod: o.payment || raw.paymentMethod || 'TUNAI',
        deliveryMethod: o.delivery || raw.deliveryMethod || 'Ambil di Toko',
        deliveryAddress: raw.deliveryAddress || raw.address || null,
        notes: raw.notes || null,
        invoice: {
          status: o.status === 'SELESAI' ? 'PAID' : 'UNPAID',
          amountPaid: o.status === 'SELESAI' ? totalAmount : 0,
        },
      };
    });
  } catch (error) {
    console.error('Failed to fetch sales orders:', error);
    return [];
  }
}

export async function getSalesOrderById(id: string) {
  await requireStaff();
  try {
    const { data: o, error } = await supabaseAdmin.from('orders').select('*').eq('id', id).single();
    if (error || !o) return null;
    const raw = o.raw_data || {};
    const items = Array.isArray(o.items) ? o.items : (raw.items || []);
    const totalAmount = Number(o.total ?? raw.total ?? raw.totalAmount ?? 0);

    return {
      id: o.id,
      soNumber: o.order_id || raw.orderId || o.id,
      status: o.status || raw.status || 'PENDING',
      totalAmount,
      notes: raw.notes || null,
      createdAt: o.created_at ? new Date(o.created_at) : new Date(),
      customer: {
        id: o.user_id || raw.userId || 'guest',
        name: o.customer_name || raw.customerName || raw.name || 'Pelanggan',
        phone: o.customer_phone || raw.phone || raw.customerPhone || null,
      },
      items: items.map((it: any) => ({
        id: it.id || it.productId || '',
        productId: it.productId || it.id || '',
        quantity: Number(it.quantity || it.qty || 1),
        unitPrice: Number(it.price || it.unitPrice || 0),
        totalPrice: Number(it.total || ((it.price || it.unitPrice || 0) * (it.quantity || it.qty || 1))),
        product: { name: it.name || it.productName || 'Produk' },
      })),
      invoice: {
        id: `inv_${o.id}`,
        status: o.status === 'SELESAI' ? 'PAID' : 'UNPAID',
        totalAmount,
        amountPaid: o.status === 'SELESAI' ? totalAmount : 0,
        payments: [],
      },
    };
  } catch (e) {
    console.error('getSalesOrderById error:', e);
    return null;
  }
}

export async function createSalesOrder(data: {
  customerId: string
  createdById: string
  notes?: string
  items: SalesItemInput[]
  warehouseId: string
}) {
  await requireStaff();
  try {
    const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const id = `so_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const soNumber = `SO-${Date.now()}`;
    const now = new Date().toISOString();

    // Rekam Modal per pcs pada saat transaksi supaya laba order ini tidak
    // berubah kalau Modal produk diubah belakangan — lihat `src/lib/hpp.ts`.
    const itemsDenganHpp = await lengkapiSnapshotHpp(data.items);

    // Deduct stock using FEFO
    for (const item of data.items) {
      const result = await deductStockFEFO({
        productId: item.productId,
        warehouseId: data.warehouseId,
        amount: item.quantity,
        reference: soNumber,
      });
      if (!result.success) {
        return { success: false, error: result.error || `Stok tidak cukup untuk produk ID: ${item.productId}` };
      }
    }

    // Fetch customer info if available
    const { data: cust } = await supabaseAdmin.from('customers').select('*').eq('id', data.customerId).single();
    const custName = cust?.name || cust?.raw_data?.name || 'Pelanggan';
    const custPhone = cust?.phone || cust?.raw_data?.phone || null;

    const orderData = {
      orderId: soNumber,
      customerId: data.customerId,
      customerName: custName,
      customerPhone: custPhone,
      createdById: data.createdById,
      notes: data.notes || '',
      items: itemsDenganHpp,
      total: totalAmount,
      status: 'CONFIRMED',
      createdAt: now,
    };

    const { error } = await supabaseAdmin.from('orders').insert({
      id,
      order_id: soNumber,
      user_id: data.customerId,
      customer_name: custName,
      customer_phone: custPhone,
      status: 'CONFIRMED',
      total: totalAmount,
      items: itemsDenganHpp,
      raw_data: orderData,
      created_at: now,
      updated_at: now,
    });

    if (error) throw error;

    revalidatePath('/admin/orders');
    return { success: true, data: { id, ...orderData } };
  } catch (error: any) {
    console.error('Failed to create sales order:', error);
    return { success: false, error: error.message || 'Gagal membuat sales order' };
  }
}

/**
 * Pesan Ulang — buat Sales Order baru berdasarkan item dari pesanan sebelumnya.
 *
 * Alurnya:
 * 1. Ambil data pesanan asal (berisi items + info pelanggan + gudang).
 * 2. Validasi: hanya item yang punya productId yang bisa di-reorder.
 * 3. Deduct stok via FEFO persis seperti createSalesOrder.
 * 4. Simpan SO baru dengan referensi ke pesanan asal (reorderedFromId).
 * 5. Kembalikan id + soNumber SO baru agar UI bisa navigasi ke sana.
 */
export async function reorderSalesOrder(params: {
  sourceOrderId: string;
  /** Override qty per item (key = productId, value = qty baru). Jika kosong, pakai qty asli. */
  quantities?: Record<string, number>;
  notes?: string;
  adminId?: string;
}) {
  await requireStaff();
  try {
    const { sourceOrderId, quantities = {}, notes, adminId = 'system' } = params;

    // 1. Ambil pesanan asal
    const { data: source, error: srcErr } = await supabaseAdmin
      .from('orders')
      .select('*')
      .or(`id.eq.${sourceOrderId},order_id.eq.${sourceOrderId}`)
      .maybeSingle();

    if (srcErr || !source) {
      return { success: false, error: 'Pesanan asal tidak ditemukan' };
    }

    const raw = source.raw_data || {};
    const sourceItems: any[] = Array.isArray(source.items) ? source.items : (raw.items || []);
    const warehouseId: string = raw.warehouseId || source.warehouse_id || 'gudang-utama';

    // 2. Bangun daftar item yang akan di-reorder
    const reorderItems = sourceItems
      .filter((it: any) => !!(it.productId || it.id))
      .map((it: any) => {
        const productId: string = it.productId || it.id;
        const qty = quantities[productId] ?? Number(it.quantity || it.qty || 1);
        return {
          productId,
          quantity: qty,
          unitPrice: Number(it.price || it.unitPrice || 0),
          name: it.name || it.productName || 'Produk',
        };
      })
      .filter((it) => it.quantity > 0);

    if (reorderItems.length === 0) {
      return { success: false, error: 'Tidak ada item yang valid untuk dipesan ulang' };
    }

    // 3. Generate ID & nomor SO baru
    const newId = `so_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newSoNumber = `SO-${Date.now()}`;
    const now = new Date().toISOString();

    // Rekam HPP snapshot agar laba historis tidak berubah jika Modal produk diubah
    const itemsDenganHpp = await lengkapiSnapshotHpp(
      reorderItems.map((it) => ({ productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice }))
    );

    // 4. Deduct stok FEFO untuk setiap item — batalkan semua jika ada yang gagal
    const sudahDipotong: { productId: string; quantity: number }[] = [];
    const rollback = async () => {
      for (const item of sudahDipotong) {
        try {
          await addStock({
            productId: item.productId,
            amount: item.quantity,
            warehouseId,
            reference: newSoNumber,
            notes: `Rollback reorder ${newSoNumber} — gagal menyimpan`,
            source: 'ORDER',
          });
        } catch (e) {
          console.error(`Rollback stok gagal untuk ${item.productId}:`, e);
        }
      }
    };

    for (const item of reorderItems) {
      const result = await deductStockFEFO({
        productId: item.productId,
        warehouseId,
        amount: item.quantity,
        reference: newSoNumber,
        notes: `Reorder dari ${source.order_id || sourceOrderId}`,
      });
      if (!result.success) {
        await rollback();
        return {
          success: false,
          error: result.error || `Stok tidak cukup untuk produk: ${item.name}`,
        };
      }
      sudahDipotong.push({ productId: item.productId, quantity: item.quantity });
    }

    const totalAmount = reorderItems.reduce((s, it) => s + it.quantity * it.unitPrice, 0);

    // 5. Simpan SO baru
    const orderData = {
      orderId: newSoNumber,
      customerId: source.user_id || raw.customerId || '',
      customerName: source.customer_name || raw.customerName || 'Pelanggan',
      customerPhone: source.customer_phone || raw.customerPhone || null,
      createdById: adminId,
      notes: notes || `Pesan ulang dari ${source.order_id || sourceOrderId}`,
      items: itemsDenganHpp,
      total: totalAmount,
      status: 'CONFIRMED',
      warehouseId,
      reorderedFromId: source.id,
      reorderedFromSo: source.order_id || sourceOrderId,
      createdAt: now,
    };

    const { error: insertErr } = await supabaseAdmin.from('orders').insert({
      id: newId,
      order_id: newSoNumber,
      user_id: source.user_id || null,
      customer_name: orderData.customerName,
      customer_phone: orderData.customerPhone,
      status: 'CONFIRMED',
      total: totalAmount,
      items: itemsDenganHpp,
      raw_data: orderData,
      created_at: now,
      updated_at: now,
    });

    if (insertErr) {
      await rollback();
      throw insertErr;
    }

    revalidatePath('/admin/orders');
    revalidatePath('/admin/products');
    revalidatePath('/admin/inventory');

    return {
      success: true,
      data: { id: newId, soNumber: newSoNumber, total: totalAmount },
    };
  } catch (err: any) {
    console.error('reorderSalesOrder error:', err);
    return { success: false, error: err.message || 'Gagal membuat pesanan ulang' };
  }
}

export async function cancelSalesOrder(params: {
  orderId: string;
  restockStock?: boolean;
  reason?: string;
  adminId?: string;
}) {
  await requireStaff();
  try {
    const { orderId, restockStock = true, reason, adminId = 'system' } = params;
    const now = new Date().toISOString();

    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('*')
      .or(`id.eq.${orderId},order_id.eq.${orderId}`)
      .maybeSingle();

    if (orderErr || !order) {
      return { success: false, error: 'Pesanan tidak ditemukan' };
    }

    const currentStatus = (order.status || '').toUpperCase();
    if (currentStatus === 'CANCELLED' || currentStatus === 'DIBATALKAN') {
      return { success: false, error: 'Pesanan sudah dibatalkan sebelumnya' };
    }

    const raw = order.raw_data || {};
    const items = order.items || raw.items || [];
    const warehouseId = raw.warehouseId || order.warehouse_id || 'gudang-utama';

    // 1. Jika restockStock dipilih, kembalikan stok untuk setiap item ke tabel products.
    //    Gunakan addStock() — bukan update manual — agar raw_data (termasuk raw_data.stock,
    //    raw_data.stockByWarehouse, dan inventoryLayers/FIFO) ikut diperbarui secara atomik.
    //    Update manual sebelumnya hanya mengubah kolom `stock` & `stockByWarehouse` tapi
    //    meninggalkan raw_data lama → deductStockFEFO membaca raw_data dan mendapat stok
    //    yang tidak konsisten pada transaksi berikutnya.
    if (restockStock && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const productId = item.productId || item.id;
        if (!productId) continue;

        // baseQuantity dipakai oleh order marketplace; untuk SO kasir fallback ke quantity.
        const contains = Number(item.containsPerUnit || item.contains || 1);
        const qtyToReturn = Number(item.baseQuantity || (Number(item.quantity || 0) * contains));

        if (qtyToReturn <= 0) continue;

        try {
          await addStock({
            productId,
            amount: qtyToReturn,
            warehouseId,
            reference: order.order_id || order.id,
            notes: `Pengembalian stok pembatalan pesanan #${order.order_id || order.id}${reason ? ` (${reason})` : ''}`,
            source: 'ORDER',
          });
        } catch (stockErr: any) {
          console.error(`Gagal mengembalikan stok untuk produk ${productId} saat batalkan pesanan:`, stockErr?.message || stockErr);
          // Lanjutkan ke item berikutnya — jangan batalkan seluruh proses hanya karena
          // satu produk gagal direstock (misalnya produk telah dihapus).
        }
      }
    }

    // 2. Update status order menjadi CANCELLED
    raw.status = 'CANCELLED';
    raw.cancelledAt = now;
    raw.cancelledBy = adminId;
    raw.cancelReason = reason || 'Dibatalkan oleh admin';
    raw.isRestocked = restockStock;
    raw.updatedAt = now;

    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'CANCELLED',
        raw_data: raw,
        updated_at: now,
      })
      .eq('id', order.id);

    if (updateErr) throw updateErr;

    revalidatePath('/admin/orders');
    revalidatePath('/admin/products');
    revalidatePath('/admin/inventory');
    revalidatePath('/admin/reports/finance');
    revalidatePath('/admin/reports/sales');

    return { success: true };
  } catch (err: any) {
    console.error('Error cancelling order:', err);
    return { success: false, error: err.message || 'Gagal membatalkan pesanan' };
  }
}

export async function updateSalesOrderStatus(
  id: string,
  status: string,
  options?: { restockStock?: boolean; reason?: string; adminId?: string }
) {
  await requireStaff();
  if (status === 'CANCELLED' || status === 'DIBATALKAN') {
    return cancelSalesOrder({
      orderId: id,
      restockStock: options?.restockStock ?? true,
      reason: options?.reason,
      adminId: options?.adminId,
    });
  }

  try {
    const now = new Date().toISOString();
    const { data: existing } = await supabaseAdmin.from('orders').select('*').eq('id', id).single();
    const raw = existing?.raw_data || {};
    raw.status = status;
    raw.updatedAt = now;

    const { error } = await supabaseAdmin.from('orders').update({
      status,
      raw_data: raw,
      updated_at: now,
    }).eq('id', id);

    if (error) throw error;
    revalidatePath('/admin/orders');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal update status SO' };
  }
}

export async function recordPayment(data: {
  invoiceId: string
  receivedById: string
  amount: number
  paymentMethod: string
  reference?: string
}) {
  await requireStaff();
  try {
    const orderId = data.invoiceId.replace(/^inv_/, '');
    const { data: order } = await supabaseAdmin.from('orders').select('*').eq('id', orderId).single();
    if (!order) return { success: false, error: 'Order tidak ditemukan' };

    const raw = order.raw_data || {};
    const currentPaid = Number(raw.amountPaid || 0) + data.amount;
    const total = Number(order.total ?? raw.total ?? 0);
    const isPaid = currentPaid >= total;
    const status = isPaid ? 'SELESAI' : order.status;

    raw.amountPaid = currentPaid;
    raw.paymentStatus = isPaid ? 'PAID' : 'PARTIAL';
    raw.status = status;

    await supabaseAdmin.from('orders').update({
      status,
      raw_data: raw,
      updated_at: new Date().toISOString(),
    }).eq('id', orderId);

    revalidatePath('/admin/orders');
    return { success: true };
  } catch (error) {
    console.error('Failed to record payment:', error);
    return { success: false, error: 'Gagal mencatat pembayaran' };
  }
}

export async function getUnpaidInvoices() {
  await requireStaff();
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .neq('status', 'SELESAI')
      .neq('status', 'COMPLETED')
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false });

    if (error || !rows) return [];

    return rows.map((o: any) => {
      const raw = o.raw_data || {};
      const total = Number(o.total ?? raw.total ?? 0);
      return {
        id: `inv_${o.id}`,
        invoiceNo: `INV-${o.order_id || o.id.slice(0, 8).toUpperCase()}`,
        totalAmount: total,
        amountPaid: Number(raw.amountPaid || 0),
        status: 'UNPAID',
        createdAt: o.created_at ? new Date(o.created_at) : new Date(),
        customer: {
          name: o.customer_name || raw.customerName || raw.name || 'Pelanggan',
          phone: o.customer_phone || raw.phone || null,
        },
        so: {
          soNumber: o.order_id || raw.orderId || o.id,
        },
      };
    });
  } catch (error) {
    console.error('Failed to fetch unpaid invoices:', error);
    return [];
  }
}

export async function createMarketplaceOrder(data: {
  orderId: string;
  externalOrderId: string;
  customerName: string;
  items: any[];
  subtotal: number;
  shippingCost: number;
  total: number;
  channel: string;
  paymentMethod: string;
  warehouseId: string;
  warehouseName: string;
  adminId: string;
  /**
   * Cara mengisi harga: `AUTO` = yang diisi harga jual (biaya admin dipotong
   * sistem), `MANUAL` = yang diisi uang bersih hasil potongan marketplace.
   */
  hargaMode?: string;
}) {
  await requireStaff();
  try {
    const dbOrderId = `mkt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    // Rekam Modal per pcs pada saat transaksi. Tanpa ini laba historis ikut
    // berubah setiap kali "Modal" produk diperbaiki di halaman Produk.
    const itemsDenganHpp = await lengkapiSnapshotHpp(data.items);

    // Catat stok yang sudah terpotong supaya bisa dikembalikan bila order gagal
    // disimpan. Tanpa ini, kegagalan menyimpan order meninggalkan stok yang
    // sudah terpotong tanpa order — kerugian yang tidak terlihat.
    const sudahDipotong: { id: string; baseQuantity: number }[] = [];
    const kembalikanStok = async () => {
      for (const item of sudahDipotong) {
        try {
          await addStock({
            productId: item.id,
            amount: item.baseQuantity,
            warehouseId: data.warehouseId,
            reference: data.orderId,
            notes: `Pengembalian otomatis — order ${data.externalOrderId} gagal disimpan`,
            source: 'MARKETPLACE',
          });
        } catch (err) {
          console.error(`Gagal mengembalikan stok ${item.id} setelah order gagal:`, err);
        }
      }
    };

    // Deduct stock using FEFO
    for (const item of data.items) {
      const result = await deductStockFEFO({
        productId: item.id,
        warehouseId: data.warehouseId,
        amount: item.baseQuantity, // Passed from client
        source: 'MARKETPLACE',
        adminId: data.adminId,
        reference: data.orderId,
        notes: `${data.channel} Order #${data.externalOrderId} | Gudang: ${data.warehouseName}`,
      });
      if (!result.success) {
        await kembalikanStok();
        return { success: false, error: result.error || `Stok tidak cukup untuk produk ID: ${item.id}` };
      }
      sudahDipotong.push({ id: item.id, baseQuantity: item.baseQuantity });
    }

    // Biaya admin marketplace dihitung di server dari tarif Settings.
    const biayaAdmin = hitungBiayaAdmin({
      mode: data.hargaMode,
      jumlahDiisi: Number(data.subtotal || 0),
      channel: data.channel,
      tarif: await ambilTarifMarketplace(),
    });

    const orderData = {
      orderId: data.orderId,
      externalOrderId: data.externalOrderId,
      customerName: data.customerName,
      items: itemsDenganHpp,
      subtotal: data.subtotal,
      shippingCost: data.shippingCost,
      total: data.total,
      channel: data.channel,
      paymentMethod: data.paymentMethod,
      warehouseId: data.warehouseId,
      warehouseName: data.warehouseName,
      status: 'SELESAI',
      adminId: data.adminId,
      createdAt: now,
      // Biaya admin marketplace dihitung di SERVER memakai tarif dari Settings,
      // bukan dari kiriman klien. `AUTO` = angka yang diisi bruto (biaya
      // dipotong sistem), `MANUAL` = angka yang diisi sudah bersih.
      hargaMode: biayaAdmin.mode,
      tarifAdmin: biayaAdmin.tarif,
      biayaAdmin: biayaAdmin.biaya,
      brutoBarang: Number(data.subtotal || 0),
      nettoBarang: biayaAdmin.bersih,
    };

    const { error: orderError } = await supabaseAdmin.from('orders').insert({
      id: dbOrderId,
      order_id: data.orderId,
      user_id: null,
      customer_name: data.customerName,
      status: 'SELESAI',
      total: data.total,
      items: itemsDenganHpp,
      raw_data: orderData,
      created_at: now,
      updated_at: now,
    });

    if (orderError) {
      await kembalikanStok();
      throw orderError;
    }

    revalidatePath('/admin/products');
    revalidatePath('/admin/orders');
    revalidatePath('/admin/reports/finance');
    revalidatePath('/admin/audit');
    return { success: true, data: { id: dbOrderId, ...orderData } };
  } catch (error: any) {
    console.error('Failed to create marketplace order:', error);
    return { success: false, error: error.message || 'Gagal membuat marketplace order' };
  }
}

/**
 * Tarif biaya admin per marketplace dari Settings (baris `id = 'system'`).
 *
 * Dibaca di server supaya tarif tidak bisa dipalsukan klien, dan supaya
 * perubahan di halaman Settings langsung berlaku pada order berikutnya.
 */
async function ambilTarifMarketplace(): Promise<TarifMarketplace> {
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('raw_data')
      .eq('id', 'system')
      .maybeSingle();

    const fees = (data?.raw_data as any)?.marketplaceFees || {};
    return {
      shopee: Number(fees.shopee ?? TARIF_DEFAULT.shopee),
      tiktok: Number(fees.tiktok ?? TARIF_DEFAULT.tiktok),
      tokopedia: Number(fees.tokopedia ?? TARIF_DEFAULT.tokopedia),
      lazada: Number(fees.lazada ?? TARIF_DEFAULT.lazada),
    };
  } catch (e: any) {
    console.error('Gagal membaca tarif marketplace dari Settings:', e?.message || e);
    return TARIF_DEFAULT;
  }
}
