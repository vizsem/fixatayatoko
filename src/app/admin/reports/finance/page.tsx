// src/app/admin/reports/finance/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import {
  CreditCard, Download, TrendingUp, TrendingDown, Package,
  ChevronLeft, ChevronRight, LayoutDashboard, Printer,
  Filter, Lightbulb, ArrowUpCircle, ArrowDownCircle, Wallet,
  FileText, BarChart3, CheckCircle, PieChart as PieChartIcon,
  Search, X, RotateCcw, Layers, ShoppingBag, Truck, DollarSign,
  ArrowRight, Tag
} from 'lucide-react';
import notify from '@/lib/notify';
import { isAuthorizedAdmin } from '@/lib/auth-helpers';
import { Timestamp, auth, collection, db, doc, getDoc, getDocs, onAuthStateChanged, query, where } from '@/lib/firebase';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

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
  hppSource?: 'FIFO' | 'Fallback' | 'Estimate (85%)';
};

type CashFlowItem = {
  id: string;
  date: string;
  description: string;
  category: string;
  direction: 'in' | 'out';
  amount: number;
  paymentMethod: string;
  reference?: string;
};

type ActiveTab = 'overview' | 'income_statement' | 'cashflow';

const idr = (n: number) => `Rp${Math.abs(n).toLocaleString('id-ID')}`;
function toLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseDateAny(val: any): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val?.seconds) return new Date(val.seconds * 1000);
  return new Date(val || new Date().toISOString());
}

const CHANNEL_COLORS: Record<string, string> = {
  OFFLINE: '#10b981',    // Emerald
  WEBSITE: '#3b82f6',    // Blue
  SHOPEE: '#f97316',     // Orange
  TIKTOK: '#0f172a',     // Dark Slate
  TOKOPEDIA: '#16a34a',  // Green
  LAZADA: '#6366f1',     // Indigo
};
const FALLBACK_PALETTE = ['#8b5cf6', '#ec4899', '#06b6d4', '#eab308', '#14b8a6', '#f43f5e'];
const getChannelColor = (ch: string, index: number = 0) => {
  const c = CHANNEL_COLORS[ch.toUpperCase()];
  if (c) return c;
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
};

