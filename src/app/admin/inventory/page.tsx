'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { auth, db } from '@/lib/firebase';
import useProducts from '@/lib/hooks/useProducts';
import { Product } from '@/lib/types';
import { addInventoryLog } from '@/lib/inventory';
import * as Sentry from '@sentry/nextjs';

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
  ChevronLeft, ScanBarcode, Image as ImageIcon, Trash2,
  LucideIcon, BarChart3, CheckSquare, Square, Check, X, MapPinned, FolderInput, EyeOff, GitCompare
} from 'lucide-react';

import { InventorySkeleton } from '@/components/admin/InventorySkeleton';

export default function InventoryDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const { products: liveProducts, loading: productsLoading } = useProducts({ isActive: true });
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

  // === GLOBAL BARCODE SCANNER LISTENER ===
  const [barcodeBuffer, setBarcodeBuffer] = useState('');

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key !== 'Enter') {
        if (e.key.length === 1) setBarcodeBuffer((prev) => prev + e.key);
        clearTimeout(timeout);
        timeout = setTimeout(() => setBarcodeBuffer(''), 50); 
      } else if (barcodeBuffer) {
        e.preventDefault();
        setSearchTerm(barcodeBuffer);
        setBarcodeBuffer('');
        notify.admin.success(`Mencari barcode: ${barcodeBuffer}`);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      clearTimeout(timeout);
    };
  }, [barcodeBuffer]);

  useEffect(() => {
    if (liveProducts) {
      const sorted = [...(liveProducts as unknown as Product[])].sort((a, b) => {
        const timeA = typeof a.updatedAt === 'number' ? a.updatedAt : 0;
        const timeB = typeof b.updatedAt === 'number' ? b.updatedAt : 0;
        return timeB - timeA;
      });
      setProducts(sorted);
    }
  }, [liveProducts]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }
      const unsubCats = onSnapshot(collection(db, 'categories'), (s) => {
        setCategories(s.docs.map(d => ({ id: d.id, name: String(d.data().name || '') })));
      });
      const unsubWh = onSnapshot(collection(db, 'warehouses'), (s) => {
        setWarehouses(s.docs.map(d => ({ id: d.id, name: String(d.data().name || '') })));
      });
      setLoading(false);
      return () => {
        unsubCats();
        unsubWh();
      };
    });
    return () => unsubAuth();
  }, [router]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const skuMatch = ((p as any).sku || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSearch = nameMatch || skuMatch;
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const matchesWarehouse = selectedWarehouse === 'all' || ((p as any).warehouseId || '') === selectedWarehouse;
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
      const pAny = p as any;
      if (pAny.warehouseId) derived.add(String(pAny.warehouseId));
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
    const found = (p.units || []).find(u => (u.code || '').toUpperCase() === selected && typeof u.contains === 'number' && u.contains > 0);
    if (!found) return p.stock;
    return Math.floor(p.stock / (found.contains as number));
  };

  const handleQuickUpdate = async (id: string) => {
    try {
      const product = products.find(p => p.id === id);
      if (!product) return;
      const diff = tempStock - product.stock;
      if (diff === 0) {
        setEditingId(null);
        return;
      }
      const ref = doc(db, 'products', id);
      await updateDoc(ref, { stock: tempStock, updatedAt: serverTimestamp() });
      await addInventoryLog({
        productId: id,
        productName: product.name,
        type: diff > 0 ? 'MASUK' : 'KELUAR',
        amount: Math.abs(diff),
        adminId: auth.currentUser?.uid || 'system',
        source: 'MANUAL',
        note: `Quick Update via Dashboard. Prev: ${product.stock}, New: ${tempStock}`,
        toWarehouseId: diff > 0 ? 'gudang-utama' : undefined,
        fromWarehouseId: diff < 0 ? 'gudang-utama' : undefined
      });
      setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: tempStock } : p));
      setEditingId(null);
      notify.admin.success('Stok diperbarui');
    } catch (err) { 
      Sentry.captureException(err, { extra: { productId: id, action: 'quickUpdate' } });
      notify.admin.error('Gagal memperbarui stok'); 
    }
  };

  const totalPages = useMemo(() => Math.ceil(filteredProducts.length / rowsPerPage), [filteredProducts.length, rowsPerPage]);
  const indexOfLastItem = currentPage * rowsPerPage;
  const indexOfFirstItem = indexOfLastItem - rowsPerPage;
  const currentItems = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);

  const executeBatchUpdate = async () => {
    if (!batchAction || selectedIds.length === 0) return;
    setLoading(true);
    const batch = writeBatch(db);
    selectedIds.forEach(id => {
      const pRef = doc(db, 'products', id);
      const updateData: any = { updatedAt: serverTimestamp() };
      if (batchAction === 'category') updateData.category = batchValue;
      if (batchAction === 'warehouse') (updateData as any).warehouseId = batchValue;
      if (batchAction === 'status') updateData.isActive = false;
      batch.update(pRef, updateData);
    });
    try {
      await batch.commit();
      setSelectedIds([]);
      setIsBatchModalOpen(false);
      notify.admin.success('Batch update berhasil');
    } catch (err) { 
      Sentry.captureException(err, { extra: { action: 'batchUpdate', count: selectedIds.length } });
      notify.admin.error('Batch update gagal'); 
    } finally { setLoading(false); }
  };

  const executeBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    const ok = window.confirm(`Hapus permanen ${selectedIds.length} produk?`);
    if (!ok) return;
    setLoading(true);
    const batch = writeBatch(db);
    selectedIds.forEach(id => batch.delete(doc(db, 'products', id)));
    try {
      await batch.commit();
      setSelectedIds([]);
      notify.admin.success('Produk berhasil dihapus');
    } catch (err) {
      Sentry.captureException(err, { extra: { action: 'batchDelete', count: selectedIds.length } });
      notify.admin.error('Gagal menghapus produk');
    } finally { setLoading(false); }
  };

  if (loading || productsLoading) return <InventorySkeleton />;

  return (
    <div className="p-3 md:p-4 bg-[#FBFBFE] min-h-screen pb-32 font-sans">
      <Toaster position="top-right" />
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
        <NavCard icon={ArrowDownLeft} label="In" href={`/admin/inventory/stock-in?ids=${selectedIds.join(',')}`} color="text-green-600" bg="bg-green-50" />
        <NavCard icon={ArrowUpRight} label="Out" href={`/admin/inventory/stock-out?ids=${selectedIds.join(',')}`} color="text-red-600" bg="bg-red-50" />
        <NavCard icon={RefreshCw} label="TF" href={`/admin/inventory/transfer?ids=${selectedIds.join(',')}`} color="text-blue-600" bg="bg-blue-50" />
        <NavCard icon={ClipboardCheck} label="Op" href="/admin/inventory/opname" color="text-purple-600" bg="bg-purple-50" />
        <NavCard icon={GitCompare} label="Rec" href="/admin/inventory/reconciliation" color="text-teal-600" bg="bg-teal-50" />
        <NavCard icon={BarChart3} label="Sync" href="/admin/inventory/sync-monitor" color="text-indigo-600" bg="bg-indigo-50" />
        <NavCard icon={Box} label="Log" href="/admin/inventory/history" color="text-orange-600" bg="bg-orange-50" />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-800 tracking-tighter flex items-center gap-2">
            <Package className="text-green-600" size={22} /> Inventory Hub
          </h1>
          <p className="text-gray-400 text-[8px] font-black uppercase tracking-widest mt-0.5">Realtime SKU Monitor</p>
        </div>
        <div className="flex gap-1.5">
          <Link href="/admin/products/add" className="bg-black text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5">
            <Plus size={14} /> NEW SKU
          </Link>
        </div>
      </div>

      <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 mb-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input className="w-full bg-gray-50 pl-9 pr-4 py-2.5 rounded-xl text-[11px] font-bold outline-none" placeholder="Search SKU, Name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <select className="bg-gray-50 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-tight outline-none" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="all">CAT: ALL</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name.toUpperCase()}</option>)}
          </select>
          <select className="bg-gray-50 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-tight outline-none" value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)}>
            <option value="all">WH: ALL</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
          <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">ROWS:</span>
          {[50, 100, 300].map(val => (
            <button key={val} onClick={() => setRowsPerPage(val)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all ${rowsPerPage === val ? 'bg-black text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{val}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="md:hidden">
          {currentItems.map(product => (
            <div key={product.id} className={`p-3.5 flex flex-col gap-3 border-b border-gray-50 ${selectedIds.includes(product.id) ? 'bg-blue-50/40' : 'bg-white'}`}>
               <div className="flex items-start gap-3">
                <button onClick={() => setSelectedIds(prev => prev.includes(product.id) ? prev.filter(i => i !== product.id) : [...prev, product.id])} className="mt-1 text-gray-200">
                  {selectedIds.includes(product.id) ? <CheckSquare className="text-black" size={18} /> : <Square size={18} />}
                </button>
                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-200 overflow-hidden relative shrink-0">
                  {product.image ? <Image src={product.image} fill className="object-cover" alt={product.name} sizes="56px" /> : <ImageIcon size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[8px] font-black text-blue-500 italic">#{(product as any).sku || 'N/A'}</span>
                    <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">• {product.category || 'GENERAL'}</span>
                  </div>
                  <h3 className="text-[11px] font-black text-gray-800 uppercase leading-none tracking-tight line-clamp-2 mb-1.5">{product.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-emerald-600">
                      {(() => {
                        const sel = (unitSelection[product.id] || product.unit || '').toUpperCase();
                        if (sel === (product.unit || '').toUpperCase()) return `Rp${Number(product.price || 0).toLocaleString('id-ID')} /${sel}`;
                        const found = (product.units || []).find(u => (u.code || '').toUpperCase() === sel);
                        return `Rp${Number(found?.price || 0).toLocaleString('id-ID')} /${sel}`;
                      })()}
                    </span>
                    <Link href={`/admin/products/edit/${product.id}`} className="p-1.5 bg-gray-50 text-gray-400 rounded-lg"><ChevronRight size={14} /></Link>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 px-1 border-t border-gray-50/50">
                <div className="flex flex-col">
                  <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-0.5">Available Stock</p>
                  {editingId === product.id ? (
                    <div className="flex items-center gap-2">
                      <input autoFocus type="number" className="w-16 p-2 bg-gray-100 rounded-lg text-[11px] font-black outline-none" value={tempStock} onChange={(e) => setTempStock(Number(e.target.value))} />
                      <button onClick={() => handleQuickUpdate(product.id)} className="p-2 bg-black text-white rounded-lg"><Check size={12} /></button>
                      <button onClick={() => setEditingId(null)} className="p-2 bg-gray-100 text-gray-400 rounded-lg"><X size={12} /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingId(product.id); setTempStock(product.stock); }} className={`text-[11px] font-black px-2.5 py-1.5 rounded-xl transition-all w-fit ${product.stock <= (product.minStock || 0) ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-800'}`}>
                      {displayedStock(product).toLocaleString()} <span className="text-[9px] opacity-60 ml-0.5 font-bold">{(unitSelection[product.id] || product.unit || '').toUpperCase()}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-4 py-2 w-10">
                  <button onClick={() => setSelectedIds(selectedIds.length === currentItems.length ? [] : currentItems.map(p => p.id))}>
                    {selectedIds.length === currentItems.length && currentItems.length > 0 ? <CheckSquare className="text-black" size={16} /> : <Square className="text-gray-300" size={16} />}
                  </button>
                </th>
                <th className="px-4 py-2 text-[9px] font-black text-gray-400 tracking-widest">Product</th>
                <th className="px-4 py-2 text-[9px] font-black text-gray-400 tracking-widest">Warehouse</th>
                <th className="px-4 py-2 text-[9px] font-black text-gray-400 tracking-widest text-center">Stock</th>
                <th className="px-4 py-2 text-right text-[9px] font-black text-gray-400 tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentItems.map(product => (
                <tr key={product.id} className={`hover:bg-gray-50/50 ${selectedIds.includes(product.id) ? 'bg-blue-50/40' : ''}`}>
                  <td className="px-4 py-2">
                    <button onClick={() => setSelectedIds(prev => prev.includes(product.id) ? prev.filter(i => i !== product.id) : [...prev, product.id])}>
                      {selectedIds.includes(product.id) ? <CheckSquare className="text-black" size={16} /> : <Square className="text-gray-200" size={16} />}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl relative overflow-hidden">
                        {product.image ? <Image src={product.image} fill className="object-cover" alt={product.name} /> : <ImageIcon size={16} className="m-3 text-gray-300" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-gray-800">{product.name}</span>
                        <span className="text-[8px] font-bold text-gray-400">{(product as any).sku} • {product.category}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-[9px] font-black text-gray-500">
                    {displayWarehouses.find(w => w.id === (product as any).warehouseId)?.name || 'Central'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${product.stock <= (product.minStock || 0) ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-800'}`}>
                      {displayedStock(product).toLocaleString()} {(unitSelection[product.id] || product.unit || '').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/admin/products/edit/${product.id}`} className="p-1.5 border rounded-lg inline-block"><ChevronRight size={14} /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex justify-between items-center px-4">
        <span className="text-[10px] font-black text-gray-400 uppercase">Page {currentPage} of {totalPages}</span>
        <div className="flex gap-2">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 border rounded-xl disabled:opacity-30"><ChevronLeft size={16} /></button>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 border rounded-xl disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-4 rounded-3xl shadow-2xl z-50 flex items-center gap-6 animate-in slide-in-from-bottom-10">
          <span className="text-[11px] font-black text-emerald-400">{selectedIds.length} SELECTED</span>
          <div className="flex gap-4">
            <button onClick={() => { setBatchAction('warehouse'); setIsBatchModalOpen(true); }} className="flex flex-col items-center gap-1"><MapPinned size={18} /><span className="text-[8px] font-black">Move</span></button>
            <button onClick={() => { setBatchAction('category'); setIsBatchModalOpen(true); }} className="flex flex-col items-center gap-1"><FolderInput size={18} /><span className="text-[8px] font-black">Category</span></button>
            <button onClick={executeBatchDelete} className="flex flex-col items-center gap-1"><Trash2 size={18} className="text-red-400" /><span className="text-[8px] font-black">Delete</span></button>
          </div>
          <button onClick={() => setSelectedIds([])} className="bg-gray-800 p-2 rounded-full"><X size={16} /></button>
        </div>
      )}

      {isBatchModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-8">
            <h2 className="text-xl font-black mb-6">{batchAction === 'warehouse' ? 'Relocate' : 'Reclassify'}</h2>
            <select className="w-full bg-gray-50 p-5 rounded-3xl text-xs font-black outline-none mb-10" value={batchValue} onChange={(e) => setBatchValue(e.target.value)}>
              <option value="">Select Target...</option>
              {batchAction === 'warehouse' ? warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>) : categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <div className="flex gap-4">
              <button onClick={() => setIsBatchModalOpen(false)} className="flex-1 py-5 text-[10px] font-black text-gray-400">Cancel</button>
              <button onClick={executeBatchUpdate} className="flex-1 py-5 bg-black text-white rounded-[2rem] text-[10px] font-black">Confirm</button>
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
}

function NavCard({ icon: Icon, label, href, color, bg }: NavCardProps) {
  return (
    <Link href={href || '#'} className={`p-3 rounded-2xl ${bg} ${color} flex flex-col items-center gap-1 hover:scale-[1.05] transition-all cursor-pointer shadow-sm border border-transparent hover:border-current active:scale-95 w-full`}>
      <Icon size={18} />
      <span className="text-[8px] font-black tracking-widest uppercase">{label}</span>
    </Link>
  );
}
