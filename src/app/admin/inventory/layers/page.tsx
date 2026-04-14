'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { Box, Layers, Search, Warehouse, ChevronLeft, Calendar, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

type ProductLayer = { qty: number; costPerPcs: number; ts?: any; purchaseId?: string; supplierName?: string; warehouseId?: string };
type Product = {
  id: string;
  name: string;
  unit?: string;
  stock?: number;
  inventoryLayers?: ProductLayer[];
  isActive?: boolean;
};

export default function InventoryLayersPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  const [summary, setSummary] = useState<{ oldQty: number; oldValue: number; newQty: number; newValue: number }>({ oldQty: 0, oldValue: 0, newQty: 0, newValue: 0 });
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>(() => {
    const now = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() - 6);
    const toLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { startDate: toLocal(start), endDate: toLocal(now) };
  });
  const [warehouseSummary, setWarehouseSummary] = useState<Record<string, { oldQty: number; oldValue: number; newQty: number; newValue: number }>>({});

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'products'));
      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: String(data.name || data.Nama || 'Produk'),
          unit: (data.unit || 'PCS')?.toString().toUpperCase(),
          stock: Number(data.stock || data.Stok || 0),
          inventoryLayers: Array.isArray(data.inventoryLayers) ? data.inventoryLayers as ProductLayer[] : [],
          isActive: data.isActive !== false
        };
      });
      setProducts(items);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, dateRange]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    end.setHours(23,59,59,999);
    
    return products
      .filter(p => p.isActive !== false) // Only active products
      .map(p => ({
        ...p,
        inventoryLayers: (p.inventoryLayers || []).filter(l => {
          const t = l.ts?.seconds ? new Date(l.ts.seconds * 1000) : (typeof l.ts === 'string' ? new Date(l.ts) : new Date());
          return t >= start && t <= end;
        })
      }))
      .filter(p => (p.name || '').toLowerCase().includes(q));
  }, [products, search, dateRange]);

  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  useEffect(() => {
    const now = new Date();
    const threshold = new Date(now.getTime());
    threshold.setMonth(threshold.getMonth() - 3);
    let oldQty = 0, oldValue = 0, newQty = 0, newValue = 0;
    const byWh: Record<string, { oldQty: number; oldValue: number; newQty: number; newValue: number }> = {};
    filtered.forEach(p => {
      (p.inventoryLayers || []).forEach(l => {
        const t = l.ts?.seconds ? new Date(l.ts.seconds * 1000) : (typeof l.ts === 'string' ? new Date(l.ts) : now);
        const qty = Number(l.qty || 0);
        const cost = Number(l.costPerPcs || 0);
        const wid = l.warehouseId || 'gudang-utama';
        if (!byWh[wid]) byWh[wid] = { oldQty: 0, oldValue: 0, newQty: 0, newValue: 0 };
        if (t >= threshold) {
          newQty += qty;
          newValue += qty * cost;
          byWh[wid].newQty += qty;
          byWh[wid].newValue += qty * cost;
        } else {
          oldQty += qty;
          oldValue += qty * cost;
          byWh[wid].oldQty += qty;
          byWh[wid].oldValue += qty * cost;
        }
      });
    });
    setSummary({ oldQty, oldValue, newQty, newValue });
    setWarehouseSummary(byWh);
  }, [filtered]);

  const handleExport = () => {
    const now = new Date();
    const threshold = new Date(now.getTime());
    threshold.setMonth(threshold.getMonth() - 3);
    const rows = filtered.map(p => {
      let oldQty = 0, oldValue = 0, newQty = 0, newValue = 0;
      (p.inventoryLayers || []).forEach(l => {
        const t = l.ts?.seconds ? new Date(l.ts.seconds * 1000) : (typeof l.ts === 'string' ? new Date(l.ts) : now);
        const qty = Number(l.qty || 0);
        const cost = Number(l.costPerPcs || 0);
        if (t >= threshold) {
          newQty += qty;
          newValue += qty * cost;
        } else {
          oldQty += qty;
          oldValue += qty * cost;
        }
      });
      const oldAvg = oldQty > 0 ? oldValue / oldQty : 0;
      const newAvg = newQty > 0 ? newValue / newQty : 0;
      return {
        ProductID: p.id,
        ProductName: p.name,
        Unit: p.unit,
        OldQty: oldQty,
        OldAvgHPP: Math.round(oldAvg),
        OldValue: Math.round(oldValue),
        NewQty: newQty,
        NewAvgHPP: Math.round(newAvg),
        NewValue: Math.round(newValue),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Layers');
    XLSX.writeFile(wb, `audit-layers-${new Date().toISOString().slice(0,10)}.xlsx`);
  };
  const handleExportWarehouses = () => {
    const rows = Object.entries(warehouseSummary).map(([wid, v]) => {
      const oldAvg = v.oldQty > 0 ? v.oldValue / v.oldQty : 0;
      const newAvg = v.newQty > 0 ? v.newValue / v.newQty : 0;
      return {
        WarehouseID: wid,
        OldQty: v.oldQty,
        OldAvgHPP: Math.round(oldAvg),
        OldValue: Math.round(v.oldValue),
        NewQty: v.newQty,
        NewAvgHPP: Math.round(newAvg),
        NewValue: Math.round(v.newValue),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Warehouse Summary');
    XLSX.writeFile(wb, `audit-layers-warehouse-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  if (loading) {
    return (
      <div className="p-20 text-center text-slate-500">Memuat data layer persediaan...</div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 p-3 md:p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin/inventory" className="p-2 bg-white rounded-xl border border-gray-100">
              <ChevronLeft size={16} />
            </Link>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Layers size={22} className="text-indigo-600" /> Audit Layer Persediaan (FIFO)
            </h1>
          </div>
          <Link href="/admin" className="text-xs font-black uppercase tracking-widest text-indigo-600">Admin</Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama produk..."
              className="w-full pl-10 pr-3 py-2.5 bg-gray-50 rounded-xl text-xs font-bold outline-none"
            />
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <Calendar size={16} className="text-gray-400" />
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(r => ({ ...r, startDate: e.target.value }))}
                className="bg-white rounded-lg px-3 py-2 text-xs font-bold outline-none ring-1 ring-gray-200 focus:ring-gray-900"
              />
              <span className="text-[10px] font-black text-gray-400">-</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(r => ({ ...r, endDate: e.target.value }))}
                className="bg-white rounded-lg px-3 py-2 text-xs font-bold outline-none ring-1 ring-gray-200 focus:ring-gray-900"
              />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleExport} className="px-4 py-2 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Download size={14} /> Export Produk
              </button>
              <button onClick={handleExportWarehouses} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Download size={14} /> Export Gudang
              </button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
              <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Stok Lama</div>
              <div className="text-xs font-black text-slate-900">Qty: {summary.oldQty.toLocaleString('id-ID')}</div>
              <div className="text-xs font-black text-slate-900">Nilai: Rp{summary.oldValue.toLocaleString('id-ID')}</div>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Stok Baru</div>
              <div className="text-xs font-black text-slate-900">Qty: {summary.newQty.toLocaleString('id-ID')}</div>
              <div className="text-xs font-black text-slate-900">Nilai: Rp{summary.newValue.toLocaleString('id-ID')}</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-gray-100">
              <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Ringkasan per Gudang</div>
              <div className="space-y-2 max-h-40 overflow-auto">
                {Object.keys(warehouseSummary).length === 0 ? (
                  <div className="text-[10px] font-bold text-gray-400">Tidak ada data</div>
                ) : Object.entries(warehouseSummary).map(([wid, v]) => {
                  const oldAvg = v.oldQty > 0 ? v.oldValue / v.oldQty : 0;
                  const newAvg = v.newQty > 0 ? v.newValue / v.newQty : 0;
                  return (
                    <div key={wid} className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <div className="text-[10px] font-black text-gray-700">{wid}</div>
                      <div className="text-[9px] font-bold text-gray-500">Lama: Qty {v.oldQty.toLocaleString('id-ID')} • Avg Rp{Math.round(oldAvg).toLocaleString('id-ID')} • Nilai Rp{Math.round(v.oldValue).toLocaleString('id-ID')}</div>
                      <div className="text-[9px] font-bold text-gray-500">Baru: Qty {v.newQty.toLocaleString('id-ID')} • Avg Rp{Math.round(newAvg).toLocaleString('id-ID')} • Nilai Rp{Math.round(v.newValue).toLocaleString('id-ID')}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Produk</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Stok</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Layer Aktif</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Total Nilai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-xs font-bold text-gray-400">Tidak ada produk</td>
                </tr>
              ) : currentItems.map((p) => {
                const layers = p.inventoryLayers || [];
                const totalValue = layers.reduce((s, l) => s + (Number(l.qty || 0) * Number(l.costPerPcs || 0)), 0);
                return (
                  <tr key={p.id} className="align-top hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Box size={18} className="text-gray-400" />
                        <div>
                          <div className="text-xs font-black uppercase">{p.name}</div>
                          <div className="text-[10px] font-bold text-gray-400">{p.unit}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                        <Warehouse size={16} className="text-gray-300" />
                        <span>Stok: {Number(p.stock || 0).toLocaleString('id-ID')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        {layers.length === 0 ? (
                          <span className="text-[10px] font-bold text-gray-400">Tidak ada layer</span>
                        ) : layers.map((l, idx) => (
                          <div key={idx} className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-gray-600">Qty: {Number(l.qty || 0).toLocaleString('id-ID')}</span>
                              <span className="text-[10px] font-black text-indigo-600">Rp{Number(l.costPerPcs || 0).toLocaleString('id-ID')}</span>
                            </div>
                            <div className="mt-1 text-[9px] font-bold text-gray-400 flex items-center justify-between gap-4">
                              <span>Supplier: {l.supplierName || '-'}</span>
                              <span>PO: {l.purchaseId ? l.purchaseId.slice(-6) : '-'}</span>
                              <span>Gudang: {l.warehouseId || '-'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs font-black">Rp{totalValue.toLocaleString('id-ID')}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filtered.length)} dari {filtered.length} produk
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl border border-gray-100 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => {
                  const page = i + 1;
                  // Only show current, first, last, and pages near current
                  if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${
                          currentPage === page ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-100 text-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  }
                  if (page === currentPage - 2 || page === currentPage + 2) {
                    return <span key={page} className="text-gray-300">...</span>;
                  }
                  return null;
                })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md"
              >
                Next Page
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
