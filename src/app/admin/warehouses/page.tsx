'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  deleteDoc,
  query,
  onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Warehouse as WarehouseIcon, 
  MapPin,
  ArrowRightLeft,
  Loader2
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

  // 1. Proteksi Admin (Tetap Ada)
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

  // 2. Fetch Gudang + Sinkronisasi Stok Produk (Logika Baru)
  useEffect(() => {
    if (loading) return;

    // Listener Gudang
    const q = query(collection(db, 'warehouses'));
    const unsubscribe = onSnapshot(q, (wSnapshot) => {
      
      // Listener Produk untuk kalkulasi usedCapacity secara real-time
      const unsubProducts = onSnapshot(collection(db, 'products'), (pSnapshot) => {
        const stockMap: Record<string, number> = {};

        pSnapshot.docs.forEach((pDoc) => {
          const pData = pDoc.data();
          const wId = pData.warehouseId; // Pastikan produk punya field warehouseId
          const stok = Number(pData.Stok || pData.stock || 0);
          if (wId) {
            stockMap[wId] = (stockMap[wId] || 0) + stok;
          }
        });

        const warehouseList: Warehouse[] = wSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || '',
            location: data.location || '',
            capacity: data.capacity || 0,
            // SINKRONISASI: usedCapacity diambil dari kalkulasi produk
            usedCapacity: stockMap[doc.id] || 0, 
            isActive: data.isActive !== false,
            createdAt: data.createdAt || ''
          };
        });

        setWarehouses(warehouseList);
        setError(null);
      });

      return () => unsubProducts();
    }, (err) => {
      console.error('Gagal memuat gudang:', err);
      setError('Gagal memuat data gudang.');
    });

    return () => unsubscribe();
  }, [loading]);

  // 3. Handle Delete (Tetap Ada)
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
    return Math.min(Math.round((used / capacity) * 100), 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-green-600 mx-auto" />
          <p className="mt-4 text-black font-bold uppercase text-[10px] tracking-widest">Sinkronisasi Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <WarehouseIcon className="text-black" size={28} />
          <h1 className="text-2xl font-black uppercase tracking-tighter text-black">Manajemen Multi-Gudang</h1>
        </div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Pantau kapasitas dan mutasi stok secara real-time</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-xs font-bold uppercase">
          {error}
        </div>
      )}

      {/* Aksi Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Total: <span className="text-black">{warehouses.length} UNIT GUDANG</span>
        </div>
        <Link
          href="/admin/warehouses/add"
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-green-100 active:scale-95"
        >
          <Plus size={18} strokeWidth={3} />
          Tambah Gudang
        </Link>
      </div>

      {/* Tabel Gudang */}
      <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Gudang</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Lokasi</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Kapasitas (Unit)</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {warehouses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <WarehouseIcon className="mx-auto h-12 w-12 text-gray-200 mb-4" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Belum ada gudang terdaftar</p>
                  </td>
                </tr>
              ) : (
                warehouses.map((warehouse) => {
                  const rate = utilizationRate(warehouse.usedCapacity, warehouse.capacity);
                  const isFull = rate >= 90;

                  return (
                    <tr key={warehouse.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-black text-gray-900 uppercase text-sm tracking-tighter">{warehouse.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-gray-500 font-bold text-[10px] uppercase">
                          <MapPin size={14} className="text-gray-300" />
                          <span>{warehouse.location}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-[11px] font-black text-gray-900 mb-1">
                          {warehouse.usedCapacity.toLocaleString()} <span className="text-gray-300">/</span> {warehouse.capacity.toLocaleString()}
                        </div>
                        <div className="w-32 bg-gray-100 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-700 ${
                              isFull ? 'bg-red-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${rate}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg ${
                          warehouse.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'
                        }`}>
                          {warehouse.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/warehouses/mutasi/${warehouse.id}`}
                            className="p-2 text-purple-600 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors"
                            title="Mutasi Stok"
                          >
                            <ArrowRightLeft size={18} />
                          </Link>
                          <Link
                            href={`/admin/warehouses/edit/${warehouse.id}`}
                            className="p-2 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
                          >
                            <Edit size={18} />
                          </Link>
                          <button
                            onClick={() => handleDelete(warehouse.id, warehouse.name)}
                            className="p-2 text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
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
    </div>
  );
}