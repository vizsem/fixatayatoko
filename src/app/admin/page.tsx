'use client';

import { useEffect, useState, useLayoutEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Package, ShoppingCart, Users, Settings, TrendingUp, AlertTriangle, 
  Clock, DollarSign, MessageSquare, Database, FileText, Gift,          
  Warehouse, ShieldCheck, LogOut, ChevronRight, Menu, X 
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  collection, doc, getDoc, getDocs, query, orderBy, limit, where 
} from 'firebase/firestore';

// Komponen Quick Action dengan styling lebih halus
const QuickActionCard = ({ 
  icon: Icon, title, description, href, color = "bg-blue-50 text-blue-600"
}: any) => (
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
    dailySales: 0, totalProducts: 0, lowStock: 0, unreadOrders: 0,
    warehouses: 0, promotions: 0, users: 0
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
        alert('Akses ditolak!');
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
      
      const today = new Date();
      today.setHours(0,0,0,0);
      const qOrders = query(collection(db, 'orders'), where('createdAt', '>=', today.toISOString()));
      const oSnap = await getDocs(qOrders);
      const sales = oSnap.docs.reduce((sum, d) => sum + (Number(d.data().total) || 0), 0);

      const qUnread = query(collection(db, 'orders'), where('status', '==', 'MENUNGGU'), limit(5));
      const unreadSnap = await getDocs(qUnread);
      
      const wSnap = await getDocs(collection(db, 'warehouses'));
      const promSnap = await getDocs(collection(db, 'promotions'));
      const uSnap = await getDocs(collection(db, 'users'));

      setStats({
        dailySales: sales,
        totalProducts: pSnap.size,
        lowStock: lowStockCount,
        unreadOrders: unreadSnap.size,
        warehouses: wSnap.size,
        promotions: promSnap.size,
        users: uSnap.size
      });
      setRecentOrders(unreadSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/profil/login');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-600"></div>
    </div>
  );

  const NavItem = ({ href, icon: Icon, label, colorClass }: any) => {
    const isActive = pathname === href;
    return (
      <li>
        <Link 
          href={href} 
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
      {/* Sidebar - Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-100 transition-transform lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-10 h-10 bg-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-100 text-white font-black">AT</div>
            <div>
              <h2 className="text-lg font-black text-gray-800 leading-none tracking-tighter">ATAYATOKO</h2>
              <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Admin Central</p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <ul className="space-y-1">
              <NavItem href="/admin" icon={TrendingUp} label="Dashboard" colorClass="bg-green-50 text-green-700" />
              <NavItem href="/admin/products" icon={Package} label="Produk" colorClass="bg-blue-50 text-blue-700" />
              <NavItem href="/admin/orders" icon={ShoppingCart} label="Pesanan" colorClass="bg-purple-50 text-purple-700" />
              <NavItem href="/admin/customers" icon={Users} label="Pelanggan" colorClass="bg-orange-50 text-orange-700" />
              <NavItem href="/admin/inventory" icon={Database} label="Inventaris" colorClass="bg-emerald-50 text-emerald-700" />
              <NavItem href="/admin/promotions" icon={Gift} label="Program Promosi" colorClass="bg-pink-50 text-pink-700" />
              <NavItem href="/admin/warehouses" icon={Warehouse} label="Multi-Gudang" colorClass="bg-indigo-50 text-indigo-700" />
              <NavItem href="/admin/users" icon={ShieldCheck} label="Pengguna" colorClass="bg-amber-50 text-amber-700" />
              <NavItem href="/admin/settings" icon={Settings} label="Pengaturan" colorClass="bg-gray-100 text-gray-700" />
              <NavItem href="/admin/reports" icon={FileText} label="Laporan" colorClass="bg-red-50 text-red-700" />
            </ul>
          </nav>

          <button onClick={handleLogout} className="mt-6 flex items-center gap-3 px-4 py-4 text-red-500 hover:bg-red-50 rounded-2xl transition-all font-black text-xs uppercase tracking-widest">
            <LogOut size={18} /> Keluar Sistem
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 min-h-screen p-4 lg:p-10">
        {/* Mobile Header */}
        <div className="lg:hidden flex justify-between items-center mb-6">
          <div className="font-black text-green-600">ATAYATOKO</div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-white rounded-xl shadow-sm">
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        <div className="mb-10">
          <h1 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Dashboard Utama</h1>
          <p className="text-gray-400 text-sm font-medium">Pantau performa bisnis AtayaToko secara real-time.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
          <StatBox label="Sales Hari Ini" value={`Rp${stats.dailySales.toLocaleString()}`} icon={DollarSign} color="text-green-600" bg="bg-green-100" />
          <StatBox label="Pesanan Baru" value={stats.unreadOrders} icon={Clock} color="text-red-600" bg="bg-red-100" />
          <StatBox label="Stok Rendah" value={stats.lowStock} icon={AlertTriangle} color="text-yellow-600" bg="bg-yellow-100" />
          <StatBox label="Total Produk" value={stats.totalProducts} icon={Package} color="text-blue-600" bg="bg-blue-100" />
        </div>

        {/* Quick Actions */}
        <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Akses Cepat</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <QuickActionCard icon={Package} title="Produk" description="Update stok & harga ecer grosir" href="/admin/products" color="bg-blue-100 text-blue-600" />
          <QuickActionCard icon={ShoppingCart} title="Pesanan" description="Proses pengiriman & nota" href="/admin/orders" color="bg-purple-100 text-purple-600" />
          <QuickActionCard icon={Users} title="Pelanggan" description="Cek riwayat & data piutang" href="/admin/customers" color="bg-orange-100 text-orange-600" />
          <QuickActionCard icon={Warehouse} title="Gudang" description="Mutasi stok antar cabang" href="/admin/warehouses" color="bg-indigo-100 text-indigo-600" />
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-gray-800 uppercase text-sm tracking-tight">Pesanan Perlu Diproses</h3>
              <Link href="/admin/orders" className="text-[10px] font-black text-green-600 uppercase hover:underline">Lihat Semua</Link>
            </div>
            <div className="space-y-4">
              {recentOrders.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-xs font-bold uppercase">Semua pesanan telah diproses ✨</div>
              ) : (
                recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-green-50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-gray-400 group-hover:text-green-600 transition-colors">
                        <Clock size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-800 uppercase tracking-tighter">#{order.id.substring(0, 8)}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{order.customerName || 'Pelanggan'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-gray-800">Rp{(order.total || 0).toLocaleString()}</p>
                      <Link href={`/admin/orders/${order.id}`} className="text-[9px] font-black text-blue-600 uppercase">Proses Sekarang →</Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-gray-900 rounded-[32px] p-8 text-white">
            <h3 className="font-black text-gray-500 uppercase text-[10px] tracking-[0.2em] mb-6">Ringkasan Sistem</h3>
            <div className="space-y-6">
              <SystemInfo label="Gudang Aktif" value={stats.warehouses} />
              <SystemInfo label="Promo Berjalan" value={stats.promotions} />
              <SystemInfo label="Total User" value={stats.users} />
            </div>
            <div className="mt-10 p-4 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-[10px] text-gray-400 font-bold uppercase leading-relaxed text-center">
                Gunakan menu laporan untuk analisis bulanan yang lebih mendalam.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatBox({ label, value, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-white p-6 rounded-[28px] shadow-sm border border-gray-100 flex items-center justify-between">
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-xl font-black text-gray-800 tracking-tighter">{value}</p>
      </div>
      <div className={`${bg} ${color} p-3 rounded-2xl`}><Icon size={20} /></div>
    </div>
  );
}

function SystemInfo({ label, value }: any) {
  return (
    <div className="flex justify-between items-end border-b border-white/10 pb-4">
      <span className="text-[11px] font-bold text-gray-400 uppercase">{label}</span>
      <span className="text-2xl font-black leading-none">{value}</span>
    </div>
  );
}