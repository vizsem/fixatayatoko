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
type UserData = { points?: number; walletBalance?: number };

const generateOrderId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return `ATY-${result}`;
};

export async function POST(req: Request) {
  if (!adminDb || typeof adminDb.collection !== 'function') {
    console.error('🔥 CRITICAL ERROR: Firebase Admin SDK not initialized.');
    return NextResponse.json({
      error: 'Server Misconfiguration: Database connection failed.'
    }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { items, customer, delivery, payment, userId, voucherCode, usePoints, useWallet, channel } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Keranjang kosong' }, { status: 400 });
    }

    items.sort((a: IncomingItem, b: IncomingItem) => Number(!!a.promoType) - Number(!!b.promoType));

    let calculatedSubtotal = 0;
    const validatedItems: { id: string; name: string; price: number; quantity: number; image?: string; unit: string; total: number }[] = [];

    const channelKey: ChannelKey =
      ['OFFLINE', 'SHOPEE', 'TIKTOK', 'WEBSITE'].includes(channel)
        ? channel
        : 'WEBSITE';

    for (const item of items) {
      const productRef = adminDb.collection('products').doc(item.id);
      const productSnap = await productRef.get();

      if (!productSnap.exists) {
        return NextResponse.json({ error: `Produk dengan ID ${item.id} tidak ditemukan` }, { status: 404 });
      }

      const productData = productSnap.data() as ProductData;

      if (productData.stock < item.quantity) {
        return NextResponse.json({ error: `Stok ${productData.name || productData.Nama} tidak mencukupi` }, { status: 400 });
      }

      let price = Number(productData.price || productData.Ecer || 0);
      const wholesalePrice = Number(productData.wholesalePrice || productData.Grosir || 0);
      const minWholesale = Number(productData.minWholesale || productData.Min_Grosir || 10);

      if (productData.channelPricing) {
        const mapping: Record<ChannelKey, keyof NonNullable<ProductData['channelPricing']>> = {
          OFFLINE: 'offline', WEBSITE: 'website', SHOPEE: 'shopee', TIKTOK: 'tiktok'
        };
        const key = mapping[channelKey];
        const channelConfig = productData.channelPricing[key];
        if (channelConfig?.price != null) price = Number(channelConfig.price);
      }

      if (wholesalePrice > 0 && item.quantity >= minWholesale) price = wholesalePrice;
      if (item.promoType === 'TEBUS_MURAH' && calculatedSubtotal >= 50000 && item.quantity === 1) price = 10000;

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

    let voucherDiscount = 0;
    let appliedVoucherId = null;
    if (voucherCode && userId) {
      const vSnap = await adminDb.collection('user_vouchers')
        .where('userId', '==', userId)
        .where('code', '==', voucherCode)
        .where('status', '==', 'ACTIVE').get();
      if (!vSnap.empty) {
        voucherDiscount = Number(vSnap.docs[0].data().value || 0);
        appliedVoucherId = vSnap.docs[0].id;
      }
    }

    let pointsUsed = 0;
    let walletUsed = 0;
    if (userId && (usePoints || useWallet)) {
      const userSnap = await adminDb.collection('users').doc(userId).get();
      if (userSnap.exists) {
        const userData = userSnap.data() as UserData;
        if (usePoints) pointsUsed = Math.min(userData.points || 0, calculatedSubtotal * 0.5);
        if (useWallet) walletUsed = Math.min(userData.walletBalance || 0, Math.max(0, calculatedSubtotal - pointsUsed - voucherDiscount));
      }
    }

    const total = Math.max(0, calculatedSubtotal - pointsUsed - voucherDiscount - walletUsed);
    const orderId = generateOrderId();
    const orderRef = adminDb.collection('orders').doc();

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
      delivery,
      payment,
      status: 'PENDING',
      channel: channelKey,
      createdAt: FieldValue.serverTimestamp()
    };

    // --- FIX: TRANSACTION LOGIC ---
    await adminDb.runTransaction(async (t) => {
      // Step 1: LAKUKAN SEMUA READS TERLEBIH DAHULU
      const productRefsWithData = [];
      for (const item of validatedItems) {
        const pRef = adminDb.collection('products').doc(item.id);
        const pSnap = await t.get(pRef); // READ

        if (!pSnap.exists) throw new Error(`Produk ${item.id} tidak ditemukan saat transaksi`);
        const pData = pSnap.data() as ProductData;
        if ((pData.stock || 0) < item.quantity) {
          throw new Error(`Stok ${pData.name || pData.Nama} tidak mencukupi`);
        }
        productRefsWithData.push({ ref: pRef, newStock: (pData.stock || 0) - item.quantity });
      }

      // Step 2: LAKUKAN SEMUA WRITES SETELAH READS SELESAI
      t.set(orderRef, orderData); // WRITE
      for (const p of productRefsWithData) {
        t.update(p.ref, { stock: p.newStock }); // WRITE
      }
    });

    // 6. Side Effects
    if (userId) {
      if (pointsUsed > 0) {
        await adminDb.collection('users').doc(userId).update({ points: FieldValue.increment(-pointsUsed) });
        await adminDb.collection('point_logs').add({ userId, pointsChanged: -pointsUsed, type: 'REDEEM', description: `Order #${orderId}`, createdAt: FieldValue.serverTimestamp() });
      }
      if (walletUsed > 0) {
        await adminDb.collection('users').doc(userId).update({ walletBalance: FieldValue.increment(-walletUsed) });
        await adminDb.collection('wallet_logs').add({ userId, orderId, amountChanged: -walletUsed, type: 'PAYMENT', description: `Order #${orderId}`, createdAt: FieldValue.serverTimestamp() });
      }
      if (appliedVoucherId) await adminDb.collection('user_vouchers').doc(String(appliedVoucherId)).update({ status: 'USED' });
      await adminDb.collection('carts').doc(userId).update({ items: [], updatedAt: FieldValue.serverTimestamp() });
    }

    return NextResponse.json({ success: true, orderId, firebaseId: orderRef.id });

  } catch (error: unknown) {
    console.error('Order Creation Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
