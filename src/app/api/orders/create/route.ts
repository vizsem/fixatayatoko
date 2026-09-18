import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { addInventoryLog } from '@/lib/inventory';

type IncomingItem = {
  id: string;
  quantity: number;
  unit?: string;
  contains?: number;
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

    items.sort((a: IncomingItem, b: IncomingItem) => Number(!!a.promoType) - Number(!!b.promoType));

    let calculatedSubtotal = 0;
    const validatedItems: { id: string; name: string; price: number; quantity: number; baseQuantity: number; contains: number; image?: string; unit: string; total: number }[] = [];
    const productUpdates: { id: string; newStock: number; newStockByWarehouse: Record<string, number>; name: string; currentStock: number; baseQuantity: number }[] = [];

    const channelKey: ChannelKey =
      ['OFFLINE', 'SHOPEE', 'TIKTOK', 'WEBSITE'].includes(channel)
        ? channel
        : 'WEBSITE';

    const MAIN_WAREHOUSE_ID = 'gudang-utama';

    for (const item of items) {
      const { data: pRecord, error: pError } = await supabase
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

      const contains = Math.max(1, Math.floor(Number(item.contains || 1)));
      const baseQuantity = Math.max(1, Math.floor(Number(item.quantity || 0))) * contains;

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
      if (item.promoType === 'TEBUS_MURAH' && calculatedSubtotal >= 50000 && baseQuantity === 1) baseUnitPrice = 10000;

      const unit = String(item.unit || productData.unit || 'pcs');
      let unitPrice = baseUnitPrice * contains;
      const unitConfig = Array.isArray(productData.units) ? productData.units.find((u) => String(u.code || '').toUpperCase() === unit.toUpperCase()) : undefined;
      if (unitConfig?.price != null) {
        unitPrice = Number(unitConfig.price);
      }

      const lineTotal = unitPrice * Math.max(1, Math.floor(Number(item.quantity || 0)));
      calculatedSubtotal += lineTotal;

      validatedItems.push({
        id: item.id,
        name: productData.name || 'Produk Tanpa Nama',
        price: unitPrice,
        quantity: Math.max(1, Math.floor(Number(item.quantity || 0))),
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
      const { data: vList } = await supabase
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
    let userData: any = null;
    if (userId && (usePoints || useWallet)) {
      const { data: userRec } = await supabase.from('users').select('*').eq('id', userId).single();
      if (userRec) {
        userData = userRec.raw_data || {};
        const curPoints = Number(userRec.points ?? userData.points ?? 0);
        const curWallet = Number(userRec.wallet_balance ?? userData.walletBalance ?? 0);

        if (usePoints) pointsUsed = Math.min(curPoints, calculatedSubtotal * 0.5);
        if (useWallet) walletUsed = Math.min(curWallet, Math.max(0, calculatedSubtotal - pointsUsed - voucherDiscount));
      }
    }

    const total = Math.max(0, calculatedSubtotal - pointsUsed - voucherDiscount - walletUsed);
    const orderId = generateOrderId();
    const dbOrderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

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
      createdAt: now,
    };

    // 1. Insert order
    const { error: orderError } = await supabase.from('orders').insert({
      id: dbOrderId,
      order_id: orderId,
      user_id: userId || null,
      customer_name: customer.name || 'Pelanggan Umum',
      customer_phone: customer.phone || '-',
      status: 'PENDING',
      total,
      items: validatedItems,
      delivery,
      payment,
      raw_data: orderData,
      created_at: now,
      updated_at: now,
    });

    if (orderError) {
      console.error('Failed to insert order:', orderError);
      return NextResponse.json({ error: 'Gagal menyimpan pesanan: ' + orderError.message }, { status: 500 });
    }

    // 2. Update products stock & write inventory logs
    for (const p of productUpdates) {
      const { data: existingP } = await supabase.from('products').select('raw_data').eq('id', p.id).single();
      const pRaw = existingP?.raw_data || {};

      await supabase.from('products').update({
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

    // 3. Update points & wallet
    if (userId && (pointsUsed > 0 || walletUsed > 0)) {
      const curPoints = Number(userData?.points || 0);
      const curWallet = Number(userData?.walletBalance || 0);
      const newPoints = Math.max(0, curPoints - pointsUsed);
      const newWallet = Math.max(0, curWallet - walletUsed);

      await supabase.from('users').update({
        wallet_balance: newWallet,
        raw_data: {
          ...userData,
          points: newPoints,
          walletBalance: newWallet,
          updatedAt: now,
        },
        updated_at: now,
      }).eq('id', userId);

      if (pointsUsed > 0) {
        await supabase.from('point_logs').insert({
          id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          user_id: userId,
          points: -pointsUsed,
          description: `Order #${orderId}`,
          created_at: now,
        });
      }

      if (walletUsed > 0) {
        await supabase.from('wallet_logs').insert({
          id: `wl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          user_id: userId,
          amount: -walletUsed,
          description: `Order #${orderId}`,
          created_at: now,
        });
      }
    }

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
