'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { 
  collection, doc, getDoc, getDocs, query, where, 
  runTransaction, serverTimestamp 
} from 'firebase/firestore';
import { 
  ArrowLeft, ArrowRightLeft, Warehouse, Package, 
  Loader2, AlertTriangle, Search 
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function MutasiGudangPage() {
  const router = useRouter();
  const params = useParams();
  const sourceWarehouseId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sourceWarehouse, setSourceWarehouse] = useState<any>(null);
  const [targetWarehouses, setTargetWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  // Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Ambil Detail Gudang Asal
        const wDoc = await getDoc(doc(db, 'warehouses', sourceWarehouseId));
        if (wDoc.exists()) setSourceWarehouse({ id: wDoc.id, ...wDoc.data() });

        // 2. Ambil Daftar Gudang Tujuan (Semua kecuali asal)
        const wSnap = await getDocs(collection(db, 'warehouses'));
        setTargetWarehouses(wSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => d.id !== sourceWarehouseId)
        );

        // 3. Ambil Produk yang ada di Gudang Asal ini
        const pQuery = query(collection(db, 'products'), where('warehouseId', '==', sourceWarehouseId));
        const pSnap = await getDocs(pQuery);
        setProducts(pSnap.docs.map(d => ({ 
          id: d.id, 
          name: d.data().Nama || d.data().name, 
          stok: Number(d.data().Stok || d.data().stock || 0),
          unit: d.data().Satuan || d.data().unit || 'pcs'
        })));

      } catch (err) {
        console.error(err);
        toast.error("Gagal memuat data inventory");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [sourceWarehouseId]);

  const handleMutation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !targetWarehouseId || amount <= 0) {
      toast.error("Lengkapi form mutasi");
      return;
    }

    const selectedProduct = products.find(p => p.id === selectedProductId);
    if (amount > selectedProduct.stok) {
      toast.error("Stok gudang asal tidak cukup!");
      return;
    }

    setSubmitting(true);

    try {
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'products', selectedProductId);
        const logRef = doc(collection(db, 'inventory_logs'));

        // Update Gudang & Stok Produk
        // Catatan: Di sistem ini kita asumsikan produk pindah warehouseId
        // Jika 1 produk bisa di banyak gudang, maka logika ini akan membuat dokumen baru
        transaction.update(productRef, {
          warehouseId: targetWarehouseId,
          updatedAt: serverTimestamp()
        });

        // Simpan Log Mutasi untuk History Inventory
        transaction.set(logRef, {
          productId: selectedProductId,
          productName: selectedProduct.name,
          fromWarehouseId: sourceWarehouseId,
          toWarehouseId: targetWarehouseId,
          amount: amount,
          type: 'MUTASI',
          date: serverTimestamp(),
          adminId: auth.currentUser?.uid || 'system'
        });
      });

      toast.success("Mutasi Berhasil Disinkronkan");
      router.push('/admin/warehouses');
    } catch (err) {
      console.error(err);
      toast.error("Gagal melakukan mutasi");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="animate-spin text-green-600" size={40} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Toaster position="top-center" />
      
      {/* HEADER */}
      <div className="bg-white border-b border-gray-100 px-6 py-6 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-sm font-black uppercase tracking-widest text-gray-900">Proses Mutasi Stok</h1>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        {/* STEPPER / FLOW VISUAL */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="text-center">
            <div className="w-12 h-12 bg-gray-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xl shadow-gray-200">
              <Warehouse size={20} />
            </div>
            <span className="text-[10px] font-black uppercase text-gray-900">{sourceWarehouse?.name}</span>
          </div>
          <ArrowRightLeft className="text-gray-300 animate-pulse" size={24} />
          <div className="text-center">
            <div className="w-12 h-12 bg-green-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xl shadow-green-100">
              <Warehouse size={20} />
            </div>
            <span className="text-[10px] font-black uppercase text-gray-400">Gudang Tujuan</span>
          </div>
        </div>

        <form onSubmit={handleMutation} className="space-y-6">
          {/* PILIH PRODUK DARI INVENTORY */}
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 block">1. Pilih Produk dari {sourceWarehouse?.name}</label>
            
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
              <input 
                type="text" 
                placeholder="Cari nama produk..." 
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 no-scrollbar">
              {filteredProducts.map(p => (
                <div 
                  key={p.id}
                  onClick={() => setSelectedProductId(p.id)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center ${
                    selectedProductId === p.id ? 'border-green-600 bg-green-50' : 'border-gray-50 bg-gray-50/50'
                  }`}
                >
                  <div>
                    <p className="text-xs font-black uppercase text-gray-900">{p.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Tersedia: {p.stok} {p.unit}</p>
                  </div>
                  {selectedProductId === p.id && <Package className="text-green-600" size={18} />}
                </div>
              ))}
            </div>
          </div>

          {/* PILIH TUJUAN & JUMLAH */}
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 block">2. Tujuan & Volume</label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <select 
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl text-[10px] font-black uppercase focus:ring-2 focus:ring-green-600"
                  value={targetWarehouseId}
                  onChange={(e) => setTargetWarehouseId(e.target.value)}
                >
                  <option value="">Pilih Tujuan</option>
                  {targetWarehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <input 
                  type="number" 
                  placeholder="Jumlah"
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl text-[10px] font-black uppercase focus:ring-2 focus:ring-green-600"
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* ACTION BUTTON */}
          <button 
            type="submit"
            disabled={submitting || !selectedProductId || !targetWarehouseId}
            className="w-full bg-gray-900 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl shadow-gray-200 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-3"
          >
            {submitting ? <Loader2 className="animate-spin" size={20} /> : 'Eksekusi Mutasi'}
          </button>
        </form>

        <div className="mt-8 flex items-start gap-4 p-6 bg-orange-50 rounded-[2rem] border border-orange-100">
          <AlertTriangle className="text-orange-600 shrink-0" size={20} />
          <p className="text-[10px] font-bold text-orange-800 uppercase leading-relaxed tracking-wider">
            Pastikan stok fisik sudah dipindahkan ke unit kendaraan atau kurir sebelum menekan tombol eksekusi. Data inventory akan langsung terupdate.
          </p>
        </div>
      </div>
    </div>
  );
}