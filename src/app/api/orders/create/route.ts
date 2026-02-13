import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  increment, 
  serverTimestamp, 
  query, 
  where, 
} from 'firebase/firestore';

type IncomingItem = {
  id: string;
  quantity: number;
  promoType?: 'TEBUS_MURAH' | string;
};

// Helper to generate Order ID
const generateOrderId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return `ATY-${result}`;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, customer, delivery, payment, userId, voucherCode, usePoints } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Keranjang kosong' }, { status: 400 });
    }

    // Sort items: Normal first, Promo last agar subtotal valid untuk syarat promo
    items.sort((a: IncomingItem, b: IncomingItem) => Number(!!a.promoType) - Number(!!b.promoType));

    // 1. Validasi & Kalkulasi Ulang Total (Server-Side)
    let calculatedSubtotal = 0;
    const validatedItems = [];
    
    // Gunakan Transaction untuk atomicity (Stok & Validasi Harga)
    // Catatan: Client SDK transaction di server environment mungkin memiliki limitasi tanpa Service Account,
    // tapi kita coba best effort dengan logic validasi dulu. 
    // Untuk simplifikasi dan menghindari masalah lock di Client SDK non-admin, kita fetch dulu lalu write.
    // Idealnya gunakan firebase-admin transaction.

    for (const item of items) {
      const productRef = doc(db, 'products', item.id);
      const productSnap = await getDoc(productRef);

      if (!productSnap.exists()) {
        return NextResponse.json({ error: `Produk dengan ID ${item.id} tidak ditemukan` }, { status: 404 });
      }

      const productData = productSnap.data();
      
      // Cek Stok
      if (productData.stock < item.quantity) {
        return NextResponse.json({ error: `Stok ${productData.name} tidak mencukupi (Sisa: ${productData.stock})` }, { status: 400 });
      }

      // Hitung Harga (Logika Grosir)
      let price = Number(productData.price || productData.Ecer || 0);
      const wholesalePrice = Number(productData.wholesalePrice || productData.Grosir || 0);
      const minWholesale = Number(productData.minWholesale || productData.Min_Grosir || 10);

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
        name: productData.name || productData.Nama,
        price: price,
        quantity: item.quantity,
        image: productData.image || productData.Link_Foto,
        unit: productData.unit || productData.Satuan || 'pcs',
        total: lineTotal
      });
    }

    // 2. Validasi Voucher
    let voucherDiscount = 0;
    let appliedVoucherId = null;

    if (voucherCode && userId) {
      const vQuery = query(
        collection(db, 'user_vouchers'), 
        where('userId', '==', userId),
        where('code', '==', voucherCode),
        where('status', '==', 'ACTIVE')
      );
      const vSnap = await getDocs(vQuery);
      
      if (!vSnap.empty) {
        const vDoc = vSnap.docs[0];
        const vData = vDoc.data();
        voucherDiscount = Number(vData.value || 0);
        appliedVoucherId = vDoc.id;
      }
    }

    // 3. Validasi Poin
    let pointsUsed = 0;
    if (usePoints && userId) {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const availablePoints = userData.points || 0;
        const maxRedeemable = calculatedSubtotal * 0.5; // Maks 50% subtotal
        
        pointsUsed = Math.min(availablePoints, maxRedeemable);
      }
    }

    // 4. Hitung Total Akhir
    const total = Math.max(0, calculatedSubtotal - pointsUsed - voucherDiscount);
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
      createdAt: serverTimestamp()
    };

    const orderRef = await addDoc(collection(db, 'orders'), orderData);

    // 6. Update Side Effects (Stok, Poin, Voucher)
    // Note: Ini sebaiknya batch/transaction, tapi kita lakukan sequential untuk sekarang
    
    // Kurangi Stok
    for (const item of validatedItems) {
      await updateDoc(doc(db, 'products', item.id), {
        stock: increment(-item.quantity)
      });
    }

    // Potong Poin
    if (pointsUsed > 0 && userId) {
      await updateDoc(doc(db, 'users', userId), { 
        points: increment(-pointsUsed) 
      });
      await addDoc(collection(db, 'point_logs'), {
        userId, 
        pointsChanged: -pointsUsed, 
        type: 'REDEEM',
        description: `Checkout Order #${orderId}`, 
        createdAt: serverTimestamp()
      });
    }

    // Matikan Voucher
    if (appliedVoucherId) {
      await updateDoc(doc(db, 'user_vouchers', appliedVoucherId), { 
        status: 'USED' 
      });
    }

    // Kosongkan Cart
    if (userId) {
      await updateDoc(doc(db, 'carts', userId), { 
        items: [], 
        updatedAt: serverTimestamp() 
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
