'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import {
  Package, Search, AlertTriangle, Warehouse, TrendingDown,
  ArrowDown, ArrowUp, RefreshCw, Filter, BarChart2, CheckCircle, XCircle, Ban
} from 'lucide-react';
import { getInventoryBatches, getLowStockProducts, getInventoryMovements, adjustStock, getWarehouses } from '@/lib/actions/inventory.actions';
import { getProducts } from '@/lib/actions/product.actions';

import { limit } from '@/lib/firebase';
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
  const [adjustForm, setAdjustForm] = useState({ productId: '', warehouseId: '', quantity: 0, notes: '' });
  const [saving, setSaving] = useState(false);

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
    if (!adjustForm.productId || !adjustForm.warehouseId || adjustForm.quantity === 0) {
      notify.error('Isi semua kolom yang diperlukan');
      return;
    }
    setSaving(true);
    const result = await adjustStock({
      productId: adjustForm.productId,
      warehouseId: adjustForm.warehouseId,
      quantity: adjustForm.quantity,
      notes: adjustForm.notes || undefined,
    });
    if (result.success) {
      notify.success('Stok berhasil disesuaikan');
      setAdjustModal(false);
      setAdjustForm({ productId: '', warehouseId: '', quantity: 0, notes: '' });
      await load();
    } else {
      notify.error(result.error || 'Gagal menyesuaikan stok');
    }
    setSaving(false);
  };

  const totalBatchQty = batches.reduce((sum, b) => sum + b.quantity, 0);
  const expiringSoon = batches.filter(b => {
    if (!b.expiryDate) return false;
    const diff = new Date(b.expiryDate).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000; // 30 hari
  }).length;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'batches', label: 'Batch Stok', count: batches.length },
    { key: 'lowstock', label: 'Stok Rendah', count: lowStock.length },
    { key: 'movements', label: 'Pergerakan', count: movements.length },
  ];

  return (
    <>
      <Toaster />
      <div className="min-h-screen bg-gray-50 p-3 md:p-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-black text-gray-900">Manajemen Inventori</h1>
            <p className="text-xs text-gray-500 mt-0.5">FEFO (First Expired First Out) aktif · Pemisahan Produk Aktif & Tidak Aktif</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 shadow-sm">
              <RefreshCw size={15} /> Refresh
            </button>
            <button onClick={() => setAdjustModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm">
              <BarChart2 size={16} /> Sesuaikan Stok
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
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
          <div className="bg-amber-50 rounded-2xl border border-amber-100 shadow-sm p-4">
            <p className="text-xs text-amber-500 font-medium mb-1">Exp. &lt; 30 hari</p>
            <p className="text-2xl font-black text-amber-700">{expiringSoon}</p>
          </div>
          <div className="bg-red-50 rounded-2xl border border-red-100 shadow-sm p-4 col-span-2 md:col-span-1">
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
                        <th className="text-left p-3">Expired</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredBatches.length === 0 ? (
                          <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">Tidak ada data batch</td></tr>
                        ) : filteredBatches.map(b => {
                          const isExpiringSoon = b.expiryDate && new Date(b.expiryDate).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
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
                                <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                                  !isActive ? 'bg-gray-200 text-gray-600' :
                                  b.quantity < 5 ? 'bg-red-100 text-red-700' :
                                  b.quantity < 10 ? 'bg-amber-100 text-amber-700' :
                                  'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {b.quantity} {b.product.unit}
                                </span>
                              </td>
                              <td className="p-3 text-xs">
                                {b.expiryDate ? (
                                  <span className={`font-bold ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : 'text-gray-600'}`}>
                                    {isExpired ? '⚠️ ' : isExpiringSoon ? '⏰ ' : ''}
                                    {new Date(b.expiryDate).toLocaleDateString('id-ID')}
                                  </span>
                                ) : <span className="text-gray-400">—</span>}
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
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                                m.type === 'IN' ? 'bg-emerald-100 text-emerald-700' :
                                m.type === 'OUT' ? 'bg-red-100 text-red-600' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {m.type === 'IN' ? <ArrowDown size={10} className="inline mr-1" /> : m.type === 'OUT' ? <ArrowUp size={10} className="inline mr-1" /> : null}
                                {m.type}
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

      {/* Adjust Stock Modal */}
      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAdjustModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-900">Penyesuaian Stok</h2>
              <button onClick={() => setAdjustModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Produk *</label>
                <select value={adjustForm.productId} onChange={e => setAdjustForm(p => ({ ...p, productId: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Pilih Produk</option>
                  <optgroup label="Produk Aktif">
                    {products.filter((p: any) => p.isActive !== false).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
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
                <label className="block text-xs font-bold text-gray-700 mb-1">Gudang *</label>
                <select value={adjustForm.warehouseId} onChange={e => setAdjustForm(p => ({ ...p, warehouseId: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Pilih Gudang</option>
                  {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Jumlah (positif = tambah, negatif = kurangi) *</label>
                <input type="number" value={adjustForm.quantity} onChange={e => setAdjustForm(p => ({ ...p, quantity: Number(e.target.value) }))}
                  placeholder="Contoh: 50 atau -10"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Catatan</label>
                <input value={adjustForm.notes} onChange={e => setAdjustForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Alasan penyesuaian..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setAdjustModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={handleAdjust} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Memproses...' : 'Terapkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

