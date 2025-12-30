// src/app/(admin)/promotions/page.tsx
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
  Gift, 
  Tag, 
  Calendar,
  Percent,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

type Promotion = {
  id: string;
  name: string;
  type: 'product' | 'category' | 'coupon';
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

  // Fetch promosi real-time
  useEffect(() => {
    if (loading) return;

    const q = query(collection(db, 'promotions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const promoList: Promotion[] = [];
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        promoList.push({
          id: doc.id,
          name: data.name || '',
          type: data.type || 'product',
          discountType: data.discountType || 'percentage',
          discountValue: data.discountValue || 0,
          targetId: data.targetId,
          targetName: data.targetName,
          code: data.code,
          startDate: data.startDate || '',
          endDate: data.endDate || '',
          isActive: data.isActive !== false,
          createdAt: data.createdAt || ''
        });
      });
      setPromotions(promoList);
      setError(null);
    }, (err) => {
      console.error('Gagal memuat promosi:', err);
      setError('Gagal memuat data promosi.');
    });

    return () => unsubscribe();
  }, [loading]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus promosi "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'promotions', id));
    } catch (err) {
      alert('Gagal menghapus promosi.');
      console.error(err);
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
          <p className="mt-4 text-black">Memuat data promosi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Gift className="text-black" size={28} />
          <h1 className="text-2xl font-bold text-black">Program Promosi</h1>
        </div>
        <p className="text-black">Kelola diskon, kupon, dan promo untuk pelanggan Anda</p>
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
          Total: <span className="font-medium">{promotions.length} promosi</span>
        </div>
        <Link
          href="/admin/promotions/add"
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Tambah Promosi
        </Link>
      </div>

      {/* Tabel Promosi */}
      <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Promosi
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Target
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Diskon
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Periode
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
              {promotions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-black">
                    <Gift className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p>Belum ada program promosi</p>
                    <Link
                      href="/admin/promotions/add"
                      className="mt-2 inline-block text-green-600 hover:text-green-800 font-medium"
                    >
                      Buat promosi sekarang
                    </Link>
                  </td>
                </tr>
              ) : (
                promotions.map((promo) => {
                  const expired = isExpired(promo.endDate);
                  const activeNow = isActiveNow(promo);
                  
                  return (
                    <tr key={promo.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-black">{promo.name}</div>
                        <div className="flex items-center gap-1 mt-1">
                          {promo.type === 'product' && <Tag size={14} className="text-gray-500" />}
                          {promo.type === 'category' && <Percent size={14} className="text-gray-500" />}
                          {promo.type === 'coupon' && <Gift size={14} className="text-gray-500" />}
                          <span className="text-xs text-black capitalize">{promo.type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-black">
                        {promo.type === 'coupon' ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-mono">
                            {promo.code}
                          </span>
                        ) : (
                          promo.targetName || '–'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-black">
                        {promo.discountType === 'percentage' 
                          ? `${promo.discountValue}%` 
                          : `Rp${promo.discountValue.toLocaleString('id-ID')}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} className="text-gray-500" />
                          <span>{new Date(promo.startDate).toLocaleDateString('id-ID')} –</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <Calendar size={14} className="text-gray-500" />
                          <span>{new Date(promo.endDate).toLocaleDateString('id-ID')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {expired ? (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                            Kedaluwarsa
                          </span>
                        ) : activeNow ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle size={16} className="text-green-600" />
                            <span className="text-green-600">Aktif</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <AlertTriangle size={16} className="text-yellow-600" />
                            <span className="text-yellow-600">Akan Datang</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/admin/promotions/edit/${promo.id}`}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <Edit size={16} />
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(promo.id, promo.name)}
                            className="text-red-600 hover:text-red-800 flex items-center gap-1"
                          >
                            <Trash2 size={16} />
                            Hapus
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