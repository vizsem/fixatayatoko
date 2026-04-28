'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, getDoc, getDocs, serverTimestamp, runTransaction, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import notify from '@/lib/notify';
import { deductStockTx } from '@/lib/inventory';
import { Toaster } from 'react-hot-toast';
import {
  ChevronLeft,
  ShoppingBag,
  Save,
  Store,
  CreditCard,
  Truck,
  Hash,
  User,
  Activity
} from 'lucide-react';

import { ProductSearchList } from '@/components/admin/marketplace/ProductSearchList';
import { CartTable } from '@/components/admin/marketplace/CartTable';
import { Product } from '@/lib/types';
import * as Sentry from '@sentry/nextjs';

type Channel = 'SHOPEE' | 'TIKTOK';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
}

export default function MarketplaceOrdersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [channel, setChannel] = useState<Channel>('SHOPEE');
  const [externalOrderId, setExternalOrderId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('TRANSFER');
  const [shippingCost, setShippingCost] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/profil/login'); return; }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.data()?.role !== 'admin') { router.push('/'); return; }
      fetchProducts();
    });
    return () => unsubAuth();
  }, [router]);

  const fetchProducts = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'products'), where('isActive', '==', true)));
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    } catch (err) {
      Sentry.captureException(err);
      notify.error("Gagal memuat produk");
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];
    return products.filter(p => 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p as any).sku?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10);
  }, [products, searchTerm]);

  const handleAddToCart = (p: Product) => {
    const price = channel === 'SHOPEE' ? p.priceShopee : channel === 'TIKTOK' ? p.priceTiktok : p.priceEcer;
    setCart(prev => {
      const existing = prev.find(item => item.id === p.id);
      if (existing) {
        return prev.map(item => item.id === p.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, {
        id: p.id,
        name: p.name || '',
        price: price || 0,
        quantity: 1,
        unit: p.unit || 'Pcs'
      }];
    });
    setSearchTerm('');
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const total = subtotal + shippingCost;

  const handleSaveOrder = async () => {
    if (cart.length === 0) return notify.error("Keranjang kosong");
    if (!externalOrderId) return notify.error("Order ID Marketplace wajib diisi");
    
    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(collection(db, 'orders'));
        const orderData = {
          orderId: `MKT-${Date.now()}`,
          externalOrderId,
          customerName: customerName || `Customer ${channel}`,
          items: cart,
          subtotal,
          shippingCost,
          total,
          channel,
          paymentMethod,
          status: 'SELESAI',
          createdAt: serverTimestamp(),
          adminId: auth.currentUser?.uid
        };

        transaction.set(orderRef, orderData);

        for (const item of cart) {
          await deductStockTx(transaction, {
            productId: item.id,
            amount: item.quantity,
            adminId: auth.currentUser?.uid || 'system',
            source: 'MARKETPLACE',
            note: `Marketplace Order: ${channel} - ${externalOrderId}`
          });
        }
      });

      notify.success("Pesanan marketplace berhasil disimpan");
      setCart([]);
      setExternalOrderId('');
      setCustomerName('');
      setShippingCost(0);
    } catch (err) {
      Sentry.captureException(err);
      notify.error("Gagal menyimpan pesanan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 md:p-6 bg-[#FBFBFE] min-h-screen pb-32">
      <Toaster position="top-right" />
      
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl transition-all"><ChevronLeft size={20} /></button>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <ShoppingBag className="text-orange-500" /> Marketplace Input
              </h1>
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-10">Manual Marketplace Entry</p>
          </div>

          <div className="flex bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm">
            <button onClick={() => setChannel('SHOPEE')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${channel === 'SHOPEE' ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'text-gray-400 hover:bg-gray-50'}`}>SHOPEE</button>
            <button onClick={() => setChannel('TIKTOK')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${channel === 'TIKTOK' ? 'bg-black text-white shadow-lg shadow-gray-200' : 'text-gray-400 hover:bg-gray-50'}`}>TIKTOK</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <Hash size={12} /> Order ID Marketplace
                </label>
                <input 
                  type="text" 
                  value={externalOrderId} 
                  onChange={e => setExternalOrderId(e.target.value)}
                  placeholder="Contoh: 240427SHPXXX" 
                  className="w-full bg-gray-50 p-4 rounded-2xl text-xs font-black outline-none border border-transparent focus:border-orange-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <User size={12} /> Nama Pembeli (Opsional)
                </label>
                <input 
                  type="text" 
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Nama Customer..." 
                  className="w-full bg-gray-50 p-4 rounded-2xl text-xs font-black outline-none border border-transparent focus:border-blue-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <Truck size={12} /> Ongkos Kirim
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">Rp</span>
                  <input 
                    type="number" 
                    value={shippingCost}
                    onChange={e => setShippingCost(Number(e.target.value))}
                    className="w-full bg-gray-50 p-4 pl-10 rounded-2xl text-xs font-black outline-none border border-transparent focus:border-green-500 transition-all"
                  />
                </div>
              </div>
            </div>

            <CartTable 
              cart={cart} 
              onUpdateQty={updateQty} 
              onRemove={removeFromCart} 
            />
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="h-[400px]">
              <ProductSearchList 
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                products={filteredProducts}
                onAddToCart={handleAddToCart}
                channel={channel}
              />
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12">
                <Store size={120} />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="flex justify-between items-center text-gray-400">
                  <span className="text-[10px] font-black uppercase tracking-widest">Subtotal</span>
                  <span className="text-xs font-black">Rp{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-gray-400">
                  <span className="text-[10px] font-black uppercase tracking-widest">Shipping</span>
                  <span className="text-xs font-black">Rp{shippingCost.toLocaleString()}</span>
                </div>
                <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-widest">Grand Total</span>
                  <span className="text-2xl font-black text-orange-600">Rp{total.toLocaleString()}</span>
                </div>

                <div className="pt-6 space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <CreditCard className="text-gray-400" size={18} />
                    <select 
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none w-full"
                    >
                      <option value="TRANSFER">Transfer Bank</option>
                      <option value="CASH">Saldo Marketplace</option>
                      <option value="QRIS">QRIS / E-Wallet</option>
                    </select>
                  </div>

                  <button 
                    onClick={handleSaveOrder}
                    disabled={loading || cart.length === 0}
                    className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-gray-200 hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    {loading ? <Activity className="animate-spin" size={16} /> : <Save size={16} />}
                    Simpan Pesanan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
