// src/app/(admin)/warehouses/add/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Warehouse = {
  name: string;
  location: string;
  capacity: number;
  isActive: boolean;
};

export default function AddWarehousePage() {
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
        alert('Akses ditolak! Anda bukan admin.');
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
        alert('Gudang berhasil diperbarui!');
      } else {
        await addDoc(collection(db, 'warehouses'), warehouseData);
        alert('Gudang berhasil ditambahkan!');
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
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">
          {editId ? 'Edit' : 'Tambah'} Gudang
        </h1>
        <p className="text-black">Kelola lokasi penyimpanan stok Anda</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow border border-gray-200">
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