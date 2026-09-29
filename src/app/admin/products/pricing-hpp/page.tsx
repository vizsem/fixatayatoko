'use client';

import { useEffect, useState, useMemo, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DollarSign, TrendingUp, Package, Search,
  ArrowUpDown, Download, Edit3, AlertTriangle,
  History, ArrowLeft, RefreshCw, X, Save, Layers,
  ChevronRight, Percent, Sparkles, AlertCircle, RotateCcw,
  CheckSquare, Square, CheckCircle2, Info, Zap, Split
} from 'lucide-react';
import * as XLSX from 'xlsx';
import notify from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { getUserAndRole } from '@/lib/supabase-helpers';
import { collection, db, getDocs, limit, orderBy, query, addDoc } from '@/lib/firebase';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';
import {
  updateProductPrice,
  getAllProductsAvgHpp,
  resetAvgHppForProducts,
  bulkUpdateTargetMargin,
  bulkDivideHpp,
} from '@/lib/actions/product.actions';

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

interface AvgHppInfo {
  avgCost: number;
  totalQty: number;
  poCount: number;
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
  const [avgLoading, setAvgLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [avgHppMap, setAvgHppMap] = useState<Record<string, AvgHppInfo>>({});
  const [costLogs, setCostLogs] = useState<CostPriceLog[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [marginFilter, setMarginFilter] = useState<'ALL' | 'HEALTHY' | 'SLIM' | 'CRITICAL' | 'NEGATIVE'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'marginPct_desc' | 'marginPct_asc' | 'cost_desc' | 'price_desc' | 'stock_desc' | 'avg_diff'>('name');

  // Multi-select States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showResetModal, setShowResetModal] = useState(false);
  const [showMarginModal, setShowMarginModal] = useState(false);
  const [targetMarginValue, setTargetMarginValue] = useState<number>(20);
  const [showDivideModal, setShowDivideModal] = useState(false);
  const [divideValue, setDivideValue] = useState<number>(1);
  const [isResetting, startResetTransition] = useTransition();

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

  // Fetch Avg HPP from PO history (server action, runs once)
  const fetchAvgHpp = useCallback(async () => {
    setAvgLoading(true);
    try {
      const map = await getAllProductsAvgHpp();
      setAvgHppMap(map);
    } catch (err) {
      console.warn('Gagal memuat AVG HPP dari PO:', err);
    } finally {
      setAvgLoading(false);
    }
  }, []);

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
      setSelectedIds(new Set()); // reset selection on reload

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
    fetchAvgHpp();
  }, [fetchData, fetchAvgHpp]);

