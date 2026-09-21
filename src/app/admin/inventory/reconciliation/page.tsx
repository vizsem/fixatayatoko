'use client';

import { useState, useMemo, useEffect } from 'react';
import { adjustStockTx } from '@/lib/inventory';
import { postJournal } from '@/lib/ledger';
import useProducts from '@/lib/hooks/useProducts';
import type { NormalizedProduct } from '@/lib/normalize';
import { getWarehouses } from '@/lib/actions/inventory.actions';
import {
  ArrowLeft,
  RotateCcw,
  Search,
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Package,
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
  Filter,
  Warehouse as WarehouseIcon,
  DollarSign,
  Info,
  Check,
  X,
  Layers,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { db, doc, runTransaction } from '@/lib/firebase';

/** Compute stock expressed in each configured unit */
function stockInUnits(stock: number, units?: { code: string; contains?: number }[]): { code: string; qty: number; contains: number }[] {
  if (!units || units.length === 0 || stock <= 0) return [];
  return units
    .filter(u => u.contains && u.contains > 1)
    .map(u => ({ code: u.code, qty: Math.floor(stock / u.contains!), contains: u.contains! }))
    .filter(u => u.qty > 0);
}

function StockUnitDisplay({ stock, units }: { stock: number; units?: { code: string; contains?: number }[] }) {
  const conversions = stockInUnits(stock, units);
  if (conversions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {conversions.map(c => (
        <span key={c.code} className="text-[9px] font-bold bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-md px-1.5 py-0.5 uppercase tracking-wider">
          {c.qty} {c.code}
        </span>
      ))}
    </div>
  );
}

interface ReconciliationItem {
  product: NormalizedProduct;
  systemStock: number;
  physicalStock: number;      // always in BASE unit (PCS)
  physicalInputQty: number;   // what user typed
  physicalInputUnit: string;  // unit user is entering in
  difference: number;
  differenceValue: number;    // difference * costPrice
  status: 'matched' | 'surplus' | 'deficit';
}

function getSystemStockForWarehouse(product: NormalizedProduct, whId: string): number {
  if (product.stockByWarehouse && typeof product.stockByWarehouse === 'object') {
    if (whId in product.stockByWarehouse) {
      return Number(product.stockByWarehouse[whId] ?? 0);
    }
  }
  if (whId === 'gudang-utama') {
    return Number(product.stock ?? 0);
  }
  return 0;
}

export default function StockReconciliationPage() {
  const { products, loading: productsLoading } = useProducts({ isActive: true, orderByField: 'name' });
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('gudang-utama');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'matched' | 'mismatched'>('all');
  const [reconciliationItems, setReconciliationItems] = useState<ReconciliationItem[]>([]);
  const [reconciliationNote, setReconciliationNote] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Fetch real warehouses
  useEffect(() => {
    async function loadWarehouses() {
      try {
        const whList = await getWarehouses();
        if (whList && whList.length > 0) {
          setWarehouses(whList);
          if (!whList.some(w => w.id === selectedWarehouse)) {
            setSelectedWarehouse(whList[0].id);
          }
        } else {
          setWarehouses([
            { id: 'gudang-utama', name: 'Gudang Utama' }
          ]);
        }
      } catch (err) {
        console.error('Failed to load warehouses:', err);
        setWarehouses([{ id: 'gudang-utama', name: 'Gudang Utama' }]);
      }
    }
    loadWarehouses();
  }, []);

  // Build items when products or selectedWarehouse change
  useEffect(() => {
    if (products.length > 0) {
      const items: ReconciliationItem[] = products.map(p => {
        const sysStock = getSystemStockForWarehouse(p, selectedWarehouse);
        const costPrice = Number(p.Modal || p.purchasePrice || 0);
        return {
          product: p,
          systemStock: sysStock,
          physicalStock: sysStock,
          physicalInputQty: sysStock,
          physicalInputUnit: p.unit || 'PCS',
          difference: 0,
          differenceValue: 0,
          status: 'matched' as const
        };
      });
      setReconciliationItems(items);
    }
  }, [products, selectedWarehouse]);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filter products based on search, category, and status
  const filteredItems = useMemo(() => {
    return reconciliationItems.filter(item => {
      const nameMatch = item.product.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      const skuMatch = (item.product as any).sku?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      const barcodeMatch = item.product.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      const matchesSearch = nameMatch || skuMatch || barcodeMatch;

      const matchesCat = selectedCategory === 'all' || item.product.category === selectedCategory;

      let matchesFilter = true;
      if (filterStatus === 'matched') {
        matchesFilter = item.status === 'matched';
      } else if (filterStatus === 'mismatched') {
        matchesFilter = item.status !== 'matched';
      }

      return matchesSearch && matchesCat && matchesFilter;
    });
  }, [reconciliationItems, searchTerm, selectedCategory, filterStatus]);

  // Statistics
  const stats = useMemo(() => {
    const total = reconciliationItems.length;
    const matched = reconciliationItems.filter(i => i.status === 'matched').length;
    const surplusItems = reconciliationItems.filter(i => i.status === 'surplus');
    const deficitItems = reconciliationItems.filter(i => i.status === 'deficit');
    const surplus = surplusItems.length;
    const deficit = deficitItems.length;
    const mismatched = surplus + deficit;

    const surplusVal = surplusItems.reduce((acc, i) => acc + i.differenceValue, 0);
    const deficitVal = deficitItems.reduce((acc, i) => acc + Math.abs(i.differenceValue), 0);
    const netVariance = surplusVal - deficitVal;

    return { total, matched, surplus, deficit, mismatched, surplusVal, deficitVal, netVariance };
  }, [reconciliationItems]);

  // Update physical stock for a product
  const updatePhysicalStock = (productId: string, inputQty: number, inputUnit?: string) => {
    setReconciliationItems(prev => prev.map(item => {
      if (item.product.id === productId) {
        const unit = inputUnit ?? item.physicalInputUnit;
        const unitDef = item.product.units?.find(u => u.code.toUpperCase() === unit.toUpperCase());
        const contains = unitDef?.contains && unitDef.contains > 0 ? unitDef.contains : 1;
        const physicalStock = Math.round(inputQty * contains);
        const difference = physicalStock - item.systemStock;
        const status = difference === 0 ? 'matched' : difference > 0 ? 'surplus' : 'deficit';
        const costPrice = Number(item.product.Modal || item.product.purchasePrice || 0);
        const differenceValue = difference * costPrice;

        return {
          ...item,
          physicalInputQty: inputQty,
          physicalInputUnit: unit,
          physicalStock,
          difference,
          differenceValue,
          status
        };
      }
      return item;
    }));
  };

  // Reset single item
  const resetSingleItem = (productId: string) => {
    setReconciliationItems(prev => prev.map(item => {
      if (item.product.id === productId) {
        return {
          ...item,
          physicalStock: item.systemStock,
          physicalInputQty: item.systemStock,
          physicalInputUnit: item.product.unit || 'PCS',
          difference: 0,
          differenceValue: 0,
          status: 'matched'
        };
      }
      return item;
    }));
  };

  // Reset all items to match system stock
  const resetAllToSystem = () => {
    setReconciliationItems(prev => prev.map(item => ({
      ...item,
      physicalStock: item.systemStock,
      physicalInputQty: item.systemStock,
      physicalInputUnit: item.product.unit || 'PCS',
      difference: 0,
      differenceValue: 0,
      status: 'matched'
    })));
    notify.admin.info('Semua stok fisik disetel sama dengan stok sistem');
  };

  // Execute reconciliation
  const executeReconcile = async () => {
    const mismatchedItems = reconciliationItems.filter(item => item.status !== 'matched');

    if (mismatchedItems.length === 0) {
      notify.admin.warning('Tidak ada perbedaan stok untuk direkonsiliasi');
      setShowConfirmModal(false);
      return;
    }

    setLoading(true);
    try {
      const adminId = (await supabase.auth.getUser()).data.user?.id || 'system';
      const timestamp = new Date().toISOString();

      await runTransaction(db, async (tx) => {
        const productRefs = mismatchedItems.map(item => doc(db, 'products', item.product.id));
        const pSnaps = await Promise.all(productRefs.map(ref => tx.get(ref)));

        for (let i = 0; i < mismatchedItems.length; i++) {
          const item = mismatchedItems[i];
          const productRef = productRefs[i];
          const pSnap = pSnaps[i];

          if (!pSnap.exists()) {
            throw new Error(`Produk ${item.product.name} tidak ditemukan`);
          }

          const data = pSnap.data();
          const currentTotal = Number(data.stock || 0);
          const stockByWarehouse = data.stockByWarehouse || {};
          const currentWhStock = Number(stockByWarehouse[selectedWarehouse] ?? (selectedWarehouse === 'gudang-utama' ? currentTotal : 0));

          // Difference in this warehouse
          const totalDiff = item.physicalStock - currentWhStock;
          let newWarehouseStock = currentWhStock + totalDiff;
          if (newWarehouseStock < 0) newWarehouseStock = 0;

          await adjustStockTx(tx, {
            productId: item.product.id,
            newStock: newWarehouseStock,
            warehouseId: selectedWarehouse,
            adminId,
            source: 'RECONCILIATION',
            note: reconciliationNote || `Rekonsiliasi stok [${selectedWarehouse}]: selisih ${totalDiff > 0 ? '+' : ''}${totalDiff} ${item.product.unit || 'pcs'}`,
            prefetchedSnap: pSnap
          });

          // Post to ledger if there is a difference
          if (totalDiff !== 0) {
            const costPrice = Number(data.Modal || data.purchasePrice || 0);
            const diffValue = Math.abs(totalDiff) * costPrice;

            if (diffValue > 0) {
              if (totalDiff < 0) {
                await postJournal({
                  debitAccount: 'LossOnInventory',
                  creditAccount: 'Inventory',
                  amount: diffValue,
                  memo: `Rekonsiliasi Kurang (${Math.abs(totalDiff)} ${data.unit || 'pcs'}): ${reconciliationNote || 'Penyesuaian Fisik'}`,
                  referenceId: `RECON-${timestamp}-${item.product.id}`,
                  postedBy: adminId
                }, tx);
              } else {
                await postJournal({
                  debitAccount: 'Inventory',
                  creditAccount: 'GainOnInventory',
                  amount: diffValue,
                  memo: `Rekonsiliasi Lebih (+${totalDiff} ${data.unit || 'pcs'}): ${reconciliationNote || 'Penyesuaian Fisik'}`,
                  referenceId: `RECON-${timestamp}-${item.product.id}`,
                  postedBy: adminId
                }, tx);
              }
            }
          }
        }
      });

      notify.admin.success(`Rekonsiliasi berhasil! ${mismatchedItems.length} produk disesuaikan.`);

      // Reset after successful reconciliation
      setReconciliationItems(prev => prev.map(item => ({
        ...item,
        systemStock: item.physicalStock,
        physicalInputQty: item.physicalStock,
        physicalInputUnit: item.product.unit || 'PCS',
        difference: 0,
        differenceValue: 0,
        status: 'matched'
      })));

      setReconciliationNote('');
      setShowConfirmModal(false);
    } catch (error: any) {
      console.error('Reconciliation error:', error);
      notify.admin.error(`Gagal melakukan rekonsiliasi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Export reconciliation report
  const exportReport = () => {
    const mismatchedItems = reconciliationItems.filter(item => item.status !== 'matched');

    if (mismatchedItems.length === 0) {
      notify.admin.warning('Tidak ada data perbedaan untuk diekspor');
      return;
    }

    const csvContent = [
      ['SKU', 'Nama Produk', 'Gudang', 'Satuan', 'Stok Sistem', 'Stok Fisik', 'Selisih', 'HPP/Modal', 'Nilai Selisih (Rp)', 'Status'].join(','),
      ...mismatchedItems.map(item => [
        (item.product as any).sku || '',
        `"${item.product.name.replace(/"/g, '""')}"`,
        selectedWarehouse,
        item.product.unit || 'pcs',
        item.systemStock,
        item.physicalStock,
        item.difference,
        item.product.Modal || item.product.purchasePrice || 0,
        item.differenceValue,
        item.status.toUpperCase()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation-${selectedWarehouse}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    notify.admin.success('Laporan rekonsiliasi berhasil diunduh');
  };

  if (productsLoading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-slate-200 rounded-2xl w-1/3"></div>
            <div className="grid grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-28 bg-slate-200 rounded-2xl"></div>
              ))}
            </div>
            <div className="h-96 bg-slate-200 rounded-3xl"></div>
          </div>
        </div>
      </div>
    );
  }

  const selectedWhName = warehouses.find(w => w.id === selectedWarehouse)?.name || selectedWarehouse;

  return (
    <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen pb-36 font-sans text-slate-800">
      <Toaster position="top-right" />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/admin/inventory" className="p-2.5 hover:bg-slate-100 rounded-2xl transition-all border border-slate-200 text-slate-600 hover:text-slate-900">
                <ArrowLeft size={18} />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <ClipboardCheck className="text-blue-600" size={26} />
                    <span>Rekonsiliasi Stok</span>
                  </h1>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                    Stock Opname
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Cocokkan stok sistem dengan stok fisik
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={resetAllToSystem}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-all flex items-center gap-2 active:scale-95"
            >
              <RotateCcw size={14} className="text-slate-400" /> Reset Semua
            </button>
            <button
              onClick={exportReport}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-all flex items-center gap-2 active:scale-95"
            >
              <Download size={14} className="text-slate-400" /> Export CSV
            </button>
            {stats.mismatched > 0 && (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-black shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 active:scale-95"
              >
                <ClipboardCheck size={16} /> Rekonsiliasi ({stats.mismatched})
              </button>
            )}
          </div>
        </div>

        {/* Statistics & Financial Variance Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider">Total Produk</span>
              <Package size={16} />
            </div>
            <div className="text-2xl font-black text-slate-900">{stats.total}</div>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Item di katalog aktif</p>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow transition-all">
            <div className="flex items-center justify-between text-emerald-500 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cocok</span>
              <CheckCircle2 size={16} />
            </div>
            <div className="text-2xl font-black text-emerald-600">{stats.matched}</div>
            <p className="text-[10px] text-emerald-600/80 font-semibold mt-1">Stok 100% akurat</p>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow transition-all">
            <div className="flex items-center justify-between text-blue-500 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Surplus</span>
              <TrendingUp size={16} />
            </div>
            <div className="text-2xl font-black text-blue-600">+{stats.surplus}</div>
            <p className="text-[10px] text-blue-600/80 font-semibold mt-1">
              +Rp {stats.surplusVal.toLocaleString('id-ID')}
            </p>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow transition-all">
            <div className="flex items-center justify-between text-rose-500 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Defisit</span>
              <TrendingDown size={16} />
            </div>
            <div className="text-2xl font-black text-rose-600">-{stats.deficit}</div>
            <p className="text-[10px] text-rose-600/80 font-semibold mt-1">
              -Rp {stats.deficitVal.toLocaleString('id-ID')}
            </p>
          </div>

          <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-3xl shadow-sm hover:shadow transition-all">
            <div className="flex items-center justify-between text-slate-300 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider">Perlu Aksi</span>
              <AlertCircle size={16} className={stats.mismatched > 0 ? 'text-amber-400' : 'text-slate-400'} />
            </div>
            <div className="text-2xl font-black text-amber-400">{stats.mismatched}</div>
            <p className="text-[10px] text-slate-300 font-medium mt-1 truncate">
              Net: Rp {stats.netVariance.toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-center">
            {/* Search Input */}
            <div className="relative md:col-span-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                id="recon-search"
                name="recon-search"
                type="text"
                placeholder="Cari SKU, Barcode, atau Nama Produk..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Warehouse Selector */}
            <div className="relative md:col-span-3">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 focus-within:border-blue-500 focus-within:bg-white transition-all">
                <WarehouseIcon size={16} className="text-slate-400 flex-shrink-0" />
                <select
                  id="recon-warehouse-select"
                  name="recon-warehouse-select"
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold outline-none py-1 cursor-pointer text-slate-800"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category Filter */}
            <div className="relative md:col-span-3">
              <select
                id="recon-category-filter"
                name="recon-category-filter"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none cursor-pointer focus:border-blue-500 focus:bg-white transition-all text-slate-800"
              >
                <option value="all">Semua Kategori</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative md:col-span-2">
              <select
                id="recon-status-filter"
                name="recon-status-filter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none cursor-pointer focus:border-blue-500 focus:bg-white transition-all text-slate-800"
              >
                <option value="all">Semua Status</option>
                <option value="matched">Cocok Saja</option>
                <option value="mismatched">Perlu Aksi (Selisih)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-1 border-t border-slate-100">
            <span className="font-medium">
              Menampilkan <span className="font-bold text-slate-900">{filteredItems.length}</span> dari {reconciliationItems.length} produk di <span className="font-bold text-blue-600">{selectedWhName}</span>
            </span>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span> Status Cocok
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 ml-2"></span> Status Surplus
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500 ml-2"></span> Status Defisit
            </div>
          </div>
        </div>

        {/* Reconciliation Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-4 w-5/12">Informasi Produk</th>
                  <th className="px-4 py-4 text-right w-2/12">Stok Sistem ({selectedWhName})</th>
                  <th className="px-4 py-4 text-right w-2.5/12">Fisik Opname</th>
                  <th className="px-4 py-4 text-right w-1.5/12">Selisih & Nilai</th>
                  <th className="px-4 py-4 text-center w-1/12">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredItems.map((item) => {
                  const costPrice = Number(item.product.Modal || item.product.purchasePrice || 0);
                  const isMismatched = item.status !== 'matched';

                  return (
                    <tr
                      key={item.product.id}
                      className={`transition-colors hover:bg-slate-50/60 ${
                        item.status === 'surplus' ? 'bg-blue-50/20' :
                        item.status === 'deficit' ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Product details */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-400">
                            {item.product.imageUrl ? (
                              <img
                                src={item.product.imageUrl}
                                alt={item.product.name}
                                className="w-full h-full object-cover rounded-2xl"
                              />
                            ) : (
                              <Package size={20} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-black text-slate-900 truncate">{item.product.name}</div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {(item.product as any).sku || item.product.barcode || item.product.id.slice(0, 8)}
                              </span>
                              {item.product.category && (
                                <span className="text-[10px] font-semibold text-slate-500">
                                  {item.product.category}
                                </span>
                              )}
                              {costPrice > 0 && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  HPP: Rp {costPrice.toLocaleString('id-ID')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* System Stock */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex flex-col items-end">
                          <div className="text-sm font-black text-slate-900">
                            {item.systemStock.toLocaleString('id-ID')}{' '}
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{item.product.unit || 'pcs'}</span>
                          </div>
                          <StockUnitDisplay stock={item.systemStock} units={item.product.units} />
                        </div>
                      </td>

                      {/* Physical Stock Input */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="number"
                              min="0"
                              value={item.physicalInputQty}
                              onChange={(e) => updatePhysicalStock(item.product.id, parseFloat(e.target.value) || 0, item.physicalInputUnit)}
                              className={`w-20 px-2.5 py-1.5 text-right rounded-xl text-xs font-black outline-none border transition-all ${
                                isMismatched
                                  ? 'border-amber-400 bg-amber-50/40 focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
                                  : 'border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white'
                              }`}
                            />
                            {item.product.units && item.product.units.length > 1 ? (
                              <select
                                value={item.physicalInputUnit}
                                onChange={(e) => updatePhysicalStock(item.product.id, item.physicalInputQty, e.target.value)}
                                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-[10px] font-bold outline-none cursor-pointer uppercase text-slate-700 transition-colors"
                              >
                                {item.product.units.map(u => (
                                  <option key={u.code} value={u.code}>{u.code}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-500 uppercase px-1">
                                {item.product.unit || 'pcs'}
                              </span>
                            )}
                          </div>

                          {/* Conversion Preview & quick sync */}
                          <div className="flex items-center justify-end gap-2">
                            {item.physicalInputUnit.toUpperCase() !== (item.product.unit || 'PCS').toUpperCase() && (
                              <span className="text-[10px] font-bold text-blue-600">
                                = {item.physicalStock} {item.product.unit || 'pcs'}
                              </span>
                            )}
                            {isMismatched && (
                              <button
                                type="button"
                                onClick={() => resetSingleItem(item.product.id)}
                                title="Setel sama dengan sistem"
                                className="text-[9px] font-bold text-slate-400 hover:text-blue-600 hover:underline"
                              >
                                Cocokkan
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Difference */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex flex-col items-end">
                          <div className={`inline-flex items-center gap-1 text-xs font-black ${
                            item.difference === 0 ? 'text-slate-400' :
                            item.difference > 0 ? 'text-blue-600' : 'text-rose-600'
                          }`}>
                            {item.difference > 0 ? <TrendingUp size={14} /> :
                             item.difference < 0 ? <TrendingDown size={14} /> : null}
                            {item.difference > 0 ? '+' : ''}{item.difference}{' '}
                            <span className="text-[9px] font-semibold uppercase">{item.product.unit || 'pcs'}</span>
                          </div>

                          {item.difference !== 0 && (
                            <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
                              {item.differenceValue > 0 ? '+' : ''}Rp {item.differenceValue.toLocaleString('id-ID')}
                            </div>
                          )}

                          {item.difference !== 0 && (
                            <StockUnitDisplay stock={Math.abs(item.difference)} units={item.product.units} />
                          )}
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          item.status === 'matched' ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-200' :
                          item.status === 'surplus' ? 'bg-blue-100/80 text-blue-800 border border-blue-200' :
                          'bg-rose-100/80 text-rose-800 border border-rose-200'
                        }`}>
                          {item.status === 'matched' ? <CheckCircle2 size={12} className="text-emerald-600" /> : <AlertCircle size={12} />}
                          {item.status === 'matched' ? 'COCOK' :
                           item.status === 'surplus' ? 'SURPLUS' : 'DEFISIT'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredItems.length === 0 && (
            <div className="py-16 text-center">
              <FileText size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-600">Tidak ada produk yang sesuai filter</p>
              <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau status</p>
            </div>
          )}
        </div>

        {/* Bottom Floating Bar when differences exist */}
        {stats.mismatched > 0 && (
          <div className="fixed bottom-6 left-4 right-4 md:left-8 md:right-8 max-w-7xl mx-auto z-40">
            <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 md:p-5 rounded-3xl shadow-2xl border border-slate-700/80 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    Terdapat {stats.mismatched} Produk dengan Selisih Stok
                  </h3>
                  <p className="text-xs text-slate-400">
                    Net Dampak Nilai Aset: <span className={stats.netVariance >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {stats.netVariance >= 0 ? '+' : ''}Rp {stats.netVariance.toLocaleString('id-ID')}
                    </span> di {selectedWhName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={resetAllToSystem}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition-all border border-slate-700"
                >
                  Batal / Reset
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
                >
                  <ClipboardCheck size={16} /> Rekonsiliasi Sekarang
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-5 animate-scale-up">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <ClipboardCheck size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Konfirmasi Rekonsiliasi Stok</h3>
                    <p className="text-xs text-slate-500">Penyesuaian stok sistem & pencatatan jurnal akuntansi</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Summary of changes */}
              <div className="bg-slate-50 p-4 rounded-2xl space-y-2 border border-slate-200/80 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Gudang Sasaran:</span>
                  <span className="font-bold text-slate-900">{selectedWhName}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Jumlah Produk Selisih:</span>
                  <span className="font-bold text-slate-900">{stats.mismatched} produk</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Surplus Fisik:</span>
                  <span className="font-bold text-blue-600">+{stats.surplus} item (+Rp {stats.surplusVal.toLocaleString('id-ID')})</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Defisit Fisik:</span>
                  <span className="font-bold text-rose-600">-{stats.deficit} item (-Rp {stats.deficitVal.toLocaleString('id-ID')})</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-slate-900">
                  <span>Net Variansi Aset:</span>
                  <span className={stats.netVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {stats.netVariance >= 0 ? '+' : ''}Rp {stats.netVariance.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Note input */}
              <div>
                <label htmlFor="reconciliation-modal-note" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Catatan / Nomor Berita Acara Opname
                </label>
                <input
                  id="reconciliation-modal-note"
                  name="reconciliation-modal-note"
                  type="text"
                  placeholder="Contoh: Hasil Stock Opname Akhir Bulan..."
                  value={reconciliationNote}
                  onChange={(e) => setReconciliationNote(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowConfirmModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={executeReconcile}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-black shadow-md shadow-blue-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Ya, Rekonsiliasi Sekarang
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

