'use client';

import { useEffect, useState, useLayoutEffect, useCallback } from 'react';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity, Gift, Zap,
  Package, DollarSign, Clock, AlertTriangle, ShieldCheck, Database, Truck, BarChart3,
  TrendingUp, Users, ShoppingCart, ArrowUpRight, ArrowRight, MoreHorizontal, Calendar
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { LucideIcon } from 'lucide-react';
import {
  collection, doc, getDoc, getDocs, query, orderBy, limit, where, Timestamp
} from 'firebase/firestore';

interface Order {
  id: string;
  orderId?: string;
  customerName?: string;
  total?: number;
  status: string;
  createdAt: any;
  items?: any[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  sales?: number;
}

interface DailySales {
  date: string;
  amount: number;
  dayName: string;
}

const QuickActionCard = ({ icon: Icon, title, description, href, color = "bg-blue-50 text-blue-600" }: { icon: LucideIcon; title: string; description: string; href: string; color?: string }) => (
  <Link href={href} className="group block h-full">
    <div className="bg-white p-3 md:p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all h-full flex flex-col items-center text-center">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-sm`}>
        <Icon size={20} />
      </div>
      <h3 className="font-bold text-xs text-gray-800 mb-1">{title}</h3>
      <p className="text-[10px] text-gray-500 leading-tight">{description}</p>
    </div>
  </Link>
);

const StatBox = ({ label, value, icon: Icon, color, bg, trend }: { label: string, value: string | number, icon: LucideIcon, color: string, bg: string, trend?: string }) => (
  <div className="bg-white p-3.5 md:p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between group hover:shadow-md transition-all h-full relative overflow-hidden">
    <div className={`absolute top-0 right-0 p-3 md:p-4 opacity-10 -mr-4 -mt-4 transform rotate-12 group-hover:scale-125 transition-transform duration-500`}>
      <Icon size={70} className={color.replace('text-', 'fill-')} />
    </div>
    <div className="flex justify-between items-start mb-3 z-10">
      <div className={`${bg} ${color} p-2.5 rounded-xl shadow-inner`}>
        <Icon size={18} />
      </div>
      {trend && (
        <span className="bg-green-50 text-green-600 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
          <TrendingUp size={10} /> {trend}
        </span>
      )}
    </div>
    <div className="z-10 mt-2">
      <p className="text-xl lg:text-2xl font-black text-gray-800 tracking-tight mb-0.5">{value}</p>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-tight">{label}</p>
    </div>
  </div>
);

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    dailySales: 0,
    weeklySales: 0,
    monthlySales: 0,
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
  const [topProducts, setTopProducts] = useState<Product[]>([]);
  const [salesChartData, setSalesChartData] = useState<DailySales[]>([]);

  useLayoutEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.toISOString();
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      // Fetch Orders (Last 30 days for broader analysis)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      
      const qOrders = query(
        collection(db, 'orders'), 
        where('createdAt', '>=', thirtyDaysAgo),
        orderBy('createdAt', 'desc')
      );
      
      const ordersSnap = await getDocs(qOrders);
      
      let salesToday = 0;
      let salesWeekly = 0;
      let salesMonthly = 0;
      const dailyMap = new Map<string, number>();
      const productSalesMap = new Map<string, number>();

      // Initialize last 7 days map
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dailyMap.set(dateStr, 0);
      }

      ordersSnap.forEach(d => {
        const data = d.data();
        const created = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        const dateStr = created.toISOString().split('T')[0];
        const amount = Number(data.total) || 0;

        // Calculate Totals
        if (created >= new Date(todayStart)) salesToday += amount;
        if (created >= sevenDaysAgo) salesWeekly += amount;
        if (data.createdAt >= startOfMonth) salesMonthly += amount;

        // Daily Chart Data (Last 7 Days)
        if (dailyMap.has(dateStr)) {
          dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + amount);
        }

        // Product Sales Analysis
        if (data.items && Array.isArray(data.items)) {
          data.items.forEach((item: any) => {
            const pid = item.productId || item.id;
            const qty = Number(item.quantity) || 0;
            if (pid) {
              productSalesMap.set(pid, (productSalesMap.get(pid) || 0) + qty);
            }
          });
        }
      });

      // Prepare Chart Data
      const chartData: DailySales[] = [];
      const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      
      // Sort dates ascending for chart
      const sortedDates = Array.from(dailyMap.keys()).sort();
      sortedDates.forEach(date => {
        const d = new Date(date);
        chartData.push({
          date,
          amount: dailyMap.get(date) || 0,
          dayName: days[d.getDay()]
        });
      });

      // Fetch Top Products Details
      const sortedProductIds = Array.from(productSalesMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);

      const topProductsData: Product[] = [];
      if (sortedProductIds.length > 0) {
        // Firestore 'in' query supports max 10 items
        const productsSnap = await getDocs(query(collection(db, 'products'), where('__name__', 'in', sortedProductIds)));
        productsSnap.forEach(doc => {
          const data = doc.data();
          topProductsData.push({
            id: doc.id,
            name: data.name || data.Nama || 'Unnamed Product',
            price: Number(data.price || data.priceEcer || data.Ecer || 0),
            stock: Number(data.stock || data.Stok || 0),
            sales: productSalesMap.get(doc.id) || 0
          });
        });
        // Sort again because Firestore results are not ordered by 'in' array
        topProductsData.sort((a, b) => (b.sales || 0) - (a.sales || 0));
      }

      // Other Stats
      const productsActiveSnap = await getDocs(query(collection(db, 'products'), where('isActive', '==', true)));
      const lowStockSnap = await getDocs(query(collection(db, 'products'), where('stock', '<=', 10)));
      const unreadSnap = await getDocs(query(collection(db, 'orders'), where('status', 'in', ['MENUNGGU', 'PENDING']), limit(5)));
      const usersSnap = await getDocs(collection(db, 'users'));
      const whSnap = await getDocs(collection(db, 'warehouses'));
      const promSnap = await getDocs(collection(db, 'promotions'));

      let totalPoints = 0;
      usersSnap.forEach(d => totalPoints += (d.data().points || 0));

      setStats({
        dailySales: salesToday,
        weeklySales: salesWeekly,
        monthlySales: salesMonthly,
        totalProducts: productsActiveSnap.size,
        lowStock: lowStockSnap.size,
        unreadOrders: unreadSnap.size,
        warehouses: whSnap.size,
        promotions: promSnap.size,
        users: usersSnap.size,
        totalPointsIssued: totalPoints,
        activeVouchers: promSnap.docs.filter(d => d.data()?.isActive === true).length
      });

      setRecentOrders(unreadSnap.docs.map(d => {
        const data = d.data();
        return { 
          id: d.id, 
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
        } as Order;
      }));
      
      setSalesChartData(chartData);
      setTopProducts(topProductsData);

    } catch (e) {
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
        router.push('/profil');
        return;
      }
      await fetchDashboardData();
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router, fetchDashboardData]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-green-600 mb-4"></div>
      <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Memuat Dashboard...</p>
    </div>
  );

  const maxChartValue = Math.max(...salesChartData.map(d => d.amount), 1);

  return (
    <div className="min-h-screen bg-gray-50/50 p-3 md:p-6 font-sans text-gray-900">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-gray-500 text-xs font-medium mt-1">
            Halo Admin, ini ringkasan performa toko hari ini.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs font-bold text-gray-600">Sistem Online</span>
          </div>
          <button 
            onClick={() => fetchDashboardData()} 
            className="p-2 bg-white rounded-xl border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
            title="Refresh Data"
          >
            <Activity size={18} className="text-gray-500" />
          </button>
        </div>
      </header>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatBox 
          label="Total Pendapatan (Bulan Ini)" 
          value={`Rp${stats.monthlySales.toLocaleString('id-ID')}`} 
          icon={DollarSign} 
          color="text-emerald-600" 
          bg="bg-emerald-50" 
          trend="+12%"
        />
        <StatBox 
          label="Total Pesanan Baru" 
          value={stats.unreadOrders} 
          icon={ShoppingCart} 
          color="text-blue-600" 
          bg="bg-blue-50" 
        />
        <StatBox 
          label="Total Pelanggan" 
          value={stats.users} 
          icon={Users} 
          color="text-purple-600" 
          bg="bg-purple-50" 
        />
        <StatBox 
          label="Stok Perlu Perhatian" 
          value={stats.lowStock} 
          icon={AlertTriangle} 
          color="text-amber-600" 
          bg="bg-amber-50" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Sales Chart Section */}
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Statistik Penjualan</h3>
                <p className="text-xs text-gray-400 font-medium">Omzet 7 hari terakhir</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-gray-900">Rp{stats.weeklySales.toLocaleString('id-ID')}</p>
                <p className="text-[9px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full inline-block">Minggu Ini</p>
              </div>
            </div>
            
            {/* Simple CSS Bar Chart */}
            <div className="h-48 flex items-end justify-between gap-2 md:gap-4 mt-8">
              {salesChartData.map((data, idx) => {
                const heightPercentage = Math.max((data.amount / maxChartValue) * 100, 5); // Min 5% height
                return (
                  <div key={idx} className="flex flex-col items-center flex-1 group relative">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] py-1 px-2 rounded-lg whitespace-nowrap z-10 pointer-events-none">
                      Rp{data.amount.toLocaleString('id-ID')}
                    </div>
                    
                    <div 
                      className={`w-full max-w-[32px] rounded-t-lg transition-all duration-500 ease-out hover:opacity-80 ${idx === salesChartData.length - 1 ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-gray-100 hover:bg-emerald-200'}`}
                      style={{ height: `${heightPercentage}%` }}
                    ></div>
                    <span className={`text-[9px] font-bold mt-2 ${idx === salesChartData.length - 1 ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {data.dayName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Orders Section */}
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Pesanan Terbaru</h3>
              <Link href="/admin/orders" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                Lihat Semua <ArrowRight size={14} />
              </Link>
            </div>

            <div className="space-y-3">
              {recentOrders.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <Package className="mx-auto text-gray-300 mb-2" size={32} />
                  <p className="text-xs text-gray-400 font-medium">Belum ada pesanan baru</p>
                </div>
              ) : (
                recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-transparent hover:bg-white hover:border-gray-100 hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 shadow-sm group-hover:text-blue-600 transition-colors">
                        <Package size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{order.customerName || 'Pelanggan Tamu'}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium">
                          <span>{order.orderId || `#${order.id.substring(0, 8)}`}</span>
                          <span>•</span>
                          <span>{new Date(order.createdAt).toLocaleDateString('id-ID')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">Rp{(order.total || 0).toLocaleString('id-ID')}</p>
                      <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-bold rounded-md mt-1">
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          
          {/* Quick Actions Grid */}
          <div className="grid grid-cols-2 gap-3">
            <QuickActionCard icon={Package} title="Produk" description="Kelola stok & harga" href="/admin/products" color="bg-blue-50 text-blue-600" />
            <QuickActionCard icon={Truck} title="Supplier" description="Data pemasok" href="/admin/suppliers" color="bg-purple-50 text-purple-600" />
            <QuickActionCard icon={Gift} title="Promo" description="Diskon & Voucher" href="/admin/promotions" color="bg-pink-50 text-pink-600" />
            <QuickActionCard icon={BarChart3} title="Laporan" description="Analisis data" href="/admin/reports" color="bg-orange-50 text-orange-600" />
          </div>

          {/* Top Products Widget */}
          <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">Produk Terlaris</h3>
              <MoreHorizontal size={16} className="text-gray-400" />
            </div>
            <div className="space-y-4">
              {topProducts.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Belum ada data penjualan</p>
              ) : (
                topProducts.map((product, idx) => (
                  <div key={product.id} className="flex items-center gap-3">
                    <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{product.name}</p>
                      <p className="text-[10px] text-gray-400">{product.sales} terjual</p>
                    </div>
                    <p className="text-xs font-bold text-gray-900">Rp{product.price.toLocaleString('id-ID')}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* System Info Widget */}
          <div className="bg-gray-900 p-5 rounded-2xl text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5">
                <Database size={100} />
             </div>
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Infrastruktur</h3>
             <div className="space-y-4 relative z-10">
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                   <span className="text-xs text-gray-400">Gudang Aktif</span>
                   <span className="font-bold">{stats.warehouses}</span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                   <span className="text-xs text-gray-400">Total SKU</span>
                   <span className="font-bold">{stats.totalProducts}</span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                   <span className="text-xs text-gray-400">Promo Aktif</span>
                   <span className="font-bold text-green-400">{stats.activeVouchers}</span>
                </div>
                <div className="flex justify-between items-center pb-2">
                   <span className="text-xs text-gray-400">Total User</span>
                   <span className="font-bold">{stats.users}</span>
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
