'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DollarSign, TrendingUp, TrendingDown, Package, Search, Filter,
  ArrowUpDown, Download, Edit3, CheckCircle2, AlertTriangle,
  History, ArrowLeft, RefreshCw, X, Save, Eye, Layers, ChevronRight,
  Percent, Sparkles, AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import notify from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { getUserAndRole } from '@/lib/supabase-helpers';
import { collection, db, getDocs, limit, orderBy, query, addDoc } from '@/lib/firebase';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';
import { updateProductPrice } from '@/lib/actions/product.actions';

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  unit: string;
  stock: number;
  costPrice: number;
  priceEcer: number;
  priceGrosir: number;
  minGrosir: number;
  isActive: boolean;
  satuanModal?: string;
  marginRp: number;
  marginPct: number;
  inventoryValue: number;
  potentialRevenue: number;
  potentialProfit: number;
}

interface CostPriceLog {
  id: string;
  productId: string;
  productName: string;
  type?: 'MODAL' | 'HARGA_JUAL';
  oldCost?: number;
  newCost?: number;
  oldPrice?: number;
  newPrice?: number;
  adminEmail: string;
  changeDate: any;
  notes?: string;
}

export default function PricingHPPPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [costLogs, setCostLogs] = useState<CostPriceLog[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  // Filter States
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [marginFilter, setMarginFilter] = useState<'ALL' | 'HEALTHY' | 'SLIM' | 'CRITICAL' | 'NEGATIVE'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'marginPct_desc' | 'marginPct_asc' | 'cost_desc' | 'price_desc' | 'stock_desc'>('name');
  
  // Quick Edit Modal
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [editModalCost, setEditModalCost] = useState<number>(0);
  const [editPriceEcer, setEditPriceEcer] = useState<number>(0);
  const [editPriceGrosir, setEditPriceGrosir] = useState<number>(0);
  const [editMinGrosir, setEditMinGrosir] = useState<number>(1);
  const [savingEdit, setSavingEdit] = useState(false);

  // Check auth
  useEffect(() => {
    (async () => {
      const { user, isAdmin } = await getUserAndRole();
      if (!user) return router.push('/admin/login');
      if (!isAdmin) {
        notify.aksesDitolakAdmin();
        return router.push('/profil');
      }
    })();
  }, [router]);

  // Fetch Products & Categories
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .or('is_active.eq.true,is_active.is.null')
        .order('name', { ascending: true })
        .limit(1000);

      if (error) throw error;

      const rawItems = (data || []).map((p: Record<string, any>) => {
        const raw = p.raw_data || {};
        const cost = Number(p.cost_price ?? raw.Modal ?? raw.purchasePrice ?? 0);
        const ecer = Number(p.price ?? raw.Ecer ?? raw.price ?? 0);
        const grosir = Number(raw.Grosir ?? raw.wholesalePrice ?? raw.priceGrosir ?? 0);
        const minG = Number(raw.Min_Grosir ?? raw.minWholesale ?? 1);
        const stk = Number(p.stock ?? raw.Stok ?? raw.stock ?? 0);
        const marginRp = ecer - cost;
        const marginPct = ecer > 0 ? (marginRp / ecer) * 100 : 0;
        const invVal = stk * cost;
        const potRev = stk * ecer;
        const potProf = stk * marginRp;

        return {
          id: p.id,
          name: p.name || raw.Nama || 'Tanpa Nama',
          sku: p.sku || raw.ID || p.id,
          barcode: p.barcode || raw.Barcode || '',
          category: p.category || raw.Kategori || 'UMUM',
          unit: (p.unit || raw.Satuan || 'PCS').toUpperCase(),
          stock: stk,
          costPrice: cost,
          priceEcer: ecer,
          priceGrosir: grosir,
          minGrosir: minG,
          isActive: p.is_active !== false,
          satuanModal: raw.Satuan_Modal || raw.Satuan || p.unit || 'PCS',
          marginRp,
          marginPct,
          inventoryValue: invVal,
          potentialRevenue: potRev,
          potentialProfit: potProf,
        };
      });

      setProducts(rawItems);

      // Collect categories
      const cats = Array.from(new Set(rawItems.map(p => p.category))).filter(Boolean) as string[];
      setCategories(cats.sort());

      // Fetch cost / price change history
      try {
        const qLogs = query(collection(db, 'product_cost_logs'), orderBy('changeDate', 'desc'), limit(150));
        const logSnap = await getDocs(qLogs);
        const logs = logSnap.docs.map(d => ({ id: d.id, ...d.data() } as CostPriceLog));
        setCostLogs(logs);
      } catch (err) {
        console.warn('Gagal load log cost_logs:', err);
      }

    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'Gagal memuat data produk');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // KPIs
  const kpis = useMemo(() => {
    const totalCount = products.length;
    let totalStockValue = 0;
    let totalPotentialRevenue = 0;
    let totalPotentialProfit = 0;
    let totalMarginPctSum = 0;
    let validMarginCount = 0;

    products.forEach(p => {
      totalStockValue += Math.max(0, p.inventoryValue);
      totalPotentialRevenue += Math.max(0, p.potentialRevenue);
      totalPotentialProfit += p.potentialProfit;
      if (p.priceEcer > 0) {
        totalMarginPctSum += p.marginPct;
        validMarginCount++;
      }
    });

    const avgMarginPct = validMarginCount > 0 ? totalMarginPctSum / validMarginCount : 0;

    return {
      totalCount,
      totalStockValue,
      totalPotentialRevenue,
      totalPotentialProfit,
      avgMarginPct,
    };
  }, [products]);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products
      .filter(p => {
        const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q);
        const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
        
        let matchMargin = true;
        if (marginFilter === 'HEALTHY') matchMargin = p.marginPct >= 20;
        else if (marginFilter === 'SLIM') matchMargin = p.marginPct >= 8 && p.marginPct < 20;
        else if (marginFilter === 'CRITICAL') matchMargin = p.marginPct > 0 && p.marginPct < 8;
        else if (marginFilter === 'NEGATIVE') matchMargin = p.marginPct <= 0;

        return matchSearch && matchCat && matchMargin;
      })
      .sort((a, b) => {
        if (sortBy === 'marginPct_desc') return b.marginPct - a.marginPct;
        if (sortBy === 'marginPct_asc') return a.marginPct - b.marginPct;
        if (sortBy === 'cost_desc') return b.costPrice - a.costPrice;
        if (sortBy === 'price_desc') return b.priceEcer - a.priceEcer;
        if (sortBy === 'stock_desc') return b.stock - a.stock;
        return a.name.localeCompare(b.name);
      });
  }, [products, search, selectedCategory, marginFilter, sortBy]);

  // Open Quick Edit
  const handleOpenEdit = (p: ProductItem) => {
    setEditingProduct(p);
    setEditModalCost(p.costPrice);
    setEditPriceEcer(p.priceEcer);
    setEditPriceGrosir(p.priceGrosir);
    setEditMinGrosir(p.minGrosir);
  };

  // Save Quick Edit — menggunakan Server Action agar supabaseAdmin berjalan di server
  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    setSavingEdit(true);
    try {
      const userRes = await supabase.auth.getUser();
      const adminEmail = userRes.data.user?.email || 'admin';

      const oldCost = editingProduct.costPrice;
      const newCost = Number(editModalCost || 0);
      const oldPrice = editingProduct.priceEcer;
      const newPrice = Number(editPriceEcer || 0);
      const newGrosir = Number(editPriceGrosir || 0);
      const newMinGrosir = Number(editMinGrosir || 1);

      // 1. Simpan ke Supabase via Server Action (berjalan di server, bukan browser)
      const result = await updateProductPrice({
        productId: editingProduct.id,
        newCost,
        newPrice,
        newGrosir,
        newMinGrosir,
      });

      if (!result.success) throw new Error(result.error || 'Gagal menyimpan');

      // 2. Catat log audit jika ada perubahan harga (opsional, bisa gagal tanpa blokir)
      const hasCostChanged = oldCost !== newCost;
      const hasPriceChanged = oldPrice !== newPrice;
      if (hasCostChanged || hasPriceChanged) {
        try {
          await addDoc(collection(db, 'product_cost_logs'), {
            productId: editingProduct.id,
            productName: editingProduct.name,
            oldCost,
            newCost,
            oldPrice,
            newPrice,
            adminEmail,
            changeDate: new Date(),
            notes: hasCostChanged && hasPriceChanged
              ? 'Update cepat modal & harga jual'
              : (hasCostChanged ? 'Update cepat harga modal' : 'Update cepat harga jual ecer'),
          });
        } catch (logErr) {
          console.warn('Gagal tulis log audit:', logErr);
        }
      }

      notify.success(`Harga ${editingProduct.name} berhasil diperbarui!`);
      setEditingProduct(null);
      fetchData();
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'Gagal menyimpan harga');
    } finally {
      setSavingEdit(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const rows = filteredProducts.map(p => ({
      'SKU / ID': p.sku,
      'Barcode': p.barcode,
      'Nama Produk': p.name,
      'Kategori': p.category,
      'Satuan': p.unit,
      'Stok': p.stock,
      'Harga Modal (HPP)': p.costPrice,
      'Harga Ecer (Jual)': p.priceEcer,
      'Margin (Rp)': p.marginRp,
      'Margin (%)': `${p.marginPct.toFixed(1)}%`,
      'Harga Grosir': p.priceGrosir,
      'Min Grosir': p.minGrosir,
      'Nilai Persediaan Modal': p.inventoryValue,
      'Potensi Omzet': p.potentialRevenue,
      'Potensi Laba Kotor': p.potentialProfit,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HPP_dan_Harga_Produk');
    XLSX.writeFile(wb, `Struktur_HPP_Harga_${new Date().toISOString().split('T')[0]}.xlsx`);
    notify.success('Data HPP & Harga berhasil diekspor ke Excel!');
  };

  return (
    <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen pb-32">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin/products" className="text-slate-400 hover:text-slate-800 transition-colors p-1.5 hover:bg-slate-100 rounded-xl">
                <ArrowLeft size={18} />
              </Link>
              <span className="text-xs font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                Katalog & Keuangan
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <DollarSign className="text-emerald-600" />
              Struktur HPP, Harga & Margin Produk
            </h1>
            <p className="text-xs md:text-sm text-slate-400 font-bold mt-1">
              Pantau harga modal kulakan, harga jual ecer & grosir, persentase keuntungan, dan riwayat fluktuasi harga produk aktif.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl border border-slate-200 text-xs font-black transition-all flex items-center gap-2"
              title="Refresh Data"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleExportExcel}
              disabled={filteredProducts.length === 0}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm shadow-emerald-200"
            >
              <Download size={16} />
              Export Excel
            </button>
          </div>
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-blue-600">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Produk Aktif</span>
              <div className="p-2 bg-blue-50 rounded-xl"><Package size={18} /></div>
            </div>
            <p className="text-2xl md:text-3xl font-black text-slate-900">{kpis.totalCount}</p>
            <p className="text-xs font-bold text-slate-400">Siap dijual di toko & web</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-indigo-600">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Rata-rata Margin</span>
              <div className="p-2 bg-indigo-50 rounded-xl"><Percent size={18} /></div>
            </div>
            <p className={`text-2xl md:text-3xl font-black ${kpis.avgMarginPct >= 15 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {kpis.avgMarginPct.toFixed(1)}%
            </p>
            <p className="text-xs font-bold text-slate-400">Rata-rata laba kotor ecer</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-rose-600">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Total Modal Persediaan</span>
              <div className="p-2 bg-rose-50 rounded-xl"><Layers size={18} /></div>
            </div>
            <p className="text-xl md:text-2xl font-black text-slate-900">
              Rp {kpis.totalStockValue.toLocaleString('id-ID')}
            </p>
            <p className="text-xs font-bold text-slate-400">Nilai aset modal stok riil</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-emerald-600">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Potensi Laba Kotor</span>
              <div className="p-2 bg-emerald-50 rounded-xl"><TrendingUp size={18} /></div>
            </div>
            <p className="text-xl md:text-2xl font-black text-emerald-600">
              +Rp {kpis.totalPotentialProfit.toLocaleString('id-ID')}
            </p>
            <p className="text-xs font-bold text-slate-400">Estimasi profit jika stok laku</p>
          </div>
        </div>

        {/* TABS SELECTOR */}
        <div className="flex items-center gap-3 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`pb-3 px-2 text-xs md:text-sm font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'catalog'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <DollarSign size={16} />
            Katalog HPP & Margin ({filteredProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-2 text-xs md:text-sm font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <History size={16} />
            Riwayat Perubahan Harga ({costLogs.length})
          </button>
        </div>

        {/* TAB 1: KATALOG HARGA & MARGIN */}
        {activeTab === 'catalog' && (
          <div className="space-y-4">
            
            {/* FILTERS TOOLBAR */}
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama barang, SKU, atau barcode..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Filter Kategori */}
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Semua Kategori</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                {/* Filter Status Margin */}
                <select
                  value={marginFilter}
                  onChange={e => setMarginFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Semua Margin</option>
                  <option value="HEALTHY">🟢 Margin Sehat (≥ 20%)</option>
                  <option value="SLIM">🟡 Margin Sedang (8 - 19%)</option>
                  <option value="CRITICAL">🟠 Margin Tipis (1 - 7%)</option>
                  <option value="NEGATIVE">🔴 Margin Nol / Rugi (≤ 0%)</option>
                </select>

                {/* Urutkan */}
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="name">Urut: Nama (A-Z)</option>
                  <option value="marginPct_desc">Urut: Margin Tertinggi (%)</option>
                  <option value="marginPct_asc">Urut: Margin Terendah (%)</option>
                  <option value="cost_desc">Urut: Modal Terbesar (HPP)</option>
                  <option value="price_desc">Urut: Harga Jual Termahal</option>
                  <option value="stock_desc">Urut: Stok Terbanyak</option>
                </select>
              </div>
            </div>

            {/* TABEL PRODUK */}
            {loading ? (
              <TableSkeleton />
            ) : filteredProducts.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm space-y-3">
                <AlertCircle size={36} className="mx-auto text-slate-300" />
                <p className="text-sm font-black text-slate-700">Tidak ada produk yang cocok dengan filter</p>
                <p className="text-xs text-slate-400">Silakan ubah kata kunci pencarian atau reset filter di atas.</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 uppercase tracking-widest font-black">
                        <th className="py-4 px-6">Produk & SKU</th>
                        <th className="py-4 px-4 text-center">Stok</th>
                        <th className="py-4 px-4 text-right">Harga Modal (HPP)</th>
                        <th className="py-4 px-4 text-right">Harga Jual (Ecer)</th>
                        <th className="py-4 px-4 text-right">Margin (Rp / %)</th>
                        <th className="py-4 px-4 text-right">Grosir / Min Qty</th>
                        <th className="py-4 px-6 text-center">Aksi Cepat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredProducts.map(p => {
                        const isHealthy = p.marginPct >= 20;
                        const isSlim = p.marginPct >= 8 && p.marginPct < 20;
                        const isLoss = p.marginPct <= 0;

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/60 transition-colors group">
                            
                            {/* Produk Info */}
                            <td className="py-4 px-6">
                              <div className="space-y-0.5">
                                <Link
                                  href={`/admin/products/edit/${p.id}`}
                                  className="font-black text-slate-900 hover:text-blue-600 transition-colors uppercase line-clamp-1"
                                >
                                  {p.name}
                                </Link>
                                <div className="flex items-center gap-2 text-slate-400 font-mono text-[10px]">
                                  <span>SKU: {p.sku}</span>
                                  {p.barcode && <span>• Barcode: {p.barcode}</span>}
                                  <span className="bg-slate-100 px-1.5 py-0.2 rounded font-sans text-slate-500 font-bold">{p.category}</span>
                                </div>
                              </div>
                            </td>

                            {/* Stok & Satuan */}
                            <td className="py-4 px-4 text-center">
                              <span className="font-black text-slate-800">{p.stock}</span>
                              <span className="text-[10px] text-slate-400 font-bold ml-1 uppercase">{p.unit}</span>
                            </td>

                            {/* Modal (HPP) */}
                            <td className="py-4 px-4 text-right font-black text-slate-800">
                              Rp {p.costPrice.toLocaleString('id-ID')}
                              <p className="text-[10px] text-slate-400 font-bold">/{p.unit}</p>
                            </td>

                            {/* Harga Jual Ecer */}
                            <td className="py-4 px-4 text-right font-black text-blue-700">
                              Rp {p.priceEcer.toLocaleString('id-ID')}
                              <p className="text-[10px] text-slate-400 font-bold">/{p.unit}</p>
                            </td>

                            {/* Margin Keuntungan */}
                            <td className="py-4 px-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className={`font-black ${isLoss ? 'text-rose-600' : isSlim ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {p.marginRp >= 0 ? '+' : ''}Rp {p.marginRp.toLocaleString('id-ID')}
                                </span>
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  isLoss ? 'bg-rose-50 text-rose-600' : isSlim ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                                }`}>
                                  {p.marginPct.toFixed(1)}%
                                </span>
                              </div>
                            </td>

                            {/* Harga Grosir */}
                            <td className="py-4 px-4 text-right">
                              {p.priceGrosir > 0 ? (
                                <div>
                                  <p className="font-black text-purple-700">Rp {p.priceGrosir.toLocaleString('id-ID')}</p>
                                  <p className="text-[10px] text-slate-400 font-bold">Min: {p.minGrosir} {p.unit}</p>
                                </div>
                              ) : (
                                <span className="text-slate-300 font-bold">-</span>
                              )}
                            </td>

                            {/* Aksi Cepat Edit */}
                            <td className="py-4 px-6 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleOpenEdit(p)}
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-black text-xs transition-colors flex items-center gap-1"
                                >
                                  <Edit3 size={13} />
                                  Ubah
                                </button>
                                <Link
                                  href={`/admin/products/edit/${p.id}`}
                                  className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-colors"
                                  title="Edit Lengkap"
                                >
                                  <ChevronRight size={15} />
                                </Link>
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: RIWAYAT PERUBAHAN HARGA */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Log Audit Perubahan Modal & Harga</h3>
              <p className="text-xs text-slate-400 font-bold">Merekam setiap kali harga modal kulakan supplier atau harga jual ecer produk disesuaikan.</p>
            </div>

            {costLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-2xl">
                Belum ada riwayat perubahan harga yang tercatat.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-widest font-black">
                      <th className="py-3 px-4">Waktu</th>
                      <th className="py-3 px-4">Produk</th>
                      <th className="py-3 px-4 text-right">Modal Lama &rarr; Baru</th>
                      <th className="py-3 px-4 text-right">Harga Jual Lama &rarr; Baru</th>
                      <th className="py-3 px-4">Catatan / Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {costLogs.map(l => {
                      let dateStr = '-';
                      if (l.changeDate?.seconds) {
                        dateStr = new Date(l.changeDate.seconds * 1000).toLocaleString('id-ID');
                      } else if (typeof l.changeDate === 'string') {
                        dateStr = new Date(l.changeDate).toLocaleString('id-ID');
                      }

                      const costDiff = (l.newCost !== undefined && l.oldCost !== undefined) ? l.newCost - l.oldCost : 0;
                      const priceDiff = (l.newPrice !== undefined && l.oldPrice !== undefined) ? l.newPrice - l.oldPrice : 0;

                      return (
                        <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {dateStr}
                          </td>
                          <td className="py-3.5 px-4 font-black text-slate-800 uppercase">
                            {l.productName || l.productId}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {l.oldCost !== undefined && l.newCost !== undefined ? (
                              <div>
                                <span className="text-slate-400 line-through mr-1">Rp {l.oldCost.toLocaleString()}</span>
                                <span className="font-black text-slate-800">&rarr; Rp {l.newCost.toLocaleString()}</span>
                                <span className={`ml-2 text-[10px] font-black ${costDiff >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  ({costDiff >= 0 ? '+' : ''}{costDiff.toLocaleString()})
                                </span>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {l.oldPrice !== undefined && l.newPrice !== undefined ? (
                              <div>
                                <span className="text-slate-400 line-through mr-1">Rp {l.oldPrice.toLocaleString()}</span>
                                <span className="font-black text-blue-700">&rarr; Rp {l.newPrice.toLocaleString()}</span>
                                <span className={`ml-2 text-[10px] font-black ${priceDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  ({priceDiff >= 0 ? '+' : ''}{priceDiff.toLocaleString()})
                                </span>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 font-bold">
                            <p>{l.notes || 'Penyesuaian manual'}</p>
                            <span className="text-[10px] text-slate-400 font-mono">By: {l.adminEmail || 'admin'}</span>
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

      </div>

      {/* QUICK EDIT MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Quick Update Harga
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1 uppercase line-clamp-1">
                  {editingProduct.name}
                </h3>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-slate-400">Harga Modal (HPP)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Rp</span>
                  <input
                    type="number"
                    min="0"
                    value={editModalCost}
                    onChange={e => setEditModalCost(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-slate-400">Harga Jual (Ecer)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Rp</span>
                  <input
                    type="number"
                    min="0"
                    value={editPriceEcer}
                    onChange={e => setEditPriceEcer(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-3 bg-blue-50/60 border border-blue-200 rounded-2xl font-black text-sm text-blue-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-slate-400">Harga Grosir (Opsional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Rp</span>
                  <input
                    type="number"
                    min="0"
                    value={editPriceGrosir}
                    onChange={e => setEditPriceGrosir(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-slate-400">Min. Qty Grosir</label>
                <input
                  type="number"
                  min="1"
                  value={editMinGrosir}
                  onChange={e => setEditMinGrosir(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {/* LIVE PREVIEW MARGIN */}
            {(() => {
              const diffRp = editPriceEcer - editModalCost;
              const diffPct = editPriceEcer > 0 ? (diffRp / editPriceEcer) * 100 : 0;
              return (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-500">Estimasi Margin Laba:</span>
                  <div className="text-right">
                    <span className={`font-black ${diffRp >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {diffRp >= 0 ? '+' : ''}Rp {diffRp.toLocaleString('id-ID')} ({diffPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setEditingProduct(null)}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition-all flex items-center gap-2 shadow-sm shadow-blue-200 disabled:opacity-50"
              >
                {savingEdit ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
