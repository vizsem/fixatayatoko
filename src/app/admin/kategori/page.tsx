'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import {
  collection, doc, getDoc, getDocs, getCountFromServer, addDoc, updateDoc, deleteDoc, serverTimestamp, query, where, limit
} from 'firebase/firestore';
import { Grid, Plus, Search, Edit, Trash2, Package, ChevronRight, X, Download, Layers, Save, Activity } from 'lucide-react';
import * as XLSX from 'xlsx';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';
import * as Sentry from '@sentry/nextjs';
import { InventorySkeleton } from '@/components/admin/InventorySkeleton';

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  productCount: number;
  createdAt: any;
};

export default function AdminCategories() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({ name: '', description: '' });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const catSnap = await getDocs(collection(db, 'categories'));
      
      const categoryList = await Promise.all(catSnap.docs.map(async (doc) => {
        const data = doc.data();
        let count = 0;
        try {
          const q1 = query(collection(db, 'products'), where('Kategori', '==', data.name), limit(1));
          const q2 = query(collection(db, 'products'), where('category', '==', data.name), limit(1));
          const [snap1, snap2] = await Promise.all([
            getCountFromServer(q1).catch(() => ({ data: () => ({ count: 0 }) })),
            getCountFromServer(q2).catch(() => ({ data: () => ({ count: 0 }) }))
          ]);
          count = snap1.data().count + snap2.data().count;
        } catch (error) {
          Sentry.captureException(error);
          count = data.productCount || 0;
        }

        return {
          id: doc.id,
          name: data.name || 'Untitled',
          slug: data.slug || '',
          description: data.description || '',
          productCount: count,
          createdAt: data.createdAt
        };
      }));

      setCategories(categoryList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      Sentry.captureException(err);
      notify.error("Gagal memuat kategori");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push('/profil/login');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.data()?.role !== 'admin') {
        notify.aksesDitolakAdmin();
        return router.push('/profil');
      }
      fetchData();
    });
    return () => unsub();
  }, [router, fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const slug = formData.name.toLowerCase().replace(/\s+/g, '-');

    try {
      if (editId) {
        await updateDoc(doc(db, 'categories', editId), { ...formData, slug, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'categories'), { ...formData, slug, createdAt: serverTimestamp() });
      }
      setFormData({ name: '', description: '' });
      setEditId(null);
      setShowModal(false);
      fetchData();
      notify.admin.success(editId ? "Kategori diperbarui" : "Kategori dibuat");
    } catch (err) {
      Sentry.captureException(err);
      notify.admin.error("Gagal menyimpan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string, count: number) => {
    if (count > 0) return notify.admin.error(`Masih ada ${count} produk.`);
    if (!confirm(`Hapus "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'categories', id));
      setCategories(prev => prev.filter(c => c.id !== id));
      notify.admin.success("Dihapus");
    } catch (err) {
      Sentry.captureException(err);
      notify.admin.error("Gagal menghapus");
    }
  };

  const handleExport = () => {
    const data = categories.map(c => ({ Nama: c.name, Slug: c.slug, Deskripsi: c.description, Stok: c.productCount }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kategori");
    XLSX.writeFile(wb, "Categories_Ataya.xlsx");
  };

  const filtered = categories.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-6 min-h-screen pb-32">
      <Toaster position="top-right" />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Layers className="text-blue-600" size={32} /> Category Matrix
          </h1>
          <p className="text-slate-400 text-[10px] font-bold tracking-[0.3em] uppercase mt-1">Struktur organisasi inventaris</p>
        </div>

        <div className="flex gap-2">
          <button onClick={handleExport} className="p-4 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-600 transition-all shadow-sm">
            <Download size={20} />
          </button>
          <button onClick={() => { setEditId(null); setFormData({ name: '', description: '' }); setShowModal(true); }} className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black tracking-widest flex items-center gap-2 hover:bg-black shadow-xl active:scale-95 transition-all">
            <Plus size={18} /> NEW CATEGORY
          </button>
        </div>
      </div>

      <div className="relative mb-10">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
        <input
          type="text"
          placeholder="Search categories..."
          className="w-full pl-16 pr-8 py-5 bg-white border border-slate-50 rounded-[2rem] text-xs font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-50 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? <InventorySkeleton /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((cat) => (
            <div key={cat.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-50 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
              <div className="flex justify-between items-start relative z-10 mb-6">
                <div className="bg-blue-50 text-blue-600 p-4 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                  <Grid size={24} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditId(cat.id); setFormData({ name: cat.name, description: cat.description || '' }); setShowModal(true); }} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><Edit size={20} /></button>
                  <button onClick={() => handleDelete(cat.id, cat.name, cat.productCount)} className="p-2 text-slate-300 hover:text-rose-600 transition-colors"><Trash2 size={20} /></button>
                </div>
              </div>

              <div className="relative z-10">
                <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1">{cat.name}</h3>
                <p className="text-[9px] font-black text-slate-300 tracking-widest uppercase mb-4">slug: {cat.slug}</p>
                <p className="text-xs text-slate-500 font-medium line-clamp-2 mb-6 h-9 leading-relaxed">{cat.description || 'No description provided.'}</p>

                <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-50 rounded-lg"><Package size={14} className="text-slate-400" /></div>
                    <span className="text-xs font-black text-slate-900">{cat.productCount} <span className="text-slate-400 font-bold text-[9px] uppercase ml-1">Products</span></span>
                  </div>
                  <Link href={`/admin/products?category=${cat.name}`} className="text-[10px] font-black text-blue-600 tracking-widest flex items-center gap-1 hover:gap-3 transition-all">
                    VIEW SKU <ChevronRight size={14} />
                  </Link>
                </div>
              </div>

              <div className="absolute -bottom-8 -right-8 text-slate-50 opacity-10 group-hover:opacity-20 transition-opacity rotate-12">
                <Grid size={160} />
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowModal(false)} />
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 relative z-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{editId ? 'Edit Matrix' : 'New Matrix'}</h2>
                <p className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase mt-1">Classification management</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-3 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-all"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase ml-1">Category Name</label>
                <input required placeholder="e.g. Beverages, Electronics..." className="w-full bg-slate-50 border-none rounded-2xl px-6 py-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase ml-1">Description</label>
                <textarea rows={3} placeholder="Brief details about this category..." className="w-full bg-slate-50 border-none rounded-2xl px-6 py-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all resize-none" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-5 text-[10px] font-black tracking-widest text-slate-400 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all">CANCEL</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-5 bg-blue-600 text-white rounded-2xl text-[10px] font-black tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                  {isSaving ? <Activity className="animate-spin" size={16} /> : <><Save size={16} /> SAVE CHANGES</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
