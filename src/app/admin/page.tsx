'use client';

import { useEffect, useState, useLayoutEffect, useCallback } from 'react';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity, Gift, Zap,
  Package, DollarSign, Clock, AlertTriangle, ShieldCheck, Database, Truck, BarChart3
} from 'lucide-react';

import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { LucideIcon } from 'lucide-react';

import {
  collection, doc, getDoc, getDocs, query, orderBy, limit, where
} from 'firebase/firestore';
import { Product } from '@/lib/types';

interface Order {
  id: string;
  orderId?: string;
  customerName?: string;
  total?: number;
  status: string;
  createdAt: string | number | { seconds: number; nanoseconds: number };
}





interface QuickActionProps {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  color?: string;
}

const QuickActionCard = ({ icon: Icon, title, description, href, color = "bg-blue-50 text-blue-600" }: QuickActionProps) => (
  <Link href={href} className="group">
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-green-100 transition-all h-full">
      <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <Icon size={24} />
      </div>
      <h3 className="font-black text-xs tracking-tight text-gray-800 mb-1">{title}</h3>

      <p className="text-[10px] text-gray-400 font-bold leading-relaxed">{description}</p>
    </div>
  </Link>
);

 




export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    dailySales: 0,
    weeklySales: 0,
    totalProducts: 0,
    lowStock: 0,
    unreadOrders: 0,
    warehouses: 0,
    promotions: 0,
    users: 0,
    totalPointsIssued: 0,
    activeVouchers: 0
  });

  const [recentOrders, setRecentOrders] = useState<Order[]>([]);


  useLayoutEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const pSnap = await getDocs(collection(db, 'products'));
      const lowStockCount = pSnap.docs.filter(d => ((d.data() as Product).stock || 0) <= 10).length;

      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const qOrdersWeekly = query(collection(db, 'orders'), where('createdAt', '>=', sevenDaysAgo));
      const weeklySnap = await getDocs(qOrdersWeekly);

      let salesToday = 0;
      let salesWeekly = 0;

      weeklySnap.forEach(d => {
        const data = d.data();
        const amount = Number(data.total) || 0;
        salesWeekly += amount;
        if (data.createdAt >= todayStart) salesToday += amount;
      });

      const qUnread = query(
        collection(db, 'orders'),
        where('status', 'in', ['MENUNGGU', 'PENDING']),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const unreadSnap = await getDocs(qUnread);

      const uSnap = await getDocs(collection(db, 'users'));
      let totalPoints = 0;
      uSnap.forEach(d => totalPoints += (d.data().points || 0));

      const wSnap = await getDocs(collection(db, 'warehouses'));
      const promSnap = await getDocs(collection(db, 'promotions'));

      setStats({
        dailySales: salesToday,
        weeklySales: salesWeekly,
        totalProducts: pSnap.size,
        lowStock: lowStockCount,
        unreadOrders: unreadSnap.size,
        warehouses: wSnap.size,
        promotions: promSnap.size,
        users: uSnap.size,
        totalPointsIssued: totalPoints,
        activeVouchers: promSnap.docs.filter(d => d.data()?.active === true).length
      });

      setRecentOrders(unreadSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    } catch (e: unknown) {
      console.error("Dashboard Fetch Error:", e);
    }

  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        alert('Akses ditolak! Khusus Admin.');
        router.push('/profil');
        return;
      }
      await fetchDashboardData();
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router, fetchDashboardData]);


 


  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-green-600 mb-4"></div>
      <p className="text-[10px] font-black tracking-[0.3em] text-gray-400 uppercase">Menyinkronkan server...</p>

    </div>
  );




  return (
    <>
      <header className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-gray-800 tracking-tighter">Console Admin</h1>
            <p className="text-gray-400 text-[10px] lg:text-xs font-bold tracking-widest">Status: <span className="text-green-500 underline decoration-2 underline-offset-4 font-black">Sistem online</span></p>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-[9px] font-black text-gray-400 tracking-tight">Omzet mingguan</span>
            <span className="text-sm font-black text-green-600 tracking-tighter">Rp{stats.weeklySales.toLocaleString()}</span>
          </div>
          <button onClick={() => fetchDashboardData()} className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
            <Activity size={20} className="text-slate-400" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
        <StatBox label="Sales Hari Ini" value={`Rp${stats.dailySales.toLocaleString()}`} icon={DollarSign} color="text-green-600" bg="bg-green-100" />
        <StatBox label="Pesanan Baru" value={stats.unreadOrders} icon={Clock} color="text-rose-600" bg="bg-rose-100" />
        <StatBox label="Poin Beredar" value={stats.totalPointsIssued} icon={Zap} color="text-amber-600" bg="bg-amber-100" />
        <StatBox label="Stok Kritis" value={stats.lowStock} icon={AlertTriangle} color="text-orange-600" bg="bg-orange-100" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <QuickActionCard icon={Package} title="Update Stok" description="Manajemen inventaris barang" href="/admin/products" color="bg-blue-100 text-blue-600" />
        <QuickActionCard icon={Truck} title="Supplier" description="Data pemasok barang" href="/admin/suppliers" color="bg-purple-100 text-purple-600" />
        <QuickActionCard icon={Gift} title="Loyalty" description="Atur diskon & poin" href="/admin/promotions" color="bg-pink-100 text-pink-600" />
        <QuickActionCard icon={BarChart3} title="Reports" description="Analisis performa toko" href="/admin/reports" color="bg-red-100 text-red-600" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-gray-800 text-xs tracking-[0.2em]">Butuh tindakan segera</h3>
            <Link href="/admin/orders" className="text-[9px] font-black text-blue-600 tracking-widest border-b-2 border-blue-600 pb-0.5">Semua pesanan</Link>
          </div>
          <div className="space-y-4">
            {recentOrders.length === 0 ? (
              <div className="text-center py-16">
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="text-green-500" size={24} />
                </div>
                <p className="text-[10px] font-black text-gray-300 tracking-widest text-center">Antrian bersih</p>
              </div>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-[1.5rem] border border-transparent hover:border-green-100 hover:bg-white transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-400 group-hover:text-green-600 transition-all">
                      <Package size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-800 leading-none">{order.orderId || `#${order.id.substring(0, 6)}`}</p>
                      <p className="text-[10px] font-bold text-gray-400 mt-1 tracking-tighter truncate max-w-[120px]">{order.customerName || 'Pelanggan umum'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900 tracking-tighter">Rp{(order.total || 0).toLocaleString()}</p>
                    <Link href={`/admin/orders`} className="text-[9px] font-black text-green-600 tracking-widest">Proses →</Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Database size={150} />
          </div>
          <h3 className="font-black text-gray-500 text-[9px] tracking-[0.3em] mb-8">Data infrastruktur</h3>
          <div className="space-y-6 relative z-10 text-normal">
            <SystemInfo label="Gudang Aktif" value={stats.warehouses} />
            <SystemInfo label="Promo Berjalan" value={stats.activeVouchers} />
            <SystemInfo label="Basis Pelanggan" value={stats.users} />
            <SystemInfo label="Total SKU Produk" value={stats.totalProducts} />
          </div>
          <div className="mt-12 p-5 bg-white/5 rounded-[2rem] border border-white/10 text-center">
            <p className="text-[9px] text-gray-400 font-black leading-relaxed tracking-widest">
              Database cloud <br /><span className="text-green-400 font-black tracking-normal uppercase">Firestore realtime</span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function StatBox({ label, value, icon: Icon, color, bg }: { label: string, value: string | number, icon: LucideIcon, color: string, bg: string }) {

  return (
    <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-lg transition-all">
      <div>
        <p className="text-[9px] font-black text-gray-400 tracking-[0.2em] mb-2">{label}</p>

        <p className="text-xl lg:text-2xl font-black text-gray-800 tracking-tighter">{value}</p>
      </div>
      <div className={`${bg} ${color} p-4 rounded-3xl group-hover:scale-110 transition-transform shadow-inner`}><Icon size={24} /></div>
    </div>
  );
}

function SystemInfo({ label, value }: { label: string, value: string | number }) {
  return (
    <div className="flex justify-between items-end border-b border-white/5 pb-4">
      <span className="text-[10px] font-black text-gray-400 tracking-widest">{label}</span>

      <span className="text-2xl font-black leading-none text-white tracking-tighter">{value}</span>
    </div>
  );
}
