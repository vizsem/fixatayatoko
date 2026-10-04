'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import {
  History, ArrowLeftRight, Wallet, Search, Download, User, Package,
  Landmark, ChevronRight, BarChart3, TrendingUp, Receipt, FileX,
  ChevronDown, RefreshCw, AlertTriangle
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

  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [stockLogs, setStockLogs] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [profitLogs, setProfitLogs] = useState<any[]>([]);
  const [costLogs, setCostLogs] = useState<any[]>([]);
  const [capitalLogs, setCapitalLogs] = useState<any[]>([]);
  const [taxLogs, setTaxLogs] = useState<any[]>([]);
  const [profitSummary, setProfitSummary] = useState({
    sales: 0, cost: 0, profit: 0, discount: 0,
    expenses: 0, netProfit: 0, labaEstimasi: 0, itemEstimasi: 0,
  });
  const [taxSummary, setTaxSummary] = useState({ totalSales: 0, dpp: 0, taxAmount: 0 });

  useEffect(() => {
    const checkAuth = async () => {
      const { user, isAdmin } = await getUserAndRole();
      if (!user) return router.push('/profil/login');
      if (!isAdmin) {
        notify.aksesDitolakAdmin?.();
        return router.push('/profil');
      }
    };
    checkAuth();
    let unsubAuth: (() => void) | undefined;
    (async () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') checkAuth();
      });
      unsubAuth = () => subscription.unsubscribe();
    })();
    return () => { if (unsubAuth) unsubAuth(); };
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(startDate); start.setHours(0, 0, 0, 0);
      const end = new Date(endDate); end.setHours(23, 59, 59, 999);

      if (activeTab === 'stock') {
        const { data, error } = await supabase
          .from('inventory_logs')
          .select('*')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at', { ascending: false })
          .limit(limitCount);
        if (error) throw error;
        setStockLogs(
          (data || []).map((row: any) => {
            const raw = row.raw_data || {};
            const logDate = row.created_at || raw.createdAt || raw.date;
            const pName = row.product_name || raw.productName || raw.product_name || 'Produk';
            const prev = Number(row.prev_stock ?? raw.prevStock ?? 0);
            const next = Number(row.next_stock ?? raw.nextStock ?? 0);
            const amt = Math.abs(Number(row.amount ?? row.quantity ?? raw.amount ?? raw.quantity ?? 0));
            const adm = row.admin_id || raw.adminId || 'System';
            return {
              id: row.id,
              ...raw,
              ...row,
              productName: pName,
              amount: amt,
              prevStock: prev,
              nextStock: next,
              adminId: adm,
              type: (row.type || raw.type || 'MASUK').toUpperCase(),
              source: (row.source || raw.source || 'MANUAL').toUpperCase(),
              note: row.note || raw.note || raw.notes || '',
              date: logDate,
            };
          })
        );

      } else if (activeTab === 'transaction') {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at', { ascending: false })
          .limit(limitCount);
        if (error) throw error;
        setTransactions((data || []).map((row: any) => ({ ...row, createdAt: row.created_at || row.createdAt })));

      } else if (activeTab === 'finance') {
        // Server-side date filtering
        const { data: shiftRows, error } = await supabase
          .from('cashier_shifts')
          .select('*')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at', { ascending: false })
          .limit(limitCount);
        if (error) throw error;
        setShifts((shiftRows || []).map((row: any) => {
          const raw = row.raw_data || {};
          return {
            ...row,
            cashierName: raw.cashierName || row.cashierName || row.cashier_name || 'Kasir',
            expectedCash: Number(raw.expectedCash ?? row.expectedCash ?? row.expected_cash ?? 0),
            difference: Number(raw.difference ?? row.difference ?? 0),
            openedAt: raw.openedAt || row.openedAt || row.opened_at || row.created_at || raw.createdAt,
            closedAt: raw.closedAt || row.closedAt || row.closed_at || null,
          };
        }));

      } else if (activeTab === 'profit') {
        const [ordersRes, expensesRes] = await Promise.all([
          supabase.from('orders').select('*').in('status', ['SELESAI', 'SUCCESS'])
            .gte('created_at', start.toISOString()).lte('created_at', end.toISOString()),
          supabase.from('operational_expenses').select('*')
            .gte('date', start.toISOString()).lte('date', end.toISOString()),
        ]);
        if (ordersRes.error) throw ordersRes.error;
        if (expensesRes.error) throw expensesRes.error;

        const oDocs = ordersRes.data || [];
        const eDocs = expensesRes.data || [];
        let tS = 0, tC = 0, tD = 0, tE = 0, tEstimasi = 0, nEstimasi = 0;
        eDocs.forEach(d => tE += (Number(d.amount || d.raw_data?.amount || 0)));

        const produkSnap = await sbGetDocs({ table: 'products', columns: PRODUK_RINGKAS });
        const produkMap = new Map<string, any>();
        produkSnap.docs.forEach(ps => produkMap.set(ps.id, keBentukProdukHpp(ps.data())));

        const logs = oDocs.map((d: any) => {
          const data = d.raw_data || d;
          const items = Array.isArray(d.items) ? d.items : (data.items || []);
          const { ringkasan } = hitungItemOrder({ items, produkDari: (pid) => produkMap.get(pid) });
          const pendapatan = ringkasan.itemTotal > 0 ? ringkasan.pendapatan : Number(d.total || data.total || 0);
          const oC = ringkasan.hppDipercaya + ringkasan.hppEstimasi;
          const oD = items.reduce((s: number, i: any) => s + Math.max(0, ((Number(i.originalPrice || i.price || 0)) - Number(i.price || 0)) * (Number(i.quantity || 1))), 0);
          tS += pendapatan; tC += oC; tD += oD;
          tEstimasi += ringkasan.labaEstimasi;
          nEstimasi += ringkasan.itemEstimasi;
          return {
            id: d.id,
            date: d.created_at || d.createdAt || data.createdAt,
            sales: pendapatan, cost: oC, profit: pendapatan - oC,
            labaEstimasi: ringkasan.labaEstimasi, itemEstimasi: ringkasan.itemEstimasi,
          };
        });
        setProfitLogs(logs);
        setProfitSummary({ sales: tS, cost: tC, profit: tS - tC, discount: tD, expenses: tE, netProfit: tS - tC - tE, labaEstimasi: tEstimasi, itemEstimasi: nEstimasi });

      } else if (activeTab === 'cost') {
        const { data, error } = await supabase
          .from('product_cost_logs')
          .select('*')
          .gte('changeDate', start.toISOString())
          .lte('changeDate', end.toISOString())
          .order('changeDate', { ascending: false })
          .limit(limitCount);
        if (error) throw error;
        setCostLogs((data || []).map((row: any) => ({ ...row, changeDate: row.changeDate || row.change_date || row.created_at })));

      } else if (activeTab === 'capital') {
        // Server-side date filtering
        const { data: capData, error } = await supabase
          .from('capital_transactions')
          .select('*')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at', { ascending: false })
          .limit(limitCount);
        if (error) throw error;
        setCapitalLogs((capData || []).map(c => {
          const raw = c.raw_data || {};
          return {
            id: c.id,
            date: raw.date ? new Date(raw.date) : new Date(c.created_at),
            type: raw.type === 'INJECTION' ? 'INJEKSI MODAL' : 'PENARIKAN / PRIVE',
            transactionType: raw.type === 'INJECTION' ? 'IN' : 'OUT',
            amount: raw.amount || 0,
            referenceId: raw.description || '-',
            executorName: raw.recordedBy || 'Admin',
          };
        }));

      } else if (activeTab === 'tax') {
        // Server-side date filtering instead of client-side loop
        const [ordersRes, sSnap] = await Promise.all([
          supabase.from('orders').select('*').in('status', ['SELESAI', 'SUCCESS'])
            .gte('created_at', start.toISOString()).lte('created_at', end.toISOString()),
          sbGetDocs({ table: 'settings' }),
        ]);
        if (ordersRes.error) throw ordersRes.error;

        let taxSettings = DEFAULT_TAX_SETTINGS;
        sSnap.docs.forEach(d => { if (d.id === 'system' && d.data()?.tax) taxSettings = { ...DEFAULT_TAX_SETTINGS, ...d.data().tax }; });

        const oDocs = ordersRes.data || [];
        const tLogs: any[] = [];
        let sumSales = 0, sumDPP = 0, sumTax = 0;

        oDocs.forEach((d: any) => {
          const data = d.raw_data || d;
          const created = toDateOrNull(d.created_at || d.createdAt || data.createdAt) || new Date();
          const items = Array.isArray(d.items) ? d.items : (data.items || []);
          items.forEach((item: any) => {
            const itemTotal = Number(item.price || 0) * Number(item.quantity || 1);
            const breakdown = calculateTaxBreakdown({
              amount: itemTotal,
              category: item.category || item.Kategori || 'UMUM',
              taxSettings,
            });
            sumSales += itemTotal; sumDPP += breakdown.dpp; sumTax += breakdown.taxAmount;
            tLogs.push({
              id: `${d.id}_${item.id || item.productId}`,
              orderId: data.orderId || d.id,
              date: created,
              customer: data.customerName || 'Pelanggan',
              product: item.name || 'Produk',
              category: item.category || item.Kategori || 'UMUM',
              sales: itemTotal, dpp: breakdown.dpp, taxAmount: breakdown.taxAmount,
              taxLabel: breakdown.taxLabel, isExempt: breakdown.isExempt,
            });
          });
        });

        setTaxLogs(tLogs);
        setTaxSummary({ totalSales: sumSales, dpp: sumDPP, taxAmount: sumTax });
      }
    } catch (err) {
      Sentry.captureException(err);
      notify.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, startDate, endDate, limitCount]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Export tersedia untuk semua tab
  const handleExport = async () => {
    let data: any[] = [];
    if (activeTab === 'stock') {
      data = stockLogs.map(l => {
        const d = toDateOrNull(l.date) || new Date();
        return { Tanggal: format(d, 'Pp'), Produk: l.productName, Tipe: l.type, Qty: l.amount, Sisa: l.nextStock, Admin: l.adminId };
      });
    } else if (activeTab === 'transaction') {
      data = transactions.map(t => {
        const d = toDateOrNull(t.createdAt) || new Date();
        return { Tanggal: format(d, 'Pp'), ID: t.id, Customer: t.customerName, Total: t.total, Status: t.status };
      });
    } else if (activeTab === 'finance') {
      data = shifts.map(s => {
        const o = toDateOrNull(s.openedAt); const c = toDateOrNull(s.closedAt);
        return { Dibuka: o ? format(o, 'Pp') : '-', Ditutup: c ? format(c, 'Pp') : 'Aktif', Kasir: s.cashierName, EstimasiSaldo: s.expectedCash, Selisih: s.difference };
      });
    } else if (activeTab === 'profit') {
      data = profitLogs.map(p => {
        const d = toDateOrNull(p.date) || new Date();
        return { Tanggal: format(d, 'Pp'), ID: p.id, Pendapatan: p.sales, HPP: p.cost, Laba: p.profit };
      });
    } else if (activeTab === 'cost') {
      data = costLogs.map(c => {
        const d = toDateOrNull(c.changeDate) || new Date();
        return { Tanggal: format(d, 'Pp'), Produk: c.productName, 'HPP Lama': c.oldCost, 'HPP Baru': c.newCost, Perubahan: c.newCost - c.oldCost };
      });
    } else if (activeTab === 'capital') {
      data = capitalLogs.map(c => {
        const d = toDateOrNull(c.date) || new Date();
        return { Tanggal: format(d, 'Pp'), Referensi: c.referenceId, Tipe: c.type, Nominal: c.amount, Oleh: c.executorName };
      });
    } else if (activeTab === 'tax') {
      data = taxLogs.map(t => ({
        Tanggal: format(toDateOrNull(t.date) || new Date(), 'Pp'),
        Nota: t.orderId, Customer: t.customer, Produk: t.product,
        Kategori: t.category, Omzet: t.sales, DPP: t.dpp, Pajak: t.taxAmount, Status: t.taxLabel,
      }));
    }

    if (data.length === 0) { notify.error('Tidak ada data untuk diekspor'); return; }

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab);
    XLSX.writeFile(wb, `Audit_${activeTab}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const tabs = [
    { id: 'stock', label: 'Riwayat Stok', icon: Package },
    { id: 'transaction', label: 'Transaksi', icon: ArrowLeftRight },
    { id: 'finance', label: 'Sesi Kasir', icon: Wallet },
    { id: 'capital', label: 'Arus Modal', icon: Landmark },
    { id: 'tax', label: 'Audit Pajak', icon: Receipt },
    { id: 'profit', label: 'Laba Rugi', icon: TrendingUp },
    { id: 'cost', label: 'Perubahan HPP', icon: BarChart3 },
  ];

  // Filtered data per tab
  const filteredStock = stockLogs.filter(l => (l.productName || l.note || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredTx = transactions.filter(t => t.id?.toLowerCase().includes(searchTerm.toLowerCase()) || t.customerName?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredShifts = shifts.filter(s => s.cashierName?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredProfit = profitLogs.filter(p => p.id?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredCost = costLogs.filter(c => c.productName?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredCapital = capitalLogs.filter(c => c.referenceId?.toLowerCase().includes(searchTerm.toLowerCase()) || c.type?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredTax = taxLogs.filter(t => t.product?.toLowerCase().includes(searchTerm.toLowerCase()) || t.orderId?.toLowerCase().includes(searchTerm.toLowerCase()));

  const currentCount = {
    stock: filteredStock.length,
    transaction: filteredTx.length,
    finance: filteredShifts.length,
    profit: filteredProfit.length,
    cost: filteredCost.length,
    capital: filteredCapital.length,
    tax: filteredTax.length,
  }[activeTab] ?? 0;

  return (
    <div className="p-3 md:p-6 bg-[#F8FAFC] min-h-screen">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <History className="text-blue-600" size={32} /> Audit Terpusat
            </h1>
            <p className="text-slate-400 text-xs font-black uppercase tracking-[0.3em] mt-1">Pencatatan & Riwayat Sistem</p>
          </div>

          {/* Tab bar - scrollable on mobile */}
          <div className="w-full lg:w-auto">
            <div
              className="bg-white p-1 rounded-2xl border border-slate-100 flex gap-1 shadow-sm overflow-x-auto"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#e2e8f0 transparent' }}
            >
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setActiveTab(t.id as any); setSearchTerm(''); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-tight transition-all whitespace-nowrap shrink-0 ${activeTab === t.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}
                >
                  <t.icon size={13} /> {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Controls bar */}
        <div className="bg-white p-3 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 lg:max-w-xs">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input
              type="text"
              placeholder="Cari data..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-2xl text-xs font-bold outline-none focus:bg-slate-100 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Date range */}
          <div className="flex bg-slate-50 rounded-2xl p-1 gap-1 items-center shrink-0">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-xs font-black p-2 outline-none cursor-pointer" />
            <span className="text-slate-300 text-xs font-black px-1">—</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-xs font-black p-2 outline-none cursor-pointer" />
          </div>

          {/* Limit selector */}
          <div className="relative shrink-0">
            <select
              value={limitCount}
              onChange={e => setLimitCount(Number(e.target.value))}
              className="appearance-none bg-slate-50 border-none text-xs font-black px-4 py-3 pr-8 rounded-2xl outline-none cursor-pointer"
            >
              <option value={25}>25 data</option>
              <option value={50}>50 data</option>
              <option value={100}>100 data</option>
              <option value={250}>250 data</option>
              <option value={500}>500 data</option>
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all shrink-0 disabled:opacity-50"
            title="Muat ulang data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <div className="flex-1 hidden lg:block" />

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={loading || currentCount === 0}
            className="px-6 py-3 bg-emerald-50 text-emerald-600 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-100 shadow-sm hover:bg-emerald-100 transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={14} /> EXPORT DATA
          </button>
        </div>
      </div>

      {/* Summary cards - Laba */}
      {activeTab === 'profit' && !loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard label="Penjualan Kotor" value={profitSummary.sales} color="text-slate-900" />
          <SummaryCard label="Total HPP" value={profitSummary.cost} color="text-rose-600" prefix="-" />
          <SummaryCard label="Biaya Operasional" value={profitSummary.expenses} color="text-amber-600" prefix="-" />
          <div className={`p-6 rounded-[2rem] border ${profitSummary.netProfit >= 0 ? 'bg-emerald-600 border-emerald-500' : 'bg-rose-600 border-rose-500'} text-white shadow-xl`}>
            <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Laba Bersih</p>
            <p className="text-2xl font-black">Rp {profitSummary.netProfit.toLocaleString('id-ID')}</p>
            {profitSummary.itemEstimasi > 0 && (
              <p className="text-[10px] font-bold opacity-80 mt-2 leading-tight flex items-start gap-1">
                <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                {profitSummary.itemEstimasi} item tanpa Modal · perkiraan Rp {Math.round(profitSummary.labaEstimasi).toLocaleString('id-ID')} ikut terhitung — angka belum akurat.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Summary cards - Pajak */}
      {activeTab === 'tax' && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Total Omzet (Inkl. Pajak)</p>
            <p className="text-2xl font-black text-slate-900">Rp {taxSummary.totalSales.toLocaleString('id-ID')}</p>
            <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">{taxLogs.length} item terjual</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2">DPP (Dasar Pengenaan Pajak)</p>
            <p className="text-2xl font-black text-blue-700">Rp {taxSummary.dpp.toLocaleString('id-ID')}</p>
            <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Harga sebelum pajak</p>
          </div>
          <div className="bg-indigo-600 p-6 rounded-[2rem] shadow-xl text-white">
            <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Total Pajak Terutang</p>
            <p className="text-2xl font-black">Rp {taxSummary.taxAmount.toLocaleString('id-ID')}</p>
            <p className="text-xs opacity-60 font-bold mt-1 uppercase tracking-widest">PPN / PPh yang harus disetorkan</p>
          </div>
        </div>
      )}

      {/* Info bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
          {loading ? 'Memuat data...' : `${currentCount} data ditemukan`}
        </p>
        {!loading && currentCount >= limitCount && (
          <p className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
            <AlertTriangle size={12} /> Batas {limitCount} data — perbesar limit atau sempitkan rentang tanggal
          </p>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8"><TableSkeleton rows={10} /></div>
        ) : currentCount === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="p-5 bg-slate-50 rounded-3xl">
              <FileX size={36} className="text-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Tidak Ada Data</p>
              <p className="text-xs text-slate-300 font-bold mt-1">
                {searchTerm ? `Tidak ada hasil untuk "${searchTerm}"` : 'Belum ada data dalam rentang tanggal ini'}
              </p>
            </div>
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-xs font-black text-blue-600 hover:underline uppercase tracking-widest">
                Hapus pencarian
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-slate-50 text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 sticky top-0 z-10">
                {activeTab === 'stock' && (
                  <tr>
                    <th className="px-6 py-5 whitespace-nowrap">Waktu</th>
                    <th className="px-6 py-5 whitespace-nowrap">Nama Produk</th>
                    <th className="px-6 py-5 whitespace-nowrap">Mutasi</th>
                    <th className="px-6 py-5 whitespace-nowrap">Sisa Saldo</th>
                    <th className="px-6 py-5 text-right whitespace-nowrap">Oleh</th>
                  </tr>
                )}
                {activeTab === 'transaction' && (
                  <tr>
                    <th className="px-6 py-5 whitespace-nowrap">Dibuat Pada</th>
                    <th className="px-6 py-5 whitespace-nowrap">Referensi Pesanan</th>
                    <th className="px-6 py-5 whitespace-nowrap">Pelanggan</th>
                    <th className="px-6 py-5 whitespace-nowrap">Pendapatan</th>
                    <th className="px-6 py-5 text-right whitespace-nowrap">Status</th>
                  </tr>
                )}
                {activeTab === 'finance' && (
                  <tr>
                    <th className="px-6 py-5 whitespace-nowrap">Dibuka</th>
                    <th className="px-6 py-5 whitespace-nowrap">Ditutup</th>
                    <th className="px-6 py-5 whitespace-nowrap">Kasir</th>
                    <th className="px-6 py-5 whitespace-nowrap">Estimasi Saldo</th>
                    <th className="px-6 py-5 text-right whitespace-nowrap">Selisih</th>
                  </tr>
                )}
                {activeTab === 'capital' && (
                  <tr>
                    <th className="px-6 py-5 whitespace-nowrap">Tanggal</th>
                    <th className="px-6 py-5 whitespace-nowrap">Referensi</th>
                    <th className="px-6 py-5 whitespace-nowrap">Tipe</th>
                    <th className="px-6 py-5 whitespace-nowrap">Nominal</th>
                    <th className="px-6 py-5 text-right whitespace-nowrap">Oleh</th>
                  </tr>
                )}
                {activeTab === 'cost' && (
                  <tr>
                    <th className="px-6 py-5 whitespace-nowrap">Tanggal</th>
                    <th className="px-6 py-5 whitespace-nowrap">Produk</th>
                    <th className="px-6 py-5 whitespace-nowrap">HPP Lama</th>
                    <th className="px-6 py-5 whitespace-nowrap">HPP Baru</th>
                    <th className="px-6 py-5 text-right whitespace-nowrap">Perubahan</th>
                  </tr>
                )}
                {activeTab === 'tax' && (
                  <tr>
                    <th className="px-6 py-5 whitespace-nowrap">Tanggal</th>
                    <th className="px-6 py-5 whitespace-nowrap">No. Nota</th>
                    <th className="px-6 py-5 whitespace-nowrap">Produk / Kategori</th>
                    <th className="px-6 py-5 whitespace-nowrap">Omzet (Inkl. Pajak)</th>
                    <th className="px-6 py-5 whitespace-nowrap">DPP</th>
                    <th className="px-6 py-5 text-right whitespace-nowrap">Pajak Terutang</th>
                  </tr>
                )}
                {activeTab === 'profit' && (
                  <tr>
                    <th className="px-6 py-5 whitespace-nowrap">Tanggal</th>
                    <th className="px-6 py-5 whitespace-nowrap">ID Pesanan</th>
                    <th className="px-6 py-5 whitespace-nowrap">Pendapatan</th>
                    <th className="px-6 py-5 whitespace-nowrap">Total Modal</th>
                    <th className="px-6 py-5 text-right whitespace-nowrap">Laba</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-50">

                {/* STOCK */}
                {activeTab === 'stock' && filteredStock.map(l => {
                  const refIdMatch = l.note?.match(/#([A-Za-z0-9]+)/);
                  const refId = refIdMatch ? refIdMatch[1] : null;
                  const isReturn = l.note?.toLowerCase().includes('retur');
                  const refUrl = isReturn ? `/admin/returns` : (refId ? `/admin/orders/${refId}` : null);
                  const logDate = toDateOrNull(l.date);
                  return (
                    <tr key={l.id} className="hover:bg-slate-50/60 transition-all group">
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-slate-800">{logDate ? format(logDate, 'HH:mm') : '-'}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{logDate ? format(logDate, 'd MMM yyyy') : '-'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg text-slate-400 group-hover:text-blue-600 transition-colors shrink-0">
                            <Package size={15} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800 uppercase line-clamp-1">{l.productName}</p>
                            {refId ? (
                              <Link href={refUrl || '#'} className="text-[10px] font-black text-blue-600 hover:underline flex items-center gap-0.5 mt-0.5 uppercase italic">
                                #{refId} <ChevronRight size={8} />
                              </Link>
                            ) : (
                              <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 italic">{l.source}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${l.type === 'MASUK' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {l.type === 'MASUK' ? '+' : '-'}{l.amount}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-black text-slate-500 whitespace-nowrap">
                        {l.prevStock} <span className="text-slate-300">→</span> <span className="text-slate-900">{l.nextStock}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-slate-400">
                          <User size={11} />
                          <span className="text-[10px] font-black uppercase">{l.adminId?.substring(0, 8)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* TRANSACTION */}
                {activeTab === 'transaction' && filteredTx.map(t => {
                  const created = toDateOrNull(t.createdAt);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-all group">
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-slate-800">{created ? format(created, 'HH:mm') : '-'}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{created ? format(created, 'd MMM yyyy') : '-'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/admin/orders/${t.id}`} className="flex items-center gap-3 group/ref">
                          <div className="p-2 bg-slate-100 rounded-lg text-slate-400 group-hover/ref:text-blue-600 transition-colors shrink-0">
                            <Package size={15} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800 uppercase italic leading-none group-hover/ref:text-blue-600 transition-colors">#{t.id?.substring(0, 10)}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 flex items-center gap-1">
                              Lihat Detail <ChevronRight size={9} />
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-600">{t.customerName || 'Walk-in'}</td>
                      <td className="px-6 py-4 font-black text-xs text-slate-900 whitespace-nowrap">Rp {t.total?.toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${['SELESAI', 'SUCCESS'].includes(String(t.status).toUpperCase()) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {/* FINANCE */}
                {activeTab === 'finance' && filteredShifts.map(s => {
                  const openedAt = coerceDate(s.openedAt);
                  const closedAt = coerceDate(s.closedAt);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-all group">
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-slate-800">{openedAt ? format(openedAt, 'HH:mm') : '-'}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{openedAt ? format(openedAt, 'd MMM yyyy') : '-'}</p>
                      </td>
                      <td className="px-6 py-4">
                        {closedAt ? (
                          <>
                            <p className="text-xs font-black text-slate-800">{format(closedAt, 'HH:mm')}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(closedAt, 'd MMM yyyy')}</p>
                          </>
                        ) : <span className="px-2.5 py-1 rounded-full text-[10px] font-black text-emerald-600 bg-emerald-50 uppercase tracking-widest">● AKTIF</span>}
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">{s.cashierName}</td>
                      <td className="px-6 py-4 font-black text-xs text-slate-900 whitespace-nowrap">Rp {Number(s.expectedCash || 0).toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${Number(s.difference || 0) === 0 ? 'bg-slate-50 text-slate-400' : Number(s.difference || 0) > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {Number(s.difference || 0) > 0 ? '+' : ''}{Number(s.difference || 0).toLocaleString('id-ID')}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {/* CAPITAL */}
                {activeTab === 'capital' && filteredCapital.map(c => {
                  const dateObj = toDateOrNull(c.date) || new Date();
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-all group">
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-slate-800">{format(dateObj, 'HH:mm')}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(dateObj, 'd MMM yyyy')}</p>
                      </td>
                      <td className="px-6 py-4 font-black text-xs text-slate-800 uppercase">{c.referenceId || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${c.transactionType === 'IN' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{c.type}</span>
                      </td>
                      <td className={`px-6 py-4 font-black text-xs whitespace-nowrap ${c.transactionType === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {c.transactionType === 'IN' ? '+' : '-'}Rp {c.amount?.toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-xs text-slate-400 uppercase">{c.executorName || 'Admin'}</td>
                    </tr>
                  );
                })}

                {/* TAX */}
                {activeTab === 'tax' && filteredTax.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-all group">
                    <td className="px-6 py-4">
                      <p className="text-xs font-black text-slate-800">{format(t.date, 'HH:mm')}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(t.date, 'd MMM yyyy')}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-black text-slate-600 uppercase">{t.orderId?.substring(0, 12)}</td>
                    <td className="px-6 py-4">
                      <p className="font-black text-xs text-slate-900 line-clamp-1">{t.product}</p>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t.category}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-black text-slate-900 whitespace-nowrap">Rp {t.sales?.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4 text-xs font-bold text-blue-700 whitespace-nowrap">Rp {t.dpp?.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4 text-right">
                      <p className={`font-black text-sm ${t.isExempt ? 'text-amber-500' : 'text-indigo-600'}`}>
                        {t.isExempt ? 'Rp 0' : `Rp ${t.taxAmount?.toLocaleString('id-ID')}`}
                      </p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.isExempt ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-500'}`}>{t.taxLabel}</span>
                    </td>
                  </tr>
                ))}

                {/* PROFIT */}
                {activeTab === 'profit' && filteredProfit.map(p => {
                  const profitDate = toDateOrNull(p.date);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-all group">
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-slate-800">{profitDate ? format(profitDate, 'HH:mm') : '-'}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{profitDate ? format(profitDate, 'd MMM yyyy') : '-'}</p>
                      </td>
                      <td className="px-6 py-4 font-black text-xs text-slate-500 uppercase">#{p.id?.substring(0, 10)}</td>
                      <td className="px-6 py-4 text-xs font-black text-slate-900 whitespace-nowrap">Rp {p.sales?.toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4 text-xs font-bold text-rose-500 whitespace-nowrap">-Rp {p.cost?.toLocaleString('id-ID')}</td>
                      <td className={`px-6 py-4 text-right font-black text-sm whitespace-nowrap ${p.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {p.profit >= 0 ? '+' : ''}Rp {p.profit?.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  );
                })}

                {/* COST / HPP */}
                {activeTab === 'cost' && filteredCost.map(c => {
                  const changeDate = toDateOrNull(c.changeDate);
                  const delta = (c.newCost || 0) - (c.oldCost || 0);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-all group">
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-slate-800">{changeDate ? format(changeDate, 'HH:mm') : '-'}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{changeDate ? format(changeDate, 'd MMM yyyy') : '-'}</p>
                      </td>
                      <td className="px-6 py-4 font-black text-xs text-slate-800 uppercase">{c.productName}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-400 whitespace-nowrap">Rp {c.oldCost?.toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4 text-xs font-black text-slate-900 whitespace-nowrap">Rp {c.newCost?.toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${delta >= 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {delta > 0 ? '+' : ''}{delta?.toLocaleString('id-ID')}
                        </span>
                      </td>
                    </tr>
                  );
                })}

              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer info */}
      {!loading && currentCount > 0 && (
        <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-6">
          Menampilkan {currentCount} dari maks. {limitCount} data · Gunakan filter tanggal atau perbesar limit untuk data lebih banyak
        </p>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, prefix = '' }: { label: string; value: number; color: string; prefix?: string }) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
      <p className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2">{label}</p>
      <p className={`text-xl font-black ${color}`}>{prefix}Rp {value.toLocaleString('id-ID')}</p>
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-8">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      }
    >
      <AuditPageContent />
    </Suspense>
  );
}
