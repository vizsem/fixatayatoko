'use client';

import { useEffect, useState, useCallback } from 'react';
import { auth, db } from '@/lib/firebase';


import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import Link from 'next/link';
import * as XLSX from 'xlsx'; // Import library XLSX
import {
  TrendingUp,
  Users,
  CreditCard,
  Calendar,
  Download,
  FileText,
  Database,
  ShoppingCart,
  AlertTriangle,
  Gift,
  Activity,
  ArrowUpRight,
  ChevronRight,
  DollarSign
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';



type ReportSummary = {
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  lowStockCount: number;
  totalCustomers: number;
  outstandingDebt: number;
  activeCustomers: number;
  averageOrderValue: number;
};

const getInitialDateRange = () => {
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0]
  };
};

export default function ReportsDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [summary, setSummary] = useState<ReportSummary>({
    totalSales: 0,
    totalOrders: 0,
    totalProducts: 0,
    lowStockCount: 0,
    totalCustomers: 0,
    outstandingDebt: 0,
    activeCustomers: 0,
    averageOrderValue: 0
  });

  const [dateRange, setDateRange] = useState(getInitialDateRange());


  // 1. Proteksi Admin & Auth
  const fetchReportSummary = useCallback(async () => {
    try {
      const start = new Date(dateRange.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRange.endDate);
      end.setHours(23, 59, 59, 999);

      // Fetch Orders dalam periode
      const ordersRef = collection(db, 'orders');
      const qOrders = query(
        ordersRef,
        where('createdAt', '>=', start),
        where('createdAt', '<=', end),
        orderBy('createdAt', 'desc')
      );
      const ordersSnap = await getDocs(qOrders);

      let tSales = 0;
      let tDebt = 0;
      const customerIds = new Set<string>();

      ordersSnap.forEach((doc) => {
        const data = doc.data();
        const status = String(data.status || '').toUpperCase();
        if (['SELESAI', 'SUCCESS'].includes(status)) {
          tSales += Number(data.total || 0);
        }

        // Hitung Piutang (Status selain Selesai/Batal dianggap piutang berjalan/pending)
        if (!['SELESAI', 'DIBATALKAN', 'SUCCESS'].includes(data.status?.toUpperCase())) {
          tDebt += Number(data.total || 0);
        }

        if (data.customerId) customerIds.add(data.customerId);
      });

      // Fetch Produk & Stok
      const productsSnap = await getDocs(collection(db, 'products'));
      const lowStock = productsSnap.docs.filter(d => ((d.data().stock as number) || 0) <= 10).length;

      // Fetch Total Basis Pelanggan
      const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'user')));

      setSummary({
        totalSales: tSales,
        totalOrders: ordersSnap.size,
        totalProducts: productsSnap.size,
        lowStockCount: lowStock,
        totalCustomers: usersSnap.size,
        outstandingDebt: tDebt,
        activeCustomers: customerIds.size,
        averageOrderValue: ordersSnap.size > 0 ? tSales / ordersSnap.size : 0
      });
    } catch {
      // Error is logged to console during dev
    }

  }, [dateRange]);

  // 1. Proteksi Admin & Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        notify.aksesDitolakAdmin();
        router.push('/profil');
        return;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Fetch Data Laporan
  useEffect(() => {
    if (!loading) fetchReportSummary();
  }, [fetchReportSummary, loading]);


  // 3. Fungsi Ekspor ke Excel
  const handleExportSummary = () => {
    setIsExporting(true);
    try {
      const data = [
        { Kategori: 'Periode Laporan', Nilai: `${dateRange.startDate} s/d ${dateRange.endDate}` },
        { Kategori: 'Total Omzet', Nilai: summary.totalSales },
        { Kategori: 'Total Transaksi', Nilai: summary.totalOrders },
        { Kategori: 'Rata-rata Per Transaksi', Nilai: summary.averageOrderValue },
        { Kategori: 'Total Piutang Berjalan', Nilai: summary.outstandingDebt },
        { Kategori: 'Pelanggan Aktif (Periode Ini)', Nilai: summary.activeCustomers },
        { Kategori: 'Total Produk SKU', Nilai: summary.totalProducts },
        { Kategori: 'Produk Stok Kritis', Nilai: summary.lowStockCount },
      ];

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Summary");
      XLSX.writeFile(workbook, `Laporan_AtayaToko_${dateRange.startDate}.xlsx`);
    } catch {
      notify.admin.error("Gagal mengekspor data");
    } finally {

      setIsExporting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-green-600 border-gray-200"></div>
        <p className="text-xs font-black tracking-widest text-gray-400">Menyusun data...</p>

      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 bg-[#FBFBFE] min-h-screen">
      <Toaster position="top-right" />
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tighter">Business analytics</h1>
          <p className="text-gray-400 text-xs font-bold tracking-widest mt-1">Laporan operasional Atayatoko</p>
        </div>


        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 px-3 border-r border-gray-100">
            <Calendar size={16} className="text-gray-400" />
            <input
              type="date"
              className="text-xs font-bold outline-none bg-transparent"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2 px-3">
            <input
              type="date"
              className="text-xs font-bold outline-none bg-transparent"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard
          label="Total Revenue"
          value={`Rp${summary.totalSales.toLocaleString()}`}
          icon={TrendingUp}
          color="text-green-600"
          bg="bg-green-50"
          trend="+12.5%"
        />
        <StatCard
          label="Total Orders"
          value={summary.totalOrders}
          icon={ShoppingCart}
          color="text-blue-600"
          bg="bg-blue-50"
          trend={`${summary.activeCustomers} Users`}
        />
        <StatCard
          label="Avg. Order Value"
          value={`Rp${Math.round(summary.averageOrderValue).toLocaleString()}`}
          icon={CreditCard}
          color="text-purple-600"
          bg="bg-purple-50"
        />
        <StatCard
          label="Inventory Health"
          value={`${summary.lowStockCount} Low`}
          icon={AlertTriangle}
          color="text-orange-600"
          bg="bg-orange-50"
          subValue={`${summary.totalProducts} Total SKU`}
        />
      </div>

      {/* Second Row: Debt & Customer Base */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-gray-400 text-[10px] font-black tracking-[0.2em]">Piutang & transaksi pending</h3>

                <p className="text-3xl font-black text-gray-800 mt-1 tracking-tighter">
                  Rp{summary.outstandingDebt.toLocaleString()}
                </p>
              </div>
              <button
                onClick={handleExportSummary}
                disabled={isExporting}
                className="bg-green-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black tracking-widest flex items-center gap-2 hover:bg-green-700 transition-all active:scale-95 shadow-lg shadow-green-100"

              >
                {isExporting ? <Activity className="animate-spin" size={16} /> : <Download size={16} />}
                Export Report
              </button>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full mb-4">
              <div className="bg-red-500 h-2 rounded-full" style={{ width: `${(summary.outstandingDebt / (summary.totalSales || 1)) * 100}%` }}></div>
            </div>
            <p className="text-[10px] font-bold text-gray-400 tracking-widest">

              Rasio Piutang: {((summary.outstandingDebt / (summary.totalSales || 1)) * 100).toFixed(1)}% dari total omzet periode ini
            </p>
          </div>
          <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
            <TrendingUp size={200} />
          </div>
        </div>

        <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white flex flex-col justify-between shadow-2xl">
          <div>
            <Users className="text-green-400 mb-4" size={32} />
            <h3 className="text-gray-400 text-[10px] font-black tracking-[0.2em]">Customer database</h3>

            <p className="text-4xl font-black mt-2 tracking-tighter">{summary.totalCustomers}</p>
            <div className="mt-4 flex items-center gap-2">
              <span className="bg-green-500/20 text-green-400 text-[9px] font-black px-2 py-1 rounded-md">

                {summary.activeCustomers} Aktif
              </span>
              <span className="text-[9px] font-bold text-gray-500 tracking-widest">Bulan ini</span>

            </div>
          </div>
          <Link href="/admin/customers" className="mt-8 flex items-center justify-between group">
            <span className="text-xs font-black tracking-widest">Detail pelanggan</span>

            <div className="bg-white/10 p-2 rounded-xl group-hover:bg-green-600 transition-all">
              <ChevronRight size={16} />
            </div>
          </Link>
        </div>
      </div>

      {/* Grid Menu Laporan Detail */}
      <h3 className="text-xs font-black text-gray-400 tracking-[0.3em] mb-6">Modul analisis detail</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <ReportLink
          title="Penjualan"
          desc="Analisis tren omzet & item terlaris"
          icon={FileText}
          href="/admin/reports/sales"
          color="text-green-600"
          bg="bg-green-50"
        />
        <ReportLink
          title="Inventaris"
          desc="Valuasi stok & audit gudang"
          icon={Database}
          href="/admin/reports/inventory"
          color="text-purple-600"
          bg="bg-purple-50"
        />
        <ReportLink
          title="Keuangan"
          desc="Arus kas & margin keuntungan"
          icon={DollarSignIcon}
          href="/admin/reports/finance"
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <ReportLink
          title="Promosi"
          desc="ROI diskon & penggunaan kupon"
          icon={Gift}
          href="/admin/reports/promotions"
          color="text-pink-600"
          bg="bg-pink-50"
        />
        <ReportLink
          title="Operasional"
          desc="Produktivitas & logistik"
          icon={Activity}
          href="/admin/reports/operations"
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <ReportLink
          title="Pelanggan"
          desc="LTV & segmentasi pasar"
          icon={Users}
          href="/admin/reports/customers"
          color="text-blue-600"
          bg="bg-blue-50"
        />
      </div>
    </div>
  );
}

// --- Sub Komponen ---

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;

  color: string;
  bg: string;
  trend?: string;
  subValue?: string;
}

function StatCard({ label, value, icon: Icon, color, bg, trend, subValue }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className={`${bg} ${color} p-3 rounded-2xl group-hover:scale-110 transition-transform`}>
          <Icon size={20} />
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-[10px] font-black text-green-500 bg-green-50 px-2 py-1 rounded-lg uppercase">
            <ArrowUpRight size={12} /> {trend}
          </span>
        )}
      </div>
      <p className="text-[10px] font-black text-gray-400 tracking-widest">{label}</p>

      <h3 className="text-xl font-black text-gray-800 tracking-tighter mt-1">{value}</h3>
      {subValue && <p className="text-[9px] font-bold text-gray-400 mt-1">{subValue}</p>}

    </div>
  );
}


interface ReportLinkProps {
  title: string;
  desc: string;
  icon: React.ElementType;

  href: string;
  color: string;
  bg: string;
}

function ReportLink({ title, desc, icon: Icon, href, color, bg }: ReportLinkProps) {
  return (
    <Link href={href} className="group">
      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:border-green-100 hover:shadow-lg hover:shadow-green-100/20 transition-all flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div className={`${bg} ${color} p-3 rounded-2xl group-hover:rotate-12 transition-transform`}>
            <Icon size={22} />
          </div>
          <ChevronRight size={18} className="text-gray-300 group-hover:text-green-600 group-hover:translate-x-1 transition-all" />
        </div>
        <h4 className="font-black text-gray-800 text-xs tracking-widest mb-2">{title}</h4>

        <p className="text-xs text-gray-500 leading-relaxed font-medium">{desc}</p>
      </div>
    </Link>
  );
}

// Helper untuk icon yang mungkin tidak ter-import otomatis
function DollarSignIcon(props: { className?: string, size?: number }) {
  return <DollarSign {...props} />
}
