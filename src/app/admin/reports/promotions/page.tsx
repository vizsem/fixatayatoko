// src/app/admin/reports/promotions/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  Gift, Download, Percent, TrendingUp, Calendar,
  AlertTriangle, ShieldCheck, Zap, Layers, ShoppingBag,
  Sparkles, DollarSign, ArrowLeft, ArrowUpRight
} from 'lucide-react';
import notify from '@/lib/notify';
import { isAuthorizedAdmin } from '@/lib/auth-helpers';
import {
  auth, collection, db, doc, getDoc, getDocs,
  onAuthStateChanged, query, where
} from '@/lib/firebase';

type PromotionRecord = {
  id: string;
  name: string;
  type: string;
  discountType: string;
  discountValue: number;
  usageCount: number;
  totalDiscount: number;
  generatedRevenue: number;
  conversionRate: number;
  startDate: string;
  endDate: string;
  minPurchase?: number;
  maxDiscount?: number;
  quota?: number;
};

const idr = (n: number) => `Rp${Math.abs(n).toLocaleString('id-ID')}`;

export default function PromotionsReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<PromotionRecord[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: any) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userDocData = userDoc.exists() ? userDoc.data() : null;

      if (!isAuthorizedAdmin(user, userDocData)) {
        notify.aksesDitolakAdmin();
        router.push('/profil');
        return;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (loading) return;

    const fetchPromotionsData = async () => {
      try {
        const promotionsSnapshot = await getDocs(collection(db, 'promotions'));
        const ordersSnapshot = await getDocs(
          query(collection(db, 'orders'), where('status', 'in', ['SELESAI', 'SUCCESS']))
        );
        const orders = ordersSnapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

        const promoList: PromotionRecord[] = [];

        promotionsSnapshot.docs.forEach((d) => {
          const data = d.data() as any;
          const promoId = d.id;

          // Filter orders using this promotion
          const usedOrders = orders.filter(
            (order) =>
              order.promoId === promoId ||
              order.voucherUsed === promoId ||
              (order.promoCode && data.code && order.promoCode.toUpperCase() === data.code.toUpperCase())
          );

          const usageCount = usedOrders.length;
          const totalDiscount = usedOrders.reduce((sum, order) => sum + Number(order.discountAmount || order.discount || 0), 0);
          const generatedRevenue = usedOrders.reduce((sum, order) => sum + Number(order.total || order.subtotal || 0), 0);
          const conversionRate = orders.length > 0 ? usageCount / orders.length : 0;

          promoList.push({
            id: d.id,
            name: data.name || '',
            type: data.type || 'product',
            discountType: data.discountType || 'percentage',
            discountValue: Number(data.discountValue || 0),
            usageCount,
            totalDiscount,
            generatedRevenue,
            conversionRate,
            startDate: data.startDate || '',
            endDate: data.endDate || '',
            minPurchase: data.minPurchase ? Number(data.minPurchase) : undefined,
            maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : undefined,
            quota: data.quota ? Number(data.quota) : undefined,
          });
        });

        promoList.sort((a, b) => b.usageCount - a.usageCount);
        setPromotions(promoList);
      } catch (err) {
        console.error('Error fetching promo report:', err);
      }
    };

    fetchPromotionsData();
  }, [loading]);

  const handleExport = () => {
    const exportData = promotions.map((promo) => ({
      Nama: promo.name,
      Tipe: promo.type,
      'Diskon Tipe': promo.discountType,
      'Nilai Diskon':
        promo.discountType === 'percentage'
          ? `${promo.discountValue}%`
          : `Rp${promo.discountValue.toLocaleString('id-ID')}`,
      'Jumlah Pemakaian': promo.usageCount,
      'Total Diskon (Rp)': promo.totalDiscount,
      'Omset Dihasilkan (Rp)': promo.generatedRevenue,
      'Efisiensi ROI (Omset/Diskon)':
        promo.totalDiscount > 0 ? Number((promo.generatedRevenue / promo.totalDiscount).toFixed(1)) : 0,
      'Conversion Rate': `${(promo.conversionRate * 100).toFixed(1)}%`,
      'Min. Belanja (Rp)': promo.minPurchase || 0,
      'Max. Potongan (Rp)': promo.maxDiscount || 0,
      'Total Kuota': promo.quota || 'Tanpa Kuota',
      'Periode Mulai': promo.startDate ? new Date(promo.startDate).toLocaleDateString('id-ID') : '',
      'Periode Akhir': promo.endDate ? new Date(promo.endDate).toLocaleDateString('id-ID') : '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Efektivitas Promosi');
    XLSX.writeFile(wb, `laporan-efektivitas-promosi-${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify.admin.success('Laporan efektivitas promosi berhasil diunduh!');
  };

  const totals = useMemo(() => {
    const totalCount = promotions.length;
    const totalDiscountGiven = promotions.reduce((s, p) => s + p.totalDiscount, 0);
    const totalRev = promotions.reduce((s, p) => s + p.generatedRevenue, 0);
    const totalUsed = promotions.reduce((s, p) => s + p.usageCount, 0);
    const roiMultiplier = totalDiscountGiven > 0 ? totalRev / totalDiscountGiven : 0;
    return { totalCount, totalDiscountGiven, totalRev, totalUsed, roiMultiplier };
  }, [promotions]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-400">
            Menganalisis Efektivitas Promosi...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 bg-[#F4F6FA] min-h-screen text-slate-800 font-sans pb-24">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/promotions"
            className="p-2 bg-white rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Laporan Efektivitas & ROI Promosi
            </h1>
            <p className="text-[11px] font-bold text-slate-400">
              Evaluasi perbandingan diskon yang dikeluarkan vs omset pesanan riil
            </p>
          </div>
        </div>

        <button
          onClick={handleExport}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg shadow-emerald-200 flex items-center gap-2"
        >
          <Download size={15} />
          <span>Export Excel</span>
        </button>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Total Diskon Diberikan</p>
          <p className="text-xl font-black text-rose-600">{idr(totals.totalDiscountGiven)}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-1">{totals.totalUsed} kali pemakaian</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Omset yang Dihasilkan</p>
          <p className="text-xl font-black text-emerald-600">{idr(totals.totalRev)}</p>
          <p className="text-[10px] font-bold text-emerald-600/80 mt-1">Dari pesanan promo</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Efisiensi Multiplier (ROI)</p>
          <p className="text-xl font-black text-blue-600">
            {totals.roiMultiplier > 0 ? `${totals.roiMultiplier.toFixed(1)}x` : '—'}
          </p>
          <p className="text-[10px] font-bold text-slate-400 mt-1">Setiap Rp1 diskon hasilkan omset</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Status Keuangan Promo</p>
          <div className="flex items-center gap-1.5 mt-1">
            <ShieldCheck className="text-emerald-600" size={18} />
            <span className="text-sm font-black text-emerald-700">Terkendali</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-1">Dilindungi Guardrail</p>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-extrabold text-slate-800 text-sm">Rincian Efektivitas Program Promosi</h3>
          <span className="text-xs font-bold text-slate-400">{promotions.length} program</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/70">
              <tr>
                {['Nama Promosi', 'Model', 'Diskon', 'Penggunaan', 'Total Diskon', 'Omset Dihasilkan', 'Efisiensi (ROI)', 'Pengaman'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {promotions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400 font-bold text-xs">
                    Belum ada data riwayat promosi
                  </td>
                </tr>
              ) : (
                promotions.map((p) => {
                  const roi = p.totalDiscount > 0 ? p.generatedRevenue / p.totalDiscount : 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-black text-slate-900">{p.name}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-slate-100 text-slate-700">
                          {p.type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-bold text-slate-700">
                          {p.discountType === 'percentage' ? `${p.discountValue}%` : idr(p.discountValue)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-black text-slate-800">{p.usageCount}x</span>
                        {p.quota ? (
                          <span className="text-[10px] text-slate-400 ml-1">/ {p.quota}</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-black text-rose-600">{idr(p.totalDiscount)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-black text-emerald-600">{idr(p.generatedRevenue)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {roi > 0 ? (
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                            roi >= 5 ? 'bg-emerald-50 text-emerald-700' : roi >= 2 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {roi.toFixed(1)}x ROI
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-0.5 text-[9px] font-bold text-slate-500">
                          {p.minPurchase ? <span>Min: {idr(p.minPurchase)}</span> : null}
                          {p.maxDiscount ? <span>Cap: {idr(p.maxDiscount)}</span> : null}
                          {!p.minPurchase && !p.maxDiscount && <span className="text-slate-300">Tanpa Batas</span>}
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
