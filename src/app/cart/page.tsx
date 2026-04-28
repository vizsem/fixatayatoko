'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import { auth, db, storage } from '@/lib/firebase';
import { collection, doc, getDoc, query, where, getDocs, limit, serverTimestamp, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ChevronLeft, Loader2, ShoppingBag } from 'lucide-react';
import notify from '@/lib/notify';
import { CartItem, UserProfile, Voucher } from '@/lib/types';
import * as Sentry from '@sentry/nextjs';

// Components
import { CartItemCard } from '@/components/cart/CartItemCard';
import { CartPromoBanner } from '@/components/cart/CartPromoBanner';
import { CheckoutForms } from '@/components/cart/CheckoutForms';
import { CheckoutSummary } from '@/components/cart/CheckoutSummary';

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [promoProduct, setPromoProduct] = useState<CartItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '' });
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris_bri' | 'wallet' | 'tempo'>('cash');
  const [tempoDueDate, setTempoDueDate] = useState('');
  const [usePoints, setUsePoints] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [useProfileAddress, setUseProfileAddress] = useState(true);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState(0);
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
    
    // Check for explicit unit price or calculate from base
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

  // Fetch Logic
  useEffect(() => {
    const initialize = async () => {
      try {
        const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
        onAuthStateChanged(auth, async (user) => {
          if (user) {
            setUserId(user.uid);
            const [uSnap, cSnap] = await Promise.all([
              getDoc(doc(db, 'users', user.uid)),
              getDoc(doc(db, 'carts', user.uid))
            ]);
            if (uSnap.exists()) {
               const uData = uSnap.data() as UserProfile;
               setUserData(uData);
               setCustomer({ name: uData.name || '', phone: uData.phone || '', address: (uData.addresses?.[0]?.address as string) || '' });
            }
            // Merge logic... simplified for refactor
            setCart(cSnap.exists() ? cSnap.data().items : localCart);
          } else {
            setCart(localCart);
          }
          setIsLoaded(true);
        });

        // Fetch Promo
        const pSnap = await getDocs(query(collection(db, 'products'), where('stock', '>', 0), where('status', '==', 'active'), limit(1)));
        if (!pSnap.empty) setPromoProduct({ id: pSnap.docs[0].id, ...pSnap.docs[0].data() } as CartItem);
      } catch (err) { Sentry.captureException(err); }
    };
    initialize();
  }, []);

  // Calculations
  const calculations = useMemo(() => {
    const subtotal = cart.reduce((t, i) => t + getLineTotal(i), 0);
    const maxPoints = subtotal * 0.5;
    const pointsToUse = usePoints ? Math.min(userData?.points || 0, maxPoints) : 0;
    const voucherDiscount = appliedVoucher?.value || 0;
    const baseTotal = Math.max(0, subtotal - pointsToUse - voucherDiscount);
    const walletToUse = useWallet ? Math.min(userData?.walletBalance || 0, baseTotal) : 0;
    const total = Math.max(0, baseTotal - walletToUse);
    
    return { subtotal, pointsToUse, voucherDiscount, walletToUse, total };
  }, [cart, getLineTotal, usePoints, useWallet, userData, appliedVoucher]);

  const validation = useMemo(() => {
    if (cart.length === 0) return { ok: false, msg: "Cart is empty" };
    if (!customer.name.trim()) return { ok: false, msg: "Recipient name required" };
    if (!customer.phone.trim()) return { ok: false, msg: "WhatsApp number required" };
    if (deliveryMethod === 'delivery' && !customer.address.trim()) return { ok: false, msg: "Delivery address required" };
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
          customer, delivery: { method: deliveryMethod, address: customer.address },
          payment: { method: paymentMethod },
          userId, usePoints, useWallet
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Checkout failed');
      
      persistCart([]);
      router.push(`/success?id=${result.orderId}`);
    } catch (err: any) {
      notify.user.error(err.message);
      Sentry.captureException(err);
    } finally { setIsSubmitting(false); }
  };

  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-green-600" /></div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4 flex items-center gap-4 sticky top-0 z-[100] shadow-sm">
        <button onClick={() => router.back()} className="p-2.5 bg-slate-50 text-slate-900 rounded-xl hover:bg-slate-100 transition-all">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800">Checkout Process</h1>
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
              notify.success('Promo applied!');
            }} 
          />

          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
             <div className="flex items-center justify-between mb-8">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
                   <ShoppingBag size={18} className="text-green-600" /> Your Cart
                </h2>
                <span className="bg-slate-50 px-4 py-1.5 rounded-full text-[10px] font-black text-slate-400">{cart.length} items</span>
             </div>

             <div className="space-y-4">
                {cart.length === 0 ? (
                  <div className="py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs italic">Empty...</div>
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
