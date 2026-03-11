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
  stockByWarehouse?: Record<string, number>;
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
      // Step 1: READS (Produk, User, Voucher)
      
      // A. Baca Data Produk
      const productReads = validatedItems.map(async (item) => {
        const ref = adminDb.collection('products').doc(item.id);
        const snap = await t.get(ref);
        return { item, ref, snap };
      });
      
      const productResults = await Promise.all(productReads);
      
      // B. Baca Data User (untuk Point & Wallet)
      let userRef: FirebaseFirestore.DocumentReference | null = null;
      let userSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (userId) {
        userRef = adminDb.collection('users').doc(userId);
        userSnap = await t.get(userRef);
      }

      // C. Baca Data Voucher (untuk Validasi Status)
      let voucherRef: FirebaseFirestore.DocumentReference | null = null;
      let voucherSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (appliedVoucherId) {
        voucherRef = adminDb.collection('user_vouchers').doc(appliedVoucherId);
        voucherSnap = await t.get(voucherRef);
      }

      // Step 2: VALIDATION & CALCULATION

      // A. Validasi & Kalkulasi Stok Produk
      const productUpdates = [];
      const MAIN_WAREHOUSE_ID = 'gudang-utama'; // Configurable ID

      for (const { item, ref, snap } of productResults) {
        if (!snap.exists) throw new Error(`Produk ${item.id} tidak ditemukan saat transaksi`);
        const pData = snap.data() as ProductData;
        
        const currentStock = pData.stock || 0;
        if (currentStock < item.quantity) {
          throw new Error(`Stok ${pData.name || pData.Nama} tidak mencukupi`);
        }

        // Logika Pengurangan Stok Per Gudang
        const stockByWarehouse = pData.stockByWarehouse || {};
        const newStockByWarehouse: Record<string, number> = { ...stockByWarehouse };
        
        let remainingToDeduct = item.quantity;
        
        // 1. Prioritas Gudang Utama
        if (newStockByWarehouse[MAIN_WAREHOUSE_ID] && newStockByWarehouse[MAIN_WAREHOUSE_ID] > 0) {
          const deduct = Math.min(newStockByWarehouse[MAIN_WAREHOUSE_ID], remainingToDeduct);
          newStockByWarehouse[MAIN_WAREHOUSE_ID] -= deduct;
          remainingToDeduct -= deduct;
        }
        
        // 2. Gudang Lainnya
        if (remainingToDeduct > 0) {
          for (const [whId, qty] of Object.entries(newStockByWarehouse)) {
            if (whId === MAIN_WAREHOUSE_ID) continue;
            if (remainingToDeduct <= 0) break;
            
            const deduct = Math.min(qty, remainingToDeduct);
            newStockByWarehouse[whId] -= deduct;
            remainingToDeduct -= deduct;
          }
        }
        
        const finalTotalStock = currentStock - item.quantity;
        productUpdates.push({ 
          ref, 
          newStock: finalTotalStock, 
          newStockByWarehouse,
          name: pData.name || pData.Nama || 'Produk',
          currentStock
        });
      }

      // B. Validasi Voucher
      if (voucherRef && voucherSnap) {
        if (!voucherSnap.exists || voucherSnap.data()?.status !== 'ACTIVE') {
          throw new Error('Voucher tidak valid atau sudah digunakan');
        }
      }

      // C. Kalkulasi Final Points & Wallet
      let finalPointsUsed = 0;
      let finalWalletUsed = 0;

      if (userId && userSnap && userSnap.exists) {
        const userData = userSnap.data() as UserData;
        const currentPoints = userData.points || 0;
        const currentWallet = userData.walletBalance || 0;

        if (usePoints) {
          finalPointsUsed = Math.min(currentPoints, calculatedSubtotal * 0.5);
        }
        if (useWallet) {
          const remainingBill = Math.max(0, calculatedSubtotal - finalPointsUsed - voucherDiscount);
          finalWalletUsed = Math.min(currentWallet, remainingBill);
        }
      }

      const finalTotal = Math.max(0, calculatedSubtotal - finalPointsUsed - voucherDiscount - finalWalletUsed);

      // Update Order Data dengan nilai final
      const finalOrderData = {
        ...orderData,
        pointsUsed: finalPointsUsed,
        walletUsed: finalWalletUsed,
        discountTotal: finalPointsUsed + voucherDiscount,
        total: finalTotal,
      };

      // Step 3: WRITES

      // 1. Simpan Order
      t.set(orderRef, finalOrderData);

      // 2. Update Produk
      for (const p of productUpdates) {
        t.update(p.ref, { 
          stock: p.newStock,
          stockByWarehouse: p.newStockByWarehouse
        });

        // 2b. Catat Log Inventory (Agar muncul di Audit Stok)
        const logRef = adminDb.collection('inventory_logs').doc();
        t.set(logRef, {
          productId: p.ref.id,
          productName: p.name,
          type: 'KELUAR',
          amount: p.currentStock - p.newStock, // Selisih stok
          adminId: userId || 'system',
          source: 'ORDER', // Menandakan order online
          referenceId: orderId, // ID Order yang dapat dilihat user (e.g. ATY-XXXXX)
          orderId: orderRef.id, // ID Dokumen Order
          note: `Order Online #${orderId}`,
          fromWarehouseId: 'gudang-utama',
          prevStock: p.currentStock,
          nextStock: p.newStock,
          date: FieldValue.serverTimestamp()
        });
      }

      // 3. Update User & Logs
      if (userId && userRef) {
        if (finalPointsUsed > 0 || finalWalletUsed > 0) {
          // Safety Net: Ensure balance/points are sufficient before updating
          // Note: We already calculated finalWalletUsed = Math.min(currentWallet, ...), so technically safe.
          // But explicitly checking here adds a layer of protection.
          
          if (finalWalletUsed > 0) {
             const userData = userSnap?.data() as UserData;
             if ((userData.walletBalance || 0) < finalWalletUsed) {
                throw new Error("Safety Net Triggered: Saldo wallet tidak mencukupi saat finalisasi transaksi.");
             }
          }

          t.update(userRef, {
            points: FieldValue.increment(-finalPointsUsed),
            walletBalance: FieldValue.increment(-finalWalletUsed)
          });
        }
        
        if (finalPointsUsed > 0) {
          const logRef = adminDb.collection('point_logs').doc();
          t.set(logRef, { 
            userId, 
            pointsChanged: -finalPointsUsed, 
            type: 'REDEEM', 
            description: `Order #${orderId}`, 
            createdAt: FieldValue.serverTimestamp() 
          });
        }
        
        if (finalWalletUsed > 0) {
          const logRef = adminDb.collection('wallet_logs').doc();
          t.set(logRef, { 
            userId, 
            orderId, 
            amountChanged: -finalWalletUsed, 
            type: 'PAYMENT', 
            description: `Order #${orderId}`, 
            createdAt: FieldValue.serverTimestamp() 
          });
        }

        // 4. Clear Cart
        const cartRef = adminDb.collection('carts').doc(userId);
        t.set(cartRef, { items: [], updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }

      // 5. Update Voucher
      if (voucherRef) {
        t.update(voucherRef, { status: 'USED' });
      }
    });

    return NextResponse.json({ success: true, orderId, firebaseId: orderRef.id });

  } catch (error: unknown) {
    console.error('Order Creation Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
