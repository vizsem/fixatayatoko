'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import ErrorBoundary from '@/components/ErrorBoundary';
import useProducts from '@/lib/hooks/useProducts';
import type { NormalizedProduct, UnitOption } from '@/lib/normalize';
import { addInventoryLog } from '@/lib/inventory';


import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, deleteDoc,
  onSnapshot, serverTimestamp, writeBatch, updateDoc
} from 'firebase/firestore';

import Link from 'next/link';
import {
  Plus, Edit, Trash2, Download, Upload, Search, X,
  Camera, Warehouse, Calculator, Eye, EyeOff, ChevronLeft, ChevronRight,
  FileSpreadsheet, AlertTriangle, Package, Banknote, RefreshCw,
  CheckSquare, Printer,
  Square
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';


// ✅ SheetJS untuk Export/Import Excel
import * as XLSX from 'xlsx';


type ProductRow = NormalizedProduct & {
  tgl_masuk?: string;
  expired_date?: string;
  expiredDate?: string;
  Expired_Default?: string;
  createdAt?: any;
  URL_Produk?: string;
  url_produk?: string;
  image?: string;
  foto?: string;
  Nama?: string;
  ID?: string;
  Kategori?: string;
  Stok?: number;
  Min_Stok?: number;
  Satuan?: string;
  Modal?: number;
  Ecer?: number;
  Harga_Grosir?: number;
  Min_Grosir?: number;
  Lokasi?: string;
  Deskripsi?: string;
};


interface Warehouse {
  id: string;
  name: string;
}

// --- KOMPONEN MODAL RESTOCK ---
interface RestockModalProps {
  product: ProductRow;
  isOpen: boolean;
  onClose: () => void;
}

function RestockModal({ product, isOpen, onClose }: RestockModalProps) {

  const [stokMasuk, setStokMasuk] = useState<number>(0);
  const [hargaBaru, setHargaBaru] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const stokLama = Number(product.stock || product.Stok || 0);
  const hargaLama = Number(product.purchasePrice || product.Modal || 0);
  const totalStokBaru = stokLama + (stokMasuk || 0);

  const simulasiHargaAvg = totalStokBaru > 0
    ? Math.round(((stokLama * hargaLama) + ((stokMasuk || 0) * (hargaBaru || 0))) / totalStokBaru)
    : 0;

  const handleUpdate = async () => {
    if (isNaN(stokMasuk) || stokMasuk <= 0 || isNaN(hargaBaru) || hargaBaru <= 0) {
      return notify.admin.error("Data stok/harga tidak valid!");
    }
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const productRef = doc(db, 'products', product.id);
      
      batch.update(productRef, {
        stock: totalStokBaru,
        Stok: totalStokBaru,
        purchasePrice: simulasiHargaAvg,
        hargaBeli: simulasiHargaAvg,
        Modal: simulasiHargaAvg,
        updatedAt: serverTimestamp(),
        tgl_masuk: new Date().toISOString().split('T')[0]
      });

      const logRef = doc(collection(db, 'inventory_logs'));
      batch.set(logRef, {
        productId: product.id,
        productName: product.name || product.Nama || '',
        type: 'MASUK',
        amount: stokMasuk,
        adminId: auth.currentUser?.uid || 'system',
        source: 'MANUAL',
        toWarehouseId: product.warehouseId || '',
        note: `Restock (Avg Price). Old: ${stokLama}@${hargaLama}, New: ${stokMasuk}@${hargaBaru}, Final Avg: ${simulasiHargaAvg}`,
        date: serverTimestamp()
      });

      await batch.commit();

      notify.admin.success("Restock & Log Berhasil!");
      onClose();
    } catch (err) {
      console.error(err);
      notify.admin.error("Gagal update data restock");
    }
    setLoading(false);
  };


  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
          <h2 className="font-black italic tracking-tighter text-lg">Kalkulator modal avg</h2>

          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-8 space-y-4">
          <input type="number" placeholder="Jumlah Stok Masuk" className="w-full p-4 bg-gray-50 rounded-2xl font-bold border" onChange={e => setStokMasuk(Number(e.target.value))} />
          <input type="number" placeholder="Harga Beli Satuan Baru" className="w-full p-4 bg-gray-50 rounded-2xl font-bold border" onChange={e => setHargaBaru(Number(e.target.value))} />
          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100">
            <p className="text-[9px] font-black text-blue-600 mb-1">Estimasi modal baru</p>

            <p className="text-xl font-black text-gray-900">Rp {simulasiHargaAvg.toLocaleString()}</p>
          </div>
          <button onClick={handleUpdate} disabled={loading} className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black tracking-widest text-xs hover:bg-blue-700 transition-all">

            {loading ? 'Menyimpan...' : 'Konfirmasi Masuk'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- KOMPONEN UTAMA ---
export default function AdminProducts() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /* badge BARU di-nonaktifkan untuk menjaga kepatuhan lint */

  // Fungsi Toggle Select
  const toggleSelectAll = () => {
    if (selectedIds.length === currentItems.length) setSelectedIds([]);
    else setSelectedIds(currentItems.map(p => p.id));
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  // Fungsi Bulk Update Status
  const handleBulkStatus = async (newStatus: number) => {
    if (selectedIds.length === 0) return;
    const t = notify.admin.loading(`Mengubah ${selectedIds.length} produk...`);
    try {
      const CHUNK_SIZE = 450;
      for (let i = 0; i < selectedIds.length; i += CHUNK_SIZE) {
        const chunk = selectedIds.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.update(doc(db, 'products', id), { Status: newStatus, updatedAt: serverTimestamp() });
        });
        await batch.commit();
      }
      setSelectedIds([]);
      notify.admin.success("Berhasil diperbarui!", { id: t });
    } catch (err) {
      console.error(err);
      notify.admin.error("Gagal memperbarui", { id: t });
    }
  };
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Arsipkan ${selectedIds.length} produk? Produk akan dinonaktifkan (Soft Delete).`)) return;
    const t = notify.admin.loading(`Mengarsipkan ${selectedIds.length} produk...`);
    try {
      const CHUNK_SIZE = 450;
      for (let i = 0; i < selectedIds.length; i += CHUNK_SIZE) {
        const chunk = selectedIds.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.update(doc(db, 'products', id), { 
            isActive: false, 
            status: 'ARCHIVED',
            updatedAt: serverTimestamp() 
          });
        });
        await batch.commit();
      }
      setSelectedIds([]);
      notify.admin.success("Produk berhasil diarsipkan", { id: t });
    } catch (err) {
      console.error(err);
      notify.admin.error("Gagal mengarsipkan produk", { id: t });
    }
  };
  // States
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedProductRestock, setSelectedProductRestock] = useState<ProductRow | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'name'>('createdAt');

  const { products: liveProducts } = useProducts({ isActive: showInactive ? false : true, orderByField: sortBy, orderDirection: 'desc' });

  // Effects
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) { router.push('/profil/login'); return; }
      setLoading(false);
    });
    const unsubW = onSnapshot(collection(db, 'warehouses'), (s) => setWarehouses(s.docs.map(d => ({ id: d.id, ...d.data() })) as Warehouse[]));
    return () => { unsubAuth(); unsubW(); };
  }, [router]);

  const rows = liveProducts as unknown as ProductRow[];

  const displayWarehouses = useMemo(() => {
    const base = warehouses;
    const knownIds = new Set(base.map(w => w.id));
    const knownNames = new Set(base.map(w => w.name));
    const derived = new Set<string>();
    rows.forEach((p) => {
      const by = (p as unknown as { stockByWarehouse?: Record<string, number> }).stockByWarehouse || {};
      Object.keys(by).forEach(k => derived.add(k));
      if (p.warehouseId) derived.add(String(p.warehouseId));
    });
    const virtuals = Array.from(derived)
      .filter(k => !knownIds.has(k) && !knownNames.has(k))
      .map(k => ({ id: k, name: k }));
    return [...base, ...virtuals];
  }, [warehouses, rows]);

  // Logic Filter & Pagination (Harus di atas handleExport)
  // === GLOBAL BARCODE SCANNER LISTENER ===
  const [barcodeBuffer, setBarcodeBuffer] = useState('');

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key !== 'Enter') {
        if (e.key.length === 1) {
          setBarcodeBuffer((prev) => prev + e.key);
        }
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          setBarcodeBuffer('');
        }, 50); 
      } else {
        if (barcodeBuffer) {
          e.preventDefault();
          // Set searchQuery ke barcodeBuffer agar langsung memfilter list
          setSearchTerm(barcodeBuffer);
          setBarcodeBuffer('');
          notify.admin.success(`Mencari barcode: ${barcodeBuffer}`);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      clearTimeout(timeout);
    };
  }, [barcodeBuffer]);
  // ========================================

  const filteredAndSorted = useMemo(() => {
    return rows.filter(p => {
      const name = (p.name || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const term = searchTerm.toLowerCase();
      const matchSearch = name.includes(term) || sku.includes(term);
      const matchStatus = showInactive ? p.isActive === false : p.isActive !== false;
      return matchSearch && matchStatus;
    });
  }, [rows, searchTerm, showInactive]);

  const stats = useMemo(() => {
    const totalAset = filteredAndSorted.reduce((acc, curr) => acc + (Number(curr.stock || 0) * Number(curr.purchasePrice || 0)), 0);
    return { totalJenis: filteredAndSorted.length, totalAset };
  }, [filteredAndSorted]);

  const totalPages = Math.ceil(filteredAndSorted.length / itemsPerPage);
  const currentItems = filteredAndSorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Handlers
  const handleExport = () => {
    if (filteredAndSorted.length === 0) return notify.admin.error("Tidak ada data untuk diexport!");
    const t = notify.admin.loading("Mengunduh Excel...");
    try {
      const data = filteredAndSorted.map(p => ({
      ID: p.sku || '',
      Barcode: '',
      Nama: p.name,
      Kategori: p.category || 'Umum',
      Satuan: p.unit || 'Pcs',
      Stok: p.stock || 0,
      Min_Stok: p.minStock || 0,
      Modal: p.purchasePrice || 0,
      Total_Nilai_Aset: Number(p.stock || 0) * Number(p.purchasePrice || 0),
      Ecer: p.priceEcer || 0,
      Min_Grosir: p.Min_Grosir || 0,
      Harga_Grosir: p.priceGrosir || 0,
      Lokasi: p.Lokasi || '',
      Deskripsi: p.Deskripsi || '',
      URL_Produk: p.imageUrl || '',
      Status: p.isActive ? '1' : '0',
      warehouseId: p.warehouseId || '',
        Gudang_Nama: displayWarehouses.find(w => w.id === p.warehouseId)?.name || '-',
      tgl_masuk: p.tgl_masuk || '',
      expired_date: p.expired_date || ''
    }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Produk");
      XLSX.writeFile(wb, `EXPORT_PRODUK_${new Date().toISOString().split('T')[0]}.xlsx`);
      notify.admin.success("Berhasil!", { id: t });
    } catch { notify.admin.error("Gagal export!", { id: t }); }

  };

  const downloadTemplate = () => {
    const template = [{ ID: "P001", Barcode: "123", Nama: "CONTOH", Kategori: "Umum", Satuan: "Pcs", Stok: 0, Min_Stok: 5, Modal: 0, Ecer: 0, Min_Grosir: 0, Harga_Grosir: 0, Lokasi: "A1", Deskripsi: "-", URL_Produk: "", Status: 1, warehouseId: warehouses[0]?.id || "", tgl_masuk: "2024-01-01", expired_date: "" }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "TEMPLATE_PRODUK.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const t = notify.admin.loading("Mengimport...");
      try {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const data = (XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as Record<string, any>[]);

        const CHUNK_SIZE = 400;
        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
          const chunk = data.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);

          chunk.forEach((item) => {
            const exist = rows.find(p => p.sku === String(item.ID || ''));
            const pData = { ...item, updatedAt: serverTimestamp() };
            // Optional: clean up ID if it's just meant for internal mapping
            delete (pData as any).ID;

            if (exist) {
              batch.update(doc(db, 'products', exist.id), pData);
              const newStock = Number(item.Stok);
              const oldStock = Number(exist.stock || exist.Stok || 0);
              const diff = newStock - oldStock;
              if (diff !== 0) {
                const logRef = doc(collection(db, 'inventory_logs'));
                batch.set(logRef, {
                  productId: exist.id,
                  productName: exist.name || '',
                  type: diff > 0 ? 'MASUK' : 'KELUAR',
                  amount: Math.abs(diff),
                  adminId: auth.currentUser?.uid || 'system',
                  source: 'MANUAL',
                  note: `Bulk Import Update. Prev: ${oldStock}, New: ${newStock}`,
                  date: serverTimestamp()
                });
              }
            } else {
              const newRef = doc(collection(db, 'products'));
              batch.set(newRef, { ...pData, createdAt: serverTimestamp() });
              const stock = Number(item.Stok || 0);
              if (stock > 0) {
                const logRef = doc(collection(db, 'inventory_logs'));
                batch.set(logRef, {
                  productId: newRef.id,
                  productName: String(item.Nama || 'New Product'),
                  type: 'MASUK',
                  amount: stock,
                  adminId: auth.currentUser?.uid || 'system',
                  source: 'MANUAL',
                  note: 'Bulk Import (New Product)',
                  date: serverTimestamp()
                });
              }
            }
          });

          await batch.commit();
        }

        notify.admin.success(`Berhasil mengimport ${data.length} produk!`, { id: t });
      } catch (err) {
        console.error("Import Error:", err);
        notify.admin.error("Gagal import data!", { id: t });
      }
    };
    reader.readAsBinaryString(file);
  };





  if (loading) return <div className="p-10 text-center font-black">Loading ataya...</div>;


  // --- HANDLE DELETE ---
  const handleDelete = async (product: ProductRow) => {
    if (!confirm(`Hapus produk "${product.Nama}"? Tindakan ini tidak bisa dikembalikan.`)) return;
    
    try {
      await deleteDoc(doc(db, 'products', product.id));
      notify.success('Produk berhasil dihapus');
    } catch (error) {
      console.error('Gagal menghapus produk:', error);
      notify.error('Gagal menghapus produk');
    }
  };

  // --- HANDLE SYNC & RESET ---
  const handleSync = () => {
    const t = notify.admin.loading("Mensinkronkan data...");

    try {
      // Reset semua state ke kondisi awal
      setSearchTerm('');
      setCurrentPage(1);
      if (typeof setSelectedIds === 'function') setSelectedIds([]); // Pastikan state ini ada
      setShowInactive(false);

      // Simulasi proses sinkronisasi singkat
      setTimeout(() => {
        notify.admin.success("Data & Filter berhasil disegarkan!", { id: t });
      }, 700);
    } catch (err) {
      notify.admin.error("Gagal sinkron", { id: t });
      console.error(err);
    }
  };

  return (
    <ErrorBoundary>
      <div className="p-3 bg-gray-50 min-h-screen text-black">
      <Toaster />
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl shadow-sm">
            <Package size={18} />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black text-gray-900 tracking-tight leading-none">Atayamarket</h1>
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Inventory Management</p>
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={handleSync}
            className="bg-white border border-gray-100 text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-all shadow-sm flex items-center justify-center"
            title="Sinkron & Reset Filter"
          >
            <RefreshCw size={14} />
          </button>
          <button onClick={downloadTemplate} className="bg-white border border-gray-100 px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-tight flex items-center gap-1 hover:bg-gray-50 transition-all"><FileSpreadsheet size={12} /> Template</button>
          <button onClick={() => fileInputRef.current?.click()} className="bg-orange-500 text-white px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-tight flex items-center gap-1 shadow-sm hover:bg-orange-600 transition-all"><Upload size={12} /> Import</button>
          <button onClick={handleExport} className="bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-tight flex items-center gap-1 shadow-sm hover:bg-emerald-700 transition-all"><Download size={12} /> Export</button>
          <button onClick={() => router.push('/admin/products/add')} className="bg-gradient-to-r from-gray-900 to-black text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-md hover:shadow-lg transition-all"><Plus size={14} /> NEW SKU</button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-2 hover:shadow-md transition-all">
          <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Package size={16} /></div>
          <div>
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tight mb-0.5">Total SKU</p>
            <p className="text-sm font-black text-gray-900 leading-none">{stats.totalJenis}</p>
          </div>
        </div>
        
        <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-2 hover:shadow-md transition-all">
          <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
            <Banknote size={16} />
          </div>
          <div>
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tight mb-0.5">Total Value</p>
            <p className="text-sm font-black text-emerald-700 leading-none">
              <span className="text-[10px] font-bold mr-0.5">Rp</span>
              {stats.totalAset.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </div>

      {/* TABLE BOX */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-2">
        <div className="p-2 border-b border-gray-100 flex flex-wrap items-center gap-2 bg-white">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
            <input
              type="text"
              placeholder="Search SKU..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-50 bg-gray-50 text-[10px] font-bold focus:ring-2 focus:ring-blue-100 transition-all outline-none"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'updatedAt' | 'name')}
              className="px-2 py-1.5 rounded-lg border border-gray-50 bg-gray-50 text-[9px] font-black uppercase tracking-tight focus:ring-2 focus:ring-blue-100 transition-all outline-none"
            >
              <option value="createdAt">SORT: NEWEST</option>
              <option value="updatedAt">SORT: RECENT</option>
              <option value="name">SORT: NAME A-Z</option>
            </select>
            
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight border transition-all flex items-center gap-1 shadow-sm active:scale-95 ${
                showInactive 
                  ? 'bg-red-50 text-red-600 border-red-100' 
                  : 'bg-gray-50 text-gray-600 border-gray-100'
              }`}
            >
              {showInactive ? <EyeOff size={12} /> : <Eye size={12} />}
              {showInactive ? 'SHOW ACTIVE' : 'ARCHIVE'}
            </button>
          </div>

          {/* Bulk Action Button Bar */}
          {selectedIds.length > 0 && (
            <div className="w-full flex flex-wrap gap-1.5 pt-1">
              <button
                onClick={() => {
                  const idsParam = selectedIds.join(',');
                  window.open(`/admin/products/print-label/bulk?ids=${idsParam}`, '_blank');
                }}
                className="flex-1 max-w-[120px] bg-amber-500 text-white px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 shadow-sm shadow-amber-100 active:scale-95 transition-all"
              >
                <Printer size={12} /> LABELS ({selectedIds.length})
              </button>
              <button
                onClick={() => handleBulkStatus(showInactive ? 1 : 0)}
                className="flex-1 max-w-[120px] bg-blue-600 text-white px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 shadow-sm shadow-blue-100 active:scale-95 transition-all"
              >
                <CheckSquare size={12} /> {showInactive ? 'RESTORE' : 'ARCHIVE'}
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex-1 max-w-[120px] bg-red-600 text-white px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 shadow-sm shadow-red-100 active:scale-95 transition-all"
              >
                <Trash2 size={12} /> DELETE
              </button>
            </div>
          )}
        </div>

        {/* MOBILE LIST (Card mode) */}
        <div className="md:hidden">
          <div className="divide-y divide-gray-50">
            {currentItems.map((p) => {
              const whName = displayWarehouses.find(w => w.id === p.warehouseId)?.name || 'N/A';
              const isExpired = p.expired_date && new Date(p.expired_date) < new Date();
              const isSelected = selectedIds.includes(p.id);
              return (
                <div key={p.id} className={`p-2.5 flex flex-col gap-2 ${isSelected ? 'bg-blue-50/50' : 'bg-white'}`}>
                  <div className="flex items-start gap-2.5">
                    <button onClick={() => toggleSelectOne(p.id)} className="mt-0.5 text-gray-300">
                      {isSelected ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                    </button>
                    <div className="w-12 h-12 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                      {p.imageUrl && typeof p.imageUrl === 'string' && p.imageUrl.trim().startsWith('http') ? (
                        <Image src={p.imageUrl} alt={p.name} width={48} height={48} className="w-full h-full object-cover" />
                      ) : (
                        <Camera size={16} className="text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-[8px] font-black text-blue-500 uppercase tracking-tighter italic">#{p.sku || 'N/A'}</span>
                      </div>
                      <h3 className="font-black text-gray-900 text-[10px] uppercase leading-tight tracking-tight line-clamp-2">{p.name}</h3>
                      <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{p.category || 'GENERAL'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-1.5 px-2 border-y border-gray-50 bg-gray-50/30 rounded-lg">
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Stock</p>
                      <p className={`font-black text-xs leading-none ${Number(p.stock) <= Number(p.minStock) ? 'text-red-600' : 'text-gray-900'}`}>
                        {p.stock} <span className="text-[9px] uppercase">{p.unit}</span>
                      </p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {p.stockByWarehouse && Object.keys(p.stockByWarehouse).length > 0 ? (
                          Object.entries(p.stockByWarehouse).map(([whId, qty]) => {
                            const wName = displayWarehouses.find(w => w.id === whId)?.name || whId;
                            return (
                              <span key={whId} className="text-[7px] font-black text-gray-500 bg-white border border-gray-100 rounded px-1 py-0.5 uppercase">
                                {wName}: {qty}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[7px] font-black text-gray-500 bg-white border border-gray-100 rounded px-1 py-0.5 uppercase">
                            {whName}: {p.stock}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Sell Price</p>
                      <p className="text-xs font-black text-emerald-600 leading-none">
                        <span className="text-[9px] mr-0.5">Rp</span>
                        {(p.priceEcer || 0).toLocaleString('id-ID')}
                      </p>
                      <p className="text-[8px] font-bold text-blue-500/70 italic mt-0.5">
                        Avg: Rp{(p.purchasePrice || 0).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <p className={`text-[9px] font-black uppercase tracking-tight flex items-center gap-1 ${isExpired ? 'text-red-500' : 'text-gray-400'}`}>
                        {isExpired && <AlertTriangle size={10} className="animate-pulse" />}
                        Exp: {p.expired_date || '-'}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button 
                        onClick={() => setSelectedProductRestock(p)} 
                        className="w-7 h-7 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        title="Quick Stock"
                      >
                        <Calculator size={12} />
                      </button>
                      <Link 
                        href={`/admin/products/edit/${p.id}`} 
                        className="w-7 h-7 flex items-center justify-center bg-gray-50 text-gray-600 rounded-lg hover:bg-black hover:text-white transition-all shadow-sm"
                        title="Edit Item"
                      >
                        <Edit size={12} />
                      </Link>
                      <button 
                        onClick={() => handleDelete(p)} 
                        className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                        title="Archive"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full text-left min-w-[640px] md:min-w-0">
            <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
              <tr>
                <th className="px-2 py-2.5 w-8 sticky left-0 bg-gray-50 z-10 text-center">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600 transition-colors">
                    {selectedIds.length === currentItems.length && currentItems.length > 0 ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} />}
                  </button>
                </th>
                <th className="px-2 py-2.5">Produk</th>
                <th className="px-2 py-2.5">Stok & Gudang</th>
                <th className="hidden md:table-cell px-2 py-2.5">Harga (Avg)</th>
                <th className="hidden md:table-cell px-2 py-2.5">Tgl & Exp</th>
                <th className="px-2 py-2.5 text-right pr-4 sticky right-0 bg-gray-50 z-10">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentItems.map(p => {
                const whName = displayWarehouses.find(w => w.id === p.warehouseId)?.name || 'N/A';
                const isExpired = p.expired_date && new Date(p.expired_date) < new Date();
                const isSelected = selectedIds.includes(p.id);

                return (
                  <tr key={p.id} className={`hover:bg-gray-50 transition-all ${isSelected ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-2 py-2 sticky left-0 bg-white z-10 text-center">
                      <button onClick={() => toggleSelectOne(p.id)} className="transition-colors mt-1">
                        {isSelected ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} className="text-gray-300 hover:text-gray-400" />}
                      </button>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative">
                          {p.imageUrl && typeof p.imageUrl === 'string' && p.imageUrl.trim().startsWith('http') ? (
                            <Image
                              src={p.imageUrl}
                              alt={p.name}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : (
                            <Camera size={14} className="text-gray-300" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-0.5">
                            <p className="text-[8px] font-black text-blue-500 tracking-tight italic">ID: {p.sku}</p>
                          </div>
                          <h3 className="font-black text-gray-900 text-[10px] leading-none mb-0.5 max-w-[120px] md:max-w-none truncate">{p.name}</h3>
                          <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">{p.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <p className={`font-black text-[10px] leading-none ${Number(p.stock) <= Number(p.minStock) ? 'text-red-600' : 'text-gray-900'}`}>
                            {p.stock} <span className="text-[8px] uppercase">{p.unit}</span>
                          </p>
                        </div>
                        {Number(p.stock) <= Number(p.minStock) && (
                          <p className="text-[7px] font-bold text-red-500 uppercase">
                            Min: {p.minStock}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {p.stockByWarehouse && Object.keys(p.stockByWarehouse).length > 0 ? (
                            Object.entries(p.stockByWarehouse).map(([whId, qty]) => {
                              const wName = displayWarehouses.find(w => w.id === whId)?.name || whId;
                              return (
                                <span key={whId} className="text-[7px] font-black bg-gray-50 border border-gray-100 text-gray-500 rounded px-1 py-0.5 uppercase">
                                  {wName}: {qty}
                               </span>
                              );
                            })
                          ) : (
                            <span className="text-[7px] font-black bg-gray-50 border border-gray-100 text-gray-500 rounded px-1 py-0.5 uppercase">
                              {whName}: {p.stock}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-2 py-2">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[8px] font-bold text-blue-500 italic">
                          Avg: Rp{(p.purchasePrice || 0).toLocaleString('id-ID')}
                        </p>
                        <p className="text-[10px] font-black text-emerald-600 leading-none">
                          Rp{(p.priceEcer || 0).toLocaleString('id-ID')}
                        </p>
                        {Number(p.priceGrosir || 0) > 0 && (
                          <p className="text-[8px] font-black text-purple-600">
                            Gros: Rp{Number(p.priceGrosir || 0).toLocaleString('id-ID')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-2 py-2">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[8px] font-bold text-gray-400">
                          M: {p.tgl_masuk || p.createdAt ? (p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('id-ID') : new Date(p.createdAt).toLocaleDateString('id-ID')) : '-'}
                        </p>
                        <p className={`text-[8px] font-black uppercase flex items-center gap-1 ${isExpired ? 'text-red-500' : 'text-orange-400'}`}>
                          {isExpired && <AlertTriangle size={8} />} 
                          E: {p.expired_date || p.expiredDate || p.Expired_Default || '-'}
                        </p>
                      </div>
                    </td>

                    <td className="px-2 py-2 text-right sticky right-0 bg-white z-10 pr-4 group-hover:bg-gray-50 transition-colors">
                      <div className="flex justify-end gap-1.5">
                        <button 
                          onClick={() => setSelectedProductRestock(p)} 
                          className="w-7 h-7 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                          title="Restock"
                        >
                          <Calculator size={12} />
                        </button>
                        <Link 
                          href={`/admin/products/print-label/${p.id}`} 
                          className="w-7 h-7 flex items-center justify-center bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                          title="Cetak Label Rak"
                        >
                          <Printer size={12} />
                        </Link>
                        <Link 
                          href={`/admin/products/edit/${p.id}`} 
                          className="w-7 h-7 flex items-center justify-center bg-gray-50 text-gray-600 rounded-lg hover:bg-black hover:text-white transition-all shadow-sm"
                          title="Edit"
                        >
                          <Edit size={12} />
                        </Link>
                        <button 
                          onClick={() => handleDelete(p)} 
                          className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                          title="Hapus"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="px-3 py-2 bg-gray-50/50 flex justify-between items-center border-t border-gray-100">
          <div className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Page {currentPage} / {totalPages || 1} — {filteredAndSorted.length} Items</div>

          <div className="flex gap-1.5 items-center">
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mr-1">Tampilan</span>
            {[100, 500, 1000].map(n => (
              <button
                key={n}
                onClick={() => { setItemsPerPage(n); setCurrentPage(1); }}
                className={`px-2 py-1 bg-white border rounded-lg text-[9px] font-black shadow-sm transition-all ${
                  itemsPerPage === n ? 'bg-black text-white border-black' : 'hover:bg-gray-50'
                }`}
              >
                {n}
              </button>
            ))}
            <div className="w-[1px] h-3 bg-gray-200 mx-1"></div>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 px-2.5 bg-white border rounded-lg disabled:opacity-30 shadow-sm hover:bg-gray-50 transition-all"><ChevronLeft size={14} /></button>
            <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} className="p-1 px-2.5 bg-white border rounded-lg disabled:opacity-30 shadow-sm hover:bg-gray-50 transition-all"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {selectedProductRestock && <RestockModal product={selectedProductRestock} isOpen={!!selectedProductRestock} onClose={() => setSelectedProductRestock(null)} />}

    </div>
  </ErrorBoundary>
);
}
