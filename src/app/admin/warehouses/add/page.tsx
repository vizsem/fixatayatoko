// src/app/admin/warehouses/add/page.tsx
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Package } from 'lucide-react';
import notify from '@/lib/notify';

type Warehouse = {
  name: string;
  location: string;
  capacity: number;
  isActive: boolean;
};

function WarehouseFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Warehouse>({
    name: '',
    location: '',
    capacity: 1000,
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
        notify.admin.error('Akses ditolak! Anda bukan admin.');
        router.push('/profil');
        return;
      }

      // Jika edit, load data
      if (editId) {
        const docSnap = await getDoc(doc(db, 'warehouses', editId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            name: data.name || '',
            location: data.location || '',
            capacity: data.capacity || 1000,
            isActive: data.isActive !== false
          });
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router, editId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.capacity <= 0) {
      setError('Kapasitas harus lebih dari 0');
      return;
    }

    try {
      const warehouseData = {
        ...formData,
        usedCapacity: 0, // Awalnya kosong
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (editId) {
        await updateDoc(doc(db, 'warehouses', editId), warehouseData);
        notify.admin.success('Gudang berhasil diperbarui!');
      } else {
        await addDoc(collection(db, 'warehouses'), warehouseData);
        notify.admin.success('Gudang berhasil ditambahkan!');
      }

      router.push('/admin/warehouses');
    } catch (err) {
      console.error('Gagal menyimpan gudang:', err);
      setError('Gagal menyimpan gudang. Silakan coba lagi.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat form gudang...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen text-black">
      <div className="max-w-2xl mx-auto mb-6 flex items-center gap-3">
        <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
          <Package size={22} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-gray-900">
            {editId ? 'Edit' : 'Tambah'} Gudang
          </h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kelola lokasi penyimpanan stok</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 max-w-2xl mx-auto">
        {/* Nama Gudang */}
        <div className="mb-6">
          <label className="block text-black text-sm font-medium mb-2">
            Nama Gudang *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
            placeholder="Contoh: Gudang Utama"
          />
        </div>

        {/* Lokasi */}
        <div className="mb-6">
          <label className="block text-black text-sm font-medium mb-2">
            Lokasi *
          </label>
          <input
            type="text"
            required
            value={formData.location}
            onChange={(e) => setFormData({...formData, location: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
            placeholder="Jl. Raya No. 123, Kota"
          />
        </div>

        {/* Kapasitas */}
        <div className="mb-6">
          <label className="block text-black text-sm font-medium mb-2">
            Kapasitas Maksimal (unit) *
          </label>
          <input
            type="number"
            required
            min="1"
            value={formData.capacity}
            onChange={(e) => setFormData({...formData, capacity: Number(e.target.value)})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
            placeholder="1000"
          />
          <p className="text-xs text-black mt-1">
            Jumlah maksimal item yang bisa disimpan di gudang ini
          </p>
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
            <span className="text-black">Aktifkan gudang ini</span>
          </label>
        </div>

        {/* Aksi */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/warehouses')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-black hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            {editId ? 'Perbarui' : 'Simpan'} Gudang
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AddWarehousePage() {
  return (
    <Suspense fallback={<div className="p-6">Loading form gudang...</div>}>
      <WarehouseFormContent />
    </Suspense>
  );
}
