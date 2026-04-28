'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, doc, getDoc, onSnapshot, writeBatch, Timestamp, where, getDocs, runTransaction, increment, serverTimestamp
} from 'firebase/firestore';
import {
  ShoppingCart, Search, Truck, Printer, XCircle,
  LayoutDashboard, CheckSquare, Square, ChevronRight, ChevronLeft,
  Clock, CheckCircle2, Trash2, RefreshCcw, Calendar
} from 'lucide-react';
import Link from 'next/link';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';
import { Order, OrderItem } from '@/lib/types';
import * as Sentry from '@sentry/nextjs';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';

export default function AdminOrders() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'SEMUA' | 'MENUNGGU' | 'DIPROSES' | 'SELESAI'>('SEMUA');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push('/profil/login');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const role = userDoc.data()?.role;
      if (role !== 'admin' && role !== 'cashier') {
        notify.aksesDitolakAdmin();
        return router.push('/profil');
      }
    });
    return () => unsubAuth();
  }, [router]);

  useEffect(() => {
    const q = query(collection(db, 'orders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      list.sort((a, b) => {
          const dateA = a.createdAt ? (a.createdAt as any).toMillis() : 0;
          const dateB = b.createdAt ? (b.createdAt as any).toMillis() : 0;
          return dateB - dateA;
      });

      setOrders(list);
      setLoading(false);
    }, (error) => {
      Sentry.captureException(error);
      notify.error("Gagal sinkronisasi pesanan");
    });
    return () => unsubscribe();
  }, []);

  const handlePrint = (orderId: string) => {
    router.push(`/admin/orders/print/${orderId}`);
  };

  const handleBulkUpdate = async (newStatus: string) => {
    if (selectedOrders.length === 0) return;
    if (!confirm(`Ubah ${selectedOrders.length} pesanan menjadi ${newStatus}?`)) return;

    const t = notify.admin.loading(`Memperbarui ${selectedOrders.length} pesanan...`);
    try {
      const batch = writeBatch(db);
      selectedOrders.forEach((orderId) => {
        const orderRef = doc(db, 'orders', orderId);
        batch.update(orderRef, { status: newStatus, updatedAt: serverTimestamp() });
        
        const order = orders.find(o => o.id === orderId);
        if (order?.userId) {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            title: `Pesanan ${newStatus}`,
            body: `Status pesanan #${order.id.slice(0, 8)} telah diperbarui menjadi ${newStatus}.`,
            type: 'transaction',
            category: 'Pesanan',
            userId: order.userId,
            createdAt: serverTimestamp(),
            read: false,
            orderId: order.id
          });
        }
      });
      await batch.commit();
      setSelectedOrders([]);
      notify.admin.success('Berhasil diperbarui!', { id: t });
    } catch (err) {
      Sentry.captureException(err);
      notify.admin.error('Gagal memperbarui status.', { id: t });
    }
  };

  const handleBulkCancel = async () => {
    if (selectedOrders.length === 0) return;
    if (!confirm(`Yakin ingin membatalkan ${selectedOrders.length} pesanan? \n\n⚠️ Stok akan dikembalikan otomatis.`)) return;

    const t = notify.admin.loading("Memproses pembatalan...");
    let successCount = 0;
    let failCount = 0;

    for (const orderId of selectedOrders) {
      try {
        await runTransaction(db, async (transaction) => {
          const orderRef = doc(db, 'orders', orderId);
          const orderSnap = await transaction.get(orderRef);
          
          if (!orderSnap.exists()) throw new Error("Pesanan tidak ditemukan");
          
          const orderData = orderSnap.data() as Order;
          if (orderData.status === 'DIBATALKAN') throw new Error("Sudah dibatalkan");

          if (orderData.items) {
            for (const item of orderData.items) {
              if (!item.productId) continue;
              const pRef = doc(db, 'products', item.productId);
              const pSnap = await transaction.get(pRef);
              if (pSnap.exists()) {
                const pData = pSnap.data();
                const stockByWh = pData.stockByWarehouse || {};
                const whId = item.warehouseId || 'gudang-utama';
                stockByWh[whId] = (stockByWh[whId] || 0) + item.quantity;
                
                transaction.update(pRef, {
                  stock: increment(item.quantity),
                  stockByWarehouse: stockByWh
                });

                transaction.set(doc(collection(db, 'inventory_logs')), {
                  productId: item.productId,
                  productName: item.name || 'Unknown',
                  type: 'MASUK',
                  amount: item.quantity,
                  adminId: auth.currentUser?.uid || 'admin',
                  source: 'CANCEL_ORDER',
                  orderId,
                  note: `Refund Pembatalan #${orderId.substring(0,8)}`,
                  date: serverTimestamp()
                });
              }
            }
          }

          if (orderData.userId && orderData.userId !== 'guest') {
             const userRef = doc(db, 'users', orderData.userId);
             const userSnap = await transaction.get(userRef);
             if (userSnap.exists()) {
                const refundW = orderData.walletUsed || 0;
                const refundP = orderData.pointsUsed || 0;
                if (refundW > 0 || refundP > 0) {
                   transaction.update(userRef, {
                      walletBalance: increment(refundW),
                      points: increment(refundP)
                   });
                }
             }
          }

          transaction.update(orderRef, { status: 'DIBATALKAN', updatedAt: serverTimestamp() });
        });
        successCount++;
      } catch (err) {
        Sentry.captureException(err);
        failCount++;
      }
    }

    notify.dismiss(t);
    if (successCount > 0) notify.admin.success(`${successCount} pesanan dibatalkan`);
    if (failCount > 0) notify.admin.error(`${failCount} pesanan gagal`);
    setSelectedOrders([]);
  };

  const handleCleanupOldData = async () => {
    if (!confirm("Hapus data > 90 hari?")) return;
    setIsDeleting(true);
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const q = query(collection(db, 'orders'), where('createdAt', '<', ninetyDaysAgo));
      const snap = await getDocs(q);
      if (snap.empty) return notify.admin.success("Data sudah bersih");
      const batch = writeBatch(db);
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      notify.admin.success(`Berhasil menghapus ${snap.size} data lama.`);
    } catch (err) {
      Sentry.captureException(err);
      notify.admin.error("Gagal hapus data lama");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectAll = () => {
    const filteredIds = currentItems.map(order => order.id);
    const isAllSelected = filteredIds.every(id => selectedOrders.includes(id));
    if (isAllSelected) setSelectedOrders(prev => prev.filter(id => !filteredIds.includes(id)));
    else setSelectedOrders(prev => [...new Set([...prev, ...filteredIds])]);
  };

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const filteredOrders = orders.filter(order => {
    const matchesSearch = (order.id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customerName || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const s = (order.status || '').toUpperCase();
    let matchesTab = activeTab === 'SEMUA' || (activeTab === 'MENUNGGU' ? (s === 'MENUNGGU' || s === 'PENDING' || s === 'BELUM_LUNAS') : s === activeTab);

    let matchesPayment = true;
    const ps = (order.paymentStatus || '').toUpperCase();
    if (paymentStatusFilter === 'PAID') matchesPayment = ['PAID', 'LUNAS', 'SUCCESS', 'SETTLED'].includes(ps);
    else if (paymentStatusFilter === 'UNPAID') matchesPayment = ['UNPAID', 'BELUM_LUNAS', 'PENDING', ''].includes(ps);

    const tMs = (order.createdAt as any)?.toMillis?.() || 0;
    const startOk = startDate ? tMs >= new Date(startDate).getTime() : true;
    const endOk = endDate ? tMs <= new Date(endDate).getTime() + 86400000 : true;

    return matchesSearch && matchesTab && matchesPayment && startOk && endOk;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const currentItems = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusColor = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'MENUNGGU': case 'PENDING': case 'BELUM_LUNAS': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'DIPROSES': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'DIKIRIM': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'SELESAI': case 'LUNAS': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-3 md:p-6 pb-32">
      <Toaster position="top-right" />

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Orders Pipeline</h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Transaction flow management</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={handleCleanupOldData} disabled={isDeleting} className="px-4 py-2.5 bg-white border border-rose-100 text-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-rose-50 transition-all flex items-center gap-2">
             {isDeleting ? <RefreshCcw className="animate-spin" size={14} /> : <Trash2 size={14} />} Cleanup 90d
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[
          { label: 'Pending', count: orders.filter(o => o.status === 'MENUNGGU').length, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Processing', count: orders.filter(o => o.status === 'DIPROSES').length, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Shipping', count: orders.filter(o => o.status === 'DIKIRIM').length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Finished', count: orders.filter(o => o.status === 'SELESAI').length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center">
             <span className={`text-2xl font-black ${stat.color}`}>{stat.count}</span>
             <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100 mb-6 flex flex-col lg:flex-row items-center gap-2">
        <div className="relative w-full lg:max-w-[240px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
          <input
            type="text"
            placeholder="Search orders..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-2xl text-xs font-bold outline-none"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <div className="flex flex-1 gap-1 overflow-x-auto w-full no-scrollbar px-1">
          {['SEMUA', 'MENUNGGU', 'DIPROSES', 'DIKIRIM', 'SELESAI'].map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab as any); setCurrentPage(1); }}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all whitespace-nowrap ${activeTab === tab ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto px-1">
          <select value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)} className="bg-slate-50 border-none rounded-xl px-3 py-2.5 text-[10px] font-black uppercase outline-none">
            <option value="ALL">All Payment</option>
            <option value="PAID">Paid</option>
            <option value="UNPAID">Unpaid</option>
          </select>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50 border-none rounded-xl px-3 py-2 text-[10px] font-black" />
          <button onClick={handleSelectAll} className="p-3 bg-slate-900 text-white rounded-xl shadow-md"><CheckCircle2 size={16} /></button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {currentItems.map((order) => (
            <div key={order.id} className={`bg-white rounded-[1.5rem] p-4 border transition-all ${selectedOrders.includes(order.id) ? 'border-slate-900 ring-4 ring-slate-50' : 'border-slate-100 hover:border-slate-200'}`}>
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <button onClick={() => setSelectedOrders(prev => prev.includes(order.id) ? prev.filter(i => i !== order.id) : [...prev, order.id])} className="text-slate-200">
                  {selectedOrders.includes(order.id) ? <CheckSquare size={20} className="text-slate-900" /> : <Square size={20} />}
                </button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">#{order.id.substring(0, 8)}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black uppercase border ${getStatusColor(order.status)}`}>{order.status}</span>
                  </div>
                  <h3 className="font-black text-slate-800 text-sm uppercase truncate">{order.customerName || 'Walk-in Customer'}</h3>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 mt-1">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {order.createdAt ? (order.createdAt as any).toDate().toLocaleDateString('id-ID') : '-'}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {order.createdAt ? (order.createdAt as any).toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                  </div>
                </div>

                <div className="flex flex-col md:items-end md:text-right">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">Total</p>
                  <p className="text-lg font-black text-slate-900 leading-tight">Rp {order.total.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-1 text-[9px] font-black text-slate-500 uppercase">
                    <Truck size={12} /> {order.deliveryMethod?.replace(/_/g, ' ') || 'STORE'}
                  </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-none border-slate-50">
                  <Link href={`/admin/orders/${order.id}`} className="flex-1 md:flex-none px-5 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest text-center">Detail</Link>
                  <button onClick={() => handlePrint(order.id)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-slate-900 transition-all"><Printer size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
           <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} className="p-3 bg-white border border-slate-100 rounded-xl"><ChevronLeft size={16}/></button>
           <span className="flex items-center px-4 text-xs font-black text-slate-400">PAGE {currentPage} / {totalPages}</span>
           <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} className="p-3 bg-white border border-slate-100 rounded-xl"><ChevronRight size={16}/></button>
        </div>
      )}

      {selectedOrders.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 p-2 rounded-[2.5rem] shadow-2xl flex items-center gap-2 z-[100] animate-in slide-in-from-bottom-10">
          <div className="px-4 py-2 bg-white/10 rounded-full text-[10px] font-black text-white">{selectedOrders.length} SELECTED</div>
          <button onClick={handleBulkCancel} className="px-5 py-2.5 bg-rose-600 text-white rounded-full text-[10px] font-black uppercase">Cancel</button>
          <button onClick={() => handleBulkUpdate('DIPROSES')} className="px-5 py-2.5 bg-amber-500 text-white rounded-full text-[10px] font-black uppercase">Process</button>
          <button onClick={() => handleBulkUpdate('DIKIRIM')} className="px-5 py-2.5 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase">Ship</button>
          <button onClick={() => handleBulkUpdate('SELESAI')} className="px-5 py-2.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase">Done</button>
        </div>
      )}
    </div>
  );
}
