'use client';

// ✅ SheetJS untuk Export Excel
declare const XLSX: any;

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, getDoc, addDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp, where, getDocs, updateDoc, writeBatch
} from 'firebase/firestore';
import { importFromExcel } from '@/lib/excelHelper'; 
import Link from 'next/link';
import { 
  Plus, Edit, Trash2, Download, Upload, Barcode, 
  TrendingUp, Camera, Search, X, LayoutDashboard, 
  AlertCircle, Tag, ChevronLeft, ChevronRight, Filter, 
  ShoppingBag, Truck, Package, Layers, RefreshCw, CheckSquare, Eye, EyeOff,
  ArrowUpDown
} from 'lucide-react';

type Product = {
  id: string; ID: string; Barcode: string; Parent_ID: string; Nama: string;
  Kategori: string; Satuan: string; Stok: number; Min_Stok: number;
  Modal: number; Ecer: number; Harga_Coret: number; Status: number;
  updatedAt: any; [key: string]: any;
};

export default function AdminProducts() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua Kategori');
  const [showAddModal, setShowAddModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  
  // ✅ STATE BARU UNTUK FILTER & SORTING
  const [selectedIds, setSelectedIds] = useState<string[]>([]); 
  const [showInactive, setShowInactive] = useState(false); 
  const [sortBy, setSortBy] = useState<'Nama' | 'Ecer' | 'Stok' | 'updatedAt'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // ✅ SETTING 20 ITEM PER HALAMAN
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [formData, setFormData] = useState<Partial<Product>>({
    ID: '', Barcode: '', Nama: '', Kategori: 'Umum',
    Satuan: 'Pcs', Stok: 0, Min_Stok: 5, Modal: 0, Ecer: 0, Status: 1
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/profil/login'); return; }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        router.push('/profil'); return;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (loading) return;
    const q = query(collection(db, 'products'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });
    return () => unsub();
  }, [loading]);

  // ✅ FUNGSI SINKRONISASI DATABASE (INDONESIA - INGGRIS)
  const handleSyncData = async () => {
    if(!confirm("Sinkronkan semua data agar kompatibel dengan sistem baru (Mapping ID-EN)?")) return;
    setIsMigrating(true);
    try {
        const batch = writeBatch(db);
        products.forEach((p) => {
            const docRef = doc(db, 'products', p.id);
            batch.update(docRef, {
                Nama: p.Nama || p.name || "", name: p.Nama || p.name || "",
                Ecer: p.Ecer || p.price || 0, price: p.Ecer || p.price || 0,
                Stok: p.Stok ?? p.stock ?? 0, stock: p.Stok ?? p.stock ?? 0,
                Modal: p.Modal || p.purchasePrice || 0, purchasePrice: p.Modal || p.purchasePrice || 0,
                Kategori: p.Kategori || p.category || "Umum", category: p.Kategori || p.category || "Umum",
                Status: p.Status ?? 1,
                updatedAt: serverTimestamp()
            });
        });
        await batch.commit();
        alert("Sinkronisasi Berhasil!");
    } catch (err) { alert("Gagal Sinkron"); }
    setIsMigrating(false);
  };

  // ✅ AKSI MASSAL: ARSIP / AKTIFKAN
  const handleBulkStatus = async (newStatus: number) => {
    if (!confirm(`${newStatus === 0 ? 'Arsipkan' : 'Aktifkan'} ${selectedIds.length} produk?`)) return;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, 'products', id), { Status: newStatus, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      setSelectedIds([]);
    } catch (err) { alert("Gagal memperbarui status"); }
  };

  // ✅ LOGIKA FILTER & SORTING (Diterapkan Bersamaan)
  const filteredAndSorted = useMemo(() => {
    let result = products.filter(p => {
      const n = (p.Nama || p.name || "").toLowerCase();
      const b = (p.Barcode || p.barcode || "").toLowerCase();
      const matchSearch = n.includes(searchTerm.toLowerCase()) || b.includes(searchTerm.toLowerCase());
      const matchCategory = selectedCategory === 'Semua Kategori' || (p.Kategori || p.category) === selectedCategory;
      const matchStatus = showInactive ? p.Status === 0 : p.Status !== 0;
      return matchSearch && matchCategory && matchStatus;
    });

    result.sort((a, b) => {
      let vA = a[sortBy] ?? 0;
      let vB = b[sortBy] ?? 0;
      if (typeof vA === 'string') {
        return sortOrder === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      return sortOrder === 'asc' ? (vA as number) - (vB as number) : (vB as number) - (vA as number);
    });

    return result;
  }, [products, searchTerm, selectedCategory, showInactive, sortBy, sortOrder]);

  const currentItems = filteredAndSorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredAndSorted.length / itemsPerPage);

  const totalAssetValue = products.reduce((acc, p) => acc + ((p.Stok || 0) * (p.Modal || 0)), 0);
  const potentialProfit = products.reduce((acc, p) => acc + ((p.Stok || 0) * ((p.Ecer || 0) - (p.Modal || 0))), 0);

  const toggleSort = (field: 'Nama' | 'Ecer' | 'Stok') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = (e: any) => setSelectedIds(e.target.checked ? currentItems.map(p => p.id) : []);
  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleBulkDelete = async () => {
    if (!confirm(`Hapus PERMANEN ${selectedIds.length} produk?`)) return;
    const batch = writeBatch(db);
    selectedIds.forEach(id => batch.delete(doc(db, 'products', id)));
    await batch.commit();
    setSelectedIds([]);
  };

  const handleExport = () => {
    const data = products.map(p => ({ ID: p.ID, Nama: p.Nama, Stok: p.Stok, Modal: p.Modal, Ecer: p.Ecer, Status: p.Status === 0 ? "Non-Aktif" : "Aktif" }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produk");
    XLSX.writeFile(wb, `DATA_PRODUK.xlsx`);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ID) return setErrorMsg("ID Wajib diisi!");
    if ((formData.Ecer || 0) < (formData.Modal || 0)) {
       if(!confirm("Peringatan: Harga Jual dibawah Modal. Lanjutkan?")) return;
    }
    try {
      await addDoc(collection(db, 'products'), { ...formData, updatedAt: serverTimestamp(), createdAt: serverTimestamp() });
      setShowAddModal(false);
      setFormData({ ID: '', Barcode: '', Nama: '', Kategori: 'Umum', Satuan: 'Pcs', Stok: 0, Modal: 0, Ecer: 0, Status: 1 });
    } catch (err) { alert('Gagal Simpan'); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Hapus ${name}?`)) await deleteDoc(doc(db, 'products', id));
  };

  if (loading) return <div className="p-10 text-center font-black animate-pulse text-gray-400">MEMPROSES DATABASE...</div>;

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen text-black font-sans">
      
      {/* Header Nav */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/admin" className="bg-black text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2">
            <LayoutDashboard size={14} /> Panel
          </Link>
          
          {/* ✅ TOMBOL SINKRON DATA */}
          <button 
            onClick={handleSyncData} 
            disabled={isMigrating}
            className="bg-orange-100 text-orange-600 border border-orange-200 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-orange-200 transition-all"
          >
            <RefreshCw size={14} className={isMigrating ? 'animate-spin' : ''} /> 
            {isMigrating ? 'Syncing...' : 'Sinkron'}
          </button>

          <button 
            onClick={() => { setShowInactive(!showInactive); setSelectedIds([]); }}
            className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase border flex items-center gap-2 transition-all ${showInactive ? 'bg-red-600 text-white border-red-700' : 'bg-white text-gray-400 border-gray-200'}`}
          >
            {showInactive ? <Eye size={14}/> : <EyeOff size={14}/>} {showInactive ? 'Lihat Aktif' : 'Arsip'}
          </button>
        </div>
        
        <div className="flex gap-2">
          <button onClick={handleExport} className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 text-green-600 shadow-sm"><Download size={14} /> Export</button>
          <button onClick={() => setShowAddModal(true)} className="bg-black text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg hover:bg-emerald-600 transition-all"><Plus size={14} /> Item Baru</button>
        </div>
      </div>

      {/* ✅ FLOATING ACTION MENU (BULK ACTIONS) */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] bg-black text-white px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 border border-white/10">
          <span className="text-[10px] font-black border-r border-white/20 pr-4">{selectedIds.length} TERPILIH</span>
          <button onClick={() => handleBulkStatus(showInactive ? 1 : 0)} className="text-[10px] font-black uppercase flex items-center gap-2 hover:text-orange-400">
            {showInactive ? <Eye size={16}/> : <EyeOff size={16}/>} {showInactive ? 'Aktifkan' : 'Arsip'}
          </button>
          <button onClick={handleBulkDelete} className="text-[10px] font-black uppercase flex items-center gap-2 hover:text-red-400">
            <Trash2 size={16}/> Hapus
          </button>
          <button onClick={() => setSelectedIds([])} className="ml-2 p-1 bg-white/10 rounded-full hover:bg-white/20"><X size={14}/></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-emerald-600 text-white p-6 rounded-[2rem] shadow-xl shadow-emerald-100">
          <p className="opacity-70 text-[10px] font-black uppercase">Total Aset Modal</p>
          <h2 className="text-2xl font-black mt-1">Rp {totalAssetValue.toLocaleString()}</h2>
        </div>
        <div className="bg-blue-600 text-white p-6 rounded-[2rem] shadow-xl shadow-blue-100">
          <p className="opacity-70 text-[10px] font-black uppercase">Potensi Profit</p>
          <h2 className="text-2xl font-black mt-1">Rp {potentialProfit.toLocaleString()}</h2>
        </div>
        <div className="bg-black text-white p-6 rounded-[2rem] shadow-xl">
          <p className="opacity-70 text-[10px] font-black uppercase">Total Produk</p>
          <h2 className="text-2xl font-black mt-1">{products.length} <span className="text-xs opacity-50 font-bold">ITEM</span></h2>
        </div>
      </div>

      {/* Search & Sorting Bar */}
      <div className="flex flex-wrap gap-4 mb-6 items-center bg-white p-4 rounded-[2rem] shadow-sm">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
          <input type="text" placeholder="Cari nama atau barcode..." className="w-full pl-12 pr-4 py-4 rounded-3xl bg-gray-50 font-bold outline-none border-none focus:ring-2 focus:ring-black" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        
        <div className="flex gap-2 items-center">
          <button onClick={() => toggleSort('Nama')} className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase border flex items-center gap-2 ${sortBy === 'Nama' ? 'bg-black text-white' : 'bg-gray-50 text-gray-400'}`}>
            A-Z {sortBy === 'Nama' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button onClick={() => toggleSort('Ecer')} className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase border flex items-center gap-2 ${sortBy === 'Ecer' ? 'bg-black text-white' : 'bg-gray-50 text-gray-400'}`}>
            Harga {sortBy === 'Ecer' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button onClick={() => toggleSort('Stok')} className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase border flex items-center gap-2 ${sortBy === 'Stok' ? 'bg-black text-white' : 'bg-gray-50 text-gray-400'}`}>
            Stok {sortBy === 'Stok' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase border-b">
              <tr>
                <th className="p-6 w-10">
                  <input type="checkbox" className="w-5 h-5 rounded accent-black" onChange={handleSelectAll} checked={selectedIds.length === currentItems.length && currentItems.length > 0} />
                </th>
                <th className="p-6">Produk</th>
                <th className="p-6">Harga</th>
                <th className="p-6 text-emerald-600">Profit</th>
                <th className="p-6">Stok</th>
                <th className="p-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentItems.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50/50 transition-colors ${p.Status === 0 ? 'opacity-40 grayscale' : ''}`}>
                  <td className="p-6">
                    <input type="checkbox" className="w-5 h-5 rounded accent-black" checked={selectedIds.includes(p.id)} onChange={() => toggleSelect(p.id)} />
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden border">
                        {p.Link_Foto ? <img src={p.Link_Foto} className="w-full h-full object-cover" /> : <Camera size={14} className="m-auto mt-4 text-gray-300"/>}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${p.Status === 0 ? 'bg-red-500' : 'bg-green-500'}`} />
                          <p className="text-[9px] font-black text-blue-600 uppercase">ID: {p.ID}</p>
                        </div>
                        <p className="font-black text-gray-900 uppercase text-xs">{p.Nama || p.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6 font-black text-xs">
                    Rp {(p.Ecer || 0).toLocaleString()}
                    {p.Ecer < p.Modal && <p className="text-[8px] text-red-600 mt-1">!! RUGI !!</p>}
                  </td>
                  <td className="p-6 font-black text-[10px] text-emerald-600">+Rp {((p.Ecer || 0) - (p.Modal || 0)).toLocaleString()}</td>
                  <td className="p-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${p.Stok <= (p.Min_Stok || 5) ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                      {p.Stok} {p.Satuan}
                    </span>
                  </td>
                  <td className="p-6">
                    <div className="flex justify-center gap-2">
                      <Link href={`/admin/products/edit/${p.id}`} className="p-2 border rounded-xl hover:bg-black hover:text-white transition-all"><Edit size={14} /></Link>
                      <button onClick={() => handleDelete(p.id, p.Nama)} className="p-2 border rounded-xl text-red-500 hover:bg-red-600 hover:text-white transition-all"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-6 bg-gray-50/50 flex justify-between items-center border-t">
            <p className="text-[10px] font-black text-gray-400 uppercase">HALAMAN {currentPage} / {totalPages || 1} ({filteredAndSorted.length} ITEM)</p>
            <div className="flex gap-2">
                <button disabled={currentPage === 1} onClick={() => {setCurrentPage(v => v - 1); window.scrollTo(0,0)}} className="p-2 bg-white rounded-lg border shadow-sm disabled:opacity-30"><ChevronLeft size={16}/></button>
                <button disabled={currentPage >= totalPages} onClick={() => {setCurrentPage(v => v + 1); window.scrollTo(0,0)}} className="p-2 bg-white rounded-lg border shadow-sm disabled:opacity-30"><ChevronRight size={16}/></button>
            </div>
        </div>
      </div>

      {/* Modal Add (Sama Seperti Sebelumnya) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black uppercase tracking-tighter">Tambah Produk</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 bg-gray-100 rounded-xl hover:bg-red-500 hover:text-white transition-all"><X size={20}/></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-1">ID Produk *</label>
                  <input required className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border focus:border-black" value={formData.ID} onChange={e => setFormData({...formData, ID: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Barcode</label>
                  <input className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border focus:border-black" value={formData.Barcode} onChange={e => setFormData({...formData, Barcode: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Nama Barang *</label>
                <input required className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border focus:border-black uppercase" value={formData.Nama} onChange={e => setFormData({...formData, Nama: e.target.value.toUpperCase()})} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Stok</label>
                  <input type="number" className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border" value={formData.Stok} onChange={e => setFormData({...formData, Stok: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Modal</label>
                  <input type="number" className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border" value={formData.Modal} onChange={e => setFormData({...formData, Modal: Number(e.target.value)})} />
                </div>
                <div>
                  <label className={`text-[10px] font-black uppercase ml-1 ${(formData.Ecer || 0) < (formData.Modal || 0) ? 'text-red-600' : 'text-blue-600'}`}>Harga Ecer</label>
                  <input type="number" className={`w-full p-4 rounded-2xl font-bold outline-none border ${(formData.Ecer || 0) < (formData.Modal || 0) ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-100'}`} value={formData.Ecer} onChange={e => setFormData({...formData, Ecer: Number(e.target.value)})} />
                </div>
              </div>
              <button type="submit" className="w-full bg-black text-white p-5 rounded-2xl font-black uppercase text-[12px] shadow-xl hover:bg-emerald-600 transition-all">Simpan Produk</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}