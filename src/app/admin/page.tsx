'use client';

import { useEffect, useState, useLayoutEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Package, ShoppingCart, Users, Settings, TrendingUp, AlertTriangle, 
  Clock, DollarSign, Database, FileText, Gift,          
  Warehouse, ShieldCheck, LogOut, ChevronRight, Menu, X, Zap, Activity,
  Truck, UsersRound, History, BarChart3, Tag
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  collection, doc, getDoc, getDocs, query, orderBy, limit, where 
} from 'firebase/firestore';

// --- KOMPONEN PENDUKUNG ---
const QuickActionCard = ({ icon: Icon, title, description, href, color = "bg-blue-50 text-blue-600" }: any) => (
  <Link href={href} className="group">
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-green-100 transition-all h-full">
      <div className={`${color} p-3 rounded-xl w-12 h-12 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <Icon size={24} />
      </div>
      <h3 className="font-bold text-gray-800 text-sm mb-1 uppercase tracking-tight">{title}</h3>
      <p className="text-[11px] text-gray-500 leading-tight">{description}</p>
    </div>
  </Link>
);

export default function AdminDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
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
  
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useLayoutEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
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
  }, [router]);

  const fetchDashboardData = async () => {
    try {
      const pSnap = await getDocs(collection(db, 'products'));
      const lowStockCount = pSnap.docs.filter(d => (d.data().stock || 0) <= 10).length;
      
      const now = new Date();
      const todayStart = new Date(new Date().setHours(0,0,0,0)).toISOString();
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

      setRecentOrders(unreadSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { 
      console.error("Dashboard Fetch Error:", e); 
    }
  };

  const handleLogout = async () => {
    if(confirm("Yakin ingin keluar dari Console Admin?")) {
        await signOut(auth);
        router.push('/profil/login');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-green-600 mb-4"></div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Menyinkronkan Server...</p>
    </div>
  );

  const NavItem = ({ href, icon: Icon, label, colorClass }: any) => {
    const isActive = pathname === href;
    return (
      <li>
        <Link 
          href={href} 
          onClick={() => setIsMobileMenuOpen(false)}
          className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
            isActive ? `${colorClass} font-bold shadow-sm` : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <Icon size={18} />
            <span className="text-xs font-black uppercase tracking-widest">{label}</span>
          </div>
          {isActive && <ChevronRight size={14} />}
        </Link>
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-[#FBFBFE] flex">
      {/* Overlay Mobile */}
      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-100 transition-transform lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-10 px-2">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center shadow-lg text-white font-black">AT</div>
                <div>
                  <h2 className="text-lg font-black text-gray-800 leading-none tracking-tighter text-normal">ATAYATOKO</h2>
                  <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Admin Central</p>
                </div>
            </div>
            <button className="lg:hidden p-2 text-gray-400" onClick={() => setIsMobileMenuOpen(false)}>
                <X size={20}/>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <ul className="space-y-1">
              <NavItem href="/admin" icon={TrendingUp} label="Dashboard" colorClass="bg-green-50 text-green-700" />
              
              <div className="pt-4 pb-2 px-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Katalog & Stok</div>
              <NavItem href="/admin/products" icon={Package} label="Produk" colorClass="bg-blue-50 text-blue-700" />
              <NavItem href="/admin/kategori" icon={Tag} label="Kategori" colorClass="bg-blue-50 text-blue-700" />
              <NavItem href="/admin/warehouses" icon={Warehouse} label="Gudang" colorClass="bg-emerald-50 text-emerald-700" />
              <NavItem href="/admin/inventory" icon={History} label="Riwayat Stok" colorClass="bg-emerald-50 text-emerald-700" />

              <div className="pt-4 pb-2 px-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Transaksi</div>
              <NavItem href="/admin/orders" icon={ShoppingCart} label="Pesanan" colorClass="bg-purple-50 text-purple-700" />
              <NavItem href="/admin/purchases" icon={Truck} label="Pembelian" colorClass="bg-purple-50 text-purple-700" />

              <div className="pt-4 pb-2 px-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">SDM & CRM</div>
              <NavItem href="/admin/customers" icon={Users} label="Pelanggan" colorClass="bg-orange-50 text-orange-700" />
              <NavItem href="/admin/employees" icon={UsersRound} label="Karyawan" colorClass="bg-orange-50 text-orange-700" />
              <NavItem href="/admin/promotions" icon={Gift} label="Promo & Poin" colorClass="bg-pink-50 text-pink-700" />

              <div className="pt-4 pb-2 px-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Laporan</div>
              <NavItem href="/admin/reports" icon={BarChart3} label="Statistik" colorClass="bg-red-50 text-red-700" />
              <NavItem href="/admin/settings" icon={Settings} label="Konfigurasi" colorClass="bg-slate-50 text-slate-700" />
            </ul>
          </nav>

          <button onClick={handleLogout} className="mt-6 flex items-center gap-3 px-4 py-4 text-red-500 hover:bg-red-50 rounded-2xl transition-all font-black text-xs uppercase tracking-widest border border-transparent hover:border-red-100">
            <LogOut size={18} /> Keluar Sistem
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 min-h-screen p-4 lg:p-10 text-normal">
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-3 bg-white rounded-xl shadow-sm border border-gray-100"
            >
                <Menu size={20}/>
            </button>
            <div>
                <h1 className="text-2xl lg:text-3xl font-black text-gray-800 uppercase tracking-tighter">Console Admin</h1>
                <p className="text-gray-400 text-[10px] lg:text-xs font-bold uppercase tracking-widest">Status: <span className="text-green-500 underline decoration-2 underline-offset-4">Sistem Online</span></p>
            </div>
          </div>
          
          <div className="flex gap-3 items-center">
             <div className="hidden sm:flex flex-col text-right">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-tight">Omzet Mingguan</span>
                <span className="text-sm font-black text-green-600 tracking-tighter">Rp{stats.weeklySales.toLocaleString()}</span>
             </div>
             <button onClick={() => fetchDashboardData()} className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 hover:rotate-180 transition-all duration-500">
                <Activity size={20} className="text-slate-400"/>
             </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
          <StatBox label="Sales Hari Ini" value={`Rp${stats.dailySales.toLocaleString()}`} icon={DollarSign} color="text-green-600" bg="bg-green-100" />
          <StatBox label="Pesanan Baru" value={stats.unreadOrders} icon={Clock} color="text-rose-600" bg="bg-rose-100" />
          <StatBox label="Poin Beredar" value={stats.totalPointsIssued} icon={Zap} color="text-amber-600" bg="bg-amber-100" />
          <StatBox label="Stok Kritis" value={stats.lowStock} icon={AlertTriangle} color="text-orange-600" bg="bg-orange-100" />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <QuickActionCard icon={Package} title="Update Stok" description="Manajemen inventaris barang" href="/admin/products" color="bg-blue-100 text-blue-600" />
          <QuickActionCard icon={Truck} title="Supplier" description="Data pemasok barang" href="/admin/suppliers" color="bg-purple-100 text-purple-600" />
          <QuickActionCard icon={Gift} title="Loyalty" description="Atur diskon & poin" href="/admin/promotions" color="bg-pink-100 text-pink-600" />
          <QuickActionCard icon={BarChart3} title="Reports" description="Analisis performa toko" href="/admin/reports" color="bg-red-100 text-red-600" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Recent Orders Section */}
          <div className="xl:col-span-2 bg-white rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-gray-800 uppercase text-xs tracking-[0.2em]">Butuh Tindakan Segera</h3>
              <Link href="/admin/orders" className="text-[9px] font-black text-blue-600 uppercase tracking-widest border-b-2 border-blue-600 pb-0.5">Semua Pesanan</Link>
            </div>
            <div className="space-y-4">
              {recentOrders.length === 0 ? (
                <div className="text-center py-16">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck className="text-green-500" size={24}/>
                    </div>
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Antrian Bersih</p>
                </div>
              ) : (
                recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-[1.5rem] border border-transparent hover:border-green-100 hover:bg-white transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-400 group-hover:text-green-600 transition-all">
                        <Package size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-800 uppercase leading-none">{order.orderId || `#${order.id.substring(0, 6)}`}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-1 tracking-tighter truncate max-w-[120px]">{order.customerName || 'Pelanggan Umum'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-gray-900 tracking-tighter">Rp{(order.total || 0).toLocaleString()}</p>
                      <Link href={`/admin/orders`} className="text-[9px] font-black text-green-600 uppercase">Proses →</Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Infrastructure Sidebar */}
          <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-8 opacity-5">
                <Database size={150} />
            </div>
            
            <h3 className="font-black text-gray-500 uppercase text-[9px] tracking-[0.3em] mb-8">Data Infrastruktur</h3>
            <div className="space-y-6 relative z-10 text-normal">
              <SystemInfo label="Gudang Aktif" value={stats.warehouses} />
              <SystemInfo label="Promo Berjalan" value={stats.activeVouchers} />
              <SystemInfo label="Basis Pelanggan" value={stats.users} />
              <SystemInfo label="Total SKU Produk" value={stats.totalProducts} />
            </div>
            
            <div className="mt-12 p-5 bg-white/5 rounded-[2rem] border border-white/10 text-center">
              <p className="text-[9px] text-gray-400 font-black uppercase leading-relaxed tracking-widest">
                Database Cloud <br/><span className="text-green-400 font-black tracking-normal">Firestore Realtime</span>
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f1f1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e2e2e2; }
      `}</style>
    </div>
  );
}

function StatBox({ label, value, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-lg transition-all">
      <div>
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">{label}</p>
        <p className="text-xl lg:text-2xl font-black text-gray-800 tracking-tighter">{value}</p>
      </div>
      <div className={`${bg} ${color} p-4 rounded-3xl group-hover:scale-110 transition-transform shadow-inner`}><Icon size={24} /></div>
    </div>
  );
}

function SystemInfo({ label, value }: any) {
  return (
    <div className="flex justify-between items-end border-b border-white/5 pb-4">
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
      <span className="text-2xl font-black leading-none text-white tracking-tighter">{value}</span>
    </div>
  );
}