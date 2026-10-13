// src/app/admin/reports/sales/page.tsx
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useAdminAuth from '@/lib/hooks/useAdminAuth';
import * as XLSX from 'xlsx';
import {
  TrendingUp,
  TrendingDown,
  Download,
  Package,
  CreditCard,
  Users,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  Filter,
  BarChart3,
  Layers,
  ShoppingBag,
  DollarSign,
  ArrowUpDown,
  Store
} from 'lucide-react';
import notify from '@/lib/notify';
import { sbGetDocs } from '@/lib/supabase-helpers';
import {
  hitungHppItem,
  keBentukProdukHpp,
  hitungPetaModalPembelian,
  PRODUK_RINGKAS,
} from '@/lib/hpp';

type SaleItem = {
  id: string;
  soNumber: string;
  date: string;
  productName: string;
  productId?: string;
  quantity: number;
  total: number;
  paymentMethod: string;
  channel: string;
  customerName: string;
  status: string;
};

export type ProductProfitItem = {
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  unit: string;
  totalQuantity: number;
  totalPcs: number;
  totalRevenue: number;
  totalCogs: number;
  totalAdminFee: number;
  totalProfit: number;
  marginPct: number;
  channels: Record<string, { qty: number; revenue: number; profit: number }>;
  orderCount: number;
  status: 'HIGH' | 'MEDIUM' | 'LOW' | 'LOSS';
};

const VALID_STATUSES = ['SELESAI', 'DIPROSES', 'COMPLETED', 'DONE', 'SUCCESS'];

