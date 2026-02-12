'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  ArrowLeft, Save, Trash2, Calendar,
  Tag, Percent, Database, CheckCircle2 // 'percent' diubah menjadi 'Percent'
} from 'lucide-react';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';

type Promotion = {
  name: string;
  type: 'product' | 'category' | 'coupon';
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  targetId?: string;
  targetName?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export default function EditPromotion() {
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  const [formData, setFormData] = useState<Promotion>({
    name: '',
    type: 'product',
    discountType: 'percentage',
    discountValue: 0,
    targetId: '',
    targetName: '',
    startDate: '',
    endDate: '',
    isActive: true
  });

  // 1. Ambil Data Promosi & Kategori
  useEffect(() => {
    const loadData = async () => {
      try {
        // Ambil data promosi
        const promoDoc = await getDoc(doc(db, 'promotions', id as string));
        if (promoDoc.exists()) {
          setFormData(promoDoc.data() as Promotion);
        } else {
          toast.error("Promosi tidak ditemukan");
          router.push('/admin/promotions');
        }

        // Ambil daftar kategori unik dari produk untuk pilihan dropdown
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const cats = new Set(productsSnapshot.docs.map(doc => doc.data().category));
        setCategories(Array.from(cats) as string[]);

      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Gagal memuat data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, router]);

  // 2. Handle Simpan Perubahan
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'promotions', id as string), {
        ...formData,
        discountValue: Number(formData.discountValue),
        updatedAt: new Date().toISOString()
      });
      toast.success("Promosi berhasil diperbarui!");
      setTimeout(() => router.push('/admin/promotions'), 1500);
    } catch {
      toast.error("Gagal menyimpan perubahan");
    } finally {
      setSaving(false);
    }

  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-orange-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Toaster position="top-right" />

      {/* Header Admin */}
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/promotions" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft size={20} className="text-gray-600" />
            </Link>
            <h1 className="text-lg font-black text-gray-800 uppercase tracking-tight">Edit Program Promo</h1>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 bg-orange-600 text-white px-5 py-2 rounded-xl text-xs font-bold uppercase shadow-lg shadow-orange-100 active:scale-95 disabled:opacity-50 transition-all"
          >
            {saving ? 'Menyimpan...' : <><Save size={16} /> Simpan</>}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-6">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Section: Info Dasar */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center gap-2 text-orange-600 mb-2">
              <Tag size={18} />
              <h2 className="text-sm font-black uppercase">Informasi Utama</h2>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Nama Promo (Contoh: Promo Ramadhan)</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 focus:ring-orange-500/20 outline-none"
                placeholder="Masukkan nama promo..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Tipe Promo</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'product' | 'category' | 'coupon' })}
                  className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 focus:ring-orange-500/20 outline-none appearance-none"

                >
                  <option value="product">Per Produk</option>
                  <option value="category">Per Kategori</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Status Aktif</label>
                <div className="flex items-center h-[44px]">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${formData.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
                  >
                    <CheckCircle2 size={14} /> {formData.isActive ? 'Aktif' : 'Non-Aktif'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Nominal Diskon */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Percent size={18} />
              <h2 className="text-sm font-black uppercase">Pengaturan Diskon</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Jenis Potongan</label>
                <select
                  value={formData.discountType}
                  onChange={(e) => setFormData({ ...formData, discountType: e.target.value as 'percentage' | 'fixed' })}
                  className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm outline-none"

                >
                  <option value="percentage">Persentase (%)</option>
                  <option value="fixed">Nominal Tetap (Rp)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Nilai Potongan</label>
                <input
                  type="number"
                  required
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                  className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm font-bold text-orange-600 outline-none"
                />
              </div>
            </div>

            {/* Target Filter */}
            {formData.type === 'category' ? (
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Pilih Kategori Target</label>
                <select
                  value={formData.targetName}
                  onChange={(e) => setFormData({ ...formData, targetName: e.target.value })}
                  className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm outline-none"
                >
                  <option value="">-- Pilih Kategori --</option>
                  {categories.map((cat, index) => (
                    // Gunakan gabungan nama dan index agar benar-benar unik
                    <option key={`${cat}-${index}`} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Target ID Produk (Ganti di database)</label>
                <div className="flex items-center gap-2 bg-gray-100 p-3 rounded-2xl">
                  <Database size={14} className="text-gray-400" />
                  <span className="text-xs font-mono text-gray-500">{formData.targetId || 'ID Produk Terpilih'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Section: Masa Berlaku */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <Calendar size={18} />
              <h2 className="text-sm font-black uppercase">Periode Promo</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Tanggal Mulai</label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Tanggal Berakhir</label>
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm outline-none"
                />
              </div>
            </div>
            <p className="text-[9px] text-gray-400 italic">Promo akan otomatis muncul di aplikasi pada rentang tanggal di atas (Tahun berjalan: 2026).</p>
          </div>

          {/* Info Hapus */}
          <div className="pt-4 flex flex-col items-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Ingin membatalkan promo ini?</p>
            <button
              type="button"
              onClick={() => toast.error("Fitur hapus ada di halaman daftar promo")}
              className="flex items-center gap-2 text-red-500 text-[10px] font-black uppercase hover:underline"
            >
              <Trash2 size={12} /> Hapus Selamanya
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}