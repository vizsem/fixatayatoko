'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { getReportSummary } from '@/lib/actions/report.actions';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  TrendingUp,
  Users,
  CreditCard,
  Calendar,
  Download,
  Database,
  ShoppingCart,
  AlertTriangle,
  Gift,
  Activity,
  ChevronRight,
  DollarSign,
  BarChart3,
  Package,
  Receipt,
  Store,
  Filter,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Clock,
  Calculator
} from 'lucide-react';
import notify from '@/lib/notify';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

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

type PresetKey = 'today' | '7days' | '30days' | 'this_month' | 'last_month' | 'custom';
type CategoryKey = 'all' | 'sales' | 'finance' | 'inventory';

interface ReportItem {
  id: string;
  title: string;
  desc: string;
  icon: any;
  href: string;
  category: 'sales' | 'finance' | 'inventory';
  badge?: string;
}

const REPORT_ITEMS: ReportItem[] = [
  // Penjualan & Kasir
  {
    id: 'sales',
    title: 'Laporan Penjualan',
    desc: 'Omzet total, tren per channel, dan produk terlaris',
    icon: TrendingUp,
    href: '/admin/reports/sales',
    category: 'sales',
    badge: 'Penjualan'
  },
  {
    id: 'cashier',
    title: 'Kinerja Kasir POS',
    desc: 'Rekapitulasi shift, selisih uang fisik, dan kas masuk',
    icon: Store,
    href: '/admin/reports/cashier',
    category: 'sales',
    badge: 'Kasir'
  },
  {
    id: 'promotions',
    title: 'Promo & Diskon',
    desc: 'Efektivitas pemakaian kupon dan evaluasi margin diskon',
    icon: Gift,
    href: '/admin/reports/promotions',
    category: 'sales'
  },
  // Keuangan & Pajak
  {
    id: 'finance',
    title: 'Laba Rugi & Arus Kas',
    desc: 'Arus kas masuk-keluar, margin laba, dan modal operasional',
    icon: DollarSign,
    href: '/admin/reports/finance',
    category: 'finance',
    badge: 'Keuangan'
  },
  {
    id: 'hutang',
    title: 'Hutang & Piutang',
    desc: 'Monitoring tagihan jatuh tempo dan piutang pelanggan',
    icon: CreditCard,
    href: '/admin/reports/hutang',
    category: 'finance',
    badge: 'Prioritas'
  },
  {
    id: 'tax',
    title: 'Pajak Toko (STP Cortex)',
    desc: 'Rekapitulasi PPN masukan/keluaran & estimasi PPh Final',
    icon: Receipt,
    href: '/admin/reports/tax',
    category: 'finance'
  },
  {
    id: 'tax-calc',
    title: 'Kalkulator Pajak B2B & HPP',
    desc: 'Simulasi modal bersih, PPN pabrik, PPh 22, landed cost & harga aman',
    icon: Calculator,
    href: '/admin/tax-calculator',
    category: 'finance',
    badge: 'Anti-Boncos'
  },
  // Stok & Operasional
  {
    id: 'inventory',
    title: 'Inventaris & Gudang',
    desc: 'Mutasi stok barang, dead-stock, dan valuasi aset',
    icon: Database,
    href: '/admin/reports/inventory',
    category: 'inventory',
    badge: 'Stok'
  },
  {
    id: 'operations',
    title: 'Logistik & Operasional',
    desc: 'Performa fulfillment pesanan, kurir, dan retur barang',
    icon: Package,
    href: '/admin/reports/operations',
    category: 'inventory'
  },
  {
    id: 'customers',
    title: 'Pelanggan & Member',
    desc: 'Analisis loyalitas pembeli, repeat order, dan poin belanja',
    icon: Users,
    href: '/admin/reports/customers',
    category: 'inventory'
  }
];