function parseDateAny(val: any): Date {
  if (!val) return new Date();
  if (val.toDate && typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

export default function SalesReport() {
  const router = useRouter();
  const { authLoading } = useAdminAuth();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profit_ranking' | 'transactions'>('profit_ranking');
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [productProfits, setProductProfits] = useState<ProductProfitItem[]>([]);

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
      endDate: toLocal(now),
    };
  });

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [profitFilter, setProfitFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'LOSS'>('ALL');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [sortByProfit, setSortByProfit] = useState<
    'profit_desc' | 'profit_asc' | 'margin_desc' | 'margin_asc' | 'qty_desc' | 'revenue_desc'
  >('profit_desc');

  // Transactions Tab States
  const [sortByTx, setSortByTx] = useState<'date' | 'total' | 'quantity'>('date');
  const [sortOrderTx, setSortOrderTx] = useState<'asc' | 'desc'>('desc');
  const [currentPageTx, setCurrentPageTx] = useState(1);
  const [currentPageProfit, setCurrentPageProfit] = useState(1);

  const fetchSalesData = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      endDate.setHours(23, 59, 59, 999);

      // Ambil orders, products, dan purchases untuk perhitungan HPP & Fee akurat
      const PRODUK_COLS = PRODUK_RINGKAS + ',name,sku,barcode,unit';
      const [ordersSnapshot, productsSnapshot, purchasesSnapshot] = await Promise.all([
        sbGetDocs({ table: 'orders' }),
        sbGetDocs({ table: 'products', columns: PRODUK_COLS }),
        sbGetDocs({ table: 'purchases' }),
      ]);

      // Buat map master produk
      const productsMap = new Map<string, any>();
      productsSnapshot.docs.forEach((ds) => {
        const d = ds.data() as any;
        const prodData = keBentukProdukHpp(d);
        const fullProd = {
          ...prodData,
          name: d.name,
          sku: d.sku,
          barcode: d.barcode,
          unit: d.unit,
        };
        productsMap.set(ds.id, fullProd);
        if (d.sku) productsMap.set(String(d.sku).trim(), fullProd);
        if (d.barcode) productsMap.set(String(d.barcode).trim(), fullProd);
      });

      // Peta modal dari PO terakhir
      const latestCostMap = hitungPetaModalPembelian(purchasesSnapshot.docs);

      const salesList: SaleItem[] = [];
      const productMap = new Map<string, ProductProfitItem>();

      for (const orderDoc of ordersSnapshot.docs) {
        const order = orderDoc.data() as any;
        const raw = order.raw_data || {};
        const rawStatus = (order.status || raw.status || '').toUpperCase();

        // Skip pesanan yang dibatalkan
        if (!VALID_STATUSES.includes(rawStatus)) continue;
        if (['CANCELLED', 'DIBATALKAN', 'BATAL'].includes(rawStatus)) continue;

        const created = parseDateAny(order.createdAt || raw.createdAt);
        if (created < startDate || created > endDate) continue;

        const orderIdDisplay = order.order_id || order.orderId || raw.orderId || orderDoc.id;
        const pm = (order.payment?.method || order.paymentMethod || raw.paymentMethod || 'CASH').toUpperCase();
        const ch = (order.channel || raw.channel || raw.transactionType || 'OFFLINE').toUpperCase();
        const custName = order.customerName || raw.customerName || 'Pelanggan';

        // Biaya admin marketplace untuk order ini (jika ada)
        let orderAdminFee = Number(raw.biayaAdmin ?? order.biayaAdmin ?? 0);
        if (!orderAdminFee && (ch === 'SHOPEE' || ch === 'TIKTOK')) {
          const totalOrder = Number(order.total || raw.total || 0);
          orderAdminFee = ch === 'SHOPEE' ? totalOrder * 0.065 : totalOrder * 0.045;
        }

        const items = order.items || raw.items || [];
        const orderSubtotal = items.reduce(
          (sum: number, it: any) => sum + Number(it.price || 0) * Number(it.quantity || 1),
          0
        );

        for (const item of items) {
          const itQty = Number(item.quantity || 1);
          const itPrice = Number(item.price || 0);
          const itRevenue = itPrice * itQty;
          const pid = String(item.id || item.productId || item.raw_data?.productId || '').trim();
          const pName = String(item.name || item.productName || 'Tanpa Nama').trim();

          // Catat untuk tab Riwayat Transaksi
          salesList.push({
            id: orderDoc.id,
            soNumber: orderIdDisplay,
            date: created.toISOString(),
            productName: pName,
            productId: pid,
            quantity: itQty,
            total: itRevenue,
            paymentMethod: pm,
            channel: ch,
            customerName: custName,
            status: rawStatus,
          });

          // Cari produk di master
          const prod = productsMap.get(pid) || (item.barcode ? productsMap.get(String(item.barcode).trim()) : undefined);

          // Hitung HPP menggunakan hitungHppItem (terverifikasi konversi satuan)
          const hitung = hitungHppItem({
            item,
            produk: prod,
            costPembelianPerPcs: pid ? latestCostMap.get(pid)?.costPerPcs : undefined,
          });

          const itemHpp = hitung.hpp;
          const itemFee = orderSubtotal > 0 && orderAdminFee > 0 ? (orderAdminFee * hitung.pendapatan) / orderSubtotal : 0;
          const itemProfit = hitung.pendapatan - itemHpp - itemFee;

          // Agregasi ke Product Profitability Map
          const aggKey = pid || pName;
          let entry = productMap.get(aggKey);
          if (!entry) {
            entry = {
              productId: pid,
              productName: pName,
              sku: String(prod?.sku || item.sku || '').trim(),
              barcode: String(prod?.barcode || item.barcode || '').trim(),
              unit: String(item.unit || prod?.unit || 'PCS').toUpperCase(),
              totalQuantity: 0,
              totalPcs: 0,
              totalRevenue: 0,
              totalCogs: 0,
              totalAdminFee: 0,
              totalProfit: 0,
              marginPct: 0,
              channels: {},
              orderCount: 0,
              status: 'HIGH',
            };
            productMap.set(aggKey, entry);
          }

          entry.totalQuantity += itQty;
          entry.totalPcs += hitung.pcs;
          entry.totalRevenue += hitung.pendapatan;
          entry.totalCogs += itemHpp;
          entry.totalAdminFee += itemFee;
          entry.totalProfit += itemProfit;
          entry.orderCount += 1;

          if (!entry.channels[ch]) {
            entry.channels[ch] = { qty: 0, revenue: 0, profit: 0 };
          }
          entry.channels[ch].qty += itQty;
          entry.channels[ch].revenue += hitung.pendapatan;
          entry.channels[ch].profit += itemProfit;
        }
      }

      // Finalisasi perhitungan margin dan status profitabilitas
      const productStatsList: ProductProfitItem[] = Array.from(productMap.values()).map((p) => {
        const marginPct = p.totalRevenue > 0 ? (p.totalProfit / p.totalRevenue) * 100 : 0;
        let status: 'HIGH' | 'MEDIUM' | 'LOW' | 'LOSS';

        if (p.totalProfit < 0) {
          status = 'LOSS';
        } else if (marginPct < 8) {
          status = 'LOW';
        } else if (marginPct < 20) {
          status = 'MEDIUM';
        } else {
          status = 'HIGH';
        }

        return {
          ...p,
          marginPct,
          status,
        };
      });

      setSales(salesList);
      setProductProfits(productStatsList);
    } catch (err: any) {
      console.error('Gagal memuat laporan penjualan & profit:', err);
      notify.error('Gagal memuat data penjualan: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    if (!authLoading) {
      fetchSalesData();
    }
  }, [authLoading, fetchSalesData]);

  // Filtered & Sorted Product Profitability
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return productProfits
      .filter((p) => {
        // Search
        if (q) {
          const matchName = p.productName.toLowerCase().includes(q);
          const matchSku = p.sku.toLowerCase().includes(q);
          const matchBarcode = p.barcode.toLowerCase().includes(q);
          if (!matchName && !matchSku && !matchBarcode) return false;
        }

        // Status Filter
        if (profitFilter !== 'ALL' && p.status !== profitFilter) {
          return false;
        }

        // Channel Filter
        if (channelFilter !== 'ALL') {
          if (!p.channels[channelFilter] || p.channels[channelFilter].qty <= 0) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortByProfit === 'profit_desc') return b.totalProfit - a.totalProfit;
        if (sortByProfit === 'profit_asc') return a.totalProfit - b.totalProfit;
        if (sortByProfit === 'margin_desc') return b.marginPct - a.marginPct;
        if (sortByProfit === 'margin_asc') return a.marginPct - b.marginPct;
        if (sortByProfit === 'qty_desc') return b.totalQuantity - a.totalQuantity;
        if (sortByProfit === 'revenue_desc') return b.totalRevenue - a.totalRevenue;
        return b.totalProfit - a.totalProfit;
      });
  }, [productProfits, searchQuery, profitFilter, channelFilter, sortByProfit]);

  // Counts for Badges
  const counts = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;
    let loss = 0;

    productProfits.forEach((p) => {
      if (p.status === 'HIGH') high++;
      else if (p.status === 'MEDIUM') medium++;
      else if (p.status === 'LOW') low++;
      else if (p.status === 'LOSS') loss++;
    });

    return { total: productProfits.length, high, medium, low, loss };
  }, [productProfits]);

  // Overall Financial Totals
  const overallStats = useMemo(() => {
    let rev = 0;
    let cogs = 0;
    let fee = 0;
    let profit = 0;
    let itemsSold = 0;

    productProfits.forEach((p) => {
      rev += p.totalRevenue;
      cogs += p.totalCogs;
      fee += p.totalAdminFee;
      profit += p.totalProfit;
      itemsSold += p.totalQuantity;
    });

    const avgMargin = rev > 0 ? (profit / rev) * 100 : 0;
    return { rev, cogs, fee, profit, itemsSold, avgMargin };
  }, [productProfits]);

  // Sorted Transactions
  const sortedSales = useMemo(() => {
    return [...sales].sort((a, b) => {
      const valA = a[sortByTx];
      const valB = b[sortByTx];
      if (sortOrderTx === 'asc') {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    });
  }, [sales, sortByTx, sortOrderTx]);

  // Pagination
  const itemsPerPage = 15;
  const paginatedProducts = useMemo(() => {
    const start = (currentPageProfit - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPageProfit]);
  const totalPagesProfit = Math.ceil(filteredProducts.length / itemsPerPage);

  const paginatedSales = useMemo(() => {
    const start = (currentPageTx - 1) * itemsPerPage;
    return sortedSales.slice(start, start + itemsPerPage);
  }, [sortedSales, currentPageTx]);
  const totalPagesTx = Math.ceil(sortedSales.length / itemsPerPage);

  // Export Excel
  const handleExport = () => {
    if (activeTab === 'profit_ranking') {
      const exportData = filteredProducts.map((p, idx) => ({
        Ranking: idx + 1,
        'Nama Produk': p.productName,
        SKU: p.sku || '-',
        Barcode: p.barcode || '-',
        Satuan: p.unit,
        'Qty Terjual': p.totalQuantity,
        'Total Omset': p.totalRevenue,
        'Total Modal (HPP)': Math.round(p.totalCogs),
        'Biaya Admin/Fee': Math.round(p.totalAdminFee),
        'Laba Bersih': Math.round(p.totalProfit),
        'Margin (%)': `${p.marginPct.toFixed(1)}%`,
        Status:
          p.status === 'HIGH'
            ? 'PROFIT TINGGI'
            : p.status === 'MEDIUM'
            ? 'PROFIT SEDANG'
            : p.status === 'LOW'
            ? 'PROFIT TIPIS'
            : 'RUGI',
        'Channel Terjual': Object.keys(p.channels).join(', '),
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ranking Profit Produk');
      XLSX.writeFile(wb, `analisis-profit-produk-${dateRange.startDate}-sd-${dateRange.endDate}.xlsx`);
    } else {
      const exportData = sortedSales.map((sale) => ({
        'No. Transaksi': sale.soNumber,
        Tanggal: new Date(sale.date).toLocaleDateString('id-ID'),
        Produk: sale.productName,
        Kuantitas: sale.quantity,
        Total: sale.total,
        Channel: sale.channel,
        'Metode Bayar': sale.paymentMethod,
        Pelanggan: sale.customerName,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Transaksi');
      XLSX.writeFile(wb, `riwayat-transaksi-${dateRange.startDate}-sd-${dateRange.endDate}.xlsx`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 font-semibold">Memuat analisis penjualan & profit...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-2xl shadow-md shadow-emerald-500/20">
            <BarChart3 size={28} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Laporan Penjualan & Profit
            </h1>
            <p className="text-xs md:text-sm font-medium text-slate-500 mt-0.5">
              Pantau ranking produk paling untung, margin tipis, dan deteksi produk rugi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <button
            onClick={handleExport}
            className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-2xl text-xs md:text-sm font-bold shadow-sm transition-all"
          >
            <Download size={16} />
            <span>Ekspor Excel</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Filter size={16} className="text-emerald-600" />
            <span>Periode:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-xs text-slate-400 font-bold">s/d</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              const now = new Date();
              const toLocal = (d: Date) =>
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              setDateRange({ startDate: toLocal(now), endDate: toLocal(now) });
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            Hari Ini
          </button>
          <button
            onClick={() => {
              const now = new Date();
              const toLocal = (d: Date) =>
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
              setDateRange({ startDate: toLocal(startMonth), endDate: toLocal(now) });
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            Bulan Ini
          </button>
          <button
            onClick={() => {
              const now = new Date();
              const toLocal = (d: Date) =>
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
              setDateRange({ startDate: toLocal(lastMonthStart), endDate: toLocal(lastMonthEnd) });
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            Bulan Lalu
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 md:gap-4">
        {/* Total Omset */}
        <div className="bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Total Omset</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <ShoppingBag size={18} />
            </div>
          </div>
          <div>
            <p className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
              Rp {Math.round(overallStats.rev).toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
              {overallStats.itemsSold.toLocaleString('id-ID')} unit terjual
            </p>
          </div>
        </div>

        {/* Total Modal HPP */}
        <div className="bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Total Modal (HPP)</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Layers size={18} />
            </div>
          </div>
          <div>
            <p className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
              Rp {Math.round(overallStats.cogs).toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Beban pokok barang</p>
          </div>
        </div>

        {/* Total Laba Bersih */}
        <div className="bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Total Laba Bersih</span>
            <div className={`p-2 rounded-xl ${overallStats.profit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              <DollarSign size={18} />
            </div>
          </div>
          <div>
            <p className={`text-lg md:text-xl font-black tracking-tight ${overallStats.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {overallStats.profit >= 0 ? '+' : ''}Rp {Math.round(overallStats.profit).toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
              Setelah modal & fee admin
            </p>
          </div>
        </div>

        {/* Rata-rata Margin */}
        <div className="bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Rata-rata Margin</span>
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
              <TrendingUp size={18} />
            </div>
          </div>
          <div>
            <p className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
              {overallStats.avgMargin.toFixed(1)}%
            </p>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Persentase profit bersih</p>
          </div>
        </div>

        {/* Indikator Produk Rugi */}
        <div
          onClick={() => {
            setActiveTab('profit_ranking');
            setProfitFilter('LOSS');
          }}
          className={`p-4 md:p-5 rounded-3xl shadow-sm border cursor-pointer transition-all col-span-2 lg:col-span-1 flex flex-col justify-between ${
            counts.loss > 0
              ? 'bg-red-50/80 border-red-200 hover:bg-red-100/80'
              : 'bg-white border-slate-100'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold ${counts.loss > 0 ? 'text-red-700' : 'text-slate-500'}`}>
              Produk Rugi
            </span>
            <div className={`p-2 rounded-xl ${counts.loss > 0 ? 'bg-red-600 text-white animate-pulse' : 'bg-emerald-50 text-emerald-600'}`}>
              {counts.loss > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            </div>
          </div>
          <div>
            <p className={`text-lg md:text-xl font-black tracking-tight ${counts.loss > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {counts.loss} Produk
            </p>
            <p className={`text-[11px] font-bold mt-0.5 ${counts.loss > 0 ? 'text-red-600 underline' : 'text-slate-400'}`}>
              {counts.loss > 0 ? 'Klik untuk tinjau rugi ➔' : 'Semua produk aman'}
            </p>
          </div>
        </div>
      </div>

      {/* Warning Banner if there are loss-making products */}
      {counts.loss > 0 && profitFilter !== 'LOSS' && (
        <div className="bg-red-500/10 border-2 border-red-500/30 p-4 md:p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-red-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-600 text-white rounded-2xl flex-shrink-0">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h4 className="font-black text-sm md:text-base text-red-950">
                Peringatan: Terdeteksi {counts.loss} produk dijual RUGI!
              </h4>
              <p className="text-xs text-red-800 mt-0.5 font-medium">
                Harga jual produk ini lebih rendah dari HPP modal atau habis terpotong fee admin marketplace.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab('profit_ranking');
              setProfitFilter('LOSS');
            }}
            className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            Lihat Produk Rugi
          </button>
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('profit_ranking')}
          className={`px-5 py-3 text-xs md:text-sm font-black rounded-t-2xl border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'profit_ranking'
              ? 'border-emerald-600 text-emerald-700 bg-white shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <BarChart3 size={18} />
          <span>🏆 Analisis Profit Produk ({productProfits.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-5 py-3 text-xs md:text-sm font-black rounded-t-2xl border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'transactions'
              ? 'border-emerald-600 text-emerald-700 bg-white shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Package size={18} />
          <span>📋 Riwayat Transaksi ({sales.length})</span>
        </button>
      </div>

      {/* TAB 1: PRODUCT PROFITABILITY RANKING & LOSS DETECTOR */}
      {activeTab === 'profit_ranking' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden space-y-4 p-5 md:p-6">
          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            {/* Quick Filter Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setProfitFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  profitFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua ({counts.total})
              </button>
              <button
                onClick={() => setProfitFilter('HIGH')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  profitFilter === 'HIGH'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                <span>🟢 Profit Tinggi (≥20%)</span>
                <span className="opacity-80">({counts.high})</span>
              </button>
              <button
                onClick={() => setProfitFilter('MEDIUM')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  profitFilter === 'MEDIUM'
                    ? 'bg-yellow-500 text-white ring-2 ring-yellow-400'
                    : 'bg-yellow-50 text-yellow-800 hover:bg-yellow-100'
                }`}
              >
                <span>🟡 Sedang (8-20%)</span>
                <span className="opacity-80">({counts.medium})</span>
              </button>
              <button
                onClick={() => setProfitFilter('LOW')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  profitFilter === 'LOW'
                    ? 'bg-amber-500 text-white ring-2 ring-amber-400'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                <span>🟠 Tipis (0-8%)</span>
                <span className="opacity-80">({counts.low})</span>
              </button>
              <button
                onClick={() => setProfitFilter('LOSS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  profitFilter === 'LOSS'
                    ? 'bg-red-600 text-white ring-2 ring-red-400'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                <span>🔴 RUGI (&lt;0)</span>
                <span className="opacity-80 font-black">({counts.loss})</span>
              </button>
            </div>

            {/* Channel, Sort & Search */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Channel Filter */}
              <div className="flex items-center gap-1.5">
                <Store size={14} className="text-slate-400" />
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ALL">Semua Channel</option>
                  <option value="OFFLINE">Offline / Kasir</option>
                  <option value="SHOPEE">Shopee</option>
                  <option value="TIKTOK">TikTok Shop</option>
                  <option value="WEBSITE">Website</option>
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-1.5">
                <ArrowUpDown size={14} className="text-slate-400" />
                <select
                  value={sortByProfit}
                  onChange={(e) => setSortByProfit(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="profit_desc">Laba Terbesar (Rp)</option>
                  <option value="profit_asc">Laba Terendah / Rugi (Rp)</option>
                  <option value="margin_desc">Margin Tertinggi (%)</option>
                  <option value="margin_asc">Margin Terendah (%)</option>
                  <option value="qty_desc">Qty Terjual Terbanyak</option>
                  <option value="revenue_desc">Omset Terbesar (Rp)</option>
                </select>
              </div>

              {/* Search */}
              <div className="relative flex-1 sm:w-56">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari produk / barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Table View (Desktop) */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4 w-12 text-center">Rank</th>
                  <th className="py-3 px-4">Produk</th>
                  <th className="py-3 px-4 text-center">Channel</th>
                  <th className="py-3 px-4 text-right">Terjual</th>
                  <th className="py-3 px-4 text-right">Total Omset</th>
                  <th className="py-3 px-4 text-right">Modal (HPP)</th>
                  <th className="py-3 px-4 text-right">Fee Admin</th>
                  <th className="py-3 px-4 text-right">Laba Bersih</th>
                  <th className="py-3 px-4 text-center">Margin %</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400 font-semibold">
                      Tidak ada produk yang sesuai dengan filter atau belum ada penjualan pada periode ini.
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((p, idx) => {
                    const rank = (currentPageProfit - 1) * itemsPerPage + idx + 1;
                    const isLoss = p.status === 'LOSS';
                    return (
                      <tr
                        key={p.productId || idx}
                        className={`transition-colors ${
                          isLoss ? 'bg-red-50/50 hover:bg-red-100/50' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-3.5 px-4 text-center font-black text-slate-400">
                          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                        </td>

                        {/* Product Info */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <p className="font-bold text-slate-900 line-clamp-1">{p.productName}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium mt-0.5">
                            {p.sku && <span>SKU: {p.sku}</span>}
                            {p.barcode && <span>• Barcode: {p.barcode}</span>}
                          </div>
                        </td>

                        {/* Channels */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex flex-wrap justify-center gap-1">
                            {Object.keys(p.channels).map((ch) => (
                              <span
                                key={ch}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  ch === 'SHOPEE'
                                    ? 'bg-orange-100 text-orange-700'
                                    : ch === 'TIKTOK'
                                    ? 'bg-neutral-900 text-white'
                                    : ch === 'OFFLINE'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-purple-100 text-purple-700'
                                }`}
                              >
                                {ch}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="py-3.5 px-4 text-right font-black text-slate-800">
                          {p.totalQuantity.toLocaleString('id-ID')} {p.unit}
                        </td>

                        {/* Revenue */}
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                          Rp {Math.round(p.totalRevenue).toLocaleString('id-ID')}
                        </td>

                        {/* HPP Modal */}
                        <td className="py-3.5 px-4 text-right font-semibold text-slate-600">
                          Rp {Math.round(p.totalCogs).toLocaleString('id-ID')}
                        </td>

                        {/* Admin Fee */}
                        <td className="py-3.5 px-4 text-right font-semibold text-slate-500">
                          {p.totalAdminFee > 0 ? `Rp ${Math.round(p.totalAdminFee).toLocaleString('id-ID')}` : '-'}
                        </td>

                        {/* Net Profit */}
                        <td
                          className={`py-3.5 px-4 text-right font-black ${
                            isLoss ? 'text-red-600' : 'text-emerald-600'
                          }`}
                        >
                          {p.totalProfit >= 0 ? '+' : ''}Rp {Math.round(p.totalProfit).toLocaleString('id-ID')}
                        </td>

                        {/* Margin % */}
                        <td className="py-3.5 px-4 text-center font-black">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-lg text-[11px] ${
                              isLoss
                                ? 'bg-red-100 text-red-700'
                                : p.marginPct < 8
                                ? 'bg-amber-100 text-amber-800'
                                : p.marginPct < 20
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {p.marginPct.toFixed(1)}%
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          {p.status === 'HIGH' && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-black">
                              🟢 TINGGI
                            </span>
                          )}
                          {p.status === 'MEDIUM' && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-md text-[10px] font-black">
                              🟡 SEDANG
                            </span>
                          )}
                          {p.status === 'LOW' && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-black">
                              🟠 TIPIS
                            </span>
                          )}
                          {p.status === 'LOSS' && (
                            <span className="px-2 py-0.5 bg-red-600 text-white rounded-md text-[10px] font-black animate-pulse">
                              🔴 RUGI
                            </span>
                          )}
                        </td>

                        {/* Action Link */}
                        <td className="py-3.5 px-4 text-center">
                          <Link
                            href={`/admin/products/pricing-hpp?search=${encodeURIComponent(p.productName)}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-[10px] font-bold transition-all"
                            title="Tinjau & sesuaikan harga/HPP di Penetapan Harga"
                          >
                            <ExternalLink size={11} />
                            <span>Atur HPP</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {paginatedProducts.map((p, idx) => {
              const rank = (currentPageProfit - 1) * itemsPerPage + idx + 1;
              const isLoss = p.status === 'LOSS';
              return (
                <div
                  key={p.productId || idx}
                  className={`p-4 rounded-2xl border ${
                    isLoss ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-100 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div>
                      <span className="text-[10px] font-black text-slate-400">#{rank}</span>
                      <h4 className="text-sm font-bold text-slate-900">{p.productName}</h4>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        isLoss
                          ? 'bg-red-600 text-white'
                          : p.marginPct < 8
                          ? 'bg-amber-100 text-amber-800'
                          : p.marginPct < 20
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {p.marginPct.toFixed(1)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-semibold">Qty Terjual</span>
                      <span className="font-black text-slate-900">
                        {p.totalQuantity} {p.unit}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-semibold">Total Omset</span>
                      <span className="font-bold text-slate-900">
                        Rp {Math.round(p.totalRevenue).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-semibold">Modal (HPP)</span>
                      <span className="font-semibold text-slate-700">
                        Rp {Math.round(p.totalCogs).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-semibold">Laba Bersih</span>
                      <span className={`font-black ${isLoss ? 'text-red-600' : 'text-emerald-600'}`}>
                        {p.totalProfit >= 0 ? '+' : ''}Rp {Math.round(p.totalProfit).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex gap-1">
                      {Object.keys(p.channels).map((ch) => (
                        <span key={ch} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-700">
                          {ch}
                        </span>
                      ))}
                    </div>
                    <Link
                      href={`/admin/products/pricing-hpp?search=${encodeURIComponent(p.productName)}`}
                      target="_blank"
                      className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1"
                    >
                      <span>Atur HPP</span>
                      <ExternalLink size={12} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPagesProfit > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">
                Menampilkan {(currentPageProfit - 1) * itemsPerPage + 1} -{' '}
                {Math.min(currentPageProfit * itemsPerPage, filteredProducts.length)} dari {filteredProducts.length} produk
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPageProfit <= 1}
                  onClick={() => setCurrentPageProfit((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40 hover:bg-slate-100 font-bold"
                >
                  Prev
                </button>
                <span className="px-3 py-1.5 font-bold text-slate-800">
                  {currentPageProfit} / {totalPagesProfit}
                </span>
                <button
                  disabled={currentPageProfit >= totalPagesProfit}
                  onClick={() => setCurrentPageProfit((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40 hover:bg-slate-100 font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DETAIL TRANSAKSI PENJUALAN */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden space-y-4 p-5 md:p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-base font-bold text-slate-900">Semua Baris Item Transaksi</h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500">Urutkan:</label>
                <select
                  value={sortByTx}
                  onChange={(e) => setSortByTx(e.target.value as any)}
                  className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 bg-white"
                >
                  <option value="date">Tanggal</option>
                  <option value="total">Total</option>
                  <option value="quantity">Kuantitas</option>
                </select>
              </div>
              <button
                onClick={() => setSortOrderTx(sortOrderTx === 'asc' ? 'desc' : 'asc')}
                className="px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
              >
                {sortOrderTx === 'asc' ? '↑ Asc' : '↓ Desc'}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">No. Transaksi</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Produk</th>
                  <th className="py-3 px-4 text-center">Channel</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Metode Bayar</th>
                  <th className="py-3 px-4">Pelanggan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-semibold">
                      Belum ada transaksi pada periode ini.
                    </td>
                  </tr>
                ) : (
                  paginatedSales.map((sale, idx) => (
                    <tr key={sale.id + idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                        <Link href={`/admin/orders/${sale.id}`} className="hover:underline">
                          {sale.soNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {new Date(sale.date).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 max-w-xs truncate">
                        {sale.productName}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {sale.channel}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">{sale.quantity}</td>
                      <td className="py-3.5 px-4 text-right font-black text-emerald-600">
                        Rp {sale.total.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">{sale.customerName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPagesTx > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">
                Menampilkan {(currentPageTx - 1) * itemsPerPage + 1} -{' '}
                {Math.min(currentPageTx * itemsPerPage, sortedSales.length)} dari {sortedSales.length} transaksi
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPageTx <= 1}
                  onClick={() => setCurrentPageTx((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40 hover:bg-slate-100 font-bold"
                >
                  Prev
                </button>
                <span className="px-3 py-1.5 font-bold text-slate-800">
                  {currentPageTx} / {totalPagesTx}
                </span>
                <button
                  disabled={currentPageTx >= totalPagesTx}
                  onClick={() => setCurrentPageTx((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40 hover:bg-slate-100 font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
