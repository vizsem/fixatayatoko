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
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import {
  Plus,
  Edit,
  Trash2,
  Gift,
  Tag,
  Calendar,
  AlertTriangle,
  Zap,
  Layers,
  Clock
} from 'lucide-react';


// Update Tipe Data untuk Mendukung Flash Sale & Bundle
type Promotion = {
  id: string;
  name: string;
  type: 'product' | 'category' | 'coupon' | 'flash-sale' | 'bundle';
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  targetId?: string;
  targetName?: string;
  code?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
};

export default function PromotionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
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

  // Fetch promosi real-time dengan urutan terbaru
  useEffect(() => {
    if (loading) return;

    const q = query(collection(db, 'promotions'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const promoList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Promotion[];

      setPromotions(promoList);
      setError(null);
    }, () => {
      setError('Gagal memuat data promosi.');
    });


    return () => unsubscribe();
  }, [loading]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus promosi "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'promotions', id));
    } catch {
      alert('Gagal menghapus promosi.');
    }

  };

  const isExpired = (endDate: string) => {
    return new Date(endDate) < new Date();
  };

  const isActiveNow = (promo: Promotion) => {
    if (!promo.isActive) return false;
    const now = new Date();
    const start = new Date(promo.startDate);
    const end = new Date(promo.endDate);
    return now >= start && now <= end;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black font-bold uppercase tracking-widest text-xs">Menghubungkan Database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-black p-2 rounded-lg text-white">
              <Gift size={24} />
            </div>
            <h1 className="text-2xl font-black text-black uppercase tracking-tight">Marketing Center</h1>
          </div>
          <p className="text-gray-500 text-sm">Kelola diskon, Flash Sale, dan promo kategori untuk meningkatkan penjualan.</p>
        </div>

        <Link
          href="/admin/promotions/add"
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          Buat Promo Baru
        </Link>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 flex items-center gap-3 text-sm">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {/* Stats Mini */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-2xl border border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase">Total Program</p>
          <p className="text-xl font-black text-black">{promotions.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase">Aktif Sekarang</p>
          <p className="text-xl font-black text-green-600">{promotions.filter(p => isActiveNow(p)).length}</p>
        </div>
      </div>

      {/* Tabel Promosi */}
      <div className="bg-white shadow-sm rounded-[2rem] border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Detail Promo</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Target</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Potongan</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Periode</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {promotions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center opacity-20">
                      <Gift size={48} className="mb-4" />
                      <p className="text-sm font-black uppercase tracking-widest">Belum ada promo aktif</p>
                    </div>
                  </td>
                </tr>
              ) : (
                promotions.map((promo) => {
                  const expired = isExpired(promo.endDate);
                  const activeNow = isActiveNow(promo);

                  return (
                    <tr key={promo.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 uppercase text-xs">{promo.name}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {promo.type === 'product' && <Tag size={12} className="text-blue-500" />}
                          {promo.type === 'category' && <Layers size={12} className="text-purple-500" />}
                          {promo.type === 'coupon' && <Gift size={12} className="text-pink-500" />}
                          {promo.type === 'flash-sale' && <Zap size={12} className="text-orange-500" fill="currentColor" />}
                          {promo.type === 'bundle' && <Plus size={12} className="text-green-500" />}
                          <span className="text-[10px] font-black text-gray-400 uppercase">{promo.type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {promo.type === 'coupon' ? (
                          <span className="px-2 py-1 bg-gray-100 text-black rounded-lg text-[10px] font-black font-mono border border-gray-200">
                            {promo.code}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-gray-600 italic">{promo.targetName || 'Semua Produk'}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-black text-green-600">
                          {promo.discountType === 'percentage'
                            ? `${promo.discountValue}%`
                            : `Rp${(promo.discountValue || 0).toLocaleString('id-ID')}`}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 text-[10px] font-bold text-gray-500 uppercase">
                          <div className="flex items-center gap-1">
                            <Clock size={10} />
                            <span>{new Date(promo.startDate).toLocaleDateString('id-ID')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar size={10} />
                            <span>{new Date(promo.endDate).toLocaleDateString('id-ID')}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {expired ? (
                          <span className="px-2 py-1 text-[8px] font-black bg-red-50 text-red-500 rounded-md uppercase border border-red-100">
                            Kedaluwarsa
                          </span>
                        ) : activeNow ? (
                          <div className="flex items-center gap-1.5 text-green-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest">Berjalan</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-orange-500">
                            <Clock size={12} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Terjadwal</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/promotions/edit/${promo.id}`}
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </Link>
                          <button
                            onClick={() => handleDelete(promo.id, promo.name)}
                            className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 size={16} />
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

      <div className="mt-8 text-center">
        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em]">Atayatoko Marketing Engine v2.0</p>
      </div>
    </div>
  );
}