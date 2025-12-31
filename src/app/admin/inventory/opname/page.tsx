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
  RotateCcw, 
  Search, 
  AlertCircle, 
  CheckCircle2,
  Package,
  ClipboardCheck,
  Plus,
  Minus
} from 'lucide-react';
import Link from 'next/link';

type Product = {
  id: string;
  name: string;
  stock: number;
  unit: string;
};

export default function StockOpnamePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [physicalStock, setPhysicalStock] = useState<number>(0);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);

  // 1. Fetch Produk dengan Proteksi Data
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'products'));
        const list = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || 'Produk Tanpa Nama', // Proteksi undefined
            stock: Number(data.stock) || 0,
            unit: data.unit || 'pcs'
          };
        });
        setProducts(list);
      } catch (err) {
        console.error("Gagal ambil data:", err);
      }
    };
    fetchProducts();
  }, []);

  // Filter Aman (Mencegah error .toLowerCase)
  const filteredProducts = products.filter(p => {
    const name = p.name ? String(p.name).toLowerCase() : "";
    return name.includes(searchTerm.toLowerCase());
  });

  const diff = physicalStock - (selectedProduct?.stock || 0);

  // 2. Eksekusi Penyesuaian Stok
  const handleOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || physicalStock < 0) return;

    setLoading(true);
    setStatus(null);

    try {
      const productRef = doc(db, 'products', selectedProduct.id);
      
      // A. Update stok di tabel produk sesuai fisik
      await updateDoc(productRef, {
        stock: physicalStock
      });

      // B. Catat Riwayat Mutasi sebagai OPNAME
      await addDoc(collection(db, 'inventory_logs'), {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: 'OPNAME',
        quantity: Math.abs(diff), // Jumlah selisih
        prevStock: selectedProduct.stock,
        nextStock: physicalStock,
        reason: `Opname: ${note || (diff >= 0 ? 'Kelebihan barang' : 'Barang kurang/hilang')}`,
        operator: auth.currentUser?.email || 'Admin',
        createdAt: serverTimestamp()
      });

      setStatus({ type: 'success', msg: 'Stok fisik berhasil disinkronkan!' });
      
      // Update state lokal agar UI sinkron
      setProducts(prev => prev.map(p => 
        p.id === selectedProduct.id ? { ...p, stock: physicalStock } : p
      ));
      
      // Reset Form
      setTimeout(() => {
        setSelectedProduct(null);
        setSearchTerm('');
        setPhysicalStock(0);
        setNote('');
      }, 1500);

    } catch (error) {
      setStatus({ type: 'error', msg: 'Gagal memproses opname.' });
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
            <RotateCcw className="text-orange-600" /> Stok Opname
          </h1>
        </div>

        {status && (
          <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 font-bold text-sm border animate-in fade-in ${
            status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'
          }`}>
            {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {status.msg}
          </div>
        )}

        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
          <form onSubmit={handleOpname} className="space-y-6">
            
            {/* CARI PRODUK */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Cari Produk yang akan dicek</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  type="text" 
                  placeholder="Ketik nama barang..."
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-black"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {searchTerm && !selectedProduct && (
                <div className="mt-2 border rounded-2xl overflow-hidden bg-white shadow-2xl max-h-48 overflow-y-auto relative z-10">
                  {filteredProducts.map(p => (
                    <button key={p.id} type="button" onClick={() => { setSelectedProduct(p); setSearchTerm(p.name); setPhysicalStock(p.stock); }}
                      className="w-full text-left px-5 py-4 text-sm hover:bg-orange-50 flex justify-between items-center border-b border-gray-50">
                      <span className="font-black text-gray-800">{p.name}</span>
                      <span className="text-[10px] bg-gray-100 px-3 py-1 rounded-full font-bold">Sistem: {p.stock}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedProduct && (
              <div className="space-y-6 animate-in slide-in-from-top-2">
                {/* Info Komparasi */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <p className="text-[9px] font-black text-gray-400 uppercase">Stok di Sistem</p>
                        <p className="text-xl font-black">{selectedProduct.stock} <span className="text-xs">{selectedProduct.unit}</span></p>
                    </div>
                    <div className={`p-4 rounded-2xl border ${diff === 0 ? 'bg-gray-50 border-gray-100' : diff > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                        <p className="text-[9px] font-black text-gray-400 uppercase">Selisih Fisik</p>
                        <p className={`text-xl font-black flex items-center gap-1 ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {diff > 0 && <Plus size={16}/>} {diff} <span className="text-xs">{selectedProduct.unit}</span>
                        </p>
                    </div>
                </div>

                {/* Input Fisik */}
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Masukkan Jumlah Fisik Sebenarnya</label>
                    <input 
                        type="number" 
                        required
                        className="w-full p-5 bg-orange-50 border-2 border-orange-100 rounded-3xl text-3xl font-black text-center outline-none focus:border-orange-500 transition-all"
                        value={physicalStock}
                        onChange={(e) => setPhysicalStock(Number(e.target.value))}
                    />
                </div>

                {/* Catatan */}
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Keterangan Selisih (Opsional)</label>
                    <textarea 
                        placeholder="Contoh: Barang pecah di rak, atau bonus dari supplier..."
                        className="w-full p-4 bg-gray-50 border-none rounded-2xl text-xs font-medium outline-none focus:ring-2 focus:ring-black h-24"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black text-white py-5 rounded-[2rem] font-black text-sm shadow-xl hover:bg-orange-600 transition-all flex items-center justify-center gap-2 group"
                >
                  <ClipboardCheck size={20} />
                  {loading ? 'MENYIMPAN PERUBAHAN...' : 'SINKRONISASI STOK FISIK'}
                </button>
              </div>
            )}

          </form>
        </div>
      </div>
    </div>
  );
}