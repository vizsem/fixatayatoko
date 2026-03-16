'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, doc, getDoc, getDocs, serverTimestamp, query, orderBy, runTransaction, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import notify from '@/lib/notify';
import { deductStockTx } from '@/lib/inventory';
import { Toaster } from 'react-hot-toast';
import {
  ChevronLeft,
  ShoppingBag,
  Search,
  Camera,
  Plus,
  Trash2,
  Save,
  Store,
  CreditCard
} from 'lucide-react';

type Channel = 'SHOPEE' | 'TIKTOK';

type Product = {
  id: string;
  name: string;
  Nama?: string;
  Ecer?: number;
  price?: number;
  Satuan?: string;
  unit?: string;
  stock?: number;
  isActive?: boolean;
  Status?: number;
  channelPricing?: {
    offline?: {
      price?: number;
      wholesalePrice?: number;
    };
    website?: {
      price?: number;
      wholesalePrice?: number;
    };
    shopee?: {
      price?: number;
      wholesalePrice?: number;
    };
    tiktok?: {
      price?: number;
      wholesalePrice?: number;
    };
  };
};

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  conversion?: number;
  availableUnits?: { code: string; contains: number }[];
};

export default function MarketplaceOrdersPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState<Channel>('SHOPEE');
  const [externalOrderId, setExternalOrderId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('TRANSFER');
  const [shippingCost, setShippingCost] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        notify.admin.error('Akses ditolak. Hanya admin yang dapat mengakses halaman ini.');
        router.push('/profil');
        return;
      }
      setAuthorized(true);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    const fetchProducts = async () => {
      const q = query(
        collection(db, 'products'),
        orderBy('name', 'asc')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as Product));
      const active = list.filter((p) => (typeof p.isActive === 'boolean' ? p.isActive : typeof p.Status === 'number' ? p.Status === 1 : true));
      setProducts(active);
    };
    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!search) return [];
    const lower = search.toLowerCase();
    return products
      .filter(p => {
        const name = p.name || p.Nama || '';
        return name.toLowerCase().includes(lower);
      })
      .slice(0, 8);
  }, [products, search]);

  const addToCart = (product: Product) => {
    const existing = cart.find(c => c.id === product.id);
    const baseName = product.name || product.Nama || 'Produk';
    const baseUnit = product.unit || product.Satuan || 'pcs';
    const availableUnits = (product as any).units || [];
    const defaultUnit = Array.isArray(availableUnits) && availableUnits.length > 0 ? availableUnits[0] : { code: baseUnit, contains: 1 };
    const availableStock = product.stock ?? 0;
    if (availableStock <= 0) {
      notify.admin.error(`Stok kosong: ${baseName}`);
      return;
    }

    let basePrice = Number(product.Ecer || product.price || 0);
    if (product.channelPricing) {
      if (channel === 'SHOPEE' && product.channelPricing.shopee?.price != null) {
        basePrice = Number(product.channelPricing.shopee.price);
      }
      if (channel === 'TIKTOK' && product.channelPricing.tiktok?.price != null) {
        basePrice = Number(product.channelPricing.tiktok.price);
      }
    }

    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([
        ...cart,
        {
          id: product.id,
          name: baseName,
          price: basePrice,
          quantity: 1,
          unit: defaultUnit.code || baseUnit,
          conversion: defaultUnit.contains || 1,
          availableUnits: availableUnits
        }
      ]);
    }
    setSearch('');
  };

  const handleScan = async (code: string) => {
    try {
      // Cari berdasar Barcode (variasi field)
      const q1 = query(collection(db, 'products'), where('Barcode', '==', code));
      const s1 = await getDocs(q1);
      let prod: any | null = null;
      if (!s1.empty) {
        const d = s1.docs[0];
        prod = { id: d.id, ...d.data() };
      } else {
        const q2 = query(collection(db, 'products'), where('barcode', '==', code));
        const s2 = await getDocs(q2);
        if (!s2.empty) {
          const d2 = s2.docs[0];
          prod = { id: d2.id, ...d2.data() };
        }
      }
      if (!prod) {
        notify.admin.error('Barcode tidak ditemukan');
        return;
      }
      addToCart(prod as Product);
      setShowScanner(false);
    } catch {
      notify.admin.error('Gagal membaca barcode');
    }
  };

  useEffect(() => {
    let scanner: any = null;
    const init = async () => {
      if (!showScanner || scannerReady) return;
      const mod: any = await import('html5-qrcode');
      const Html5QrcodeScanner = mod.Html5QrcodeScanner;
      scanner = new Html5QrcodeScanner('mp-scanner', { fps: 10, qrbox: 200 }, false);
      scanner.render((decodedText: string) => handleScan(decodedText), () => {});
      setScannerReady(true);
    };
    init();
    return () => {
      const el = document.getElementById('mp-scanner');
      if (el) el.innerHTML = '';
      setScannerReady(false);
    };
  }, [showScanner, scannerReady]);
  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const updateCartItem = (id: string, field: keyof CartItem, value: string | number) => {
    setCart(cart.map(item =>
      item.id === id ? { ...item, [field]: field === 'quantity' || field === 'price' || field === 'conversion' ? Number(value) : value } : item
    ));
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const total = subtotal + shippingCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorized) return;
    if (!cart.length) {
      notify.admin.error('Tambahkan minimal satu produk.');
      return;
    }
    setLoading(true);
    try {
      // Preflight stock validation BEFORE creating order
      // REMOVED: This validation is redundant and potentially buggy if not atomic.
      // We rely on deductStockTx to throw if stock is insufficient during transaction.

      // Atomic transaction with idempotency key
      await runTransaction(db, async (tx) => {
        // --- PHASE 1: READS ---
        
        // 1a. Check Idempotency Key
        let idempKeyRef = null;
        if (externalOrderId) {
          const idempKey = `mp:${channel}:${externalOrderId}`;
          idempKeyRef = doc(db, 'action_keys', idempKey);
          const keySnap = await tx.get(idempKeyRef);
          if (keySnap.exists()) {
            throw new Error('Order marketplace dengan ID ini sudah diproses.');
          }
        }

        // 1b. Read All Product Stocks
        // We cannot use deductStockTx here because it mixes read/write.
        // We must implement the deduction logic manually in batch.
        // NOTE: Promise.all works for concurrent reads, but we need to ensure the refs are unique if duplicate items?
        // Cart should have unique items by ID ideally.
        const productRefs = cart.map(item => doc(db, 'products', item.id));
        const productSnaps = [];
        
        // Sequential read to be absolutely safe with Firestore transaction requirements
        for (const ref of productRefs) {
          productSnaps.push(await tx.get(ref));
        }
        
        // --- PHASE 2: VALIDATION & LOGIC ---
        
        const updates: { ref: any, data: any }[] = [];
        const logs: { ref: any, data: any }[] = [];

        productSnaps.forEach((pSnap, idx) => {
          if (!pSnap.exists()) throw new Error(`Produk tidak ditemukan (ID: ${cart[idx].id})`);
          
          const item = cart[idx];
          const pData: any = pSnap.data();
          const currentStock = Number(pData.stock || 0);
          const deductionQty = (item.quantity || 0) * (item.conversion || 1);

          if (currentStock < deductionQty) {
            throw new Error(`Stok tidak cukup: ${item.name}. Sisa: ${currentStock}, Butuh: ${deductionQty}`);
          }

          // Calculate new stock distribution
          const stockByWarehouse: Record<string, number> = pData.stockByWarehouse || {};
          const nextByWarehouse: Record<string, number> = { ...stockByWarehouse };
          let remaining = deductionQty;
          const mainWarehouseId = 'gudang-utama';

          // Prioritize Main Warehouse
          if (nextByWarehouse[mainWarehouseId] && nextByWarehouse[mainWarehouseId] > 0) {
            const cut = Math.min(nextByWarehouse[mainWarehouseId], remaining);
            nextByWarehouse[mainWarehouseId] -= cut;
            remaining -= cut;
          }

          // Then others
          if (remaining > 0) {
            for (const [whId, qty] of Object.entries(nextByWarehouse)) {
              if (whId === mainWarehouseId) continue;
              if (remaining <= 0) break;
              const cut = Math.min(qty as number, remaining);
              nextByWarehouse[whId] = (qty as number) - cut;
              remaining -= cut;
            }
          }

          if (remaining > 0) {
             // Force deduct from main if somehow still remaining (negative stock allowed? No, usually error)
             // But we already checked total stock. So this case implies stockByWarehouse inconsistency.
             // We'll force deduct from main to keep total consistent even if it goes negative per warehouse
             nextByWarehouse[mainWarehouseId] = (nextByWarehouse[mainWarehouseId] || 0) - remaining;
          }

          const nextStock = currentStock - deductionQty;

          updates.push({
            ref: pSnap.ref,
            data: { stock: nextStock, stockByWarehouse: nextByWarehouse }
          });

          // Prepare Log
          logs.push({
            ref: doc(collection(db, 'inventory_logs')),
            data: {
              productId: item.id,
              productName: pData.name || pData.Nama || 'Produk',
              type: 'KELUAR',
              amount: deductionQty,
              adminId: auth.currentUser?.uid || 'admin',
              source: 'MARKETPLACE',
              note: `Order Marketplace ${channel} ${externalOrderId ? '(' + externalOrderId + ')' : ''}`,
              date: serverTimestamp(),
              prevStock: currentStock,
              nextStock
            }
          });
        });

        // --- PHASE 3: WRITES ---

        // 3a. Write Idempotency Key
        if (idempKeyRef) {
          tx.set(idempKeyRef, {
            createdAt: serverTimestamp(),
            channel,
            externalOrderId,
            by: auth.currentUser?.uid || 'admin'
          });
        }

        // 3b. Update Products
        updates.forEach(u => tx.update(u.ref, u.data));

        // 3c. Write Logs
        logs.forEach(l => tx.set(l.ref, l.data));

        // 3d. Create Order
        const orderDocRef = doc(collection(db, 'orders'));
        const itemsData = cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          unit: item.unit,
          productId: item.id
        }));

        tx.set(orderDocRef, {
          orderId: externalOrderId || null,
          customerName: customerName || 'Marketplace',
          userId: 'marketplace',
          items: itemsData,
          subtotal,
          shippingCost,
          total,
          status: 'SELESAI',
          paymentStatus: 'LUNAS',
          paymentMethod: paymentMethod,
          payment: { method: paymentMethod },
          delivery: {
            method: channel === 'SHOPEE' ? 'Shopee' : 'TikTok',
            address: 'Marketplace'
          },
          channel,
          createdAt: serverTimestamp()
        });
      });

      notify.admin.success('Order marketplace berhasil disimpan.');
      setCart([]);
      setExternalOrderId('');
      setCustomerName('');
      setShippingCost(0);
      router.push('/admin/reports/sales');
    } catch (err: any) {
      console.error(err);
      notify.admin.error(err.message || 'Gagal menyimpan order marketplace.');
    } finally {
      setLoading(false);
    }
  };

  if (!authorized) {
    return (
      <div className="p-8">
        <Toaster />
        <p className="text-sm text-gray-500">Memverifikasi akses admin...</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-10 bg-[#FBFBFE] min-h-screen pb-32 font-sans">
      <Toaster />
      <div className="flex items-center gap-4 mb-10">
        <Link href="/admin/orders" className="p-4 bg-white rounded-2xl shadow-sm hover:bg-black hover:text-white transition-all">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Order Marketplace</h1>
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">
            Input penjualan dari Shopee dan TikTok Shop
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                  <ShoppingBag size={14} /> Channel
                </label>
                <select
                  className="w-full bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none border-none ring-1 ring-gray-100 focus:ring-black transition-all"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as Channel)}
                >
                  <option value="SHOPEE">Shopee (Estimasi 2-3 Hari)</option>
                  <option value="TIKTOK">TikTok Shop (Estimasi 7-9 Hari)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                  <Store size={14} /> ID Order Marketplace
                </label>
                <input
                  className="w-full bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none border-none ring-1 ring-gray-100 focus:ring-black transition-all"
                  placeholder="Isi nomor order Shopee/TikTok (opsional)"
                  value={externalOrderId}
                  onChange={(e) => setExternalOrderId(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                  Nama Pelanggan
                </label>
                <input
                  className="w-full bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none border-none ring-1 ring-gray-100 focus:ring-black transition-all"
                  placeholder="Nama pelanggan (opsional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                  <CreditCard size={14} /> Metode Pembayaran
                </label>
                <select
                  className="w-full bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none border-none ring-1 ring-gray-100 focus:ring-black transition-all"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="TRANSFER">Transfer</option>
                  <option value="COD">COD</option>
                  <option value="OTHER">Lainnya</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  className="w-full bg-gray-50 pl-12 pr-6 py-5 rounded-2xl text-xs font-bold outline-none"
                  placeholder="Cari produk untuk ditambahkan ke order marketplace..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowScanner(!showScanner)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-1"
                >
                  <Camera size={12} /> Scan
                </button>
                {showScanner && (
                  <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100" id="mp-scanner" />
                )}
                {search && (
                  <div className="absolute top-full left-0 w-full bg-white mt-2 rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                    {filteredProducts.map(p => {
                      const name = p.name || p.Nama || 'Produk';
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addToCart(p)}
                          className="w-full p-4 text-left hover:bg-gray-50 flex justify-between items-center group"
                        >
                          <div>
                            <p className="text-xs font-black uppercase text-gray-800">{name}</p>
                            <p className="text-[9px] font-bold text-gray-400">
                              Stok: {p.stock ?? 0} {p.unit || p.Satuan || 'pcs'}
                            </p>
                          </div>
                          <Plus size={16} className="text-gray-300 group-hover:text-black" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="md:hidden space-y-4 mb-6">
              {cart.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-gray-100 shadow-lg">
                  <ShoppingBag className="mx-auto text-gray-200 mb-4" size={40} />
                  <p className="text-[10px] font-black text-gray-400 tracking-widest">KERANJANG KOSONG</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-lg flex flex-col gap-4">
                     <div className="flex justify-between items-start">
                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">{item.name}</h3>
                        <button
                           type="button"
                           onClick={() => removeFromCart(item.id)}
                           className="p-2 bg-red-50 text-red-500 rounded-xl"
                        >
                           <Trash2 size={14} />
                        </button>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 p-2 rounded-xl">
                           <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Qty</label>
                           <input
                              type="number"
                              className="w-full bg-transparent text-xs font-black text-center outline-none"
                              value={item.quantity}
                              onChange={(e) => updateCartItem(item.id, 'quantity', e.target.value)}
                              min={1}
                           />
                        </div>
                        <div className="bg-gray-50 p-2 rounded-xl">
                           <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Harga Satuan</label>
                           <input
                              type="number"
                              className="w-full bg-transparent text-xs font-black text-center outline-none"
                              value={item.price}
                              onChange={(e) => updateCartItem(item.id, 'price', e.target.value)}
                              min={0}
                           />
                        </div>
                        <div className="bg-gray-50 p-2 rounded-2xl">
                           <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Satuan</label>
                           <select
                             className="w-full bg-white p-3 rounded-xl text-sm font-black text-center outline-none ring-1 ring-gray-100 focus:ring-black uppercase"
                             value={item.unit}
                             onChange={(e) => {
                               const newUnit = e.target.value;
                               const found = item.availableUnits?.find(u => u.code === newUnit);
                               updateCartItem(item.id, 'unit', newUnit);
                               updateCartItem(item.id, 'conversion', found?.contains || 1);
                             }}
                           >
                             {item.availableUnits && item.availableUnits.length > 0 ? (
                               item.availableUnits.map(u => (
                                 <option key={u.code} value={u.code}>{u.code}</option>
                               ))
                             ) : (
                               <option value={item.unit}>{item.unit}</option>
                             )}
                           </select>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-2xl">
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Isi (Pcs)</label>
                          <input
                            type="number"
                            className="w-full bg-white p-3 rounded-xl text-sm font-black text-center outline-none ring-1 ring-gray-100 focus:ring-black"
                            value={item.conversion || 1}
                            onChange={(e) => updateCartItem(item.id, 'conversion', e.target.value)}
                            min={1}
                          />
                        </div>
                     </div>

                     <div className="flex justify-between items-center border-t border-gray-50 pt-3">
                        <span className="text-[10px] font-black text-gray-400 uppercase">Subtotal</span>
                        <span className="text-sm font-black text-gray-900">Rp {(item.quantity * item.price).toLocaleString()}</span>
                     </div>
                  </div>
                ))
              )}
            </div>
            <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-left min-w-[680px] md:min-w-0">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-3 md:px-8 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase">Produk</th>
                  <th className="px-3 md:px-6 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase text-center">Qty</th>
                  <th className="px-3 md:px-6 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase text-center">Satuan</th>
                  <th className="px-3 md:px-6 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase text-center">Isi (Pcs)</th>
                  <th className="px-3 md:px-6 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase text-center">Harga</th>
                  <th className="px-3 md:px-8 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cart.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 md:px-8 py-3 md:py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-gray-800 uppercase">{item.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="text-[9px] text-red-500 font-black uppercase mt-1 flex items-center gap-1 hover:underline"
                        >
                          <Trash2 size={10} /> Hapus
                        </button>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <div className="flex items-center justify-center">
                        <input
                          type="number"
                          className="w-16 bg-gray-50 p-2 rounded-lg text-xs font-black text-center outline-none"
                          value={item.quantity}
                          onChange={(e) => updateCartItem(item.id, 'quantity', e.target.value)}
                          min={1}
                        />
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                      <select
                        className="bg-gray-50 p-2 rounded-lg text-xs font-black text-center outline-none uppercase"
                        value={item.unit}
                        onChange={(e) => {
                          const newUnit = e.target.value;
                          const found = item.availableUnits?.find(u => u.code === newUnit);
                          updateCartItem(item.id, 'unit', newUnit);
                          updateCartItem(item.id, 'conversion', found?.contains || 1);
                        }}
                      >
                        {item.availableUnits && item.availableUnits.length > 0 ? (
                          item.availableUnits.map(u => (
                            <option key={u.code} value={u.code}>{u.code}</option>
                          ))
                        ) : (
                          <option value={item.unit}>{item.unit}</option>
                        )}
                      </select>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                      <input
                        type="number"
                        className="w-16 bg-gray-50 p-2 rounded-lg text-xs font-black text-center outline-none"
                        value={item.conversion || 1}
                        onChange={(e) => updateCartItem(item.id, 'conversion', e.target.value)}
                        min={1}
                      />
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                      <input
                        type="number"
                        className="w-28 bg-gray-50 p-2 rounded-lg text-xs font-black text-center outline-none"
                        value={item.price}
                        onChange={(e) => updateCartItem(item.id, 'price', e.target.value)}
                        min={0}
                      />
                    </td>
                    <td className="px-3 md:px-8 py-3 md:py-4 text-right text-xs font-black text-gray-800">
                      Rp {(item.quantity * item.price).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {!cart.length && (
                  <tr>
                    <td colSpan={6} className="px-3 md:px-8 py-10 text-center text-[11px] font-bold text-gray-400">
                      Belum ada produk di order marketplace ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-800 uppercase tracking-[0.2em] flex items-center gap-2">
              <ShoppingBag size={16} /> Ringkasan Order
            </h2>
            <div className="flex items-center justify-between text-xs font-bold text-gray-600">
              <span>Subtotal</span>
              <span>Rp {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-gray-600">
              <span>Ongkir / Biaya Lain</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">Rp</span>
                <input
                  type="number"
                  className="w-24 bg-gray-50 p-2 rounded-lg text-xs font-black text-right outline-none"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(Number(e.target.value))}
                  min={0}
                />
              </div>
            </div>
            <div className="border-t border-dashed border-gray-100 pt-4 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-gray-800 uppercase tracking-[0.2em]">Total</span>
                <span className="text-lg font-black text-gray-900">
                  Rp {total.toLocaleString()}
                </span>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !cart.length}
              className="mt-4 w-full bg-black text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {loading ? 'Menyimpan...' : 'Simpan Order'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
