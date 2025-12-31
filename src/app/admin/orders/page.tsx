'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, query, orderBy, doc, getDoc, updateDoc, onSnapshot, writeBatch 
} from 'firebase/firestore';
import { 
  ShoppingCart, Search, CheckCircle, Truck, MapPin, 
  AlertTriangle, Filter, MoreVertical, Printer, Clock, XCircle,
  LayoutDashboard, CheckSquare, Square, ChevronRight
} from 'lucide-react';
import Link from 'next/link';

type Order = {
  id: string;
  createdAt: any;
  customerName?: string;
  customerPhone?: string;
  total: number;
  status: 'MENUNGGU' | 'DIPROSES' | 'DIKIRIM' | 'SELESAI' | 'DIBATALKAN';
  deliveryMethod: 'AMBIL_DI_TOKO' | 'KURIR_TOKO' | 'OJOL';
};

export default function AdminOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'SEMUA' | 'MENUNGGU' | 'DIPROSES' | 'SELESAI'>('SEMUA');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]); // ✅ Untuk fitur Masal

  // 1. Proteksi Akses
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push('/profil/login');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const role = userDoc.data()?.role;
      if (role !== 'admin' && role !== 'cashier') return router.push('/profil');
    });
  }, [router]);

  // 2. Real-time Data
  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 3. Fungsi Ubah Status Masal
  const handleBulkUpdate = async (newStatus: string) => {
    if (selectedOrders.length === 0) return;
    if (!confirm(`Ubah ${selectedOrders.length} pesanan menjadi ${newStatus}?`)) return;

    try {
      const batch = writeBatch(db);
      selectedOrders.forEach((orderId) => {
        const orderRef = doc(db, 'orders', orderId);
        batch.update(orderRef, { status: newStatus });
      });
      await batch.commit();
      setSelectedOrders([]);
      alert('Status berhasil diperbarui secara masal!');
    } catch (err) {
      alert('Gagal memperbarui status masal');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedOrders(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'SEMUA' || order.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'MENUNGGU': return 'bg-red-500 text-white';
      case 'DIPROSES': return 'bg-amber-500 text-white';
      case 'DIKIRIM': return 'bg-blue-500 text-white';
      case 'SELESAI': return 'bg-emerald-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen text-black">
      
      {/* Tombol Dashboard Kecil di Atas */}
      <div className="mb-6 flex items-center justify-between">
        <Link 
          href="/admin" 
          className="flex items-center gap-2 text-xs font-bold bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-100 transition shadow-sm"
        >
          <LayoutDashboard size={14} /> DASHBOARD
        </Link>
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Manajemen Pesanan v2.0
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900">List Pesanan</h1>
          <p className="text-gray-500 text-sm">Update status pengiriman pelanggan Anda di sini.</p>
        </div>
      </div>

      {/* Toolbar & Filter */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Cari ID atau nama pelanggan..."
              className="w-full pl-11 pr-4 py-3 bg-white border-none shadow-sm rounded-2xl focus:ring-2 focus:ring-black outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
            {['SEMUA', 'MENUNGGU', 'DIPROSES', 'SELESAI'].map((tab) => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-5 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap ${
                        activeTab === tab ? 'bg-black text-white' : 'bg-white text-gray-400 border border-gray-100 shadow-sm'
                    }`}
                >
                    {tab}
                </button>
            ))}
        </div>
      </div>

      {/* Floating Bulk Action Bar (Muncul jika ada yang dicentang) */}
      {selectedOrders.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-4 rounded-3xl shadow-2xl z-50 flex items-center gap-6 animate-in slide-in-from-bottom-5">
            <div className="text-sm font-bold">{selectedOrders.length} Pesanan dipilih</div>
            <div className="h-6 w-[1px] bg-gray-700"></div>
            <div className="flex gap-2">
                <button onClick={() => handleBulkUpdate('DIPROSES')} className="bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-xl text-[10px] font-black transition">PROSES MASAL</button>
                <button onClick={() => handleBulkUpdate('DIKIRIM')} className="bg-blue-500 hover:bg-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-black transition">KIRIM MASAL</button>
                <button onClick={() => handleBulkUpdate('SELESAI')} className="bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-xl text-[10px] font-black transition">SELESAI MASAL</button>
                <button onClick={() => setSelectedOrders([])} className="bg-gray-800 p-1.5 rounded-xl hover:bg-gray-700 transition"><XCircle size={16} /></button>
            </div>
        </div>
      )}

      {/* List Pesanan */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="text-center py-20 animate-pulse font-bold text-gray-300">Menarik Data...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 italic text-gray-400">
            Tidak ada pesanan ditemukan.
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div 
                key={order.id} 
                className={`group bg-white rounded-3xl p-5 border shadow-sm transition-all flex flex-col md:flex-row items-center gap-5 ${
                    selectedOrders.includes(order.id) ? 'border-black ring-1 ring-black bg-gray-50' : 'border-gray-50'
                }`}
            >
              {/* Checkbox Masal */}
              <button 
                onClick={() => toggleSelect(order.id)}
                className={`transition-all ${selectedOrders.includes(order.id) ? 'text-black' : 'text-gray-200 hover:text-gray-400'}`}
              >
                {selectedOrders.includes(order.id) ? <CheckSquare size={24} /> : <Square size={24} />}
              </button>

              <div className="flex-1 flex items-center gap-4 w-full">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${getStatusColor(order.status)}`}>
                  <ShoppingCart size={22} />
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm uppercase tracking-tighter">#{order.id.substring(0, 8)}</span>
                    <span className={`text-[8px] px-2 py-0.5 rounded-lg font-black ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 truncate">{order.customerName || 'Pelanggan Umum'}</h3>
                  <p className="text-[10px] text-gray-400 font-bold">{order.customerPhone || 'Tanpa WhatsApp'}</p>
                </div>
              </div>

              <div className="w-full md:w-auto flex flex-col md:items-end">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pembayaran</p>
                <p className="text-lg font-black text-emerald-600">Rp {order.total.toLocaleString()}</p>
                <div className="flex items-center gap-1 text-[9px] font-black text-gray-400 mt-0.5">
                    <Truck size={10} /> {order.deliveryMethod.replace('_', ' ')}
                </div>
              </div>

              <div className="flex gap-2 shrink-0 border-t md:border-t-0 pt-4 md:pt-0 w-full md:w-auto justify-end">
                <Link 
                    href={`/admin/orders/${order.id}`}
                    className="flex items-center gap-2 bg-gray-100 text-gray-500 hover:text-black px-4 py-2 rounded-xl text-[10px] font-black transition-all"
                >
                    DETAIL <ChevronRight size={14} />
                </Link>
                <button className="p-2 bg-gray-50 text-gray-400 hover:text-black rounded-xl border border-gray-100 transition-all">
                    <Printer size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Space bawah agar tidak tertutup floating bar */}
      {selectedOrders.length > 0 && <div className="h-24"></div>}

    </div>
  );
}