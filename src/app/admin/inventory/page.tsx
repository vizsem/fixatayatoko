'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import {
  Package, Search, AlertTriangle, Warehouse, TrendingDown,
  ArrowDown, ArrowUp, RefreshCw, Filter, BarChart2, CheckCircle, XCircle, Ban,
  DollarSign
} from 'lucide-react';
import { getInventoryBatches, getLowStockProducts, getInventoryMovements, adjustStock, getWarehouses } from '@/lib/actions/inventory.actions';
import { getProducts } from '@/lib/actions/product.actions';
import HppCalculatorModal from '@/components/admin/inventory/HppCalculatorModal';

/** Compute stock expressed in each configured unit */
function stockInUnits(stock: number, units?: { code: string; contains?: number }[]): { code: string; qty: number }[] {
  if (!units || units.length === 0) return [];
  return units
    .filter(u => u.contains && u.contains > 1)
    .map(u => ({ code: u.code, qty: Math.floor(stock / u.contains!) }))
    .filter(u => u.qty > 0);
}

/** Ambang batas "hampir kedaluwarsa": 30 hari dalam milidetik. */
const EXPIRY_SOON_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Selisih waktu (ms) dari sekarang menuju tanggal kedaluwarsa.
 * Diletakkan di module scope agar `Date.now()` tidak dipanggil saat render.
 */
function msUntilExpiry(expiryDate: string): number {
  return new Date(expiryDate).getTime() - Date.now();
}

/** Compact unit-breakdown badges */
function StockUnitDisplay({ stock, units }: { stock: number; units?: { code: string; contains?: number }[] }) {
  const conversions = stockInUnits(stock, units);
  if (conversions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-0.5 mt-0.5">
      {conversions.map(c => (
        <span key={c.code} className="text-xs font-bold bg-blue-50 border border-blue-100 text-blue-600 rounded px-1 py-0.5 uppercase">
          {c.qty} {c.code}
        </span>
      ))}
    </div>
  );
}

type Tab = 'batches' | 'lowstock' | 'movements';

type StatusFilter = 'all' | 'active' | 'inactive';