export default function FinanceReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [cashflowItems, setCashflowItems] = useState<CashFlowItem[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Overview Filters State
  const [selectedChannel, setSelectedChannel] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Visualizations Toggles
  const [channelViewMode, setChannelViewMode] = useState<'profit' | 'revenue'>('profit');

  // Cashflow Filters State
  const [cfDirection, setCfDirection] = useState<'ALL' | 'in' | 'out'>('ALL');
  const [cfCategory, setCfCategory] = useState('ALL');
  const [cfPaymentMethod, setCfPaymentMethod] = useState('ALL');
  const [cfSearch, setCfSearch] = useState('');
  const [cfPage, setCfPage] = useState(1);
  const cfItemsPerPage = 12;

  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return { startDate: toLocal(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: toLocal(now) };
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user: any) => {
      if (!user) { router.push('/profil/login'); return; }
      const ud = await getDoc(doc(db, 'users', user.uid));
      if (!isAuthorizedAdmin(user, ud.exists() ? ud.data() : null)) {
        notify.aksesDitolakAdmin(); router.push('/profil'); return;
      }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const setQuickPeriod = (p: 'today' | '7days' | '30days' | 'thisMonth') => {
    const now = new Date();
    let s = new Date(), e = new Date();
    if (p === 'today') { s = now; e = now; }
    else if (p === '7days') { s = new Date(now.getTime() - 6 * 86400000); e = now; }
    else if (p === '30days') { s = new Date(now.getTime() - 29 * 86400000); e = now; }
    else { s = new Date(now.getFullYear(), now.getMonth(), 1); e = now; }
    setDateRange({ startDate: toLocal(s), endDate: toLocal(e) });
    setCurrentPage(1);
    setCfPage(1);
  };

  useEffect(() => {
    if (loading) return;
    const fetchAll = async () => {
      setFetching(true);
      try {
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate); endDate.setHours(23, 59, 59, 999);

        let openBal = 0;
        const allCapItems: CashFlowItem[] = [];
        (await getDocs(collection(db, 'capital_transactions'))).docs.forEach(d => {
          const data = d.data() as any;
          const created = parseDateAny(data.date || data.createdAt);
          const amount = Number(data.amount || 0);
          const isIn = data.type === 'INJECTION';
          if (created < startDate) { openBal += isIn ? amount : -amount; }
          if (created >= startDate && created <= endDate) {
            allCapItems.push({
              id: d.id,
              date: created.toISOString(),
              description: data.description || (isIn ? 'Suntikan Modal' : 'Penarikan Modal'),
              category: isIn ? 'Modal Masuk' : 'Modal Keluar',
              direction: isIn ? 'in' : 'out',
              amount,
              paymentMethod: (data.paymentMethod || 'TRANSFER').toUpperCase(),
              reference: data.referenceId
            });
          }
        });
        setOpeningBalance(openBal);

        const salesSnap = await getDocs(query(collection(db, 'orders'), where('status', 'in', ['SELESAI', 'SUCCESS'])));
        const pidsSet = new Set<string>();
        salesSnap.docs.forEach(od => (od.data() as any).items?.forEach((it: any) => { const pid = it.id || it.productId; if (pid) pidsSet.add(pid); }));
        const pids = Array.from(pidsSet);
        const productsMap = new Map<string, any>();
        for (let i = 0; i < pids.length; i += 10) {
          const chunk = pids.slice(i, i + 10); if (!chunk.length) continue;
          (await getDocs(query(collection(db, 'products'), where('__name__', 'in', chunk)))).forEach(ds => productsMap.set(ds.id, ds.data()));
        }

        const latestCostMap = new Map<string, { costPerPcs: number; ts: number }>();
        (await getDocs(collection(db, 'purchases'))).docs.forEach(pd => {
          const pdata = pd.data() as any;
          const ts = parseDateAny(pdata.createdAt).getTime();
          (pdata.items || []).forEach((it: any) => {
            const conv = Math.max(1, Number(it.conversion || 1));
            const costPerPcs = Number(it.purchasePrice || 0) / conv;
            const cur = latestCostMap.get(it.id);
            if (!cur || ts > cur.ts) latestCostMap.set(it.id, { costPerPcs, ts });
          });
        });

        const financeRecords: FinancialRecord[] = [];
        const cashItems: CashFlowItem[] = [...allCapItems];

        for (const od of salesSnap.docs) {
          const order = od.data() as any;
          const created = parseDateAny(order.createdAt);
          if (!(created >= startDate && created <= endDate)) continue;
          let goodsRev = 0, totalCost = 0;
          (order.items || []).forEach((it: any) => {
            const price = Number(it.price || 0), qty = Number(it.quantity || 1), pid = it.id || it.productId;
            const prod = productsMap.get(pid || '');
            const modal = Number(prod?.Modal ?? prod?.purchasePrice ?? 0);
            const fallback = latestCostMap.get(pid || '')?.costPerPcs || 0;
            const cost = modal > 0 ? modal : (fallback > 0 ? fallback : price * 0.85);
            goodsRev += price * qty; totalCost += cost * qty;
          });
          const pm = (order.payment?.method || order.paymentMethod || 'CASH').toUpperCase();
          const ch = (order.channel || 'OFFLINE').toUpperCase();

          financeRecords.push({
            id: `SALE-${od.id}`,
            date: created.toISOString(),
            description: `Penjualan #${od.id.slice(-6).toUpperCase()}`,
            category: 'Penjualan',
            type: 'profit',
            amount: goodsRev,
            cost: totalCost,
            profit: goodsRev - totalCost,
            paymentMethod: pm,
            channel: ch
          });

          if (['CASH', 'TRANSFER', 'QRIS'].includes(pm)) {
            cashItems.push({
              id: `SALE-CF-${od.id}`,
              date: created.toISOString(),
              description: `Penerimaan Penjualan #${od.id.slice(-6).toUpperCase()}`,
              category: 'Penerimaan Penjualan',
              direction: 'in',
              amount: Number(order.total || goodsRev),
              paymentMethod: pm,
              reference: od.id
            });
          }

          const ongkir = Number(order.shippingCost || 0);
          if (ongkir > 0) {
            financeRecords.push({
              id: `ONGKIR-${od.id}`,
              date: created.toISOString(),
              description: `Ongkos Kirim #${od.id.slice(-6).toUpperCase()}`,
              category: 'Ongkir',
              type: 'income',
              amount: ongkir,
              paymentMethod: pm,
              channel: ch
            });
          }
        }

        (await getDocs(collection(db, 'operational_expenses'))).docs.forEach(d => {
          const data = d.data() as any;
          let created: Date;
          if (data.date instanceof Timestamp) created = data.date.toDate();
          else if (data.date?.seconds) created = new Date(data.date.seconds * 1000);
          else created = new Date(data.date || new Date().toISOString());

          if (!(created >= startDate && created <= endDate)) return;
          const amount = Number(data.amount || 0);
          const catLabel = data.category ? `Operasional (${data.category})` : 'Operasional';
          const pm = (data.paymentMethod || 'CASH').toUpperCase();

          financeRecords.push({
            id: `OPR-${d.id}`,
            date: created.toISOString(),
            description: `${data.description || 'Biaya'} (${data.category || 'Operasional'})`,
            category: catLabel,
            type: 'expense',
            amount,
            paymentMethod: pm
          });

          cashItems.push({
            id: `OPR-CF-${d.id}`,
            date: created.toISOString(),
            description: data.description || `Biaya ${data.category || 'Operasional'}`,
            category: catLabel,
            direction: 'out',
            amount,
            paymentMethod: pm,
            reference: d.id
          });
        });

        (await getDocs(collection(db, 'purchases'))).docs.forEach(d => {
          const data = d.data() as any;
          const created = parseDateAny(data.createdAt);
          if (!(created >= startDate && created <= endDate)) return;
          const pm = (data.paymentMethod || 'CASH').toUpperCase();
          const isPaid = data.paymentStatus === 'LUNAS' && ['CASH', 'TRANSFER', 'QRIS'].includes(pm);

          if (isPaid) {
            cashItems.push({
              id: `PO-CF-${d.id}`,
              date: created.toISOString(),
              description: `Pembelian Stok: ${data.supplierName || 'Supplier'}`,
              category: 'Pembelian Stok',
              direction: 'out',
              amount: Number(data.total || 0),
              paymentMethod: pm,
              reference: data.poNumber || d.id
            });
          }

          financeRecords.push({
            id: `PO-${d.id}`,
            date: created.toISOString(),
            description: `Pembelian Stok: ${data.supplierName || 'Supplier'}`,
            category: 'Pembelian Stok',
            type: 'expense',
            amount: Number(data.total || 0),
            paymentMethod: pm
          });
        });

        (await getDocs(collection(db, 'returns'))).docs.forEach(rd => {
          const r = rd.data() as any;
          const created = parseDateAny(r.createdAt);
          if (!(created >= startDate && created <= endDate)) return;
          if (r.status !== 'APPROVED' || r.type !== 'SALES_RETURN') return;
          let retRev = 0, retCost = 0;
          (r.items || []).forEach((it: any) => {
            const prod = productsMap.get(it.productId || '');
            const modal = Number(prod?.Modal ?? prod?.purchasePrice ?? 0);
            retRev += Number(it.price || 0) * Number(it.quantity || 0);
            retCost += (modal > 0 ? modal : Number(it.price || 0) * 0.85) * Number(it.quantity || 0);
          });
          financeRecords.push({
            id: `RET-${rd.id}`,
            date: created.toISOString(),
            description: `Retur Penjualan #${(r.refId || '').toString().slice(-6)}`,
            category: 'Retur Penjualan',
            type: 'profit',
            amount: -Math.abs(retRev),
            cost: -Math.abs(retCost),
            profit: -(Math.abs(retRev) - Math.abs(retCost)),
            paymentMethod: 'REFUND',
            channel: 'OFFLINE'
          });
        });

        financeRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        cashItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setRecords(financeRecords);
        setCashflowItems(cashItems);
      } catch (err) {
        console.error('Finance fetch error:', err);
      } finally {
        setFetching(false);
      }
    };
    fetchAll();
  }, [dateRange, loading]);

  // Dynamic Options for Overview Filters
  const availableChannels = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => { if (r.channel) set.add(r.channel.toUpperCase()); });
    return Array.from(set).sort();
  }, [records]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => { if (r.category) set.add(r.category); });
    return Array.from(set).sort();
  }, [records]);

  const availablePaymentMethods = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => { if (r.paymentMethod) set.add(r.paymentMethod.toUpperCase()); });
    return Array.from(set).sort();
  }, [records]);

  // Filtered Records (Overview Tab)
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (selectedChannel !== 'ALL') {
        const ch = (r.channel || 'OFFLINE').toUpperCase();
        if (ch !== selectedChannel) return false;
      }
      if (selectedCategory !== 'ALL' && r.category !== selectedCategory) {
        return false;
      }
      if (selectedType !== 'ALL' && r.type !== selectedType) {
        return false;
      }
      if (selectedPaymentMethod !== 'ALL') {
        const pm = (r.paymentMethod || 'CASH').toUpperCase();
        if (pm !== selectedPaymentMethod) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = r.description.toLowerCase().includes(q);
        const matchCat = r.category.toLowerCase().includes(q);
        const matchPm = r.paymentMethod.toLowerCase().includes(q);
        const matchCh = (r.channel || '').toLowerCase().includes(q);
        if (!matchDesc && !matchCat && !matchPm && !matchCh) return false;
      }
      return true;
    });
  }, [records, selectedChannel, selectedCategory, selectedType, selectedPaymentMethod, searchQuery]);

  const hasActiveRecordFilters = selectedChannel !== 'ALL' || selectedCategory !== 'ALL' || selectedType !== 'ALL' || selectedPaymentMethod !== 'ALL' || searchQuery.trim() !== '';

  const resetRecordFilters = () => {
    setSelectedChannel('ALL');
    setSelectedCategory('ALL');
    setSelectedType('ALL');
    setSelectedPaymentMethod('ALL');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Dynamic Options for Cashflow Filters
  const availableCfCategories = useMemo(() => {
    const set = new Set<string>();
    cashflowItems.forEach(c => { if (c.category) set.add(c.category); });
    return Array.from(set).sort();
  }, [cashflowItems]);

  const availableCfPaymentMethods = useMemo(() => {
    const set = new Set<string>();
    cashflowItems.forEach(c => { if (c.paymentMethod) set.add(c.paymentMethod.toUpperCase()); });
    return Array.from(set).sort();
  }, [cashflowItems]);

  // Filtered Cashflow Items
  const filteredCashflowItems = useMemo(() => {
    return cashflowItems.filter(c => {
      if (cfDirection !== 'ALL' && c.direction !== cfDirection) return false;
      if (cfCategory !== 'ALL' && c.category !== cfCategory) return false;
      if (cfPaymentMethod !== 'ALL' && (c.paymentMethod || 'CASH').toUpperCase() !== cfPaymentMethod) return false;
      if (cfSearch.trim()) {
        const q = cfSearch.toLowerCase();
        const matchDesc = c.description.toLowerCase().includes(q);
        const matchCat = c.category.toLowerCase().includes(q);
        const matchRef = (c.reference || '').toLowerCase().includes(q);
        const matchPm = c.paymentMethod.toLowerCase().includes(q);
        if (!matchDesc && !matchCat && !matchRef && !matchPm) return false;
      }
      return true;
    });
  }, [cashflowItems, cfDirection, cfCategory, cfPaymentMethod, cfSearch]);

  const hasActiveCfFilters = cfDirection !== 'ALL' || cfCategory !== 'ALL' || cfPaymentMethod !== 'ALL' || cfSearch.trim() !== '';

  const resetCfFilters = () => {
    setCfDirection('ALL');
    setCfCategory('ALL');
    setCfPaymentMethod('ALL');
    setCfSearch('');
    setCfPage(1);
  };

  // Income Statement Summary
  const IS = useMemo(() => {
    const salesRev = filteredRecords.filter(r => r.type === 'profit' && r.amount > 0).reduce((s, r) => s + r.amount, 0);
    const ongkir = filteredRecords.filter(r => r.type === 'income' && r.category === 'Ongkir').reduce((s, r) => s + r.amount, 0);
    const returns = filteredRecords.filter(r => r.type === 'profit' && r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);
    const netRevenue = salesRev + ongkir - returns;
    const cogs = filteredRecords.filter(r => r.type === 'profit').reduce((s, r) => s + Math.abs(r.cost || 0), 0);
    const grossProfit = netRevenue - cogs;
    const opex = filteredRecords.filter(r => r.type === 'expense' && r.category.startsWith('Operasional')).reduce((s, r) => s + r.amount, 0);
    const stockPurchases = filteredRecords.filter(r => r.type === 'expense' && r.category === 'Pembelian Stok').reduce((s, r) => s + r.amount, 0);
    const netIncome = grossProfit - opex;
    return {
      salesRev, ongkir, returns, netRevenue, cogs, grossProfit, opex, stockPurchases, netIncome,
      grossMargin: netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0,
      netMargin: netRevenue > 0 ? (netIncome / netRevenue) * 100 : 0
    };
  }, [filteredRecords]);

  // Cashflow Full Summary
  const CF = useMemo(() => {
    const inflows = cashflowItems.filter(c => c.direction === 'in');
    const outflows = cashflowItems.filter(c => c.direction === 'out');
    const totalIn = inflows.reduce((s, c) => s + c.amount, 0);
    const totalOut = outflows.reduce((s, c) => s + c.amount, 0);
    const netCash = totalIn - totalOut;
    return {
      inflows, outflows, totalIn, totalOut, netCash, closingBalance: openingBalance + netCash,
      salesCash: inflows.filter(c => c.category === 'Penerimaan Penjualan').reduce((s, c) => s + c.amount, 0),
      capitalIn: inflows.filter(c => c.category === 'Modal Masuk').reduce((s, c) => s + c.amount, 0),
      stockOut: outflows.filter(c => c.category === 'Pembelian Stok').reduce((s, c) => s + c.amount, 0),
      opexOut: outflows.filter(c => c.category.startsWith('Operasional')).reduce((s, c) => s + c.amount, 0),
      capitalOut: outflows.filter(c => c.category === 'Modal Keluar').reduce((s, c) => s + c.amount, 0),
    };
  }, [cashflowItems, openingBalance]);

  // Channel Profit & Revenue Visualizations Data
  const channelStats = useMemo(() => {
    const map = new Map<string, { channel: string; revenue: number; cost: number; profit: number; count: number }>();
    records.forEach(r => {
      if (r.type === 'profit') {
        const ch = (r.channel || 'OFFLINE').toUpperCase();
        const cur = map.get(ch) || { channel: ch, revenue: 0, cost: 0, profit: 0, count: 0 };
        cur.revenue += r.amount;
        cur.cost += (r.cost || 0);
        cur.profit += (r.profit || 0);
        cur.count += 1;
        map.set(ch, cur);
      }
    });

    const list = Array.from(map.values()).map(item => ({
      ...item,
      margin: item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0
    })).sort((a, b) => b.profit - a.profit);

    const totalProfit = list.reduce((s, c) => s + Math.max(0, c.profit), 0);
    const totalRev = list.reduce((s, c) => s + Math.max(0, c.revenue), 0);

    const profitPieData = list
      .filter(c => c.profit > 0)
      .map((c, idx) => ({
        name: c.channel,
        value: c.profit,
        percent: totalProfit > 0 ? (c.profit / totalProfit) * 100 : 0,
        margin: c.margin,
        revenue: c.revenue,
        color: getChannelColor(c.channel, idx)
      }));

    const revenuePieData = list
      .filter(c => c.revenue > 0)
      .map((c, idx) => ({
        name: c.channel,
        value: c.revenue,
        percent: totalRev > 0 ? (c.revenue / totalRev) * 100 : 0,
        margin: c.margin,
        profit: c.profit,
        color: getChannelColor(c.channel, idx)
      }));

    return { list, profitPieData, revenuePieData, totalProfit, totalRev };
  }, [records]);

  // Expense Breakdown Pie Chart Data
  const expenseBreakdown = useMemo(() => {
    const cogs = IS.cogs;
    const stockPurchases = IS.stockPurchases;
    const opex = IS.opex;
    const total = cogs + stockPurchases + opex;

    const items = [
      { name: 'HPP Modal Terjual', value: cogs, color: '#ef4444' },
      { name: 'Pembelian Stok Masuk', value: stockPurchases, color: '#f59e0b' },
      { name: 'Beban Operasional Toko', value: opex, color: '#6366f1' },
    ].filter(i => i.value > 0);

    return { items, total };
  }, [IS]);

  // Daily Chart for Overview
  const dailyChart = useMemo(() => {
    const map = new Map<string, { dateLabel: string; Pendapatan: number; 'Laba Kotor': number }>();
    [...filteredRecords].reverse().forEach(r => {
      const label = new Date(r.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      const e = map.get(label) || { dateLabel: label, Pendapatan: 0, 'Laba Kotor': 0 };
      if (r.type === 'profit') { e.Pendapatan += r.amount; e['Laba Kotor'] += (r.profit || 0); }
      else if (r.type === 'income') e.Pendapatan += r.amount;
      map.set(label, e);
    });
    return Array.from(map.values());
  }, [filteredRecords]);

  // Cashflow Daily Trend Chart
  const cfChart = useMemo(() => {
    const map = new Map<string, { dateLabel: string; 'Kas Masuk': number; 'Kas Keluar': number }>();
    [...cashflowItems].reverse().forEach(c => {
      const label = new Date(c.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      const e = map.get(label) || { dateLabel: label, 'Kas Masuk': 0, 'Kas Keluar': 0 };
      if (c.direction === 'in') e['Kas Masuk'] += c.amount; else e['Kas Keluar'] += c.amount;
      map.set(label, e);
    });
    return Array.from(map.values());
  }, [cashflowItems]);

  // Pagination
  const paginatedRecords = useMemo(() => filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filteredRecords, currentPage]);
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

  const paginatedCfItems = useMemo(() => filteredCashflowItems.slice((cfPage - 1) * cfItemsPerPage, cfPage * cfItemsPerPage), [filteredCashflowItems, cfPage]);
  const totalCfPages = Math.ceil(filteredCashflowItems.length / cfItemsPerPage);

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const period = `${dateRange.startDate} sd ${dateRange.endDate}`;
    if (activeTab === 'overview') {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredRecords.map(r => ({
        Tanggal: new Date(r.date).toLocaleDateString('id-ID'),
        Waktu: new Date(r.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        Deskripsi: r.description,
        Kategori: r.category,
        Tipe: r.type === 'profit' ? 'Penjualan' : (r.type === 'expense' ? 'Pengeluaran' : 'Pemasukan Lain'),
        'Pendapatan (Rp)': r.type !== 'expense' ? r.amount : 0,
        'HPP/Biaya (Rp)': r.cost || (r.type === 'expense' ? r.amount : 0),
        'Laba (Rp)': r.profit || 0,
        'Metode Bayar': r.paymentMethod,
        Channel: r.channel || 'OFFLINE'
      }))), 'Riwayat Transaksi');

      // Add Channel Summary sheet
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(channelStats.list.map(c => ({
        Channel: c.channel,
        'Total Order': c.count,
        'Pendapatan (Rp)': c.revenue,
        'HPP (Rp)': c.cost,
        'Laba Kotor (Rp)': c.profit,
        'Profit Margin (%)': Number(c.margin.toFixed(2))
      }))), 'Ringkasan Channel');
    } else if (activeTab === 'income_statement') {
      const { salesRev, ongkir, returns, netRevenue, cogs, grossProfit, opex, stockPurchases, netIncome, grossMargin, netMargin } = IS;
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
        { 'Laporan Laba Rugi': '', 'Periode': period, '': '' },
        { 'Laporan Laba Rugi': 'PENDAPATAN', 'Periode': '', '': '' },
        { 'Laporan Laba Rugi': '  Penjualan Bersih', 'Periode': salesRev, '': '' },
        { 'Laporan Laba Rugi': '  Pendapatan Ongkir', 'Periode': ongkir, '': '' },
        { 'Laporan Laba Rugi': '  Retur Penjualan', 'Periode': -returns, '': '' },
        { 'Laporan Laba Rugi': 'Total Pendapatan Bersih', 'Periode': netRevenue, '': '' },
        { 'Laporan Laba Rugi': '', 'Periode': '', '': '' },
        { 'Laporan Laba Rugi': 'HARGA POKOK PENJUALAN (HPP)', 'Periode': -cogs, '': '' },
        { 'Laporan Laba Rugi': 'LABA KOTOR', 'Periode': grossProfit, '': `Margin: ${grossMargin.toFixed(1)}%` },
        { 'Laporan Laba Rugi': '', 'Periode': '', '': '' },
        { 'Laporan Laba Rugi': 'BEBAN OPERASIONAL', 'Periode': '', '': '' },
        { 'Laporan Laba Rugi': '  Biaya Operasional Toko', 'Periode': -opex, '': '' },
        { 'Laporan Laba Rugi': '  Pembelian Stok (Kas)', 'Periode': -stockPurchases, '': '' },
        { 'Laporan Laba Rugi': '', 'Periode': '', '': '' },
        { 'Laporan Laba Rugi': 'LABA BERSIH', 'Periode': netIncome, '': `Net Margin: ${netMargin.toFixed(1)}%` },
      ]), 'Laporan Laba Rugi');
    } else {
      const { totalIn, totalOut, netCash, closingBalance, salesCash, capitalIn, stockOut, opexOut, capitalOut } = CF;
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
        { 'Laporan Arus Kas': '', 'Periode': period },
        { 'Laporan Arus Kas': 'SALDO AWAL KAS', 'Periode': openingBalance },
        { 'Laporan Arus Kas': '', 'Periode': '' },
        { 'Laporan Arus Kas': 'KAS MASUK', 'Periode': '' },
        { 'Laporan Arus Kas': '  Penerimaan dari Penjualan', 'Periode': salesCash },
        { 'Laporan Arus Kas': '  Suntikan Modal', 'Periode': capitalIn },
        { 'Laporan Arus Kas': 'Total Kas Masuk', 'Periode': totalIn },
        { 'Laporan Arus Kas': '', 'Periode': '' },
        { 'Laporan Arus Kas': 'KAS KELUAR', 'Periode': '' },
        { 'Laporan Arus Kas': '  Pembelian Stok ke Supplier', 'Periode': -stockOut },
        { 'Laporan Arus Kas': '  Biaya Operasional', 'Periode': -opexOut },
        { 'Laporan Arus Kas': '  Penarikan Modal', 'Periode': -capitalOut },
        { 'Laporan Arus Kas': 'Total Kas Keluar', 'Periode': -totalOut },
        { 'Laporan Arus Kas': '', 'Periode': '' },
        { 'Laporan Arus Kas': 'KENAIKAN/(PENURUNAN) KAS BERSIH', 'Periode': netCash },
        { 'Laporan Arus Kas': 'SALDO AKHIR KAS', 'Periode': closingBalance },
      ]), 'Laporan Arus Kas');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredCashflowItems.map(c => ({
        Tanggal: new Date(c.date).toLocaleDateString('id-ID'),
        Deskripsi: c.description,
        Kategori: c.category,
        Arah: c.direction === 'in' ? 'Masuk' : 'Keluar',
        'Jumlah (Rp)': c.direction === 'in' ? c.amount : -c.amount,
        'Metode Bayar': c.paymentMethod,
        Referensi: c.reference || ''
      }))), 'Detail Arus Kas');
    }
    XLSX.writeFile(wb, `laporan-keuangan-${activeTab}-${dateRange.startDate}-${dateRange.endDate}.xlsx`);
    notify.admin.success('File Excel berhasil diunduh!');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
        <p className="mt-4 text-black font-bold">Memuat laporan keuangan...</p>
      </div>
    </div>
  );

  const tabs: { key: ActiveTab; label: string; Icon: any }[] = [
    { key: 'overview', label: 'Ringkasan & Visual', Icon: LayoutDashboard },
    { key: 'income_statement', label: 'Laba Rugi (P&L)', Icon: TrendingUp },
    { key: 'cashflow', label: 'Arus Kas (Cash Flow)', Icon: Wallet },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-800 font-sans pb-24">
      {/* HEADER + TABS */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-200">
              <BarChart3 size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900">Laporan Keuangan Eksekutif</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{dateRange.startDate} — {dateRange.endDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button onClick={() => window.print()} className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors">
              <Printer size={16} />
            </button>
            <button onClick={handleExport} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all">
              <Download size={15} /><span className="hidden sm:inline">Export Excel</span>
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex gap-1 no-print overflow-x-auto">
          {tabs.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setCurrentPage(1); setCfPage(1); }}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-black whitespace-nowrap border-b-2 transition-all ${isActive ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
              >
                <tab.Icon size={14} />{tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6">
        {/* TOP PERIOD FILTER BAR (Global) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 mb-6 flex flex-wrap items-center gap-3 no-print">
          <div className="flex flex-wrap gap-1.5">
            {(['today', '7days', '30days', 'thisMonth'] as const).map(p => (
              <button
                key={p}
                onClick={() => setQuickPeriod(p)}
                className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-50 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all"
              >
                {p === 'today' ? 'Hari Ini' : p === '7days' ? '7 Hari' : p === '30days' ? '30 Hari' : 'Bulan Ini'}
              </button>
            ))}
          </div>
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={e => { setDateRange({ ...dateRange, startDate: e.target.value }); setCurrentPage(1); setCfPage(1); }}
              className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl py-2 px-3 outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-slate-400 font-bold text-xs">–</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={e => { setDateRange({ ...dateRange, endDate: e.target.value }); setCurrentPage(1); setCfPage(1); }}
              className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl py-2 px-3 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {fetching && (
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold ml-auto">
              <div className="animate-spin w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full" />
              Menghitung data transaksi...
            </div>
          )}
        </div>

        {/* ─── TAB 1: OVERVIEW & VISUALIZATIONS ─── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI METRIC CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: 'Pendapatan', value: IS.salesRev + IS.ongkir, icon: TrendingUp, note: 'Barang & Ongkir', cl: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'HPP', value: IS.cogs, icon: Package, note: 'Modal Terjual', cl: 'text-rose-600', bg: 'bg-rose-50' },
                { label: 'Laba Kotor', value: IS.grossProfit, icon: TrendingUp, note: `GPM ${IS.grossMargin.toFixed(1)}%`, cl: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Pengeluaran', value: IS.opex + IS.stockPurchases, icon: CreditCard, note: 'Operasional & Stok', cl: 'text-orange-600', bg: 'bg-orange-50' },
                { label: 'Laba Bersih', value: IS.netIncome, icon: IS.netIncome >= 0 ? TrendingUp : TrendingDown, note: `NPM ${IS.netMargin.toFixed(1)}%`, highlight: true },
              ].map(card => {
                const Icon = card.icon;
                if (card.highlight) return (
                  <div key={card.label} className={`p-5 rounded-3xl border shadow-sm ${IS.netIncome >= 0 ? 'bg-gradient-to-br from-emerald-600 to-teal-700 border-emerald-500' : 'bg-gradient-to-br from-red-600 to-rose-700 border-red-500'}`}>
                    <div className="p-2 bg-white/20 rounded-2xl w-fit mb-3"><Icon size={16} className="text-white" /></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-1">{card.label}</p>
                    <p className="text-xl font-black text-white leading-tight">{idr(card.value)}</p>
                    <p className="text-[10px] font-bold text-white/60 mt-1">{card.note}</p>
                  </div>
                );
                return (
                  <div key={card.label} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className={`p-2 ${card.bg} rounded-2xl w-fit mb-3`}><Icon size={16} className={card.cl} /></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{card.label}</p>
                    <p className="text-xl font-black text-slate-800 leading-tight">{idr(card.value)}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">{card.note}</p>
                  </div>
                );
              })}
            </div>

            {/* CHARTS ROW 1: DAILY TREND (Pendapatan vs Laba Kotor) */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-extrabold text-slate-900">Tren Keuangan Harian</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Pendapatan vs Laba Kotor per hari</p>
                </div>
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl"><TrendingUp size={18} /></div>
              </div>
              <div className="h-64">
                {dailyChart.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm">Tidak ada data di periode ini</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 700 }} formatter={(v: any) => [idr(Number(v))]} />
                      <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '10px' }} />
                      <Area type="monotone" name="Pendapatan" dataKey="Pendapatan" stroke="#10b981" strokeWidth={2.5} fill="url(#gP)" />
                      <Area type="monotone" name="Laba Kotor" dataKey="Laba Kotor" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gL)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* CHARTS ROW 2: PIE CHARTS (Profit per Channel & Cost Breakdown) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* PIE CHART 1: PROFIT / REVENUE PER CHANNEL */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <PieChartIcon size={17} />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm md:text-base">Distribusi Penjualan per Channel</h3>
                        <p className="text-[11px] text-slate-400 font-medium">Berdasarkan data pesanan selesai</p>
                      </div>
                    </div>
                    {/* View Switcher: Profit vs Omset */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button
                        onClick={() => setChannelViewMode('profit')}
                        className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${channelViewMode === 'profit' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Profit
                      </button>
                      <button
                        onClick={() => setChannelViewMode('revenue')}
                        className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${channelViewMode === 'revenue' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Omset
                      </button>
                    </div>
                  </div>

                  {/* Donut Chart */}
                  <div className="h-60 relative flex items-center justify-center">
                    {(channelViewMode === 'profit' ? channelStats.profitPieData : channelStats.revenuePieData).length === 0 ? (
                      <div className="text-center py-12 text-slate-400 font-bold text-xs">Belum ada data channel di periode ini</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={channelViewMode === 'profit' ? channelStats.profitPieData : channelStats.revenuePieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={58}
                            outerRadius={88}
                            paddingAngle={4}
                            stroke="#ffffff"
                            strokeWidth={2}
                          >
                            {(channelViewMode === 'profit' ? channelStats.profitPieData : channelStats.revenuePieData).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.12)', fontSize: '11px', fontWeight: 800 }}
                            formatter={(val: any, name: any, item: any) => [
                              `${idr(Number(val))} (${item.payload.percent.toFixed(1)}%)`,
                              channelViewMode === 'profit' ? `Laba Channel ${name}` : `Omset Channel ${name}`
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                    {/* Center Stat */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {channelViewMode === 'profit' ? 'Total Profit' : 'Total Omset'}
                      </span>
                      <span className="text-sm font-black text-slate-800">
                        {idr(channelViewMode === 'profit' ? channelStats.totalProfit : channelStats.totalRev)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Channel Legend & Ranking */}
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {channelStats.list.map((ch, idx) => (
                    <div key={ch.channel} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getChannelColor(ch.channel, idx) }} />
                        <span className="text-[11px] font-black text-slate-700 truncate">{ch.channel}</span>
                      </div>
                      <p className="text-xs font-black text-slate-900">{idr(channelViewMode === 'profit' ? ch.profit : ch.revenue)}</p>
                      <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mt-1">
                        <span>Margin: <strong className="text-slate-600">{ch.margin.toFixed(0)}%</strong></span>
                        <span>{ch.count} PO</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PIE CHART 2: EXPENSE BREAKDOWN */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                        <CreditCard size={17} />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm md:text-base">Struktur Beban & Pengeluaran</h3>
                        <p className="text-[11px] text-slate-400 font-medium">HPP vs Belanja Stok vs Beban Operasional</p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-rose-600 px-2.5 py-1 bg-rose-50 rounded-xl">
                      {idr(expenseBreakdown.total)}
                    </span>
                  </div>

                  {/* Donut Chart */}
                  <div className="h-60 relative flex items-center justify-center">
                    {expenseBreakdown.items.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 font-bold text-xs">Belum ada data pengeluaran di periode ini</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={expenseBreakdown.items}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={58}
                            outerRadius={88}
                            paddingAngle={4}
                            stroke="#ffffff"
                            strokeWidth={2}
                          >
                            {expenseBreakdown.items.map((entry, index) => (
                              <Cell key={`exp-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.12)', fontSize: '11px', fontWeight: 800 }}
                            formatter={(val: any, name: any) => [
                              `${idr(Number(val))} (${expenseBreakdown.total > 0 ? ((Number(val) / expenseBreakdown.total) * 100).toFixed(1) : 0}%)`,
                              name
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Beban</span>
                      <span className="text-sm font-black text-rose-600">{idr(expenseBreakdown.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Expense Breakdown List */}
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                  {expenseBreakdown.items.map(item => {
                    const pct = expenseBreakdown.total > 0 ? (item.value / expenseBreakdown.total) * 100 : 0;
                    return (
                      <div key={item.name} className="flex items-center justify-between text-xs py-1 px-2 rounded-xl hover:bg-slate-50">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="font-bold text-slate-700">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-slate-900">{idr(item.value)}</span>
                          <span className="text-[10px] font-bold text-slate-400 ml-2">({pct.toFixed(1)}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* TRANSACTIONS TABLE + EXTENSIVE FILTER CONTROLS */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-xl"><FileText size={16} /></div>
                    <div>
                      <h3 className="font-extrabold text-slate-800">Daftar Transaksi Keuangan</h3>
                      <p className="text-[11px] text-slate-400 font-medium">Filter berdasarkan channel, kategori, tipe, atau metode pembayaran</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasActiveRecordFilters && (
                      <button
                        onClick={resetRecordFilters}
                        className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors"
                      >
                        <RotateCcw size={12} />Reset Filter
                      </button>
                    )}
                    <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                      {filteredRecords.length} / {records.length} baris
                    </span>
                  </div>
                </div>

                {/* MULTI-FILTER BAR FOR FILTERED RECORDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-2">
                  {/* Search Query */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari transaksi..."
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Channel Filter */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                    <Filter size={12} className="text-slate-400 flex-shrink-0" />
                    <select
                      value={selectedChannel}
                      onChange={e => { setSelectedChannel(e.target.value); setCurrentPage(1); }}
                      className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer truncate"
                    >
                      <option value="ALL">Semua Channel</option>
                      {availableChannels.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Category Filter */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                    <Tag size={12} className="text-slate-400 flex-shrink-0" />
                    <select
                      value={selectedCategory}
                      onChange={e => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                      className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer truncate"
                    >
                      <option value="ALL">Semua Kategori</option>
                      {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Transaction Type Filter */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                    <Layers size={12} className="text-slate-400 flex-shrink-0" />
                    <select
                      value={selectedType}
                      onChange={e => { setSelectedType(e.target.value); setCurrentPage(1); }}
                      className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer truncate"
                    >
                      <option value="ALL">Semua Tipe</option>
                      <option value="profit">Penjualan & Retur</option>
                      <option value="expense">Pengeluaran & Belanja</option>
                      <option value="income">Pendapatan Lain / Ongkir</option>
                    </select>
                  </div>

                  {/* Payment Method Filter */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                    <CreditCard size={12} className="text-slate-400 flex-shrink-0" />
                    <select
                      value={selectedPaymentMethod}
                      onChange={e => { setSelectedPaymentMethod(e.target.value); setCurrentPage(1); }}
                      className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer truncate"
                    >
                      <option value="ALL">Semua Pembayaran</option>
                      {availablePaymentMethods.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50">
                    <tr>
                      {['Tanggal', 'Keterangan', 'Pendapatan', 'HPP / Beban', 'Laba Bersih', 'Kategori & Channel'].map(h => (
                        <th key={h} className={`px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ${['Pendapatan', 'HPP / Beban', 'Laba Bersih'].includes(h) ? 'text-right' : ''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-16 text-slate-400 font-bold">
                          Tidak ada transaksi yang cocok dengan filter aktif
                        </td>
                      </tr>
                    ) : paginatedRecords.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors group">
                        <td className="px-5 py-3.5">
                          <p className="text-xs font-bold text-slate-700">{new Date(r.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                          <p className="text-[10px] text-slate-400">{new Date(r.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                        </td>
                        <td className="px-5 py-3.5 max-w-xs">
                          <p className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-emerald-700">{r.description}</p>
                          <div className="flex gap-1.5 mt-1">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-black text-slate-500 uppercase">{r.paymentMethod}</span>
                            {r.channel && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-[9px] font-black text-indigo-500 uppercase">{r.channel}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`text-xs font-black ${r.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {r.type === 'expense' ? '−' : '+'}{idr(r.amount)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {r.cost !== undefined ? (
                            <span className="text-xs font-bold text-slate-500">{idr(r.cost)}</span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {r.profit !== undefined ? (
                            <span className={`text-xs font-black ${r.profit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                              {idr(r.profit)}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                            {r.category}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-slate-50 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-400">
                    Menampilkan {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredRecords.length)} dari {filteredRecords.length}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs font-black text-slate-600 self-center px-1">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: INCOME STATEMENT ─── */}
        {activeTab === 'income_statement' && (() => {
          const { salesRev, ongkir, returns, netRevenue, cogs, grossProfit, opex, stockPurchases, netIncome, grossMargin, netMargin } = IS;
          const isProfit = netIncome >= 0;
          return (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-7 text-white relative overflow-hidden">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">Laporan Laba Rugi Komprehensif</p>
                    <h2 className="text-2xl font-black mb-1">Income Statement (P&L)</h2>
                    <p className="text-sm text-white/60 font-medium">{dateRange.startDate} — {dateRange.endDate}</p>
                  </div>
                  <div className={`text-right px-5 py-3 rounded-2xl ${isProfit ? 'bg-emerald-500/20 border border-emerald-400/30' : 'bg-red-500/20 border border-red-400/30'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Laba Bersih</p>
                    <p className={`text-2xl font-black mt-1 ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>{idr(netIncome)}</p>
                    <p className={`text-xs font-bold mt-0.5 ${isProfit ? 'text-emerald-300/70' : 'text-red-300/70'}`}>Net Margin {netMargin.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total Pendapatan', value: netRevenue, color: 'text-emerald-400' },
                    { label: 'Total HPP', value: cogs, color: 'text-rose-400' },
                    { label: 'Laba Kotor', value: grossProfit, color: 'text-blue-400' }
                  ].map(s => (
                    <div key={s.label} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">{s.label}</p>
                      <p className={`text-lg font-black ${s.color}`}>{idr(s.value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                    <h3 className="font-extrabold text-slate-800 flex items-center gap-2"><FileText size={16} />Struktur Laba Rugi</h3>
                  </div>
                  <div className="p-6 space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-2 pb-1">Pendapatan</div>
                    {[
                      { label: 'Penjualan Barang', value: salesRev },
                      { label: 'Pendapatan Ongkir', value: ongkir },
                      { label: 'Retur Penjualan', value: -returns, neg: returns > 0 }
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-slate-50">
                        <span className="text-sm pl-3 text-slate-600 font-medium">{row.label}</span>
                        <span className={`text-sm font-bold ${row.neg ? 'text-rose-600' : 'text-slate-800'}`}>{idr(row.value)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-100 mt-2">
                      <span className="text-sm font-black text-emerald-800">Total Pendapatan Bersih</span>
                      <span className="text-sm font-black text-emerald-700">{idr(netRevenue)}</span>
                    </div>

                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-4 pb-1">Harga Pokok Penjualan (HPP)</div>
                    <div className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-slate-50">
                      <span className="text-sm pl-3 text-slate-600 font-medium">Modal Produk Terjual (COGS)</span>
                      <span className="text-sm font-bold text-rose-600">{idr(-cogs)}</span>
                    </div>
                    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-blue-50 border border-blue-100 mt-2">
                      <span className="text-sm font-black text-blue-800">
                        Laba Kotor <span className="text-[10px] font-bold text-blue-500 ml-1">GPM {grossMargin.toFixed(1)}%</span>
                      </span>
                      <span className="text-sm font-black text-blue-700">{idr(grossProfit)}</span>
                    </div>

                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-4 pb-1">Beban Operasional</div>
                    {[
                      { label: 'Biaya Operasional Toko', value: -opex },
                      { label: 'Pembelian Stok (Kas Keluar)', value: -stockPurchases }
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-slate-50">
                        <span className="text-sm pl-3 text-slate-600 font-medium">{row.label}</span>
                        <span className="text-sm font-bold text-rose-600">{idr(row.value)}</span>
                      </div>
                    ))}
                    <div className={`flex items-center justify-between py-3.5 px-4 rounded-2xl mt-3 ${isProfit ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-red-600 to-rose-600'}`}>
                      <div>
                        <span className="text-sm font-black text-white">Laba Bersih</span>
                        <span className="text-[10px] font-black text-white/70 ml-2">NPM {netMargin.toFixed(1)}%</span>
                      </div>
                      <span className="text-lg font-black text-white">{idr(netIncome)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                    <h3 className="font-extrabold text-slate-800 mb-4 flex items-center gap-2">
                      <Lightbulb size={16} className="text-amber-500" />Analisis Rasio Margin
                    </h3>
                    <div className="space-y-4">
                      {[
                        { label: 'Gross Profit Margin (GPM)', value: grossMargin, desc: grossMargin >= 30 ? 'Sangat Sehat' : grossMargin >= 15 ? 'Normal' : 'Perhatian (Tipis)', color: grossMargin >= 30 ? 'emerald' : grossMargin >= 15 ? 'blue' : 'rose' },
                        { label: 'Net Profit Margin (NPM)', value: netMargin, desc: netMargin >= 15 ? 'Sangat Efisien' : netMargin >= 5 ? 'Cukup Sehat' : netMargin > 0 ? 'Margin Tipis' : 'Merugi', color: netMargin >= 15 ? 'emerald' : netMargin >= 5 ? 'blue' : netMargin > 0 ? 'amber' : 'rose' },
                      ].map(m => (
                        <div key={m.label}>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-bold text-slate-700">{m.label}</span>
                            <span className="text-sm font-black text-slate-800">{m.value.toFixed(1)}%</span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${m.color === 'emerald' ? 'bg-emerald-500' : m.color === 'blue' ? 'bg-blue-500' : m.color === 'amber' ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, Math.max(0, m.value))}%` }} />
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 mt-1">{m.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-slate-900 rounded-3xl p-6 text-white">
                    <h3 className="font-extrabold mb-3 flex items-center gap-2"><CheckCircle size={16} className="text-emerald-400" />Rekomendasi Akuntansi</h3>
                    <p className="text-xs text-white/60 font-medium leading-relaxed">
                      {IS.grossMargin < 15 ? '⚠️ Margin kotor terlalu tipis. Pertimbangkan menaikkan harga jual atau evaluasi harga pembelian bahan/stok dari supplier.' : IS.netMargin < 5 && IS.netMargin > 0 ? '⚡ Laba bersih tipis. Periksa kembali pengeluaran operasional non-produktif.' : IS.netIncome < 0 ? '🔴 Bisnis sedang mengalami defisit/rugi. Evaluasi menyeluruh pada harga jual dan kontrol stok segera diperlukan.' : '✅ Kondisi keuangan sehat! Terus pertahankan efisiensi operasional dan tingkatkan volume pesanan.'}
                    </p>
                    <button onClick={handleExport} className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-colors">
                      <Download size={14} />Export Laporan Laba Rugi (Excel)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ─── TAB 3: CASHFLOW ─── */}
        {activeTab === 'cashflow' && (() => {
          const { inflows, outflows, totalIn, totalOut, netCash, closingBalance, salesCash, capitalIn, stockOut, opexOut, capitalOut } = CF;
          const isPos = netCash >= 0;

          // Subtotals for filtered view
          const filteredInTotal = filteredCashflowItems.filter(c => c.direction === 'in').reduce((s, c) => s + c.amount, 0);
          const filteredOutTotal = filteredCashflowItems.filter(c => c.direction === 'out').reduce((s, c) => s + c.amount, 0);

          return (
            <div className="space-y-6">
              {/* Cashflow Header Card */}
              <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-3xl p-7 text-white relative overflow-hidden">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">Laporan Arus Kas Nyata</p>
                    <h2 className="text-2xl font-black mb-1">Cash Flow Statement</h2>
                    <p className="text-sm text-white/60 font-medium">{dateRange.startDate} — {dateRange.endDate}</p>
                  </div>
                  <div className={`text-right px-5 py-3 rounded-2xl ${isPos ? 'bg-emerald-500/20 border border-emerald-400/30' : 'bg-red-500/20 border border-red-400/30'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Saldo Akhir Kas</p>
                    <p className={`text-2xl font-black mt-1 ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>{idr(closingBalance)}</p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Saldo Awal Kas', value: openingBalance, cl: 'text-white/80' },
                    { label: 'Kas Masuk', value: totalIn, cl: 'text-emerald-400' },
                    { label: 'Kas Keluar', value: totalOut, cl: 'text-rose-400' },
                    { label: 'Net Arus Kas', value: netCash, cl: isPos ? 'text-emerald-400' : 'text-red-400' }
                  ].map(s => (
                    <div key={s.label} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">{s.label}</p>
                      <p className={`text-base font-black ${s.cl}`}>{idr(s.value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cashflow Daily Trend Bar Chart */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="font-extrabold text-slate-800">Tren Arus Kas Harian</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Perbandingan uang riil masuk vs keluar</p>
                  </div>
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl"><Wallet size={18} /></div>
                </div>
                <div className="h-56">
                  {cfChart.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm">Belum ada data arus kas</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cfChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barSize={16} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 700 }} formatter={(v: any) => [idr(Number(v))]} />
                        <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '10px' }} />
                        <Bar name="Kas Masuk" dataKey="Kas Masuk" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar name="Kas Keluar" dataKey="Kas Keluar" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Formal Report + Filterable Detail Cash Flow Table */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Formal Statement */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                    <h3 className="font-extrabold text-slate-800">Laporan Arus Kas Formal</h3>
                  </div>
                  <div className="p-5 space-y-1">
                    <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50 rounded-xl mb-2">
                      <span className="text-sm font-bold text-slate-700">Saldo Awal Kas</span>
                      <span className="text-sm font-black text-slate-800">{idr(openingBalance)}</span>
                    </div>

                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-2 pb-1">Aktivitas Operasi & Kas Masuk</div>
                    {[
                      { label: 'Penerimaan Penjualan', value: salesCash },
                      { label: 'Suntikan Modal (Ekuitas)', value: capitalIn }
                    ].map(r => (
                      <div key={r.label} className="flex justify-between py-2 px-3 rounded-xl hover:bg-slate-50">
                        <span className="text-xs text-slate-600 font-medium pl-2">{r.label}</span>
                        <span className="text-xs font-bold text-emerald-600">+{idr(r.value)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-100 mt-1">
                      <span className="text-xs font-black text-emerald-800">Total Kas Masuk</span>
                      <span className="text-xs font-black text-emerald-700">+{idr(totalIn)}</span>
                    </div>

                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-3 pb-1">Pengeluaran Kas</div>
                    {[
                      { label: 'Pembelian Stok ke Supplier', value: stockOut },
                      { label: 'Biaya Operasional Toko', value: opexOut },
                      { label: 'Penarikan Modal / Prive', value: capitalOut }
                    ].map(r => (
                      <div key={r.label} className="flex justify-between py-2 px-3 rounded-xl hover:bg-slate-50">
                        <span className="text-xs text-slate-600 font-medium pl-2">{r.label}</span>
                        <span className="text-xs font-bold text-rose-600">−{idr(r.value)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2.5 px-3 rounded-xl bg-rose-50 border border-rose-100 mt-1">
                      <span className="text-xs font-black text-rose-800">Total Kas Keluar</span>
                      <span className="text-xs font-black text-rose-700">−{idr(totalOut)}</span>
                    </div>

                    <div className="flex justify-between py-2.5 px-3 rounded-xl bg-slate-100 border border-slate-200 mt-2">
                      <span className="text-xs font-black text-slate-700">Kenaikan/(Penurunan) Kas</span>
                      <span className={`text-xs font-black ${isPos ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {isPos ? '+' : ''}{idr(netCash)}
                      </span>
                    </div>

                    <div className="flex justify-between py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 mt-1">
                      <span className="text-sm font-black text-white">Saldo Akhir Kas</span>
                      <span className="text-lg font-black text-white">{idr(closingBalance)}</span>
                    </div>
                  </div>
                </div>

                {/* Filterable Detail Cashflow Items Table */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden lg:col-span-2 flex flex-col justify-between">
                  <div>
                    <div className="p-5 border-b border-slate-100 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-extrabold text-slate-800">Detail Mutasi Arus Kas</h3>
                          <p className="text-[11px] text-slate-400 font-medium">Lacak setiap aliran kas masuk dan keluar beserta sumbernya</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasActiveCfFilters && (
                            <button
                              onClick={resetCfFilters}
                              className="px-2.5 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-black flex items-center gap-1 transition-colors"
                            >
                              <RotateCcw size={11} />Reset
                            </button>
                          )}
                          <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                            {filteredCashflowItems.length} transaksi
                          </span>
                        </div>
                      </div>

                      {/* Cashflow Filters */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                        {/* Search input */}
                        <div className="relative">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Cari arus kas..."
                            value={cfSearch}
                            onChange={e => { setCfSearch(e.target.value); setCfPage(1); }}
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {/* Direction filter */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                          <Filter size={12} className="text-slate-400 flex-shrink-0" />
                          <select
                            value={cfDirection}
                            onChange={e => { setCfDirection(e.target.value as any); setCfPage(1); }}
                            className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                          >
                            <option value="ALL">Semua Arah</option>
                            <option value="in">Kas Masuk (+)</option>
                            <option value="out">Kas Keluar (−)</option>
                          </select>
                        </div>

                        {/* Category filter */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                          <Tag size={12} className="text-slate-400 flex-shrink-0" />
                          <select
                            value={cfCategory}
                            onChange={e => { setCfCategory(e.target.value); setCfPage(1); }}
                            className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer truncate"
                          >
                            <option value="ALL">Semua Kategori</option>
                            {availableCfCategories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        {/* Payment method filter */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                          <CreditCard size={12} className="text-slate-400 flex-shrink-0" />
                          <select
                            value={cfPaymentMethod}
                            onChange={e => { setCfPaymentMethod(e.target.value); setCfPage(1); }}
                            className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer truncate"
                          >
                            <option value="ALL">Semua Metode</option>
                            {availableCfPaymentMethods.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Filter subtotal badge */}
                      {hasActiveCfFilters && (
                        <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-bold">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg">
                            Masuk Terfilter: +{idr(filteredInTotal)}
                          </span>
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-lg">
                            Keluar Terfilter: −{idr(filteredOutTotal)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50/90 sticky top-0 z-10 backdrop-blur-sm">
                          <tr>
                            {['Tanggal', 'Deskripsi', 'Kategori', 'Arah', 'Jumlah'].map(h => (
                              <th key={h} className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 ${h === 'Jumlah' ? 'text-right' : ''}`}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredCashflowItems.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-16 text-slate-400 font-bold">
                                Tidak ada data mutasi kas yang cocok
                              </td>
                            </tr>
                          ) : paginatedCfItems.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50/60 transition-colors group">
                              <td className="px-5 py-3">
                                <p className="text-xs font-bold text-slate-700">{new Date(c.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                              </td>
                              <td className="px-5 py-3">
                                <p className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-blue-700">{c.description}</p>
                                <div className="flex gap-1.5 mt-0.5">
                                  <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded">{c.paymentMethod}</span>
                                  {c.reference && <span className="text-[9px] font-mono text-slate-400">Ref: #{c.reference.slice(-6)}</span>}
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-slate-100 text-slate-600">
                                  {c.category}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                <div className={`flex items-center gap-1 text-xs font-black w-fit px-2.5 py-1 rounded-lg ${c.direction === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                  {c.direction === 'in' ? <ArrowUpCircle size={11} /> : <ArrowDownCircle size={11} />}
                                  {c.direction === 'in' ? 'Masuk' : 'Keluar'}
                                </div>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <span className={`text-sm font-black ${c.direction === 'in' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {c.direction === 'in' ? '+' : '−'}{idr(c.amount)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Cashflow Footer & Pagination */}
                  <div className="p-4 border-t border-slate-50 space-y-3">
                    {totalCfPages > 1 && (
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-slate-400">Hal {cfPage} dari {totalCfPages}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCfPage(p => Math.max(1, p - 1))}
                            disabled={cfPage === 1}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                          >
                            <ChevronLeft size={13} />
                          </button>
                          <button
                            onClick={() => setCfPage(p => Math.min(totalCfPages, p + 1))}
                            disabled={cfPage === totalCfPages}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                          >
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={handleExport}
                      className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-black text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Download size={14} />Export Laporan Arus Kas (Excel)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <style jsx global>{`
        @media print {
          .no-print, header, aside, nav, footer { display: none !important; }
          body { background: white !important; color: #0f172a !important; }
          .max-w-7xl { max-width: 100% !important; padding: 0 !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { padding: 8px 12px !important; border-bottom: 1px solid #e2e8f0 !important; }
        }
      `}</style>
    </div>
  );
}
