'use client';

// ✅ SheetJS dari CDN
declare const XLSX: any;

import { useEffect, useState, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp, limit, startAfter, where
} from 'firebase/firestore';
import Link from 'next/link';
import { 
  Plus, Edit, Trash2, Package, Upload, Download, AlertTriangle, 
  Barcode, TrendingUp, Camera, ChevronLeft, ChevronRight, Printer, 
  Search, X, LayoutDashboard, Settings
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

// --- Types ---
type Variant = { name: string; additionalPrice: number; };

type Product = {
  id: string;
  name: string;
  price: number;
  wholesalePrice: number;
  minWholesaleQty: number;
  purchasePrice: number;
  stock: number;
  stockByWarehouse?: Record<string, number>;
  category: string;
  unit: string;
  barcode: string;
  image: string;
  expiredDate?: string;
  variants?: Variant[];
  createdAt: any;
};

export default function AdminProducts() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  
  // Pagination & Filter States
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<'all' | 'low_stock' | 'expired'>('all');
  const PAGE_SIZE = 15;

  // Form state
  const [formData, setFormData] = useState({
    name: '', price: 0, wholesalePrice: 0, minWholesaleQty: 1,
    purchasePrice: 0, stock: 0, category: '', unit: '',
    barcode: '', expiredDate: '', variants: [] as Variant[]
  });

  // --- Analitik: Valuasi Aset ---
  const totalAssetValue = products.reduce((acc, p) => acc + (p.stock * (p.purchasePrice || 0)), 0);

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
    const q = query(collection(db, 'products'), orderBy('name', 'asc'), limit(PAGE_SIZE));
    const unsub = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
    });
    const whUnsub = onSnapshot(collection(db, 'warehouses'), (snap) => {
      setWarehouses(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
    });
    return () => { unsub(); whUnsub(); };
  }, [loading]);

  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((data) => { setSearchTerm(data); setShowScanner(false); scanner.clear(); }, () => {});
      return () => { scanner.clear(); };
    }
  }, [showScanner]);

  // --- Functions: CRUD & Actions ---
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'products'), {
        ...formData,
        stockByWarehouse: { 'gudang-utama': formData.stock },
        image: "https://placehold.co/400x400/64748b/ffffff?text=No+Image",
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      setFormData({ name: '', price: 0, wholesalePrice: 0, minWholesaleQty: 1, purchasePrice: 0, stock: 0, category: '', unit: '', barcode: '', expiredDate: '', variants: [] });
    } catch (err) { alert('Gagal menambah'); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Hapus ${name}?`)) await deleteDoc(doc(db, 'products', id));
  };

  const handleBulkAction = async (action: 'increase' | 'setPrice') => {
    const val = parseInt(prompt(`Masukkan nilai:`) || '0');
    if (isNaN(val)) return;
    for (const id of selectedProducts) {
      const p = products.find(x => x.id === id);
      if (p) {
        const update = action === 'setPrice' ? { price: val } : { stock: p.stock + val };
        await updateDoc(doc(db, 'products', id), update);
      }
    }
    setSelectedProducts([]);
  };

  const handleExport = () => {
    const data = products.map(p => ({ Nama: p.name, Ecer: p.price, Grosir: p.wholesalePrice, Beli: p.purchasePrice, Stok: p.stock, Barcode: p.barcode }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produk');
    XLSX.writeFile(wb, 'produk-atayatoko.xlsx');
  };

  const handlePrintLabel = (p: Product) => {
    const win = window.open('', '_blank');
    win?.document.write(`<html><body style="text-align:center;padding:20px;border:1px solid #000;width:150px;"><b>${p.name}</b><br>Rp${p.price.toLocaleString()}<br><br>|| ||| ||<br>${p.barcode}</body></html>`);
    win?.print();
  };

  const filteredProducts = products.filter(p => {
    const match = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode.includes(searchTerm);
    if (filterType === 'low_stock') return match && p.stock <= 5;
    if (filterType === 'expired') return match && p.expiredDate && new Date(p.expiredDate) < new Date();
    return match;
  });

  if (loading) return <div className="p-10 text-center">Memuat Sistem...</div>;

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen text-black">
      {/* --- Dashboard Header --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition shadow-md">
            <LayoutDashboard size={18} /> Dashboard Admin
          </Link>
          <h1 className="text-xl font-bold hidden md:block">/ Manajemen Produk</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">
            <Download size={16} /> Export
          </button>
          <label className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer hover:bg-gray-50">
            <Upload size={16} /> Import <input type="file" className="hidden" accept=".xlsx" />
          </label>
        </div>
      </div>

      {/* --- Valuasi Card --- */}
      <div className="bg-emerald-600 text-white p-6 rounded-2xl mb-8 flex flex-col md:flex-row justify-between items-center shadow-lg shadow-emerald-100">
        <div>
          <p className="opacity-80 text-sm">Total Nilai Aset (Harga Beli × Stok)</p>
          <h2 className="text-4xl font-black mt-1">Rp {totalAssetValue.toLocaleString('id-ID')}</h2>
        </div>
        <TrendingUp size={48} className="opacity-20 hidden md:block" />
      </div>

      {/* --- Toolbar Utama --- */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Cari nama, kategori, atau barcode..." className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <button onClick={() => setShowScanner(!showScanner)} className={`p-3 rounded-2xl border ${showScanner ? 'bg-red-500 text-white' : 'bg-white text-gray-600 border-gray-200 shadow-sm'}`}><Camera size={24} /></button>
        <select className="p-3 rounded-2xl border border-gray-200 bg-white text-sm" onChange={(e) => setFilterType(e.target.value as any)}>
          <option value="all">Semua Stok</option>
          <option value="low_stock">Stok Menipis (≤5)</option>
          <option value="expired">Kadaluarsa</option>
        </select>
        <button onClick={() => setShowAddModal(true)} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-md transition-all"><Plus size={20} /> Produk Baru</button>
      </div>

      {/* --- Bulk Actions --- */}
      {selectedProducts.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-bold text-blue-700">{selectedProducts.length} Produk dipilih</span>
          <button onClick={() => handleBulkAction('increase')} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">+ Stok</button>
          <button onClick={() => handleBulkAction('setPrice')} className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">Ubah Harga</button>
          <button onClick={() => setSelectedProducts([])} className="text-gray-400 hover:text-black"><X size={18}/></button>
        </div>
      )}

      {showScanner && <div id="reader" className="mb-6 border-2 border-dashed border-emerald-500 rounded-2xl overflow-hidden"></div>}

      {/* --- Table Section --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="p-4 w-10"><input type="checkbox" onChange={(e) => setSelectedProducts(e.target.checked ? products.map(p=>p.id) : [])} /></th>
                <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Info Produk</th>
                <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Harga (Ecer/Grosir)</th>
                <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Stok / Gudang</th>
                <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="p-4"><input type="checkbox" checked={selectedProducts.includes(p.id)} onChange={() => setSelectedProducts(prev => prev.includes(p.id) ? prev.filter(x=>x!==p.id) : [...prev, p.id])} /></td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img src={p.image} className="w-12 h-12 rounded-xl object-cover bg-gray-100 border" alt="" />
                      <div>
                        <div className="font-bold text-gray-900 leading-tight">{p.name}</div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-1 font-bold"><Barcode size={10} /> {p.barcode} | {p.category}</div>
                        <div className="flex gap-1 mt-1">
                          {p.variants?.map((v, i) => <span key={i} className="text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-bold uppercase">{v.name}</span>)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm font-bold">Rp {p.price.toLocaleString()}</div>
                    <div className="text-emerald-600 text-xs font-bold">Grosir: Rp {p.wholesalePrice.toLocaleString()} <span className="text-gray-400 font-normal">(Min {p.minWholesaleQty})</span></div>
                    <div className="text-[10px] text-blue-500 mt-1 font-medium italic">Profit: Rp {(p.price - p.purchasePrice).toLocaleString()}</div>
                  </td>
                  <td className="p-4">
                    <div className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black ${p.stock <= 5 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                      {p.stock} {p.unit}
                    </div>
                    {warehouses.length > 0 && (
                      <div className="text-[10px] text-gray-400 mt-1">Utama: {p.stockByWarehouse?.['gudang-utama'] || 0}</div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => handlePrintLabel(p)} className="p-2 text-gray-400 hover:text-black hover:bg-white border border-transparent hover:border-gray-200 rounded-xl transition-all" title="Cetak Label"><Printer size={16} /></button>
                      <Link href={`/admin/products/edit/${p.id}`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Edit Produk"><Edit size={16} /></Link>
                      <button onClick={() => handleDelete(p.id, p.name)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Hapus"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* --- Pagination --- */}
        <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
          <p className="text-xs font-bold text-gray-400">Halaman {page}</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 border bg-white rounded-xl disabled:opacity-30"><ChevronLeft size={20}/></button>
            <button onClick={() => setPage(p => p + 1)} className="p-2 border bg-white rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-all"><ChevronRight size={20}/></button>
          </div>
        </div>
      </div>

      {/* --- Modal Tambah --- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black flex items-center gap-2"><Plus className="bg-emerald-100 text-emerald-600 p-1 rounded-lg" /> Tambah Produk Baru</h2>
              <button onClick={() => setShowAddModal(false)} className="bg-gray-50 p-2 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Nama Produk *</label>
                  <input required type="text" className="w-full border-gray-200 border p-3 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Barcode / SKU *</label>
                  <input required type="text" className="w-full border-gray-200 border p-3 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Harga Beli (Modal)</label>
                  <input required type="number" className="w-full border-gray-200 border p-3 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" onChange={(e) => setFormData({...formData, purchasePrice: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Harga Jual Ecer</label>
                  <input required type="number" className="w-full border-gray-200 border p-3 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" onChange={(e) => setFormData({...formData, price: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Harga Grosir</label>
                  <input required type="number" className="w-full border-gray-200 border p-3 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" onChange={(e) => setFormData({...formData, wholesalePrice: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Min. Grosir (Qty)</label>
                  <input required type="number" className="w-full border-gray-200 border p-3 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" defaultValue={1} onChange={(e) => setFormData({...formData, minWholesaleQty: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Stok Awal</label>
                  <input required type="number" className="w-full border-gray-200 border p-3 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" onChange={(e) => setFormData({...formData, stock: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Satuan (Pcs/Kg)</label>
                  <input required type="text" className="w-full border-gray-200 border p-3 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="pcs" onChange={(e) => setFormData({...formData, unit: e.target.value})} />
                </div>
              </div>

              {/* Varian */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-3">Varian Produk (Opsional)</p>
                <div className="flex gap-2">
                  <input id="vn" type="text" placeholder="Ukuran/Warna" className="flex-1 border-gray-200 border p-2 rounded-xl text-sm" />
                  <input id="vp" type="number" placeholder="+ Harga" className="w-24 border-gray-200 border p-2 rounded-xl text-sm" />
                  <button type="button" onClick={() => {
                    const n = document.getElementById('vn') as HTMLInputElement;
                    const p = document.getElementById('vp') as HTMLInputElement;
                    if(n.value) { setFormData({...formData, variants: [...formData.variants, {name: n.value, additionalPrice: Number(p.value)} ]}); n.value=''; p.value=''; }
                  }} className="bg-black text-white px-4 rounded-xl text-xs font-bold">Tambah</button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {formData.variants.map((v, i) => (
                    <span key={i} className="bg-white border px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-2 shadow-sm">
                      {v.name} (+{v.additionalPrice})
                      <X size={12} className="text-red-400 cursor-pointer" onClick={() => setFormData({...formData, variants: formData.variants.filter((_, idx)=>idx!==i)})} />
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-3 text-gray-400 font-bold hover:text-black">Batal</button>
                <button type="submit" className="px-10 py-3 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">Simpan Produk</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}