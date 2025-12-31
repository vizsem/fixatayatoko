'use client';

// ✅ SheetJS (Wajib install: npm install xlsx)
declare const XLSX: any;

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, getDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp, where, getDocs
} from 'firebase/firestore';
import Link from 'next/link';
import { 
  Plus, Edit, Trash2, Download, Upload, Barcode, 
  TrendingUp, Camera, Search, X, LayoutDashboard, 
  Globe, CheckSquare, Square, Link as LinkIcon, AlertCircle, 
  Layers, Tag, ChevronLeft, ChevronRight, Filter
} from 'lucide-react';

type Variant = { name: string; additionalPrice: number; };

type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  wholesalePrice: number;
  minWholesaleQty: number;
  minOrder: number;
  purchasePrice: number;
  stock: number;
  category: string;
  unit: string;
  barcode: string;
  image: string;
  variants?: Variant[];
  createdAt: any;
};

export default function AdminProducts() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua Kategori');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    name: '', slug: '', price: 0, wholesalePrice: 0, minWholesaleQty: 1,
    minOrder: 1, purchasePrice: 0, stock: 0, category: '', unit: '',
    barcode: '', image: '', variants: [] as Variant[]
  });

  // Statistik & Profit
  const totalAssetValue = products.reduce((acc, p) => acc + (p.stock * (p.purchasePrice || 0)), 0);
  const potentialProfit = products.reduce((acc, p) => acc + (p.stock * (p.price - (p.purchasePrice || 0))), 0);

  // Ambil list kategori unik untuk Filter
  const categories = ['Semua Kategori', ...Array.from(new Set(products.map(p => p.category || 'Umum')))];

  const handleNameChange = (name: string) => {
    const slug = name.toLowerCase().trim().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    setFormData({ ...formData, name, slug });
    setErrorMsg(''); 
  };

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
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });
    return () => unsub();
  }, [loading]);

  // --- LOGIKA FILTER & PAGINATION ---
  const filteredProducts = products.filter(p => {
    const matchSearch = (p.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || (p.barcode || "").includes(searchTerm);
    const matchCategory = selectedCategory === 'Semua Kategori' || p.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);

  // --- MANAJEMEN VARIAN ---
  const addVariantField = () => {
    setFormData({ ...formData, variants: [...formData.variants, { name: '', additionalPrice: 0 }] });
  };

  const removeVariantField = (index: number) => {
    const newVariants = [...formData.variants];
    newVariants.splice(index, 1);
    setFormData({ ...formData, variants: newVariants });
  };

  const updateVariant = (index: number, field: keyof Variant, value: string | number) => {
    const newVariants = [...formData.variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setFormData({ ...formData, variants: newVariants });
  };

  // --- ACTIONS ---
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const q = query(collection(db, 'products'), where('name', '==', formData.name));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      setErrorMsg(`Nama "${formData.name}" sudah ada!`);
      return;
    }

    try {
      await addDoc(collection(db, 'products'), {
        ...formData,
        stockByWarehouse: { 'gudang-utama': formData.stock },
        image: formData.image || "https://placehold.co/400x400/eeeeee/999999?text=No+Image",
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      resetForm();
    } catch (err) { alert('Gagal menambah produk'); }
  };

  const resetForm = () => {
    setFormData({ name: '', slug: '', price: 0, wholesalePrice: 0, minWholesaleQty: 1, minOrder: 1, purchasePrice: 0, stock: 0, category: '', unit: '', barcode: '', image: '', variants: [] });
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Hapus ${name}?`)) await deleteDoc(doc(db, 'products', id));
  };

  const handleBulkDelete = async () => {
    if (confirm(`Hapus ${selectedProducts.length} produk?`)) {
      for (const id of selectedProducts) await deleteDoc(doc(db, 'products', id));
      setSelectedProducts([]);
    }
  };

  // --- EXPORT ---
  const handleExport = () => {
    const data = products.map(p => ({ 
      Nama: p.name, 
      Kategori: p.category,
      Barcode: p.barcode,
      Modal: p.purchasePrice,
      Ecer: p.price, 
      Stok: p.stock, 
      Profit_Ecer: p.price - p.purchasePrice,
      Link_Foto: p.image 
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, 'Laporan_Inventaris.xlsx');
  };

  // --- IMPORT ---
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      
      for (const row of data as any[]) {
        const q = query(collection(db, 'products'), where('name', '==', (row.Nama || row.name)));
        const snap = await getDocs(q);
        if (snap.empty) {
          await addDoc(collection(db, 'products'), {
            name: row.Nama || row.name,
            category: row.Kategori || row.category || 'Umum',
            slug: (row.Nama || row.name || 'prod').toLowerCase().replace(/ /g, '-'),
            barcode: String(row.Barcode || row.barcode || ''),
            purchasePrice: Number(row.Modal || row.purchasePrice) || 0,
            price: Number(row.Ecer || row.price) || 0,
            stock: Number(row.Stok || row.stock) || 0,
            unit: row.Satuan || 'pcs',
            image: row.Link_Foto || '',
            createdAt: serverTimestamp()
          });
        }
      }
      alert('Import Selesai!');
    };
    reader.readAsBinaryString(file);
  };

  if (loading) return <div className="p-10 text-center font-black animate-pulse">SISTEM MEMUAT...</div>;

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen text-black font-sans">
      
      {/* 1. Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="bg-black text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg">
            <LayoutDashboard size={14} /> Admin Panel
          </Link>
          <h1 className="text-sm font-black text-gray-400 uppercase tracking-widest hidden md:block">/ Katalog & Inventaris</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-gray-100 flex items-center gap-2 transition-all shadow-sm">
            <Download size={14} /> Export
          </button>
          <label className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase cursor-pointer hover:bg-gray-100 flex items-center gap-2 transition-all shadow-sm">
            <Upload size={14} /> Import <input type="file" className="hidden" accept=".xlsx" onChange={handleImport} />
          </label>
        </div>
      </div>

      {/* 2. Stats Profit */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-emerald-600 text-white p-8 rounded-[2.5rem] shadow-2xl shadow-emerald-100 relative overflow-hidden">
          <p className="opacity-70 text-[10px] font-black uppercase tracking-widest relative z-10">Valuasi Stok Modal</p>
          <h2 className="text-4xl font-black mt-1 relative z-10">Rp {totalAssetValue.toLocaleString('id-ID')}</h2>
          <TrendingUp size={100} className="absolute -right-4 -bottom-4 opacity-10 rotate-12" />
        </div>
        <div className="bg-blue-600 text-white p-8 rounded-[2.5rem] shadow-2xl shadow-blue-100 relative overflow-hidden">
          <p className="opacity-70 text-[10px] font-black uppercase tracking-widest relative z-10">Potensi Keuntungan</p>
          <h2 className="text-4xl font-black mt-1 relative z-10">Rp {potentialProfit.toLocaleString('id-ID')}</h2>
          <Tag size={100} className="absolute -right-4 -bottom-4 opacity-10 rotate-12" />
        </div>
      </div>

      {/* 3. Filter & Toolbar */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
          <input type="text" placeholder="Cari Produk..." className="w-full pl-12 pr-4 py-4 rounded-3xl border-none shadow-sm bg-white font-bold outline-none focus:ring-2 focus:ring-black" value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} />
        </div>

        {/* Filter Kategori Dinamis */}
        <div className="relative min-w-[180px]">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <select 
            className="w-full pl-10 pr-4 py-4 rounded-3xl border-none shadow-sm font-black text-[10px] uppercase appearance-none bg-white cursor-pointer outline-none focus:ring-2 focus:ring-black"
            value={selectedCategory}
            onChange={(e) => {setSelectedCategory(e.target.value); setCurrentPage(1);}}
          >
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        <button onClick={() => setShowAddModal(true)} className="bg-black text-white px-8 py-4 rounded-3xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-xl">
          <Plus size={16} /> Tambah Produk
        </button>
      </div>

      {/* 4. Bulk Delete */}
      {selectedProducts.length > 0 && (
        <div className="mb-4 p-4 bg-black text-white rounded-2xl flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest ml-2">Terpilih: {selectedProducts.length}</span>
          <button onClick={handleBulkDelete} className="bg-red-500 px-5 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-600">Hapus Masal</button>
        </div>
      )}

      {/* 5. Tabel dengan Pagination */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
              <tr>
                <th className="p-6 w-10">
                   <button onClick={() => setSelectedProducts(selectedProducts.length === currentItems.length ? [] : currentItems.map(p => p.id))}>
                      {selectedProducts.length === currentItems.length ? <CheckSquare size={18} className="text-black"/> : <Square size={18} className="text-gray-200"/>}
                   </button>
                </th>
                <th className="p-6">Informasi Produk</th>
                <th className="p-6">Kategori</th>
                <th className="p-6">Harga & Profit</th>
                <th className="p-6">Stok</th>
                <th className="p-6 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentItems.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="p-6">
                    <button onClick={() => setSelectedProducts(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}>
                      {selectedProducts.includes(p.id) ? <CheckSquare size={18} className="text-black"/> : <Square size={18} className="text-gray-200"/>}
                    </button>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center overflow-hidden border">
                        {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Camera size={20} className="text-gray-300"/>}
                      </div>
                      <div>
                        <div className="font-black text-gray-900 leading-tight uppercase">{p.name}</div>
                        <div className="text-[9px] text-gray-400 font-black uppercase mt-1 flex items-center gap-2">
                          <Barcode size={10} /> {p.barcode || 'NO-SKU'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">
                      {p.category || 'Umum'}
                    </span>
                  </td>
                  <td className="p-6">
                    <div className="text-sm font-black text-gray-900">Rp {p.price?.toLocaleString()}</div>
                    <div className="text-emerald-600 text-[9px] font-black uppercase mt-1">
                      Profit: +Rp {(p.price - (p.purchasePrice || 0)).toLocaleString()}
                    </div>
                  </td>
                  <td className="p-6">
                    <div className={`text-xs font-black px-3 py-1 rounded-full inline-block ${p.stock <= 5 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-900'}`}>
                      {p.stock} <span className="text-[9px] font-bold uppercase">{p.unit}</span>
                    </div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex justify-center gap-2">
                      <Link href={`/admin/products/edit/${p.id}`} className="p-3 bg-gray-50 text-blue-600 rounded-2xl hover:bg-black hover:text-white transition-all shadow-sm">
                        <Edit size={16} />
                      </Link>
                      <button onClick={() => handleDelete(p.id, p.name)} className="p-3 bg-gray-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Kontrol Pagination */}
        <div className="p-6 flex items-center justify-between bg-gray-50/50 border-t">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Data {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredProducts.length)} Dari {filteredProducts.length}
          </p>
          <div className="flex gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-3 rounded-2xl bg-white border shadow-sm disabled:opacity-30 hover:bg-black hover:text-white transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center px-4 font-black text-sm">{currentPage} / {totalPages || 1}</div>
            <button 
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-3 rounded-2xl bg-white border shadow-sm disabled:opacity-30 hover:bg-black hover:text-white transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 6. Modal Tambah dengan Varian & Kategori */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <Plus size={20}/> Produk & Varian Baru
              </h2>
              <button onClick={() => {setShowAddModal(false); resetForm();}} className="bg-gray-100 p-2 rounded-full hover:bg-red-500 hover:text-white transition-all"><X size={20}/></button>
            </div>

            {errorMsg && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-xs font-bold animate-bounce">
                <AlertCircle size={18} /> {errorMsg}
              </div>
            )}
            
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-3xl flex gap-4 items-center border">
                  <div className="w-14 h-14 bg-white rounded-xl border flex items-center justify-center overflow-hidden shrink-0">
                    {formData.image ? <img src={formData.image} className="w-full h-full object-cover" /> : <Camera className="text-gray-200" />}
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">URL Foto</label>
                    <input type="text" placeholder="https://..." className="w-full bg-white border-none p-2 rounded-lg text-[10px] font-bold outline-none" value={formData.image} onChange={(e) => setFormData({...formData, image: e.target.value})} />
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-3xl border">
                   <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 flex items-center gap-1"><Layers size={10}/> Kategori Produk</label>
                   <input required type="text" placeholder="Makanan, Fashion, dll..." className="w-full bg-white border-none p-3 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-black" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Nama Produk *</label>
                  <input required type="text" className="w-full bg-gray-50 border-none p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-black" value={formData.name} onChange={(e) => handleNameChange(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Barcode SKU</label>
                  <input type="text" className="w-full bg-gray-50 border-none p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-black" value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Harga Modal</label>
                  <input required type="number" className="w-full bg-gray-100 border-none p-4 rounded-2xl font-black outline-none" onChange={(e) => setFormData({...formData, purchasePrice: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Harga Jual</label>
                  <input required type="number" className="w-full bg-gray-50 border-none p-4 rounded-2xl font-black outline-none focus:ring-2 focus:ring-black" onChange={(e) => setFormData({...formData, price: Number(e.target.value)})} />
                </div>
              </div>

              {/* SECTION VARIAN */}
              <div className="space-y-3 p-6 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-2"><Tag size={12}/> Varian (Opsional)</label>
                  <button type="button" onClick={addVariantField} className="text-[9px] font-black text-blue-600 uppercase hover:underline">+ Tambah Varian</button>
                </div>
                {formData.variants.map((v, i) => (
                  <div key={i} className="flex gap-3 animate-in fade-in zoom-in-95">
                    <input type="text" placeholder="Ukuran/Warna" className="flex-1 bg-white border-none p-3 rounded-xl text-xs font-bold shadow-sm outline-none" value={v.name} onChange={(e) => updateVariant(i, 'name', e.target.value)} />
                    <input type="number" placeholder="+ Harga" className="w-28 bg-white border-none p-3 rounded-xl text-xs font-bold shadow-sm outline-none" onChange={(e) => updateVariant(i, 'additionalPrice', Number(e.target.value))} />
                    <button type="button" onClick={() => removeVariantField(i)} className="text-red-400"><X size={18}/></button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => {setShowAddModal(false); resetForm();}} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">Batal</button>
                <button type="submit" className="px-12 py-4 bg-black text-white rounded-3xl font-black shadow-2xl hover:bg-emerald-600 transition-all uppercase text-[10px] tracking-widest">Simpan Produk</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}