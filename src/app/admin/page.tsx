// src/app/admin/page.tsx
'use client';

import { useEffect, useState, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Package, 
  ShoppingCart, 
  Users, 
  Settings, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  DollarSign,
  MessageSquare,
  Database,
  FileText,
  Gift,          
  Warehouse,     
  ShieldCheck    
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Komponen Quick Action
const QuickActionCard = ({ 
  icon: Icon, 
  title, 
  description, 
  href,
  color = "bg-blue-100 text-blue-600"
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  description: string;
  href: string;
  color?: string;
}) => (
  <Link href={href} className="block">
    <div className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
      <div className={`${color} p-2 rounded-lg w-10 h-10 flex items-center justify-center mb-3`}>
        <Icon size={20} />
      </div>
      <h3 className="font-semibold text-black mb-1">{title}</h3>
      <p className="text-sm text-black">{description}</p>
    </div>
  </Link>
);

const formatTimeAgo = (timestamp: string) => {
  const now = new Date();
  const orderTime = new Date(timestamp);
  const diffMs = now.getTime() - orderTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  return `${Math.floor(diffMs / 86400000)} hari lalu`;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    dailySales: 0,
    totalProducts: 0,
    lowStock: 0,
    unreadOrders: 0,
    warehouses: 0,
    promotions: 0,
    users: 0
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  // ✅ Force light mode
  useLayoutEffect(() => {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
    }
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
        alert('Akses ditolak! Anda bukan admin.');
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
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const totalProducts = productsSnapshot.size;
      const lowStockSnapshot = await getDocs(query(
        collection(db, 'products'), 
        where('stock', '<=', 10)
      ));
      const lowStock = lowStockSnapshot.size;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const ordersSnapshot = await getDocs(query(
        collection(db, 'orders'),
        where('createdAt', '>=', todayStart.toISOString())
      ));
      const dailySales = ordersSnapshot.docs.reduce((sum, doc) => sum + doc.data().total, 0);

      const unreadSnapshot = await getDocs(query(
        collection(db, 'orders'),
        where('status', '==', 'MENUNGGU'),
        orderBy('createdAt', 'desc'),
        limit(5)
      ));
      const unreadOrders = unreadSnapshot.size;

      const warehousesSnapshot = await getDocs(collection(db, 'warehouses'));
      const promotionsSnapshot = await getDocs(collection(db, 'promotions'));
      const usersSnapshot = await getDocs(collection(db, 'users'));

      const recentOrders = unreadSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timeAgo: formatTimeAgo(doc.data().createdAt)
      }));

      setStats({
        dailySales,
        totalProducts,
        lowStock,
        unreadOrders,
        warehouses: warehousesSnapshot.size,
        promotions: promotionsSnapshot.size,
        users: usersSnapshot.size
      });
      setRecentOrders(recentOrders);
    } catch (error) {
      console.error('Error fetching dashboard ', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memverifikasi akses admin...</p>
        </div>
      </div>
    );
  }

  // ✅ RETURN DENGAN SIDEBAR
  return (
    <div className="flex">
      {/* Sidebar Navigasi */}
      <aside className="w-64 bg-white h-screen fixed left-0 top-0 shadow-lg border-r border-gray-200">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">AT</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-green-600">ATAYATOKO2</h2>
              <p className="text-xs text-gray-500">Admin Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="mt-6 px-4">
          <ul className="space-y-1">
            <li>
              <Link 
                href="/admin/products" 
                className="flex items-center gap-3 px-3 py-2 text-black hover:bg-blue-50 rounded"
              >
                <Package size={16} />
                Produk
              </Link>
            </li>
            <li>
              <Link 
                href="/admin/orders" 
                className="flex items-center gap-3 px-3 py-2 text-black hover:bg-purple-50 rounded"
              >
                <ShoppingCart size={16} />
                Pesanan
              </Link>
            </li>
            <li>
              <Link 
                href="/admin/customers" 
                className="flex items-center gap-3 px-3 py-2 text-black hover:bg-orange-50 rounded"
              >
                <Users size={16} />
                Pelanggan
              </Link>
            </li>
            <li>
              <Link 
                href="/admin/inventory" 
                className="flex items-center gap-3 px-3 py-2 text-black hover:bg-emerald-50 rounded"
              >
                <Database size={16} />
                Inventaris
              </Link>
            </li>
            <li>
              <Link 
                href="/admin/promotions" 
                className="flex items-center gap-3 px-3 py-2 text-black hover:bg-pink-50 rounded"
              >
                <Gift size={16} />
                Program Promosi
              </Link>
            </li>
            <li>
              <Link 
                href="/admin/warehouses" 
                className="flex items-center gap-3 px-3 py-2 text-black hover:bg-indigo-50 rounded"
              >
                <Warehouse size={16} />
                Multi-Gudang
              </Link>
            </li>
            <li>
              <Link 
                href="/admin/users" 
                className="flex items-center gap-3 px-3 py-2 text-black hover:bg-amber-50 rounded"
              >
                <ShieldCheck size={16} />
                Manajemen Pengguna
              </Link>
            </li>
            <li>
              <Link 
                href="/admin/settings" 
                className="flex items-center gap-3 px-3 py-2 text-black hover:bg-gray-50 rounded"
              >
                <Settings size={16} />
                Pengaturan
              </Link>
            </li>
            <li>
              <Link 
                href="/admin/reports" 
                className="flex items-center gap-3 px-3 py-2 text-black hover:bg-blue-50 rounded"
              >
                <FileText size={16} />
                Laporan
              </Link>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Konten Dashboard */}
      <main className="ml-64 flex-1 bg-gray-50 p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-black">Dashboard Admin</h1>
          <p className="text-black">Kelola toko, produk, dan pesanan Anda</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <QuickActionCard
            icon={Package}
            title="Produk"
            description="Kelola stok & harga"
            href="/admin/products"
            color="bg-blue-100 text-blue-600"
          />
          <QuickActionCard
            icon={ShoppingCart}
            title="Pesanan"
            description="Kelola pesanan baru"
            href="/admin/orders"
            color="bg-purple-100 text-purple-600"
          />
          <QuickActionCard
            icon={Users}
            title="Pelanggan"
            description="Data & piutang"
            href="/admin/customers"
            color="bg-orange-100 text-orange-600"
          />
          <QuickActionCard
            icon={Database}
            title="Inventaris"
            description="Stok & mutasi"
            href="/admin/inventory"
            color="bg-emerald-100 text-emerald-600"
          />
          <QuickActionCard
            icon={Gift}
            title="Program Promosi"
            description="Buat diskon & kupon"
            href="/admin/promotions"
            color="bg-pink-100 text-pink-600"
          />
          <QuickActionCard
            icon={Warehouse}
            title="Multi-Gudang"
            description="Kelola stok per gudang"
            href="/admin/warehouses"
            color="bg-indigo-100 text-indigo-600"
          />
          <QuickActionCard
            icon={ShieldCheck}
            title="Manajemen Pengguna"
            description="Atur role & akses"
            href="/admin/users"
            color="bg-amber-100 text-amber-600"
          />
          <QuickActionCard
            icon={Settings}
            title="Pengaturan"
            description="Konfigurasi toko"
            href="/admin/settings"
            color="bg-gray-100 text-gray-600"
          />
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-black">Penjualan Hari Ini</p>
                <p className="text-2xl font-bold mt-1">Rp{stats.dailySales.toLocaleString('id-ID')}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <DollarSign className="text-green-600" size={24} />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-black">Total Produk</p>
                <p className="text-2xl font-bold mt-1">{stats.totalProducts}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Package className="text-blue-600" size={24} />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-black">Stok Rendah</p>
                <p className="text-2xl font-bold mt-1">{stats.lowStock}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <AlertTriangle className="text-yellow-600" size={24} />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-black">Pesanan Baru</p>
                <p className="text-2xl font-bold mt-1">{stats.unreadOrders}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-full">
                <Clock className="text-red-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* Notifikasi Pesanan Baru */}
        {stats.unreadOrders > 0 && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="text-red-600 mr-2" size={20} />
              <span className="font-medium text-red-800">
                {stats.unreadOrders} pesanan baru menunggu diproses!
              </span>
            </div>
          </div>
        )}

        {/* Pesanan Terbaru */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-lg font-semibold mb-4 text-black">Pesanan Terbaru</h2>
            {recentOrders.length === 0 ? (
              <p className="text-black text-sm">Tidak ada pesanan baru</p> 
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-start justify-between pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          order.status === 'MENUNGGU' 
                            ? 'bg-red-100 text-red-800' 
                            : order.status === 'DIPROSES'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {order.status}
                        </span>
                        <span className="ml-2 text-sm font-medium text-black">#{order.id.substring(0, 8)}</span>
                      </div>
                      <p className="text-sm text-black mt-1">
                        {order.customerName || 'Pelanggan'} • Rp{order.total.toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs text-black mt-1">
                        {order.timeAgo} • {order.deliveryMethod}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Link 
                        href={`/admin/orders/${order.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Lihat
                      </Link>
                      {order.customerPhone && (
                        <a 
                          href={`https://wa.me/${order.customerPhone.replace('+', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-800"
                          title="Chat via WhatsApp"
                        >
                          <MessageSquare size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Panel Kanan */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h2 className="text-lg font-semibold mb-4 text-black">Inventaris</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-black">Total Produk</span>
                  <span className="font-medium">{stats.totalProducts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black">Stok Rendah</span>
                  <span className="font-medium text-red-600">{stats.lowStock}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black">Nilai Stok</span>
                  <span className="font-medium">Rp0</span>
                </div>
              </div>
              <Link 
                href="/admin/inventory" 
                className="mt-4 inline-block text-blue-600 hover:text-blue-800 text-sm"
              >
                Lihat detail inventaris →
              </Link>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h2 className="text-lg font-semibold mb-4 text-black">Operasional</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-black">Gudang</span>
                  <span className="font-medium">{stats.warehouses}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black">Promosi Aktif</span>
                  <span className="font-medium">{stats.promotions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black">Pengguna</span>
                  <span className="font-medium">{stats.users}</span>
                </div>
              </div>
              <Link 
                href="/admin/users" 
                className="mt-4 inline-block text-amber-600 hover:text-amber-800 text-sm"
              >
                Kelola pengguna →
              </Link>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h2 className="text-lg font-semibold mb-4 text-black">Laporan</h2>
              <div className="space-y-3">
                <Link href="/admin/reports/sales" className="block p-2 hover:bg-gray-50 rounded">
                  <FileText size={16} className="inline mr-2" />
                  <span className="text-black">Laporan Penjualan</span>
                </Link>
                <Link href="/admin/reports/inventory" className="block p-2 hover:bg-gray-50 rounded">
                  <Database size={16} className="inline mr-2" />
                  <span className="text-black">Laporan Inventaris</span>
                </Link>
                <Link href="/admin/reports/customers" className="block p-2 hover:bg-gray-50 rounded">
                  <Users size={16} className="inline mr-2" />
                  <span className="text-black">Laporan Pelanggan</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}