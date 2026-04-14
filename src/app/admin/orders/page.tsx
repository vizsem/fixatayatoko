'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, orderBy, doc, getDoc, onSnapshot, writeBatch, Timestamp, where, getDocs, runTransaction, increment, addDoc, serverTimestamp
} from 'firebase/firestore';
import {
  ShoppingCart, Search, Truck, Printer, XCircle,
  LayoutDashboard, CheckSquare, Square, ChevronRight, ChevronLeft,
  Clock, CheckCircle2, Trash2, RefreshCcw, Calendar, XOctagon
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
  userId?: string;
  items?: any[]; // Added for cancel logic
  walletUsed?: number; // Added for cancel logic
  pointsUsed?: number; // Added for cancel logic
  paymentStatus?: string;
};

export default function AdminOrders() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'SEMUA' | 'MENUNGGU' | 'DIPROSES' | 'SELESAI'>('SEMUA');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
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
    // Also removing orderBy from query to ensure we get docs even if createdAt is missing, then sort client-side
    useEffect(() => {
      const q = query(collection(db, 'orders'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        
        // Client-side sorting
        list.sort((a, b) => {
            const dateA = a.createdAt ? a.createdAt.toMillis() : 0;
            const dateB = b.createdAt ? b.createdAt.toMillis() : 0;
            return dateB - dateA;
        });

        setOrders(list);
        setLoading(false);
      });
      return () => unsubscribe();
    }, []);

  // 6. Fungsi Auto-Update Status (Simulasi Cron Job)
  // Menjalankan logika update status otomatis setiap kali halaman ini dimuat oleh admin
  useEffect(() => {
    const runAutoUpdate = async () => {
      // Hanya jalankan jika data sudah ada
      if (orders.length === 0) return;

      const batch = writeBatch(db);
      let batchCount = 0;
      const now = new Date().getTime();

      orders.forEach((order) => {
        if (!order.createdAt) return;
        const createdTime = order.createdAt.toDate().getTime();
        const diffHours = (now - createdTime) / (1000 * 60 * 60);
        
        let newStatus = '';

        // Aturan 1: 'MENUNGGU' -> 'DIPROSES' (Max 24 Jam)
        if (order.status === 'MENUNGGU' && diffHours > 24) {
          newStatus = 'DIPROSES';
        }
        
        // Aturan 2: 'DIPROSES' -> 'DIKIRIM' (Setelah 12 Jam)
        // Kita asumsikan 'updatedAt' jika ada, tapi pakai createdAt sebagai estimasi kasar jika tidak
        else if (order.status === 'DIPROSES' && diffHours > 36) { // 24 + 12
          newStatus = 'DIKIRIM';
        }

        // Aturan 3: 'DIKIRIM' -> 'SELESAI'
        else if (order.status === 'DIKIRIM') {
          // Estimasi berdasarkan deliveryMethod
          let finishThresholdHours = 24; // Default 24 jam untuk lokal/toko
          
          // @ts-ignore - Check for channel property
          if (order.channel === 'SHOPEE') finishThresholdHours = 72; // 3 Hari
          // @ts-ignore
          else if (order.channel === 'TIKTOK') finishThresholdHours = 216; // 9 Hari

          // Total waktu sejak dibuat > waktu proses + waktu kirim
          if (diffHours > (36 + finishThresholdHours)) {
             newStatus = 'SELESAI';
          }
        }

        if (newStatus && batchCount < 400) { // Limit batch size
          const ref = doc(db, 'orders', order.id);
          batch.update(ref, { 
            status: newStatus,
            // @ts-ignore
            updatedAt: Timestamp.now() 
          });
          
          // Kirim Notifikasi ke User
          if (order.userId) {
            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
              title: `Pesanan ${newStatus}`,
              body: `Status pesanan #${order.id.slice(0, 8)} telah diperbarui menjadi ${newStatus}.`,
              type: 'transaction',
              category: 'Pesanan',
              userId: order.userId,
              createdAt: Timestamp.now(),
              read: false,
              orderId: order.id
            });
          }
          
          batchCount++;
        }
      });

      if (batchCount > 0) {
        console.log(`Auto-updating ${batchCount} orders...`);
        await batch.commit();
        notify.admin.success(`${batchCount} pesanan diperbarui otomatis.`);
      }
    };

    // Jalankan dengan debounce/timeout agar tidak spamming saat data baru load
    const timer = setTimeout(() => {
      runAutoUpdate();
    }, 5000);

    return () => clearTimeout(timer);
  }, [orders]); // Depend on orders to check when loaded

  // 7. Fungsi Cetak Cepat
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
        
        // Kirim Notifikasi
        const order = orders.find(o => o.id === orderId);
        if (order?.userId) {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            title: `Pesanan ${newStatus}`,
            body: `Status pesanan #${order.id.slice(0, 8)} telah diperbarui menjadi ${newStatus}.`,
            type: 'transaction',
            category: 'Pesanan',
            userId: order.userId,
            createdAt: Timestamp.now(),
            read: false,
            orderId: order.id
          });
        }
      });
      await batch.commit();
      setSelectedOrders([]);
      notify.admin.success('Berhasil diperbarui!');
    } catch {
      notify.admin.error('Gagal memperbarui status.');
    }
  };

  // Fungsi Batalkan Transaksi (Dengan Refund Stok & Dana)
  const handleBulkCancel = async () => {
    if (selectedOrders.length === 0) return;
    if (!confirm(`Yakin ingin membatalkan ${selectedOrders.length} pesanan? \n\n⚠️ Stok akan dikembalikan otomatis.\n⚠️ Dana/Poin akan direfund ke user.`)) return;

    const t = notify.admin.loading("Memproses pembatalan...");
    let successCount = 0;
    let failCount = 0;

    for (const orderId of selectedOrders) {
      try {
        await runTransaction(db, async (transaction) => {
          const orderRef = doc(db, 'orders', orderId);
          const orderSnap = await transaction.get(orderRef);
          
          if (!orderSnap.exists()) throw new Error("Pesanan tidak ditemukan");
          
          const orderData = orderSnap.data();
          if (orderData.status === 'DIBATALKAN') throw new Error("Pesanan sudah dibatalkan sebelumnya");

          // 1. Restore Stock
          if (orderData.items && Array.isArray(orderData.items)) {
            for (const item of orderData.items) {
              if (!item.productId) continue;
              
              const productRef = doc(db, 'products', item.productId);
              const productSnap = await transaction.get(productRef);
              
              if (productSnap.exists()) {
                const pData = productSnap.data();
                const currentStock = Number(pData.stock || 0);
                const qtyToRestore = Number(item.quantity || 0);
                
                // Handle Stock by Warehouse (Restore to Main Warehouse or Default)
                const stockByWarehouse = pData.stockByWarehouse || {};
                // Default logic: restore to 'gudang-utama' or the first warehouse found
                // Ideally we should know which warehouse it came from, but for now we default to main
                const targetWh = 'gudang-utama';
                stockByWarehouse[targetWh] = (stockByWarehouse[targetWh] || 0) + qtyToRestore;

                transaction.update(productRef, {
                  stock: currentStock + qtyToRestore,
                  stockByWarehouse: stockByWarehouse
                });

                // Log Inventory (Manual because we are inside transaction)
                const logRef = doc(collection(db, 'inventory_logs'));
                transaction.set(logRef, {
                  productId: item.productId,
                  productName: item.name || 'Unknown',
                  type: 'MASUK',
                  amount: qtyToRestore,
                  adminId: auth.currentUser?.uid || 'admin',
                  source: 'ORDER',
                  orderId: orderId,
                  referenceId: orderId,
                  note: `Pembatalan Pesanan #${orderId.substring(0,8)}`,
                  date: serverTimestamp(),
                  prevStock: currentStock,
                  nextStock: currentStock + qtyToRestore
                });
              }
            }
          }

          // 2. Refund Wallet & Points
          if (orderData.userId && orderData.userId !== 'guest') {
            const userRef = doc(db, 'users', orderData.userId);
            const userSnap = await transaction.get(userRef);
            
            if (userSnap.exists()) {
              const walletToRefund = Number(orderData.walletUsed || 0);
              const pointsToRefund = Number(orderData.pointsUsed || 0);

              if (walletToRefund > 0 || pointsToRefund > 0) {
                transaction.update(userRef, {
                  walletBalance: increment(walletToRefund),
                  points: increment(pointsToRefund)
                });

                if (walletToRefund > 0) {
                  const wLogRef = doc(collection(db, 'wallet_logs'));
                  transaction.set(wLogRef, {
                    userId: orderData.userId,
                    orderId: orderId,
                    amountChanged: walletToRefund,
                    type: 'REFUND',
                    description: `Refund Pembatalan Order #${orderId.substring(0,8)}`,
                    createdAt: serverTimestamp()
                  });
                }

                if (pointsToRefund > 0) {
                  const pLogRef = doc(collection(db, 'point_logs'));
                  transaction.set(pLogRef, {
                    userId: orderData.userId,
                    pointsChanged: pointsToRefund,
                    type: 'REFUND',
                    description: `Refund Poin Order #${orderId.substring(0,8)}`,
                    createdAt: serverTimestamp()
                  });
                }
              }
            }
          }

          // 3. Update Order Status
          transaction.update(orderRef, {
            status: 'DIBATALKAN',
            updatedAt: serverTimestamp()
          });
          
          // 4. Send Notification
          if (orderData.userId) {
             const notifRef = doc(collection(db, 'notifications'));
             transaction.set(notifRef, {
                title: 'Pesanan Dibatalkan',
                body: `Pesanan #${orderId.substring(0,8)} telah dibatalkan. Dana/Poin telah dikembalikan (jika ada).`,
                type: 'transaction',
                category: 'Pesanan',
                userId: orderData.userId,
                createdAt: serverTimestamp(),
                read: false,
                orderId: orderId
             });
          }
        });
        successCount++;
      } catch (err) {
        console.error(`Gagal membatalkan order ${orderId}:`, err);
        failCount++;
      }
    }

    notify.dismiss(t);
    if (successCount > 0) notify.admin.success(`${successCount} pesanan berhasil dibatalkan`);
    if (failCount > 0) notify.admin.error(`${failCount} pesanan gagal dibatalkan`);
    setSelectedOrders([]);
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

  // 5. Filter tambahan
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // 6. Logika Filter & Pagination
  const filteredOrders = orders.filter(order => {
    const matchesSearch = (order.id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customerName || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    // Normalize status for flexible matching
    const s = (order.status || '').toUpperCase();
    
    let matchesTab = false;
    if (activeTab === 'SEMUA') {
      matchesTab = true;
    } else if (activeTab === 'MENUNGGU') {
      // Include 'PENDING' and 'BELUM_LUNAS' (Tempo) in 'MENUNGGU' tab
      matchesTab = s === 'MENUNGGU' || s === 'PENDING' || s === 'BELUM_LUNAS';
    } else {
      matchesTab = s === activeTab;
    }

    let matchesPaymentStatus = true;
    const ps = (order.paymentStatus || '').toUpperCase();
    if (paymentStatusFilter === 'PAID') {
      matchesPaymentStatus = ps === 'PAID' || ps === 'LUNAS' || ps === 'SUCCESS' || ps === 'SETTLED';
    } else if (paymentStatusFilter === 'UNPAID') {
      matchesPaymentStatus = ps === 'UNPAID' || ps === 'BELUM_LUNAS' || ps === 'PENDING' || !ps;
    }

    const tMs = order.createdAt?.toDate ? order.createdAt.toDate().getTime() : 0;
    const startOk = startDate ? tMs >= new Date(startDate).getTime() : true;
    const endOk = endDate ? tMs <= new Date(endDate).getTime() + 86400000 - 1 : true;

    return matchesSearch && matchesTab && matchesPaymentStatus && startOk && endOk;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const currentItems = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusColor = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'MENUNGGU': 
      case 'PENDING':
      case 'BELUM_LUNAS':
        return 'bg-rose-100 text-rose-600 border-rose-200';
      case 'DIPROSES': return 'bg-amber-100 text-amber-600 border-amber-200';
      case 'DIKIRIM': return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'SELESAI': 
      case 'LUNAS':
        return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      case 'DIBATALKAN': return 'bg-slate-100 text-slate-500 border-slate-200';
      default: return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6">
      <Toaster position="top-right" />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1">Order Management</h1>
          <p className="text-slate-500 text-[11px] font-medium">Kelola pesanan masuk & status pengiriman</p>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Menunggu', count: orders.filter(o => o.status === 'MENUNGGU').length, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Diproses', count: orders.filter(o => o.status === 'DIPROSES').length, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Dikirim', count: orders.filter(o => o.status === 'DIKIRIM').length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Selesai', count: orders.filter(o => o.status === 'SELESAI').length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-3 md:p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center justify-center">
             <span className={`text-xl font-black ${stat.color} mb-0.5`}>{stat.count}</span>
             <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider font-sans">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-1.5 md:p-2 rounded-2xl shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row items-center gap-2">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Cari ID / Nama Pelanggan..."
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 placeholder:text-slate-400 outline-none focus:bg-slate-100 transition-all"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <div className="h-8 w-px bg-slate-100 hidden md:block mx-2"></div>

        <div className="flex flex-1 gap-1 overflow-x-auto w-full no-scrollbar p-0.5">
          {['SEMUA', 'MENUNGGU', 'DIPROSES', 'DIKIRIM', 'SELESAI'].map((tab) => (
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
              {tab === 'MENUNGGU' && orders.filter(o => o.status === 'MENUNGGU').length > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === tab ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600'}`}>
                  {orders.filter(o => o.status === 'MENUNGGU').length}
                </span>
              )}
            </button>
          ))}
          
          <div className="h-6 w-px bg-slate-200 mx-2 self-center shrink-0"></div>
          
          <select 
            value={paymentStatusFilter}
            onChange={(e) => { setPaymentStatusFilter(e.target.value); setCurrentPage(1); }}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-50 border-none text-slate-600 outline-none shrink-0 cursor-pointer hover:bg-slate-100 transition-colors"
          >
            <option value="ALL">Semua Pembayaran</option>
            <option value="PAID">Lunas</option>
            <option value="UNPAID">Belum Lunas</option>
          </select>
        </div>

        <div className="h-8 w-px bg-slate-100 hidden md:block mx-2"></div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="px-3 py-2 rounded-xl bg-slate-50 text-xs font-bold outline-none"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
          />
          <span className="text-slate-400 text-xs">s/d</span>
          <input
            type="date"
            className="px-3 py-2 rounded-xl bg-slate-50 text-xs font-bold outline-none"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
          />
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
              className={`group bg-white rounded-2xl p-3 md:p-4 border transition-all hover:shadow-md hover:border-slate-200 relative overflow-hidden ${
                selectedOrders.includes(order.id) ? 'border-slate-900 ring-1 ring-slate-900 bg-slate-50/50' : 'border-slate-100'
              }`}
            >
              <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-6 relative z-10">
                {/* Checkbox */}
                <button 
                  onClick={() => setSelectedOrders(prev => prev.includes(order.id) ? prev.filter(i => i !== order.id) : [...prev, order.id])} 
                  className="mt-0.5 md:mt-0 text-slate-300 hover:text-slate-900 transition-colors"
                >
                  {selectedOrders.includes(order.id) ? <CheckSquare size={18} className="text-slate-900" /> : <Square size={18} />}
                </button>

                {/* Status Icon */}
                <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 border ${getStatusColor(order.status).replace('text-', 'border-').split(' ')[2] || 'border-slate-100'} ${getStatusColor(order.status).split(' ')[0]}`}>
                  <ShoppingCart size={14} className={getStatusColor(order.status).split(' ')[1]} />
                </div>

                {/* Order Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-black text-[10px] text-slate-900 uppercase tracking-wide">#{order.id.substring(0, 8)}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm md:text-base truncate mb-1">{order.customerName || 'Pelanggan Umum'}</h3>
                  <div className="flex items-center gap-3 md:gap-4 text-[10px] md:text-xs font-medium text-slate-500">
                    <div className="flex items-center gap-1">
                      <Calendar size={12} />
                      {order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      {order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </div>
                  </div>
                </div>

                {/* Amount & Method */}
                <div className="flex flex-col md:items-end gap-0 pl-11 md:pl-0 border-l-0 md:border-l-0 border-slate-100">
                  <span className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Tagihan</span>
                  <span className="text-sm md:text-base font-black text-slate-900">Rp {order.total.toLocaleString('id-ID')}</span>
                  <div className="flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-slate-100 rounded-md w-fit">
                    <Truck size={10} className="text-slate-500" />
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">{order.deliveryMethod?.replace(/_/g, ' ') || 'KURIR'}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 w-full md:w-auto mt-2 md:mt-0 pt-2.5 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-slate-900 text-white hover:bg-emerald-600 px-3 py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase transition-all shadow-md shadow-slate-200"
                  >
                    Detail <ChevronRight size={10} />
                  </Link>
                  <button
                    onClick={() => handlePrint(order.id)}
                    className="p-2 bg-white text-slate-400 hover:text-slate-900 rounded-lg border border-slate-200 hover:border-slate-900 transition-all"
                  >
                    <Printer size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
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
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-1.5 pl-5 pr-1.5 rounded-3xl shadow-2xl z-50 flex items-center gap-5 border border-slate-700/50 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="flex items-center gap-3">
            <span className="bg-white/10 px-2 py-1 rounded-lg text-xs font-black">{selectedOrders.length}</span>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Item Dipilih</span>
          </div>
          
          <div className="h-8 w-px bg-white/10"></div>
          
          <div className="flex gap-1">
            <button onClick={handleBulkCancel} className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all">Batal</button>
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
