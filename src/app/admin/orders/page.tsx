'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';


import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, orderBy, doc, getDoc, onSnapshot, writeBatch, Timestamp
} from 'firebase/firestore';
import {
  ShoppingCart, Search, Truck, Printer, XCircle,
  LayoutDashboard, CheckSquare, Square, ChevronRight, ChevronLeft,
  Clock, CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import notify from '@/lib/notify';

type Order = {
  id: string;
  createdAt: Timestamp | null;
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
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 1. Proteksi Akses & Cek Role (Admin/Cashier)
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push('/profil/login');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const role = userDoc.data()?.role;
      if (role !== 'admin' && role !== 'cashier') return router.push('/profil');
    });
    return () => unsubAuth();
  }, [router]);

  // 2. Real-time Data Fetching
  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 3. Fungsi Cetak Cepat
  const handlePrint = (orderId: string) => {
    router.push(`/admin/orders/print/${orderId}`);
  };

  // 4. Fungsi Ubah Status Masal
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
      notify.admin.success('Berhasil diperbarui!');
    } catch {
      notify.admin.error('Gagal memperbarui status.');
    }

  };

  // FITUR TANDAI SEMUA (Sesuai Filter yang sedang aktif)
  const handleSelectAll = () => {
    const filteredIds = currentItems.map(order => order.id);

    // Jika semua item di halaman ini sudah terpilih, maka kosongkan (unselect all)
    const isAllSelected = filteredIds.every(id => selectedOrders.includes(id));

    if (isAllSelected) {
      setSelectedOrders(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Tambahkan ID yang belum terpilih
      setSelectedOrders(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  // 5. Logika Filter & Pagination
  const filteredOrders = orders.filter(order => {
    const matchesSearch = (order.id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customerName || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'SEMUA' || order.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const currentItems = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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

      {/* Header Navigasi */}
      <div className="mb-6 flex items-center justify-between no-print">
        <Link href="/admin" className="flex items-center gap-2 text-[10px] font-black bg-white border px-4 py-2 rounded-2xl hover:bg-black hover:text-white transition shadow-sm uppercase tracking-widest">
          <LayoutDashboard size={14} /> Dashboard
        </Link>
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Order System v2.0</div>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">List Pesanan</h1>
        <p className="text-gray-400 text-xs font-bold uppercase">Update status dan kelola invoice pelanggan</p>
      </div>

      {/* Toolbar Cari & Filter */}
      <div className="flex flex-wrap gap-3 mb-6 no-print items-center">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
          <input
            type="text"
            placeholder="Cari ID atau Nama..."
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-black outline-none"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>

        {/* TOMBOL TANDAI SEMUA */}
        <button
          onClick={handleSelectAll}
          className={`flex items-center gap-2 px-6 py-4 rounded-[1.5rem] text-[10px] font-black transition-all border tracking-widest uppercase ${currentItems.length > 0 && currentItems.every(id => selectedOrders.includes(id.id))
            ? 'bg-emerald-600 text-white border-emerald-600'
            : 'bg-white text-black border-gray-100 shadow-sm'
            }`}
        >
          <CheckCircle2 size={16} /> Tandai Hal Ini
        </button>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {['SEMUA', 'MENUNGGU', 'DIPROSES', 'SELESAI'].map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab as 'SEMUA' | 'MENUNGGU' | 'DIPROSES' | 'SELESAI'); setCurrentPage(1); }}
              className={`px-6 py-4 rounded-[1.5rem] text-[10px] font-black transition-all whitespace-nowrap tracking-widest ${activeTab === tab ? 'bg-black text-white shadow-xl' : 'bg-white text-gray-400 border border-gray-100 shadow-sm'
                }`}
            >
              {tab}
            </button>
          ))}

        </div>
      </div>

      {/* Floating Bulk Action */}
      {selectedOrders.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-5 rounded-[2rem] shadow-2xl z-50 flex items-center gap-6 border border-white/10 no-print">
          <div className="text-xs font-black uppercase tracking-widest">{selectedOrders.length} Dipilih</div>
          <div className="flex gap-2">
            <button onClick={() => handleBulkUpdate('DIPROSES')} className="bg-amber-500 hover:bg-amber-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase">Proses</button>
            <button onClick={() => handleBulkUpdate('DIKIRIM')} className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase">Kirim</button>
            <button onClick={() => handleBulkUpdate('SELESAI')} className="bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase">Selesai</button>
            <button onClick={() => setSelectedOrders([])} className="bg-white/10 p-2 rounded-xl"><XCircle size={18} /></button>
          </div>
        </div>
      )}

      {/* List Order Cards */}
      <div className="grid grid-cols-1 gap-3">
        {loading ? (
          <div className="text-center py-20 font-black text-gray-300 animate-pulse uppercase">Memuat Database...</div>
        ) : currentItems.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-gray-100 font-bold text-gray-400 uppercase italic">Kosong</div>
        ) : (
          currentItems.map((order) => (
            <div
              key={order.id}
              className={`group bg-white rounded-[2rem] p-5 border shadow-sm transition-all flex flex-col md:flex-row items-center gap-5 ${selectedOrders.includes(order.id) ? 'border-black ring-1 ring-black bg-gray-50' : 'border-gray-50'
                }`}
            >
              {/* Checkbox */}
              <button onClick={() => setSelectedOrders(prev => prev.includes(order.id) ? prev.filter(i => i !== order.id) : [...prev, order.id])} className="text-gray-200 hover:text-black transition-colors">
                {selectedOrders.includes(order.id) ? <CheckSquare size={26} className="text-black" /> : <Square size={26} />}
              </button>

              {/* Info Utama */}
              <div className="flex-1 flex items-center gap-4 w-full">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${getStatusColor(order.status)}`}>
                  <ShoppingCart size={24} />
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-xs uppercase">ORD-{order.id.substring(0, 5)}</span>
                    <span className={`text-[8px] px-2 py-1 rounded-lg font-black tracking-widest uppercase transition-colors ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <h3 className="font-black text-gray-900 uppercase text-sm truncate">{order.customerName || 'Pelanggan'}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase">
                    <Clock size={10} /> {order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleString('id-ID') : '-'}
                  </div>
                </div>
              </div>

              {/* Tagihan */}
              <div className="w-full md:w-auto flex flex-col md:items-end bg-gray-50 md:bg-transparent p-3 md:p-0 rounded-2xl">
                <p className="text-[9px] font-black text-gray-400 uppercase">Total Tagihan</p>
                <p className="text-xl font-black text-emerald-600">Rp {order.total.toLocaleString()}</p>
                <div className="text-[9px] font-black text-gray-500 flex items-center gap-1 uppercase">
                  <Truck size={10} /> {order.deliveryMethod?.replace('_', ' ')}
                </div>
              </div>

              {/* Tombol Aksi */}
              <div className="flex gap-2 shrink-0 w-full md:w-auto">
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-black text-white hover:bg-emerald-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg"
                >
                  Invoice <ChevronRight size={14} />
                </Link>
                <button
                  onClick={() => handlePrint(order.id)}
                  className="p-3 bg-white text-gray-400 hover:text-black rounded-2xl border border-gray-100 shadow-sm transition-all"
                >
                  <Printer size={20} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Nav */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4 no-print">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-3 rounded-2xl bg-white border shadow-sm disabled:opacity-20"><ChevronLeft size={20} /></button>
          <span className="text-xs font-black uppercase tracking-widest">Hal {currentPage} / {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-3 rounded-2xl bg-white border shadow-sm disabled:opacity-20"><ChevronRight size={20} /></button>
        </div>
      )}

      {selectedOrders.length > 0 && <div className="h-32"></div>}
    </div>
  );
}
