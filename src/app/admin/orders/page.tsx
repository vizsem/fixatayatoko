'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, orderBy, doc, getDoc, onSnapshot, writeBatch, Timestamp, where, getDocs
} from 'firebase/firestore';
import {
  ShoppingCart, Search, Truck, Printer, XCircle,
  LayoutDashboard, CheckSquare, Square, ChevronRight, ChevronLeft,
  Clock, CheckCircle2, Trash2, AlertTriangle, Filter, RefreshCcw, Calendar
} from 'lucide-react';
import Link from 'next/link';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';

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
  const [isDeleting, setIsDeleting] = useState(false);

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

  // 2. Real-time Data Fetching (Fetch ALL relevant orders for client-side pagination)
  // We remove the limit(10) to allow client-side pagination to work correctly
  useEffect(() => {
    const q = query(
      collection(db, 'orders'), 
      orderBy('createdAt', 'desc')
    );
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

  // FITUR HAPUS DATA LAMA (> 90 HARI)
  const handleCleanupOldData = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus data pesanan yang lebih lama dari 90 hari? Tindakan ini tidak dapat dibatalkan.")) return;
    
    setIsDeleting(true);
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const q = query(
        collection(db, 'orders'),
        where('createdAt', '<', ninetyDaysAgo)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        notify.admin.success("Tidak ada data lama yang perlu dihapus.");
        setIsDeleting(false);
        return;
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      notify.admin.success(`Berhasil menghapus ${snapshot.size} pesanan lama.`);
    } catch (error) {
      console.error(error);
      notify.admin.error("Gagal menghapus data lama.");
    } finally {
      setIsDeleting(false);
    }
  };

  // FITUR TANDAI SEMUA (Sesuai Filter yang sedang aktif)
  const handleSelectAll = () => {
    const filteredIds = currentItems.map(order => order.id);
    const isAllSelected = filteredIds.every(id => selectedOrders.includes(id));

    if (isAllSelected) {
      setSelectedOrders(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
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
      case 'MENUNGGU': return 'bg-rose-100 text-rose-600 border-rose-200';
      case 'DIPROSES': return 'bg-amber-100 text-amber-600 border-amber-200';
      case 'DIKIRIM': return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'SELESAI': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      case 'DIBATALKAN': return 'bg-slate-100 text-slate-500 border-slate-200';
      default: return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 lg:p-10">
      <Toaster position="top-right" />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Order Management</h1>
          <p className="text-slate-500 font-medium">Kelola pesanan masuk & status pengiriman</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/admin" className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-600 transition-all">
             <LayoutDashboard size={20} />
          </Link>
          <button 
            onClick={handleCleanupOldData}
            disabled={isDeleting}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-rose-100 text-rose-600 rounded-xl font-bold text-xs shadow-sm hover:bg-rose-50 transition-all"
          >
             {isDeleting ? <RefreshCcw className="animate-spin" size={16} /> : <Trash2 size={16} />}
             <span>Bersihkan Data Lama (&gt;90 Hari)</span>
          </button>
        </div>
      </div>

      {/* Stats Cards (Optional Summary) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Menunggu', count: orders.filter(o => o.status === 'MENUNGGU').length, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Diproses', count: orders.filter(o => o.status === 'DIPROSES').length, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Dikirim', count: orders.filter(o => o.status === 'DIKIRIM').length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Selesai', count: orders.filter(o => o.status === 'SELESAI').length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center">
             <span className={`text-2xl font-black ${stat.color} mb-1`}>{stat.count}</span>
             <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-2 rounded-[1.5rem] shadow-sm border border-slate-100 mb-8 flex flex-col md:flex-row items-center gap-2">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Cari ID / Nama Pelanggan..."
            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 rounded-2xl text-sm font-bold text-slate-700 placeholder:text-slate-400 outline-none focus:bg-slate-100 transition-all"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <div className="h-8 w-px bg-slate-100 hidden md:block mx-2"></div>

        <div className="flex flex-1 gap-1 overflow-x-auto w-full no-scrollbar p-1">
          {['SEMUA', 'MENUNGGU', 'DIPROSES', 'SELESAI'].map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab as any); setCurrentPage(1); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab 
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <button
          onClick={handleSelectAll}
          className={`shrink-0 px-5 py-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            currentItems.length > 0 && currentItems.every(id => selectedOrders.includes(id.id))
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CheckCircle2 size={16} />
          <span className="hidden md:inline">Pilih Semua</span>
        </button>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCcw className="animate-spin text-slate-300 mb-4" size={32} />
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Memuat Data Transaksi...</p>
          </div>
        ) : currentItems.length === 0 ? (
          <div className="bg-white rounded-[2rem] border border-dashed border-slate-200 p-20 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <ShoppingCart size={32} />
            </div>
            <h3 className="text-slate-900 font-bold text-lg mb-1">Tidak ada pesanan ditemukan</h3>
            <p className="text-slate-400 text-sm">Coba ubah filter atau kata kunci pencarian Anda</p>
          </div>
        ) : (
          currentItems.map((order) => (
            <div
              key={order.id}
              className={`group bg-white rounded-[2rem] p-4 md:p-6 border transition-all hover:shadow-lg hover:border-slate-200 relative overflow-hidden ${
                selectedOrders.includes(order.id) ? 'border-slate-900 ring-1 ring-slate-900 bg-slate-50/50' : 'border-slate-100'
              }`}
            >
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative z-10">
                {/* Checkbox */}
                <button 
                  onClick={() => setSelectedOrders(prev => prev.includes(order.id) ? prev.filter(i => i !== order.id) : [...prev, order.id])} 
                  className="mt-1 md:mt-0 text-slate-300 hover:text-slate-900 transition-colors"
                >
                  {selectedOrders.includes(order.id) ? <CheckSquare size={24} className="text-slate-900" /> : <Square size={24} />}
                </button>

                {/* Status Icon */}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${getStatusColor(order.status).replace('text-', 'border-').split(' ')[2] || 'border-slate-100'} ${getStatusColor(order.status).split(' ')[0]}`}>
                  <ShoppingCart size={20} className={getStatusColor(order.status).split(' ')[1]} />
                </div>

                {/* Order Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-black text-xs text-slate-900 uppercase tracking-wide">#{order.id.substring(0, 8)}</span>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide border ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 text-base truncate mb-1">{order.customerName || 'Pelanggan Umum'}</h3>
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      {order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} />
                      {order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </div>
                  </div>
                </div>

                {/* Amount & Method */}
                <div className="flex flex-col md:items-end gap-1 pl-12 md:pl-0 border-l md:border-l-0 border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tagihan</span>
                  <span className="text-lg font-black text-slate-900">Rp {order.total.toLocaleString('id-ID')}</span>
                  <div className="flex items-center gap-1.5 mt-1 px-2 py-1 bg-slate-100 rounded-lg w-fit">
                    <Truck size={12} className="text-slate-500" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase">{order.deliveryMethod?.replace(/_/g, ' ') || 'KURIR'}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-emerald-600 px-5 py-3 rounded-xl text-xs font-bold uppercase transition-all shadow-lg shadow-slate-200"
                  >
                    Detail <ChevronRight size={14} />
                  </Link>
                  <button
                    onClick={() => handlePrint(order.id)}
                    className="p-3 bg-white text-slate-400 hover:text-slate-900 rounded-xl border border-slate-200 hover:border-slate-900 transition-all"
                  >
                    <Printer size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-medium text-slate-500">
            Menampilkan <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredOrders.length)}</span> dari <span className="font-bold text-slate-900">{filteredOrders.length}</span> data
          </p>
          
          <div className="flex items-center gap-2">
            <button 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            
            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Logic to show generic page numbers if too many
                let pageNum = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNum = currentPage - 2 + i;
                  if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      currentPage === pageNum 
                        ? 'bg-slate-900 text-white shadow-md' 
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button 
              disabled={currentPage === totalPages} 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Bulk Action Floating Bar */}
      {selectedOrders.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-2 pl-6 pr-2 rounded-[2rem] shadow-2xl z-50 flex items-center gap-6 border border-slate-700/50 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="flex items-center gap-3">
            <span className="bg-white/10 px-2 py-1 rounded-lg text-xs font-black">{selectedOrders.length}</span>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Item Dipilih</span>
          </div>
          
          <div className="h-8 w-px bg-white/10"></div>
          
          <div className="flex gap-1">
            <button onClick={() => handleBulkUpdate('DIPROSES')} className="bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all">Proses</button>
            <button onClick={() => handleBulkUpdate('DIKIRIM')} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all">Kirim</button>
            <button onClick={() => handleBulkUpdate('SELESAI')} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all">Selesai</button>
            <button onClick={() => setSelectedOrders([])} className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-xl transition-all ml-2">
              <XCircle size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
