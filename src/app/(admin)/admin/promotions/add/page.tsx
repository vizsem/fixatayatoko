// src/app/(admin)/promotions/add/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { Gift, Tag, Percent } from 'lucide-react';

type Promotion = {
  name: string;
  type: 'product' | 'category' | 'coupon';
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  targetId?: string;
  code?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export default function AddPromotionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [formData, setFormData] = useState<Promotion>({
    name: '',
    type: 'product',
    discountType: 'percentage',
    discountValue: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isActive: true
  });
  const [error, setError] = useState<string | null>(null);

  // Proteksi admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        alert('Akses ditolak! Anda bukan admin.');
        router.push('/profil');
        return;
      }

      // Load data pendukung
      await loadSupportingData();
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const loadSupportingData = async () => {
    try {
      // Load produk
      const productsSnap = await getDocs(collection(db, 'products'));
      const productList = productsSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        category: doc.data().category
      }));
      setProducts(productList);

      // Load kategori unik
      const categoriesSet = new Set(productList.map(p => p.category).filter(Boolean));
      setCategories(Array.from(categoriesSet));
    } catch (err) {
      console.error('Gagal memuat data pendukung:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.discountValue <= 0) {
      setError('Nilai diskon harus lebih dari 0');
      return;
    }

    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      setError('Tanggal berakhir harus setelah tanggal mulai');
      return;
    }

    try {
      const promoData = {
        ...formData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (editId) {
        await updateDoc(doc(db, 'promotions', editId), promoData);
        alert('Promosi berhasil diperbarui!');
      } else {
        await addDoc(collection(db, 'promotions'), promoData);
        alert('Promosi berhasil ditambahkan!');
      }

      router.push('/admin/promotions');
    } catch (err) {
      console.error('Gagal menyimpan promosi:', err);
      setError('Gagal menyimpan promosi. Silakan coba lagi.');
    }
  };

  const handleTypeChange = (type: 'product' | 'category' | 'coupon') => {
    setFormData(prev => ({
      ...prev,
      type,
      targetId: undefined,
      code: type === 'coupon' ? `PROMO${Date.now().toString().slice(-6)}` : undefined
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat form promosi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">
          {editId ? 'Edit' : 'Tambah'} Program Promosi
        </h1>
        <p className="text-black">Buat promo menarik untuk tingkatkan penjualan</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow border border-gray-200">
        {/* Nama Promosi */}
        <div className="mb-6">
          <label className="block text-black text-sm font-medium mb-2">
            Nama Promosi *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
            placeholder="Contoh: Flash Sale Lebaran"
          />
        </div>

        {/* Tipe Promosi */}
        <div className="mb-6">
          <label className="block text-black text-sm font-medium mb-3">
            Tipe Promosi *
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleTypeChange('product')}
              className={`p-4 border rounded-lg text-left transition-colors ${
                formData.type === 'product'
                  ? 'border-green-600 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Tag size={20} />
                <span className="font-medium text-black">Diskon Produk</span>
              </div>
              <p className="text-sm text-black">Diskon untuk produk tertentu</p>
            </button>
            
            <button
              type="button"
              onClick={() => handleTypeChange('category')}
              className={`p-4 border rounded-lg text-left transition-colors ${
                formData.type === 'category'
                  ? 'border-green-600 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Percent size={20} />
                <span className="font-medium text-black">Diskon Kategori</span>
              </div>
              <p className="text-sm text-black">Diskon untuk semua produk dalam kategori</p>
            </button>
            
            <button
              type="button"
              onClick={() => handleTypeChange('coupon')}
              className={`p-4 border rounded-lg text-left transition-colors ${
                formData.type === 'coupon'
                  ? 'border-green-600 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Gift size={20} />
                <span className="font-medium text-black">Kupon</span>
              </div>
              <p className="text-sm text-black">Kode promo untuk pelanggan</p>
            </button>
          </div>
        </div>

        {/* Target Promosi */}
        {(formData.type === 'product' || formData.type === 'category') && (
          <div className="mb-6">
            <label className="block text-black text-sm font-medium mb-2">
              {formData.type === 'product' ? 'Pilih Produk' : 'Pilih Kategori'} *
            </label>
            <select
              required
              value={formData.targetId || ''}
              onChange={(e) => setFormData({...formData, targetId: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
            >
              <option value="">Pilih...</option>
              {formData.type === 'product' ? (
                products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))
              ) : (
                categories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        {/* Kode Kupon */}
        {formData.type === 'coupon' && (
          <div className="mb-6">
            <label className="block text-black text-sm font-medium mb-2">
              Kode Kupon *
            </label>
            <input
              type="text"
              required
              value={formData.code || ''}
              onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black font-mono"
              placeholder="PROMO10"
            />
          </div>
        )}

        {/* Diskon */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-black text-sm font-medium mb-2">
              Tipe Diskon *
            </label>
            <select
              required
              value={formData.discountType}
              onChange={(e) => setFormData({...formData, discountType: e.target.value as any})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
            >
              <option value="percentage">Persentase (%)</option>
              <option value="fixed">Nilai Tetap (Rp)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-black text-sm font-medium mb-2">
              Nilai Diskon *
            </label>
            <input
              type="number"
              required
              min="0"
              step={formData.discountType === 'percentage' ? "0.1" : "1000"}
              value={formData.discountTimeValue}
              onChange={(e) => setFormData({...formData, discountValue: Number(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
              placeholder={formData.discountType === 'percentage' ? "10" : "10000"}
            />
            <p className="text-xs text-black mt-1">
              {formData.discountType === 'percentage' 
                ? 'Contoh: 10 = 10%' 
                : 'Contoh: 10000 = Rp10.000'}
            </p>
          </div>
        </div>

        {/* Periode */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-black text-sm font-medium mb-2">
              Tanggal Mulai *
            </label>
            <input
              type="date"
              required
              value={formData.startDate}
              onChange={(e) => setFormData({...formData, startDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
            />
          </div>
          
          <div>
            <label className="block text-black text-sm font-medium mb-2">
              Tanggal Berakhir *
            </label>
            <input
              type="date"
              required
              value={formData.endDate}
              onChange={(e) => setFormData({...formData, endDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
            />
          </div>
        </div>

        {/* Status */}
        <div className="mb-8">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
              className="rounded"
            />
            <span className="text-black">Aktifkan promosi ini</span>
          </label>
        </div>

        {/* Aksi */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/promotions')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-black hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            {editId ? 'Perbarui' : 'Simpan'} Promosi
          </button>
        </div>
      </form>
    </div>
  );
}