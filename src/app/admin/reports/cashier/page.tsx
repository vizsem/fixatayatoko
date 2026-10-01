'use client';

import { useEffect, useState, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, RefreshCw, Users, TrendingUp, ShoppingCart,
  CreditCard, AlertTriangle, Calendar, ChevronRight, Clock,
  Award, Zap, Download, CheckCircle2, XCircle, BarChart3,
  Package, Activity
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { getUserAndRole } from '@/lib/supabase-helpers';
import {
  getCashierPerformanceReport,
  type CashierPerformanceItem,
  type CashierShiftLog,
} from '@/lib/actions/cashier-report.actions';
import notify from '@/lib/notify';

// ─── helpers ────────────────────────────────────────────────────────────────
const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const getDefaultDates = () => {
  const now = new Date();
  return {
    start: toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toLocalDateStr(now),
  };
};

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

const fmtRp = (v: number) =>
  v >= 1_000_000
    ? `Rp ${(v / 1_000_000).toFixed(1)}jt`
    : `Rp ${v.toLocaleString('id-ID')}`;

const fmtFull = (v: number) => `Rp ${v.toLocaleString('id-ID')}`;

// ─── types ──────────────────────────────────────────────────────────────────
type ReportData = {
  summary: {
    grandTotalRevenue: number;
    grandTotalOrders: number;
    grandTotalItemsSold: number;
    grandAverageAOV: number;
    grandTotalShifts: number;
    grandTotalDiscrepancy: number;
    topPerformerName: string;
    topPerformerRevenue: number;
  };
  cashierList: CashierPerformanceItem[];
  dailyTrend: { date: string; label: string; revenue: number; orders: number }[];
  paymentDistribution: { name: string; value: number }[];
  shiftLogs: CashierShiftLog[];
};

// ─── page ───────────────────────────────────────────────────────────────────
export default function CashierReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);
  const [dates, setDates] = useState(getDefaultDates());
  const [filterCashier, setFilterCashier] = useState('SEMUA');
  const [activeTab, setActiveTab] = useState<'overview' | 'detail' | 'shifts'>('overview');
  const [, startTransition] = useTransition();

  // auth guard
  useEffect(() => {
    (async () => {
      const { user, isAdmin } = await getUserAndRole();
      if (!user) return router.push('/admin/login');
      if (!isAdmin) return router.push('/profil');
    })();
  }, [router]);

  const fetchReport = useCallback(async (start: string, end: string, cashierId?: string) => {
    setLoading(true);
    try {
      const res = await getCashierPerformanceReport(start, end, cashierId || 'SEMUA');
      if (!res.success || !res.data) throw new Error((res as any).error || 'Gagal memuat laporan');
      setData(res.data as ReportData);
    } catch (err: any) {
      notify.error(err.message || 'Gagal memuat laporan kinerja kasir');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(dates.start, dates.end, filterCashier);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleApplyFilter = () => {
    fetchReport(dates.start, dates.end, filterCashier);
  };

  const handleExportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary per kasir
    const rows1 = data.cashierList.map(c => ({
      Kasir: c.cashierName,
      'Total Transaksi': c.totalOrders,
      'Transaksi Selesai': c.completedOrdersCount,
      'Transaksi Batal': c.cancelledOrdersCount,
      'Omzet (Rp)': c.totalRevenue,
      'Avg. Transaksi (Rp)': c.averageBasketValue,
      'Total Item Terjual': c.totalItemsSold,
      'Total Shift': c.totalShifts,
      'Shift Aktif': c.activeShiftsCount,
      'Shift Tutup': c.closedShiftsCount,
      'Selisih Kas (Rp)': c.totalCashDiscrepancy,
      'Produk Terlaris': c.topProductSold,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows1), 'Per Kasir');

    // Sheet 2: Daily trend
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.dailyTrend), 'Tren Harian');

    // Sheet 3: Shift logs
    const rows3 = data.shiftLogs.map(s => ({
      Kasir: s.cashierName,
      Status: s.status,
      'Buka Shift': s.openedAt ? new Date(s.openedAt).toLocaleString('id-ID') : '-',
      'Tutup Shift': s.closedAt ? new Date(s.closedAt).toLocaleString('id-ID') : '-',
      'Kas Awal (Rp)': s.initialCash,
      'Kas Harapan (Rp)': s.expectedCash,
      'Kas Aktual (Rp)': s.actualCash ?? '-',
      'Selisih (Rp)': s.difference,
      Keterangan: s.notes,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows3), 'Log Shift');

    XLSX.writeFile(wb, `Kinerja_Kasir_${dates.start}_${dates.end}.xlsx`);
    notify.success('Laporan berhasil diekspor ke Excel!');
  };

  const cashierNames = data ? ['SEMUA', ...data.cashierList.map(c => c.cashierName)] : ['SEMUA'];

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── HEADER ───────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin/reports" className="text-slate-400 hover:text-slate-800 transition-colors p-1.5 hover:bg-slate-100 rounded-xl">
                <ArrowLeft size={18} />
              </Link>
              <span className="text-xs font-black uppercase tracking-widest text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full">
                Laporan
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Users className="text-purple-600" />
              Laporan Kinerja Kasir
            </h1>
            <p className="text-xs md:text-sm text-slate-400 font-bold mt-1">
              Analisis performa kasir: omzet, transaksi, shift, dan selisih kas.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportExcel}
              disabled={!data || loading}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm shadow-emerald-200 disabled:opacity-50"
            >
              <Download size={16} />
              Export Excel
            </button>
          </div>
        </div>

        {/* ── FILTER BAR ───────────────────────────────────────────────── */}
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={dates.start}
              onChange={e => setDates(d => ({ ...d, start: e.target.value }))}
              className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <span className="text-slate-400 font-bold text-xs">s/d</span>
            <input
              type="date"
              value={dates.end}
              onChange={e => setDates(d => ({ ...d, end: e.target.value }))}
              className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <select
            value={filterCashier}
            onChange={e => setFilterCashier(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {cashierNames.map(n => (
              <option key={n} value={n}>{n === 'SEMUA' ? 'Semua Kasir' : n}</option>
            ))}
          </select>

          <button
            onClick={handleApplyFilter}
            disabled={loading}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm shadow-purple-200 disabled:opacity-50 ml-auto"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}
            Tampilkan
          </button>
        </div>

        {/* ── LOADING ──────────────────────────────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white h-28 rounded-3xl border border-slate-100" />
            ))}
          </div>
        )}

        {/* ── CONTENT ──────────────────────────────────────────────────── */}
        {!loading && data && (
          <>
            {/* KPI CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                label="Total Omzet"
                value={fmtFull(data.summary.grandTotalRevenue)}
                sub={`${data.summary.grandTotalOrders} transaksi selesai`}
                icon={TrendingUp}
                color="text-emerald-600"
                bg="bg-emerald-50"
              />
              <KpiCard
                label="Avg. Per Transaksi"
                value={fmtFull(data.summary.grandAverageAOV)}
                sub="Rata-rata nilai keranjang"
                icon={ShoppingCart}
                color="text-blue-600"
                bg="bg-blue-50"
              />
              <KpiCard
                label="Total Item Terjual"
                value={data.summary.grandTotalItemsSold.toLocaleString('id-ID')}
                sub={`dari ${data.summary.grandTotalShifts} shift kerja`}
                icon={Package}
                color="text-indigo-600"
                bg="bg-indigo-50"
              />
              <KpiCard
                label="Selisih Kas Total"
                value={fmtFull(Math.abs(data.summary.grandTotalDiscrepancy))}
                sub={data.summary.grandTotalDiscrepancy >= 0 ? '▲ Lebih' : '▼ Kurang'}
                icon={AlertTriangle}
                color={data.summary.grandTotalDiscrepancy !== 0 ? 'text-amber-600' : 'text-emerald-600'}
                bg={data.summary.grandTotalDiscrepancy !== 0 ? 'bg-amber-50' : 'bg-emerald-50'}
              />
            </div>

            {/* TOP PERFORMER BANNER */}
            {data.summary.topPerformerName !== '-' && (
              <div className="bg-gradient-to-r from-purple-600 to-indigo-700 p-5 rounded-3xl text-white flex items-center gap-4 shadow-lg shadow-purple-200">
                <div className="p-3 bg-white/20 rounded-2xl shrink-0">
                  <Award size={24} className="text-yellow-300" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-purple-200">Kasir Terbaik Periode Ini</p>
                  <p className="text-xl font-black text-white">{data.summary.topPerformerName}</p>
                  <p className="text-xs text-purple-200 font-bold">
                    Omzet: {fmtFull(data.summary.topPerformerRevenue)}
                  </p>
                </div>
                <div className="ml-auto">
                  <Zap size={40} className="text-white/10" />
                </div>
              </div>
            )}

            {/* TABS */}
            <div className="flex items-center gap-3 border-b border-slate-200">
              {(['overview', 'detail', 'shifts'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 px-2 text-xs md:text-sm font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
                    activeTab === tab
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {tab === 'overview' && <><BarChart3 size={15} /> Grafik & Tren</>}
                  {tab === 'detail' && <><Users size={15} /> Per Kasir ({data.cashierList.length})</>}
                  {tab === 'shifts' && <><Clock size={15} /> Log Shift ({data.shiftLogs.length})</>}
                </button>
              ))}
            </div>

            {/* ── TAB: OVERVIEW ──────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Daily Revenue Trend */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-600" />
                    Tren Omzet Harian
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mb-5">Revenue dari transaksi selesai per hari</p>
                  {data.dailyTrend.every(d => d.revenue === 0) ? (
                    <EmptyChart message="Tidak ada transaksi pada periode ini" />
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.dailyTrend} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} tickFormatter={v => fmtRp(v)} width={60} />
                          <Tooltip
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 700 }}
                            formatter={(v: any) => [fmtFull(Number(v)), 'Omzet']}
                          />
                          <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={3} fill="url(#gradRev)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Payment Distribution */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-2">
                    <CreditCard size={16} className="text-indigo-600" />
                    Distribusi Pembayaran
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mb-5">Komposisi metode bayar periode ini</p>
                  {data.paymentDistribution.length === 0 ? (
                    <EmptyChart message="Belum ada data pembayaran" />
                  ) : (
                    <>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={data.paymentDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {data.paymentDistribution.map((_, idx) => (
                                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 700 }}
                              formatter={(v: any) => [fmtFull(Number(v)), 'Nominal']}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2 mt-2">
                        {data.paymentDistribution.map((p, idx) => {
                          const total = data.paymentDistribution.reduce((s, x) => s + x.value, 0);
                          const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : '0';
                          return (
                            <div key={p.name} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[idx % COLORS.length] }} />
                                <span className="font-bold text-slate-600">{p.name}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-black text-slate-900">{pct}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Orders Bar Chart */}
                <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-2">
                    <ShoppingCart size={16} className="text-blue-600" />
                    Jumlah Transaksi Harian
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mb-5">Jumlah order selesai per hari</p>
                  {data.dailyTrend.every(d => d.orders === 0) ? (
                    <EmptyChart message="Tidak ada transaksi pada periode ini" />
                  ) : (
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.dailyTrend} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 700 }}
                            formatter={(v: any) => [v, 'Transaksi']}
                          />
                          <Bar dataKey="orders" fill="#6366f1" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB: PER KASIR ─────────────────────────────────────── */}
            {activeTab === 'detail' && (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                {data.cashierList.length === 0 ? (
                  <div className="p-16 text-center">
                    <Users size={36} className="mx-auto text-slate-300 mb-3" />
                    <p className="font-black text-slate-700 text-sm">Belum ada data kasir pada periode ini</p>
                    <p className="text-xs text-slate-400 font-bold mt-1">Coba ubah rentang tanggal atau filter kasir</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-widest font-black">
                          <th className="py-4 px-6">Kasir</th>
                          <th className="py-4 px-4 text-right">Omzet</th>
                          <th className="py-4 px-4 text-center">Transaksi</th>
                          <th className="py-4 px-4 text-center">Batal</th>
                          <th className="py-4 px-4 text-right">Avg. Transaksi</th>
                          <th className="py-4 px-4 text-center">Item Terjual</th>
                          <th className="py-4 px-4 text-center">Shift</th>
                          <th className="py-4 px-4 text-right">Selisih Kas</th>
                          <th className="py-4 px-6">Produk Terlaris</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {data.cashierList.map((c, idx) => {
                          const isTop = idx === 0 && c.totalRevenue > 0;
                          const hasDiscrepancy = c.totalCashDiscrepancy !== 0;
                          const convRate = c.totalOrders > 0
                            ? ((c.completedOrdersCount / c.totalOrders) * 100).toFixed(0)
                            : '0';
                          return (
                            <tr key={c.cashierId} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-2.5">
                                  {isTop && <Award size={14} className="text-yellow-500 shrink-0" />}
                                  <div>
                                    <p className="font-black text-slate-900 uppercase">{c.cashierName}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">
                                      Konversi: {convRate}%
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-right">
                                <p className="font-black text-emerald-700">{fmtFull(c.totalRevenue)}</p>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <CheckCircle2 size={12} className="text-emerald-500" />
                                  <span className="font-black text-slate-800">{c.completedOrdersCount}</span>
                                  <span className="text-slate-400">/ {c.totalOrders}</span>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-center">
                                {c.cancelledOrdersCount > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full font-black">
                                    <XCircle size={11} />
                                    {c.cancelledOrdersCount}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-bold">0</span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-right font-black text-slate-800">
                                {fmtFull(c.averageBasketValue)}
                              </td>
                              <td className="py-4 px-4 text-center font-black text-slate-800">
                                {c.totalItemsSold.toLocaleString('id-ID')}
                              </td>
                              <td className="py-4 px-4 text-center">
                                <div>
                                  <span className="font-black text-slate-800">{c.closedShiftsCount}</span>
                                  {c.activeShiftsCount > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black">
                                      {c.activeShiftsCount} aktif
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-4 text-right">
                                {hasDiscrepancy ? (
                                  <span className={`font-black ${c.totalCashDiscrepancy > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {c.totalCashDiscrepancy > 0 ? '+' : ''}{fmtFull(c.totalCashDiscrepancy)}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-bold">Sesuai</span>
                                )}
                              </td>
                              <td className="py-4 px-6 text-slate-500 font-bold max-w-[200px]">
                                <p className="line-clamp-2">{c.topProductSold || '-'}</p>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: LOG SHIFT ─────────────────────────────────────── */}
            {activeTab === 'shifts' && (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                {data.shiftLogs.length === 0 ? (
                  <div className="p-16 text-center">
                    <Clock size={36} className="mx-auto text-slate-300 mb-3" />
                    <p className="font-black text-slate-700 text-sm">Belum ada data shift pada periode ini</p>
                    <p className="text-xs text-slate-400 font-bold mt-1">Coba ubah rentang tanggal atau filter kasir</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-widest font-black">
                          <th className="py-4 px-6">Kasir</th>
                          <th className="py-4 px-4">Status</th>
                          <th className="py-4 px-4">Buka Shift</th>
                          <th className="py-4 px-4">Tutup Shift</th>
                          <th className="py-4 px-4 text-right">Kas Awal</th>
                          <th className="py-4 px-4 text-right">Kas Harapan</th>
                          <th className="py-4 px-4 text-right">Kas Aktual</th>
                          <th className="py-4 px-4 text-right">Selisih</th>
                          <th className="py-4 px-6">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {data.shiftLogs.map(s => {
                          const diff = s.difference;
                          const fmtDate = (v: string | null) =>
                            v ? new Date(v).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-';
                          return (
                            <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3.5 px-6 font-black text-slate-900 uppercase">{s.cashierName}</td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                  s.status === 'OPEN'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {s.status === 'OPEN' ? <><Activity size={9} /> Aktif</> : 'Tutup'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-500 font-bold whitespace-nowrap">{fmtDate(s.openedAt)}</td>
                              <td className="py-3.5 px-4 text-slate-500 font-bold whitespace-nowrap">{fmtDate(s.closedAt)}</td>
                              <td className="py-3.5 px-4 text-right font-bold text-slate-700">{fmtFull(s.initialCash)}</td>
                              <td className="py-3.5 px-4 text-right font-bold text-slate-700">{fmtFull(s.expectedCash)}</td>
                              <td className="py-3.5 px-4 text-right font-bold text-slate-700">
                                {s.actualCash !== null ? fmtFull(s.actualCash) : <span className="text-slate-300">-</span>}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                {diff === 0
                                  ? <span className="font-bold text-emerald-600">Sesuai</span>
                                  : <span className={`font-black ${diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {diff > 0 ? '+' : ''}{fmtFull(diff)}
                                    </span>
                                }
                              </td>
                              <td className="py-3.5 px-6 text-slate-400 font-bold">
                                {s.notes || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* EMPTY STATE */}
        {!loading && !data && (
          <div className="bg-white p-16 text-center rounded-3xl border border-slate-100 shadow-sm">
            <AlertTriangle size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="font-black text-slate-700 text-sm">Pilih rentang tanggal dan klik Tampilkan</p>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color, bg }: {
  label: string; value: string; sub: string;
  icon: any; color: string; bg: string;
}) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2">
      <div className={`flex items-center justify-between ${color}`}>
        <span className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</span>
        <div className={`p-2 ${bg} rounded-xl`}><Icon size={18} /></div>
      </div>
      <p className="text-lg md:text-xl font-black text-slate-900 leading-tight">{value}</p>
      <p className="text-xs font-bold text-slate-400">{sub}</p>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-48 flex items-center justify-center text-slate-300">
      <div className="text-center space-y-2">
        <BarChart3 size={32} className="mx-auto" />
        <p className="text-xs font-bold text-slate-400">{message}</p>
      </div>
    </div>
  );
}
