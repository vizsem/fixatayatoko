'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import ErrorBoundary from '@/components/ErrorBoundary';


import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, addDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp, writeBatch, updateDoc
} from 'firebase/firestore';

import Link from 'next/link';
import {
  Plus, Edit, Trash2, Download, Upload, Search, X,
  Camera, Warehouse, Calculator, Eye, EyeOff, ChevronLeft, ChevronRight,
  FileSpreadsheet, AlertTriangle, Package, Banknote, RefreshCw,
  CheckSquare,
  Square
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';


// ✅ SheetJS untuk Export/Import Excel
import * as XLSX from 'xlsx';


interface Product {
  id: string;
  ID: string;
  Barcode?: string;
  Nama: string;
  Kategori: string;
  Satuan: string;
  Stok: number;
  Min_Stok: number;
  Modal: number;
  Ecer: number;
  Harga_Grosir: number;
  Min_Grosir: number;
  Lokasi: string;
  Deskripsi: string;
  URL_Produk?: string;
  url_produk?: string;
  image?: string;
  foto?: string;
  Status: number;
  warehouseId: string;
  tgl_masuk: string;
  expired_date: string;
  hargaBeli?: number;
}


interface Warehouse {
  id: string;
  name: string;
}

// --- KOMPONEN MODAL RESTOCK ---
interface RestockModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

function RestockModal({ product, isOpen, onClose }: RestockModalProps) {

  const [stokMasuk, setStokMasuk] = useState<number>(0);
  const [hargaBaru, setHargaBaru] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const stokLama = Number(product.Stok || 0);
  const hargaLama = Number(product.hargaBeli || product.Modal || 0);
  const totalStokBaru = stokLama + (stokMasuk || 0);

  const simulasiHargaAvg = totalStokBaru > 0
    ? Math.round(((stokLama * hargaLama) + ((stokMasuk || 0) * (hargaBaru || 0))) / totalStokBaru)
    : 0;

  const handleUpdate = async () => {
    if (stokMasuk <= 0 || hargaBaru <= 0) return notify.admin.error("Lengkapi data!");
    setLoading(true);
    try {
      const productRef = doc(db, 'products', product.id);
      await updateDoc(productRef, {
        Stok: totalStokBaru,
        hargaBeli: simulasiHargaAvg,
        Modal: simulasiHargaAvg,
        updatedAt: serverTimestamp(),
        tgl_masuk: new Date().toISOString().split('T')[0]
      });

      await addDoc(collection(db, 'inventory_logs'), {
        productId: product.id, productName: product.Nama, type: 'MASUK',
        amount: stokMasuk, hargaBeliAtMoment: hargaBaru, averagePriceAfter: simulasiHargaAvg,
        toWarehouseId: product.warehouseId || '', date: serverTimestamp(), note: 'Restock (Avg Price)'
      });

      notify.admin.success("Restock Berhasil!");
      onClose();
    } catch { notify.admin.error("Gagal update data"); }
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
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, 'products', id), { Status: newStatus, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      setSelectedIds([]);
      notify.admin.success("Berhasil diperbarui!", { id: t });
    } catch { notify.admin.error("Gagal memperbarui", { id: t }); }

  };
  // States
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedProductRestock, setSelectedProductRestock] = useState<Product | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;





  // Effects
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) { router.push('/profil/login'); return; }
      setLoading(false);
    });
    const unsubW = onSnapshot(collection(db, 'warehouses'), (s) => setWarehouses(s.docs.map(d => ({ id: d.id, ...d.data() })) as Warehouse[]));
    const unsubP = onSnapshot(query(collection(db, 'products'), orderBy('updatedAt', 'desc')), (s) => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]));
    return () => { unsubAuth(); unsubW(); unsubP(); };
  }, [router]);

  // Logic Filter & Pagination (Harus di atas handleExport)
  const filteredAndSorted = useMemo(() => {
    return products.filter(p => {
      const matchSearch = (p.Nama || "").toLowerCase().includes(searchTerm.toLowerCase()) || (p.ID || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = showInactive ? p.Status === 0 : p.Status !== 0;
      return matchSearch && matchStatus;
    });
  }, [products, searchTerm, showInactive]);

  const stats = useMemo(() => {
    const totalAset = filteredAndSorted.reduce((acc, curr) => acc + (Number(curr.Stok || 0) * Number(curr.Modal || 0)), 0);
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
        ID: p.ID, Barcode: p.Barcode || "", Nama: p.Nama, Kategori: p.Kategori || "Umum",
        Satuan: p.Satuan || "Pcs", Stok: p.Stok || 0, Min_Stok: p.Min_Stok || 0,
        Modal: p.Modal || 0, Total_Nilai_Aset: Number(p.Stok || 0) * Number(p.Modal || 0),
        Ecer: p.Ecer || 0, Min_Grosir: p.Min_Grosir || 0, Harga_Grosir: p.Harga_Grosir || 0,
        Lokasi: p.Lokasi || "", Deskripsi: p.Deskripsi || "", URL_Produk: p.URL_Produk || "",
        Status: p.Status === 1 ? '1' : '0', warehouseId: p.warehouseId || "",
        Gudang_Nama: warehouses.find(w => w.id === p.warehouseId)?.name || '-',
        tgl_masuk: p.tgl_masuk || "", expired_date: p.expired_date || ""
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
        const data = (XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as Record<string, unknown>[]);

        const batch = writeBatch(db);
        data.forEach((item) => {
          const exist = products.find(p => p.ID === String(item.ID));
          const pData = { ...item, updatedAt: serverTimestamp() };
          if (exist) batch.update(doc(db, 'products', exist.id), pData);
          else batch.set(doc(collection(db, 'products')), { ...pData, createdAt: serverTimestamp() });
        });

        await batch.commit();
        notify.admin.success("Berhasil!", { id: t });
      } catch { notify.admin.error("Gagal!", { id: t }); }
    };
    reader.readAsBinaryString(file);
  };





  if (loading) return <div className="p-10 text-center font-black">Loading ataya...</div>;


  // --- HANDLE DELETE ---
  const handleDelete = async (product: Product) => {
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
      <div className="p-4 md:p-6 bg-gray-50 min-h-screen text-black">
      <Toaster />
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-3xl shadow-lg">
            <Package size={28} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Atayamarket</h1>
            <p className="text-xs font-semibold text-gray-500 mt-1">Manajemen Produk</p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleSync}
            className="bg-white border border-gray-200 text-blue-600 p-3 rounded-xl hover:bg-blue-50 transition-all shadow-sm flex items-center justify-center"
            title="Sinkron & Reset Filter"
          >
            <RefreshCw size={18} />
          </button>
          <button onClick={downloadTemplate} className="bg-white border border-gray-200 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2 hover:bg-gray-50 transition-all"><FileSpreadsheet size={16} /> Template</button>
          <button onClick={() => fileInputRef.current?.click()} className="bg-orange-500 text-white px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md hover:bg-orange-600 transition-all"><Upload size={16} /> Import</button>
          <button onClick={handleExport} className="bg-emerald-600 text-white px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md hover:bg-emerald-700 transition-all"><Download size={16} /> Export</button>
          <button onClick={() => router.push('/admin/products/add')} className="bg-gradient-to-r from-gray-900 to-black text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-xl hover:shadow-2xl transition-all"><Plus size={18} /> Item Baru</button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-lg flex items-center gap-5 hover:shadow-xl transition-all">
          <div className="bg-blue-100 p-4 rounded-2xl text-blue-700"><Package size={28} /></div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Total Produk</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalJenis}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-lg flex items-center gap-5 hover:shadow-xl transition-all">
          <div className="bg-emerald-100 p-4 rounded-2xl text-emerald-700">
            <Banknote size={28} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Total Aset</p>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-semibold text-emerald-800">Rp</span>
              <p className="text-2xl font-bold text-emerald-800">
                {stats.totalAset.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TABLE BOX */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mt-8">
        <div className="p-6 border-b border-gray-100 flex flex-wrap items-center gap-6 bg-white">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Cari produk, ID, atau barcode..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <div className="flex gap-3 items-center">
            {/* Bulk Action Button */}
            {selectedIds.length > 0 && (
              <button
                onClick={() => handleBulkStatus(showInactive ? 1 : 0)}
                className="bg-gradient-to-r from-red-600 to-red-700 text-white px-5 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all animate-in fade-in zoom-in"
              >
                <CheckSquare size={16} /> {showInactive ? 'Aktifkan' : 'Arsipkan'} ({selectedIds.length})
              </button>
            )}

            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`px-5 py-3 rounded-2xl text-sm font-semibold border transition-all flex items-center gap-2 shadow-sm hover:shadow-md ${
                showInactive 
                  ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' 
                  : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
              }`}
            >
              {showInactive ? <EyeOff size={16} /> : <Eye size={16} />}
              {showInactive ? 'Tampilkan Aktif' : 'Tampilkan Arsip'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full text-left min-w-[800px] md:min-w-0">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-600 border-b border-gray-200">
              <tr>
                <th className="p-4 md:p-6 w-12">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600 transition-colors">
                    {selectedIds.length === currentItems.length && currentItems.length > 0 ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                  </button>
                </th>
                <th className="p-4 md:p-6">Produk</th>
                <th className="p-4 md:p-6">Stok & Gudang</th>
                <th className="hidden md:table-cell p-4 md:p-6">Harga (Avg)</th>
                <th className="hidden md:table-cell p-4 md:p-6">Tgl & Exp</th>
                <th className="p-4 md:p-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentItems.map(p => {
                const whName = warehouses.find(w => w.id === p.warehouseId)?.name || 'N/A';
                const isExpired = p.expired_date && new Date(p.expired_date) < new Date();
                const isSelected = selectedIds.includes(p.id);

                return (
                  <tr key={p.id} className={`hover:bg-gray-50 transition-all ${isSelected ? 'bg-blue-50' : ''}`}>
                    <td className="p-4 md:p-6">
                      <button onClick={() => toggleSelectOne(p.id)} className="transition-colors">
                        {isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} className="text-gray-300 hover:text-gray-400" />}
                      </button>
                    </td>
                    <td className="p-4 md:p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                          {(() => {
                            // 1. Ambil sumber gambar
                            const imgSource = p.URL_Produk || p.url_produk || p.image || p.foto;

                            // 2. Cek apakah string link-nya valid
                            const isValid = imgSource && typeof imgSource === 'string' && imgSource.trim().startsWith('http');

                            if (isValid) {
                              return (
                                <Image
                                  key={p.id} // Memaksa render ulang jika ID produk berubah
                                  src={imgSource}
                                  alt={p.Nama}
                                  width={56}
                                  height={56}
                                  className="w-full h-full object-cover"
                                />
                              );
                            }

                            // 3. Jika benar-benar kosong tampilkan icon kamera
                            return <Camera size={20} className="text-gray-400" />;
                          })()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-blue-600 tracking-tight mb-1">ID: {p.ID}</p>
                          <h3 className="font-bold text-gray-900 text-sm leading-tight mb-1 line-clamp-2">{p.Nama}</h3>
                          <p className="text-xs text-gray-500 font-medium">{p.Kategori}</p>
                        </div>

                      </div>
                    </td>
                    <td className="p-4 md:p-6">
                      <div className="flex flex-col gap-1">
                        <p className={`font-bold text-sm ${p.Stok <= p.Min_Stok ? 'text-red-600' : 'text-gray-900'}`}>
                          {p.Stok} {p.Satuan}
                        </p>
                        {p.Stok <= p.Min_Stok && (
                          <p className="text-xs font-medium text-red-500">
                            Min: {p.Min_Stok}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                          <Warehouse size={12} /> {whName}
                        </p>
                      </div>
                    </td>
                    <td className="hidden md:table-cell p-4 md:p-6">
                      <div className="flex flex-col gap-1">
                        <p className="text-xs font-medium text-blue-600">
                          Modal: Rp{(p.hargaBeli || p.Modal || 0).toLocaleString('id-ID')}
                        </p>
                        <p className="text-sm font-bold text-emerald-600">
                          Jual: Rp{(p.Ecer || 0).toLocaleString('id-ID')}
                        </p>
                        {p.Harga_Grosir > 0 && (
                          <p className="text-xs font-medium text-purple-600">
                            Grosir: Rp{p.Harga_Grosir.toLocaleString('id-ID')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="hidden md:table-cell p-4 md:p-6">
                      <div className="flex flex-col gap-1">
                        <p className="text-xs font-medium text-gray-500">
                          Masuk: {p.tgl_masuk || '-'}
                        </p>
                        <p className={`text-xs font-medium flex items-center gap-1 ${isExpired ? 'text-red-600 animate-pulse' : 'text-orange-500'}`}>
                          {isExpired && <AlertTriangle size={12} />} 
                          Exp: {p.expired_date || '-'}
                        </p>
                      </div>
                    </td>

                    <td className="p-4 md:p-6 text-center">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => setSelectedProductRestock(p)} 
                          className="p-2.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm hover:shadow-md"
                          title="Restock"
                        >
                          <Calculator size={16} />
                        </button>
                        <Link 
                          href={`/admin/products/edit/${p.id}`} 
                          className="p-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-800 hover:text-white transition-all shadow-sm hover:shadow-md"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </Link>
                        <button 
                          onClick={() => handleDelete(p)} 
                          className="p-2.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm hover:shadow-md"
                          title="Hapus"
                        >
                          <Trash2 size={16} />
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
        <div className="p-6 bg-gray-50/50 flex justify-between items-center border-t border-gray-100">
          <div className="text-[10px] font-black text-gray-400">Hal {currentPage} / {totalPages || 1} — {filteredAndSorted.length} Produk</div>

          <div className="flex gap-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 bg-white border rounded-xl disabled:opacity-30 shadow-sm"><ChevronLeft size={20} /></button>
            <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} className="p-2 bg-white border rounded-xl disabled:opacity-30 shadow-sm"><ChevronRight size={20} /></button>
          </div>
        </div>
      </div>

      {selectedProductRestock && <RestockModal product={selectedProductRestock} isOpen={!!selectedProductRestock} onClose={() => setSelectedProductRestock(null)} />}

    </div>
  </ErrorBoundary>
);
}
