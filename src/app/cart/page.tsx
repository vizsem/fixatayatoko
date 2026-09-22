// src/app/cart/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import { ChevronLeft, Loader2, ShoppingBag } from 'lucide-react';
import notify from '@/lib/notify';
import { CartItem, UserProfile, Voucher } from '@/lib/types';
import * as Sentry from '@sentry/nextjs';

// Components
import { CartItemCard } from '@/components/cart/CartItemCard';
import { CartPromoBanner } from '@/components/cart/CartPromoBanner';
import { CheckoutForms } from '@/components/cart/CheckoutForms';
import { CheckoutSummary } from '@/components/cart/CheckoutSummary';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_DELIVERY_METHODS,
  DeliveryMethodConfig,
  calculateDeliveryCost
} from '@/lib/shipping';

import { auth, collection, db, doc, getDoc, getDocs, limit, query, where } from '@/lib/firebase';

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [promoProduct, setPromoProduct] = useState<CartItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delivery & Shipping State
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethodConfig[]>(DEFAULT_DELIVERY_METHODS);
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('delivery');
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>('KURIR_RING1');

  // Form State
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '' });
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris_bri' | 'wallet' | 'tempo'>('cash');
  const [tempoDueDate, setTempoDueDate] = useState('');
  const [usePoints, setUsePoints] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [useProfileAddress, setUseProfileAddress] = useState(true);
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);

  // Helper Functions
  const getItemId = (item: CartItem) => String(item.id || (item as any).ID || (item as any).productId || '');
  const getBaseUnit = (item: CartItem) => String((item.baseUnit || (item as any).Satuan || item.unit || 'PCS') as string).toUpperCase();

  const getAvailableUnits = useCallback((item: CartItem) => {
    const raw = (item.units || (item as any).availableUnits || []) as Array<{ code: string; contains: number; price?: number }>;
    const baseUnit = getBaseUnit(item);
    const normalized = raw.map(u => ({ code: String(u.code || '').toUpperCase(), contains: Math.max(1, Math.floor(Number(u.contains || 1))), price: u.price })).filter(u => u.code);
    const uniq = new Map<string, { code: string; contains: number }>();
    if (!normalized.some(u => u.code === baseUnit)) uniq.set(baseUnit, { code: baseUnit, contains: 1 });
    normalized.forEach(u => uniq.set(u.code, u));
    return Array.from(uniq.values());
  }, []);

  const getLineTotal = useCallback((item: CartItem) => {
    const qty = Math.max(1, Math.floor(Number(item.quantity || 0)));
    const basePrice = Number(item.basePrice ?? (item as any).Ecer ?? item.price ?? 0);
    const contains = Math.max(1, Math.floor(Number(item.unitContains || 1)));

    const unit = String(item.unit || getBaseUnit(item)).toUpperCase();
    const available = getAvailableUnits(item);
    const selected = available.find(u => u.code === unit);
    const price = (selected as any)?.price ?? (basePrice * contains);

    return item.promoType === 'TEBUS_MURAH' ? 10000 : price * qty;
  }, [getAvailableUnits]);

  const persistCart = useCallback((nextCart: CartItem[]) => {
    setCart(nextCart);
    localStorage.setItem('cart', JSON.stringify(nextCart));
    window.dispatchEvent(new Event('cart-updated'));
  }, []);

  // Fetch Logic & Load Delivery Settings
  useEffect(() => {
    const initialize = async () => {
      try {
        const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
        const { data: { user } } = await supabase.auth.getUser();

        // Fetch store delivery methods
        try {
          const sysSnap = await getDoc(doc(db, 'settings', 'system'));
          if (sysSnap.exists()) {
            const sysData = sysSnap.data() as any;
            if (Array.isArray(sysData.deliveryMethods) && sysData.deliveryMethods.length > 0) {
              setDeliveryMethods(sysData.deliveryMethods);
            }
          }
        } catch (e) {
          console.warn('Fallback to default delivery methods');
        }

        if (user) {
          setUserId(user.id);
          const [uSnap, cSnap] = await Promise.all([
            getDoc(doc(db, 'users', user.id)),
            getDoc(doc(db, 'carts', user.id))
          ]);
          if (uSnap.exists()) {
            const uData = uSnap.data() as UserProfile;
            setUserData(uData);
            setCustomer({
              name: uData.name || '',
              phone: uData.phone || '',
              address: (uData.addresses?.[0]?.address as string) || ''
            });
          }
          setCart(cSnap.exists() ? cSnap.data().items : localCart);
        } else {
          setCart(localCart);
        }
        setIsLoaded(true);

        // Fetch Promo
        const pSnap = await getDocs(query(collection(db, 'products'), where('stock', '>', 0), where('status', '==', 'active'), limit(1)));
        if (!pSnap.empty) setPromoProduct({ id: pSnap.docs[0].id, ...pSnap.docs[0].data() } as CartItem);
      } catch (err) { Sentry.captureException(err); }
    };
    initialize();
  }, []);

  // Active delivery method object
  const activeDeliveryMethod = useMemo(() => {
    if (deliveryMethod === 'pickup') {
      return deliveryMethods.find(d => d.id === 'PICKUP') || DEFAULT_DELIVERY_METHODS[0];
    }
    return (
      deliveryMethods.find(d => d.id === selectedDeliveryId) ||
      deliveryMethods.find(d => d.type === 'KURIR_TOKO') ||
      DEFAULT_DELIVERY_METHODS[1]
    );
  }, [deliveryMethod, selectedDeliveryId, deliveryMethods]);

  // Calculations (Subtotal, Ongkir, Diskon, Total)
  const calculations = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + getLineTotal(item), 0);

    // Hitung Ongkir dengan Rumus Anti-Boncos & Minimal Belanja
    const deliveryRate = calculateDeliveryCost(activeDeliveryMethod, subtotal);
    const shippingCost = deliveryMethod === 'pickup' ? 0 : deliveryRate.finalCost;

    const pointsToUse = usePoints ? Math.min(userData?.points || 0, subtotal * 0.5) : 0;
    const voucherDiscount = appliedVoucher?.value || 0;

    const baseTotal = Math.max(0, subtotal + shippingCost - pointsToUse - voucherDiscount);
    const walletToUse = useWallet ? Math.min(userData?.walletBalance || 0, baseTotal) : 0;
    const total = Math.max(0, baseTotal - walletToUse);

    return {
      subtotal,
      shippingCost,
      shippingMethodName: deliveryMethod === 'pickup' ? 'Ambil di Gudang' : activeDeliveryMethod.name,
      pointsToUse,
      voucherDiscount,
      walletToUse,
      total,
      deliveryRate
    };
  }, [cart, getLineTotal, activeDeliveryMethod, deliveryMethod, usePoints, useWallet, userData, appliedVoucher]);

  const validation = useMemo(() => {
    if (cart.length === 0) return { ok: false, msg: "Keranjang belanja masih kosong" };
    if (!customer.name.trim()) return { ok: false, msg: "Nama penerima wajib diisi" };
    if (!customer.phone.trim()) return { ok: false, msg: "Nomor WhatsApp wajib diisi" };
    if (deliveryMethod === 'delivery' && !customer.address.trim()) return { ok: false, msg: "Alamat lengkap pengiriman wajib diisi" };

    // Check purchase limits
    for (const item of cart) {
      const min = Number(item.minPurchase || 1);
      const max = Number(item.maxPurchase || 0);
      const qty = Number(item.quantity || 1);
      if (qty < min) return { ok: false, msg: `Minimal pembelian ${item.name} adalah ${min}` };
      if (max > 0 && qty > max) return { ok: false, msg: `Maksimal pembelian ${item.name} adalah ${max}` };
    }

    return { ok: true, msg: "" };
  }, [cart, customer, deliveryMethod]);

  const handleCheckout = async () => {
    if (!validation.ok) return notify.user.error(validation.msg);
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(i => ({ id: getItemId(i), quantity: i.quantity, unit: i.unit, contains: i.unitContains, promoType: i.promoType })),
          customer,
          delivery: {
            method: calculations.shippingMethodName,
            type: activeDeliveryMethod.type,
            cost: calculations.shippingCost,
            address: deliveryMethod === 'pickup' ? 'Gudang Pusat ATAYATOKO (Tamanan, Kediri)' : customer.address,
            zone: activeDeliveryMethod.zone,
          },
          payment: { method: paymentMethod },
          userId, usePoints, useWallet
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Checkout gagal');

      persistCart([]);
      router.push(`/success?id=${result.orderId}`);
    } catch (err: any) {
      notify.user.error(err.message);
      Sentry.captureException(err);
    } finally { setIsSubmitting(false); }
  };

  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-emerald-600" /></div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4 flex items-center gap-4 sticky top-0 z-[100] shadow-sm">
        <button onClick={() => router.back()} className="p-2.5 bg-slate-50 text-slate-900 rounded-xl hover:bg-slate-100 transition-all">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800">Proses Pembayaran</h1>
        <div className="ml-auto opacity-40">
          <NextImage src="/logo-atayatoko.png" alt="Logo" width={80} height={20} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 lg:p-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <CartPromoBanner
            product={promoProduct}
            onTake={() => {
              const baseUnit = getBaseUnit(promoProduct!);
              persistCart([...cart, { ...promoProduct!, quantity: 1, promoType: 'TEBUS_MURAH', unit: baseUnit, unitContains: 1 } as CartItem]);
              notify.success('Promo tebus murah diterapkan!');
            }}
          />

          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
                <ShoppingBag size={18} className="text-emerald-600" /> Daftar Belanja Anda
              </h2>
              <span className="bg-slate-50 px-4 py-1.5 rounded-full text-[10px] font-black text-slate-400">{cart.length} item</span>
            </div>

            <div className="space-y-4">
              {cart.length === 0 ? (
                <div className="py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs italic">Keranjang kosong...</div>
              ) : (
                cart.map(item => (
                  <CartItemCard
                    key={getItemId(item)}
                    item={item}
                    onUpdateQty={(id, q) => persistCart(cart.map(i => getItemId(i) === id ? { ...i, quantity: q } : i))}
                    onUpdateUnit={(id, u) => persistCart(cart.map(i => getItemId(i) === id ? { ...i, unit: u, unitContains: getAvailableUnits(i).find(unit => unit.code === u)?.contains || 1 } : i))}
                    onRemove={(id) => persistCart(cart.filter(i => getItemId(i) !== id))}
                    availableUnits={getAvailableUnits(item)}
                    lineTotal={getLineTotal(item)}
                  />
                ))
              )}
            </div>
          </div>

          <CheckoutForms
            customer={customer} setCustomer={setCustomer}
            deliveryMethod={deliveryMethod} setDeliveryMethod={setDeliveryMethod}
            selectedDeliveryId={selectedDeliveryId} setSelectedDeliveryId={setSelectedDeliveryId}
            subtotal={calculations.subtotal}
            customDeliveryMethods={deliveryMethods}
            paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
            tempoDueDate={tempoDueDate} setTempoDueDate={setTempoDueDate}
            profileAddresses={[]} selectedAddressIndex={0} setSelectedAddressIndex={() => {}}
            useProfileAddress={useProfileAddress} setUseProfileAddress={setUseProfileAddress}
            userData={userData}
          />
        </div>

        <div className="lg:col-span-1">
          <CheckoutSummary
            subtotal={calculations.subtotal}
            shippingCost={calculations.shippingCost}
            shippingMethodName={calculations.shippingMethodName}
            pointsToUse={calculations.pointsToUse}
            voucherDiscount={calculations.voucherDiscount}
            walletToUse={calculations.walletToUse}
            total={calculations.total}
            isSubmitting={isSubmitting}
            onCheckout={handleCheckout}
            canCheckout={validation.ok}
            validationMsg={validation.msg}
          />
        </div>
      </main>
    </div>
  );
}
