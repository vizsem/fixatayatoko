import { NextResponse } from 'next/server';
import { adminDb, FieldValue } from '@/lib/firebaseAdmin';
 

type IncomingItem = {
  id: string;
  quantity: number;
  promoType?: 'TEBUS_MURAH' | string;
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
  image?: string;
  Link_Foto?: string;
  unit?: string;
  Satuan?: string;
  channelPricing?: {
    offline?: ChannelPricing;
    website?: ChannelPricing;
    shopee?: ChannelPricing;
    tiktok?: ChannelPricing;
  };
};
type VoucherData = { value?: number };
type UserData = { points?: number; walletBalance?: number };

// Helper to generate Order ID
const generateOrderId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return `ATY-${result}`;
};

export async function POST(req: Request) {
  // SAFETY CHECK: Pastikan Firebase Admin sudah terinisialisasi
  if (!adminDb || typeof adminDb.collection !== 'function') {
    console.error('🔥 CRITICAL ERROR: Firebase Admin SDK not initialized.');
    console.error('Check your Vercel Environment Variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    return NextResponse.json({ 
      error: 'Server Misconfiguration: Database connection failed. Please contact admin.' 
    }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { items, customer, delivery, payment, userId, voucherCode, usePoints, useWallet, channel } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Keranjang kosong' }, { status: 400 });
    }

    // Sort items: Normal first, Promo last agar subtotal valid untuk syarat promo
    items.sort((a: IncomingItem, b: IncomingItem) => Number(!!a.promoType) - Number(!!b.promoType));

    // 1. Validasi & Kalkulasi Ulang Total (Server-Side)
    let calculatedSubtotal = 0;
    const validatedItems: { id: string; name: string; price: number; quantity: number; image?: string; unit: string; total: number }[] = [];
    
    // Gunakan Transaction untuk atomicity (Stok & Validasi Harga)
    // Catatan: Client SDK transaction di server environment mungkin memiliki limitasi tanpa Service Account,
    // tapi kita coba best effort dengan logic validasi dulu. 
    // Untuk simplifikasi dan menghindari masalah lock di Client SDK non-admin, kita fetch dulu lalu write.
    // Idealnya gunakan firebase-admin transaction.

    const channelKey: ChannelKey =
      channel === 'OFFLINE' || channel === 'SHOPEE' || channel === 'TIKTOK' || channel === 'WEBSITE'
        ? channel
        : 'WEBSITE';

    for (const item of items) {
      const productRef = adminDb.collection('products').doc(item.id);
      const productSnap = await productRef.get();

      if (!productSnap.exists) {
        return NextResponse.json({ error: `Produk dengan ID ${item.id} tidak ditemukan` }, { status: 404 });
      }

      const productData = productSnap.data() as ProductData;
      
      // Cek Stok
      if (productData.stock < item.quantity) {
        return NextResponse.json({ error: `Stok ${productData.name} tidak mencukupi (Sisa: ${productData.stock})` }, { status: 400 });
      }

      let price = Number(productData.price || productData.Ecer || 0);
      const wholesalePrice = Number(productData.wholesalePrice || productData.Grosir || 0);
      const minWholesale = Number(productData.minWholesale || productData.Min_Grosir || 10);

      if (productData.channelPricing) {
        const mapping: Record<ChannelKey, keyof NonNullable<ProductData['channelPricing']>> = {
          OFFLINE: 'offline',
          WEBSITE: 'website',
          SHOPEE: 'shopee',
          TIKTOK: 'tiktok'
        };
        const key = mapping[channelKey];
        const channelConfig = productData.channelPricing[key];
        if (channelConfig?.price != null) {
          price = Number(channelConfig.price);
        }
      }

      if (wholesalePrice > 0 && item.quantity >= minWholesale) {
        price = wholesalePrice;
      }

      // ✅ LOGIKA PROMO TEBUS MURAH (Bundling)
      if (item.promoType === 'TEBUS_MURAH') {
        // Syarat: Subtotal belanjaan SEBELUM item ini harus >= 50.000
        // Karena sudah disortir, calculatedSubtotal saat ini adalah total item sebelumnya
        if (calculatedSubtotal >= 50000 && item.quantity === 1) {
             price = 10000; // Harga Tebus Murah
        }
      }

      const lineTotal = price * item.quantity;
      calculatedSubtotal += lineTotal;

      validatedItems.push({
        id: item.id,
        name: productData.name || productData.Nama || 'Produk Tanpa Nama',
        price: price,
        quantity: item.quantity,
        image: productData.image || productData.Link_Foto || '',
        unit: productData.unit || productData.Satuan || 'pcs',
        total: lineTotal
      });
    }

    // 2. Validasi Voucher
    let voucherDiscount = 0;
    let appliedVoucherId = null;

    if (voucherCode && userId) {
      const vSnap = await adminDb
        .collection('user_vouchers')
        .where('userId', '==', userId)
        .where('code', '==', voucherCode)
        .where('status', '==', 'ACTIVE')
        .get();
      if (!vSnap.empty) {
        const vDoc = vSnap.docs[0];
        const vData = vDoc.data() as VoucherData;
        voucherDiscount = Number(vData.value || 0);
        appliedVoucherId = vDoc.id;
      }
    }

    // 3. Validasi Poin dan Dompet
    let pointsUsed = 0;
    let walletUsed = 0;
    if (userId && (usePoints || useWallet)) {
      const userRef = adminDb.collection('users').doc(userId);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        const userData = userSnap.data() as UserData;
        if (usePoints) {
          const availablePoints = userData.points || 0;
          const maxRedeemable = calculatedSubtotal * 0.5;
          pointsUsed = Math.min(availablePoints, maxRedeemable);
        }
        if (useWallet) {
          const availableWallet = userData.walletBalance || 0;
          const baseTotal = Math.max(0, calculatedSubtotal - pointsUsed - voucherDiscount);
          walletUsed = Math.min(availableWallet, baseTotal);
        }
      }
    }

    // 4. Hitung Total Akhir
    const total = Math.max(0, calculatedSubtotal - pointsUsed - voucherDiscount - walletUsed);
    const orderId = generateOrderId();

    // 5. Simpan Order ke Firestore
    const orderData = {
      orderId,
      name: customer.name || 'Pelanggan Umum',
      phone: customer.phone || '-',
      userId: userId || 'guest',
      items: validatedItems,
      subtotal: calculatedSubtotal,
      pointsUsed,
      voucherUsed: appliedVoucherId,
      discountTotal: pointsUsed + voucherDiscount,
      walletUsed,
      total,
      delivery: {
        method: delivery.method,
        type: delivery.type,
        address: delivery.address || 'Ambil di Toko'
      },
      payment: {
        method: payment.method,
        proof: payment.proof || null
      },
      status: 'PENDING',
      channel: channelKey,
      createdAt: FieldValue.serverTimestamp()
    };

    const orderRef = adminDb.collection('orders').doc();
    await adminDb.runTransaction(async (t) => {
      t.set(orderRef, orderData);
      for (const item of validatedItems) {
        const pRef = adminDb.collection('products').doc(item.id);
        const pSnap = await t.get(pRef);
        if (!pSnap.exists) {
          throw new Error('Produk tidak ditemukan saat transaksi');
        }
        const pData = pSnap.data() as ProductData;
        if ((pData.stock || 0) < item.quantity) {
          throw new Error(`Stok ${pData.name || pData.Nama} tidak mencukupi`);
        }
        t.update(pRef, { stock: FieldValue.increment(-item.quantity) });
      }
    });

    // 6. Update Side Effects (Poin, Voucher, Cart)
    if (pointsUsed > 0 && userId) {
      await adminDb.collection('users').doc(userId).update({
        points: FieldValue.increment(-pointsUsed)
      });
      await adminDb.collection('point_logs').add({
        userId,
        pointsChanged: -pointsUsed,
        type: 'REDEEM',
        description: `Checkout Order #${orderId}`,
        createdAt: FieldValue.serverTimestamp()
      });
    }

    if (walletUsed > 0 && userId) {
      await adminDb.collection('users').doc(userId).update({
        walletBalance: FieldValue.increment(-walletUsed)
      });
      await adminDb.collection('wallet_logs').add({
        userId,
        orderId,
        amountChanged: -walletUsed,
        type: 'PAYMENT',
        description: `Pembayaran Order #${orderId} menggunakan dompet`,
        createdAt: FieldValue.serverTimestamp()
      });
    }

    // Matikan Voucher
    if (appliedVoucherId) {
      await adminDb.collection('user_vouchers').doc(String(appliedVoucherId)).update({ status: 'USED' });
    }

    // Kosongkan Cart
    if (userId) {
      await adminDb.collection('carts').doc(userId).update({ 
        items: [], 
        updatedAt: FieldValue.serverTimestamp() 
      });
    }

    return NextResponse.json({ 
      success: true, 
      orderId: orderId,
      firebaseId: orderRef.id 
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Order Creation Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
