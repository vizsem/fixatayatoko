'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { auth, db } from '@/lib/firebase';
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
import toast, { Toaster } from 'react-hot-toast';


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
    if (stokMasuk <= 0 || hargaBaru <= 0) return toast.error("Lengkapi data!");
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

      toast.success("Restock Berhasil!");
      onClose();
    } catch { toast.error("Gagal update data"); }
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
    const t = toast.loading(`Mengubah ${selectedIds.length} produk...`);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, 'products', id), { Status: newStatus, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      setSelectedIds([]);
      toast.success("Berhasil diperbarui!", { id: t });
    } catch { toast.error("Gagal memperbarui", { id: t }); }

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
    if (filteredAndSorted.length === 0) return toast.error("Tidak ada data untuk diexport!");
    const t = toast.loading("Mengunduh Excel...");
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
      toast.success("Berhasil!", { id: t });
    } catch { toast.error("Gagal export!", { id: t }); }

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
      const t = toast.loading("Mengimport...");
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
        toast.success("Berhasil!", { id: t });
      } catch { toast.error("Gagal!", { id: t }); }
    };
    reader.readAsBinaryString(file);
  };





  if (loading) return <div className="p-10 text-center font-black">Loading ataya...</div>;


  // --- HANDLE SYNC & RESET ---
  const handleSync = () => {
    const t = toast.loading("Mensinkronkan data...");

    try {
      // Reset semua state ke kondisi awal
      setSearchTerm('');
      setCurrentPage(1);
      if (typeof setSelectedIds === 'function') setSelectedIds([]); // Pastikan state ini ada
      setShowInactive(false);

      // Simulasi proses sinkronisasi singkat
      setTimeout(() => {
        toast.success("Data & Filter berhasil disegarkan!", { id: t });
      }, 700);
    } catch (err) {
      toast.error("Gagal sinkron", { id: t });
      console.error(err);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen text-black">
      <Toaster />
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black italic tracking-tighter">Atayamarket</h1>
          <p className="text-[10px] font-bold text-gray-400">Product management</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleSync}
            className="bg-white border border-gray-200 text-blue-600 p-2.5 rounded-xl hover:bg-blue-50 transition-all shadow-sm flex items-center justify-center"
            title="Sinkron & Reset Filter"
          >
            <RefreshCw size={16} />
          </button>
          <button onClick={downloadTemplate} className="bg-white border px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2"><FileSpreadsheet size={14} /> Template</button>
          <button onClick={() => fileInputRef.current?.click()} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 shadow-md"><Upload size={14} /> Import</button>
          <button onClick={handleExport} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 shadow-md"><Download size={14} /> Export</button>
          <button onClick={() => router.push('/admin/products/add')} className="bg-black text-white px-6 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 shadow-xl"><Plus size={14} /> Item baru</button>


        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-5 rounded-[2rem] border shadow-sm flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-2xl text-blue-600"><Package size={24} /></div>
          <div><p className="text-[10px] font-black text-gray-400">Produk</p><p className="text-xl font-black">{stats.totalJenis}</p></div>

        </div>
        <div className="bg-white p-5 rounded-[2rem] border shadow-sm flex items-center gap-4">
          {/* Ikon diganti ke Banknote untuk kesan mata uang lokal/cash */}
          <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
            <Banknote size={24} />
          </div>

          <div>
            <p className="text-[10px] font-black text-gray-400 tracking-widest">Total aset</p>

            <div className="flex items-baseline gap-1">
              <span className="text-xs font-black text-emerald-700">Rp</span>
              <p className="text-xl font-black text-emerald-700">
                {stats.totalAset.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TABLE BOX */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden mt-6">
        <div className="p-4 border-b flex flex-wrap items-center gap-4 bg-gray-50/50">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Cari ID atau Nama..."
              className="w-full pl-12 pr-4 py-3 rounded-2xl border-none font-bold focus:ring-2 focus:ring-black"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <div className="flex gap-2">
            {/* Bulk Action Button */}
            {selectedIds.length > 0 && (
              <button
                onClick={() => handleBulkStatus(showInactive ? 1 : 0)}
                className="bg-red-600 text-white px-4 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2 animate-in fade-in zoom-in"

              >
                <CheckSquare size={14} /> {showInactive ? 'Aktifkan' : 'Arsipkan'} ({selectedIds.length})
              </button>
            )}

            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`px-4 py-3 rounded-2xl text-[10px] font-black border transition-all flex items-center gap-2 ${showInactive ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-400'}`}

            >
              {showInactive ? <EyeOff size={14} /> : <Eye size={14} />}
              {showInactive ? 'Arsip' : 'Aktif'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black text-gray-400 border-b">

              <tr>
                <th className="p-6 w-10">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-black">
                    {selectedIds.length === currentItems.length && currentItems.length > 0 ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                  </button>
                </th>
                <th className="p-6">Produk</th>
                <th className="p-6">Stok & Gudang</th>
                <th className="p-6">Harga (Avg)</th>
                <th className="p-6">Tgl & Exp</th>
                <th className="p-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentItems.map(p => {
                const whName = warehouses.find(w => w.id === p.warehouseId)?.name || 'N/A';
                const isExpired = p.expired_date && new Date(p.expired_date) < new Date();
                const isSelected = selectedIds.includes(p.id);

                return (
                  <tr key={p.id} className={`hover:bg-gray-50/80 transition-all ${isSelected ? 'bg-blue-50/50' : ''}`}>
                    <td className="p-6">
                      <button onClick={() => toggleSelectOne(p.id)}>
                        {isSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} className="text-gray-200" />}
                      </button>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-xl border flex items-center justify-center overflow-hidden shrink-0">
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
                                  width={48}
                                  height={48}
                                  className="w-full h-full object-cover"
                                />
                              );
                            }

                            // 3. Jika benar-benar kosong tampilkan icon kamera
                            return <Camera size={16} className="text-gray-300" />;
                          })()}

                        </div>
                        <div>
                          <p className="text-[8px] font-black text-blue-600 tracking-tighter">Id: {p.ID}</p>
                          <h3 className="font-black text-gray-900 text-xs leading-none mb-1">{p.Nama}</h3>
                          <p className="text-[8px] text-gray-400 font-bold">{p.Kategori}</p>
                        </div>

                      </div>
                    </td>
                    <td className="p-6">
                      <p className={`font-black text-xs ${p.Stok <= p.Min_Stok ? 'text-red-600' : 'text-gray-900'}`}>{p.Stok} {p.Satuan}</p>
                      <p className="text-[8px] font-black text-gray-400 flex items-center gap-1"><Warehouse size={10} /> {whName}</p>

                    </td>
                    <td className="p-6">
                      <p className="text-[8px] font-black text-blue-600">Modal: Rp{(p.hargaBeli || p.Modal || 0).toLocaleString()}</p>

                      <p className="font-black text-xs text-emerald-600">Jual: Rp{(p.Ecer || 0).toLocaleString()}</p>
                    </td>
                    <td className="p-6">
                      <p className="text-[8px] font-black text-gray-400">In: {p.tgl_masuk || '-'}</p>
                      <p className={`text-[8px] font-black flex items-center gap-1 ${isExpired ? 'text-red-600 animate-pulse' : 'text-orange-500'}`}>
                        {isExpired && <AlertTriangle size={10} />} Exp: {p.expired_date || '-'}
                      </p>
                    </td>

                    <td className="p-6 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => setSelectedProductRestock(p)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><Calculator size={14} /></button>
                        <Link href={`/admin/products/edit/${p.id}`} className="p-2 bg-gray-50 border rounded-lg hover:bg-black hover:text-white transition-all"><Edit size={14} /></Link>
                        <button onClick={async () => { if (confirm('Hapus?')) await deleteDoc(doc(db, 'products', p.id)) }} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all"><Trash2 size={14} /></button>
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
  );
}



