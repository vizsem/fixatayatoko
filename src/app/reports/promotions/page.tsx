// src/app/(admin)/reports/promotions/page.tsx
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
  query,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Gift, 
  Download
} from 'lucide-react';

type Order = {
  id: string;
  promoId?: string;
  promoCode?: string;
  discountAmount?: number;
  [key: string]: unknown;
};

type PromotionRecord = {
  id: string;
  name: string;
  type: string;
  discountType: string;
  discountValue: number;
  usageCount: number;
  totalDiscount: number;
  conversionRate: number;
};

export default function PromotionsReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<PromotionRecord[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Cek autentikasi dan role
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

      setIsAdmin(true);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch data hanya jika user sudah diverifikasi sebagai admin
  useEffect(() => {
    if (!authChecked || !isAdmin) return;

    const fetchPromotionsData = async () => {
      try {
        const promotionsSnapshot = await getDocs(collection(db, 'promotions'));
        const ordersSnapshot = await getDocs(
          query(collection(db, 'orders'), where('status', '==', 'SELESAI'))
        );
        const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));

        const promoList: PromotionRecord[] = promotionsSnapshot.docs.map(doc => {
          const data = doc.data();
          const promoId = doc.id;

          const usedOrders = orders.filter(order => 
            order.promoId === promoId || 
            (order.promoCode && data.code === order.promoCode)
          );
          const usageCount = usedOrders.length;
          const totalDiscount = usedOrders.reduce((sum, order) => sum + (order.discountAmount || 0), 0);
          const conversionRate = orders.length > 0 ? usageCount / orders.length : 0;

          return {
            id: promoId,
            name: data.name || data.code || 'Promo tanpa nama',
            type: data.type || 'product',
            discountType: data.discountType || 'percentage',
            discountValue: data.discountValue || 0,
            usageCount,
            totalDiscount,
            conversionRate
          };
        });

        setPromotions(promoList);
      } catch (err) {
        console.error('Gagal memuat laporan promosi:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPromotionsData();
  }, [authChecked, isAdmin]);

  const handleExport = async () => {
    if (!promotions.length) return;

    const exportData = promotions.map(promo => ({
      Nama: promo.name,
      Tipe: promo.type,
      'Diskon Tipe': promo.discountType,
      'Nilai Diskon': promo.discountType === 'percentage' 
        ? `${promo.discountValue}%` 
        : `Rp${promo.discountValue.toLocaleString('id-ID')}`,
      'Jumlah Penggunaan': promo.usageCount,
      'Total Diskon': `Rp${promo.totalDiscount.toLocaleString('id-ID')}`,
      'Conversion Rate': `${(promo.conversionRate * 100).toFixed(1)}%`
    }));

    if (typeof window !== 'undefined') {
      const xlsxModule = await import('xlsx');
      const ws = xlsxModule.utils.json_to_sheet(exportData);
      const wb = xlsxModule.utils.book_new();
      xlsxModule.utils.book_append_sheet(wb, ws, 'Laporan Promosi');
      xlsxModule.writeFile(wb, 'laporan-promosi.xlsx');
    }
  };

  if (loading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Memuat laporan promosi...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="text-purple-600" />
          Laporan Promosi
        </h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition"
        >
          <Download size={18} />
          Ekspor Excel
        </button>
      </div>

      {promotions.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          Tidak ada data promosi ditemukan.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded-lg shadow-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="py-3 px-4 text-left">Nama</th>
                <th className="py-3 px-4 text-left">Tipe</th>
                <th className="py-3 px-4 text-left">Diskon</th>
                <th className="py-3 px-4 text-right">Penggunaan</th>
                <th className="py-3 px-4 text-right">Total Diskon</th>
                <th className="py-3 px-4 text-right">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map(promo => (
                <tr key={promo.id} className="border-t hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{promo.name}</td>
                  <td className="py-3 px-4">{promo.type}</td>
                  <td className="py-3 px-4">
                    {promo.discountType === 'percentage'
                      ? `${promo.discountValue}%`
                      : `Rp${promo.discountValue.toLocaleString('id-ID')}`}
                  </td>
                  <td className="py-3 px-4 text-right">{promo.usageCount}</td>
                  <td className="py-3 px-4 text-right">
                    Rp{promo.totalDiscount.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {(promo.conversionRate * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}