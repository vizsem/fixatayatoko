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
import * as XLSX from 'xlsx';
import {
  Gift,
  Download,
  Percent,
  TrendingUp,
  Calendar,
  AlertTriangle
} from 'lucide-react';


type PromotionRecord = {
  id: string;
  name: string;
  type: string;
  discountType: string;
  discountValue: number;
  usageCount: number;
  totalDiscount: number;
  conversionRate: number;
  startDate: string;
  endDate: string;
};

export default function PromotionsReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<PromotionRecord[]>([]);

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

  useEffect(() => {
    const fetchPromotionsData = async () => {
      try {
        // Ambil data promosi
        const promotionsSnapshot = await getDocs(collection(db, 'promotions'));
        const promoList: PromotionRecord[] = [];

        // Ambil data pesanan untuk analisis penggunaan
        const ordersSnapshot = await getDocs(
          query(collection(db, 'orders'), where('status', '==', 'SELESAI'))
        );
        const orders = ordersSnapshot.docs.map(doc => doc.data());

        promotionsSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const promoId = doc.id;

          // Hitung penggunaan promosi
          const usedOrders = orders.filter(order =>
            order.promoId === promoId ||
            (order.promoCode && data.code === order.promoCode)
          );
          const usageCount = usedOrders.length;

          // Hitung total diskon
          const totalDiscount = usedOrders.reduce((sum, order) => sum + (order.discountAmount || 0), 0);

          // Hitung conversion rate (sederhana: usage / total orders)
          const conversionRate = orders.length > 0 ? usageCount / orders.length : 0;

          promoList.push({
            id: doc.id,
            name: data.name || '',
            type: data.type || 'product',
            discountType: data.discountType || 'percentage',
            discountValue: data.discountValue || 0,
            usageCount,
            totalDiscount,
            conversionRate,
            startDate: data.startDate || '',
            endDate: data.endDate || ''
          });
        });

        setPromotions(promoList);
      } catch {
        // Error is logged to console
      }

    };

    fetchPromotionsData();
  }, []);

  const handleExport = () => {
    const exportData = promotions.map(promo => ({
      Nama: promo.name,
      Tipe: promo.type,
      'Diskon Tipe': promo.discountType,
      'Nilai Diskon': promo.discountType === 'percentage'
        ? `${promo.discountValue}%`
        : `Rp${promo.discountValue.toLocaleString('id-ID')}`,
      'Jumlah Penggunaan': promo.usageCount,
      'Total Diskon': `Rp${promo.totalDiscount.toLocaleString('id-ID')}`,
      'Conversion Rate': `${(promo.conversionRate * 100).toFixed(1)}%`,
      'Periode Mulai': promo.startDate ? new Date(promo.startDate).toLocaleDateString('id-ID') : '',
      'Periode Akhir': promo.endDate ? new Date(promo.endDate).toLocaleDateString('id-ID') : ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Promosi');
    XLSX.writeFile(wb, 'laporan-promosi.xlsx');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat laporan promosi...</p>
        </div>
      </div>
    );
  }

  const totalPromotions = promotions.length;
  const activePromotions = promotions.filter(p => {
    const now = new Date();
    const start = new Date(p.startDate);
    const end = new Date(p.endDate);
    return now >= start && now <= end;
  }).length;

  const totalDiscountValue = promotions.reduce((sum, p) => sum + p.totalDiscount, 0);
  const avgConversionRate = promotions.length > 0
    ? promotions.reduce((sum, p) => sum + p.conversionRate, 0) / promotions.length
    : 0;

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Laporan Promosi</h1>
        <p className="text-black">Analisis efektivitas program promosi ATAYATOKO2</p>
      </div>

      <div className="flex justify-end mb-6">
        <button
          onClick={handleExport}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Download size={18} />
          Ekspor Excel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Promosi</p>
              <p className="text-2xl font-bold mt-1">{totalPromotions}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Gift className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Promosi Aktif</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{activePromotions}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <Calendar className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Diskon</p>
              <p className="text-2xl font-bold mt-1 text-red-600">
                Rp{totalDiscountValue.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <Percent className="text-red-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Rata-rata Konversi</p>
              <p className="text-2xl font-bold mt-1">
                {(avgConversionRate * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <TrendingUp className="text-purple-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-black">Detail Promosi</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Nama Promosi
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Tipe
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Diskon
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Periode
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Penggunaan
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Total Diskon
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Konversi
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {promotions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-black">
                    <Gift className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p>Belum ada program promosi aktif</p>
                  </td>
                </tr>
              ) : (
                promotions.map((promo) => {
                  const now = new Date();
                  const start = new Date(promo.startDate);
                  const end = new Date(promo.endDate);
                  const isActive = now >= start && now <= end;
                  const isExpired = now > end;

                  return (
                    <tr key={promo.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-black">{promo.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-black">
                        {promo.type === 'product' ? 'Produk' :
                          promo.type === 'category' ? 'Kategori' : 'Kupon'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-black">
                        {promo.discountType === 'percentage'
                          ? `${promo.discountValue}%`
                          : `Rp${promo.discountValue.toLocaleString('id-ID')}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-black">
                        <div>{new Date(promo.startDate).toLocaleDateString('id-ID')}</div>
                        <div className="text-gray-500">sampai</div>
                        <div>{new Date(promo.endDate).toLocaleDateString('id-ID')}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-black">{promo.usageCount}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-black">
                        Rp{promo.totalDiscount.toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-black">
                        {(promo.conversionRate * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isActive ? (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                            Aktif
                          </span>
                        ) : isExpired ? (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                            Kedaluwarsa
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                            Akan Datang
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertTriangle size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-black">
            <p className="font-medium">Catatan Analisis:</p>
            <ul className="list-disc list-inside text-sm mt-1 space-y-1">
              <li><strong>Conversion Rate</strong> dihitung sebagai: (Jumlah Penggunaan Promosi / Total Pesanan) × 100%</li>
              <li>Promosi dengan conversion rate &gt; 10% dianggap efektif</li>
              <li>Total diskon hanya mencakup pesanan dengan status <strong>SELESAI</strong></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
