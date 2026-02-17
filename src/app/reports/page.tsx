// src/app/(admin)/reports/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';
import { 
  TrendingUp, 
  Package, 
  Users, 
  CreditCard,
  Calendar,
  Download,
  FileText,
  Database,
  ShoppingCart
} from 'lucide-react';
import toast from 'react-hot-toast';

type ReportSummary = {
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  lowStockCount: number;
  totalCustomers: number;
  outstandingDebt: number;
  activeCustomers: number;
};

export default function ReportsDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReportSummary>({
    totalSales: 0,
    totalOrders: 0,
    totalProducts: 0,
    lowStockCount: 0,
    totalCustomers: 0,
    outstandingDebt: 0,
    activeCustomers: 0
  });
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Proteksi admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        toast.error('Akses ditolak! Anda bukan admin.');
        router.push('/profil');
        return;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch ringkasan laporan
  useEffect(() => {
    const fetchReportSummary = async () => {
      try {
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        endDate.setHours(23, 59, 59, 999);

        // Penjualan & Pesanan
        const ordersSnapshot = await getDocs(
          query(
            collection(db, 'orders'),
            where('createdAt', '>=', startDate.toISOString()),
            where('createdAt', '<=', endDate.toISOString())
          )
        );
        const totalSales = ordersSnapshot.docs.reduce((sum, doc) => sum + doc.data().total, 0);
        const totalOrders = ordersSnapshot.size;

        // Produk
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const totalProducts = productsSnapshot.size;
        const lowStockSnapshot = await getDocs(
          query(collection(db, 'products'), where('stock', '<=', 10))
        );
        const lowStockCount = lowStockSnapshot.size;

        // Pelanggan
        const customersSnapshot = await getDocs(collection(db, 'customers'));
        const totalCustomers = customersSnapshot.size;
        
        // Piutang
        const outstandingDebt = ordersSnapshot.docs
          .filter(doc => {
            const status = doc.data().status;
            return status !== 'SELESAI' && status !== 'DIBATALKAN';
          })
          .reduce((sum, doc) => sum + doc.data().total, 0);

        // Pelanggan aktif (yang punya transaksi di periode ini)
        const activeCustomerIds = new Set(
          ordersSnapshot.docs.map(doc => doc.data().customerId).filter(Boolean)
        );
        const activeCustomers = activeCustomerIds.size;

        setSummary({
          totalSales,
          totalOrders,
          totalProducts,
          lowStockCount,
          totalCustomers,
          outstandingDebt,
          activeCustomers
        });
      } catch (err) {
        console.error('Gagal memuat ringkasan laporan:', err);
      }
    };

    fetchReportSummary();
  }, [dateRange]);

  // Ekspor ringkasan
  const handleExportSummary = () => {
    const exportData = [{
      Periode: `${dateRange.startDate} sampai ${dateRange.endDate}`,
      'Total Penjualan': summary.totalSales,
      'Jumlah Pesanan': summary.totalOrders,
      'Total Produk': summary.totalProducts,
      'Produk Stok Rendah': summary.lowStockCount,
      'Total Pelanggan': summary.totalCustomers,
      'Pelanggan Aktif': summary.activeCustomers,
      'Total Piutang': summary.outstandingDebt
    }];

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ringkasan Laporan');
    XLSX.writeFile(wb, `ringkasan-laporan-${dateRange.startDate}-sampai-${dateRange.endDate}.xlsx`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat dashboard laporan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Dashboard Laporan</h1>
        <p className="text-black">Analisis kinerja toko ATAYATOKO2 secara menyeluruh</p>
      </div>

      {/* Filter Periode */}
      <div className="bg-white p-4 rounded-lg shadow mb-8 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-black mb-1">Periode Mulai</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Periode Akhir</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded text-black"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleExportSummary}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2"
            >
              <Download size={18} />
              Ekspor Ringkasan
            </button>
          </div>
        </div>
      </div>

      {/* Statistik Utama */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Penjualan</p>
              <p className="text-2xl font-bold mt-1 text-green-600">
                Rp{summary.totalSales.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <TrendingUp className="text-green-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Jumlah Pesanan</p>
              <p className="text-2xl font-bold mt-1">{summary.totalOrders}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <ShoppingCart className="text-blue-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Produk</p>
              <p className="text-2xl font-bold mt-1">{summary.totalProducts}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Package className="text-purple-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Stok Rendah</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{summary.lowStockCount}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Laporan Piutang & Pelanggan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-black">Piutang Pelanggan</h2>
            <CreditCard className="text-red-600" size={24} />
          </div>
          <div className="text-3xl font-bold text-red-600 mb-2">
            Rp{summary.outstandingDebt.toLocaleString('id-ID')}
          </div>
          <p className="text-sm text-black">
            Total piutang dari {summary.activeCustomers} pelanggan aktif
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-black">Basis Pelanggan</h2>
            <Users className="text-blue-600" size={24} />
          </div>
          <div className="text-3xl font-bold text-black mb-2">{summary.totalCustomers}</div>
          <p className="text-sm text-black">
            {summary.activeCustomers} pelanggan aktif dalam periode ini
          </p>
        </div>
      </div>

      {/* Menu Laporan Detail */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Laporan Penjualan */}
        <Link href="/admin/reports/sales" className="block">
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow h-full">
            <div className="flex items-center justify-between mb-3">
              <FileText className="text-green-600" size={24} />
              <TrendingUp className="text-green-600" size={20} />
            </div>
            <h3 className="font-semibold text-black mb-2">Laporan Penjualan</h3>
            <p className="text-sm text-black">
              Analisis penjualan harian, bulanan, dan per produk
            </p>
          </div>
        </Link>
        
        {/* Laporan Inventaris */}
        <Link href="/admin/reports/inventory" className="block">
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow h-full">
            <div className="flex items-center justify-between mb-3">
              <Database className="text-purple-600" size={24} />
              <Package className="text-purple-600" size={20} />
            </div>
            <h3 className="font-semibold text-black mb-2">Laporan Inventaris</h3>
            <p className="text-sm text-black">
              Stok produk, perputaran, dan nilai inventaris
            </p>
          </div>
        </Link>
        
        {/* Laporan Pelanggan */}
        <Link href="/admin/reports/customers" className="block">
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow h-full">
            <div className="flex items-center justify-between mb-3">
              <Users className="text-blue-600" size={24} />
              <CreditCard className="text-blue-600" size={20} />
            </div>
            <h3 className="font-semibold text-black mb-2">Laporan Pelanggan</h3>
            <p className="text-sm text-black">
              Analisis perilaku, piutang, dan klasifikasi pelanggan
            </p>
          </div>
        </Link>
        
        {/* Laporan Keuangan */}
        <Link href="/admin/reports/finance" className="block">
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow h-full">
            <div className="flex items-center justify-between mb-3">
              <CreditCard className="text-emerald-600" size={24} />
              <Calendar className="text-emerald-600" size={20} />
            </div>
            <h3 className="font-semibold text-black mb-2">Laporan Keuangan</h3>
            <p className="text-sm text-black">
              Arus kas, pendapatan, dan pengeluaran operasional
            </p>
          </div>
        </Link>
        
        {/* Laporan Promosi */}
        <Link href="/admin/reports/promotions" className="block">
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow h-full">
            <div className="flex items-center justify-between mb-3">
              <Gift className="text-pink-600" size={24} />
              <Percent className="text-pink-600" size={20} />
            </div>
            <h3 className="font-semibold text-black mb-2">Laporan Promosi</h3>
            <p className="text-sm text-black">
              Efektivitas diskon dan kupon pemasaran
            </p>
          </div>
        </Link>
        
        {/* Laporan Operasional */}
        <Link href="/admin/reports/operations" className="block">
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow h-full">
            <div className="flex items-center justify-between mb-3">
              <Settings className="text-gray-600" size={24} />
              <Activity className="text-gray-600" size={20} />
            </div>
            <h3 className="font-semibold text-black mb-2">Laporan Operasional</h3>
            <p className="text-sm text-black">
              Kinerja staf, efisiensi gudang, dan metrik operasional
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}

// Icon tambahan yang dibutuhkan
import { AlertTriangle, Gift, Percent, Settings, Activity } from 'lucide-react';

// Deklarasi global untuk XLSX
import * as XLSX from 'xlsx';
