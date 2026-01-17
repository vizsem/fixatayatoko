'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import Link from 'next/link';
import { 
  ShoppingBag, Plus, Trash2, Truck, User, CreditCard, 
  Package, AlertTriangle, TrendingDown, Search, ChevronRight,
  Filter, Calendar, Clock, CheckCircle2, XCircle
} from 'lucide-react';

// --- TYPES ---
type ProductItem = {
  id: string;
  name: string;
  purchasePrice: number;
  quantity: number;
  unit: string;
};

type Purchase = {
  id: string;
  supplierId: string;
  supplierName: string;
  items: ProductItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  paymentMethod: string;
  paymentStatus: 'LUNAS' | 'HUTANG' | 'DP';
  dueDate?: string;
  notes?: string;
  status: 'MENUNGGU' | 'DITERIMA' | 'DIBATALKAN';
  warehouseId: string;
  warehouseName: string;
  createdAt: string;
};

export default function AdminPurchases() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [filteredPurchases, setFilteredPurchases] = useState<Purchase[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (loading) return;
    const q = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const purchaseList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : new Date().toISOString()
      } as Purchase));
      setPurchases(purchaseList);
    });
    return () => unsubscribe();
  }, [loading]);

  useEffect(() => {
    let result = purchases;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.supplierName.toLowerCase().includes(term) || 
        p.id.toLowerCase().includes(term)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }
    setFilteredPurchases(result);
  }, [searchTerm, statusFilter, purchases]);

  const updatePurchaseStatus = async (id: string, newStatus: Purchase['status']) => {
    const confirmMsg = newStatus === 'DITERIMA' 
      ? "Konfirmasi barang diterima? Stok akan bertambah otomatis." 
      : "Batalkan transaksi ini?";
    
    if (!confirm(confirmMsg)) return;

    try {
      if (newStatus === 'DITERIMA') {
        const p = purchases.find(pur => pur.id === id);
        if (p) {
          for (const item of p.items) {
            const productRef = doc(db, 'products', item.id);
            const pSnap = await getDoc(productRef);
            if (pSnap.exists()) {
              const curData = pSnap.data();
              await updateDoc(productRef, {
                stock: (curData.stock || 0) + item.quantity,
                purchasePrice: item.purchasePrice, // Update HPP terbaru
                updatedAt: serverTimestamp()
              });
            }
          }
        }
      }
      await updateDoc(doc(db, 'purchases', id), { status: newStatus, updatedAt: serverTimestamp() });
    } catch (err) { alert("Gagal update status"); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black uppercase tracking-widest text-xs">Loading Purchases...</div>;

  return (
    <div className="p-4 lg:p-10 bg-[#FBFBFE] min-h-screen pb-32">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-3">
            <ShoppingBag className="text-blue-600" size={32} /> Purchase Order
          </h1>
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">
            Total Pengeluaran: <span className="text-red-500">Rp {purchases.reduce((s, p) => s + p.total, 0).toLocaleString()}</span>
          </p>
        </div>
        <Link href="/admin/purchases/add" className="bg-black text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:scale-105 transition-all">
          <Plus size={18} /> Buat PO Baru
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Menunggu" val={purchases.filter(p => p.status === 'MENUNGGU').length} color="text-yellow-600" bg="bg-yellow-50" icon={Clock} />
        <StatCard label="Diterima" val={purchases.filter(p => p.status === 'DITERIMA').length} color="text-green-600" bg="bg-green-50" icon={CheckCircle2} />
        <StatCard label="Hutang" val={`Rp ${purchases.filter(p => p.paymentStatus === 'HUTANG').reduce((s, p) => s + p.total, 0).toLocaleString()}`} color="text-red-600" bg="bg-red-50" icon={CreditCard} isWide />
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            className="w-full bg-gray-50 pl-12 pr-6 py-4 rounded-2xl text-xs font-bold outline-none" 
            placeholder="Cari Supplier atau ID PO..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
        <select 
          className="bg-gray-50 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest outline-none border-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Semua Status</option>
          <option value="MENUNGGU">Menunggu</option>
          <option value="DITERIMA">Diterima</option>
          <option value="DIBATALKAN">Dibatalkan</option>
        </select>
      </div>

      {/* Purchases Table */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">ID & Tanggal</th>
              <th className="px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplier</th>
              <th className="px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pembayaran</th>
              <th className="px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
              <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredPurchases.map((purchase) => (
              <tr key={purchase.id} className="hover:bg-gray-50/50 transition-all">
                <td className="px-8 py-6">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-gray-800 uppercase italic">#{purchase.id.slice(-6)}</span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1 mt-1">
                      <Calendar size={10} /> {new Date(purchase.createdAt).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-gray-700 uppercase tracking-tight">{purchase.supplierName}</span>
                    <span className="text-[9px] font-bold text-blue-500 uppercase">{purchase.items.length} Items • {purchase.warehouseName}</span>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-gray-800">Rp {purchase.total.toLocaleString()}</span>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md w-fit mt-1 ${
                      purchase.paymentStatus === 'LUNAS' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {purchase.paymentStatus}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-6 text-center">
                  <span className={`text-[9px] font-black uppercase px-4 py-2 rounded-xl border ${
                    purchase.status === 'DITERIMA' ? 'bg-green-50 text-green-600 border-green-100' : 
                    purchase.status === 'MENUNGGU' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 
                    'bg-red-50 text-red-600 border-red-100'
                  }`}>
                    {purchase.status}
                  </span>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {purchase.status === 'MENUNGGU' && (
                      <div className="flex gap-1">
                         <button onClick={() => updatePurchaseStatus(purchase.id, 'DITERIMA')} className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-lg shadow-green-100">
                          <CheckCircle2 size={16} />
                        </button>
                        <button onClick={() => updatePurchaseStatus(purchase.id, 'DIBATALKAN')} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all">
                          <XCircle size={16} />
                        </button>
                      </div>
                    )}
                    <Link href={`/admin/purchases/${purchase.id}`} className="p-2 bg-gray-100 text-gray-400 rounded-lg hover:bg-black hover:text-white transition-all">
                      <ChevronRight size={18} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredPurchases.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center gap-3">
            <ShoppingBag size={48} className="text-gray-100" />
            <p className="text-[10px] font-black uppercase text-gray-300 tracking-[0.2em]">Belum Ada Data Pembelian</p>
          </div>
        )}
      </div>

      {/* Info Alert */}
      <div className="mt-8 bg-blue-600 rounded-[2rem] p-8 text-white flex items-center justify-between overflow-hidden relative group">
        <div className="relative z-10">
          <h3 className="text-lg font-black uppercase tracking-tighter">Sistem Stok Otomatis Aktif</h3>
          <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest mt-1 max-w-md leading-relaxed">
            Menekan tombol "Terima" akan menambah stok barang di gudang secara real-time dan memperbarui Harga Beli (HPP) pada master data produk.
          </p>
        </div>
        <Package size={120} className="absolute -right-5 -bottom-5 opacity-10 group-hover:rotate-12 transition-all duration-700" />
      </div>

    </div>
  );
}

function StatCard({ label, val, color, bg, icon: Icon, isWide }: any) {
  return (
    <div className={`p-6 rounded-[2rem] ${bg} ${color} border border-transparent hover:border-current transition-all flex flex-col gap-3 ${isWide ? 'md:col-span-2' : ''}`}>
      <div className="flex justify-between items-start">
        <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{label}</span>
        <Icon size={16} />
      </div>
      <span className="text-xl font-black tracking-tighter uppercase">{val}</span>
    </div>
  );
}