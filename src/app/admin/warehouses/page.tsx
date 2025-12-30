// src/app/(admin)/warehouses/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Warehouse, 
  MapPin,
  Package,
  ArrowRightLeft
} from 'lucide-react';

type Warehouse = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  usedCapacity: number;
  isActive: boolean;
  createdAt: string;
};

export default function WarehousesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
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
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch gudang real-time
  useEffect(() => {
    if (loading) return;

    const q = query(collection(db, 'warehouses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const warehouseList: Warehouse[] = [];
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        warehouseList.push({
          id: doc.id,
          name: data.name || '',
          location: data.location || '',
          capacity: data.capacity || 0,
          usedCapacity: data.usedCapacity || 0,
          isActive: data.isActive !== false,
          createdAt: data.createdAt || ''
        });
      });
      // Hitung usedCapacity dari stok produk
      setWarehouses(warehouseList);
      setError(null);
    }, (err) => {
      console.error('Gagal memuat gudang:', err);
      setError('Gagal memuat data gudang.');
    });

    return () => unsubscribe();
  }, [loading]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus gudang "${name}"? Tindakan ini tidak bisa dikembalikan.`)) return;
    try {
      await deleteDoc(doc(db, 'warehouses', id));
    } catch (err) {
      alert('Gagal menghapus gudang.');
      console.error(err);
    }
  };

  const utilizationRate = (used: number, capacity: number) => {
    if (capacity === 0) return 0;
    return Math.round((used / capacity) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat data gudang...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Warehouse className="text-black" size={28} />
          <h1 className="text-2xl font-bold text-black">Manajemen Multi-Gudang</h1>
        </div>
        <p className="text-black">Kelola stok dan kapasitas gudang Anda</p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* Aksi Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-black">
          Total: <span className="font-medium">{warehouses.length} gudang</span>
        </div>
        <Link
          href="/admin/warehouses/add"
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Tambah Gudang
        </Link>
      </div>

      {/* Tabel Gudang */}
      <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Gudang
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Lokasi
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Kapasitas
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {warehouses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-black">
                    <Warehouse className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p>Belum ada gudang terdaftar</p>
                    <Link
                      href="/admin/warehouses/add"
                      className="mt-2 inline-block text-green-600 hover:text-green-800 font-medium"
                    >
                      Tambah gudang sekarang
                    </Link>
                  </td>
                </tr>
              ) : (
                warehouses.map((warehouse) => {
                  const rate = utilizationRate(warehouse.usedCapacity, warehouse.capacity);
                  const isFull = rate >= 90;
                  const isEmpty = rate === 0;

                  return (
                    <tr key={warehouse.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-black">{warehouse.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-black">
                        <div className="flex items-center gap-2">
                          <MapPin size={16} className="text-gray-500" />
                          <span>{warehouse.location}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-black">
                          {warehouse.usedCapacity.toLocaleString()} / {warehouse.capacity.toLocaleString()} unit
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className={`h-2 rounded-full ${
                              isFull ? 'bg-red-600' : isEmpty ? 'bg-gray-400' : 'bg-green-600'
                            }`}
                            style={{ width: `${rate}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-black mt-1">
                          {rate}% terisi
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {warehouse.isActive ? (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                            Aktif
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/admin/warehouses/edit/${warehouse.id}`}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <Edit size={16} />
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(warehouse.id, warehouse.name)}
                            className="text-red-600 hover:text-red-800 flex items-center gap-1"
                          >
                            <Trash2 size={16} />
                            Hapus
                          </button>
                          <Link
                            href={`/admin/warehouses/mutasi/${warehouse.id}`}
                            className="text-purple-600 hover:text-purple-800 flex items-center gap-1"
                          >
                            <ArrowRightLeft size={16} />
                            Mutasi
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Catatan */}
      <div className="mt-6 text-sm text-black text-center">
        💡 Gudang dengan kapasitas &gt;90% ditandai merah. Segera lakukan mutasi stok!
      </div>
    </div>
  );
}