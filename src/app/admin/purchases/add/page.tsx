'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  ChevronLeft, Search, Plus, Trash2, Save,
  Package, Store, Truck, Calculator,
  Info
} from 'lucide-react';
import Link from 'next/link';
import notify from '@/lib/notify';
import useProducts from '@/lib/hooks/useProducts';


interface Supplier { id: string; name: string; }
interface Warehouse { id: string; name: string; }
interface Product { id: string; name: string; purchasePrice: number; unit?: string; stock?: number; sku?: string; }
interface CartItem { id: string; name: string; purchasePrice: number; quantity: number; unit: string; }

export default function AddPurchase() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { products: liveProducts } = useProducts({ isActive: true, orderByField: 'name', orderDirection: 'asc' });

  // Data References
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchProduct, setSearchProduct] = useState('');

  // Form States
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('LUNAS');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [shippingCost, setShippingCost] = useState(0);
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);


  useEffect(() => {
    setProducts(liveProducts as Product[]);
  }, [liveProducts]);

  useEffect(() => {
    const unsubSup = onSnapshot(collection(db, 'suppliers'), (s) => {
      setSuppliers(s.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as Supplier)));
    });
    const unsubWar = onSnapshot(collection(db, 'warehouses'), (s) => {
      setWarehouses(s.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as Warehouse)));
    });
    return () => {
      unsubSup();
      unsubWar();
    };
  }, []);

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        purchasePrice: product.purchasePrice || 0,
        quantity: 1,
        unit: product.unit || 'Pcs'
      }]);
    }
    setSearchProduct('');
  };


  const removeFromCart = (id: string) => setCart(cart.filter(item => item.id !== id));

  const updateCartItem = (id: string, field: keyof CartItem, value: string | number) => {
    setCart(cart.map(item => item.id === id ? { ...item, [field]: value } : item));
  };


  const subtotal = cart.reduce((acc, item) => acc + (item.purchasePrice * item.quantity), 0);
  const total = subtotal + shippingCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || !selectedSupplier || !selectedWarehouse) {
      notify.admin.error("Mohon lengkapi data supplier, gudang, dan produk.");
      return;
    }

    setLoading(true);
    try {
      const supplierName = suppliers.find(s => s.id === selectedSupplier)?.name;
      const warehouseName = warehouses.find(w => w.id === selectedWarehouse)?.name;

      await addDoc(collection(db, 'purchases'), {
        supplierId: selectedSupplier,
        supplierName,
        warehouseId: selectedWarehouse,
        warehouseName,
        items: cart,
        subtotal,
        shippingCost,
        total,
        paymentStatus,
        paymentMethod,
        notes,
        status: 'MENUNGGU', // Default status awal
        createdAt: serverTimestamp(),
      });

      router.push('/admin/purchases');
    } catch (err) {
      console.error(err);
      notify.admin.error("Gagal menyimpan transaksi.");
    } finally {
      setLoading(false);
    }
  };

  const filteredSearch = products.filter(p =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchProduct.toLowerCase())
  ).slice(0, 5);

  return (
    <div className="p-4 lg:p-10 bg-[#FBFBFE] min-h-screen pb-32 font-sans">

      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <Link href="/admin/purchases" className="p-4 bg-white rounded-2xl shadow-sm hover:bg-black hover:text-white transition-all">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">New Purchase Order</h1>
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Input stok masuk dari supplier</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT: FORM INPUT */}
        <div className="lg:col-span-2 space-y-6">

          {/* 1. Supplier & Warehouse */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                <Store size={14} /> Pilih Supplier
              </label>
              <select
                required
                className="w-full bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none border-none ring-1 ring-gray-100 focus:ring-black transition-all"
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
              >
                <option value="">Cari Supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                <Truck size={14} /> Gudang Tujuan
              </label>
              <select
                required
                className="w-full bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none border-none ring-1 ring-gray-100 focus:ring-black transition-all"
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
              >
                <option value="">Pilih Gudang...</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>

          {/* 2. Product Search & Table */}
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  className="w-full bg-gray-50 pl-12 pr-6 py-5 rounded-2xl text-xs font-bold outline-none"
                  placeholder="Ketik Nama Produk atau Scan Barcode..."
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                />
                {/* Search Results Dropdown */}
                {searchProduct && (
                  <div className="absolute top-full left-0 w-full bg-white mt-2 rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                    {filteredSearch.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addToCart(p)}
                        className="w-full p-4 text-left hover:bg-gray-50 flex justify-between items-center group"
                      >
                        <div>
                          <p className="text-xs font-black uppercase text-gray-800">{p.name}</p>
                          <p className="text-[9px] font-bold text-gray-400">STOK SAAT INI: {p.stock} {p.unit}</p>
                        </div>
                        <Plus size={16} className="text-gray-300 group-hover:text-black" />
                      </button>
                    ))}
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
                  <th className="px-3 md:px-6 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase text-center">Harga Beli</th>
                  <th className="px-3 md:px-8 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cart.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 md:px-8 py-3 md:py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-gray-800 uppercase">{item.name}</span>
                        <button type="button" onClick={() => removeFromCart(item.id)} className="text-[9px] text-red-500 font-black uppercase mt-1 flex items-center gap-1 hover:underline">
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
                          onChange={(e) => updateCartItem(item.id, 'quantity', Number(e.target.value))}
                        />
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                      <input
                        type="number"
                        className="w-28 bg-gray-50 p-2 rounded-lg text-xs font-black text-center outline-none"
                        value={item.purchasePrice}
                        onChange={(e) => updateCartItem(item.id, 'purchasePrice', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-3 md:px-8 py-3 md:py-4 text-right text-xs font-black text-gray-800">
                      Rp {(item.quantity * item.purchasePrice).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {cart.length === 0 && (
              <div className="p-20 text-center flex flex-col items-center gap-2">
                <Package size={40} className="text-gray-100" />
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Keranjang Kosong</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: SUMMARY & ACTIONS */}
        <div className="space-y-6">
          <div className="bg-black text-white p-8 rounded-[2.5rem] shadow-xl space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
              <Calculator size={14} /> Order Summary
            </h3>

            <div className="space-y-4 border-b border-white/10 pb-6">
              <div className="flex justify-between text-xs font-bold">
                <span className="opacity-60">SUBTOTAL</span>
                <span>Rp {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="opacity-60">SHIPPING</span>
                <input
                  type="number"
                  className="bg-white/10 w-24 p-2 rounded-lg text-right outline-none focus:bg-white/20 transition-all"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex justify-between items-end">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Grand Total</span>
              <span className="text-2xl font-black text-green-400 italic">Rp {total.toLocaleString()}</span>
            </div>

            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentStatus('LUNAS')}
                  className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${paymentStatus === 'LUNAS' ? 'bg-green-500 text-white' : 'bg-white/5 text-gray-400'}`}
                >
                  Paid
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentStatus('HUTANG')}
                  className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${paymentStatus === 'HUTANG' ? 'bg-red-500 text-white' : 'bg-white/5 text-gray-400'}`}
                >
                  Debt
                </button>
              </div>

              <select
                className="w-full bg-white/5 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="CASH">CASH / TUNAI</option>
                <option value="TRANSFER">BANK TRANSFER</option>
                <option value="GIRO">GIRO / CEK</option>
              </select>
            </div>

            <button
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <Save size={18} /> {loading ? 'Saving Order...' : 'Post Purchase Order'}
            </button>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <Info size={14} /> Additional Notes
            </h3>
            <textarea
              className="w-full bg-gray-50 p-4 rounded-2xl text-xs font-medium outline-none h-32 resize-none"
              placeholder="Tambahkan instruksi pengiriman atau catatan nota..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

      </form>
    </div>
  );
}
