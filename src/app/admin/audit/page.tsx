'use client';

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import {
  History, ArrowLeftRight, Wallet, Search, Download, User, Package,
  Landmark, ChevronRight, BarChart3, TrendingUp, Receipt, FileX,
  ChevronDown, RefreshCw, AlertTriangle,
  DollarSign, ShoppingCart, Activity, CheckCircle, ArrowUp, ArrowDown,
  Layers, Banknote, Tag
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';
import * as Sentry from '@sentry/nextjs';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';
import { supabase } from '@/lib/supabase';
import { getUserAndRole, sbGetDocs } from '@/lib/supabase-helpers';
import { calculateTaxBreakdown, DEFAULT_TAX_SETTINGS } from '@/lib/tax';
import { hitungItemOrder, keBentukProdukHpp, PRODUK_RINGKAS } from '@/lib/hpp';
import { coerceDate } from '@/lib/date-utils';

type AuditTab = 'stock' | 'transaction' | 'finance' | 'profit' | 'cost' | 'capital' | 'tax';

const toDateOrNull = (value: any) => coerceDate(value);
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

function getPresetRange(preset: string): { start: string; end: string } {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (preset === 'today') { const s = fmt(today); return { start: s, end: s }; }
  if (preset === '7d') { const s = new Date(today); s.setDate(s.getDate() - 6); return { start: fmt(s), end: fmt(today) }; }
  if (preset === 'month') return { start: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`, end: fmt(today) };
  if (preset === 'lastmonth') {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start: fmt(first), end: fmt(last) };
  }
  return { start: fmt(today), end: fmt(today) };
}

function StatCard({ label, value, sub, color = 'slate', icon: Icon, accent = false }: {
  label: string; value: string; sub?: string; color?: string; icon?: React.ElementType; accent?: boolean;
}) {
  const bg = accent ? `bg-${color}-600 border-${color}-500` : 'bg-white border-slate-100';
  const labelCls = accent ? 'text-white/70' : 'text-slate-400';
  const valueCls = accent ? 'text-white' : `text-${color}-700`;
  const subCls = accent ? 'text-white/60' : 'text-slate-400';
  const iconBg = accent ? 'bg-white/20' : `bg-${color}-50`;
  const iconColor = accent ? 'text-white' : `text-${color}-600`;
  return (
    <div className={`p-4 rounded-2xl border shadow-sm flex items-center gap-3 ${bg}`}>
      {Icon && (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={16} className={iconColor} />
        </div>
      )}
      <div className="min-w-0">
        <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 truncate ${labelCls}`}>{label}</p>
        <p className={`text-base font-black leading-tight ${valueCls}`}>{value}</p>
        {sub && <p className={`text-[10px] font-bold mt-0.5 truncate ${subCls}`}>{sub}</p>}
      </div>
    </div>
  );
}

function AuditPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<AuditTab>(() => {
    const tab = searchParams?.get('tab') as AuditTab | null;
    const validTabs: AuditTab[] = ['stock', 'transaction', 'finance', 'profit', 'cost', 'capital', 'tax'];
    return tab && validTabs.includes(tab) ? tab : 'stock';
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [limitCount, setLimitCount] = useState(50);
  const [activePreset, setActivePreset] = useState<string>('month');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [stockLogs, setStockLogs] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [profitLogs, setProfitLogs] = useState<any[]>([]);
  const [costLogs, setCostLogs] = useState<any[]>([]);
  const [capitalLogs, setCapitalLogs] = useState<any[]>([]);
  const [taxLogs, setTaxLogs] = useState<any[]>([]);
  const [profitSummary, setProfitSummary] = useState({ sales: 0, cost: 0, profit: 0, discount: 0, expenses: 0, netProfit: 0, labaEstimasi: 0, itemEstimasi: 0 });
  const [taxSummary, setTaxSummary] = useState({ totalSales: 0, dpp: 0, taxAmount: 0 });

  useEffect(() => {
    const checkAuth = async () => {
      const { user, isAdmin } = await getUserAndRole();
      if (!user) return router.push('/profil/login');
      if (!isAdmin) { notify.aksesDitolakAdmin?.(); return router.push('/profil'); }
    };
    checkAuth();
    let unsubAuth: (() => void) | undefined;
    (async () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') checkAuth(); });
      unsubAuth = () => subscription.unsubscribe();
    })();
    return () => { if (unsubAuth) unsubAuth(); };
  }, [router]);

  const applyPreset = useCallback((preset: string) => {
    const { start, end } = getPresetRange(preset);
    setStartDate(start); setEndDate(end); setActivePreset(preset);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(startDate); start.setHours(0, 0, 0, 0);
      const end = new Date(endDate); end.setHours(23, 59, 59, 999);

      if (activeTab === 'stock') {
        const { data, error } = await supabase.from('inventory_logs').select('*').gte('created_at', start.toISOString()).lte('created_at', end.toISOString()).order('created_at', { ascending: false }).limit(limitCount);
        if (error) throw error;
        setStockLogs((data || []).map((row: any) => {
          const raw = row.raw_data || {};
          return {
            id: row.id, ...raw, ...row,
            productName: row.product_name || raw.productName || raw.product_name || 'Produk',
            amount: Math.abs(Number(row.amount ?? row.quantity ?? raw.amount ?? raw.quantity ?? 0)),
            prevStock: Number(row.prev_stock ?? raw.prevStock ?? 0),
            nextStock: Number(row.next_stock ?? raw.nextStock ?? 0),
            adminId: row.admin_id || raw.adminId || 'System',
            type: (row.type || raw.type || 'MASUK').toUpperCase(),
            source: (row.source || raw.source || 'MANUAL').toUpperCase(),
            note: row.note || raw.note || raw.notes || '',
            date: row.created_at || raw.createdAt || raw.date,
          };
        }));
      } else if (activeTab === 'transaction') {
        const { data, error } = await supabase.from('orders').select('*').gte('created_at', start.toISOString()).lte('created_at', end.toISOString()).order('created_at', { ascending: false }).limit(limitCount);
        if (error) throw error;
        setTransactions((data || []).map((row: any) => ({ ...row, createdAt: row.created_at || row.createdAt })));
      } else if (activeTab === 'finance') {
        const { data: shiftRows, error } = await supabase.from('cashier_shifts').select('*').gte('created_at', start.toISOString()).lte('created_at', end.toISOString()).order('created_at', { ascending: false }).limit(limitCount);
        if (error) throw error;
        setShifts((shiftRows || []).map((row: any) => {
          const raw = row.raw_data || {};
          return { ...row, cashierName: raw.cashierName || row.cashierName || row.cashier_name || 'Kasir', expectedCash: Number(raw.expectedCash ?? row.expectedCash ?? row.expected_cash ?? 0), difference: Number(raw.difference ?? row.difference ?? 0), openedAt: raw.openedAt || row.openedAt || row.opened_at || row.created_at, closedAt: raw.closedAt || row.closedAt || row.closed_at || null };
        }));
      } else if (activeTab === 'profit') {
        const [ordersRes, expensesRes] = await Promise.all([
          supabase.from('orders').select('*').in('status', ['SELESAI', 'SUCCESS']).gte('created_at', start.toISOString()).lte('created_at', end.toISOString()),
          supabase.from('operational_expenses').select('*').gte('date', start.toISOString()).lte('date', end.toISOString()),
        ]);
        if (ordersRes.error) throw ordersRes.error;
        if (expensesRes.error) throw expensesRes.error;
        const oDocs = ordersRes.data || []; const eDocs = expensesRes.data || [];
        let tS = 0, tC = 0, tD = 0, tE = 0, tEstimasi = 0, nEstimasi = 0;
        eDocs.forEach(d => tE += Number(d.amount || d.raw_data?.amount || 0));
        const produkSnap = await sbGetDocs({ table: 'products', columns: PRODUK_RINGKAS });
        const produkMap = new Map<string, any>();
        produkSnap.docs.forEach(ps => produkMap.set(ps.id, keBentukProdukHpp(ps.data())));
        const logs = oDocs.map((d: any) => {
          const data = d.raw_data || d;
          const items = Array.isArray(d.items) ? d.items : (data.items || []);
          const { ringkasan } = hitungItemOrder({ items, produkDari: (pid) => produkMap.get(pid) });
          const pendapatan = ringkasan.itemTotal > 0 ? ringkasan.pendapatan : Number(d.total || data.total || 0);
          const oC = ringkasan.hppDipercaya + ringkasan.hppEstimasi;
          const oD = items.reduce((s: number, i: any) => s + Math.max(0, ((Number(i.originalPrice || i.price || 0)) - Number(i.price || 0)) * Number(i.quantity || 1)), 0);
          tS += pendapatan; tC += oC; tD += oD; tEstimasi += ringkasan.labaEstimasi; nEstimasi += ringkasan.itemEstimasi;
          return { id: d.id, date: d.created_at || d.createdAt || data.createdAt, sales: pendapatan, cost: oC, profit: pendapatan - oC, labaEstimasi: ringkasan.labaEstimasi, itemEstimasi: ringkasan.itemEstimasi };
        });
        setProfitLogs(logs);
        setProfitSummary({ sales: tS, cost: tC, profit: tS - tC, discount: tD, expenses: tE, netProfit: tS - tC - tE, labaEstimasi: tEstimasi, itemEstimasi: nEstimasi });
      } else if (activeTab === 'cost') {
        const { data, error } = await supabase.from('product_cost_logs').select('*').gte('changeDate', start.toISOString()).lte('changeDate', end.toISOString()).order('changeDate', { ascending: false }).limit(limitCount);
        if (error) throw error;
        setCostLogs((data || []).map((row: any) => ({ ...row, changeDate: row.changeDate || row.change_date || row.created_at })));
      } else if (activeTab === 'capital') {
        const { data: capData, error } = await supabase.from('capital_transactions').select('*').gte('created_at', start.toISOString()).lte('created_at', end.toISOString()).order('created_at', { ascending: false }).limit(limitCount);
        if (error) throw error;
        setCapitalLogs((capData || []).map(c => {
          const raw = c.raw_data || {};
          return { id: c.id, date: raw.date ? new Date(raw.date) : new Date(c.created_at), type: raw.type === 'INJECTION' ? 'INJEKSI MODAL' : 'PENARIKAN / PRIVE', transactionType: raw.type === 'INJECTION' ? 'IN' : 'OUT', amount: raw.amount || 0, referenceId: raw.description || '-', executorName: raw.recordedBy || 'Admin' };
        }));
      } else if (activeTab === 'tax') {
        const [ordersRes, sSnap] = await Promise.all([
          supabase.from('orders').select('*').in('status', ['SELESAI', 'SUCCESS']).gte('created_at', start.toISOString()).lte('created_at', end.toISOString()),
          sbGetDocs({ table: 'settings' }),
        ]);
        if (ordersRes.error) throw ordersRes.error;
        let taxSettings = DEFAULT_TAX_SETTINGS;
        sSnap.docs.forEach(d => { if (d.id === 'system' && d.data()?.tax) taxSettings = { ...DEFAULT_TAX_SETTINGS, ...d.data().tax }; });
        const oDocs = ordersRes.data || [];
        const tLogs: any[] = []; let sumSales = 0, sumDPP = 0, sumTax = 0;
        oDocs.forEach((d: any) => {
          const data = d.raw_data || d;
          const created = toDateOrNull(d.created_at || d.createdAt || data.createdAt) || new Date();
          const items = Array.isArray(d.items) ? d.items : (data.items || []);
          items.forEach((item: any) => {
            const itemTotal = Number(item.price || 0) * Number(item.quantity || 1);
            const breakdown = calculateTaxBreakdown({ amount: itemTotal, category: item.category || item.Kategori || 'UMUM', taxSettings });
            sumSales += itemTotal; sumDPP += breakdown.dpp; sumTax += breakdown.taxAmount;
            tLogs.push({ id: `${d.id}_${item.id || item.productId}`, orderId: data.orderId || d.id, date: created, customer: data.customerName || 'Pelanggan', product: item.name || 'Produk', category: item.category || item.Kategori || 'UMUM', sales: itemTotal, dpp: breakdown.dpp, taxAmount: breakdown.taxAmount, taxLabel: breakdown.taxLabel, isExempt: breakdown.isExempt });
          });
        });
        setTaxLogs(tLogs); setTaxSummary({ totalSales: sumSales, dpp: sumDPP, taxAmount: sumTax });
      }
    } catch (err) {
      Sentry.captureException(err); notify.error('Gagal memuat data');
    } finally { setLoading(false); }
  }, [activeTab, startDate, endDate, limitCount]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = async () => {
    let data: any[] = [];
    if (activeTab === 'stock') data = filteredStock.map(l => { const d = toDateOrNull(l.date) || new Date(); return { Tanggal: format(d, 'Pp'), Produk: l.productName, Tipe: l.type, Qty: l.amount, Sisa: l.nextStock, Admin: l.adminId }; });
    else if (activeTab === 'transaction') data = filteredTx.map(t => { const d = toDateOrNull(t.createdAt) || new Date(); return { Tanggal: format(d, 'Pp'), ID: t.id, Customer: t.customerName, Total: t.total, Status: t.status }; });
    else if (activeTab === 'finance') data = filteredShifts.map(s => { const o = toDateOrNull(s.openedAt); const c = toDateOrNull(s.closedAt); return { Dibuka: o ? format(o, 'Pp') : '-', Ditutup: c ? format(c, 'Pp') : 'Aktif', Kasir: s.cashierName, EstimasiSaldo: s.expectedCash, Selisih: s.difference }; });
    else if (activeTab === 'profit') data = filteredProfit.map(p => { const d = toDateOrNull(p.date) || new Date(); return { Tanggal: format(d, 'Pp'), ID: p.id, Pendapatan: p.sales, HPP: p.cost, Laba: p.profit }; });
    else if (activeTab === 'cost') data = filteredCost.map(c => { const d = toDateOrNull(c.changeDate) || new Date(); return { Tanggal: format(d, 'Pp'), Produk: c.productName, 'HPP Lama': c.oldCost, 'HPP Baru': c.newCost, Perubahan: c.newCost - c.oldCost }; });
    else if (activeTab === 'capital') data = filteredCapital.map(c => { const d = toDateOrNull(c.date) || new Date(); return { Tanggal: format(d, 'Pp'), Referensi: c.referenceId, Tipe: c.type, Nominal: c.amount, Oleh: c.executorName }; });
    else if (activeTab === 'tax') data = filteredTax.map(t => ({ Tanggal: format(toDateOrNull(t.date) || new Date(), 'Pp'), Nota: t.orderId, Customer: t.customer, Produk: t.product, Kategori: t.category, Omzet: t.sales, DPP: t.dpp, Pajak: t.taxAmount, Status: t.taxLabel }));
    if (data.length === 0) { notify.error('Tidak ada data untuk diekspor'); return; }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab);
    XLSX.writeFile(wb, `Audit_${activeTab}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const tabs: { id: AuditTab; label: string; shortLabel: string; icon: React.ElementType }[] = [
    { id: 'stock',       label: 'Riwayat Stok',   shortLabel: 'Stok',      icon: Package },
    { id: 'transaction', label: 'Transaksi',       shortLabel: 'Transaksi', icon: ArrowLeftRight },
    { id: 'finance',     label: 'Sesi Kasir',      shortLabel: 'Kasir',     icon: Wallet },
    { id: 'capital',     label: 'Arus Modal',      shortLabel: 'Modal',     icon: Landmark },
    { id: 'tax',         label: 'Audit Pajak',     shortLabel: 'Pajak',     icon: Receipt },
    { id: 'profit',      label: 'Laba Rugi',       shortLabel: 'Laba',      icon: TrendingUp },
    { id: 'cost',        label: 'Perubahan HPP',   shortLabel: 'HPP',       icon: BarChart3 },
  ];

  const presets = [
    { key: 'today',     label: 'Hari Ini' },
    { key: '7d',        label: '7 Hari' },
    { key: 'month',     label: 'Bulan Ini' },
    { key: 'lastmonth', label: 'Bulan Lalu' },
  ];

  const filteredStock   = stockLogs.filter(l => (l.productName || l.note || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredTx      = transactions.filter(t => t.id?.toLowerCase().includes(searchTerm.toLowerCase()) || t.customerName?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredShifts  = shifts.filter(s => s.cashierName?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredProfit  = profitLogs.filter(p => p.id?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredCost    = costLogs.filter(c => c.productName?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredCapital = capitalLogs.filter(c => c.referenceId?.toLowerCase().includes(searchTerm.toLowerCase()) || c.type?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredTax     = taxLogs.filter(t => t.product?.toLowerCase().includes(searchTerm.toLowerCase()) || t.orderId?.toLowerCase().includes(searchTerm.toLowerCase()));

  const currentCount = { stock: filteredStock.length, transaction: filteredTx.length, finance: filteredShifts.length, profit: filteredProfit.length, cost: filteredCost.length, capital: filteredCapital.length, tax: filteredTax.length }[activeTab] ?? 0;

  const stockSummary   = useMemo(() => { const masuk = filteredStock.filter(l => l.type === 'MASUK').reduce((s, l) => s + l.amount, 0); const keluar = filteredStock.filter(l => l.type !== 'MASUK').reduce((s, l) => s + l.amount, 0); return { masuk, keluar, total: filteredStock.length }; }, [filteredStock]);
  const txSummary      = useMemo(() => { const done = filteredTx.filter(t => ['SELESAI', 'SUCCESS'].includes(String(t.status).toUpperCase())); return { total: filteredTx.length, selesai: done.length, revenue: done.reduce((s, t) => s + Number(t.total || 0), 0) }; }, [filteredTx]);
  const financeSummary = useMemo(() => { const active = filteredShifts.filter(s => !s.closedAt).length; return { total: filteredShifts.length, active, totalCash: filteredShifts.reduce((s, sh) => s + Number(sh.expectedCash || 0), 0), totalDiff: filteredShifts.reduce((s, sh) => s + Number(sh.difference || 0), 0) }; }, [filteredShifts]);
  const capitalSummary = useMemo(() => { const injeksi = filteredCapital.filter(c => c.transactionType === 'IN').reduce((s, c) => s + Number(c.amount || 0), 0); const penarikan = filteredCapital.filter(c => c.transactionType === 'OUT').reduce((s, c) => s + Number(c.amount || 0), 0); return { injeksi, penarikan, net: injeksi - penarikan, total: filteredCapital.length }; }, [filteredCapital]);
  const costSummary    = useMemo(() => ({ total: filteredCost.length, naik: filteredCost.filter(c => (c.newCost || 0) > (c.oldCost || 0)).length, turun: filteredCost.filter(c => (c.newCost || 0) < (c.oldCost || 0)).length }), [filteredCost]);

  const tabLabel = tabs.find(t => t.id === activeTab)?.label || activeTab;

  return (
    <div className="p-3 md:p-6 bg-[#F8FAFC] min-h-screen">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <div className="p-2 bg-blue-600 rounded-xl"><History className="text-white" size={20} /></div>
              Audit Terpusat
            </h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1 ml-0.5">Pencatatan &amp; Riwayat Sistem</p>
          </div>
          <button onClick={handleExport} disabled={loading || currentCount === 0} className="hidden sm:flex px-5 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black uppercase tracking-widest items-center gap-2 border border-emerald-200 hover:bg-emerald-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
            <Download size={14} /> Export {tabLabel}
          </button>
        </div>

        {/* Tab bar */}
        <div className="bg-white p-1 rounded-2xl border border-slate-100 shadow-sm flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setSearchTerm(''); }} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all whitespace-nowrap shrink-0 ${activeTab === t.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}>
              <t.icon size={12} />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="bg-white p-3 rounded-[1.75rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={15} />
            <input type="text" placeholder="Cari data..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-2xl text-xs font-bold outline-none focus:bg-slate-100 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {/* Quick presets */}
            <div className="flex gap-1 bg-slate-50 p-1 rounded-xl">
              {presets.map(p => (
                <button key={p.key} onClick={() => applyPreset(p.key)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activePreset === p.key ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {/* Date range */}
            <div className="flex bg-slate-50 rounded-xl p-1 gap-1 items-center shrink-0">
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setActivePreset(''); }} className="bg-transparent border-none text-xs font-black p-1.5 outline-none cursor-pointer text-slate-700" />
              <span className="text-slate-300 text-xs font-black">—</span>
              <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setActivePreset(''); }} className="bg-transparent border-none text-xs font-black p-1.5 outline-none cursor-pointer text-slate-700" />
            </div>
            {/* Limit */}
            <div className="relative shrink-0">
              <select value={limitCount} onChange={e => setLimitCount(Number(e.target.value))} className="appearance-none bg-slate-50 border-none text-xs font-black px-3.5 py-2.5 pr-7 rounded-xl outline-none cursor-pointer">
                {[25, 50, 100, 250, 500].map(n => <option key={n} value={n}>{n} data</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <button onClick={fetchData} disabled={loading} className="p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all shrink-0 disabled:opacity-50" title="Muat ulang data">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleExport} disabled={loading || currentCount === 0} className="sm:hidden flex-1 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-emerald-200 disabled:opacity-40">
              <Download size={13} /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Summary cards per tab */}
      {!loading && (
        <div className="mb-5">
          {activeTab === 'stock' && (
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total Mutasi" value={String(stockSummary.total)} icon={Layers} color="blue" />
              <StatCard label="Stok Masuk" value={`+${stockSummary.masuk}`} icon={ArrowUp} color="emerald" />
              <StatCard label="Stok Keluar" value={`-${stockSummary.keluar}`} icon={ArrowDown} color="rose" />
            </div>
          )}
          {activeTab === 'transaction' && (
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total Transaksi" value={String(txSummary.total)} icon={ShoppingCart} color="blue" />
              <StatCard label="Transaksi Selesai" value={String(txSummary.selesai)} icon={CheckCircle} color="emerald" />
              <StatCard label="Total Pendapatan" value={rp(txSummary.revenue)} icon={DollarSign} color="emerald" accent />
            </div>
          )}
          {activeTab === 'finance' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Sesi" value={String(financeSummary.total)} icon={Activity} color="blue" />
              <StatCard label="Sesi Aktif" value={String(financeSummary.active)} icon={CheckCircle} color="emerald" />
              <StatCard label="Total Kas" value={rp(financeSummary.totalCash)} icon={Banknote} color="indigo" />
              <StatCard label="Selisih Kas" value={(financeSummary.totalDiff >= 0 ? '+' : '') + rp(financeSummary.totalDiff)} icon={financeSummary.totalDiff >= 0 ? ArrowUp : ArrowDown} color={financeSummary.totalDiff === 0 ? 'slate' : financeSummary.totalDiff > 0 ? 'emerald' : 'rose'} accent={financeSummary.totalDiff !== 0} />
            </div>
          )}
          {activeTab === 'capital' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Transaksi" value={String(capitalSummary.total)} icon={Activity} color="blue" />
              <StatCard label="Injeksi Modal" value={rp(capitalSummary.injeksi)} icon={ArrowUp} color="emerald" />
              <StatCard label="Penarikan / Prive" value={rp(capitalSummary.penarikan)} icon={ArrowDown} color="rose" />
              <StatCard label="Arus Bersih" value={(capitalSummary.net >= 0 ? '+' : '') + rp(capitalSummary.net)} icon={Landmark} color={capitalSummary.net >= 0 ? 'emerald' : 'rose'} accent />
            </div>
          )}
          {activeTab === 'profit' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Penjualan Kotor" value={rp(profitSummary.sales)} icon={ShoppingCart} color="blue" />
              <StatCard label="Total Modal (HPP)" value={rp(profitSummary.cost)} icon={Tag} color="rose" />
              <StatCard label="Biaya Operasional" value={rp(profitSummary.expenses)} icon={BarChart3} color="amber" />
              <div className={`p-4 rounded-2xl border shadow-sm ${profitSummary.netProfit >= 0 ? 'bg-emerald-600 border-emerald-500' : 'bg-rose-600 border-rose-500'} text-white`}>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-75 mb-1">Laba Bersih</p>
                <p className="text-base font-black leading-tight">{rp(profitSummary.netProfit)}</p>
                {profitSummary.itemEstimasi > 0 && (
                  <p className="text-[10px] font-bold opacity-70 mt-1.5 flex items-start gap-1 leading-tight">
                    <AlertTriangle size={9} className="mt-0.5 shrink-0" />{profitSummary.itemEstimasi} item tanpa modal
                  </p>
                )}
              </div>
            </div>
          )}
          {activeTab === 'cost' && (
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total Perubahan" value={String(costSummary.total)} icon={BarChart3} color="blue" />
              <StatCard label="HPP Naik" value={String(costSummary.naik)} icon={ArrowUp} color="rose" />
              <StatCard label="HPP Turun" value={String(costSummary.turun)} icon={ArrowDown} color="emerald" />
            </div>
          )}
          {activeTab === 'tax' && (
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total Omzet" value={rp(taxSummary.totalSales)} sub={`${taxLogs.length} item`} icon={Receipt} color="blue" />
              <StatCard label="DPP (Sebelum Pajak)" value={rp(taxSummary.dpp)} icon={Tag} color="indigo" />
              <StatCard label="Pajak Terutang" value={rp(taxSummary.taxAmount)} icon={Banknote} color="indigo" accent />
            </div>
          )}
        </div>
      )}

      {/* Info bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{loading ? 'Memuat data...' : `${currentCount} data ditemukan`}</p>
        {!loading && currentCount >= limitCount && (
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1"><AlertTriangle size={11} /> Batas {limitCount} — perbesar limit atau sempitkan tanggal</p>
        )}
      </div>

      {/* Table / Cards container */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8"><TableSkeleton rows={8} /></div>
        ) : currentCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="p-4 bg-slate-50 rounded-3xl"><FileX size={32} className="text-slate-300" /></div>
            <div className="text-center">
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Tidak Ada Data</p>
              <p className="text-xs text-slate-300 font-bold mt-1">{searchTerm ? `Tidak ada hasil untuk "${searchTerm}"` : 'Belum ada data dalam rentang tanggal ini'}</p>
            </div>
            {searchTerm && <button onClick={() => setSearchTerm('')} className="text-xs font-black text-blue-600 hover:underline uppercase tracking-widest">Hapus pencarian</button>}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] border-b border-slate-100">
                  {activeTab === 'stock' && <tr><th className="px-6 py-4">Waktu</th><th className="px-6 py-4">Nama Produk</th><th className="px-6 py-4">Mutasi</th><th className="px-6 py-4">Saldo Stok</th><th className="px-6 py-4 text-right">Oleh</th></tr>}
                  {activeTab === 'transaction' && <tr><th className="px-6 py-4">Dibuat Pada</th><th className="px-6 py-4">Referensi</th><th className="px-6 py-4">Pelanggan</th><th className="px-6 py-4">Pendapatan</th><th className="px-6 py-4 text-right">Status</th></tr>}
                  {activeTab === 'finance' && <tr><th className="px-6 py-4">Dibuka</th><th className="px-6 py-4">Ditutup</th><th className="px-6 py-4">Kasir</th><th className="px-6 py-4">Estimasi Kas</th><th className="px-6 py-4 text-right">Selisih</th></tr>}
                  {activeTab === 'capital' && <tr><th className="px-6 py-4">Tanggal</th><th className="px-6 py-4">Referensi</th><th className="px-6 py-4">Tipe</th><th className="px-6 py-4">Nominal</th><th className="px-6 py-4 text-right">Oleh</th></tr>}
                  {activeTab === 'cost' && <tr><th className="px-6 py-4">Tanggal</th><th className="px-6 py-4">Produk</th><th className="px-6 py-4">HPP Lama</th><th className="px-6 py-4">HPP Baru</th><th className="px-6 py-4 text-right">Perubahan</th></tr>}
                  {activeTab === 'tax' && <tr><th className="px-6 py-4">Tanggal</th><th className="px-6 py-4">No. Nota</th><th className="px-6 py-4">Produk / Kategori</th><th className="px-6 py-4">Omzet</th><th className="px-6 py-4">DPP</th><th className="px-6 py-4 text-right">Pajak</th></tr>}
                  {activeTab === 'profit' && <tr><th className="px-6 py-4">Tanggal</th><th className="px-6 py-4">ID Pesanan</th><th className="px-6 py-4">Pendapatan</th><th className="px-6 py-4">Total Modal</th><th className="px-6 py-4 text-right">Laba</th></tr>}
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {activeTab === 'stock' && filteredStock.map(l => {
                    const refIdMatch = l.note?.match(/#([A-Za-z0-9]+)/); const refId = refIdMatch ? refIdMatch[1] : null;
                    const isReturn = l.note?.toLowerCase().includes('retur'); const refUrl = isReturn ? `/admin/returns` : (refId ? `/admin/orders/${refId}` : null);
                    const logDate = toDateOrNull(l.date);
                    return (
                      <tr key={l.id} className="hover:bg-slate-50/60 transition-all group">
                        <td className="px-6 py-4"><p className="text-xs font-black text-slate-800">{logDate ? format(logDate, 'HH:mm') : '-'}</p><p className="text-[10px] font-bold text-slate-400 uppercase">{logDate ? format(logDate, 'd MMM yy') : '-'}</p></td>
                        <td className="px-6 py-4"><div className="flex items-center gap-2.5"><div className="p-1.5 bg-slate-100 rounded-lg text-slate-400 group-hover:text-blue-600 transition-colors shrink-0"><Package size={13} /></div><div><p className="text-xs font-black text-slate-800 uppercase line-clamp-1">{l.productName}</p>{refId ? <Link href={refUrl || '#'} className="text-[10px] font-black text-blue-600 hover:underline flex items-center gap-0.5 mt-0.5 uppercase italic">#{refId} <ChevronRight size={8} /></Link> : <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 italic">{l.source}</p>}</div></div></td>
                        <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${l.type === 'MASUK' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{l.type === 'MASUK' ? '+' : '-'}{l.amount}</span></td>
                        <td className="px-6 py-4 text-xs font-black text-slate-500 whitespace-nowrap">{l.prevStock} <span className="text-slate-300">→</span> <span className="text-slate-900">{l.nextStock}</span></td>
                        <td className="px-6 py-4 text-right"><div className="flex items-center justify-end gap-1 text-slate-400"><User size={10} /><span className="text-[10px] font-black uppercase">{l.adminId?.substring(0, 8)}</span></div></td>
                      </tr>
                    );
                  })}
                  {activeTab === 'transaction' && filteredTx.map(t => {
                    const created = toDateOrNull(t.createdAt); const isSuccess = ['SELESAI', 'SUCCESS'].includes(String(t.status).toUpperCase());
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-all group">
                        <td className="px-6 py-4"><p className="text-xs font-black text-slate-800">{created ? format(created, 'HH:mm') : '-'}</p><p className="text-[10px] font-bold text-slate-400 uppercase">{created ? format(created, 'd MMM yy') : '-'}</p></td>
                        <td className="px-6 py-4"><Link href={`/admin/orders/${t.id}`} className="flex items-center gap-2.5 group/ref"><div className="p-1.5 bg-slate-100 rounded-lg text-slate-400 group-hover/ref:text-blue-600 transition-colors shrink-0"><Package size={13} /></div><div><p className="text-xs font-black text-slate-800 uppercase italic leading-none group-hover/ref:text-blue-600 transition-colors">#{t.id?.substring(0, 10)}</p><p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 flex items-center gap-0.5">Detail <ChevronRight size={8} /></p></div></Link></td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600">{t.customerName || 'Walk-in'}</td>
                        <td className="px-6 py-4 font-black text-xs text-slate-900 whitespace-nowrap">Rp {t.total?.toLocaleString('id-ID')}</td>
                        <td className="px-6 py-4 text-right"><span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${isSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{t.status}</span></td>
                      </tr>
                    );
                  })}
                  {activeTab === 'finance' && filteredShifts.map(s => {
                    const openedAt = coerceDate(s.openedAt); const closedAt = coerceDate(s.closedAt); const diff = Number(s.difference || 0);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-all">
                        <td className="px-6 py-4"><p className="text-xs font-black text-slate-800">{openedAt ? format(openedAt, 'HH:mm') : '-'}</p><p className="text-[10px] font-bold text-slate-400 uppercase">{openedAt ? format(openedAt, 'd MMM yy') : '-'}</p></td>
                        <td className="px-6 py-4">{closedAt ? <><p className="text-xs font-black text-slate-800">{format(closedAt, 'HH:mm')}</p><p className="text-[10px] font-bold text-slate-400 uppercase">{format(closedAt, 'd MMM yy')}</p></> : <span className="px-2 py-1 rounded-full text-[10px] font-black text-emerald-600 bg-emerald-50 uppercase">● Aktif</span>}</td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">{s.cashierName}</td>
                        <td className="px-6 py-4 font-black text-xs text-slate-900 whitespace-nowrap">Rp {Number(s.expectedCash || 0).toLocaleString('id-ID')}</td>
                        <td className="px-6 py-4 text-right"><span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${diff === 0 ? 'bg-slate-50 text-slate-400' : diff > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{diff > 0 ? '+' : ''}{diff.toLocaleString('id-ID')}</span></td>
                      </tr>
                    );
                  })}
                  {activeTab === 'capital' && filteredCapital.map(c => {
                    const dateObj = toDateOrNull(c.date) || new Date();
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition-all">
                        <td className="px-6 py-4"><p className="text-xs font-black text-slate-800">{format(dateObj, 'HH:mm')}</p><p className="text-[10px] font-bold text-slate-400 uppercase">{format(dateObj, 'd MMM yy')}</p></td>
                        <td className="px-6 py-4 font-black text-xs text-slate-800 uppercase">{c.referenceId || '-'}</td>
                        <td className="px-6 py-4"><span className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg ${c.transactionType === 'IN' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{c.type}</span></td>
                        <td className={`px-6 py-4 font-black text-xs whitespace-nowrap ${c.transactionType === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>{c.transactionType === 'IN' ? '+' : '-'}Rp {c.amount?.toLocaleString('id-ID')}</td>
                        <td className="px-6 py-4 text-right font-bold text-xs text-slate-400 uppercase">{c.executorName || 'Admin'}</td>
                      </tr>
                    );
                  })}
                  {activeTab === 'tax' && filteredTax.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-all">
                      <td className="px-6 py-4"><p className="text-xs font-black text-slate-800">{format(t.date, 'HH:mm')}</p><p className="text-[10px] font-bold text-slate-400 uppercase">{format(t.date, 'd MMM yy')}</p></td>
                      <td className="px-6 py-4 font-mono text-xs font-black text-slate-600 uppercase">{t.orderId?.substring(0, 12)}</td>
                      <td className="px-6 py-4"><p className="font-black text-xs text-slate-900 line-clamp-1">{t.product}</p><span className="text-[10px] text-slate-400 font-bold uppercase">{t.category}</span></td>
                      <td className="px-6 py-4 text-xs font-black text-slate-900 whitespace-nowrap">Rp {t.sales?.toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4 text-xs font-bold text-blue-700 whitespace-nowrap">Rp {t.dpp?.toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4 text-right"><p className={`font-black text-sm ${t.isExempt ? 'text-amber-500' : 'text-indigo-600'}`}>{t.isExempt ? 'Rp 0' : `Rp ${t.taxAmount?.toLocaleString('id-ID')}`}</p><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.isExempt ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-500'}`}>{t.taxLabel}</span></td>
                    </tr>
                  ))}
                  {activeTab === 'profit' && filteredProfit.map(p => {
                    const profitDate = toDateOrNull(p.date);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-all">
                        <td className="px-6 py-4"><p className="text-xs font-black text-slate-800">{profitDate ? format(profitDate, 'HH:mm') : '-'}</p><p className="text-[10px] font-bold text-slate-400 uppercase">{profitDate ? format(profitDate, 'd MMM yy') : '-'}</p></td>
                        <td className="px-6 py-4 font-black text-xs text-slate-500 uppercase">#{p.id?.substring(0, 10)}</td>
                        <td className="px-6 py-4 text-xs font-black text-slate-900 whitespace-nowrap">Rp {p.sales?.toLocaleString('id-ID')}</td>
                        <td className="px-6 py-4 text-xs font-bold text-rose-500 whitespace-nowrap">-Rp {p.cost?.toLocaleString('id-ID')}</td>
                        <td className={`px-6 py-4 text-right font-black text-sm whitespace-nowrap ${p.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{p.profit >= 0 ? '+' : ''}Rp {p.profit?.toLocaleString('id-ID')}</td>
                      </tr>
                    );
                  })}
                  {activeTab === 'cost' && filteredCost.map(c => {
                    const changeDate = toDateOrNull(c.changeDate); const delta = (c.newCost || 0) - (c.oldCost || 0);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition-all">
                        <td className="px-6 py-4"><p className="text-xs font-black text-slate-800">{changeDate ? format(changeDate, 'HH:mm') : '-'}</p><p className="text-[10px] font-bold text-slate-400 uppercase">{changeDate ? format(changeDate, 'd MMM yy') : '-'}</p></td>
                        <td className="px-6 py-4 font-black text-xs text-slate-800 uppercase">{c.productName}</td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-400 whitespace-nowrap">Rp {c.oldCost?.toLocaleString('id-ID')}</td>
                        <td className="px-6 py-4 text-xs font-black text-slate-900 whitespace-nowrap">Rp {c.newCost?.toLocaleString('id-ID')}</td>
                        <td className="px-6 py-4 text-right"><span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${delta >= 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{delta > 0 ? '+' : ''}{delta?.toLocaleString('id-ID')}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card view */}
            <div className="sm:hidden p-3 space-y-2">
              {activeTab === 'stock' && filteredStock.map(l => {
                const logDate = toDateOrNull(l.date); const refIdMatch = l.note?.match(/#([A-Za-z0-9]+)/); const refId = refIdMatch ? refIdMatch[1] : null;
                return (
                  <div key={l.id} className="bg-slate-50/70 rounded-2xl p-3.5 flex items-start gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${l.type === 'MASUK' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{l.type === 'MASUK' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-xs text-slate-900 truncate uppercase">{l.productName}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${l.type === 'MASUK' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{l.type === 'MASUK' ? '+' : '-'}{l.amount}</span>
                        <span className="text-[10px] text-slate-400 font-bold">{l.prevStock} → {l.nextStock}</span>
                        {refId && <Link href={`/admin/orders/${refId}`} className="text-[10px] font-black text-blue-600">#{refId}</Link>}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold shrink-0">{logDate ? format(logDate, 'HH:mm') : '-'}</p>
                  </div>
                );
              })}
              {activeTab === 'transaction' && filteredTx.map(t => {
                const created = toDateOrNull(t.createdAt); const isSuccess = ['SELESAI', 'SUCCESS'].includes(String(t.status).toUpperCase());
                return (
                  <div key={t.id} className="bg-slate-50/70 rounded-2xl p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <Link href={`/admin/orders/${t.id}`} className="text-xs font-black text-blue-600 uppercase italic">#{t.id?.substring(0, 10)}</Link>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${isSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{t.status}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-slate-500 font-bold">{t.customerName || 'Walk-in'}</p>
                      <p className="text-xs font-black text-slate-900">Rp {t.total?.toLocaleString('id-ID')}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">{created ? format(created, 'Pp') : '-'}</p>
                  </div>
                );
              })}
              {activeTab === 'finance' && filteredShifts.map(s => {
                const openedAt = coerceDate(s.openedAt); const closedAt = coerceDate(s.closedAt); const diff = Number(s.difference || 0);
                return (
                  <div key={s.id} className="bg-slate-50/70 rounded-2xl p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-black text-slate-800 uppercase">{s.cashierName}</p>
                      {closedAt ? <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Selesai</span> : <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">● Aktif</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-slate-400 font-bold">Kas: Rp {Number(s.expectedCash || 0).toLocaleString('id-ID')}</p>
                      <span className={`text-xs font-black ${diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diff > 0 ? '+' : ''}{diff.toLocaleString('id-ID')}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">{openedAt ? format(openedAt, 'Pp') : '-'}</p>
                  </div>
                );
              })}
              {activeTab === 'capital' && filteredCapital.map(c => {
                const dateObj = toDateOrNull(c.date) || new Date();
                return (
                  <div key={c.id} className="bg-slate-50/70 rounded-2xl p-3.5 flex items-start gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${c.transactionType === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{c.transactionType === 'IN' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate uppercase">{c.type}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">{c.referenceId || '-'} · {c.executorName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-black ${c.transactionType === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>{c.transactionType === 'IN' ? '+' : '-'}Rp {c.amount?.toLocaleString('id-ID')}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{format(dateObj, 'd MMM yy')}</p>
                    </div>
                  </div>
                );
              })}
              {activeTab === 'tax' && filteredTax.map(t => (
                <div key={t.id} className="bg-slate-50/70 rounded-2xl p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0"><p className="text-xs font-black text-slate-900 truncate">{t.product}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{t.category}</p></div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${t.isExempt ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>{t.taxLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-400 font-bold">DPP: Rp {t.dpp?.toLocaleString('id-ID')}</p>
                    <p className={`text-xs font-black ${t.isExempt ? 'text-amber-500' : 'text-indigo-600'}`}>{t.isExempt ? 'Rp 0' : `Rp ${t.taxAmount?.toLocaleString('id-ID')}`}</p>
                  </div>
                </div>
              ))}
              {activeTab === 'profit' && filteredProfit.map(p => {
                const profitDate = toDateOrNull(p.date);
                return (
                  <div key={p.id} className="bg-slate-50/70 rounded-2xl p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-black text-slate-500 uppercase italic">#{p.id?.substring(0, 10)}</p>
                      <p className={`text-sm font-black ${p.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{p.profit >= 0 ? '+' : ''}Rp {p.profit?.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-slate-400 font-bold">Modal: Rp {p.cost?.toLocaleString('id-ID')}</p>
                      <p className="text-xs font-black text-slate-900">Rp {p.sales?.toLocaleString('id-ID')}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">{profitDate ? format(profitDate, 'Pp') : '-'}</p>
                  </div>
                );
              })}
              {activeTab === 'cost' && filteredCost.map(c => {
                const changeDate = toDateOrNull(c.changeDate); const delta = (c.newCost || 0) - (c.oldCost || 0);
                return (
                  <div key={c.id} className="bg-slate-50/70 rounded-2xl p-3.5 flex items-start gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${delta >= 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>{delta >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate uppercase">{c.productName}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">Rp {c.oldCost?.toLocaleString('id-ID')} → Rp {c.newCost?.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs font-black ${delta >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{delta > 0 ? '+' : ''}{delta?.toLocaleString('id-ID')}</span>
                      <p className="text-[10px] text-slate-400 font-bold">{changeDate ? format(changeDate, 'd MMM yy') : '-'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {!loading && currentCount > 0 && (
        <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-5">
          Menampilkan {currentCount} dari maks. {limitCount} data · Gunakan filter tanggal atau perbesar limit
        </p>
      )}
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>}>
      <AuditPageContent />
    </Suspense>
  );
}
