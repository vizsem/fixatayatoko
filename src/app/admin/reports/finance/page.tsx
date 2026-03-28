// src/app/(admin)/reports/finance/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import * as XLSX from 'xlsx';
import {
  CreditCard,
  Download,
  TrendingUp,
  TrendingDown,
  Package,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard
} from 'lucide-react';
import notify from '@/lib/notify';


type FinancialRecord = {
  id: string;
  date: string;
  description: string;
  category: string;
  type: 'income' | 'expense' | 'profit';
  amount: number;
  cost?: number;
  profit?: number;
  paymentMethod: string;
  channel?: string;
  platformFee?: number;
  hppSource?: 'FIFO' | 'Fallback';
};

export default function FinanceReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const toLocal = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    return {
      startDate: toLocal(new Date(now.getFullYear(), now.getMonth(), 1)),
      endDate: toLocal(now)
    };
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [mobileOpen, setMobileOpen] = useState(false);

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

  useEffect(() => {
    const fetchFinanceData = async () => {
      try {
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        endDate.setHours(23, 59, 59, 999);

        // Ambil semua order selesai (jenis status selesai), filter tanggal di sisi klien supaya aman untuk field createdAt yang bertipe string/Timestamp
        const salesSnapshot = await getDocs(
          query(
            collection(db, 'orders'),
            where('status', 'in', ['SELESAI', 'SUCCESS'])
          )
        );

        // Kumpulkan ID produk unik dari order untuk fetch terarah
        const productIdsSet = new Set<string>();
        salesSnapshot.docs.forEach((orderDoc) => {
          const orderData = orderDoc.data() as { items?: { id?: string; productId?: string }[] };
          (orderData.items || []).forEach((it) => {
            const pid = it.id || it.productId;
            if (pid) productIdsSet.add(pid);
          });
        });
        const productIds = Array.from(productIdsSet);
        const productsMap = new Map<string, Record<string, unknown>>();
        // Batch fetch maksimum 10 id per permintaan
        for (let i = 0; i < productIds.length; i += 10) {
          const chunk = productIds.slice(i, i + 10);
          if (chunk.length === 0) continue;
          const qChunk = query(collection(db, 'products'), where('__name__', 'in', chunk));
          const snap = await getDocs(qChunk);
          snap.forEach((docSnap) => {
            productsMap.set(docSnap.id, docSnap.data() as Record<string, unknown>);
          });
        }

        // Build latest purchase cost map per product from Purchase Items (fallback untuk Modal kosong)
        const latestCostMap = new Map<string, { costPerPcs: number; ts: number }>();
        const allPurchasesSnap = await getDocs(collection(db, 'purchases'));
        allPurchasesSnap.docs.forEach((pdoc) => {
          const pdata = pdoc.data() as {
            createdAt?: Timestamp | string;
            items?: { id: string; purchasePrice: number; conversion?: number }[];
          };
          const created =
            pdata.createdAt instanceof Timestamp
              ? pdata.createdAt.toDate().getTime()
              : new Date(pdata.createdAt || new Date().toISOString()).getTime();
          (pdata.items || []).forEach((it) => {
            const conv = Math.max(1, Number(it.conversion || 1));
            const costPerPcs = conv > 0 ? Number(it.purchasePrice || 0) / conv : Number(it.purchasePrice || 0);
            const cur = latestCostMap.get(it.id);
            if (!cur || created > cur.ts) latestCostMap.set(it.id, { costPerPcs, ts: created });
          });
        });

        const financeRecords: FinancialRecord[] = [];
        let feeShopee = 6.5;
        let feeTiktok = 4.5;
        let feeTokopedia = 5.0;
        let feeLazada = 6.0;
        try {
          const sysSnap = await getDoc(doc(db, 'settings', 'system'));
          if (sysSnap.exists()) {
            const sysData = sysSnap.data() as { marketplaceFees?: { shopee?: number; tiktok?: number; tokopedia?: number; lazada?: number } };
            feeShopee = typeof sysData.marketplaceFees?.shopee === 'number' ? sysData.marketplaceFees!.shopee! : feeShopee;
            feeTiktok = typeof sysData.marketplaceFees?.tiktok === 'number' ? sysData.marketplaceFees!.tiktok! : feeTiktok;
            feeTokopedia = typeof sysData.marketplaceFees?.tokopedia === 'number' ? sysData.marketplaceFees!.tokopedia! : feeTokopedia;
            feeLazada = typeof sysData.marketplaceFees?.lazada === 'number' ? sysData.marketplaceFees!.lazada! : feeLazada;
          }
        } catch {}
        const ADMIN_FEES: Record<string, number> = { SHOPEE: feeShopee, TIKTOK: feeTiktok, TOKOPEDIA: feeTokopedia, LAZADA: feeLazada };

        // Proses penjualan dengan perhitungan profit (filter tanggal di sini)
        for (const orderDoc of salesSnapshot.docs) {
          const order = orderDoc.data() as {
            createdAt?: Timestamp | string;
            total?: number;
            payment?: { method?: string };
            paymentMethod?: string;
            items?: { id?: string; productId?: string; price: number; quantity: number }[];
            channel?: string;
            shippingCost?: number;
          };
          const created =
            order.createdAt instanceof Timestamp
              ? order.createdAt.toDate()
              : new Date(order.createdAt || new Date().toISOString());
          if (!(created >= startDate && created <= endDate)) continue;

          let goodsRevenue = 0;
          let totalCost = 0;

          // Hitung biaya & profit berdasarkan harga beli
          for (const item of order.items || []) {
            const product = productsMap.get(item.id || '') || productsMap.get(item.productId || '');
            const modalPrice = Number(
              (product && (product.Modal as number | undefined)) ??
              (product && (product.purchasePrice as number | undefined)) ??
              0
            );
            const sellingPrice = Number(item.price);
            const fallbackCostEntry = latestCostMap.get(item.id || item.productId || '');
            const purchasePrice = modalPrice > 0 ? modalPrice : Math.max(0, fallbackCostEntry?.costPerPcs || 0);

            const itemCost = purchasePrice * item.quantity;
            goodsRevenue += sellingPrice * item.quantity;
            totalCost += itemCost;
          }

          const channel = (order.channel || 'OFFLINE').toUpperCase();
          const adminFeeRate = ADMIN_FEES[channel] || 0;
          const serviceFee = Math.round(goodsRevenue * (adminFeeRate / 100));
          const primaryCost = typeof (order as any).cogsTotal === 'number' ? Number((order as any).cogsTotal) : totalCost;
          const profitCalc = goodsRevenue - primaryCost - serviceFee;
          const shippingRevenue = Number(order.shippingCost || 0);

          financeRecords.push({
            id: orderDoc.id,
            date: created.toISOString(),
            description: `Penjualan #${orderDoc.id.substring(0, 8)}`,
            category: 'Penjualan',
            type: 'profit',
            amount: goodsRevenue,
            cost: primaryCost,
            profit: profitCalc,
            paymentMethod: order.payment?.method || order.paymentMethod || 'CASH',
            channel: order.channel || 'OFFLINE',
            platformFee: serviceFee,
            hppSource: typeof (order as any).cogsTotal === 'number' ? 'FIFO' : 'Fallback'
          });

          if (shippingRevenue > 0) {
            financeRecords.push({
              id: `${orderDoc.id}-SHIP`,
              date: created.toISOString(),
              description: `Ongkir Order #${orderDoc.id.substring(0, 8)}`,
              category: 'Ongkir',
              type: 'income',
              amount: shippingRevenue,
              paymentMethod: order.payment?.method || order.paymentMethod || 'CASH',
              channel: order.channel || 'OFFLINE'
            });
          }
        }

        // Ambil semua pembelian, lalu filter tanggal di sisi klien (untuk konsistensi tipe createdAt)
        const purchasesSnapshot = await getDocs(collection(db, 'purchases'));

        purchasesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const created =
            data.createdAt instanceof Timestamp
              ? data.createdAt.toDate()
              : new Date(data.createdAt || new Date().toISOString());
          if (!(created >= startDate && created <= endDate)) return;
          financeRecords.push({
            id: `PUR-${doc.id}`,
            date: created.toISOString(),
            description: `Pembelian dari ${data.supplierName}`,
            category: 'Pembelian Stok',
            type: 'expense',
            amount: Number(data.total || 0),
            paymentMethod: data.paymentMethod || 'TRANSFER'
          });
        });

        // Ambil pengeluaran operasional (Operational Expenses)
        const expensesSnapshot = await getDocs(collection(db, 'operational_expenses'));
        
        expensesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          // Handle date field which can be Timestamp or Date object or string
          let created: Date;
          if (data.date instanceof Timestamp) {
            created = data.date.toDate();
          } else if (data.date instanceof Date) {
            created = data.date;
          } else if (data.date && (data.date as any).seconds) {
             created = new Date((data.date as any).seconds * 1000);
          } else {
            created = new Date(data.date || new Date().toISOString());
          }

          if (!(created >= startDate && created <= endDate)) return;
          
          financeRecords.push({
            id: `OPR-${doc.id}`,
            date: created.toISOString(),
            description: `${data.description} (${data.category})`,
            category: 'Operasional',
            type: 'expense',
            amount: Number(data.amount || 0),
            paymentMethod: 'CASH' // Default, or add field if needed
          });
        });

        // Integrasi retur penjualan: kurangi pendapatan & sesuaikan HPP
        const returnsSnap = await getDocs(collection(db, 'returns'));
        returnsSnap.docs.forEach((rdoc) => {
          const r = rdoc.data() as {
            type?: 'SALES_RETURN' | 'PURCHASE_RETURN';
            status?: 'PENDING' | 'APPROVED' | 'REJECTED';
            refId?: string;
            createdAt?: any;
            items?: { productId: string; quantity: number; price: number }[];
            totalValue?: number;
          };
          const created =
            r.createdAt && r.createdAt.seconds
              ? new Date(r.createdAt.seconds * 1000)
              : new Date();
          if (!(created >= startDate && created <= endDate)) return;
          if (r.status !== 'APPROVED' || r.type !== 'SALES_RETURN') return;

          let retRevenue = 0;
          let retCost = 0;
          (r.items || []).forEach((it) => {
            const selling = Number(it.price || 0);
            const prod = productsMap.get(it.productId || '');
            const modalPrice = Number(
              (prod && (prod.Modal as number | undefined)) ??
              (prod && (prod.purchasePrice as number | undefined)) ??
              0
            );
            const fallbackCostEntry = latestCostMap.get(it.productId || '');
            const purchasePrice = modalPrice > 0 ? modalPrice : Math.max(0, fallbackCostEntry?.costPerPcs || 0);
            retRevenue += selling * Number(it.quantity || 0);
            retCost += purchasePrice * Number(it.quantity || 0);
          });

          financeRecords.push({
            id: `RET-${rdoc.id}`,
            date: created.toISOString(),
            description: `Retur Penjualan #${(r.refId || '').toString().slice(-6)}`,
            category: 'Retur Penjualan',
            type: 'profit',
            amount: -Math.abs(retRevenue),
            cost: -Math.abs(retCost),
            profit: -(Math.abs(retRevenue) - Math.abs(retCost)),
            paymentMethod: 'REFUND',
            channel: 'OFFLINE'
          });
        });

        // Urutkan berdasarkan tanggal (terbaru dulu)
        financeRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setRecords(financeRecords);
      } catch {
        // Error is logged to console
      }

    };

    fetchFinanceData();
  }, [dateRange]);

  const handleExport = () => {
    const exportData = records.map(record => ({
      Tanggal: new Date(record.date).toLocaleDateString('id-ID'),
      Deskripsi: record.description,
      Kategori: record.category,
      Pendapatan: record.type === 'profit' ? record.amount : 0,
      'Biaya Pokok': record.cost || 0,
      Laba: record.profit || 0,
      Pengeluaran: record.type === 'expense' ? record.amount : 0,
      'Metode Bayar': record.paymentMethod
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Keuangan');
    XLSX.writeFile(wb, `laporan-keuangan-${dateRange.startDate}-sampai-${dateRange.endDate}.xlsx`);
  };

  // Pagination logic - moved before conditional return
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return records.slice(startIndex, startIndex + itemsPerPage);
  }, [records, currentPage]);

  const totalPages = Math.ceil(records.length / itemsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat laporan keuangan...</p>
        </div>
      </div>
    );
  }

  // Hitung total berdasarkan tipe record
  const totalIncome = records
    .filter(r => r.type === 'profit')
    .reduce((sum, r) => sum + r.amount, 0);
  const shippingIncome = records
    .filter(r => r.type === 'income' && r.category === 'Ongkir')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalCost = records
    .filter(r => r.type === 'profit')
    .reduce((sum, r) => sum + (r.cost || 0), 0);

  const totalProfit = records
    .filter(r => r.type === 'profit')
    .reduce((sum, r) => sum + (r.profit || 0), 0);

  const totalExpense = records
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

  const netProfit = totalProfit - totalExpense;

  const channels: string[] = ['OFFLINE', 'WEBSITE', 'SHOPEE', 'TIKTOK', 'TOKOPEDIA', 'LAZADA'];

  const channelSummary = channels.map(channel => {
    const channelRecords = records.filter(
      r => r.type === 'profit' && (r.channel || 'OFFLINE') === channel,
    );

    const revenue = channelRecords.reduce((sum, r) => sum + r.amount, 0);
    const cost = channelRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
    const profit = channelRecords.reduce((sum, r) => sum + (r.profit || 0), 0);
    const platformFee = channelRecords.reduce((sum, r) => sum + (r.platformFee || 0), 0);

    return {
      channel,
      revenue,
      cost,
      profit,
      platformFee,
    };
  });

  const goodsRevenue = totalIncome;
  const grossMarginPct = goodsRevenue > 0 ? Math.max(0, (totalProfit / goodsRevenue) * 100) : 0;
  const netMarginPct = goodsRevenue > 0 ? (netProfit / goodsRevenue) * 100 : 0;
  const fifoCount = records.filter(r => r.type === 'profit' && (r as any).hppSource === 'FIFO').length;
  const fallbackCount = records.filter(r => r.type === 'profit' && (r as any).hppSource !== 'FIFO').length;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-slate-800 font-sans pb-20">
      {/* Mobile Header */}
      <div className="md:hidden bg-white px-6 py-4 sticky top-0 z-20 border-b border-slate-100 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-emerald-200 shadow-lg">
            <LayoutDashboard size={20} />
          </div>
          <span className="font-bold text-slate-800 text-lg tracking-tight">Keuangan</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 bg-slate-50 text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors"
        >
          <LayoutDashboard size={20} />
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8">
        
        {/* Desktop Header & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-2">Laporan Keuangan</h1>
            <p className="text-slate-500 font-medium text-sm">Monitor performa bisnis, arus kas, dan profitabilitas real-time.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 w-full sm:w-auto px-2">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="bg-slate-50 border-none text-xs font-bold text-slate-700 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <span className="text-slate-300 font-bold">-</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="bg-slate-50 border-none text-xs font-bold text-slate-700 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="h-8 w-[1px] bg-slate-100 hidden sm:block"></div>
            <button
              onClick={handleExport}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
            >
              <Download size={16} /> Export
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {/* Pendapatan (Barang & Ongkir) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(6,81,237,0.1)] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                <TrendingUp size={18} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pendapatan</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Barang</span>
                <span className="text-lg font-black text-slate-800">Rp{goodsRevenue.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ongkir</span>
                <span className="text-lg font-black text-slate-800">Rp{shippingIncome.toLocaleString('id-ID')}</span>
              </div>
            </div>
            <p className="text-xs font-medium text-slate-400 mt-2">Pendapatan dipisah: barang dan ongkir</p>
          </div>

          {/* HPP */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(6,81,237,0.1)] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl">
                <Package size={18} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">HPP</span>
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">
              Rp{totalCost.toLocaleString('id-ID')}
            </h3>
            <p className="text-xs font-medium text-slate-400 mt-1">Modal Produk Terjual</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sumber</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-emerald-600">FIFO {fifoCount}</span>
                <span className="text-[10px] font-black text-slate-400">•</span>
                <span className="text-[10px] font-black text-amber-600">Fallback {fallbackCount}</span>
                <Link href="/admin/inventory/layers" className="text-[10px] font-black text-indigo-600 underline">Audit Layers</Link>
              </div>
            </div>
          </div>

          {/* Laba Kotor */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(6,81,237,0.1)] hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-5">
              <Package size={80} />
            </div>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                <TrendingUp size={18} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Laba Kotor</span>
            </div>
            <h3 className="text-2xl font-black text-blue-600 tracking-tight relative z-10">
              Rp{totalProfit.toLocaleString('id-ID')}
            </h3>
            <p className="text-xs font-medium text-slate-400 mt-1 relative z-10">Pendapatan - HPP</p>
            <p className="text-[10px] font-black text-blue-600/70 mt-1 relative z-10">Gross Margin: {grossMarginPct.toFixed(1)}%</p>
          </div>

          {/* Pengeluaran */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(6,81,237,0.1)] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-orange-50 text-orange-600 rounded-2xl">
                <CreditCard size={18} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pengeluaran</span>
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">
              Rp{totalExpense.toLocaleString('id-ID')}
            </h3>
            <p className="text-xs font-medium text-slate-400 mt-1">Operasional & Stok</p>
          </div>

          {/* Laba Bersih */}
          <div className={`p-5 rounded-3xl border shadow-[0_4px_20px_-4px_rgba(16,185,129,0.15)] hover:shadow-lg transition-shadow relative overflow-hidden ${netProfit >= 0 ? 'bg-gradient-to-br from-emerald-600 to-teal-700 border-emerald-500' : 'bg-gradient-to-br from-red-600 to-rose-700 border-red-500'}`}>
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendingUp size={100} className="text-white" />
            </div>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="p-2.5 bg-white/20 text-white rounded-2xl backdrop-blur-sm">
                <TrendingUp size={18} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">Net Profit</span>
            </div>
            <h3 className="text-2xl font-black text-white tracking-tight relative z-10">
              Rp{netProfit.toLocaleString('id-ID')}
            </h3>
            <p className="text-xs font-medium text-white/80 mt-1 relative z-10">Laba Kotor - Pengeluaran</p>
            <p className="text-[10px] font-black text-white/80 mt-1 relative z-10">Net Margin: {netMarginPct.toFixed(1)}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
           {/* Channel Summary */}
           <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm lg:col-span-1 h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                 <Package size={18} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Performa Channel</h3>
            </div>
            
            <div className="space-y-4">
              {channelSummary.map((summary) => (
                <div key={summary.channel} className="group p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50/50 border border-slate-100 hover:border-indigo-100 transition-all">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-indigo-600 transition-colors">{summary.channel}</span>
                    <span className={`text-xs font-black ${summary.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {summary.profit >= 0 ? '+' : ''}Rp{summary.profit.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full" 
                          style={{ width: `${Math.min((summary.revenue / (totalIncome || 1)) * 100, 100)}%` }}
                        />
                     </div>
                     <span className="text-[10px] font-bold text-slate-400 min-w-[3rem] text-right">
                       {((summary.revenue / (totalIncome || 1)) * 100).toFixed(0)}%
                     </span>
                  </div>
                  <div className="flex justify-between mt-2 text-[10px] text-slate-400">
                    <span>Rev: {summary.revenue.toLocaleString('id-ID')}</span>
                    <span>HPP: {summary.cost.toLocaleString('id-ID')}</span>
                    <span>Fee: {summary.platformFee.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Table */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm lg:col-span-2 flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
                    <LayoutDashboard size={18} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Riwayat Transaksi</h3>
               </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tanggal</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Keterangan</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Nominal</th>
                    <th className="hidden md:table-cell px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Tipe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                             <CreditCard size={24} className="text-slate-300" />
                          </div>
                          <p className="text-slate-500 font-bold text-sm">Belum ada data transaksi</p>
                          <p className="text-slate-400 text-xs mt-1">Coba sesuaikan filter tanggal</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((record) => (
                      <tr key={record.id} className="group hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700">
                              {new Date(record.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(record.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-emerald-600 transition-colors">
                              {record.description}
                            </span>
                            <div className="flex items-center gap-2">
                               <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 uppercase tracking-wide">
                                 {record.paymentMethod}
                               </span>
                               {record.channel && (
                                 <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-500 uppercase tracking-wide">
                                   {record.channel}
                                 </span>
                               )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex flex-col items-end gap-1">
                              <span className={`text-xs font-black ${record.type === 'profit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {record.type === 'profit' ? '+' : '-'} Rp{record.amount.toLocaleString('id-ID')}
                              </span>
                              {record.profit !== undefined && (
                                <span className={`text-[10px] font-bold ${record.profit >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                  Laba: Rp{record.profit.toLocaleString('id-ID')}
                                </span>
                              )}
                           </div>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                             record.type === 'profit' 
                               ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                               : 'bg-rose-50 text-rose-600 border border-rose-100'
                          }`}>
                            {record.type === 'profit' ? 'Pemasukan' : 'Pengeluaran'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-50 bg-white flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Hal {currentPage} dari {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Notes */}
        <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-100 mb-20">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shrink-0">
               <Package size={18} />
            </div>
            <div>
               <h4 className="text-sm font-bold text-slate-800 mb-2">Catatan Sistem Keuangan</h4>
               <ul className="space-y-2 text-xs text-slate-500 font-medium">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    HPP (Harga Pokok Penjualan) dihitung otomatis berdasarkan data Modal produk saat transaksi.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    Jika Modal kosong, sistem menggunakan estimasi margin 15% (HPP = 85% Harga Jual).
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    Laba Bersih = (Total Pendapatan - Total HPP) - Total Pengeluaran Operasional.
                  </li>
               </ul>
            </div>
          </div>
        </div>
      </div>

      <MobileSheet
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        onChangeStart={(v) => setDateRange({ ...dateRange, startDate: v })}
        onChangeEnd={(v) => setDateRange({ ...dateRange, endDate: v })}
        onExport={handleExport}
      />
    </div>
  );
}

function MobileSheet({
  open,
  onClose,
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
  onExport
}: {
  open: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  onChangeStart: (v: string) => void;
  onChangeEnd: (v: string) => void;
  onExport: () => void;
}) {
  return (
    <div className={`fixed inset-0 z-50 ${open ? 'pointer-events-auto' : 'pointer-events-none'} md:hidden`}>
      <div
        className={`${open ? 'opacity-100' : 'opacity-0'} absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300`}
        onClick={onClose}
      />
      <div
        className={`${open ? 'translate-y-0' : 'translate-y-full'} absolute inset-x-0 bottom-0 bg-white rounded-t-[2rem] shadow-2xl p-6 space-y-6 transition-transform duration-300 ease-out`}
      >
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto" />
        
        <div>
           <h3 className="text-lg font-black text-slate-800 mb-1">Filter Laporan</h3>
           <p className="text-xs text-slate-500 font-medium">Atur periode waktu laporan keuangan.</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onChangeStart(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onChangeEnd(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <button
            onClick={() => { onExport(); onClose(); }}
            className="w-full bg-emerald-600 text-white px-6 py-4 rounded-2xl text-sm font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-transform"
          >
            Download Excel
          </button>
          <button
            onClick={onClose}
            className="w-full bg-slate-100 text-slate-600 px-6 py-4 rounded-2xl text-sm font-bold hover:bg-slate-200 active:scale-95 transition-transform"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
