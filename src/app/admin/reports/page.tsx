'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
  orderBy,
  Timestamp
} from 'firebase/firestore';
import Link from 'next/link';
import * as XLSX from 'xlsx';
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
  DollarSign,
  BarChart3,
  PieChart,
  Package,
  Truck
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';

type DailySales = {
  date: string;
  total: number;
  label: string;
};

type ReportSummary = {
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  lowStockCount: number;
  totalCustomers: number;
  outstandingDebt: number;
  activeCustomers: number;
  averageOrderValue: number;
  dailySales: DailySales[];
};

const getInitialDateRange = () => {
  const now = new Date();
  const toLocal = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  // Default to first day of current month
  return {
    startDate: toLocal(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: toLocal(now)
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
    averageOrderValue: 0,
    dailySales: []
  });

  const [dateRange, setDateRange] = useState(getInitialDateRange());

  // 1. Admin Protection & Auth
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
      // Don't set loading false here, wait for data fetch
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Fetch Report Data
  const fetchReportSummary = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(dateRange.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRange.endDate);
      end.setHours(23, 59, 59, 999);

      // Fetch Orders in period
      const ordersRef = collection(db, 'orders');
      const qOrders = query(
        ordersRef,
        where('createdAt', '>=', start),
        where('createdAt', '<=', end),
        orderBy('createdAt', 'asc') // Ascending for chart
      );
      const ordersSnap = await getDocs(qOrders);

      let tSales = 0;
      let tDebt = 0;
      const customerIds = new Set<string>();
      const salesMap: Record<string, number> = {};

      // Initialize sales map for the entire range (to fill gaps)
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateKey = currentDate.toISOString().split('T')[0];
        salesMap[dateKey] = 0;
        currentDate.setDate(currentDate.getDate() + 1);
      }

      ordersSnap.forEach((doc) => {
        const data = doc.data();
        const status = String(data.status || '').toUpperCase();
        
        // Count Sales
        if (['SELESAI', 'SUCCESS'].includes(status)) {
          const total = Number(data.total || 0);
          tSales += total;
          
          // Daily Sales for Chart
          if (data.createdAt) {
            const dateKey = data.createdAt.toDate().toISOString().split('T')[0];
            if (salesMap[dateKey] !== undefined) {
              salesMap[dateKey] += total;
            }
          }
        }

        // Count Debt (Pending/Not Finished/Not Cancelled)
        if (!['SELESAI', 'DIBATALKAN', 'SUCCESS'].includes(status)) {
          tDebt += Number(data.total || 0);
        }

        if (data.customerId) customerIds.add(data.customerId);
      });

      // Convert salesMap to array
      const dailySales = Object.entries(salesMap).map(([date, total]) => ({
        date,
        total,
        label: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
      })).sort((a, b) => a.date.localeCompare(b.date));

      // Fetch Products & Stock
      const productsSnap = await getDocs(collection(db, 'products'));
      const lowStock = productsSnap.docs.filter(d => ((d.data().stock as number) || 0) <= 10).length;

      // Fetch Total Customer Base
      const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'user')));

      setSummary({
        totalSales: tSales,
        totalOrders: ordersSnap.size,
        totalProducts: productsSnap.size,
        lowStockCount: lowStock,
        totalCustomers: usersSnap.size,
        outstandingDebt: tDebt,
        activeCustomers: customerIds.size,
        averageOrderValue: ordersSnap.size > 0 ? tSales / ordersSnap.size : 0,
        dailySales
      });
    } catch (error) {
      console.error("Error fetching reports:", error);
      notify.admin.error("Gagal memuat data laporan");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchReportSummary();
  }, [fetchReportSummary]);

  // 3. Export to Excel
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
        { Kategori: '', Nilai: '' },
        { Kategori: 'Detail Harian', Nilai: '' },
        ...summary.dailySales.map(d => ({
          Kategori: d.date,
          Nilai: d.total
        }))
      ];

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Summary");
      XLSX.writeFile(workbook, `Laporan_AtayaToko_${dateRange.startDate}.xlsx`);
      notify.success("Laporan berhasil diekspor!");
    } catch {
      notify.admin.error("Gagal mengekspor data");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-8 bg-gray-50/50 min-h-screen">
      <Toaster position="top-right" />
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-0.5">
            Business Analytics
          </h1>
          <p className="text-[10px] md:text-sm text-gray-400 font-medium uppercase tracking-widest">
            Overview performa & kesehatan bisnis
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100 group focus-within:ring-2 ring-blue-100 transition-all">
            <Calendar size={14} className="text-gray-400 group-focus-within:text-blue-600" />
            <input
              type="date"
              className="text-[10px] font-bold outline-none bg-transparent text-gray-700 w-24 cursor-pointer"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            />
          </div>
          <span className="text-gray-200 font-bold">/</span>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100 group focus-within:ring-2 ring-blue-100 transition-all">
            <input
              type="date"
              className="text-[10px] font-bold outline-none bg-transparent text-gray-700 w-24 cursor-pointer"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6">
            <StatCard
              label="Total Revenue"
              value={`Rp${summary.totalSales.toLocaleString('id-ID')}`}
              icon={TrendingUp}
              color="text-emerald-600"
              bg="bg-emerald-50"
              borderColor="border-emerald-100"
              trend="Sales"
            />
            <StatCard
              label="Total Orders"
              value={summary.totalOrders}
              icon={ShoppingCart}
              color="text-blue-600"
              bg="bg-blue-50"
              borderColor="border-blue-100"
              trend="Orders"
            />
            <StatCard
              label="Avg. Value"
              value={`Rp${Math.round(summary.averageOrderValue).toLocaleString('id-ID')}`}
              icon={CreditCard}
              color="text-violet-600"
              bg="bg-violet-50"
              borderColor="border-violet-100"
            />
            <StatCard
              label="Stok Kritis"
              value={`${summary.lowStockCount} SKU`}
              icon={AlertTriangle}
              color="text-amber-600"
              bg="bg-amber-50"
              borderColor="border-amber-100"
              subValue={`${summary.totalProducts} SKU`}
            />
          </div>

          {/* Charts & Secondary Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 mb-8">
            
            {/* Sales Chart Card */}
            <div className="lg:col-span-2 bg-white rounded-[2rem] p-5 md:p-8 shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-gray-900 font-extrabold text-lg">Tren Penjualan</h3>
                  <p className="text-gray-400 text-[10px] font-medium mt-0.5">Pendapatan harian periode ini</p>
                </div>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <BarChart3 size={18} />
                </div>
              </div>
              
              <div className="h-56 w-full">
                <SimpleAreaChart data={summary.dailySales} />
              </div>
            </div>

            {/* Financial & Debt Card */}
            <div className="bg-white rounded-[2rem] p-5 md:p-8 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between group">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-rose-50 rounded-xl">
                    <Activity size={16} className="text-rose-500" />
                  </div>
                  <h3 className="text-gray-400 text-[9px] font-bold uppercase tracking-wider">Piutang Berjalan</h3>
                </div>
                <p className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
                  Rp{summary.outstandingDebt.toLocaleString('id-ID')}
                </p>
                
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="flex justify-between text-[9px] font-bold text-gray-400 mb-1">
                      <span>Rasio Piutang</span>
                      <span>{((summary.outstandingDebt / (summary.totalSales || 1)) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-50 h-1.5 rounded-full overflow-hidden border border-gray-100">
                      <div 
                        className="bg-gradient-to-r from-rose-500 to-rose-400 h-full rounded-full" 
                        style={{ width: `${Math.min((summary.outstandingDebt / (summary.totalSales || 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleExportSummary}
                disabled={isExporting}
                className="mt-6 w-full bg-gray-900 text-white px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gray-800 transition-all active:scale-95 shadow-xl shadow-gray-200"
              >
                {isExporting ? <Activity className="animate-spin" size={16} /> : <Download size={16} />}
                Export Excel
              </button>
            </div>
          </div>

          {/* Module Links Grid */}
          <div className="mb-4 flex items-center gap-2">
            <div className="h-6 w-1.5 bg-blue-600 rounded-full"></div>
            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Laporan Detail</h3>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
            <ReportLink
              title="Penjualan"
              desc="Omzet & tren waktu."
              icon={FileText}
              href="/admin/reports/sales"
              color="text-emerald-600"
              bg="bg-emerald-50"
              hoverBorder="group-hover:border-emerald-200"
            />
            <ReportLink
              title="Inventaris"
              desc="Mutasi & valuasi."
              icon={Database}
              href="/admin/reports/inventory"
              color="text-violet-600"
              bg="bg-violet-50"
              hoverBorder="group-hover:border-violet-200"
            />
            <ReportLink
              title="Keuangan"
              desc="Kas & laba rugi."
              icon={DollarSign}
              href="/admin/reports/finance"
              color="text-cyan-600"
              bg="bg-cyan-50"
              hoverBorder="group-hover:border-cyan-200"
            />
            <ReportLink
              title="Operasional"
              desc="Kinerja & logistik."
              icon={Package}
              href="/admin/reports/operations"
              color="text-amber-600"
              bg="bg-amber-50"
              hoverBorder="group-hover:border-amber-200"
            />
             <ReportLink
              title="Pelanggan"
              desc="Analisis loyalitas."
              icon={Users}
              href="/admin/reports/customers"
              color="text-blue-600"
              bg="bg-blue-50"
              hoverBorder="group-hover:border-blue-200"
            />
            <ReportLink
              title="Promo"
              desc="Efektivitas kupon."
              icon={Gift}
              href="/admin/reports/promotions"
              color="text-rose-600"
              bg="bg-rose-50"
              hoverBorder="group-hover:border-rose-200"
            />
          </div>
        </>
      )}
    </div>
  );
}

// --- Components ---

function SimpleAreaChart({ data }: { data: DailySales[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm font-medium">
        Tidak ada data penjualan
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d.total), 1);
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * 100;
    const y = 100 - (d.total / maxVal) * 100;
    return `${x},${y}`;
  });

  const pathD = `M0,100 L0,${100 - (data[0].total / maxVal) * 100} ${points.map((p, i) => `L${p.split(',')[0]},${p.split(',')[1]}`).join(' ')} L100,100 Z`;
  const lineD = `M0,${100 - (data[0].total / maxVal) * 100} ${points.map((p, i) => `L${p.split(',')[0]},${p.split(',')[1]}`).join(' ')}`;

  return (
    <div className="relative h-full w-full pb-6">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
        {/* Grid Lines */}
        <line x1="0" y1="25" x2="100" y2="25" stroke="#f3f4f6" strokeWidth="0.5" strokeDasharray="2" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#f3f4f6" strokeWidth="0.5" strokeDasharray="2" />
        <line x1="0" y1="75" x2="100" y2="75" stroke="#f3f4f6" strokeWidth="0.5" strokeDasharray="2" />

        {/* Area */}
        <path d={pathD} fill="url(#gradient)" opacity="0.2" />
        <defs>
          <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Line */}
        <path d={lineD} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        
        {/* Points (Only show if few data points) */}
        {data.length < 20 && data.map((d, i) => {
           const x = (i / (data.length - 1 || 1)) * 100;
           const y = 100 - (d.total / maxVal) * 100;
           return (
             <circle key={i} cx={x} cy={y} r="1.5" fill="#fff" stroke="#10b981" strokeWidth="0.5" className="hover:r-2 transition-all" />
           )
        })}
      </svg>
      
      {/* X Axis Labels */}
      <div className="absolute bottom-0 w-full flex justify-between text-[10px] text-gray-400 font-medium px-1">
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg, borderColor, trend, subValue }: any) {
  return (
    <div className={`bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 group relative overflow-hidden`}>
      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className={`${bg} ${color} p-2.5 md:p-3.5 rounded-xl border ${borderColor} group-hover:scale-110 transition-transform duration-300`}>
          <Icon size={18} className="md:size-[22px]" />
        </div>
        {trend && (
          <span className="hidden md:flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
            <ArrowUpRight size={12} /> {trend}
          </span>
        )}
      </div>
      
      <div className="relative z-10">
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
        <h3 className="text-sm md:text-2xl font-black text-gray-900 tracking-tight">{value}</h3>
        {subValue && (
          <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-gray-50 text-[9px] font-bold text-gray-400">
            <AlertTriangle size={10} /> {subValue}
          </div>
        )}
      </div>

      <div className={`absolute inset-0 bg-gradient-to-br ${bg} opacity-0 group-hover:opacity-20 transition-opacity duration-500`}></div>
    </div>
  );
}

function ReportLink({ title, desc, icon: Icon, href, color, bg, hoverBorder }: any) {
  return (
    <Link href={href} className="group h-full">
      <div className={`bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-gray-100 shadow-sm ${hoverBorder} hover:shadow-xl transition-all duration-300 h-full flex flex-col`}>
        <div className="flex items-center justify-between mb-4">
          <div className={`${bg} ${color} p-2.5 md:p-4 rounded-xl group-hover:rotate-6 transition-transform duration-300`}>
            <Icon size={20} className="md:size-6" />
          </div>
          <div className="bg-gray-50 p-1.5 rounded-full group-hover:bg-gray-100 transition-colors">
            <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-600" />
          </div>
        </div>
        
        <div className="mt-auto">
          <h4 className="font-black text-gray-900 text-[11px] md:text-sm uppercase tracking-tight mb-1">{title}</h4>
          <p className="text-[9px] md:text-xs text-gray-400 font-medium leading-tight">{desc}</p>
        </div>
      </div>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white h-40 rounded-[2rem] border border-gray-100"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2 bg-white h-80 rounded-[2.5rem] border border-gray-100"></div>
        <div className="bg-white h-80 rounded-[2.5rem] border border-gray-100"></div>
      </div>
    </div>
  );
}
