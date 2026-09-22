'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useAdminAuth from '@/lib/hooks/useAdminAuth';
import * as XLSX from 'xlsx';
import {
  Receipt,
  Download,
  Calendar,
  Building2,
  UserCheck,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  ShieldCheck,
  FileText
} from 'lucide-react';
import notify from '@/lib/notify';
import { collection, db, getDocs, query, where } from '@/lib/firebase';
import { calculateTaxBreakdown, DEFAULT_TAX_SETTINGS, TaxSettings } from '@/lib/tax';

type TaxRecord = {
  id: string;
  orderId: string;
  date: string;
  customerName: string;
  productName: string;
  category: string;
  totalSales: number;
  dpp: number;
  taxAmount: number;
  effectiveRate: number;
  isExempt: boolean;
  taxLabel: string;
};

export default function TaxReportPage() {
  const router = useRouter();
  const { authLoading } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [taxSettings, setTaxSettings] = useState<TaxSettings>(DEFAULT_TAX_SETTINGS);
  const [taxRecords, setTaxRecords] = useState<TaxRecord[]>([]);

  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const toLocal = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    return {
      startDate: toLocal(new Date(now.getFullYear(), now.getMonth(), 1)),
      endDate: toLocal(now)
    };
  });

  useEffect(() => {
    if (authLoading) return;

    const fetchTaxData = async () => {
      setLoading(true);
      try {
        // Fetch System Settings for Tax
        const settingsSnap = await getDocs(collection(db, 'settings'));
        let currentTaxSettings = DEFAULT_TAX_SETTINGS;
        settingsSnap.docs.forEach(d => {
          if (d.id === 'system' && d.data()?.tax) {
            currentTaxSettings = { ...DEFAULT_TAX_SETTINGS, ...d.data().tax };
          }
        });
        setTaxSettings(currentTaxSettings);

        // Fetch Completed Orders
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        endDate.setHours(23, 59, 59, 999);

        const ordersSnapshot = await getDocs(
          query(collection(db, 'orders'), where('status', 'in', ['SELESAI', 'SUCCESS']))
        );

        const records: TaxRecord[] = [];
        for (const docSnap of ordersSnapshot.docs) {
          const order = docSnap.data();
          const created = order.createdAt?.toDate
            ? order.createdAt.toDate()
            : new Date(order.createdAt || new Date().toISOString());

          if (!(created >= startDate && created <= endDate)) continue;

          for (const item of order.items || []) {
            const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
            const breakdown = calculateTaxBreakdown({
              amount: itemTotal,
              category: item.category || item.Kategori || 'UMUM',
              taxSettings: currentTaxSettings
            });

            records.push({
              id: `${docSnap.id}_${item.id || item.productId}`,
              orderId: order.orderId || docSnap.id,
              date: created.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
              customerName: order.customerName || 'Pelanggan Umum',
              productName: item.name || 'Produk',
              category: item.category || item.Kategori || 'UMUM',
              totalSales: itemTotal,
              dpp: breakdown.dpp,
              taxAmount: breakdown.taxAmount,
              effectiveRate: breakdown.effectiveRate,
              isExempt: breakdown.isExempt,
              taxLabel: breakdown.taxLabel
            });
          }
        }

        setTaxRecords(records);
      } catch (err) {
        console.error(err);
        notify.error('Gagal memuat laporan pajak');
      } finally {
        setLoading(false);
      }
    };

    fetchTaxData();
  }, [authLoading, dateRange]);

  const summary = useMemo(() => {
    const totalOmzet = taxRecords.reduce((s, r) => s + r.totalSales, 0);
    const totalDPP = taxRecords.reduce((s, r) => s + r.dpp, 0);
    const totalPajak = taxRecords.reduce((s, r) => s + r.taxAmount, 0);
    const totalSembakoExempt = taxRecords.filter(r => r.isExempt).reduce((s, r) => s + r.totalSales, 0);
    const totalTaxable = taxRecords.filter(r => !r.isExempt).reduce((s, r) => s + r.totalSales, 0);
    return { totalOmzet, totalDPP, totalPajak, totalSembakoExempt, totalTaxable };
  }, [taxRecords]);

  const handleExportSTPCortex = () => {
    const rows = taxRecords.map((r, idx) => ({
      'No. Urut': idx + 1,
      'No. Faktur / Nota': r.orderId,
      'Tanggal': r.date,
      'Nama Pembeli': r.customerName,
      'Nama Barang / Jasa': r.productName,
      'Kategori': r.category,
      'Nilai Perolehan / Omzet (Rp)': r.totalSales,
      'Dasar Pengenaan Pajak - DPP (Rp)': r.dpp,
      'PPN / PPh Terutang (Rp)': r.taxAmount,
      'Tarif Pajak Efektif (%)': `${r.effectiveRate}%`,
      'Status Fasilitas Pajak': r.isExempt ? 'Bebas PPN (0% Sembako PP 49/2022)' : r.taxLabel,
      'Kode Objek Pajak': r.isExempt ? '08 (Bebas PPN)' : '01 (Penyerahan BKP Normal)'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SPT_Cortex_Pajak');
    XLSX.writeFile(wb, `Laporan_STP_Cortex_Pajak_${dateRange.startDate}_sd_${dateRange.endDate}.xlsx`);
    notify.success('File Laporan STP Cortex berhasil didownload!');
  };

  if (loading) return <div className="p-8 font-black text-xs animate-pulse text-center">Memuat Laporan Pajak STP Cortex...</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen font-sans text-slate-900">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Receipt size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Laporan Pajak Resmi (STP Cortex / PPN & PPh)
              </h1>
              <p className="text-xs font-bold text-slate-400 mt-0.5">
                Rekapitulasi DPP, PPN 11%, dan PPh Final 0,5% sesuai UU HPP & PP 49/2022.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              className="text-xs font-bold bg-transparent outline-none text-slate-700"
              value={dateRange.startDate}
              onChange={e => setDateRange({ ...dateRange, startDate: e.target.value })}
            />
            <span className="text-slate-300 font-bold">-</span>
            <input
              type="date"
              className="text-xs font-bold bg-transparent outline-none text-slate-700"
              value={dateRange.endDate}
              onChange={e => setDateRange({ ...dateRange, endDate: e.target.value })}
            />
          </div>

          <button
            onClick={handleExportSTPCortex}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-100 transition-all active:scale-95"
          >
            <FileSpreadsheet size={16} /> Export Format STP Cortex
          </button>
        </div>
      </div>

      {/* Mode Tax Alert Badge */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl ${taxSettings.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status Pengenaan Pajak Toko</span>
            <h3 className="text-base font-black text-slate-800">
              {taxSettings.enabled
                ? (taxSettings.mode === 'PT_PKP' ? '🏢 PT / Badan Usaha (PKP PPN 11%)' : '👤 Perorangan / UMKM (PPh Final 0.5%)')
                : '⚪ Pengenaan Pajak Toko Non-Aktif'}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <HelpCircle size={14} className="text-indigo-600" />
          <span>Format Ekspor Siap Di-upload ke Portal Pajak DJP Online / Cortex</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Perolehan (Omzet)</p>
          <p className="text-2xl font-black text-slate-900 tracking-tight">Rp {summary.totalOmzet.toLocaleString('id-ID')}</p>
          <p className="text-[10px] text-slate-400 font-bold mt-2">Seluruh transaksi selesai</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dasar Pengenaan Pajak (DPP)</p>
          <p className="text-2xl font-black text-blue-600 tracking-tight">Rp {summary.totalDPP.toLocaleString('id-ID')}</p>
          <p className="text-[10px] text-slate-400 font-bold mt-2">Nilai bersih sebelum PPN</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Pajak Terutang</p>
          <p className="text-2xl font-black text-emerald-600 tracking-tight">Rp {summary.totalPajak.toLocaleString('id-ID')}</p>
          <p className="text-[10px] text-slate-400 font-bold mt-2">PPN 11% / PPh Final 0,5%</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bebas PPN (Sembako 0%)</p>
          <p className="text-2xl font-black text-amber-600 tracking-tight">Rp {summary.totalSembakoExempt.toLocaleString('id-ID')}</p>
          <p className="text-[10px] text-slate-400 font-bold mt-2">PP No. 49/2022 (Sembako)</p>
        </div>
      </div>

      {/* Detail Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <FileText size={16} className="text-indigo-600" /> Rincian Faktur & Penyerahan Pajak
          </h3>
          <span className="text-xs font-bold text-slate-400">{taxRecords.length} Transaksi terdata</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <tr>
                <th className="p-4 pl-6">Waktu / No. Nota</th>
                <th className="p-4">Pembeli</th>
                <th className="p-4">Produk & Kategori</th>
                <th className="p-4 text-right">Nilai Transaksi</th>
                <th className="p-4 text-right">DPP (Bersih)</th>
                <th className="p-4 text-right">Nilai Pajak</th>
                <th className="p-4 text-center pr-6">Status Pajak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-bold">
              {taxRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    Tidak ada transaksi dalam periode tanggal ini.
                  </td>
                </tr>
              ) : (
                taxRecords.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 pl-6">
                      <p className="text-slate-800 font-black">{r.orderId}</p>
                      <p className="text-[10px] text-slate-400 font-normal">{r.date}</p>
                    </td>
                    <td className="p-4 text-slate-700">{r.customerName}</td>
                    <td className="p-4">
                      <p className="text-slate-800 font-black">{r.productName}</p>
                      <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-bold">{r.category}</span>
                    </td>
                    <td className="p-4 text-right text-slate-900 font-black">Rp {r.totalSales.toLocaleString('id-ID')}</td>
                    <td className="p-4 text-right text-blue-600 font-black">Rp {r.dpp.toLocaleString('id-ID')}</td>
                    <td className="p-4 text-right text-emerald-600 font-black">Rp {r.taxAmount.toLocaleString('id-ID')}</td>
                    <td className="p-4 text-center pr-6">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider ${r.isExempt ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                        {r.taxLabel}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
