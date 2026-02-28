'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, doc, getDoc, getDocs, serverTimestamp, updateDoc, query, orderBy } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';
import {
  ChevronLeft,
  ShoppingBag,
  Search,
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
          unit: baseUnit
        }
      ]);
    }
    setSearch('');
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const updateCartItem = (id: string, field: keyof CartItem, value: string | number) => {
    setCart(cart.map(item =>
      item.id === id ? { ...item, [field]: field === 'quantity' || field === 'price' ? Number(value) : value } : item
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
      const orderRef = collection(db, 'orders');
      const items = cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        unit: item.unit
      }));

      await (await import('firebase/firestore')).addDoc(orderRef, {
        orderId: externalOrderId || null,
        name: customerName || 'Marketplace',
        userId: 'marketplace',
        items,
        subtotal,
        shippingCost,
        total,
        status: 'SELESAI',
        paymentStatus: 'PAID',
        payment: {
          method: paymentMethod
        },
        delivery: {
          method: channel === 'SHOPEE' ? 'Shopee' : 'TikTok',
          address: 'Marketplace'
        },
        channel,
        createdAt: serverTimestamp()
      });

      for (const item of cart) {
        const pRef = doc(db, 'products', item.id);
        await updateDoc(pRef, {
          stock: (await getDoc(pRef)).data()?.stock != null
            ? (await getDoc(pRef)).data()!.stock - item.quantity
            : 0
        });
      }

      notify.admin.success('Order marketplace berhasil disimpan.');
      setCart([]);
      setExternalOrderId('');
      setCustomerName('');
      setShippingCost(0);
      router.push('/admin/reports/sales');
    } catch (err) {
      console.error(err);
      notify.admin.error('Gagal menyimpan order marketplace.');
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
                  <option value="SHOPEE">Shopee</option>
                  <option value="TIKTOK">TikTok Shop</option>
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
            <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-left min-w-[680px] md:min-w-0">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-3 md:px-8 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase">Produk</th>
                  <th className="px-3 md:px-6 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase text-center">Qty</th>
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
                    <td colSpan={4} className="px-3 md:px-8 py-10 text-center text-[11px] font-bold text-gray-400">
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
