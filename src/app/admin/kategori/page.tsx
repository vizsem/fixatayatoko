'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  limit
} from 'firebase/firestore';



import {
  Grid,
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  ChevronRight,
  X,
  Download,
  Layers, Save
} from 'lucide-react';

import * as XLSX from 'xlsx';
import notify from '@/lib/notify';

// --- TYPES ---
type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  productCount: number;
  createdAt: Timestamp | { toDate: () => Date } | null;
};


export default function AdminCategories() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  // 1. Auth & Admin Protection
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        router.push('/profil');
        return;
      }
      fetchData();
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Fetch Data & Sinkronisasi Jumlah Produk - OPTIMIZED FOR COST
  const fetchData = async () => {
    try {
      setLoading(true);
      const catSnap = await getDocs(collection(db, 'categories'));
      
      // Optimasi: Hitung jumlah produk per kategori menggunakan aggregation
      // Simpan count di setiap kategori untuk menghindari pembacaan seluruh produk
        const categoryList = await Promise.all(catSnap.docs.map(async (doc) => {
        const data = doc.data();
        
        // Query yang lebih efisien - hanya hitung dokumen, tidak baca semua data
        let count = 0;
        try {
          // Coba kedua format field
          const q1 = query(collection(db, 'products'), 
            where('Kategori', '==', data.name),
            limit(1)
          );
          const q2 = query(collection(db, 'products'), 
            where('category', '==', data.name),
            limit(1)
          );
          
          const [snap1, snap2] = await Promise.all([
            getCountFromServer(q1).catch(() => ({ data: () => ({ count: 0 }) })),
            getCountFromServer(q2).catch(() => ({ data: () => ({ count: 0 }) }))
          ]);
          
          count = snap1.data().count + snap2.data().count;
        } catch (error) {
          console.warn('Count query failed, using fallback:', error);
          // Fallback: jika count aggregation tidak support, gunakan cached count
          count = data.productCount || 0;
        }

        return {
          id: doc.id,
          name: data.name || 'Tanpa Nama',
          slug: data.slug || '',
          description: data.description || '',
          productCount: count,
          createdAt: data.createdAt
        };
      }));

      // Sortir secara manual agar lebih stabil
      setCategories(categoryList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Create / Update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const slug = formData.name.toLowerCase().replace(/\s+/g, '-');

    try {
      if (editId) {
        await updateDoc(doc(db, 'categories', editId), {
          ...formData,
          slug,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'categories'), {
          ...formData,
          slug,
          createdAt: serverTimestamp()
        });
      }
      setFormData({ name: '', description: '' });
      setEditId(null);
      setShowModal(false);
      fetchData();
    } catch {
      notify.admin.error("Gagal menyimpan kategori");
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Handle Delete
  const handleDelete = async (id: string, name: string, count: number) => {
    if (count > 0) {
      notify.admin.error(`Kategori "${name}" tidak bisa dihapus karena masih memiliki ${count} produk.`);
      return;
    }
    if (confirm(`Hapus kategori "${name}"?`)) {
      try {
        await deleteDoc(doc(db, 'categories', id));
        setCategories(prev => prev.filter(c => c.id !== id));
      } catch {
        notify.admin.error("Gagal menghapus");

      }
    }
  };

  // 5. Export to Excel
  const handleExport = () => {
    const data = categories.map(c => ({
      Nama: c.name,
      Slug: c.slug,
      Deskripsi: c.description,
      'Jumlah Produk': c.productCount
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kategori");
    XLSX.writeFile(wb, "Data_Kategori_AtayaToko.xlsx");
  };

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-green-600 mb-4"></div>
      <p className="text-[10px] font-black tracking-widest text-gray-400">Loading categories...</p>

    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-10 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tighter flex items-center gap-3">
            <Layers className="text-green-600" size={32} /> Inventory categories
          </h1>
          <p className="text-gray-400 text-xs font-bold tracking-widest mt-1">Pengelompokan produk & struktur stok</p>
        </div>


        <div className="flex gap-3">
          <button onClick={handleExport} className="p-4 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-green-600 transition-all shadow-sm">
            <Download size={20} />
          </button>
          <button
            onClick={() => { setEditId(null); setFormData({ name: '', description: '' }); setShowModal(true); }}
            className="bg-black text-white px-8 py-4 rounded-2xl text-[10px] font-black tracking-widest flex items-center gap-2 hover:bg-gray-800 shadow-xl"
          >
            <Plus size={18} /> Tambah kategori
          </button>

        </div>
      </div>

      {/* Filter & Search */}
      <div className="relative mb-8">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Cari kategori produk..."
          className="w-full pl-14 pr-6 py-5 bg-white border border-gray-100 rounded-[2rem] text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-green-500 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((cat) => (
          <div key={cat.id} className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
            <div className="flex justify-between items-start relative z-10 mb-6">
              <div className="bg-green-50 text-green-600 p-4 rounded-3xl group-hover:bg-green-600 group-hover:text-white transition-all">
                <Grid size={24} />
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => { setEditId(cat.id); setFormData({ name: cat.name, description: cat.description || '' }); setShowModal(true); }}
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => handleDelete(cat.id, cat.name, cat.productCount)}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="relative z-10">
              <h3 className="text-xl font-black text-gray-800 tracking-tighter mb-1">{cat.name}</h3>
              <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-4">slug: {cat.slug}</p>

              <p className="text-xs text-gray-500 font-medium line-clamp-2 mb-6 h-8">{cat.description || 'Tidak ada deskripsi.'}</p>

              <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-gray-400" />
                  <span className="text-xs font-black text-gray-800">{cat.productCount} <span className="text-gray-400 font-bold text-[9px]">Items</span></span>
                </div>
                <Link href={`/admin/produk?category=${cat.name}`} className="text-[10px] font-black text-green-600 tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
                  Lihat stok <ChevronRight size={14} />
                </Link>

              </div>
            </div>

            {/* Background Decor */}
            <div className="absolute -bottom-4 -right-4 text-gray-50 opacity-10 group-hover:opacity-20 transition-opacity">
              <Grid size={120} />
            </div>
          </div>
        ))}
      </div>

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 lg:p-10 relative z-10 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black text-gray-800 tracking-tighter">
                  {editId ? 'Edit category' : 'New category'}
                </h2>
                <p className="text-[10px] font-bold text-gray-400 tracking-widest">Master data kategori produk</p>

              </div>
              <button onClick={() => setShowModal(false)} className="p-2 bg-gray-50 rounded-full"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1">Nama kategori *</label>

                <input
                  required
                  placeholder="Contoh: ATK, Sembako, dll"
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xs font-bold mt-2 outline-none focus:ring-2 focus:ring-green-500"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1">Deskripsi singkat</label>

                <textarea
                  rows={3}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xs font-bold mt-2 outline-none focus:ring-2 focus:ring-green-500"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-[10px] font-black tracking-widest text-gray-400 bg-gray-50 rounded-2xl">Batal</button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-4 bg-green-600 text-white rounded-2xl text-[10px] font-black tracking-widest shadow-xl shadow-green-100 hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? 'Menyimpan...' : <><Save size={16} /> Simpan kategori</>}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
