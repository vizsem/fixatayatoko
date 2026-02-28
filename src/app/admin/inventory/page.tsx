'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { auth, db } from '@/lib/firebase';
import useProducts from '@/lib/hooks/useProducts';
import type { UnitOption } from '@/lib/normalize';


import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

import { onAuthStateChanged } from 'firebase/auth';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import {
  Box, Search, Plus, ArrowUpRight, ArrowDownLeft, RefreshCw,
  ClipboardCheck, Package, Warehouse, ChevronRight,
  ChevronLeft, Download, Activity, ListFilter, CheckSquare, Square,
  X, MapPinned, FolderInput, EyeOff, Check, ScanBarcode, Image as ImageIcon, Trash2,
  LucideIcon
} from 'lucide-react';


import * as XLSX from 'xlsx';

// --- TYPES ---
type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  warehouseId: string;
  stock: number;
  minStock: number;
  priceEcer: number;
  priceGrosir: number;
  unit: string;
  isActive?: boolean;
  imageUrl?: string;
  units?: UnitOption[];
  stockByWarehouse?: Record<string, number>;
};

export default function InventoryDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const { products: liveProducts, loading: productsLoading } = useProducts({ isActive: true, orderByField: 'name', orderDirection: 'asc' });
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string, name: string }[]>([]);

  // Quick Edit States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempStock, setTempStock] = useState<number>(0);
  const [unitSelection, setUnitSelection] = useState<Record<string, string>>({});

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');

  // Pagination & Selection States
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchAction, setBatchAction] = useState<'category' | 'warehouse' | 'status' | null>(null);
  const [batchValue, setBatchValue] = useState('');

  useEffect(() => {
    setProducts(liveProducts as Product[]);
  }, [liveProducts]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }
      const unsubCats = onSnapshot(collection(db, 'categories'), (s) => {
        setCategories(
          s.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            return { id: d.id, name: String(data.name || '') };
          })
        );
      });
      const unsubWh = onSnapshot(collection(db, 'warehouses'), (s) => {
        setWarehouses(
          s.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            return { id: d.id, name: String(data.name || '') };
          })
        );
      });
      setLoading(false);
      return () => {
        unsubCats();
        unsubWh();
      };
    });
    return () => unsub();
  }, [router]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const matchesWarehouse = selectedWarehouse === 'all' || p.warehouseId === selectedWarehouse;
      return matchesSearch && matchesCategory && matchesWarehouse;
    });
  }, [products, searchTerm, selectedCategory, selectedWarehouse]);
  const displayWarehouses = useMemo(() => {
    const base = warehouses;
    const knownIds = new Set(base.map(w => w.id));
    const knownNames = new Set(base.map(w => w.name));
    const derived = new Set<string>();
    products.forEach((p) => {
      const by = (p.stockByWarehouse || {});
      Object.keys(by).forEach(k => derived.add(k));
      if (p.warehouseId) derived.add(String(p.warehouseId));
    });
    const virtuals = Array.from(derived)
      .filter(k => !knownIds.has(k) && !knownNames.has(k))
      .map(k => ({ id: k, name: k }));
    return [...base, ...virtuals];
  }, [warehouses, products]);

  const unitCodes = (p: Product) => {
    const set = new Set<string>();
    const base = (p.unit || '').toUpperCase();
    if (base) set.add(base);
    (p.units || []).forEach(u => {
      const code = (u.code || '').toUpperCase();
      if (code) set.add(code);
    });
    return Array.from(set);
  };

  const displayedStock = (p: Product) => {
    const selected = (unitSelection[p.id] || p.unit || '').toUpperCase();
    if (!selected || selected === (p.unit || '').toUpperCase()) return p.stock;
    const found = (p.units || []).find(u => (u.code || '').toUpperCase() === selected && typeof u.contains === 'number' && (u.contains as number) > 0);
    if (!found) return p.stock;
    return Math.floor(p.stock / (found.contains as number));
  };

  const handleExport = useCallback(() => {
    const exportData = filteredProducts.map(p => ({
      'Name': p.name,
      'SKU': p.sku,
      'Category': p.category,
      'Warehouse': warehouses.find(w => w.id === p.warehouseId)?.name || 'Central',
      'Stock': p.stock,
      'Min Stock': p.minStock,
      'Price Ecer': p.priceEcer,
      'Price Grosir': p.priceGrosir,
      'Unit': p.unit,
      'Status': p.isActive ? 'Active' : 'Inactive'
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
    XLSX.writeFile(workbook, 'inventory-export.xlsx');
  }, [filteredProducts, warehouses]);


  const handleQuickUpdate = async (id: string) => {
    try {
      const ref = doc(db, 'products', id);
      await updateDoc(ref, { stock: tempStock, updatedAt: serverTimestamp() });
      setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: tempStock } : p));
      setEditingId(null);
      notify.admin.success('Stok diperbarui');
    } catch { notify.admin.error('Gagal memperbarui stok'); }

  };

  // --- PAGINATION LOGIC ---
  const totalPages = useMemo(() => Math.ceil(filteredProducts.length / rowsPerPage), [filteredProducts.length, rowsPerPage]);
  const indexOfLastItem = useMemo(() => currentPage * rowsPerPage, [currentPage, rowsPerPage]);
  const indexOfFirstItem = useMemo(() => indexOfLastItem - rowsPerPage, [indexOfLastItem, rowsPerPage]);
  const currentItems = useMemo(() => filteredProducts.slice(indexOfFirstItem, indexOfLastItem), [filteredProducts, indexOfFirstItem, indexOfLastItem]);


  const handleSelectAll = () => {
    if (selectedIds.length === currentItems.length) setSelectedIds([]);
    else setSelectedIds(currentItems.map(p => p.id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const executeBatchUpdate = async () => {
    if (!batchAction || selectedIds.length === 0) return;
    setLoading(true);
    const batch = writeBatch(db);
    selectedIds.forEach(id => {
      const pRef = doc(db, 'products', id);
      const updateData: Partial<Product> & { updatedAt: ReturnType<typeof serverTimestamp> } = { updatedAt: serverTimestamp() };

      if (batchAction === 'category') updateData.category = batchValue;
      if (batchAction === 'warehouse') updateData.warehouseId = batchValue;
      if (batchAction === 'status') updateData.isActive = false;
      batch.update(pRef, updateData);
    });

    try {
      await batch.commit();
      setSelectedIds([]);
      setIsBatchModalOpen(false);
      notify.admin.success('Batch update berhasil');
    } catch { notify.admin.error('Batch update gagal'); }

    finally { setLoading(false); }
  };

  const executeBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    const ok = typeof window !== 'undefined' ? window.confirm(`Hapus permanen ${selectedIds.length} produk?`) : true;
    if (!ok) return;
    setLoading(true);
    const batch = writeBatch(db);
    selectedIds.forEach(id => {
      const pRef = doc(db, 'products', id);
      batch.delete(pRef);
    });
    try {
      await batch.commit();
      setSelectedIds([]);
      notify.admin.success('Produk berhasil dihapus');
    } catch {
      notify.admin.error('Gagal menghapus produk');
    } finally {
      setLoading(false);
    }
  };

  if (loading || productsLoading) return <div className="min-h-screen flex items-center justify-center"><Activity className="animate-spin text-green-600" /></div>;

  return (
    <div className="p-4 lg:p-10 bg-[#FBFBFE] min-h-screen pb-32 font-sans">
      <Toaster position="top-right" />

      {/* 1. Navigasi Cepat */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        <NavCard icon={ArrowDownLeft} label="Stock In" href={`/admin/inventory/stock-in?ids=${selectedIds.join(',')}`} color="text-green-600" bg="bg-green-50" />
        <NavCard icon={ArrowUpRight} label="Stock Out" href={`/admin/inventory/stock-out?ids=${selectedIds.join(',')}`} color="text-red-600" bg="bg-red-50" />
        <NavCard icon={RefreshCw} label="Transfer" href={`/admin/inventory/transfer?ids=${selectedIds.join(',')}`} color="text-blue-600" bg="bg-blue-50" />
        <NavCard icon={ClipboardCheck} label="Opname" href="/admin/inventory/opname" color="text-purple-600" bg="bg-purple-50" />
        <NavCard icon={Box} label="History" href="/admin/inventory/history" color="text-orange-600" bg="bg-orange-50" />
        <NavCard icon={Download} label="Export" onClick={handleExport} color="text-gray-600" bg="bg-gray-100" />
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tighter flex items-center gap-3">
            <Package className="text-green-600" size={32} /> Inventory hub
          </h1>

          <p className="text-gray-400 text-[10px] font-black tracking-widest mt-1">
            Menampilkan {filteredProducts.length} produk terfilter

          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-gray-100 p-4 rounded-2xl hover:bg-gray-200 transition-all"><ScanBarcode size={20} /></button>
          <Link href="/admin/products/add" className="bg-black text-white px-8 py-4 rounded-2xl text-[10px] font-black tracking-widest shadow-xl flex items-center gap-2">

            <Plus size={18} /> New Item
          </Link>
        </div>
      </div>

      {/* 2. Advanced Filters & Rows Per Page */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input className="w-full bg-gray-50 pl-12 pr-6 py-4 rounded-2xl text-xs font-bold outline-none border-none focus:ring-2 focus:ring-black transition-all" placeholder="Search SKU, Name..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
          <select className="bg-gray-50 px-4 py-4 rounded-2xl text-xs font-bold appearance-none outline-none" value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}>
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select className="bg-gray-50 px-4 py-4 rounded-2xl text-xs font-bold appearance-none outline-none" value={selectedWarehouse} onChange={(e) => { setSelectedWarehouse(e.target.value); setCurrentPage(1); }}>
            <option value="all">All Warehouses</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        {/* Rows Selector */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
          <ListFilter size={14} className="text-gray-400" />
          <span className="text-[10px] font-black text-gray-400 tracking-widest">Tampilan:</span>

          {[50, 100, 300].map(val => (
            <button
              key={val}
              onClick={() => { setRowsPerPage(val); setCurrentPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${rowsPerPage === val ? 'bg-black text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Table */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full text-left min-w-[720px] md:min-w-0">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-3 md:px-8 py-3 md:py-6 w-10">
                  <button onClick={handleSelectAll} className="hover:scale-110 transition-transform">
                    {selectedIds.length === currentItems.length && currentItems.length > 0 ? <CheckSquare className="text-black" size={20} /> : <Square className="text-gray-300" size={20} />}
                  </button>
                </th>
                <th className="px-2 md:px-4 py-3 md:py-6 text-[10px] font-black text-gray-400 tracking-widest">Product</th>
                <th className="hidden md:table-cell px-3 md:px-6 py-3 md:py-6 text-[10px] font-black text-gray-400 tracking-widest">Warehouse</th>
                <th className="px-3 md:px-6 py-3 md:py-6 text-[10px] font-black text-gray-400 tracking-widest text-center">Stock level</th>
                <th className="px-3 md:px-8 py-3 md:py-6 text-right text-[10px] font-black text-gray-400 tracking-widest">Details</th>

              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentItems.map(product => (
                <tr key={product.id} className={`hover:bg-gray-50/50 transition-all ${selectedIds.includes(product.id) ? 'bg-blue-50/40' : ''}`}>
                  <td className="px-3 md:px-8 py-3 md:py-6">
                    <button onClick={() => toggleSelect(product.id)}>
                      {selectedIds.includes(product.id) ? <CheckSquare className="text-black" size={20} /> : <Square className="text-gray-200" size={20} />}
                    </button>
                  </td>
                  <td className="px-2 md:px-4 py-3 md:py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-300 overflow-hidden relative">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            fill
                            className="object-cover"
                            alt={product.name}
                            sizes="48px"
                          />
                        ) : <ImageIcon size={20} />}
                      </div>

                      <div className="flex flex-col">
                        <span className="text-xs font-black text-gray-800 tracking-tight">{product.name}</span>
                        <span className="text-[9px] font-bold text-gray-400 tracking-wider">{product.sku} • {product.category}</span>
                        <span className="text-[10px] font-black text-emerald-600">
                          {(() => {
                            const sel = (unitSelection[product.id] || product.unit).toUpperCase();
                            if (sel === (product.unit || '').toUpperCase()) {
                              return `Rp${Number(product.priceEcer || 0).toLocaleString('id-ID')} /${sel}`;
                            }
                            const found = (product.units || []).find(u => (u.code || '').toUpperCase() === sel);
                            const price = Number(found?.price || 0);
                            const contains = Number(found?.contains || 0);
                            const partA = price > 0 ? `Rp${price.toLocaleString('id-ID')}` : 'Rp -';
                            const partB = contains > 0 ? ` (isi ${contains})` : '';
                            return `${partA} /${sel}${partB}`;
                          })()}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-3 md:px-6 py-3 md:py-6">
                    <span className="text-[10px] font-black text-gray-500 flex items-center gap-2">

                      <Warehouse size={14} className="text-gray-300" /> {displayWarehouses.find(w => w.id === product.warehouseId)?.name || 'Central'}
                    </span>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries(product.stockByWarehouse || {})
                        .filter(([_, v]) => Number(v) > 0)
                        .map(([wid, val]) => (
                          <span key={wid} className="text-[9px] font-bold bg-gray-50 border border-gray-100 rounded-lg px-2 py-1">
                            {displayWarehouses.find(w => w.id === wid)?.name || wid}: {val}
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className="px-3 md:px-6 py-3 md:py-6 text-center">
                    {editingId === product.id ? (
                      <div className="flex items-center justify-center gap-2">
                        <input autoFocus type="number" className="w-16 p-2 bg-gray-100 rounded-lg text-xs font-black outline-none" value={tempStock} onChange={(e) => setTempStock(Number(e.target.value))} />
                        <button onClick={() => handleQuickUpdate(product.id)} className="p-2 bg-black text-white rounded-lg"><Check size={14} /></button>
                        <button onClick={() => setEditingId(null)} className="p-2 bg-gray-100 text-gray-400 rounded-lg"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="group relative inline-block cursor-pointer" onDoubleClick={() => { setEditingId(product.id); setTempStock(product.stock); }}>
                          <span className={`text-xs font-black px-3 py-1.5 rounded-xl transition-all ${product.stock <= product.minStock ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-800 hover:bg-black hover:text-white'}`}>
                            {displayedStock(product).toLocaleString()} <span className="text-[9px] opacity-60 ml-0.5">{(unitSelection[product.id] || product.unit).toUpperCase()}</span>
                          </span>
                          {product.stock <= product.minStock && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />}
                        </div>
                        {unitCodes(product).length > 1 && (
                          <select
                            className="mt-0.5 text-[9px] font-bold bg-gray-50 border border-gray-100 rounded-lg px-2 py-1"
                            value={(unitSelection[product.id] || product.unit).toUpperCase()}
                            onChange={(e) => setUnitSelection(prev => ({ ...prev, [product.id]: e.target.value }))}
                          >
                            {unitCodes(product).map(code => <option key={code} value={code}>{code}</option>)}
                          </select>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 md:px-8 py-3 md:py-6 text-right">
                    <Link href={`/admin/products/edit/${product.id}`} className="p-3 bg-white border border-gray-100 rounded-2xl inline-block hover:border-black transition-all">
                      <ChevronRight size={18} className="text-gray-400" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-3 md:px-8 py-4 md:py-6 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-[10px] font-black text-gray-400 tracking-widest">
            Menampilkan {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredProducts.length)} dari {filteredProducts.length} produk

          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-3 bg-white border border-gray-100 rounded-xl disabled:opacity-30 hover:bg-gray-50 transition-all shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                if (totalPages > 5 && Math.abs(currentPage - pageNum) > 1 && pageNum !== 1 && pageNum !== totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all ${currentPage === pageNum ? 'bg-black text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100 hover:bg-gray-50'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-3 bg-white border border-gray-100 rounded-xl disabled:opacity-30 hover:bg-gray-50 transition-all shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Floating Batch Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black text-white px-8 py-5 rounded-[2.5rem] shadow-2xl z-50 flex items-center gap-8 border border-white/10 animate-in slide-in-from-bottom-10 duration-500">
          <div className="flex flex-col">
            <span className="text-[11px] font-black text-emerald-400 tracking-widest">{selectedIds.length} items</span>
            <span className="text-[8px] font-bold text-gray-500 text-center">SELECTED</span>
          </div>

          <div className="h-8 w-[1px] bg-gray-800" />
          <div className="flex gap-6">
            <button onClick={() => { setBatchAction('warehouse'); setIsBatchModalOpen(true); }} className="flex flex-col items-center gap-1 group transition-all">
              <MapPinned size={18} className="group-hover:text-emerald-400" /><span className="text-[8px] font-black">Move</span>
            </button>
            <button onClick={() => { setBatchAction('category'); setIsBatchModalOpen(true); }} className="flex flex-col items-center gap-1 group transition-all">
              <FolderInput size={18} className="group-hover:text-blue-400" /><span className="text-[8px] font-black">Category</span>
            </button>

            <button onClick={() => { setBatchAction('status'); executeBatchUpdate(); }} className="flex flex-col items-center gap-1 group transition-all">
              <EyeOff size={18} className="group-hover:text-red-400" /><span className="text-[8px] font-black">Disable</span>
            </button>

            <button onClick={executeBatchDelete} className="flex flex-col items-center gap-1 group transition-all">
              <Trash2 size={18} className="group-hover:text-rose-500" /><span className="text-[8px] font-black">Delete</span>
            </button>

          </div>
          <button onClick={() => setSelectedIds([])} className="bg-gray-800 p-2 rounded-full hover:bg-white hover:text-black transition-all"><X size={16} /></button>
        </div>
      )}

      {/* Batch Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-12 shadow-2xl">
            <h2 className="text-2xl font-black tracking-tighter mb-2">{batchAction === 'warehouse' ? 'Relocate' : 'Reclassify'}</h2>
            <p className="text-gray-400 text-[10px] font-bold mb-8">Ubah {selectedIds.length} produk sekaligus</p>

            <select className="w-full bg-gray-50 p-5 rounded-3xl text-xs font-black outline-none mb-10 border-none ring-1 ring-gray-100" value={batchValue} onChange={(e) => setBatchValue(e.target.value)}>
              <option value="">Pilih Tujuan...</option>
              {batchAction === 'warehouse' ? warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>) : categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <div className="flex gap-4">
              <button onClick={() => setIsBatchModalOpen(false)} className="flex-1 py-5 text-[10px] font-black text-gray-400">Cancel</button>
              <button onClick={executeBatchUpdate} className="flex-1 py-5 bg-black text-white rounded-[2rem] text-[10px] font-black tracking-widest shadow-lg">Confirm</button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

interface NavCardProps {
  icon: LucideIcon;

  label: string;
  href?: string;
  color: string;
  bg: string;
  onClick?: () => void;
}

function NavCard({ icon: Icon, label, href, color, bg, onClick }: NavCardProps) {
  const Content = (
    <div className={`p-5 rounded-[2rem] ${bg} ${color} flex flex-col items-center gap-2 hover:scale-[1.05] transition-all cursor-pointer shadow-sm border border-transparent hover:border-current active:scale-95 w-full`}>
      <Icon size={24} />
      <span className="text-[10px] font-black tracking-[0.1em]">{label}</span>

    </div>
  );

  if (onClick) return <button onClick={onClick} className="w-full">{Content}</button>;
  return <Link href={href || '#'} className="w-full">{Content}</Link>;
}
