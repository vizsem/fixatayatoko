'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { 
  ArrowLeft, 
  ArrowRightLeft, 
  Search, 
  AlertCircle, 
  CheckCircle2,
  Package,
  Warehouse,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

type Product = {
  id: string;
  name: string;
  stock: number;
  unit: string;
  stockByWarehouse?: Record<string, number>;
};

type WarehouseType = {
  id: string;
  name: string;
};

export default function StockTransferPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [fromWarehouse, setFromWarehouse] = useState('');
  const [toWarehouse, setToWarehouse] = useState('');
  const [qty, setQty] = useState<number>(0);
  const [status, setStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);

  // 1. Fetch Produk & Gudang
  useEffect(() => {
    const fetchData = async () => {
      const prodSnap = await getDocs(collection(db, 'products'));
      setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));

      const whSnap = await getDocs(collection(db, 'warehouses'));
      setWarehouses(whSnap.docs.map(d => ({ id: d.id, name: d.data().name } as WarehouseType)));
    };
    fetchData();
  }, []);

  const filteredProducts = products.filter(p => {
  // Pastikan name dikonversi ke string dan beri fallback jika undefined/null
  const productName = p.name ? String(p.name).toLowerCase() : "";
  const search = searchTerm.toLowerCase();
  return productName.includes(search);
});

  // 2. Eksekusi Transfer
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !fromWarehouse || !toWarehouse || qty <= 0) return;
    if (fromWarehouse === toWarehouse) {
        setStatus({ type: 'error', msg: 'Gudang asal dan tujuan tidak boleh sama!' });
        return;
    }

    const currentFromStock = selectedProduct.stockByWarehouse?.[fromWarehouse] || 0;
    if (qty > currentFromStock) {
        setStatus({ type: 'error', msg: `Stok di gudang asal tidak cukup! (Hanya ada ${currentFromStock})` });
        return;
    }

    setLoading(true);
    try {
      const productRef = doc(db, 'products', selectedProduct.id);
      const newStockByWarehouse = { ...selectedProduct.stockByWarehouse };

      // Update distribusi stok
      newStockByWarehouse[fromWarehouse] = (newStockByWarehouse[fromWarehouse] || 0) - qty;
      newStockByWarehouse[toWarehouse] = (newStockByWarehouse[toWarehouse] || 0) + qty;

      await updateDoc(productRef, { stockByWarehouse: newStockByWarehouse });

      // Catat Log
      await addDoc(collection(db, 'inventory_logs'), {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: 'MUTASI',
        quantity: qty,
        reason: `Transfer dari ${warehouses.find(w => w.id === fromWarehouse)?.name} ke ${warehouses.find(w => w.id === toWarehouse)?.name}`,
        operator: auth.currentUser?.email || 'Admin',
        createdAt: serverTimestamp()
      });

      setStatus({ type: 'success', msg: 'Transfer stok berhasil!' });
      setQty(0);
      setSelectedProduct(null);
      setSearchTerm('');
    } catch (error) {
      setStatus({ type: 'error', msg: 'Gagal melakukan mutasi.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen text-black font-sans">
      <div className="max-w-2xl mx-auto">
        
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/inventory" className="p-2 bg-white rounded-xl border hover:bg-gray-100 transition shadow-sm">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <ArrowRightLeft className="text-purple-600" /> Mutasi Antar Gudang
          </h1>
        </div>

        {status && (
          <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 font-bold text-sm border ${
            status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'
          }`}>
            {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {status.msg}
          </div>
        )}

        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
          <form onSubmit={handleTransfer} className="space-y-6">
            
            {/* 1. CARI PRODUK */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">1. Pilih Barang</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  type="text" 
                  placeholder="Cari nama produk..."
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-black"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {searchTerm && !selectedProduct && (
                <div className="mt-2 border rounded-2xl overflow-hidden bg-white shadow-2xl max-h-48 overflow-y-auto z-10 relative">
                  {filteredProducts.map(p => (
                    <button key={p.id} type="button" onClick={() => { setSelectedProduct(p); setSearchTerm(p.name); }}
                      className="w-full text-left px-5 py-4 text-sm hover:bg-purple-50 flex justify-between items-center border-b border-gray-50 transition-colors">
                      <span className="font-black">{p.name}</span>
                      <span className="text-[10px] bg-gray-100 px-3 py-1 rounded-full font-bold">Total: {p.stock}</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedProduct && (
                <div className="mt-4 p-4 bg-purple-50 border border-purple-100 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Package className="text-purple-600" />
                        <div>
                            <p className="text-xs font-black text-purple-900 uppercase">{selectedProduct.name}</p>
                            <div className="flex gap-2 mt-1">
                                {warehouses.map(wh => (
                                    <span key={wh.id} className="text-[9px] bg-white px-2 py-0.5 rounded border border-purple-200 font-bold text-purple-700">
                                        {wh.name}: {selectedProduct.stockByWarehouse?.[wh.id] || 0}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button type="button" onClick={() => setSelectedProduct(null)} className="text-[10px] font-black text-red-500 underline">GANTI</button>
                </div>
              )}
            </div>

            {/* 2. PILIH GUDANG */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">2. Gudang Asal</label>
                    <select 
                        required
                        className="w-full p-4 bg-gray-50 border-none rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-black"
                        value={fromWarehouse}
                        onChange={(e) => setFromWarehouse(e.target.value)}
                    >
                        <option value="">PILIH ASAL...</option>
                        {warehouses.map(wh => (
                            <option key={wh.id} value={wh.id}>{wh.name.toUpperCase()}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">3. Gudang Tujuan</label>
                    <select 
                        required
                        className="w-full p-4 bg-gray-50 border-none rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-black"
                        value={toWarehouse}
                        onChange={(e) => setToWarehouse(e.target.value)}
                    >
                        <option value="">PILIH TUJUAN...</option>
                        {warehouses.map(wh => (
                            <option key={wh.id} value={wh.id}>{wh.name.toUpperCase()}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 3. JUMLAH TRANSFER */}
            <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest text-center">4. Jumlah Barang Dipindahkan</label>
                <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-3xl">
                    <input 
                        type="number" 
                        required
                        placeholder="0"
                        className="flex-1 p-4 bg-transparent border-none text-2xl font-black text-center outline-none"
                        value={qty}
                        onChange={(e) => setQty(Number(e.target.value))}
                    />
                </div>
            </div>

            <button
              type="submit"
              disabled={loading || !selectedProduct}
              className="w-full bg-black text-white py-5 rounded-[2rem] font-black text-sm shadow-2xl shadow-purple-100 hover:bg-purple-900 transition-all flex items-center justify-center gap-2 group"
            >
              {loading ? 'MEMPROSES TRANSFER...' : (
                <>
                    KONFIRMASI PINDAH BARANG <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                </>
              )}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}