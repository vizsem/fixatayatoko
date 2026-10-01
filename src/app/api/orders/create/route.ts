import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { addInventoryLog } from '@/lib/inventory';
import { lengkapiSnapshotHpp } from '@/lib/hpp-server';

type IncomingItem = {
  id: string;
  quantity: number;
  unit?: string;
  contains?: number;
};
type ChannelKey = 'OFFLINE' | 'WEBSITE' | 'SHOPEE' | 'TIKTOK';

type ChannelPricing = {
  price?: number;
  wholesalePrice?: number;
};

type ProductData = {
  name?: string;
  Nama?: string;
  price?: number;
  Ecer?: number;
  wholesalePrice?: number;
  Grosir?: number;
  minWholesale?: number;
  Min_Grosir?: number;
  stock: number;
  stockByWarehouse?: Record<string, number>;
  image?: string;
  Link_Foto?: string;
  unit?: string;
  Satuan?: string;
  units?: { code: string; contains: number; price?: number }[];
  isActive?: boolean;
  status?: string;
  channelPricing?: {
    offline?: ChannelPricing;
    website?: ChannelPricing;
    shopee?: ChannelPricing;
    tiktok?: ChannelPricing;
  };
};

const generateOrderId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return `ATY-${result}`;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, customer = {}, delivery, payment, userId, voucherCode, usePoints, useWallet, channel } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Keranjang kosong' }, { status: 400 });
    }

    let calculatedSubtotal = 0;
    const validatedItems: { id: string; name: string; price: number; quantity: number; baseQuantity: number; contains: number; image?: string; unit: string; total: number }[] = [];
    const productUpdates: { id: string; newStock: number; newStockByWarehouse: Record<string, number>; name: string; currentStock: number; baseQuantity: number }[] = [];

    const channelKey: ChannelKey =
      ['OFFLINE', 'SHOPEE', 'TIKTOK', 'WEBSITE'].includes(channel)
        ? channel
        : 'WEBSITE';

    const MAIN_WAREHOUSE_ID = 'gudang-utama';

    for (const item of items) {
      const { data: pRecord, error: pError } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('id', item.id)
        .single();

      if (pError || !pRecord) {
        return NextResponse.json({ error: `Produk dengan ID ${item.id} tidak ditemukan` }, { status: 404 });
      }

      const raw = pRecord.raw_data || {};
      const productData: ProductData = {
        name: pRecord.name || raw.name || raw.Nama,
        price: Number(pRecord.price ?? raw.price ?? raw.Ecer ?? 0),
        wholesalePrice: Number(raw.wholesalePrice ?? raw.Grosir ?? 0),
        minWholesale: Number(raw.minWholesale ?? raw.Min_Grosir ?? 10),
        stock: Number(pRecord.stock ?? raw.stock ?? raw.Stok ?? 0),
        stockByWarehouse: raw.stockByWarehouse || { [MAIN_WAREHOUSE_ID]: Number(pRecord.stock ?? raw.stock ?? raw.Stok ?? 0) },
        image: pRecord.image_url || raw.image || raw.Link_Foto || '',
        unit: pRecord.unit || raw.unit || raw.Satuan || 'pcs',
        units: raw.units,
        isActive: raw.isActive,
        status: raw.status,
        channelPricing: raw.channelPricing,
      };

      if (productData.isActive === false || productData.status === 'ARCHIVED') {
        return NextResponse.json({ error: `Produk ${productData.name} tidak tersedia (diarsipkan).` }, { status: 400 });
      }

      // Satuan yang dipilih beserta konfigurasinya diambil dari DATA PRODUK.
      // `item.unit` dan `item.contains` datang dari klien dan tidak dipercaya.
      const unit = String(item.unit || productData.unit || 'pcs');
      const unitConfig = Array.isArray(productData.units)
        ? productData.units.find((u) => String(u.code || '').toUpperCase() === unit.toUpperCase())
        : undefined;

      // `contains` menentukan berapa satuan dasar yang dipotong dari stok.
      // Bila produk sudah menetapkan konfigurasi satuan, nilainya diambil dari
      // sana dan nilai dari klien DIABAIKAN. Tanpa ini, klien dapat mengirim
      // `contains` besar sehingga stok terpotong berkali-kali lipat sementara
      // harga tetap, karena `unitPrice` memakai harga satuan (tidak dikalikan
      // `contains`).
      const contains = unitConfig && unitConfig.contains != null
        ? Math.max(1, Math.floor(Number(unitConfig.contains)))
        : Math.max(1, Math.floor(Number(item.contains || 1)));

      const quantity = Math.max(1, Math.floor(Number(item.quantity || 0)));
      const baseQuantity = quantity * contains;

      if (productData.stock < baseQuantity) {
        return NextResponse.json({ error: `Stok ${productData.name} tidak mencukupi (tersedia: ${productData.stock}, diminta: ${baseQuantity})` }, { status: 400 });
      }

      let baseUnitPrice = Number(productData.price || 0);
      const wholesalePrice = Number(productData.wholesalePrice || 0);
      const minWholesale = Number(productData.minWholesale || 10);

      if (productData.channelPricing) {
        const mapping: Record<ChannelKey, keyof NonNullable<ProductData['channelPricing']>> = {
          OFFLINE: 'offline', WEBSITE: 'website', SHOPEE: 'shopee', TIKTOK: 'tiktok'
        };
        const key = mapping[channelKey];
        const channelConfig = productData.channelPricing[key];
        if (channelConfig?.price != null) baseUnitPrice = Number(channelConfig.price);
      }

      if (wholesalePrice > 0 && baseQuantity >= minWholesale) baseUnitPrice = wholesalePrice;

      // CATATAN PENTING: diskon "TEBUS_MURAH" senilai Rp10.000 DIHAPUS.
      //
      // Sebelumnya harga promo diberikan HANYA berdasarkan `item.promoType`
      // yang dikirim klien, sehingga barang apa pun bisa ditandai sebagai promo
      // dan dibayar Rp10.000 — kerugian langsung, tanpa validasi apa pun.
      //
      // Fitur itu juga tidak pernah aktif: sisi klien mencari produk promo
      // dengan `status == 'active'`, sedangkan seluruh nilai status di database
      // adalah 'ARCHIVED' (verifikasi 2026-10-01: 0 dari 4.575 produk cocok),
      // sehingga bannernya tidak pernah tampil. Karena itu penghapusan ini
      // TIDAK mengubah harga yang dibayar pembeli saat ini.
      //
      // Bila promo tebus murah diinginkan, bentuknya harus dikonfigurasi di
      // server (tabel `promotions`, atau satu baris `settings`) lalu
      // diverifikasi di sini terhadap ID produk, periode, dan harga promonya.

      const unitPrice = unitConfig?.price != null
        ? Number(unitConfig.price)
        : baseUnitPrice * contains;

      const lineTotal = unitPrice * quantity;
      calculatedSubtotal += lineTotal;

      validatedItems.push({
        id: item.id,
        name: productData.name || 'Produk Tanpa Nama',
        price: unitPrice,
        quantity,
        baseQuantity,
        contains,
        image: productData.image || '',
        unit,
        total: lineTotal
      });

      // Calculate stock deductions
      const currentStock = productData.stock || 0;
      const stockByWarehouse = productData.stockByWarehouse || {};
      const newStockByWarehouse: Record<string, number> = { ...stockByWarehouse };
      let remainingToDeduct = baseQuantity;

      if (newStockByWarehouse[MAIN_WAREHOUSE_ID] && newStockByWarehouse[MAIN_WAREHOUSE_ID] > 0) {
        const deduct = Math.min(newStockByWarehouse[MAIN_WAREHOUSE_ID], remainingToDeduct);
        newStockByWarehouse[MAIN_WAREHOUSE_ID] -= deduct;
        remainingToDeduct -= deduct;
      }

      if (remainingToDeduct > 0) {
        for (const [whId, qty] of Object.entries(newStockByWarehouse)) {
          if (whId === MAIN_WAREHOUSE_ID) continue;
          if (remainingToDeduct <= 0) break;
          const deduct = Math.min(qty, remainingToDeduct);
          newStockByWarehouse[whId] -= deduct;
          remainingToDeduct -= deduct;
        }
      }

      const finalTotalStock = Math.max(0, currentStock - baseQuantity);
      productUpdates.push({
        id: item.id,
        newStock: finalTotalStock,
        newStockByWarehouse,
        name: productData.name || 'Produk',
        currentStock,
        baseQuantity,
      });
    }

    let voucherDiscount = 0;
    let appliedVoucherId = null;
    if (voucherCode && userId) {
      const { data: vList } = await supabaseAdmin
        .from('user_vouchers')
        .select('*')
        .eq('raw_data->>userId', userId)
        .eq('raw_data->>code', voucherCode)
        .limit(1);

      if (vList && vList.length > 0) {
        const vData = vList[0].raw_data || {};
        if (vData.status === 'ACTIVE') {
          voucherDiscount = Number(vData.value || 0);
          appliedVoucherId = vList[0].id;
        }
      }
    }

    let pointsUsed = 0;
    let walletUsed = 0;
    if (userId && (usePoints || useWallet)) {
      // Catatan: versi sebelumnya membaca `userRec.raw_data`, padahal tabel
      // `users` tidak punya kolom itu. Akibatnya saldo selalu terbaca 0 dan
      // poin/dompet tidak pernah aktif saat checkout. Sekarang dibaca dari
      // kolom aslinya.
      const { data: userRec, error: userError } = await supabaseAdmin
        .from('users')
        .select('points, wallet_balance')
        .eq('id', userId)
        .maybeSingle();

      if (userError) {
        // Kolom `points` belum ada bila migrasi 20261002 belum dijalankan.
        console.warn(
          `[orders/create] Saldo pengguna tidak terbaca (${userError.message}). ` +
            'Poin/dompet dianggap 0. Jalankan migrasi 20261002_loyalty_wallet_hardening.sql.'
        );
      }

      const curPoints = Number(userRec?.points ?? 0);
      const curWallet = Number(userRec?.wallet_balance ?? 0);

      if (Number.isFinite(curPoints) && usePoints) {
        pointsUsed = Math.max(0, Math.min(curPoints, calculatedSubtotal * 0.5));
      }
      if (Number.isFinite(curWallet) && useWallet) {
        walletUsed = Math.max(0, Math.min(curWallet, Math.max(0, calculatedSubtotal - pointsUsed - voucherDiscount)));
      }
    }

    // Identitas pesanan dibuat lebih awal karena dipakai sebagai keterangan
    // pada baris ledger poin/dompet di bawah.
    const orderId = generateOrderId();
    const dbOrderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    // Potong poin & saldo dompet SEBELUM pesanan dibuat, memakai fungsi atomik.
    // Urutan ini penting: bila pemotongan gagal, belum ada pesanan maupun
    // diskon yang tercatat, sehingga tidak ada pembeli yang mendapat potongan
    // tanpa membayar. Versi lama menulis ke `users.raw_data` yang tidak ada,
    // jadi pemotongan tidak pernah tersimpan walaupun diskon tetap diberikan.
    if (userId && pointsUsed > 0) {
      const { error: pointsError } = await supabaseAdmin.rpc('adjust_user_points', {
        p_user_id: userId,
        p_delta: -pointsUsed,
        p_type: 'REDEEM',
        p_description: `Order #${orderId}`,
      });

      if (pointsError) {
        console.error(`[orders/create] Gagal memotong poin untuk ${orderId}:`, pointsError.message);
        return NextResponse.json(
          { error: 'Gagal memotong poin. Silakan ulangi pesanan tanpa menggunakan poin.' },
          { status: 409 }
        );
      }
    }

    if (userId && walletUsed > 0) {
      const { error: walletError } = await supabaseAdmin.rpc('adjust_user_wallet', {
        p_user_id: userId,
        p_delta: -walletUsed,
        p_type: 'WALLET_PAYMENT',
        p_description: `Order #${orderId}`,
      });

      if (walletError) {
        console.error(`[orders/create] Gagal memotong saldo untuk ${orderId}:`, walletError.message);

        // Kembalikan poin yang sempat terpotong agar tidak hilang.
        if (pointsUsed > 0) {
          const { error: refundError } = await supabaseAdmin.rpc('adjust_user_points', {
            p_user_id: userId,
            p_delta: pointsUsed,
            p_type: 'REFUND',
            p_description: `Pembatalan pemotongan poin Order #${orderId}`,
          });
          if (refundError) {
            console.error(
              `[orders/create] GAGAL mengembalikan poin ${pointsUsed} untuk ${orderId}:`,
              refundError.message
            );
          }
        }

        return NextResponse.json(
          { error: 'Gagal memotong saldo dompet. Silakan ulangi pesanan tanpa menggunakan dompet.' },
          { status: 409 }
        );
      }
    }

    const shippingCost = Number(delivery?.cost || 0);
    const total = Math.max(0, calculatedSubtotal + shippingCost - pointsUsed - voucherDiscount - walletUsed);

    // Rekam Modal per pcs pada saat transaksi supaya laba order ini stabil.
    const itemsDenganHpp = await lengkapiSnapshotHpp(validatedItems);

    const orderData = {
      orderId,
      name: customer.name || 'Pelanggan Umum',
      phone: customer.phone || '-',
      userId: userId || 'guest',
      items: itemsDenganHpp,
      subtotal: calculatedSubtotal,
      shippingCost,
      pointsUsed,
      voucherUsed: appliedVoucherId,
      discountTotal: pointsUsed + voucherDiscount,
      walletUsed,
      total,
      delivery: {
        ...delivery,
        cost: shippingCost,
      },
      payment,
      status: 'PENDING',
      channel: channelKey,
      createdAt: now,
    };

    // 1. Insert order
    const { error: orderError } = await supabaseAdmin.from('orders').insert({
      id: dbOrderId,
      order_id: orderId,
      user_id: userId || null,
      customer_name: customer.name || 'Pelanggan Umum',
      customer_phone: customer.phone || '-',
      status: 'PENDING',
      total,
      items: itemsDenganHpp,
      delivery,
      payment,
      raw_data: orderData,
      created_at: now,
      updated_at: now,
    });

    if (orderError) {
      console.error('Failed to insert order:', orderError);

      // Kembalikan poin & saldo yang sudah dipotong: pesanannya batal, jadi
      // diskonnya juga harus dibatalkan.
      if (userId && pointsUsed > 0) {
        const { error: refundError } = await supabaseAdmin.rpc('adjust_user_points', {
          p_user_id: userId,
          p_delta: pointsUsed,
          p_type: 'REFUND',
          p_description: `Pembatalan Order #${orderId} (gagal menyimpan pesanan)`,
        });
        if (refundError) {
          console.error(
            `[orders/create] GAGAL mengembalikan poin ${pointsUsed} untuk ${orderId}:`,
            refundError.message
          );
        }
      }

      if (userId && walletUsed > 0) {
        const { error: refundError } = await supabaseAdmin.rpc('adjust_user_wallet', {
          p_user_id: userId,
          p_delta: walletUsed,
          p_type: 'REFUND',
          p_description: `Pembatalan Order #${orderId} (gagal menyimpan pesanan)`,
        });
        if (refundError) {
          console.error(
            `[orders/create] GAGAL mengembalikan saldo ${walletUsed} untuk ${orderId}:`,
            refundError.message
          );
        }
      }

      return NextResponse.json({ error: 'Gagal menyimpan pesanan: ' + orderError.message }, { status: 500 });
    }

    // 2. Update products stock & write inventory logs
    for (const p of productUpdates) {
      const { data: existingP } = await supabaseAdmin.from('products').select('raw_data').eq('id', p.id).single();
      const pRaw = existingP?.raw_data || {};

      await supabaseAdmin.from('products').update({
        stock: p.newStock,
        raw_data: {
          ...pRaw,
          stock: p.newStock,
          stockByWarehouse: p.newStockByWarehouse,
          updatedAt: now,
        },
        updated_at: now,
      }).eq('id', p.id);

      await addInventoryLog({
        productId: p.id,
        productName: p.name,
        type: 'KELUAR',
        amount: p.baseQuantity,
        quantity: -p.baseQuantity,
        adminId: userId || 'system',
        source: 'ORDER',
        referenceId: orderId,
        orderId: dbOrderId,
        note: `Order Online #${orderId}`,
        fromWarehouseId: MAIN_WAREHOUSE_ID,
        prevStock: p.currentStock,
        nextStock: p.newStock,
        date: now,
      });
    }

    // 3. Poin & saldo dompet sudah dipotong lebih awal (lihat blok sebelum
    //    "Insert order") beserta penulisan ledger-nya di dalam fungsi atomik
    //    `adjust_user_points` / `adjust_user_wallet`.

    // 4. Update voucher if used
    if (appliedVoucherId) {
      const { data: vExisting } = await supabase.from('user_vouchers').select('raw_data').eq('id', appliedVoucherId).single();
      if (vExisting) {
        await supabase.from('user_vouchers').update({
          raw_data: { ...(vExisting.raw_data || {}), status: 'USED', updatedAt: now },
          updated_at: now,
        }).eq('id', appliedVoucherId);
      }
    }

    // 5. Clear cart
    if (userId) {
      await supabase.from('carts').delete().eq('user_id', userId);
    }

    return NextResponse.json({ success: true, orderId, firebaseId: dbOrderId });
  } catch (error: any) {
    console.error('Order Creation Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