export default function AdminInventory() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('batches');
  const [batches, setBatches] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustMode, setAdjustMode] = useState<'SET' | 'DELTA'>('SET');
  const [targetStockInput, setTargetStockInput] = useState<string | number>('');
  const [adjustForm, setAdjustForm] = useState<{ productId: string; warehouseId: string; quantity: string | number; notes: string }>({ productId: '', warehouseId: '', quantity: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [quickAdjust, setQuickAdjust] = useState<{ batchId: string; value: string } | null>(null);
  const [hppModalOpen, setHppModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [b, ls, m, w, p] = await Promise.all([
      getInventoryBatches(),
      getLowStockProducts(10),
      getInventoryMovements({ limit: 100 }),
      getWarehouses(),
      getProducts(),
    ]);
    setBatches(b);
    setLowStock(ls);
    setMovements(m);
    setWarehouses(w);
    setProducts(p);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeBatchesCount = useMemo(() => batches.filter(b => b.product?.isActive !== false).length, [batches]);
  const inactiveBatchesCount = useMemo(() => batches.filter(b => b.product?.isActive === false).length, [batches]);

  const filteredBatches = useMemo(() => batches.filter(b => {
    const matchWarehouse = warehouseFilter === 'all' || b.warehouseId === warehouseFilter;
    const matchSearch = b.product.name.toLowerCase().includes(search.toLowerCase()) ||
      b.product.sku.toLowerCase().includes(search.toLowerCase()) ||
      b.batchNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && b.product?.isActive !== false) ||
      (statusFilter === 'inactive' && b.product?.isActive === false);
    return matchWarehouse && matchSearch && matchStatus;
  }), [batches, warehouseFilter, search, statusFilter]);

  const filteredLowStock = useMemo(() => lowStock.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && p.isActive !== false) ||
      (statusFilter === 'inactive' && p.isActive === false);
    return matchSearch && matchStatus;
  }), [lowStock, search, statusFilter]);

  const handleAdjust = async () => {
    if (!adjustForm.productId || !adjustForm.warehouseId) {
      notify.error('Pilih produk dan gudang terlebih dahulu');
      return;
    }

    const selectedProd = products.find(p => p.id === adjustForm.productId);
    const raw = selectedProd?.raw_data || {};
    const stockMap = raw.stockByWarehouse || { 'gudang-utama': selectedProd?.stock || 0 };
    const curWhStock = Number(stockMap[adjustForm.warehouseId] ?? (adjustForm.warehouseId === 'gudang-utama' ? (selectedProd?.stock || 0) : 0));
    const unit = selectedProd?.unit || raw.unit || 'pcs';

    let delta = 0;
    if (adjustMode === 'SET') {
      const target = Number(targetStockInput);
      if (targetStockInput === '' || isNaN(target) || target < 0) {
        notify.error('Masukkan stok fisik aktual yang valid (minimal 0)');
        return;
      }
      delta = target - curWhStock;
      if (delta === 0) {
        notify.error('Stok fisik sama dengan stok sistem, tidak ada perubahan');
        return;
      }
    } else {
      delta = Number(adjustForm.quantity);
      if (adjustForm.quantity === '' || isNaN(delta) || delta === 0) {
        notify.error('Masukkan jumlah perubahan selain 0');
        return;
      }
      if (delta < 0 && Math.abs(delta) > curWhStock) {
        notify.error(`Pengurangan (${Math.abs(delta)} ${unit}) melebihi stok yang ada di gudang ini (${curWhStock} ${unit})! Stok tidak boleh minus.`);
        return;
      }
    }

    setSaving(true);
    const result = await adjustStock({
      productId: adjustForm.productId,
      warehouseId: adjustForm.warehouseId,
      quantity: delta,
      notes: adjustForm.notes || (adjustMode === 'SET' ? `Set stok fisik ke ${targetStockInput} ${unit}` : undefined),
    });

    if (result.success) {
      notify.success('Stok berhasil disesuaikan');
      setAdjustModal(false);
      setAdjustForm({ productId: '', warehouseId: '', quantity: '', notes: '' });
      setTargetStockInput('');
      await load();
    } else {
      notify.error(result.error || 'Gagal menyesuaikan stok');
    }
    setSaving(false);
  };

  const totalBatchQty = batches.reduce((sum, b) => sum + b.quantity, 0);
  const totalNilaiStok = batches.reduce((sum, b) => sum + (b.quantity * (b.incomingPrice || b.product?.costPrice || 0)), 0);
  const expiringSoon = batches.filter(b => {
    if (!b.expiryDate) return false;
    const diff = msUntilExpiry(b.expiryDate);
    return diff > 0 && diff < EXPIRY_SOON_MS; // 30 hari
  }).length;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'batches', label: 'Batch Stok', count: batches.length },
    { key: 'lowstock', label: 'Stok Rendah', count: lowStock.length },
    { key: 'movements', label: 'Pergerakan', count: movements.length },
  ];

  return (
    <>
      <Toaster />
      <div className="bg-gray-50 p-3 md:p-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-black text-gray-900">Manajemen Inventori</h1>
            <p className="text-xs text-gray-500 mt-0.5">FEFO (First Expired First Out) aktif · Pemisahan Produk Aktif & Tidak Aktif</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setHppModalOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3.5 py-2.5 rounded-xl text-sm font-bold hover:from-amber-600 hover:to-orange-700 shadow-sm transition-all"
              title="Buka Kalkulator & Skema Penentuan HPP Modal Produk"
            >
              <DollarSign size={16} /> Kalkulator HPP
            </button>
            <button onClick={load} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 shadow-sm">
              <RefreshCw size={15} /> Refresh
            </button>
            <button onClick={() => setAdjustModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm">
              <BarChart2 size={16} /> Sesuaikan Stok
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 font-medium mb-1">Total Batch</p>
            <p className="text-2xl font-black text-gray-900">{batches.length}</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm p-4">
            <p className="text-xs text-emerald-600 font-medium mb-1 flex items-center gap-1">
              <CheckCircle size={12} /> Batch Aktif
            </p>
            <p className="text-2xl font-black text-emerald-700">{activeBatchesCount}</p>
          </div>
          <div className="bg-slate-100 rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
              <Ban size={12} /> Batch Nonaktif
            </p>
            <p className="text-2xl font-black text-slate-700">{inactiveBatchesCount}</p>
          </div>
          <div className="bg-purple-50 rounded-2xl border border-purple-100 shadow-sm p-4">
            <p className="text-xs text-purple-500 font-medium mb-1 flex items-center gap-1"><DollarSign size={12} />Nilai Stok</p>
            <p className="text-xl font-black text-purple-700">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalNilaiStok)}</p>
          </div>
          <div className="bg-amber-50 rounded-2xl border border-amber-100 shadow-sm p-4">
            <p className="text-xs text-amber-500 font-medium mb-1">Exp. &lt; 30 hari</p>
            <p className="text-2xl font-black text-amber-700">{expiringSoon}</p>
          </div>
          <div className="bg-red-50 rounded-2xl border border-red-100 shadow-sm p-4">
            <p className="text-xs text-red-400 font-medium mb-1">Stok Rendah</p>
            <p className="text-2xl font-black text-red-700">{lowStock.length}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${tab === t.key ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${tab === t.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* Filters for batches & lowstock */}
            {(tab === 'batches' || tab === 'lowstock') && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
                <div className="flex flex-col sm:flex-row gap-3 flex-1">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Cari produk, SKU, atau batch..."
                      className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {tab === 'batches' && (
                    <select
                      value={warehouseFilter}
                      onChange={e => setWarehouseFilter(e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Semua Gudang</option>
                      {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  )}
                </div>

                {/* Status Filter Toggle */}
                <div className="flex items-center border border-gray-200 bg-gray-100/80 p-1 rounded-xl gap-1 shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      statusFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('active')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      statusFilter === 'active' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:text-emerald-800'
                    }`}
                  >
                    <CheckCircle size={12} /> Aktif ({activeBatchesCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('inactive')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      statusFilter === 'inactive' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <Ban size={12} /> Tidak Aktif ({inactiveBatchesCount})
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
            ) : (
              <>
                {/* Batches Tab */}
                {tab === 'batches' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                        <th className="text-left p-3">Produk</th>
                        <th className="text-center p-3">Status Produk</th>
                        <th className="text-left p-3">Gudang</th>
                        <th className="text-left p-3">No. Batch</th>
                        <th className="text-center p-3">Qty</th>
                        <th className="text-right p-3">Harga Modal</th>
                        <th className="text-left p-3">Expired</th>
                        <th className="text-center p-3">Aksi</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredBatches.length === 0 ? (
                          <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">Tidak ada data batch</td></tr>
                        ) : filteredBatches.map(b => {
                          const isExpiringSoon = b.expiryDate && msUntilExpiry(b.expiryDate) < EXPIRY_SOON_MS;
                          const isExpired = b.expiryDate && new Date(b.expiryDate) < new Date();
                          const isActive = b.product?.isActive !== false;
                          return (
                            <tr key={b.id} className={`hover:bg-gray-50 transition-colors ${
                              !isActive ? 'bg-gray-50/70 text-gray-500' :
                              isExpired ? 'bg-red-50' :
                              isExpiringSoon ? 'bg-amber-50' : ''
                            }`}>
                              <td className="p-3">
                                <p className={`font-bold ${isActive ? 'text-gray-800' : 'text-gray-500 line-through'}`}>{b.product.name}</p>
                                <p className="text-xs text-gray-400 font-mono">{b.product.sku}</p>
                              </td>
                              <td className="p-3 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                  isActive
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                                }`}>
                                  {isActive ? <CheckCircle size={11} /> : <Ban size={11} />}
                                  {isActive ? 'Aktif' : 'Tidak Aktif'}
                                </span>
                              </td>
                              <td className="p-3 text-gray-600">{b.warehouse.name}</td>
                              <td className="p-3 font-mono text-xs text-gray-600">{b.batchNumber}</td>
                              <td className="p-3 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                                    !isActive ? 'bg-gray-200 text-gray-600' :
                                    b.quantity < 5 ? 'bg-red-100 text-red-700' :
                                    b.quantity < 10 ? 'bg-amber-100 text-amber-700' :
                                    'bg-emerald-100 text-emerald-700'
                                  }`}>
                                    {b.quantity} {b.product.unit}
                                  </span>
                                  <StockUnitDisplay stock={b.quantity} units={b.product.units} />
                                </div>
                              </td>
                              <td className="p-3 text-xs text-right">
                                {b.incomingPrice || b.product?.costPrice ? (
                                  <span className="font-bold text-gray-700">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(b.incomingPrice || b.product?.costPrice || 0)}</span>
                                ) : <span className="text-gray-400">—</span>}
                              </td>
                              <td className="p-3 text-xs">
                                {b.expiryDate ? (
                                  <span className={`font-bold ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : 'text-gray-600'}`}>
                                    {isExpired ? '⚠️ ' : isExpiringSoon ? '⏰ ' : ''}
                                    {new Date(b.expiryDate).toLocaleDateString('id-ID')}
                                  </span>
                                ) : <span className="text-gray-400">—</span>}
                              </td>
                              <td className="p-3 text-center">
                                {quickAdjust?.batchId === b.id ? (
                                  <div className="flex items-center gap-1 justify-center">
                                    <input
                                      type="number"
                                      className="w-16 text-center text-xs border border-blue-300 rounded-lg px-1 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                      value={quickAdjust!.value}
                                      onChange={e => setQuickAdjust(q => q ? { ...q, value: e.target.value } : null)}
                                      placeholder="±"
                                      autoFocus
                                    />
                                    <button
                                      onClick={async () => {
                                        const qty = Number(quickAdjust!.value);
                                        if (!qty || isNaN(qty)) { setQuickAdjust(null); return; }
                                        // 🛑 Validasi ketat: Cegah minus melebihi stok batch!
                                        if (qty < 0 && Math.abs(qty) > b.quantity) {
                                          notify.error(`Pengurangan (${Math.abs(qty)}) melebihi stok batch (${b.quantity} ${b.product.unit})!`);
                                          return;
                                        }
                                        setSaving(true);
                                        const result = await adjustStock({
                                          productId: b.product.id,
                                          warehouseId: b.warehouseId,
                                          quantity: qty,
                                          notes: `Quick Adjust dari Inventori (${qty >= 0 ? '+' : ''}${qty} ${b.product.unit})`
                                        });
                                        setSaving(false);
                                        if (result.success) {
                                          notify.success('Stok berhasil diperbarui');
                                          setQuickAdjust(null);
                                          await load();
                                        } else {
                                          notify.error(result.error || 'Gagal');
                                        }
                                      }}
                                      disabled={saving}
                                      className="w-6 h-6 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 text-xs font-bold disabled:opacity-50"
                                    >✓</button>
                                    <button onClick={() => setQuickAdjust(null)} className="w-6 h-6 bg-gray-200 text-gray-600 rounded-lg flex items-center justify-center hover:bg-gray-300 text-xs">✕</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setQuickAdjust({ batchId: b.id, value: '' })}
                                    className="px-2 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition-all"
                                    title="Sesuaikan stok batch ini"
                                  >
                                    ± Adjust
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Low Stock Tab */}
                {tab === 'lowstock' && (
                  <div className="space-y-3">
                    {filteredLowStock.length === 0 ? (
                      <div className="text-center py-8">
                        <Package size={40} className="mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-400 text-sm">Tidak ada produk stok rendah sesuai filter</p>
                      </div>
                    ) : filteredLowStock.map((p: any) => {
                      const isActive = p.isActive !== false;
                      return (
                        <div key={p.id} className={`flex items-center justify-between p-3.5 rounded-xl border ${
                          isActive ? 'bg-red-50 border-red-100' : 'bg-gray-100 border-gray-200 opacity-80'
                        }`}>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={`font-bold text-sm ${isActive ? 'text-gray-800' : 'text-gray-600 line-through'}`}>{p.name}</p>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                              }`}>
                                {isActive ? 'Aktif' : 'Tidak Aktif'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">{p.sku} · {p.category?.name}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-black ${isActive ? 'text-red-600' : 'text-gray-600'}`}>{p.stock}</p>
                            <p className="text-xs text-gray-500 font-medium">{p.unit} tersisa</p>
                            <StockUnitDisplay stock={p.stock} units={p.units} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Movements Tab */}
                {tab === 'movements' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                        <th className="text-left p-3">Produk</th>
                        <th className="text-left p-3">Gudang</th>
                        <th className="text-center p-3">Tipe</th>
                        <th className="text-center p-3">Qty</th>
                        <th className="text-left p-3">Referensi</th>
                        <th className="text-left p-3">Tanggal</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {movements.length === 0 ? (
                          <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">Belum ada pergerakan stok</td></tr>
                        ) : movements.map((m: any) => (
                          <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-3">
                              <p className="font-bold text-gray-800">{m.product.name}</p>
                              <p className="text-xs text-gray-400 font-mono">{m.batch.batchNumber}</p>
                            </td>
                            <td className="p-3 text-gray-600 text-xs">{m.warehouse.name}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                                (m.type === 'IN' || m.type === 'MASUK') ? 'bg-emerald-100 text-emerald-700' :
                                (m.type === 'OUT' || m.type === 'KELUAR') ? 'bg-red-100 text-red-600' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {(m.type === 'IN' || m.type === 'MASUK') ? <ArrowDown size={10} /> : (m.type === 'OUT' || m.type === 'KELUAR') ? <ArrowUp size={10} /> : null}
                                {(m.type === 'IN' || m.type === 'MASUK') ? 'MASUK' : (m.type === 'OUT' || m.type === 'KELUAR') ? 'KELUAR' : m.type}
                              </span>
                            </td>
                            <td className="p-3 text-center font-bold text-gray-800">{Math.abs(m.quantity)}</td>
                            <td className="p-3 text-xs text-gray-500">{m.reference || '—'}</td>
                            <td className="p-3 text-xs text-gray-500">{new Date(m.createdAt).toLocaleDateString('id-ID')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Adjust Stock Modal with Safety Locks & Opname Mode */}
      {adjustModal && (() => {
        const selectedProd = products.find(p => p.id === adjustForm.productId);
        const raw = selectedProd?.raw_data || {};
        const stockMap = raw.stockByWarehouse || { 'gudang-utama': selectedProd?.stock || 0 };
        const curWhStock = Number(stockMap[adjustForm.warehouseId] ?? (adjustForm.warehouseId === 'gudang-utama' ? (selectedProd?.stock || 0) : 0));
        const unit = selectedProd?.unit || raw.unit || 'pcs';

        let deltaPreview = 0;
        if (adjustMode === 'SET') {
          const target = targetStockInput === '' ? curWhStock : Number(targetStockInput);
          deltaPreview = target - curWhStock;
        } else {
          deltaPreview = adjustForm.quantity === '' ? 0 : Number(adjustForm.quantity);
        }
        const nextWhStockPreview = curWhStock + deltaPreview;
        const isNegativeError = nextWhStockPreview < 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAdjustModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-black text-gray-900">Penyesuaian Stok (Anti-Minus)</h2>
                  <p className="text-xs text-gray-400">Pastikan stok keluar tidak melebihi stok yang ada di gudang</p>
                </div>
                <button onClick={() => setAdjustModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
              </div>

              {/* Mode Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAdjustMode('SET')}
                  className={`py-2 px-3 rounded-lg text-xs font-black transition-all ${
                    adjustMode === 'SET'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  1. Set Stok Fisik (Opname)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustMode('DELTA')}
                  className={`py-2 px-3 rounded-lg text-xs font-black transition-all ${
                    adjustMode === 'DELTA'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  2. Tambah / Kurang (±)
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Pilih Produk *</label>
                  <select
                    value={adjustForm.productId}
                    onChange={e => setAdjustForm(p => ({ ...p, productId: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Produk --</option>
                    <optgroup label="Produk Aktif">
                      {products.filter((p: any) => p.isActive !== false).map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name} (Total: {p.stock} {p.unit || 'pcs'})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Produk Tidak Aktif">
                      {products.filter((p: any) => p.isActive === false).map((p: any) => (
                        <option key={p.id} value={p.id}>[Tidak Aktif] {p.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Gudang Penyimpanan *</label>
                  <select
                    value={adjustForm.warehouseId}
                    onChange={e => setAdjustForm(p => ({ ...p, warehouseId: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Gudang --</option>
                    {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>

                {/* Info Stok Gudang Terpilih */}
                {adjustForm.productId && adjustForm.warehouseId && (
                  <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-blue-700 font-bold">Stok Saat Ini di Gudang Ini:</span>
                    <span className="font-black text-blue-900 text-sm">{curWhStock} {unit}</span>
                  </div>
                )}

                {/* Input Sesuai Mode */}
                {adjustMode === 'SET' ? (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Jumlah Stok Fisik Riil yang Ditemukan *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={targetStockInput}
                      onChange={e => setTargetStockInput(e.target.value)}
                      placeholder={`Ketik jumlah stok fisik riil (${curWhStock})`}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      Sistem akan otomatis menghitung selisih (kurang/tambah) dari stok sistem ({curWhStock} {unit}).
                    </span>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Jumlah Perubahan (Positif = Tambah, Negatif = Kurangi) *
                    </label>
                    <input
                      type="number"
                      value={adjustForm.quantity}
                      onChange={e => setAdjustForm(p => ({ ...p, quantity: e.target.value }))}
                      placeholder="Contoh: 10 untuk tambah, atau -5 untuk kurangi"
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      Maksimal pengurangan dari gudang ini adalah <strong>-{curWhStock} {unit}</strong>.
                    </span>
                  </div>
                )}

                {/* Live Preview Box */}
                {adjustForm.productId && adjustForm.warehouseId && (
                  <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                    isNegativeError
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  }`}>
                    <div className="flex justify-between items-center font-bold">
                      <span>Simulasi Stok Akhir:</span>
                      <span className="font-mono text-sm">
                        {curWhStock} {deltaPreview >= 0 ? `+ ${deltaPreview}` : `- ${Math.abs(deltaPreview)}`} = <strong className={isNegativeError ? 'text-rose-600' : 'text-emerald-700'}>{nextWhStockPreview} {unit}</strong>
                      </span>
                    </div>
                    {isNegativeError && (
                      <p className="text-[11px] font-black text-rose-600 flex items-center gap-1">
                        ⚠️ Pengurangan melebihi stok yang ada! Stok akhir tidak boleh bernilai negatif.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Catatan / Alasan Penyesuaian</label>
                  <input
                    value={adjustForm.notes}
                    onChange={e => setAdjustForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Contoh: Barang rusak saat display, penyesuaian opname..."
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-5 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleAdjust}
                  disabled={saving || isNegativeError || !adjustForm.productId || !adjustForm.warehouseId}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-500/20"
                >
                  {saving ? 'Memproses...' : 'Terapkan Penyesuaian'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Kalkulator & Skema HPP Modal Modal */}
      <HppCalculatorModal
        isOpen={hppModalOpen}
        onClose={() => setHppModalOpen(false)}
        products={products.map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          stock: p.stock,
          costPrice: Number(p.cost_price ?? p.raw_data?.Modal ?? 0),
          price: Number(p.price ?? p.raw_data?.Ecer ?? 0),
        }))}
        onProductUpdated={load}
      />
    </>
  );
}

