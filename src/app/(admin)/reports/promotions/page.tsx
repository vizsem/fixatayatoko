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
  Download,
  Percent,
  TrendingUp,
  Calendar
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
};

export default function PromotionsReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<PromotionRecord[]>([]];

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
            conversionRate
          });
        });
        
        setPromotions(promoList);
      } catch (err) {
        console.error('Gagal memuat laporan promosi:', err);
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
      'Conversion Rate': `${(promo.conversionRate * 100).toFixed(1)}%`
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Promosi');
    XLSX.writeFile(wb, 'laporan-promosi.xlsx');
  };

  if (loading) {
    return (
      <div className="min-h-