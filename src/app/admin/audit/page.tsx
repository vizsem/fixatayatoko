'use client';

import { Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import { 
  History, ArrowLeftRight, Wallet, Search, Download, AlertCircle, CheckCircle, Clock, User, Package, ArrowUpCircle, ArrowDownCircle, Landmark, ChevronRight, BarChart3, TrendingUp, Info, Receipt
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';
import * as Sentry from '@sentry/nextjs';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';
import { supabase } from '@/lib/supabase';
import { isAuthorizedAdmin } from '@/lib/auth-helpers';
import { getUserAndRole, sbGetDoc, sbGetDocs } from '@/lib/supabase-helpers';
import { Timestamp, auth, collection, db, getDocs, limit, orderBy, query, ref, where } from '@/lib/firebase';
import { calculateTaxBreakdown, DEFAULT_TAX_SETTINGS, TaxSettings } from '@/lib/tax';
import { hitungItemOrder, keBentukProdukHpp, PRODUK_RINGKAS } from '@/lib/hpp';
import { coerceDate, isWithinRange } from '@/lib/date-utils';

type AuditTab = 'stock' | 'transaction' | 'finance' | 'profit' | 'cost' | 'capital' | 'tax';

const toDateOrNull = (value: any) => coerceDate(value);
const fmtClock = (value: any) => {
  const date = toDateOrNull(value);
  return date ? format(date, 'HH:mm') : '-';
};
const fmtDay = (value: any) => {
  const date = toDateOrNull(value);
  return date ? format(date, 'd MMM yyyy') : '-';
};

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
    sales: 0,
    cost: 0,
    profit: 0,
    discount: 0,
    expenses: 0,
    netProfit: 0,
    /** Laba dari item yang produknya belum punya Modal (estimasi, bukan angka nyata). */
    labaEstimasi: 0,
    itemEstimasi: 0,
  });
  const [taxSummary, setTaxSummary] = useState({ totalSales: 0, dpp: 0, taxAmount: 0 });

  useEffect(() => {
    const __checkAuthunsubAuth = async () => {
      const { user, isAdmin } = await getUserAndRole();
      if (!user) return router.push('/profil/login');
      if (!isAdmin) {
        notify.aksesDitolakAdmin();
        return router.push('/profil');
      }
    };
    __checkAuthunsubAuth();
    let unsubAuth: (() => void) | undefined;
    (async () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        // HANYA saat sesi hilang; INITIAL_SESSION dipancarkan segera setelah
        // subscribe dan membuat seluruh data dimuat dua kali tiap halaman dibuka.
        if (event === 'SIGNED_OUT') __checkAuthunsubAuth();
      });
      unsubAuth = () => subscription.unsubscribe();
    })();
    return () => { if (unsubAuth) unsubAuth(); };
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let unsub: (() => void) | null = null;
    try {
      const start = new Date(startDate); start.setHours(0,0,0,0);
      const end = new Date(endDate); end.setHours(23,59,59,999);
      const startT = Timestamp.fromDate(start);
      const endT = Timestamp.fromDate(end);

      if (activeTab === 'stock') {
        const { data, error } = await supabase
          .from('inventory_logs')
          .select('*')
          .gte('date', start.toISOString())
          .lte('date', end.toISOString())
          .order('date', { ascending: false })
          .limit(limitCount);
        if (error) throw error;
        setStockLogs((data || []).map((row: any) => ({ ...row, date: row.date || row.created_at || row.createdAt })));
        setLoading(false);
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
        setLoading(false);
      } else if (activeTab === 'finance') {
        const { data: shiftRows, error } = await supabase
          .from('cashier_shifts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limitCount);

        if (error) throw error;

        const safeRows = (shiftRows || []).filter((row: any) => {
          const openedAt = row.openedAt || row.opened_at || row.raw_data?.openedAt || row.raw_data?.opened_at || row.created_at || row.createdAt;
          return isWithinRange(openedAt, start, end);
        });

        setShifts(safeRows.map((row: any) => {
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
        setLoading(false);
      } else if (activeTab === 'profit') {
        const [ordersRes, expensesRes] = await Promise.all([
          supabase
            .from('orders')
            .select('*')
            .in('status', ['SELESAI', 'SUCCESS'])
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString()),
          supabase
            .from('operational_expenses')
            .select('*')
            .gte('date', start.toISOString())
            .lte('date', end.toISOString()),
        ]);
        if (ordersRes.error) throw ordersRes.error;
        if (expensesRes.error) throw expensesRes.error;

        const oDocs = ordersRes.data || [];
        const eDocs = expensesRes.data || [];
        
        let tS = 0, tC = 0, tD = 0, tE = 0, tEstimasi = 0, nEstimasi = 0;
        eDocs.forEach(d => tE += (Number(d.amount || d.raw_data?.amount || 0)));

        // HPP memakai RUMUS YANG SAMA dengan Dashboard & Laporan Keuangan
        // (`src/lib/hpp.ts`). Sebelumnya halaman ini membaca `i.cost`/`i.modal`
        // yang TIDAK ADA di order marketplace, sehingga HPP dianggap Rp0 dan
        // laba tampil 100% dari penjualan.
        // Hanya kolom yang dipakai: `products` utuh = ±5 MB (raw_data +
        // image_url ikut terunduh), proyeksi ini ±570 KB untuk seluruh katalog.
        const produkSnap = await sbGetDocs({ table: 'products', columns: PRODUK_RINGKAS });
        const produkMap = new Map<string, any>();
        produkSnap.docs.forEach(ps => produkMap.set(ps.id, keBentukProdukHpp(ps.data())));

        const logs = oDocs.map((d: any) => {
           const data = d.raw_data || d;
           const items = Array.isArray(d.items) ? d.items : (data.items || []);

           const { ringkasan } = hitungItemOrder({
              items,
              produkDari: (pid) => produkMap.get(pid),
           });

           // Order tanpa baris item (data lama) jatuh ke total order.
           const pendapatan = ringkasan.itemTotal > 0 ? ringkasan.pendapatan : Number(d.total || data.total || 0);
           const oC = ringkasan.hppDipercaya + ringkasan.hppEstimasi;
           const oD = items.reduce((s: number, i: any) => s + Math.max(0, ((Number(i.originalPrice || i.price || 0)) - Number(i.price || 0)) * (Number(i.quantity || 1))), 0);

           tS += pendapatan; tC += oC; tD += oD;
           tEstimasi += ringkasan.labaEstimasi;
           nEstimasi += ringkasan.itemEstimasi;

           return {
              id: d.id,
              date: d.created_at || d.createdAt || data.createdAt,
              sales: pendapatan,
              cost: oC,
              profit: pendapatan - oC,
              labaEstimasi: ringkasan.labaEstimasi,
              itemEstimasi: ringkasan.itemEstimasi,
           };
        });
        setProfitLogs(logs);
        setProfitSummary({
           sales: tS,
           cost: tC,
           profit: (tS - tC),
           discount: tD,
           expenses: tE,
           netProfit: (tS - tC - tE),
           labaEstimasi: tEstimasi,
           itemEstimasi: nEstimasi,
        });
        setLoading(false);
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
        setLoading(false);
      } else if (activeTab === 'capital') {
        const { data: capData } = await supabase.from('capital_transactions').select('*').order('created_at', { ascending: false }).limit(limitCount);
        if (capData) {
          setCapitalLogs(capData.map(c => {
            const raw = c.raw_data || {};
            return {
              id: c.id,
              date: raw.date ? new Date(raw.date) : new Date(c.created_at),
              type: raw.type === 'INJECTION' ? 'INJEKSI MODAL' : 'PENARIKAN / PRIVE',
              transactionType: raw.type === 'INJECTION' ? 'IN' : 'OUT',
              amount: raw.amount || 0,
              referenceId: raw.description || '-',
              executorName: raw.recordedBy || 'Admin'
            };
          }));
        } else {
          setCapitalLogs([]);
        }
        setLoading(false);
      } else if (activeTab === 'tax') {
        // Audit Audit Pajak (PPN & PPh)
        const [ordersRes, sSnap] = await Promise.all([
          supabase
            .from('orders')
            .select('*')
            .in('status', ['SELESAI', 'SUCCESS']),
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
          if (created >= start && created <= end) {
            const items = Array.isArray(d.items) ? d.items : (data.items || []);
            items.forEach((item: any) => {
              const itemTotal = Number(item.price || 0) * Number(item.quantity || 1);
              const breakdown = calculateTaxBreakdown({
                amount: itemTotal,
                category: item.category || item.Kategori || 'UMUM',
                taxSettings
              });
              sumSales += itemTotal;
              sumDPP += breakdown.dpp;
              sumTax += breakdown.taxAmount;
              tLogs.push({
                id: `${d.id}_${item.id || item.productId}`,
                orderId: data.orderId || d.id,
                date: created,
                customer: data.customerName || 'Pelanggan',
                product: item.name || 'Produk',
                category: item.category || item.Kategori || 'UMUM',
                sales: itemTotal,
                dpp: breakdown.dpp,
                taxAmount: breakdown.taxAmount,
                taxLabel: breakdown.taxLabel,
                isExempt: breakdown.isExempt
              });
            });
          }
        });

        setTaxLogs(tLogs);
        setTaxSummary({ totalSales: sumSales, dpp: sumDPP, taxAmount: sumTax });
        setLoading(false);
      }
    } catch (err) {
      Sentry.captureException(err);
      notify.error("Gagal memuat data");
      setLoading(false);
    }
  }, [activeTab, startDate, endDate, limitCount]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    let data: any[] = [];
    if (activeTab === 'stock') data = stockLogs.map(l => {
      const d = toDateOrNull(l.date) || new Date();
      return { Tanggal: format(d, 'Pp'), Produk: l.productName, Tipe: l.type, Qty: l.amount, Sisa: l.nextStock, Admin: l.adminId };
    });
    else if (activeTab === 'transaction') data = transactions.map(t => {
      const d = toDateOrNull(t.createdAt) || new Date();
      return { Tanggal: format(d, 'Pp'), ID: t.id, Customer: t.customerName, Total: t.total, Status: t.status };
    });
    else if (activeTab === 'tax') data = taxLogs.map(t => ({ Tanggal: format(toDateOrNull(t.date) || new Date(), 'Pp'), Nota: t.orderId, Customer: t.customer, Produk: t.product, Kategori: t.category, Omzet: t.sales, DPP: t.dpp, Pajak: t.taxAmount, Status: t.taxLabel }));

    // `xlsx` (SheetJS) ±400 KB dan hanya dipakai saat tombol ekspor ditekan.
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab);
    XLSX.writeFile(wb, `Audit_${activeTab}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const tabs = [
    { id: 'stock', label: 'Riwayat Stok', icon: Package },
    { id: 'transaction', label: 'Transaksi Pesanan', icon: ArrowLeftRight },
    { id: 'finance', label: 'Sesi Kasir', icon: Wallet },
    { id: 'capital', label: 'Arus Modal', icon: Landmark },
    { id: 'tax', label: 'Audit Pajak', icon: Receipt },
    { id: 'profit', label: 'Laba Rugi', icon: TrendingUp },
    { id: 'cost', label: 'Perubahan HPP', icon: BarChart3 },
  ];

  return (
    <div className="p-3 md:p-6 bg-[#F8FAFC]">
      <Toaster position="top-right" />
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <History className="text-blue-600" size={32} /> Audit Terpusat
          </h1>
          <p className="text-slate-400 text-xs font-black uppercase tracking-[0.3em] mt-1">Pencatatan & Riwayat Sistem</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
           <div className="bg-white p-1 rounded-2xl border border-slate-100 flex gap-1 shadow-sm overflow-x-auto no-scrollbar">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-tight transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                   <t.icon size={14}/> {t.label}
                </button>
              ))}
           </div>
        </div>
      </div>

      <div className="bg-white p-3 rounded-[2.5rem] shadow-sm border border-slate-100 mb-8 flex flex-col lg:flex-row items-center gap-4">
        <div className="flex items-center gap-2 w-full lg:w-auto">
           <div className="relative flex-1 lg:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input type="text" placeholder="Cari data..." className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-2xl text-xs font-bold outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
           <div className="flex bg-slate-50 rounded-2xl p-1 gap-1">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-xs font-black p-2 outline-none" />
              <div className="w-[1px] bg-slate-200 my-2" />
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-xs font-black p-2 outline-none" />
           </div>
        </div>
        <div className="flex-1" />
        <button onClick={handleExport} className="px-6 py-3 bg-emerald-50 text-emerald-600 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-100 shadow-sm hover:bg-emerald-100 transition-all">
           <Download size={14}/> EXPORT DATA
        </button>
      </div>

      {activeTab === 'profit' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-in fade-in slide-in-from-top-4">
           <Stat label="Penjualan Kotor" val={profitSummary.sales} color="text-slate-900" />
           <Stat label="Total HPP" val={profitSummary.cost} color="text-rose-600" prefix="-" />
           <Stat label="Biaya Operasional" val={profitSummary.expenses} color="text-amber-600" prefix="-" />
           <div className={`p-6 rounded-[2rem] border ${profitSummary.netProfit >= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'} shadow-xl`}>
              <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Laba Bersih</p>
              <p className="text-2xl font-black">Rp {profitSummary.netProfit.toLocaleString()}</p>
              {profitSummary.itemEstimasi > 0 && (
                <p className="text-[10px] font-bold opacity-80 mt-2 leading-tight">
                  {profitSummary.itemEstimasi} item tanpa Modal · perkiraan Rp{' '}
                  {Math.round(profitSummary.labaEstimasi).toLocaleString('id-ID')} ikut terhitung —
                  angka ini belum akurat.
                </p>
              )}
           </div>
        </div>
      )}

      {activeTab === 'tax' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-in fade-in slide-in-from-top-4">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Total Omzet (Termasuk Pajak)</p>
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

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        {loading ? <div className="p-8"><TableSkeleton rows={10} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-slate-50 text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                  {activeTab === 'stock' && (
                    <tr>
                      <th className="px-8 py-5">Waktu</th>
                      <th className="px-8 py-5">Nama Produk</th>
                      <th className="px-8 py-5">Mutasi</th>
                      <th className="px-8 py-5">Sisa Saldo</th>
                      <th className="px-8 py-5 text-right">Oleh</th>
                    </tr>
                  )}
                  {activeTab === 'transaction' && (
                    <tr>
                      <th className="px-8 py-5">Dibuat Pada</th>
                      <th className="px-8 py-5">Referensi Pesanan</th>
                      <th className="px-8 py-5">Pelanggan</th>
                      <th className="px-8 py-5">Pendapatan</th>
                      <th className="px-8 py-5 text-right">Status</th>
                    </tr>
                  )}
                  {activeTab === 'finance' && (
                    <tr>
                      <th className="px-8 py-5">Dibuka</th>
                      <th className="px-8 py-5">Ditutup</th>
                      <th className="px-8 py-5">Kasir</th>
                      <th className="px-8 py-5">Estimasi Saldo</th>
                      <th className="px-8 py-5 text-right">Selisih</th>
                    </tr>
                  )}
                  {activeTab === 'capital' && (
                    <tr>
                      <th className="px-8 py-5">Tanggal</th>
                      <th className="px-8 py-5">Referensi</th>
                      <th className="px-8 py-5">Tipe</th>
                      <th className="px-8 py-5">Nominal</th>
                      <th className="px-8 py-5 text-right">Oleh</th>
                    </tr>
                  )}
                  {activeTab === 'cost' && (
                    <tr>
                      <th className="px-8 py-5">Tanggal</th>
                      <th className="px-8 py-5">Produk</th>
                      <th className="px-8 py-5">HPP Lama</th>
                      <th className="px-8 py-5">HPP Baru</th>
                      <th className="px-8 py-5 text-right">Perubahan</th>
                    </tr>
                  )}
                  {activeTab === 'tax' && (
                    <tr>
                      <th className="px-8 py-5">Tanggal</th>
                      <th className="px-8 py-5">No. Nota</th>
                      <th className="px-8 py-5">Produk / Kategori</th>
                      <th className="px-8 py-5">Omzet (Inkl. Pajak)</th>
                      <th className="px-8 py-5">DPP</th>
                      <th className="px-8 py-5 text-right">Pajak Terutang</th>
                    </tr>
                  )}
                  {activeTab === 'profit' && (
                    <tr>
                      <th className="px-8 py-5">Tanggal</th>
                      <th className="px-8 py-5">ID Pesanan</th>
                      <th className="px-8 py-5">Pendapatan</th>
                      <th className="px-8 py-5">Total Modal</th>
                      <th className="px-8 py-5 text-right">Laba</th>
                    </tr>
                  )}
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {activeTab === 'stock' && stockLogs.filter(l => l.productName?.toLowerCase().includes(searchTerm.toLowerCase())).map(l => {
                    const refIdMatch = l.note?.match(/#([A-Za-z0-9]+)/);
                    const refId = refIdMatch ? refIdMatch[1] : null;
                    const isReturn = l.note?.toLowerCase().includes('retur');
                    const refUrl = isReturn ? `/admin/returns` : (refId ? `/admin/orders/${refId}` : null);
                    const logDate = toDateOrNull(l.date);

                    return (
                      <tr key={l.id} className="hover:bg-slate-50/50 transition-all group">
                        <td className="px-8 py-5">
                            <p className="text-xs font-black text-slate-800">{logDate ? format(logDate, 'HH:mm') : '-'}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{logDate ? format(logDate, 'd MMM yyyy') : '-'}</p>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-lg text-slate-400 group-hover:text-blue-600 transition-colors">
                              <Package size={16} />
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-800 uppercase line-clamp-1">{l.productName}</p>
                              {refId ? (
                                <Link href={refUrl || '#'} className="text-xs font-black text-blue-600 hover:underline flex items-center gap-1 mt-1 uppercase italic leading-none">
                                  #{refId} <ChevronRight size={8} />
                                </Link>
                              ) : (
                                <p className="text-xs font-bold text-slate-400 uppercase mt-1 italic">{l.source}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${l.type === 'MASUK' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                              {l.type === 'MASUK' ? '+' : '-'}{l.amount}
                            </span>
                        </td>
                        <td className="px-8 py-5 text-xs font-black text-slate-500">{l.prevStock} &rarr; <span className="text-slate-900">{l.nextStock}</span></td>
                        <td className="px-8 py-5 text-right">
                            <div className="flex items-center justify-end gap-2 text-slate-400">
                              <User size={12}/> <span className="text-xs font-black uppercase">{l.adminId?.substring(0,8)}</span>
                            </div>
                        </td>
                      </tr>
                    );
                  })}
                  {activeTab === 'transaction' && transactions.filter(t => t.id?.toLowerCase().includes(searchTerm.toLowerCase()) || t.customerName?.toLowerCase().includes(searchTerm.toLowerCase())).map(t => {
                    const created = toDateOrNull(t.createdAt);
                    return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-all group">
                       <td className="px-8 py-5">
                          <p className="text-xs font-black text-slate-800">{created ? format(created, 'HH:mm') : '-'}</p>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{created ? format(created, 'd MMM yyyy') : '-'}</p>
                       </td>
                       <td className="px-8 py-5">
                          <Link href={`/admin/orders/${t.id}`} className="flex items-center gap-3 group/ref">
                            <div className="p-2 bg-slate-100 rounded-lg text-slate-400 group-hover/ref:text-blue-600 transition-colors">
                              <Package size={16} />
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-800 uppercase italic leading-none group-hover/ref:text-blue-600 transition-colors">#{t.id?.substring(0,8)}</p>
                              <p className="text-xs font-bold text-slate-400 uppercase mt-1 flex items-center gap-1">
                                Lihat Detail <ChevronRight size={10} />
                              </p>
                            </div>
                          </Link>
                       </td>
                       <td className="px-8 py-5 text-xs font-bold text-slate-600">{t.customerName || 'Walk-in'}</td>
                       <td className="px-8 py-5 font-black text-xs text-slate-900">Rp {t.total?.toLocaleString()}</td>
                       <td className="px-8 py-5 text-right">
                          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${['SELESAI', 'SUCCESS'].includes(String(t.status).toUpperCase()) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                             {t.status}
                          </span>
                       </td>
                    </tr>
                    );
                  })}
                  {activeTab === 'finance' && shifts.map(s => {
                    const openedAt = coerceDate(s.openedAt);
                    const closedAt = coerceDate(s.closedAt);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-all group">
                         <td className="px-8 py-5">
                            <p className="text-xs font-black text-slate-800">{openedAt ? format(openedAt, 'HH:mm') : '-'}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{openedAt ? format(openedAt, 'd MMM yyyy') : '-'}</p>
                         </td>
                         <td className="px-8 py-5">
                            {closedAt ? (
                              <>
                                <p className="text-xs font-black text-slate-800">{format(closedAt, 'HH:mm')}</p>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{format(closedAt, 'd MMM yyyy')}</p>
                              </>
                            ) : <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">AKTIF</span>}
                         </td>
                         <td className="px-8 py-5 text-xs font-bold text-slate-600 uppercase">{s.cashierName}</td>
                         <td className="px-8 py-5 font-black text-xs text-slate-900">Rp {Number(s.expectedCash || 0).toLocaleString()}</td>
                         <td className="px-8 py-5 text-right">
                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${Number(s.difference || 0) === 0 ? 'bg-slate-50 text-slate-400' : Number(s.difference || 0) > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                               {Number(s.difference || 0) > 0 ? '+' : ''}{Number(s.difference || 0).toLocaleString()}
                            </span>
                         </td>
                      </tr>
                    );
                  })}
                  {activeTab === 'capital' && capitalLogs.map(c => {
                    const dateObj = toDateOrNull(c.date) || new Date(c.created_at || Date.now());
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-all group">
                         <td className="px-8 py-5">
                            <p className="text-xs font-black text-slate-800">{format(dateObj, 'HH:mm')}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{format(dateObj, 'd MMM yyyy')}</p>
                         </td>
                         <td className="px-8 py-5 font-black text-xs text-slate-800 uppercase">{c.referenceId || '-'}</td>
                         <td className="px-8 py-5">
                            <span className="text-xs font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-lg">{c.type}</span>
                         </td>
                         <td className={`px-8 py-5 font-black text-xs ${c.transactionType === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {c.transactionType === 'IN' ? '+' : '-'}Rp {c.amount?.toLocaleString()}
                         </td>
                         <td className="px-8 py-5 text-right font-bold text-xs text-slate-400 uppercase">{c.executorName || 'Admin'}</td>
                      </tr>
                    );
                  })}
                  {activeTab === 'tax' && taxLogs.filter(t => t.product?.toLowerCase().includes(searchTerm.toLowerCase()) || t.orderId?.toLowerCase().includes(searchTerm.toLowerCase())).map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-all group">
                       <td className="px-8 py-5">
                          <p className="text-xs font-black text-slate-800">{format(t.date, 'HH:mm')}</p>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{format(t.date, 'd MMM yyyy')}</p>
                       </td>
                       <td className="px-8 py-5 font-mono text-xs font-black text-slate-600 uppercase">{t.orderId?.substring(0,12)}</td>
                       <td className="px-8 py-5 text-xs font-bold text-slate-700">
                          <p className="font-black text-slate-900 line-clamp-1">{t.product}</p>
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">{t.category}</span>
                       </td>
                       <td className="px-8 py-5 text-xs font-black text-slate-900">Rp {t.sales?.toLocaleString('id-ID')}</td>
                       <td className="px-8 py-5 text-xs font-bold text-blue-700">Rp {t.dpp?.toLocaleString('id-ID')}</td>
                       <td className="px-8 py-5 text-right">
                          <p className={`font-black text-sm ${t.isExempt ? 'text-amber-500' : 'text-indigo-600'}`}>
                            {t.isExempt ? 'Rp 0' : `Rp ${t.taxAmount?.toLocaleString('id-ID')}`}
                          </p>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.isExempt ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-500'}`}>{t.taxLabel}</span>
                       </td>
                    </tr>
                  ))}
                  {activeTab === 'cost' && costLogs.filter(c => c.productName?.toLowerCase().includes(searchTerm.toLowerCase())).map(c => {
                    const changeDate = toDateOrNull(c.changeDate);
                    return (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-all group">
                       <td className="px-8 py-5">
                          <p className="text-xs font-black text-slate-800">{changeDate ? format(changeDate, 'HH:mm') : '-'}</p>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{changeDate ? format(changeDate, 'd MMM yyyy') : '-'}</p>
                       </td>
                       <td className="px-8 py-5 font-black text-xs text-slate-800 uppercase">{c.productName}</td>
                       <td className="px-8 py-5 text-xs font-bold text-slate-400">Rp {c.oldCost?.toLocaleString()}</td>
                       <td className="px-8 py-5 text-xs font-black text-slate-900">Rp {c.newCost?.toLocaleString()}</td>
                       <td className="px-8 py-5 text-right">
                          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${(c.newCost - c.oldCost) >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                             {(c.newCost - c.oldCost) > 0 ? '+' : ''}{(c.newCost - c.oldCost)?.toLocaleString()}
                          </span>
                       </td>
                    </tr>
                    );
                  })}
                  {activeTab === 'profit' && profitLogs.map(p => {
                    const profitDate = toDateOrNull(p.date);
                    return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-all group">
                       <td className="px-8 py-5">
                          <p className="text-xs font-black text-slate-800">{profitDate ? format(profitDate, 'HH:mm') : '-'}</p>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{profitDate ? format(profitDate, 'd MMM yyyy') : '-'}</p>
                       </td>
                       <td className="px-8 py-5 font-black text-xs text-slate-500 uppercase">#{p.id?.substring(0,8)}</td>
                       <td className="px-8 py-5 text-xs font-black text-slate-900">Rp {p.sales?.toLocaleString()}</td>
                       <td className="px-8 py-5 text-xs font-bold text-rose-500">-Rp {p.cost?.toLocaleString()}</td>
                       <td className="px-8 py-5 text-right font-black text-emerald-600">
                          +Rp {p.profit?.toLocaleString()}
                       </td>
                    </tr>
                    );
                  })}
               </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, val, color, prefix = '' }: any) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
       <p className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2">{label}</p>
       <p className={`text-2xl font-black ${color}`}>{prefix}Rp {val.toLocaleString()}</p>
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