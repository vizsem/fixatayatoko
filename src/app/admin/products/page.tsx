'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import useProducts from '@/lib/hooks/useProducts';
import type { NormalizedProduct, UnitOption } from '@/lib/normalize';
import { addInventoryLog } from '@/lib/inventory';


import {
  deleteProduct,
  deleteProductsBulk,
  archiveProducts,
  updateProductStatus,
  restockProductViaSupabase,
  duplicateProduct,
  detachVariantAction,
} from '@/lib/actions/product.actions';


import Link from 'next/link';
import {
  Plus, Edit, Trash2, Download, Upload, Search, X,
  Camera, Warehouse, Calculator, Eye, EyeOff, ChevronLeft, ChevronRight, ChevronDown,
  FileSpreadsheet, AlertTriangle, Package, Banknote, RefreshCw,
  CheckSquare, Printer, Square, Archive, RotateCcw, Copy, Layers, UploadCloud,
  Unlink, CornerDownRight, MoreVertical, AlertCircle, Sparkles, Filter, ChevronUp
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import CameraBarcodeScannerModal from '@/components/scanner/CameraBarcodeScannerModal';
import UnfoundBarcodeModal from '@/components/scanner/UnfoundBarcodeModal';
import QuickVariantModal from '@/components/admin/QuickVariantModal';
import MergeVariantsModal from '@/components/admin/MergeVariantsModal';
import TikTokImportModal from '@/components/admin/products/TikTokImportModal';
import ShopeeImportModal from '@/components/admin/products/ShopeeImportModal';
import { playScanBeep } from '@/lib/sound';


// CATATAN: SheetJS (xlsx, ±400 KB) TIDAK diimpor di sini. Library itu hanya
// dipakai saat Export/Import Excel ditekan, jadi dimuat dengan
// `await import('xlsx')` di dalam handler masing-masing — kalau diimpor statis,
// halaman produk mengunduhnya sebelum bisa tampil.
import { supabase } from '@/lib/supabase';




/** Compute stock expressed in each configured unit. Returns array of {code, qty, contains}. */
function stockInUnits(stock: number, units?: { code: string; contains?: number }[]): { code: string; qty: number; contains: number }[] {
  if (!units || units.length === 0) return [];
  return units
    .filter(u => u.contains && u.contains > 1)
    .map(u => ({ code: u.code, qty: Math.floor(stock / u.contains!), contains: u.contains! }))
    .filter(u => u.qty > 0);
}

/** Shows compact unit-breakdown badges below a stock number */
function StockUnitDisplay({ stock, baseUnit, units }: { stock: number; baseUnit: string; units?: { code: string; contains?: number }[] }) {
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


export type ProductRow = NormalizedProduct & {
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
      const res = await restockProductViaSupabase(
        product.id,
        stokMasuk,
        hargaBaru,
        'system',
        product.warehouseId || 'gudang-utama'
      );

      if (!res.success) {
        throw new Error(res.error || "Gagal update data restock");
      }

      notify.admin.success("Restock & Log Berhasil tersimpan ke database!");
      
      // Force reload to reflect latest changes from Supabase
      window.location.reload();
      
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
            <p className="text-xs font-black text-blue-600 mb-1">Estimasi modal baru</p>

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
  const [showTikTokModal, setShowTikTokModal] = useState(false);
  const [showShopeeModal, setShowShopeeModal] = useState(false);
  /* badge BARU di-nonaktifkan untuk menjaga kepatuhan lint */

  // Fungsi Toggle Select
  const toggleSelectAll = () => {
    if (selectedIds.length === currentItems.length) setSelectedIds([]);
    else setSelectedIds(currentItems.map(p => p.id));
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  // Bulk Progress State
  const [bulkProgress, setBulkProgress] = useState<{
    isOpen: boolean;
    title: string;
    current: number;
    total: number;
    percent: number;
    status: 'processing' | 'done' | 'error';
    errorMsg?: string;
  }>({
    isOpen: false,
    title: '',
    current: 0,
    total: 0,
    percent: 0,
    status: 'processing'
  });

  // Fungsi Bulk Update Status dengan Chunking & Live Progress Bar
  const handleBulkStatus = async (newStatus: number) => {
    if (selectedIds.length === 0) return;
    const isArchiving = newStatus === 1;
    const actionLabel = isArchiving ? 'Arsipkan' : 'Pulihkan';
    const totalItems = selectedIds.length;
    if (!confirm(`${actionLabel} ${totalItems} produk yang dipilih?`)) return;

    setBulkProgress({
      isOpen: true,
      title: `${actionLabel} ${totalItems} Produk`,
      current: 0,
      total: totalItems,
      percent: 0,
      status: 'processing'
    });

    const chunkSize = 100;
    const chunks: string[][] = [];
    for (let i = 0; i < totalItems; i += chunkSize) {
      chunks.push(selectedIds.slice(i, i + chunkSize));
    }

    try {
      let processed = 0;
      for (const chunk of chunks) {
        const res = await updateProductStatus(chunk, newStatus);
        if (!res?.success) throw new Error(res?.error || "Gagal memperbarui sebagian produk");
        processed += chunk.length;
        const pct = Math.round((processed / totalItems) * 100);
        setBulkProgress(prev => ({
          ...prev,
          current: processed,
          percent: pct
        }));
      }

      setBulkProgress(prev => ({
        ...prev,
        current: totalItems,
        percent: 100,
        status: 'done'
      }));

      setSelectedIds([]);
      notify.admin.success(`Berhasil di-${actionLabel.toLowerCase()} ${totalItems} produk!`);
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err: any) {
      console.error(err);
      setBulkProgress(prev => ({
        ...prev,
        status: 'error',
        errorMsg: err?.message || 'Terjadi kesalahan saat memproses data'
      }));
      notify.admin.error(err?.message || "Gagal memperbarui status produk");
    }
  };

  // Fungsi Bulk Delete dengan Chunking & Live Progress Bar
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const totalItems = selectedIds.length;
    if (!confirm(`PERINGATAN: Hapus permanen ${totalItems} produk? Tindakan ini TIDAK DAPAT DIBATALKAN.`)) return;

    setBulkProgress({
      isOpen: true,
      title: `Menghapus Permanen ${totalItems} Produk`,
      current: 0,
      total: totalItems,
      percent: 0,
      status: 'processing'
    });

    const chunkSize = 100;
    const chunks: string[][] = [];
    for (let i = 0; i < totalItems; i += chunkSize) {
      chunks.push(selectedIds.slice(i, i + chunkSize));
    }

    try {
      let processed = 0;
      for (const chunk of chunks) {
        const res = await deleteProductsBulk(chunk);
        if (!res?.success) throw new Error(res?.error || 'Gagal menghapus sebagian produk');
        processed += chunk.length;
        const pct = Math.round((processed / totalItems) * 100);
        setBulkProgress(prev => ({
          ...prev,
          current: processed,
          percent: pct
        }));
      }

      setBulkProgress(prev => ({
        ...prev,
        current: totalItems,
        percent: 100,
        status: 'done'
      }));

      setSelectedIds([]);
      notify.admin.success(`Berhasil menghapus permanen ${totalItems} produk!`);
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err: any) {
      console.error(err);
      setBulkProgress(prev => ({
        ...prev,
        status: 'error',
        errorMsg: err?.message || 'Terjadi kesalahan saat menghapus data'
      }));
      notify.admin.error(err?.message || "Gagal menghapus produk");
    }
  };
  // States
  const [loading, setLoading] = useState(true);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [unfoundBarcode, setUnfoundBarcode] = useState('');
  const [showUnfoundModal, setShowUnfoundModal] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const [selectedProductRestock, setSelectedProductRestock] = useState<ProductRow | null>(null);
  const [selectedProductVariants, setSelectedProductVariants] = useState<ProductRow | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'name'>('createdAt');
  const [quickFilter, setQuickFilter] = useState<'all' | 'out_of_stock' | 'low_stock' | 'no_image' | 'no_cost'>('all');
  const [dbCounts, setDbCounts] = useState<{ active: number; inactive: number }>({ active: 0, inactive: 0 });

  // State untuk Hierarki Varian & Merge Varian
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [viewHierarchy, setViewHierarchy] = useState<'grouped' | 'flat' | 'parents_only' | 'variants_only'>('grouped');
  const [detachingId, setDetachingId] = useState<string | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [showImportExportMenu, setShowImportExportMenu] = useState(false);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-action-menu]')) {
        setActiveActionMenuId(null);
      }
      if (!target.closest('[data-import-menu]')) {
        setShowImportExportMenu(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const toggleParentExpand = (parentId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const handleDetachVariant = async (variant: ProductRow) => {
    if (!confirm(`Lepas varian "${variant.name}" agar menjadi produk mandiri?`)) return;
    setDetachingId(variant.id);
    try {
      const res = await detachVariantAction(variant.id);
      if (res.success) {
        notify.admin.success(`Varian "${variant.name}" kini menjadi produk mandiri.`);
      } else {
        notify.admin.error(res.error || 'Gagal melepaskan varian');
      }
    } catch (e: any) {
      notify.admin.error(e?.message || 'Gagal melepaskan varian');
    } finally {
      setDetachingId(null);
    }
  };

  const { products: liveProducts, loading: productsLoading } = useProducts({
    isActive: showInactive ? false : true,
    orderByField: sortBy,
    orderDirection: 'desc',
    search: debouncedSearch,
  });

  // Fetch count live
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [resAct, resInact] = await Promise.all([
          supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', false)
        ]);
        setDbCounts({
          active: resAct.count || 0,
          inactive: resInact.count || 0
        });
      } catch (e) {
        console.error("Error fetching product counts:", e);
      }
    };
    fetchCounts();
  }, [showInactive]);

  // Effects
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login?callbackUrl=/admin/products'); return; }
      setLoading(false);
    };
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) router.push('/admin/login?callbackUrl=/admin/products');
      else setLoading(false);
    });

    // Load warehouses once
    supabase.from('warehouses').select('id,name').then(({ data }) => {
      if (data) setWarehouses(data as Warehouse[]);
    });

    return () => { subscription.unsubscribe(); };
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

  // Handle barcode scanned from camera or hardware USB scanner
  const handleBarcodeScanned = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    // Cek apakah barcode cocok dengan produk yang ada (Barcode utama, SKU, atau Barcode multi-unit)
    const found = rows.find(p => 
      (p.barcode && p.barcode.toLowerCase() === trimmed.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase() === trimmed.toLowerCase()) ||
      (p.units && p.units.some(u => (u as any).barcode && (u as any).barcode.toLowerCase() === trimmed.toLowerCase()))
    );

    if (found) {
      setSearchTerm(trimmed);
      setCurrentPage(1);
      notify.admin.success(`Produk ditemukan: ${found.name}`);
    } else {
      // Tidak ditemukan -> Munculkan modal pilihan cerdas
      setUnfoundBarcode(trimmed);
      setShowUnfoundModal(true);
    }
  };

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
          playScanBeep();
          handleBarcodeScanned(barcodeBuffer);
          setBarcodeBuffer('');
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

  // Peta anak varian berdasarkan Parent_ID
  const childrenByParent = useMemo(() => {
    const map = new Map<string, ProductRow[]>();
    rows.forEach((p) => {
      if (p.parentId) {
        const list = map.get(p.parentId) || [];
        list.push(p);
        map.set(p.parentId, list);
      }
    });
    return map;
  }, [rows]);

  const selectedProductsForMerge = useMemo(() => {
    return rows.filter((p) => selectedIds.includes(p.id));
  }, [rows, selectedIds]);

  const filteredAndSorted = useMemo(() => {
    let result = rows;
    const term = searchTerm.trim().toLowerCase();
    const matchedParentsFromVariants = new Set<string>();

    if (term) {
      const tokens = term.split(/\s+/).filter(Boolean);
      result = result.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        const barcode = (p.barcode || '').toLowerCase();
        const category = (p.category || '').toLowerCase();
        const match = tokens.every(
          (t) =>
            name.includes(t) ||
            sku.includes(t) ||
            barcode.includes(t) ||
            category.includes(t)
        );
        if (match && p.parentId) {
          matchedParentsFromVariants.add(p.parentId);
        }
        return match;
      });
    }

    let filtered = result.filter((p) => (showInactive ? p.isActive === false : p.isActive !== false));
    if (quickFilter === 'out_of_stock') {
      filtered = filtered.filter(p => Number(p.stock || p.Stok || 0) <= 0);
    } else if (quickFilter === 'low_stock') {
      filtered = filtered.filter(p => {
        const stock = Number(p.stock || p.Stok || 0);
        const min = Number(p.minStock || p.Min_Stok || 5);
        return stock > 0 && stock <= min;
      });
    } else if (quickFilter === 'no_image') {
      filtered = filtered.filter(p => !p.imageUrl && !p.image && !p.foto && !p.URL_Produk);
    } else if (quickFilter === 'no_cost') {
      filtered = filtered.filter(p => Number(p.purchasePrice || p.Modal || 0) <= 0);
    }

    // Filter mode hierarki varian
    if (viewHierarchy === 'grouped') {
      // Sembunyikan anak varian dari baris utama, tampilkan hanya induk / produk tunggal
      // Jika pencarian aktif dan ada varian yang cocok, tampilkan induknya
      filtered = filtered.filter((p) => !p.parentId || matchedParentsFromVariants.has(p.id));
    } else if (viewHierarchy === 'parents_only') {
      // Tampilkan semua produk yang BUKAN anak varian (tidak punya parentId)
      // = produk mandiri + produk yang jadi induk
      filtered = filtered.filter((p) => !p.parentId);
    } else if (viewHierarchy === 'variants_only') {
      filtered = filtered.filter((p) => Boolean(p.parentId));
    }
    // 'flat': semua baris tampil mandiri

    return filtered;
  }, [rows, searchTerm, showInactive, quickFilter, viewHierarchy, childrenByParent]);

  const quickCounts = useMemo(() => {
    let outOfStock = 0;
    let lowStock = 0;
    let noImage = 0;
    let noCost = 0;
    rows.forEach(p => {
      const stock = Number(p.stock || p.Stok || 0);
      const min = Number(p.minStock || p.Min_Stok || 5);
      const cost = Number(p.purchasePrice || p.Modal || 0);
      const hasImage = Boolean(p.imageUrl || p.image || p.foto || p.URL_Produk);

      if (stock <= 0) outOfStock++;
      else if (stock <= min) lowStock++;
      if (!hasImage) noImage++;
      if (cost <= 0) noCost++;
    });
    return { outOfStock, lowStock, noImage, noCost };
  }, [rows]);

  const stats = useMemo(() => {
    const totalAset = filteredAndSorted.reduce((acc, curr) => acc + (Number(curr.stock || 0) * Number(curr.purchasePrice || 0)), 0);
    return { totalJenis: filteredAndSorted.length, totalAset };
  }, [filteredAndSorted]);

  const totalPages = Math.ceil(filteredAndSorted.length / itemsPerPage);
  const currentItems = filteredAndSorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Handlers
  const handleExport = async () => {
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
      // `xlsx` (SheetJS) ±400 KB dan hanya dipakai saat tombol ini ditekan.
      // Impor statis membuat halaman produk mengunduhnya sebelum bisa tampil.
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Produk");
      XLSX.writeFile(wb, `EXPORT_PRODUK_${new Date().toISOString().split('T')[0]}.xlsx`);
      notify.admin.success("Berhasil!", { id: t });
    } catch { notify.admin.error("Gagal export!", { id: t }); }

  };

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
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
        const XLSX = await import('xlsx');
        const wb = XLSX.read(bstr, { type: 'binary' });
        const data = (XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as Record<string, any>[]);

        const CHUNK_SIZE = 400;
        const currentAdminId = (await supabase.auth.getUser()).data.user?.id || 'system';

        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
          const chunk = data.slice(i, i + CHUNK_SIZE);

          await Promise.all(chunk.map(async (item) => {
            const exist = rows.find(p => p.sku === String(item.ID || ''));
            const now = new Date().toISOString();

            if (exist) {
              const pData = { ...item, updatedAt: now };
              delete (pData as any).ID;
              await supabase.from('products').update({
                raw_data: pData,
                updated_at: now
              }).eq('id', exist.id);

              const newStock = Number(item.Stok);
              const oldStock = Number(exist.stock || exist.Stok || 0);
              const diff = newStock - oldStock;
              if (diff !== 0) {
                await supabase.from('inventory_logs').insert({
                  id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  product_id: exist.id,
                  product_name: exist.name || '',
                  type: diff > 0 ? 'MASUK' : 'KELUAR',
                  amount: Math.abs(diff),
                  admin_id: currentAdminId,
                  source: 'MANUAL',
                  note: `Bulk Import Update. Prev: ${oldStock}, New: ${newStock}`,
                  date: now
                });
              }
            } else {
              const newId = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              const pData = { ...item, createdAt: now };
              delete (pData as any).ID;
              await supabase.from('products').insert({
                id: newId,
                name: String(item.Nama || 'New Product'),
                raw_data: pData,
                created_at: now,
                updated_at: now
              });
              const stock = Number(item.Stok || 0);
              if (stock > 0) {
                await supabase.from('inventory_logs').insert({
                  id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  product_id: newId,
                  product_name: String(item.Nama || 'New Product'),
                  type: 'MASUK',
                  amount: stock,
                  admin_id: currentAdminId,
                  source: 'MANUAL',
                  note: 'Bulk Import (New Product)',
                  date: now
                });
              }
            }
          }));
        }

        notify.admin.success(`Berhasil mengimport ${data.length} produk!`, { id: t });
      } catch (err) {
        console.error("Import Error:", err);
        notify.admin.error("Gagal import data!", { id: t });
      }
    };
    reader.readAsBinaryString(file);
  };





  if (loading) {
    return (
      <div className="p-3 md:p-6 bg-gray-50 min-h-screen space-y-4 animate-pulse">
        {/* Header skeleton */}
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-xl" />
            <div className="space-y-1.5">
              <div className="w-32 h-6 bg-gray-200 rounded-md" />
              <div className="w-24 h-3 bg-gray-100 rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-24 h-9 bg-gray-200 rounded-xl" />
            <div className="w-28 h-9 bg-gray-300 rounded-xl" />
          </div>
        </div>

        {/* 4 Stats skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-16 h-3 bg-gray-200 rounded" />
                <div className="w-24 h-5 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-xs">
          <div className="h-10 bg-gray-100 rounded-xl w-full" />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-gray-200 rounded-xl shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="w-1/3 h-4 bg-gray-200 rounded" />
                  <div className="w-1/4 h-3 bg-gray-100 rounded" />
                </div>
              </div>
              <div className="w-20 h-4 bg-gray-200 rounded" />
              <div className="w-24 h-4 bg-gray-200 rounded" />
              <div className="w-24 h-8 bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }


  const handleDelete = async (product: ProductRow) => {
    if (!confirm(`Hapus permanen produk "${product.Nama || product.name}"? Tindakan ini tidak bisa dikembalikan.`)) return;
    const t = notify.admin.loading('Menghapus produk...');
    try {
      const res = await deleteProduct(product.id);
      if (!res?.success) throw new Error(res?.error || 'Gagal menghapus produk');
      notify.admin.success('Produk berhasil dihapus', { id: t });
      window.location.reload(); 
    } catch (error: any) {
      console.error('Gagal menghapus produk:', error);
      notify.admin.error(error?.message || 'Gagal menghapus produk', { id: t });
    }
  };

  const handleArchive = async (product: ProductRow, shouldArchive: boolean) => {
    const actionLabel = shouldArchive ? 'Arsipkan' : 'Pulihkan';
    if (!confirm(`${actionLabel} produk "${product.Nama || product.name}"?`)) return;
    
    const t = notify.admin.loading(`${actionLabel} produk...`);
    try {
      const res = await updateProductStatus([product.id], shouldArchive ? 1 : 0);
      if (!res?.success) throw new Error(res?.error || `Gagal ${actionLabel.toLowerCase()} produk`);
      notify.admin.success(`Produk berhasil di-${actionLabel.toLowerCase()}!`, { id: t });
      window.location.reload();
    } catch (error: any) {
      console.error('Gagal mengubah status arsip produk:', error);
      notify.admin.error(error?.message || `Gagal ${actionLabel.toLowerCase()} produk`, { id: t });
    }
  };

  const handleDuplicate = async (product: ProductRow) => {
    if (!confirm(`Duplikat produk "${product.name || product.Nama}"? Produk baru akan dibuat dengan stok 0.`)) return;
    setDuplicatingId(product.id);
    const t = notify.admin.loading('Menduplikasi produk...');
    try {
      const res = await duplicateProduct(product.id);
      if (!res?.success) throw new Error(res?.error || 'Gagal menduplikasi produk');
      notify.admin.success(`Produk "${res.name}" berhasil diduplikasi!`, { id: t });
      setTimeout(() => window.location.reload(), 800);
    } catch (error: any) {
      notify.admin.error(error?.message || 'Gagal menduplikasi produk', { id: t });
    } finally {
      setDuplicatingId(null);
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
      <div className="p-3 bg-gray-50 text-black">
      <Toaster />
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3.5 gap-2.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-sm shadow-blue-500/20">
            <Package size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight leading-none">Katalog Produk</h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                <Sparkles size={11} className="text-blue-500" />
                Live Sync
              </span>
            </div>
            <p className="text-xs font-semibold text-gray-400 mt-1">Kelola stok inventaris, varian produk, dan penetapan harga</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <button
            onClick={handleSync}
            className="p-2.5 bg-white border border-gray-200 text-gray-700 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-all shadow-xs"
            title="Sinkron & Reset Filter"
          >
            <RefreshCw size={15} />
          </button>

          {/* Import / Export & Integrasi Dropdown */}
          <div className="relative" data-import-menu>
            <button
              type="button"
              onClick={() => setShowImportExportMenu(prev => !prev)}
              className="px-3 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <UploadCloud size={14} className="text-blue-600" />
              <span>Import & Integrasi</span>
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${showImportExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showImportExportMenu && (
              <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400">Excel / Spreadsheet</div>
                <button
                  type="button"
                  onClick={() => { setShowImportExportMenu(false); fileInputRef.current?.click(); }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                >
                  <Upload size={14} className="text-orange-500" />
                  <span>Import Data Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowImportExportMenu(false); handleExport(); }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                >
                  <Download size={14} className="text-emerald-600" />
                  <span>Export Data Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowImportExportMenu(false); downloadTemplate(); }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <FileSpreadsheet size={14} className="text-blue-500" />
                  <span>Unduh Template Excel</span>
                </button>

                <div className="my-1 border-t border-gray-100" />
                <div className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400">Marketplace & Supplier</div>
                <Link
                  href="/admin/purchases/import-supplier-prices"
                  onClick={() => setShowImportExportMenu(false)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <UploadCloud size={14} className="text-blue-600" />
                  <span>Import Harga Supplier</span>
                </Link>
                <button
                  type="button"
                  onClick={() => { setShowImportExportMenu(false); setShowShopeeModal(true); }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                >
                  <span className="w-4 h-4 rounded-full bg-[#EE4D2D] text-white flex items-center justify-center text-[10px] font-black">S</span>
                  <span>Integrasi Shopee</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowImportExportMenu(false); setShowTikTokModal(true); }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-black">T</span>
                  <span>Integrasi TikTok Shop</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => router.push('/admin/products/add')}
            className="bg-gray-900 hover:bg-black text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wide flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            <Plus size={15} />
            <span>Tambah Produk</span>
          </button>
        </div>
      </div>

      {/* STATS KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3.5">
        <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl shrink-0">
            <Package size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Katalog</p>
            <p className="text-base font-black text-gray-900 leading-tight tabular-nums mt-0.5">{stats.totalJenis.toLocaleString('id-ID')} <span className="text-[11px] font-bold text-gray-400">SKU</span></p>
            <p className="text-[10px] font-semibold text-gray-500 mt-0.5 truncate">{dbCounts.active || stats.totalJenis} Aktif • {dbCounts.inactive || 0} Arsip</p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl shrink-0">
            <Banknote size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Estimasi Nilai Aset</p>
            <p className="text-base font-black text-emerald-700 leading-tight tabular-nums mt-0.5">
              <span className="text-xs font-bold mr-0.5">Rp</span>
              {stats.totalAset.toLocaleString('id-ID')}
            </p>
            <p className="text-[10px] font-semibold text-gray-500 mt-0.5">HPP Modal × Stok Fisik</p>
          </div>
        </div>

        <div
          onClick={() => { setQuickFilter(quickFilter === 'out_of_stock' ? 'all' : 'out_of_stock'); setCurrentPage(1); }}
          className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3 cursor-pointer hover:border-rose-200 transition-all group"
        >
          <div className="bg-rose-50 text-rose-600 group-hover:bg-rose-100 p-2.5 rounded-xl shrink-0 transition-colors">
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Perhatian Stok</p>
            <p className="text-base font-black text-rose-600 leading-tight tabular-nums mt-0.5">
              {(quickCounts.outOfStock + quickCounts.lowStock).toLocaleString('id-ID')} <span className="text-[11px] font-bold text-rose-400">Item</span>
            </p>
            <p className="text-[10px] font-semibold text-gray-500 mt-0.5 truncate">
              {quickCounts.outOfStock} Habis • {quickCounts.lowStock} Menipis
            </p>
          </div>
        </div>

        <div
          onClick={() => { setQuickFilter(quickFilter === 'no_image' ? 'all' : 'no_image'); setCurrentPage(1); }}
          className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3 cursor-pointer hover:border-purple-200 transition-all group"
        >
          <div className="bg-purple-50 text-purple-600 group-hover:bg-purple-100 p-2.5 rounded-xl shrink-0 transition-colors">
            <Camera size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Perlu Dilengkapi</p>
            <p className="text-base font-black text-purple-600 leading-tight tabular-nums mt-0.5">
              {(quickCounts.noImage + quickCounts.noCost).toLocaleString('id-ID')} <span className="text-[11px] font-bold text-purple-400">Item</span>
            </p>
            <p className="text-[10px] font-semibold text-gray-500 mt-0.5 truncate">
              {quickCounts.noImage} Tanpa Foto • {quickCounts.noCost} Tanpa HPP
            </p>
          </div>
        </div>
      </div>

      {/* TABLE BOX */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200/80 overflow-hidden">
        {/* SEGMENTED TAB (AKTIF VS ARSIP) */}
        <div className="flex border-b border-gray-100 bg-gray-50/50 p-1.5 gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => { setShowInactive(false); setCurrentPage(1); setSelectedIds([]); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              !showInactive 
                ? 'bg-white text-emerald-700 border border-emerald-200 shadow-xs' 
                : 'text-gray-500 hover:text-gray-900 hover:bg-white/60'
            }`}
          >
            <Eye size={14} className={!showInactive ? 'text-emerald-600' : 'text-gray-400'} />
            <span>Produk Aktif</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              !showInactive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
            }`}>
              {dbCounts.active || stats.totalJenis}
            </span>
          </button>

          <button
            onClick={() => { setShowInactive(true); setCurrentPage(1); setSelectedIds([]); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              showInactive 
                ? 'bg-white text-rose-700 border border-rose-200 shadow-xs' 
                : 'text-gray-500 hover:text-gray-900 hover:bg-white/60'
            }`}
          >
            <Archive size={14} className={showInactive ? 'text-rose-600' : 'text-gray-400'} />
            <span>Arsip / Non-Aktif</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              showInactive ? 'bg-rose-100 text-rose-800' : 'bg-gray-200 text-gray-600'
            }`}>
              {dbCounts.inactive || 0}
            </span>
          </button>
        </div>

        <div className="p-2.5 border-b border-gray-100 flex flex-wrap items-center gap-2 bg-white">
          <div className="relative flex-1 min-w-[200px]">
            {productsLoading ? (
              <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" size={14} />
            ) : (
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            )}
            <input
              type="text"
              placeholder="Cari nama barang, SKU, barcode, kategori..."
              className="w-full pl-8 pr-7 py-2 rounded-xl border border-gray-200 bg-gray-50/50 text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all outline-none"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                title="Hapus pencarian"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowScannerModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold transition-all border border-blue-200/60 shadow-xs"
            title="Scan Barcode Kamera"
          >
            <Camera size={14} />
            <span className="hidden sm:inline">Scan Kamera</span>
          </button>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'updatedAt' | 'name')}
              className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50/50 text-xs font-bold uppercase tracking-tight focus:ring-2 focus:ring-blue-100 transition-all outline-none cursor-pointer"
            >
              <option value="createdAt">URUTKAN: TERBARU</option>
              <option value="updatedAt">URUTKAN: DIUPDATE</option>
              <option value="name">URUTKAN: NAMA A-Z</option>
            </select>

            {/* Tombol Pilih Semua Halaman Ini */}
            <button
              onClick={toggleSelectAll}
              className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-tight border transition-all flex items-center gap-1.5 shadow-xs active:scale-95 ${
                selectedIds.length === currentItems.length && currentItems.length > 0
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {selectedIds.length === currentItems.length && currentItems.length > 0 ? (
                <CheckSquare size={14} />
              ) : (
                <Square size={14} />
              )}
              <span>{selectedIds.length > 0 ? `Dipilih (${selectedIds.length})` : 'Pilih Semua'}</span>
            </button>
          </div>

          {/* Bulk Action Button Bar */}
          {selectedIds.length > 0 && (
            <div className="w-full flex flex-wrap items-center gap-2 p-2 bg-blue-50/80 rounded-xl border border-blue-200 animate-in fade-in duration-200">
              <span className="text-xs font-black text-blue-900 uppercase tracking-wide mr-1">
                {selectedIds.length} Produk Terpilih:
              </span>
              <button
                onClick={() => {
                  const idsParam = selectedIds.join(',');
                  window.open(`/admin/products/print-label/bulk?ids=${idsParam}`, '_blank');
                }}
                className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
              >
                <Printer size={13} /> Cetak Label ({selectedIds.length})
              </button>
              <button
                onClick={() => handleBulkStatus(showInactive ? 0 : 1)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
              >
                <CheckSquare size={13} /> {showInactive ? 'Pulihkan (Aktifkan)' : 'Arsipkan'}
              </button>
              {selectedIds.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setShowMergeModal(true)}
                  className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                >
                  <Layers size={13} /> Jadikan Varian ({selectedIds.length})
                </button>
              )}
              <button
                onClick={handleBulkDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
              >
                <Trash2 size={13} /> Hapus Permanen
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="ml-auto text-gray-500 hover:text-gray-800 text-xs font-bold uppercase tracking-wider underline"
              >
                Batalkan Pilihan
              </button>
            </div>
          )}
        </div>

        {/* Mode Hierarki Varian & Quick Filter Section */}
        <div className="px-3 py-2 bg-gray-50/70 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          {/* Mode Varian Switcher */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200/80 shadow-2xs overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-2 flex items-center gap-1 shrink-0">
              <Layers size={12} className="text-violet-600" />
              Tampilan:
            </span>
            <button
              type="button"
              onClick={() => { setViewHierarchy('grouped'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                viewHierarchy === 'grouped'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Hierarki Varian
            </button>
            <button
              type="button"
              onClick={() => { setViewHierarchy('flat'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                viewHierarchy === 'flat'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Semua Baris (Flat)
            </button>
            <button
              type="button"
              onClick={() => { setViewHierarchy('parents_only'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                viewHierarchy === 'parents_only'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Hanya Induk & Mandiri
            </button>
          </div>

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => { setQuickFilter('all'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                quickFilter === 'all'
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span>Semua</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${quickFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{rows.length}</span>
            </button>

            <button
              type="button"
              onClick={() => { setQuickFilter('out_of_stock'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                quickFilter === 'out_of_stock'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50'
              }`}
            >
              <AlertCircle size={12} />
              <span>Stok Habis</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${quickFilter === 'out_of_stock' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-700'}`}>
                {quickCounts.outOfStock}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setQuickFilter('low_stock'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                quickFilter === 'low_stock'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-amber-600 border border-amber-200 hover:bg-amber-50'
              }`}
            >
              <AlertTriangle size={12} />
              <span>Stok Menipis</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${quickFilter === 'low_stock' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'}`}>
                {quickCounts.lowStock}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setQuickFilter('no_image'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                quickFilter === 'no_image'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'
              }`}
            >
              <Camera size={12} />
              <span>Tanpa Foto</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${quickFilter === 'no_image' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-700'}`}>
                {quickCounts.noImage}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setQuickFilter('no_cost'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                quickFilter === 'no_cost'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-purple-600 border border-purple-200 hover:bg-purple-50'
              }`}
            >
              <Banknote size={12} />
              <span>Tanpa HPP</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${quickFilter === 'no_cost' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-700'}`}>
                {quickCounts.noCost}
              </span>
            </button>
          </div>
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
                      {p.imageUrl && typeof p.imageUrl === 'string' && (p.imageUrl.trim().startsWith('http') || p.imageUrl.trim().startsWith('/')) ? (
                        <img src={p.imageUrl} alt={p.name} width={48} height={48} className="w-full h-full object-cover" loading="lazy" decoding="async" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo-atayatoko.png'; }} />
                      ) : (
                        <Camera size={16} className="text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-black text-blue-500 uppercase tracking-tighter italic">#{p.sku || 'N/A'}</span>
                        <span className={`text-xs font-black uppercase px-1.5 py-0.5 rounded ${
                          p.isActive === false ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {p.isActive === false ? 'Arsip' : 'Aktif'}
                        </span>
                        {p.parentId ? (
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                            Varian
                          </span>
                        ) : null}
                      </div>
                      <h3 className="font-black text-gray-900 text-sm uppercase leading-tight tracking-tight line-clamp-2">{p.name}</h3>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{p.category || 'GENERAL'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-1.5 px-2 border-y border-gray-50 bg-gray-50/30 rounded-lg">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Stock</p>
                      <p className={`font-black text-xs leading-none tabular-nums ${Number(p.stock) <= Number(p.minStock) ? 'text-red-600' : 'text-gray-900'}`}>
                        {p.stock} <span className="text-xs uppercase">{p.unit}</span>
                      </p>
                      <StockUnitDisplay stock={p.stock} baseUnit={p.unit} units={p.units} />
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {p.stockByWarehouse && Object.keys(p.stockByWarehouse).length > 0 ? (
                          Object.entries(p.stockByWarehouse).map(([whId, qty]) => {
                            const wName = displayWarehouses.find(w => w.id === whId)?.name || whId;
                            return (
                              <span key={whId} className="text-xs font-black text-gray-500 bg-white border border-gray-100 rounded px-1 py-0.5 uppercase">
                                {wName}: {qty}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs font-black text-gray-500 bg-white border border-gray-100 rounded px-1 py-0.5 uppercase">
                            {whName}: {p.stock}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sell Price</p>
                      <p className="text-xs font-black text-emerald-600 leading-none tabular-nums">
                        <span className="text-xs mr-0.5">Rp</span>
                        {(p.priceEcer || 0).toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs font-bold text-blue-500/70 italic mt-0.5">
                        Avg: Rp{(p.purchasePrice || 0).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <p className={`text-xs font-black uppercase tracking-tight flex items-center gap-1 ${isExpired ? 'text-red-500' : 'text-gray-400'}`}>
                        {isExpired && <AlertTriangle size={10} className="animate-pulse" />}
                        Exp: {p.expired_date || '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 relative" data-action-menu>
                      <button 
                        onClick={() => setSelectedProductRestock(p)} 
                        className="w-9 h-9 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-xs"
                        title="Quick Stock"
                      >
                        <Calculator size={15} />
                      </button>
                      <Link 
                        href={`/admin/products/edit/${p.id}`} 
                        className="w-9 h-9 flex items-center justify-center bg-gray-100 text-gray-700 rounded-xl hover:bg-black hover:text-white transition-all shadow-xs"
                        title="Edit Item"
                      >
                        <Edit size={15} />
                      </Link>
                      <button 
                        onClick={() => setSelectedProductVariants(p)}
                        className="w-9 h-9 flex items-center justify-center bg-violet-50 text-violet-600 rounded-xl hover:bg-violet-600 hover:text-white transition-all shadow-xs"
                        title="Kelola Varian"
                      >
                        <Layers size={15} />
                      </button>

                      {/* More Dropdown Mobile */}
                      <button 
                        type="button"
                        onClick={() => setActiveActionMenuId(activeActionMenuId === p.id ? null : p.id)}
                        className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-all shadow-xs"
                        title="Aksi Lainnya"
                      >
                        <MoreVertical size={15} />
                      </button>

                      {activeActionMenuId === p.id && (
                        <div className="absolute right-0 bottom-full mb-1.5 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                          <Link
                            href={`/admin/products/print-label/${p.id}`}
                            onClick={() => setActiveActionMenuId(null)}
                            className="flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-gray-700 hover:bg-amber-50 hover:text-amber-700 rounded-xl transition-colors"
                          >
                            <Printer size={13} className="text-amber-500" />
                            <span>Cetak Label Rak</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => { setActiveActionMenuId(null); handleDuplicate(p); }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-gray-700 hover:bg-sky-50 hover:text-sky-700 rounded-xl transition-colors"
                          >
                            <Copy size={13} className="text-sky-500" />
                            <span>Duplikat Produk</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setActiveActionMenuId(null); handleArchive(p, p.isActive !== false); }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                          >
                            {p.isActive === false ? <RotateCcw size={13} className="text-emerald-600" /> : <Archive size={13} className="text-gray-500" />}
                            <span>{p.isActive === false ? 'Pulihkan Produk' : 'Arsipkan Produk'}</span>
                          </button>
                          <div className="my-1 border-t border-gray-100" />
                          <button
                            type="button"
                            onClick={() => { setActiveActionMenuId(null); handleDelete(p); }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <Trash2 size={13} />
                            <span>Hapus Permanen</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Accordion Varian Mobile */}
                  {childrenByParent.get(p.id) && childrenByParent.get(p.id)!.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => toggleParentExpand(p.id)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-violet-50/80 hover:bg-violet-100 text-violet-700 text-xs font-black transition-all border border-violet-100"
                      >
                        <span className="flex items-center gap-1.5">
                          <Layers size={14} className="text-violet-600" />
                          {childrenByParent.get(p.id)!.length} Varian Terhubung
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-bold">
                          {expandedParents.has(p.id) ? 'Sembunyikan' : 'Buka Varian'}
                          {expandedParents.has(p.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                      </button>

                      {expandedParents.has(p.id) && (
                        <div className="mt-2 space-y-2 pl-2 border-l-2 border-violet-300">
                          {childrenByParent.get(p.id)!.map((child) => (
                            <div key={child.id} className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[10px] font-black text-violet-600 uppercase">#{child.sku || 'N/A'}</span>
                                  {child.barcode && <span className="text-[10px] text-gray-400 font-mono">[{child.barcode}]</span>}
                                </div>
                                <p className="text-xs font-bold text-gray-900 truncate">{child.name}</p>
                                <div className="flex items-center gap-3 mt-1 text-[11px]">
                                  <span className="font-semibold text-gray-500">Stok: <strong className="text-gray-900">{child.stock} {child.unit}</strong></span>
                                  <span className="font-bold text-emerald-600">Rp{(child.priceEcer || 0).toLocaleString('id-ID')}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Link
                                  href={`/admin/products/edit/${child.id}`}
                                  className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-black hover:text-white transition-all shadow-xs"
                                  title="Edit Varian"
                                >
                                  <Edit size={13} />
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => handleDetachVariant(child)}
                                  disabled={detachingId === child.id}
                                  className="w-8 h-8 flex items-center justify-center bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-600 hover:text-white transition-all shadow-xs disabled:opacity-50"
                                  title="Lepas Varian jadi Produk Mandiri"
                                >
                                  {detachingId === child.id ? <RefreshCw size={13} className="animate-spin" /> : <Unlink size={13} />}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full text-left min-w-[640px] md:min-w-0">
            <thead className="bg-gray-50/80 text-[11px] font-black text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 w-10 sticky left-0 bg-gray-50 z-10 text-center">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600 transition-colors">
                    {selectedIds.length === currentItems.length && currentItems.length > 0 ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} />}
                  </button>
                </th>
                <th className="px-3 py-3 min-w-[240px]">Produk & Identitas</th>
                <th className="px-3 py-3 min-w-[160px]">Stok & Gudang</th>
                <th className="hidden md:table-cell px-3 py-3 min-w-[150px]">Harga Jual & Modal</th>
                <th className="hidden md:table-cell px-3 py-3 min-w-[130px]">Tgl & Exp</th>
                <th className="px-3 py-3 w-36 text-right pr-4 sticky right-0 bg-gray-50 z-10">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentItems.map(p => {
                const whName = displayWarehouses.find(w => w.id === p.warehouseId)?.name || 'N/A';
                const isExpired = p.expired_date && new Date(p.expired_date) < new Date();
                const isSelected = selectedIds.includes(p.id);
                const pChildren = childrenByParent.get(p.id) || [];
                const hasVariants = pChildren.length > 0;
                const isExpanded = expandedParents.has(p.id);

                return (
                  <React.Fragment key={p.id}>
                    <tr className={`hover:bg-blue-50/30 transition-all ${isSelected ? 'bg-blue-50/50' : ''}`}>
                      <td className="px-3 py-2.5 sticky left-0 bg-white z-10 text-center">
                        <button onClick={() => toggleSelectOne(p.id)} className="transition-colors mt-1">
                          {isSelected ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} className="text-gray-300 hover:text-gray-400" />}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs relative">
                            {p.imageUrl && typeof p.imageUrl === 'string' && p.imageUrl.trim().startsWith('http') ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="object-cover w-full h-full"
                                width={40}
                                height={40}
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <Camera size={14} className="text-gray-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              <p className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">#{p.sku || 'N/A'}</p>
                              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                p.isActive === false ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {p.isActive === false ? 'Arsip' : 'Aktif'}
                              </span>
                              {p.parentId ? (
                                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-violet-100 text-violet-700" title={`Parent: ${p.parentId}`}>
                                  ↳ Varian
                                </span>
                              ) : null}
                              {hasVariants && (
                                <button
                                  type="button"
                                  onClick={() => toggleParentExpand(p.id)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors shadow-2xs"
                                  title="Buka daftar varian produk ini"
                                >
                                  {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                  <span>{pChildren.length} Varian</span>
                                </button>
                              )}
                            </div>
                            <h3 className="font-bold text-gray-900 text-sm leading-snug truncate">{p.name}</h3>
                            <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">{p.category || 'General'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <p className={`font-black text-sm leading-none tabular-nums ${Number(p.stock) <= Number(p.minStock) ? 'text-red-600' : 'text-gray-900'}`}>
                              {p.stock} <span className="text-xs font-bold uppercase text-gray-500">{p.unit}</span>
                            </p>
                            {hasVariants && (
                              <span className="text-[10px] text-gray-400 font-medium">
                                (Total: {pChildren.reduce((s, c) => s + Number(c.stock || 0), 0) + Number(p.stock || 0)})
                              </span>
                            )}
                          </div>
                          <StockUnitDisplay stock={p.stock} baseUnit={p.unit} units={p.units} />
                          {Number(p.stock) <= Number(p.minStock) && (
                            <p className="text-[11px] font-bold text-red-500 uppercase">
                              Min: {p.minStock}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {p.stockByWarehouse && Object.keys(p.stockByWarehouse).length > 0 ? (
                              Object.entries(p.stockByWarehouse).map(([whId, qty]) => {
                                const wName = displayWarehouses.find(w => w.id === whId)?.name || whId;
                                return (
                                  <span key={whId} className="text-[11px] font-bold bg-gray-50 border border-gray-100 text-gray-500 rounded px-1.5 py-0.5 uppercase">
                                    {wName}: {qty}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[11px] font-bold bg-gray-50 border border-gray-100 text-gray-500 rounded px-1.5 py-0.5 uppercase">
                                {whName}: {p.stock}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <p className="text-sm font-black text-emerald-600 leading-none tabular-nums">
                            Rp{(p.priceEcer || 0).toLocaleString('id-ID')}
                          </p>
                          <p className="text-[11px] font-medium text-gray-400">
                            Modal: Rp{(p.purchasePrice || 0).toLocaleString('id-ID')}
                          </p>
                          {Number(p.priceGrosir || 0) > 0 && (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 rounded px-1 py-0.2 w-max">
                              Grosir: Rp{Number(p.priceGrosir || 0).toLocaleString('id-ID')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[11px] font-medium text-gray-500">
                            Masuk: {p.tgl_masuk || p.createdAt ? (p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('id-ID') : new Date(p.createdAt).toLocaleDateString('id-ID')) : '-'}
                          </p>
                          <p className={`text-[11px] font-bold uppercase flex items-center gap-1 ${isExpired ? 'text-red-500' : 'text-gray-400'}`}>
                            {isExpired && <AlertTriangle size={10} className="animate-pulse" />} 
                            Exp: {p.expired_date || p.expiredDate || p.Expired_Default || '-'}
                          </p>
                        </div>
                      </td>

                      <td className="px-3 py-2.5 text-right sticky right-0 bg-white z-10 pr-4 group-hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-end gap-1 relative" data-action-menu>
                          <Link 
                            href={`/admin/products/edit/${p.id}`} 
                            className="w-7 h-7 flex items-center justify-center bg-gray-100 text-gray-700 rounded-lg hover:bg-black hover:text-white transition-all shadow-2xs"
                            title="Edit"
                          >
                            <Edit size={13} />
                          </Link>
                          <button 
                            onClick={() => setSelectedProductRestock(p)} 
                            className="w-7 h-7 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-2xs"
                            title="Restock"
                          >
                            <Calculator size={13} />
                          </button>
                          <button 
                            onClick={() => setSelectedProductVariants(p)} 
                            className="w-7 h-7 flex items-center justify-center bg-violet-50 text-violet-600 rounded-lg hover:bg-violet-600 hover:text-white transition-all shadow-2xs"
                            title="Kelola & Tambah Varian"
                          >
                            <Layers size={13} />
                          </button>

                          {/* Desktop More Dropdown */}
                          <button 
                            type="button"
                            onClick={() => setActiveActionMenuId(activeActionMenuId === p.id ? null : p.id)} 
                            className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-all shadow-2xs"
                            title="Aksi Lainnya"
                          >
                            <MoreVertical size={13} />
                          </button>

                          {activeActionMenuId === p.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5 z-50 text-left animate-in fade-in zoom-in-95 duration-150">
                              <Link 
                                href={`/admin/products/print-label/${p.id}`} 
                                onClick={() => setActiveActionMenuId(null)}
                                className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-amber-50 hover:text-amber-700 rounded-xl transition-colors"
                              >
                                <Printer size={13} className="text-amber-500" />
                                <span>Cetak Label Rak</span>
                              </Link>
                              <button 
                                type="button"
                                onClick={() => { setActiveActionMenuId(null); handleDuplicate(p); }} 
                                disabled={duplicatingId === p.id}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-sky-50 hover:text-sky-700 rounded-xl transition-colors disabled:opacity-50"
                              >
                                {duplicatingId === p.id ? <RefreshCw size={13} className="animate-spin text-sky-500" /> : <Copy size={13} className="text-sky-500" />}
                                <span>Duplikat Produk</span>
                              </button>
                              <button 
                                type="button"
                                onClick={() => { setActiveActionMenuId(null); handleArchive(p, p.isActive !== false); }} 
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                              >
                                {p.isActive === false ? <RotateCcw size={13} className="text-emerald-600" /> : <Archive size={13} className="text-gray-500" />}
                                <span>{p.isActive === false ? 'Pulihkan Produk' : 'Arsipkan Produk'}</span>
                              </button>
                              <div className="my-1 border-t border-gray-100" />
                              <button 
                                type="button"
                                onClick={() => { setActiveActionMenuId(null); handleDelete(p); }} 
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                              >
                                <Trash2 size={13} />
                                <span>Hapus Permanen</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Accordion Sub-table untuk Varian Produk (Desktop) */}
                    {hasVariants && isExpanded && (
                      <tr key={`${p.id}-variants-row`} className="bg-gradient-to-r from-violet-50/40 via-purple-50/20 to-transparent">
                        <td colSpan={6} className="px-3 py-3 pl-12 border-y border-violet-100/60">
                          <div className="rounded-2xl bg-white border border-violet-100 shadow-xs overflow-hidden">
                            <div className="px-4 py-2 bg-violet-50/60 border-b border-violet-100 flex items-center justify-between">
                              <span className="text-xs font-black text-violet-900 uppercase tracking-wider flex items-center gap-1.5">
                                <Layers size={14} className="text-violet-600" />
                                Daftar Varian Terhubung ({pChildren.length})
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedProductVariants(p)}
                                className="text-[11px] font-black text-violet-700 hover:text-violet-900 flex items-center gap-1 transition-colors"
                              >
                                + Tambah Varian Baru
                              </button>
                            </div>
                            <div className="divide-y divide-gray-100">
                              {pChildren.map((child) => (
                                <div key={child.id} className="px-4 py-2 flex items-center justify-between gap-4 hover:bg-violet-50/30 transition-colors">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <span className="text-violet-400 font-bold select-none text-xs">↳</span>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-black text-xs text-gray-900">{child.name}</span>
                                        <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-100 px-1 rounded">SKU: {child.sku || '-'}</span>
                                        {child.barcode && (
                                          <span className="text-[10px] font-mono text-gray-400">Barcode: {child.barcode}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-6 shrink-0">
                                    <div className="text-right">
                                      <p className="text-[10px] font-bold text-gray-400 uppercase">Stok</p>
                                      <p className="text-xs font-black text-gray-900">{child.stock} <span className="text-[10px] uppercase font-normal">{child.unit}</span></p>
                                    </div>
                                    <div className="text-right min-w-[90px]">
                                      <p className="text-[10px] font-bold text-gray-400 uppercase">Harga Ecer</p>
                                      <p className="text-xs font-black text-emerald-600">Rp{(child.priceEcer || 0).toLocaleString('id-ID')}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <Link
                                        href={`/admin/products/edit/${child.id}`}
                                        className="p-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-black hover:text-white transition-all"
                                        title="Edit Varian"
                                      >
                                        <Edit size={13} />
                                      </Link>
                                      <button
                                        type="button"
                                        onClick={() => handleDetachVariant(child)}
                                        disabled={detachingId === child.id}
                                        className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                                        title="Pisahkan varian ini menjadi produk mandiri"
                                      >
                                        {detachingId === child.id ? <RefreshCw size={11} className="animate-spin" /> : <Unlink size={11} />}
                                        <span>Lepas</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="px-3.5 py-3 bg-gray-50/70 flex flex-col sm:flex-row justify-between items-center border-t border-gray-100 gap-2.5">
          <div className="text-xs font-semibold text-gray-500">
            Halaman <span className="font-bold text-gray-900">{currentPage}</span> dari <span className="font-bold text-gray-900">{totalPages || 1}</span> — Menampilkan <span className="font-bold text-gray-900">{filteredAndSorted.length.toLocaleString('id-ID')}</span> produk
          </div>

          <div className="flex gap-2 items-center flex-wrap justify-end">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">Tampilkan:</span>
              {[20, 50, 100, 500].map(n => (
                <button
                  key={n}
                  onClick={() => { setItemsPerPage(n); setCurrentPage(1); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    itemsPerPage === n ? 'bg-gray-900 text-white shadow-2xs' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="w-[1px] h-3.5 bg-gray-300 mx-0.5"></div>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="p-1.5 px-3 bg-white border border-gray-200 rounded-xl disabled:opacity-30 shadow-2xs hover:bg-gray-50 transition-all font-bold text-xs flex items-center gap-1"
            >
              <ChevronLeft size={14} />
              <span className="hidden sm:inline">Sebelumnya</span>
            </button>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(p => p + 1)}
              className="p-1.5 px-3 bg-white border border-gray-200 rounded-xl disabled:opacity-30 shadow-2xs hover:bg-gray-50 transition-all font-bold text-xs flex items-center gap-1"
            >
              <span className="hidden sm:inline">Berikutnya</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {selectedProductRestock && <RestockModal product={selectedProductRestock} isOpen={!!selectedProductRestock} onClose={() => setSelectedProductRestock(null)} />}
      {selectedProductVariants && (
        <QuickVariantModal 
          product={selectedProductVariants} 
          isOpen={!!selectedProductVariants} 
          onClose={() => setSelectedProductVariants(null)} 
        />
      )}

      {/* MODAL LIVE PROGRESS BULK ACTION */}
      {bulkProgress.isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-md w-full border border-gray-100 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            {bulkProgress.status === 'processing' && (
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                <RefreshCw size={28} className="animate-spin" />
              </div>
            )}
            {bulkProgress.status === 'done' && (
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                <CheckSquare size={28} />
              </div>
            )}
            {bulkProgress.status === 'error' && (
              <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4">
                <AlertTriangle size={28} />
              </div>
            )}

            <h3 className="text-base font-black text-gray-900 uppercase tracking-tight mb-1">
              {bulkProgress.title}
            </h3>

            <p className="text-xs font-semibold text-gray-500 mb-6">
              {bulkProgress.status === 'processing' && 'Mohon jangan menutup halaman ini...'}
              {bulkProgress.status === 'done' && 'Semua data telah berhasil diproses!'}
              {bulkProgress.status === 'error' && (bulkProgress.errorMsg || 'Gagal memproses data')}
            </p>

            {/* PROGRESS BAR */}
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden p-0.5 mb-3 border border-gray-200">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  bulkProgress.status === 'error' 
                    ? 'bg-red-500' 
                    : bulkProgress.status === 'done' 
                    ? 'bg-emerald-500' 
                    : 'bg-blue-600'
                }`}
                style={{ width: `${bulkProgress.percent}%` }}
              ></div>
            </div>

            <div className="flex justify-between w-full text-xs font-black uppercase text-gray-400 mb-4">
              <span>{bulkProgress.current} dari {bulkProgress.total} Produk</span>
              <span className="text-gray-900 font-black">{bulkProgress.percent}%</span>
            </div>

            {bulkProgress.status === 'error' && (
              <button
                onClick={() => setBulkProgress(prev => ({ ...prev, isOpen: false }))}
                className="mt-2 w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gray-800 transition-all"
              >
                Tutup
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal Scanner Barcode Kamera */}
      <CameraBarcodeScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        title="Scan Barcode Produk"
        description="Arahkan kamera ke barcode produk untuk mencari di katalog"
        onScan={(code) => handleBarcodeScanned(code)}
      />

      {/* Modal Barcode Tidak Ditemukan (Buat Produk Baru vs Tautkan ke Produk Ada) */}
      <UnfoundBarcodeModal
        isOpen={showUnfoundModal}
        barcode={unfoundBarcode}
        products={rows}
        onClose={() => setShowUnfoundModal(false)}
        onBarcodeAttached={(prodName, newBarcode) => {
          setSearchTerm(newBarcode);
          setCurrentPage(1);
        }}
      />

      {/* Modal TikTok Shop Import (2 Versi) */}
      <TikTokImportModal
        isOpen={showTikTokModal}
        onClose={() => setShowTikTokModal(false)}
      />

      {/* Modal Shopee Import (2 Versi) */}
      <ShopeeImportModal
        isOpen={showShopeeModal}
        onClose={() => setShowShopeeModal(false)}
      />

      {/* Modal Gabungkan Produk Menjadi Varian */}
      <MergeVariantsModal
        isOpen={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        selectedProducts={selectedProductsForMerge}
        onSuccess={() => {
          setSelectedIds([]);
        }}
      />

    </div>
  </ErrorBoundary>
);
}