  // KPIs
  const kpis = useMemo(() => {
    const totalCount = products.length;
    let totalStockValue = 0;
    let totalPotentialRevenue = 0;
    let totalPotentialProfit = 0;
    let totalMarginPctSum = 0;
    let validMarginCount = 0;
    let avgDriftCount = 0; // products where costPrice != avgCost significantly

    products.forEach(p => {
      totalStockValue += Math.max(0, p.inventoryValue);
      totalPotentialRevenue += Math.max(0, p.potentialRevenue);
      totalPotentialProfit += p.potentialProfit;
      if (p.priceEcer > 0) {
        totalMarginPctSum += p.marginPct;
        validMarginCount++;
      }
      const avg = avgHppMap[p.id];
      if (avg && avg.avgCost > 0 && Math.abs(avg.avgCost - p.costPrice) > 100) {
        avgDriftCount++;
      }
    });

    const avgMarginPct = validMarginCount > 0 ? totalMarginPctSum / validMarginCount : 0;

    return {
      totalCount,
      totalStockValue,
      totalPotentialRevenue,
      totalPotentialProfit,
      avgMarginPct,
      avgDriftCount,
    };
  }, [products, avgHppMap]);

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
        if (sortBy === 'avg_diff') {
          const diffA = Math.abs((avgHppMap[a.id]?.avgCost ?? a.costPrice) - a.costPrice);
          const diffB = Math.abs((avgHppMap[b.id]?.avgCost ?? b.costPrice) - b.costPrice);
          return diffB - diffA;
        }
        return a.name.localeCompare(b.name);
      });
  }, [products, search, selectedCategory, marginFilter, sortBy, avgHppMap]);

  // Multi-select helpers
  const allFilteredIds = useMemo(() => filteredProducts.map(p => p.id), [filteredProducts]);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));
  const someSelected = allFilteredIds.some(id => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allFilteredIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allFilteredIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Products that have AVG data and are selected
  const selectedWithAvg = useMemo(() => {
    return Array.from(selectedIds).filter(id => {
      const avg = avgHppMap[id];
      return avg && avg.avgCost > 0;
    });
  }, [selectedIds, avgHppMap]);

  const selectedWithoutAvg = useMemo(() => {
    return Array.from(selectedIds).filter(id => {
      const avg = avgHppMap[id];
      return !avg || avg.avgCost <= 0;
    });
  }, [selectedIds, avgHppMap]);

  // Reset AVG HPP Handler
  const handleResetAvgHpp = () => {
    if (selectedIds.size === 0) {
      notify.error('Pilih minimal 1 produk terlebih dahulu');
      return;
    }
    setShowResetModal(true);
  };

  const handleConfirmReset = () => {
    startResetTransition(async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const adminEmail = userRes.data.user?.email || 'admin';

        const result = await resetAvgHppForProducts(
          Array.from(selectedIds),
          avgHppMap,
          adminEmail,
        );

        setShowResetModal(false);

        if (!result.success) throw new Error(result.error);

        let msg = `✅ Berhasil update ${result.updated} produk`;
        if (result.skipped > 0) msg += ` · ${result.skipped} dilewati (tidak ada data PO)`;
        notify.success(msg);

        setSelectedIds(new Set());
        await fetchData();
        await fetchAvgHpp();
      } catch (err: any) {
        setShowResetModal(false);
        notify.error(err.message || 'Gagal mereset AVG HPP');
      }
    });
  };

  // Bulk Target Margin Handlers
  const handleSetTargetMargin = () => {
    if (selectedIds.size === 0) {
      notify.error('Pilih minimal 1 produk terlebih dahulu');
      return;
    }
    setShowMarginModal(true);
  };

  const handleConfirmTargetMargin = () => {
    startResetTransition(async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const adminEmail = userRes.data.user?.email || 'admin';

        const result = await bulkUpdateTargetMargin(
          Array.from(selectedIds),
          targetMarginValue,
          adminEmail,
        );

        setShowMarginModal(false);

        if (!result.success) throw new Error(result.error);

        notify.success(`✅ Berhasil menyesuaikan harga jual ecer untuk ${result.updated} produk`);

        setSelectedIds(new Set());
        await fetchData();
      } catch (err: any) {
        setShowMarginModal(false);
        notify.error(err.message || 'Gagal mengatur target margin');
      }
    });
  };

  // Bulk Divide HPP Handlers
  const handleSetDivideHpp = () => {
    if (selectedIds.size === 0) {
      notify.error('Pilih minimal 1 produk terlebih dahulu');
      return;
    }
    setShowDivideModal(true);
  };

  const handleConfirmDivideHpp = () => {
    startResetTransition(async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const adminEmail = userRes.data.user?.email || 'admin';

        const result = await bulkDivideHpp(
          Array.from(selectedIds),
          divideValue,
          adminEmail,
        );

        setShowDivideModal(false);

        if (!result.success) throw new Error(result.error);

        notify.success(`✅ Berhasil membagi HPP untuk ${result.updated} produk`);

        setSelectedIds(new Set());
        await fetchData();
      } catch (err: any) {
        setShowDivideModal(false);
        notify.error(err.message || 'Gagal mengkonversi HPP');
      }
    });
  };

  // Open Quick Edit
  const handleOpenEdit = (p: ProductItem) => {
    setEditingProduct(p);
    setEditModalCost(p.costPrice);
    setEditPriceEcer(p.priceEcer);
    setEditPriceGrosir(p.priceGrosir);
    setEditMinGrosir(p.minGrosir);
  };

  // Save Quick Edit
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

      const result = await updateProductPrice({
        productId: editingProduct.id,
        newCost,
        newPrice,
        newGrosir,
        newMinGrosir,
      });

      if (!result.success) throw new Error(result.error || 'Gagal menyimpan');

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
    const rows = filteredProducts.map(p => {
      const avg = avgHppMap[p.id];
      return {
        'SKU / ID': p.sku,
        'Barcode': p.barcode,
        'Nama Produk': p.name,
        'Kategori': p.category,
        'Satuan': p.unit,
        'Stok': p.stock,
        'HPP Aktif (Rp)': p.costPrice,
        'AVG HPP dari PO (Rp)': avg?.avgCost ?? '-',
        'Selisih AVG vs HPP (Rp)': avg ? avg.avgCost - p.costPrice : '-',
        'Total Unit PO': avg?.totalQty ?? '-',
        'Jumlah PO': avg?.poCount ?? '-',
        'Harga Ecer (Jual)': p.priceEcer,
        'Margin (Rp)': p.marginRp,
        'Margin (%)': `${p.marginPct.toFixed(1)}%`,
        'Harga Grosir': p.priceGrosir,
        'Min Grosir': p.minGrosir,
        'Nilai Persediaan Modal': p.inventoryValue,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HPP_dan_Harga_Produk');
    XLSX.writeFile(wb, `Struktur_HPP_Harga_${new Date().toISOString().split('T')[0]}.xlsx`);
    notify.success('Data HPP & Harga berhasil diekspor ke Excel!');
  };

  const selectedCount = selectedIds.size;

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
              Pantau HPP aktif vs AVG dari riwayat PO, harga jual, persentase keuntungan, dan riwayat fluktuasi harga.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => { fetchData(); fetchAvgHpp(); }}
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-blue-600">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Produk Aktif</span>
              <div className="p-2 bg-blue-50 rounded-xl"><Package size={18} /></div>
            </div>
            <p className="text-2xl md:text-3xl font-black text-slate-900">{kpis.totalCount}</p>
            <p className="text-xs font-bold text-slate-400">Siap dijual</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-indigo-600">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Rata-rata Margin</span>
              <div className="p-2 bg-indigo-50 rounded-xl"><Percent size={18} /></div>
            </div>
            <p className={`text-2xl md:text-3xl font-black ${kpis.avgMarginPct >= 15 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {kpis.avgMarginPct.toFixed(1)}%
            </p>
            <p className="text-xs font-bold text-slate-400">Rata-rata laba kotor</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-rose-600">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Total Modal Stok</span>
              <div className="p-2 bg-rose-50 rounded-xl"><Layers size={18} /></div>
            </div>
            <p className="text-lg md:text-xl font-black text-slate-900">
              Rp {kpis.totalStockValue.toLocaleString('id-ID')}
            </p>
            <p className="text-xs font-bold text-slate-400">Nilai aset stok aktif</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-emerald-600">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Potensi Laba Kotor</span>
              <div className="p-2 bg-emerald-50 rounded-xl"><TrendingUp size={18} /></div>
            </div>
            <p className="text-lg md:text-xl font-black text-emerald-600">
              +Rp {kpis.totalPotentialProfit.toLocaleString('id-ID')}
            </p>
            <p className="text-xs font-bold text-slate-400">Estimasi profit jika laku</p>
          </div>

          <div className={`p-5 rounded-3xl border shadow-sm space-y-2 ${kpis.avgDriftCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
            <div className={`flex items-center justify-between ${kpis.avgDriftCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Drift AVG HPP</span>
              <div className={`p-2 rounded-xl ${kpis.avgDriftCount > 0 ? 'bg-amber-100' : 'bg-emerald-50'}`}>
                <AlertTriangle size={18} />
              </div>
            </div>
            <p className={`text-2xl md:text-3xl font-black ${kpis.avgDriftCount > 0 ? 'text-amber-700' : 'text-emerald-600'}`}>
              {avgLoading ? '...' : kpis.avgDriftCount}
            </p>
            <p className="text-xs font-bold text-slate-400">Produk HPP ≠ AVG PO</p>
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
                  <option value="avg_diff">Urut: Selisih AVG Terbesar</option>
                </select>
              </div>
            </div>

            {/* BULK ACTION BAR */}
            {selectedCount > 0 && (
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-3xl shadow-lg shadow-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-2xl">
                    <CheckSquare size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">
                      {selectedCount} produk dipilih
                    </p>
                    <p className="text-xs text-blue-100 font-bold">
                      {selectedWithAvg.length} memiliki data AVG dari PO
                      {selectedWithoutAvg.length > 0 && ` · ${selectedWithoutAvg.length} tidak ada data PO`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5"
                  >
                    <X size={13} />
                    Batal Pilih
                  </button>
                  <button
                    onClick={handleResetAvgHpp}
                    disabled={selectedWithAvg.length === 0}
                    className="px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RotateCcw size={13} />
                    Restart AVG HPP ({selectedWithAvg.length})
                  </button>
                  <button
                    onClick={handleSetTargetMargin}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border border-emerald-400"
                  >
                    <TrendingUp size={13} />
                    Set Margin Otomatis
                  </button>
                  <button
                    onClick={handleSetDivideHpp}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border border-amber-400"
                  >
                    <Split size={13} />
                    Bagi HPP (Konversi)
                  </button>
                </div>
              </div>
            )}

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
                        {/* Checkbox Column */}
                        <th className="py-4 pl-6 pr-2">
                          <button
                            onClick={toggleSelectAll}
                            className="p-1 hover:text-blue-600 transition-colors"
                            title={allSelected ? 'Batalkan semua' : 'Pilih semua'}
                          >
                            {allSelected ? (
                              <CheckSquare size={17} className="text-blue-600" />
                            ) : someSelected ? (
                              <div className="w-[17px] h-[17px] border-2 border-blue-400 rounded-sm flex items-center justify-center">
                                <div className="w-2 h-2 bg-blue-400 rounded-sm" />
                              </div>
                            ) : (
                              <Square size={17} />
                            )}
                          </button>
                        </th>
                        <th className="py-4 px-4">Produk & SKU</th>
                        <th className="py-4 px-4 text-center">Stok</th>
                        <th className="py-4 px-4 text-right">HPP Aktif</th>
                        <th className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Sparkles size={12} className="text-amber-500" />
                            AVG HPP (PO)
                          </div>
                        </th>
                        <th className="py-4 px-4 text-right">Harga Jual (Ecer)</th>
                        <th className="py-4 px-4 text-right">Margin (Rp / %)</th>
                        <th className="py-4 px-4 text-right">Grosir / Min Qty</th>
                        <th className="py-4 px-6 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredProducts.map(p => {
                        const isHealthy = p.marginPct >= 20;
                        const isSlim = p.marginPct >= 8 && p.marginPct < 20;
                        const isLoss = p.marginPct <= 0;
                        const avg = avgHppMap[p.id];
                        const avgDiff = avg ? avg.avgCost - p.costPrice : null;
                        const hasDrift = avg && avg.avgCost > 0 && Math.abs(avgDiff!) > 100;
                        const isSelected = selectedIds.has(p.id);

                        return (
                          <tr
                            key={p.id}
                            className={`hover:bg-slate-50/60 transition-colors group ${isSelected ? 'bg-blue-50/40' : ''}`}
                          >
                            {/* Checkbox */}
                            <td className="py-4 pl-6 pr-2">
                              <button
                                onClick={() => toggleSelectOne(p.id)}
                                className="p-1 hover:text-blue-600 transition-colors"
                              >
                                {isSelected
                                  ? <CheckSquare size={17} className="text-blue-600" />
                                  : <Square size={17} className="text-slate-300 group-hover:text-slate-400" />
                                }
                              </button>
                            </td>

                            {/* Produk Info */}
                            <td className="py-4 px-4">
                              <div className="space-y-0.5">
                                <Link
                                  href={`/admin/products/edit/${p.id}`}
                                  className="font-black text-slate-900 hover:text-blue-600 transition-colors uppercase line-clamp-1"
                                >
                                  {p.name}
                                </Link>
                                <div className="flex items-center gap-2 text-slate-400 font-mono text-[10px]">
                                  <span>SKU: {p.sku}</span>
                                  {p.barcode && <span>• {p.barcode}</span>}
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded font-sans text-slate-500 font-bold">{p.category}</span>
                                </div>
                              </div>
                            </td>

                            {/* Stok & Satuan */}
                            <td className="py-4 px-4 text-center">
                              <span className="font-black text-slate-800">{p.stock}</span>
                              <span className="text-[10px] text-slate-400 font-bold ml-1 uppercase">{p.unit}</span>
                            </td>

                            {/* Modal HPP Aktif */}
                            <td className="py-4 px-4 text-right">
                              <p className="font-black text-slate-800">Rp {p.costPrice.toLocaleString('id-ID')}</p>
                              <p className="text-[10px] text-slate-400 font-bold">/{p.unit}</p>
                            </td>

                            {/* AVG HPP dari PO */}
                            <td className="py-4 px-4 text-right">
                              {avgLoading ? (
                                <div className="h-4 w-20 bg-slate-100 rounded animate-pulse ml-auto" />
                              ) : avg && avg.avgCost > 0 ? (
                                <div>
                                  <p className={`font-black ${hasDrift ? 'text-amber-700' : 'text-emerald-700'}`}>
                                    Rp {avg.avgCost.toLocaleString('id-ID')}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-bold">
                                    {avg.poCount} PO · {avg.totalQty.toLocaleString()} {p.unit}
                                  </p>
                                  {hasDrift && (
                                    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                                      avgDiff! > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                                    }`}>
                                      {avgDiff! > 0 ? '+' : ''}{avgDiff!.toLocaleString('id-ID')}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 font-bold text-[11px]">Belum ada PO</span>
                              )}
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

                            {/* Aksi */}
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

                {/* TABLE FOOTER */}
                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-400">
                    Menampilkan <span className="text-slate-700">{filteredProducts.length}</span> dari <span className="text-slate-700">{products.length}</span> produk aktif
                  </p>
                  {selectedCount > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleResetAvgHpp}
                        disabled={selectedWithAvg.length === 0}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <RotateCcw size={13} />
                        Restart AVG HPP
                      </button>
                      <button
                        onClick={handleSetTargetMargin}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all"
                      >
                        <TrendingUp size={13} />
                        Set Margin
                      </button>
                      <button
                        onClick={handleSetDivideHpp}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all"
                      >
                        <Split size={13} />
                        Bagi HPP
                      </button>
                    </div>
                  )}
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
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">{dateStr}</td>
                          <td className="py-3.5 px-4 font-black text-slate-800 uppercase">{l.productName || l.productId}</td>
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

      {/* ===================== QUICK EDIT MODAL ===================== */}
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

            {/* Show AVG in modal */}
            {avgHppMap[editingProduct.id] && avgHppMap[editingProduct.id].avgCost > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
                <Sparkles size={16} className="text-amber-600 shrink-0" />
                <div>
                  <p className="text-xs font-black text-amber-800">
                    AVG HPP dari PO: <span className="text-amber-700">Rp {avgHppMap[editingProduct.id].avgCost.toLocaleString('id-ID')}</span>
                  </p>
                  <p className="text-[10px] text-amber-600 font-bold">
                    Berdasarkan {avgHppMap[editingProduct.id].poCount} PO · {avgHppMap[editingProduct.id].totalQty.toLocaleString()} unit
                  </p>
                </div>
                <button
                  onClick={() => setEditModalCost(avgHppMap[editingProduct.id].avgCost)}
                  className="ml-auto px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-xl text-[10px] font-black shrink-0 transition-colors"
                >
                  Pakai AVG
                </button>
              </div>
            )}

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

      {/* ===================== RESET AVG CONFIRMATION MODAL ===================== */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-100 rounded-2xl shrink-0">
                <RotateCcw size={22} className="text-amber-700" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Konfirmasi Restart AVG HPP</h3>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  Tindakan ini akan mengganti HPP aktif produk dengan rata-rata harga beli dari riwayat PO.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">Produk dipilih</span>
                <span className="font-black text-slate-900">{selectedCount} produk</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">Memiliki data AVG dari PO</span>
                <span className="font-black text-emerald-700">{selectedWithAvg.length} produk ✓</span>
              </div>
              {selectedWithoutAvg.length > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600">Tidak ada data PO (dilewati)</span>
                  <span className="font-black text-slate-400">{selectedWithoutAvg.length} produk</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-2">
              <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 font-bold">
                AVG HPP dihitung dari rata-rata harga beli per unit di semua PO yang sudah diterima (status bukan CANCELLED). Harga jual ecer tidak berubah.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={isResetting || selectedWithAvg.length === 0}
                className="px-6 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition-all flex items-center gap-2 shadow-sm shadow-amber-200 disabled:opacity-60"
              >
                {isResetting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    Ya, Restart AVG HPP ({selectedWithAvg.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SET MARGIN OTOMATIS MODAL ===================== */}
      {showMarginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-100 rounded-2xl shrink-0">
                <TrendingUp size={22} className="text-emerald-700" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Set Harga Jual Otomatis</h3>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  Atur ulang Harga Jual (Ecer) berdasarkan HPP aktif dan persentase margin yang diinginkan.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-600">Produk dipilih</span>
                <span className="font-black text-slate-900">{selectedCount} produk</span>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-500">Target Margin Laba</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={targetMarginValue}
                    onChange={e => setTargetMarginValue(Number(e.target.value))}
                    className="w-full pl-4 pr-10 py-3 bg-white border border-slate-300 rounded-2xl font-black text-lg text-emerald-700 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-lg">%</span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-1 text-right">
                  Rumus: Harga Baru = HPP / (1 - Margin%)
                </p>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-2">
              <Info size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-700 font-bold">
                Harga baru akan dibulatkan ke atas (ke kelipatan Rp100 terdekat) agar terlihat rapi. Produk dengan HPP Rp0 akan dilewati.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowMarginModal(false)}
                disabled={isResetting}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmTargetMargin}
                disabled={isResetting || targetMarginValue <= 0}
                className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all flex items-center gap-2 shadow-sm shadow-emerald-200 disabled:opacity-60"
              >
                {isResetting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    Terapkan Margin ({selectedCount})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== BAGI HPP (KONVERSI) MODAL ===================== */}
      {showDivideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-100 rounded-2xl shrink-0">
                <Split size={22} className="text-amber-700" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Bagi HPP (Konversi Satuan)</h3>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  Membagi harga modal (HPP) aktif produk untuk memperbaiki data PO yang masuk dalam kemasan besar (misal: CTN dibagi isi per PCS).
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-600">Produk dipilih</span>
                <span className="font-black text-slate-900">{selectedCount} produk</span>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-500">Angka Pembagi</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-lg">÷</div>
                  <input
                    type="number"
                    min="2"
                    step="1"
                    value={divideValue}
                    onChange={e => setDivideValue(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-2xl font-black text-lg text-amber-700 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-1 text-right">
                  Contoh: Jika modal Rp120.000/CTN, dibagi 24 = Rp5.000/PCS
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-2">
              <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 font-bold">
                Tindakan ini akan membagi HPP aktif (Modal) saat ini dengan angka di atas. Harga jual (Ecer/Grosir) TIDAK akan diubah.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowDivideModal(false)}
                disabled={isResetting}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDivideHpp}
                disabled={isResetting || divideValue <= 1}
                className="px-6 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition-all flex items-center gap-2 shadow-sm shadow-amber-200 disabled:opacity-60"
              >
                {isResetting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    Bagi HPP ({selectedCount})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