const toLocalISO = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPresetDates = (preset: PresetKey) => {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { startDate: toLocalISO(now), endDate: toLocalISO(now) };
    case '7days': {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      return { startDate: toLocalISO(start), endDate: toLocalISO(now) };
    }
    case '30days': {
      const start = new Date(now);
      start.setDate(now.getDate() - 29);
      return { startDate: toLocalISO(start), endDate: toLocalISO(now) };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: toLocalISO(start), endDate: toLocalISO(now) };
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: toLocalISO(start), endDate: toLocalISO(end) };
    }
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: toLocalISO(start), endDate: toLocalISO(now) };
    }
  }
};

export default function ReportsDashboard() {
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey>('this_month');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('all');
  const [dateRange, setDateRange] = useState(getPresetDates('this_month'));

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

  const fetchReportSummary = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      const res = await getReportSummary(start, end);
      if (res) {
        setSummary(res);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      notify.admin.error('Gagal memuat ringkasan laporan');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchReportSummary();
  }, [fetchReportSummary]);

  const handleSelectPreset = (preset: PresetKey) => {
    setActivePreset(preset);
    if (preset !== 'custom') {
      setDateRange(getPresetDates(preset));
    }
  };

  const handleDateChange = (field: 'startDate' | 'endDate', val: string) => {
    setActivePreset('custom');
    setDateRange((prev) => ({ ...prev, [field]: val }));
  };

  const handleExportSummary = () => {
    setIsExporting(true);
    try {
      const debtRatio =
        summary.totalSales > 0
          ? ((summary.outstandingDebt / summary.totalSales) * 100).toFixed(1)
          : '0';

      const data = [
        { Parameter: 'Periode Laporan', Nilai: `${dateRange.startDate} s/d ${dateRange.endDate}` },
        { Parameter: 'Waktu Ekspor', Nilai: new Date().toLocaleString('id-ID') },
        { Parameter: '', Nilai: '' },
        { Parameter: '--- RINGKASAN PERFORMA BISNIS ---', Nilai: '' },
        { Parameter: 'Total Omzet (Revenue)', Nilai: summary.totalSales },
        { Parameter: 'Total Transaksi Selesai', Nilai: summary.totalOrders },
        { Parameter: 'Rata-rata Transaksi (AOV)', Nilai: Math.round(summary.averageOrderValue) },
        { Parameter: 'Total Piutang Berjalan', Nilai: summary.outstandingDebt },
        { Parameter: 'Rasio Piutang / Omzet', Nilai: `${debtRatio}%` },
        { Parameter: 'Pelanggan Aktif Periode Ini', Nilai: summary.activeCustomers },
        { Parameter: 'Total Katalog SKU', Nilai: summary.totalProducts },
        { Parameter: 'Produk Stok Kritis (<= 10 unit)', Nilai: summary.lowStockCount },
        { Parameter: '', Nilai: '' },
        { Parameter: '--- RINCIAN PENJUALAN HARIAN ---', Nilai: '' },
        ...summary.dailySales.map((d) => ({
          Parameter: `${d.date} (${d.label})`,
          Nilai: d.total
        }))
      ];

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Ringkasan Bisnis');
      XLSX.writeFile(
        workbook,
        `Laporan_Bisnis_AtayaToko_${dateRange.startDate}_sd_${dateRange.endDate}.xlsx`
      );
      notify.success('Laporan Excel berhasil diunduh');
    } catch {
      notify.admin.error('Gagal mengekspor laporan');
    } finally {
      setIsExporting(false);
    }
  };

  const filteredReports = useMemo(() => {
    if (selectedCategory === 'all') return REPORT_ITEMS;
    return REPORT_ITEMS.filter((item) => item.category === selectedCategory);
  }, [selectedCategory]);

  const debtRatio =
    summary.totalSales > 0
      ? (summary.outstandingDebt / summary.totalSales) * 100
      : 0;

  const debtHealth = useMemo(() => {
    if (debtRatio <= 15) {
      return {
        label: 'Kolektibilitas Sehat',
        desc: 'Piutang di bawah 15% dari omzet. Arus kas toko berjalan aman.',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        barColor: 'from-emerald-500 to-teal-500'
      };
    }
    if (debtRatio <= 30) {
      return {
        label: 'Perlu Monitoring',
        desc: 'Piutang 15-30% omzet. Prioritaskan penagihan piutang jatuh tempo.',
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
        barColor: 'from-amber-500 to-amber-400'
      };
    }
    return {
      label: 'Perhatian Khusus',
      desc: 'Piutang melebihi 30% omzet. Hubungi pelanggan untuk pelunasan segera.',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      barColor: 'from-rose-500 to-rose-400'
    };
  }, [debtRatio]);

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto">
      {/* HEADER SECTION */}
      <div className="bg-white rounded-2xl md:rounded-3xl p-4 sm:p-6 border border-gray-100 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                <Activity size={12} />
                Laporan & Intelijen Bisnis
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
              Business Analytics
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
              Pantau performa omzet, kesehatan arus kas, dan operasional toko secara terpadu.
            </p>
          </div>

          {/* ACTION BUTTONS (EXPORT & REFRESH) */}
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <button
              onClick={() => fetchReportSummary()}
              disabled={loading}
              title="Perbarui Data"
              className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl border border-gray-200 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleExportSummary}
              disabled={isExporting || loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              {isExporting ? <Activity size={16} className="animate-spin" /> : <Download size={16} />}
              <span>Ekspor Excel</span>
            </button>
          </div>
        </div>

        {/* DATE FILTER CONTROLS */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mr-1 shrink-0 flex items-center gap-1">
              <Clock size={12} /> Periode:
            </span>
            <PresetBtn
              active={activePreset === 'today'}
              onClick={() => handleSelectPreset('today')}
              label="Hari Ini"
            />
            <PresetBtn
              active={activePreset === '7days'}
              onClick={() => handleSelectPreset('7days')}
              label="7 Hari"
            />
            <PresetBtn
              active={activePreset === 'this_month'}
              onClick={() => handleSelectPreset('this_month')}
              label="Bulan Ini"
            />
            <PresetBtn
              active={activePreset === 'last_month'}
              onClick={() => handleSelectPreset('last_month')}
              label="Bulan Lalu"
            />
          </div>

          {/* Custom Date Input */}
          <div className="flex items-center gap-2 bg-gray-50/80 p-1.5 rounded-xl border border-gray-200/80 shrink-0 self-stretch sm:self-auto">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-gray-200 shadow-2xs flex-1 sm:flex-initial">
              <Calendar size={13} className="text-gray-400 shrink-0" />
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
                className="text-xs font-semibold text-gray-700 bg-transparent outline-none w-full sm:w-28 cursor-pointer"
              />
            </div>
            <span className="text-gray-400 text-xs font-bold">s/d</span>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-gray-200 shadow-2xs flex-1 sm:flex-initial">
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
                className="text-xs font-semibold text-gray-700 bg-transparent outline-none w-full sm:w-28 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
            <StatCard
              label="Total Omzet"
              value={`Rp${summary.totalSales.toLocaleString('id-ID')}`}
              icon={TrendingUp}
              theme="emerald"
              subInfo={`${summary.totalOrders} transaksi berhasil`}
            />
            <StatCard
              label="Total Transaksi"
              value={`${summary.totalOrders}`}
              icon={ShoppingCart}
              theme="blue"
              subInfo={`${summary.activeCustomers} pembeli aktif`}
            />
            <StatCard
              label="Rata-rata Order (AOV)"
              value={`Rp${Math.round(summary.averageOrderValue).toLocaleString('id-ID')}`}
              icon={CreditCard}
              theme="violet"
              subInfo="Per keranjang belanja"
            />
            <StatCard
              label="Stok Kritis"
              value={`${summary.lowStockCount} SKU`}
              icon={AlertTriangle}
              theme={summary.lowStockCount > 0 ? 'amber' : 'gray'}
              subInfo={`Dari total ${summary.totalProducts} SKU`}
              isAlert={summary.lowStockCount > 0}
            />
          </div>

          {/* MAIN CHART & DEBT MONITORING */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* SALES TREND CHART (2 COLS) */}
            <div className="lg:col-span-2 bg-white rounded-2xl md:rounded-3xl p-4 sm:p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                      Tren Penjualan Harian
                    </h3>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Omzet Bersih
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">
                    Grafik pendapatan harian pada rentang waktu yang dipilih
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                    Total Periode Ini
                  </span>
                  <span className="text-sm sm:text-base font-black text-gray-900">
                    Rp{summary.totalSales.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Chart container */}
              <div className="h-56 sm:h-64 w-full mt-2">
                {summary.dailySales.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs">
                    <BarChart3 size={32} className="text-gray-300 mb-2" />
                    Belum ada data penjualan pada periode tanggal ini
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={summary.dailySales}
                      margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 600, fill: '#9ca3af' }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 600, fill: '#9ca3af' }}
                        tickFormatter={(val) => {
                          if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                          if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                          return `${val}`;
                        }}
                      />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#059669"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#salesGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* DEBT & CASHFLOW HEALTH CARD (1 COL) */}
            <div className="bg-white rounded-2xl md:rounded-3xl p-4 sm:p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                      <Activity size={18} />
                    </div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Piutang Berjalan
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${debtHealth.badgeBg}`}
                  >
                    {debtHealth.label}
                  </span>
                </div>

                <div className="mt-2">
                  <h3 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                    Rp{summary.outstandingDebt.toLocaleString('id-ID')}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">{debtHealth.desc}</p>
                </div>

                {/* Progress bar ratio */}
                <div className="mt-5 space-y-1.5 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-500">Rasio thd Omzet</span>
                    <span className="text-gray-900">{debtRatio.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${debtHealth.barColor} transition-all duration-500`}
                      style={{ width: `${Math.min(debtRatio, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 pt-0.5">
                    <span>Ambang aman: &le; 15%</span>
                    <span>Kritis: &gt; 30%</span>
                  </div>
                </div>
              </div>

              {/* Action Link to Debt Details */}
              <Link
                href="/admin/reports/hutang"
                className="mt-5 inline-flex items-center justify-between w-full px-4 py-3 bg-gray-50 hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 rounded-xl text-xs font-bold border border-gray-200 hover:border-emerald-200 transition-all group"
              >
                <span>Kelola & Tagih Piutang</span>
                <ArrowRight
                  size={14}
                  className="group-hover:translate-x-1 transition-transform text-gray-400 group-hover:text-emerald-600"
                />
              </Link>
            </div>
          </div>

          {/* DETAILED REPORTS SECTION */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-1.5 bg-emerald-600 rounded-full" />
                <h3 className="text-base sm:text-lg font-black text-gray-900 uppercase tracking-tight">
                  Katalog Laporan Detail
                </h3>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                <Filter size={12} className="text-gray-400 mr-1 shrink-0" />
                <CategoryFilterBtn
                  active={selectedCategory === 'all'}
                  onClick={() => setSelectedCategory('all')}
                  label="Semua (9)"
                />
                <CategoryFilterBtn
                  active={selectedCategory === 'sales'}
                  onClick={() => setSelectedCategory('sales')}
                  label="Penjualan (3)"
                />
                <CategoryFilterBtn
                  active={selectedCategory === 'finance'}
                  onClick={() => setSelectedCategory('finance')}
                  label="Keuangan (3)"
                />
                <CategoryFilterBtn
                  active={selectedCategory === 'inventory'}
                  onClick={() => setSelectedCategory('inventory')}
                  label="Stok & Ops (3)"
                />
              </div>
            </div>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredReports.map((item) => (
                <ReportCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// SUBCOMPONENTS
// -------------------------------------------------------------

function PresetBtn({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
        active
          ? 'bg-emerald-600 text-white shadow-xs'
          : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
      }`}
    >
      {label}
    </button>
  );
}

