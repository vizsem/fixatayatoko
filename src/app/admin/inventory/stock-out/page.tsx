'use client';

import { useState, useEffect } from 'react';

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import {
  ArrowLeft,
  ArrowUpCircle,
  Search,
  AlertCircle,
  CheckCircle2,
  Package
} from 'lucide-react';
import Link from 'next/link';

type Product = {
  id: string;
  name: string;
  stock: number;
  unit: string;
};

export default function StockOutPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState<number>(0);
  const [reason, setReason] = useState('Barang Rusak');
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // 1. Ambil daftar produk untuk dipilih
  useEffect(() => {
    const fetchProducts = async () => {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const list = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Produk Tanpa Nama',
        stock: doc.data().stock || 0,
        unit: doc.data().unit || 'pcs'
      }));
      setProducts(list);
    };
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 2. Proses Simpan Stok Keluar
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || qty <= 0) return;
    if (qty > selectedProduct.stock) {
      setStatus({ type: 'error', msg: 'Stok tidak mencukupi!' });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const user = auth.currentUser;
      const productRef = doc(db, 'products', selectedProduct.id);

      // A. Update Stok di Produk (Kurangi)
      await updateDoc(productRef, {
        stock: increment(-qty)
      });

      // B. Catat ke Inventory Logs (Agar muncul di halaman History)
      await addDoc(collection(db, 'inventory_logs'), {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: 'KELUAR',
        quantity: qty,
        prevStock: selectedProduct.stock,
        nextStock: selectedProduct.stock - qty,
        reason: reason,
        operator: user?.email || 'Admin',
        createdAt: serverTimestamp()
      });

      setStatus({ type: 'success', msg: 'Stok berhasil dikurangi!' });

      // Reset Form
      setQty(0);
      setSelectedProduct(null);
      setSearchTerm('');

      // Refresh list produk lokal
      setProducts(prev => prev.map(p =>
        p.id === selectedProduct.id ? { ...p, stock: p.stock - qty } : p
      ));

    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', msg: 'Terjadi kesalahan sistem.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen text-black">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/inventory" className="p-2 bg-white rounded-xl border hover:bg-gray-100 transition">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <ArrowUpCircle className="text-red-600" /> Stok Keluar
          </h1>
        </div>

        {status && (
          <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
            }`}>
            {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {status.msg}
          </div>
        )}

        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Pilih Produk */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Cari & Pilih Produk</label>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                <input
                  type="text"
                  placeholder="Ketik nama produk..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-black"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {searchTerm && !selectedProduct && (
                <div className="border rounded-2xl overflow-hidden max-h-40 overflow-y-auto mb-4 bg-white shadow-xl">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedProduct(p);
                        setSearchTerm(p.name);
                      }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex justify-between items-center border-b last:border-0"
                    >
                      <span className="font-bold">{p.name}</span>
                      <span className="text-[10px] bg-gray-100 px-2 py-1 rounded-lg">Stok: {p.stock}</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedProduct && (
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="text-blue-600" />
                    <div>
                      <p className="text-xs font-black text-blue-900">{selectedProduct.name}</p>
                      <p className="text-[10px] text-blue-600 font-bold uppercase underline">Stok Saat Ini: {selectedProduct.stock} {selectedProduct.unit}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedProduct(null)} className="text-[10px] font-black text-red-500 underline">GANTI</button>
                </div>
              )}
            </div>

            {/* Jumlah Keluar */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Jumlah Keluar</label>
                <input
                  type="number"
                  required
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl text-lg font-black outline-none focus:ring-2 focus:ring-black"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Alasan</label>
                <select
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-black h-[60px]"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="Barang Rusak">BARANG RUSAK</option>
                  <option value="Kadaluarsa">KADALUARSA</option>
                  <option value="Hilang / Selisih">HILANG / SELISIH</option>
                  <option value="Retur ke Supplier">RETUR KE SUPPLIER</option>
                  <option value="Dipakai Keperluan Toko">KEPERLUAN TOKO</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !selectedProduct}
              className="w-full bg-black text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-gray-200 hover:bg-gray-800 disabled:bg-gray-300 transition-all"
            >
              {loading ? 'MEMPROSES...' : 'KURANGI STOK SEKARANG'}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}