'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  deleteDoc,
  query,
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import Link from 'next/link';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Warehouse as WarehouseIcon, 
  MapPin,
  ArrowRightLeft,
  Loader2,
  AlertTriangle,
  Package,
  ChevronRight,
  Activity
} from 'lucide-react';

// --- TYPES ---
type Warehouse = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  usedCapacity: number;
  isActive: boolean;
  createdAt: any;
};

export default function WarehousesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 1. Proteksi Admin & Auth Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
          alert('Akses ditolak! Anda bukan admin.');
          router.push('/profil');
          return;
        }
        setAuthLoading(false);
      } catch (err) {
        setError('Gagal verifikasi hak akses.');
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Fetch Gudang + Sinkronisasi Stok Produk Real-time
  useEffect(() => {
    if (authLoading) return;

    // Listener Utama Gudang
    const qWarehouses = query(collection(db, 'warehouses'), orderBy('name', 'asc'));
    
    const unsubscribe = onSnapshot(qWarehouses, (wSnapshot) => {
      // Listener Produk untuk kalkulasi usedCapacity (Stok total per Gudang)
      const unsubProducts = onSnapshot(collection(db, 'products'), (pSnapshot) => {
        const stockMap: Record<string, number> = {};

        pSnapshot.docs.forEach((pDoc) => {
          const pData = pDoc.data();
          // Mendukung field 'warehouseId' atau fallback ke pencocokan nama gudang
          const wId = pData.warehouseId || pData.warehouse; 
          const stok = Number(pData.Stok || pData.stock || 0);
          
          if (wId) {
            stockMap[wId] = (stockMap[wId] || 0) + stok;
          }
        });

        const warehouseList: Warehouse[] = wSnapshot.docs.map((doc) => {
          const data = doc.data();
          const currentId = doc.id;
          
          // Sinkronisasi: Ambil dari map atau cari berdasarkan nama jika ID tidak cocok
          const usedCapacity = stockMap[currentId] || stockMap[data.name] || 0;

          return {
            id: currentId,
            name: data.name || 'Gudang Tanpa Nama',
            location: data.location || 'Lokasi Belum Diatur',
            capacity: Number(data.capacity) || 0,
            usedCapacity: usedCapacity,
            isActive: data.isActive !== false,
            createdAt: data.createdAt
          };
        });

        setWarehouses(warehouseList);
        setLoading(false);
        setError(null);
      }, (err) => {
        console.error("Error products listener:", err);
        setError("Gagal sinkronisasi stok produk.");
      });

      return () => unsubProducts();
    }, (err) => {
      console.error("Error warehouse listener:", err);
      setError("Gagal memuat data gudang.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [authLoading]);

  // 3. Handle Delete
  const handleDelete = async (id: string, name: string, used: number) => {
    if (used > 0) {
      alert(`Gudang "${name}" tidak bisa dihapus karena masih berisi ${used} unit barang. Kosongkan stok terlebih dahulu.`);
      return;
    }
    
    if (!confirm(`Hapus gudang "${name}"? Tindakan ini tidak bisa dikembalikan.`)) return;
    
    try {
      await deleteDoc(doc(db, 'warehouses', id));
    } catch (err) {
      alert('Gagal menghapus gudang.');
    }
  };

  const utilizationRate = (used: number, capacity: number) => {
    if (capacity <= 0) return used > 0 ? 100 : 0;
    return Math.min(Math.round((used / capacity) * 100), 100);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
        <Loader2 className="animate-spin h-10 w-10 text-green-600 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Syncing Warehouse Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFE] p-4 lg:p-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-black rounded-2xl">
              <WarehouseIcon className="text-white" size={24} />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-gray-800">Warehouse Hub</h1>
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-1">Distribusi & Kapasitas Stok Real-time</p>
        </div>

        <Link
          href="/admin/warehouses/add"
          className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl shadow-green-100 active:scale-95"
        >
          <Plus size={18} strokeWidth={3} />
          Tambah Gudang Baru
        </Link>
      </div>

      {error && (
        <div className="mb-8 p-5 bg-red-50 text-red-700 rounded-3xl border border-red-100 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
          <AlertTriangle size={20} /> {error}
        </div>
      )}

      {/* Grid Stats Singkat */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Unit Gudang</p>
          <p className="text-2xl font-black text-gray-800">{warehouses.length}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Kapasitas Terpakai</p>
          <p className="text-2xl font-black text-green-600">{warehouses.reduce((a, b) => a + b.usedCapacity, 0).toLocaleString()} <span className="text-xs text-gray-300 uppercase">Unit</span></p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Status Operasional</p>
          <p className="text-2xl font-black text-blue-600">{warehouses.filter(w => w.isActive).length} <span className="text-xs text-gray-300 uppercase">Aktif</span></p>
        </div>
      </div>

      {/* Main Content: Warehouse Cards / Table */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Informasi Gudang</th>
                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Utilisasi Kapasitas</th>
                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {warehouses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center opacity-20">
                      <Package size={60} className="mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Data Gudang Kosong</p>
                    </div>
                  </td>
                </tr>
              ) : (
                warehouses.map((warehouse) => {
                  const rate = utilizationRate(warehouse.usedCapacity, warehouse.capacity);
                  const isCritical = rate >= 90;

                  return (
                    <tr key={warehouse.id} className="hover:bg-gray-50/50 transition-all group">
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-black text-gray-800 uppercase text-sm tracking-tighter">{warehouse.name}</span>
                          <div className="flex items-center gap-1 mt-1 text-gray-400">
                            <MapPin size={12} />
                            <span className="text-[10px] font-bold uppercase">{warehouse.location}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="max-w-[200px]">
                          <div className="flex justify-between items-end mb-2">
                            <span className="text-[11px] font-black text-gray-800">
                              {warehouse.usedCapacity.toLocaleString()} <span className="text-gray-300 text-[9px]">/ {warehouse.capacity.toLocaleString()}</span>
                            </span>
                            <span className={`text-[10px] font-black ${isCritical ? 'text-red-600' : 'text-green-600'}`}>
                              {rate}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                isCritical ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'bg-green-500'
                              }`}
                              style={{ width: `${rate}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-xl inline-flex items-center gap-1.5 ${
                          warehouse.isActive 
                          ? 'bg-green-50 text-green-700 border border-green-100' 
                          : 'bg-gray-100 text-gray-400'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${warehouse.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                          {warehouse.isActive ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/admin/warehouses/mutasi/${warehouse.id}`}
                            className="p-3 text-purple-600 bg-white border border-gray-100 rounded-2xl hover:bg-purple-600 hover:text-white hover:shadow-lg transition-all"
                            title="Mutasi Stok"
                          >
                            <ArrowRightLeft size={18} />
                          </Link>
                          <Link
                            href={`/admin/warehouses/edit/${warehouse.id}`}
                            className="p-3 text-blue-600 bg-white border border-gray-100 rounded-2xl hover:bg-blue-600 hover:text-white hover:shadow-lg transition-all"
                          >
                            <Edit size={18} />
                          </Link>
                          <button
                            onClick={() => handleDelete(warehouse.id, warehouse.name, warehouse.usedCapacity)}
                            className="p-3 text-red-500 bg-white border border-gray-100 rounded-2xl hover:bg-red-500 hover:text-white hover:shadow-lg transition-all"
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

      {/* Footer Info */}
      <div className="mt-8 flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] px-4">
        <Activity size={14} className="text-green-500" />
        Live System Status: All warehouses synchronized with global inventory
      </div>
    </div>
  );
}