function CategoryFilterBtn({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
        active
          ? 'bg-gray-900 text-white shadow-xs'
          : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200'
      }`}
    >
      {label}
    </button>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  theme,
  subInfo,
  isAlert
}: {
  label: string;
  value: string;
  icon: any;
  theme: 'emerald' | 'blue' | 'violet' | 'amber' | 'gray';
  subInfo: string;
  isAlert?: boolean;
}) {
  const themeStyles = {
    emerald: {
      bg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      accent: 'border-l-emerald-500'
    },
    blue: {
      bg: 'bg-blue-50 text-blue-600 border-blue-100',
      accent: 'border-l-blue-500'
    },
    violet: {
      bg: 'bg-violet-50 text-violet-600 border-violet-100',
      accent: 'border-l-violet-500'
    },
    amber: {
      bg: 'bg-amber-50 text-amber-600 border-amber-100',
      accent: 'border-l-amber-500'
    },
    gray: {
      bg: 'bg-gray-50 text-gray-500 border-gray-100',
      accent: 'border-l-gray-400'
    }
  }[theme];

  return (
    <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-100 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 line-clamp-1">
          {label}
        </span>
        <div
          className={`p-2 rounded-xl border ${themeStyles.bg} group-hover:scale-105 transition-transform shrink-0`}
        >
          <Icon size={16} className="sm:size-[18px]" />
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-base sm:text-xl md:text-2xl font-black text-gray-900 tracking-tight truncate">
          {value}
        </h3>
        <p
          className={`text-[11px] font-medium flex items-center gap-1 ${
            isAlert ? 'text-amber-600 font-bold' : 'text-gray-400'
          }`}
        >
          {isAlert && <AlertTriangle size={11} className="shrink-0" />}
          <span className="truncate">{subInfo}</span>
        </p>
      </div>
    </div>
  );
}

function ReportCard({ item }: { item: ReportItem }) {
  const Icon = item.icon;

  return (
    <Link href={item.href} className="group block h-full">
      <div className="h-full bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all duration-200 flex sm:flex-col justify-between items-center sm:items-start gap-3">
        {/* Top bar on tablet/desktop */}
        <div className="flex sm:w-full items-center justify-between">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-700 group-hover:bg-emerald-50 group-hover:text-emerald-700 group-hover:border-emerald-200 transition-colors shrink-0">
            <Icon size={20} className="sm:size-[22px]" />
          </div>
          {item.badge && (
            <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 group-hover:bg-emerald-50 group-hover:text-emerald-700 text-gray-600 transition-colors">
              {item.badge}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="font-bold text-gray-900 text-xs sm:text-sm group-hover:text-emerald-700 transition-colors truncate">
              {item.title}
            </h4>
            {item.badge && (
              <span className="sm:hidden px-1.5 py-0.2 text-[9px] font-bold rounded bg-gray-100 text-gray-600">
                {item.badge}
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-gray-500 line-clamp-2 leading-tight">
            {item.desc}
          </p>
        </div>

        {/* Mobile chevron icon */}
        <div className="shrink-0 sm:hidden w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-emerald-600 group-hover:bg-emerald-50 transition-colors">
          <ChevronRight size={14} />
        </div>
      </div>
    </Link>
  );
}

function CustomChartTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-100 text-xs">
        <p className="font-semibold text-gray-400 mb-1">{data.date || label}</p>
        <p className="font-black text-emerald-700 text-sm">
          Rp{Number(payload[0].value || 0).toLocaleString('id-ID')}
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">Omzet Penjualan Selesai</p>
      </div>
    );
  }
  return null;
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white h-24 rounded-2xl border border-gray-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white h-64 rounded-2xl border border-gray-100" />
        <div className="bg-white h-64 rounded-2xl border border-gray-100" />
      </div>
    </div>
  );
}
