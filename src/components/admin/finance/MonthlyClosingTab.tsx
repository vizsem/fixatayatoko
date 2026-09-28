'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarCheck, Lock, CheckCircle2, AlertTriangle, ShieldCheck,
  TrendingUp, TrendingDown, DollarSign, Package, Wallet, ArrowRight,
  History, RotateCcw, FileText, Check, ChevronRight, AlertCircle, RefreshCw,
  Printer, Download
} from 'lucide-react';
import notify from '@/lib/notify';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { postJournal } from '@/lib/ledger';

interface MonthlyClosingTabProps {
  incomeStatement: {
    salesRev: number;
    ongkir: number;
    returns: number;
    netRevenue: number;
    cogs: number;
    grossProfit: number;
    opex: number;
    stockPurchases: number;
    netIncome: number;
    grossMargin: number;
    netMargin: number;
  };
  cashflow: {
    closingBalance: number;
    totalIn: number;
    totalOut: number;
    netCash: number;
  };
  inventoryValue: number;
  currentDateRange: {
    startDate: string;
    endDate: string;
  };
  onRefreshParent: () => void;
}

interface ClosingArchive {
  id: string;
  periodKey: string; // e.g. "2026-09"
  periodLabel: string; // e.g. "September 2026"
  closedAt: string;
  closedBy: string;
  netRevenue: number;
  cogs: number;
  opex: number;
  netIncome: number;
  closingCash: number;
  closingInventory: number;
  totalAssets: number;
  retainedEarningsTransfer: number;
  status: 'LOCKED';
  notes?: string;
}

export default function MonthlyClosingTab({
  incomeStatement: IS,
  cashflow: CF,
  inventoryValue,
  currentDateRange,
  onRefreshParent,
}: MonthlyClosingTabProps) {
  const [loading, setLoading] = useState(true);
  const [closingArchives, setClosingArchives] = useState<ClosingArchive[]>([]);
  const [executing, setExecuting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [adminEmail, setAdminEmail] = useState('admin');

  // Determine period from date range
  const period = useMemo(() => {
    const end = new Date(currentDateRange.endDate);
    const y = end.getFullYear();
    const m = String(end.getMonth() + 1).padStart(2, '0');
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return {
      key: `${y}-${m}`,
      label: `${monthNames[end.getMonth()]} ${y}`,
      year: y,
      month: end.getMonth() + 1,
      nextMonthLabel: `${monthNames[(end.getMonth() + 1) % 12]} ${end.getMonth() === 11 ? y + 1 : y}`,
    };
  }, [currentDateRange.endDate]);

  // Check if current period is already locked
  const isPeriodClosed = useMemo(() => {
    return closingArchives.some(a => a.periodKey === period.key);
  }, [closingArchives, period.key]);

  const currentPeriodArchive = useMemo(() => {
    return closingArchives.find(a => a.periodKey === period.key);
  }, [closingArchives, period.key]);

  // Load archives
  const fetchArchives = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (userRes.user?.email) setAdminEmail(userRes.user.email);

      const { data, error } = await supabaseAdmin
        .from('settings')
        .select('*')
        .eq('key', 'monthly_closings_history')
        .maybeSingle();

      if (data && data.raw_data && Array.isArray(data.raw_data.items)) {
        setClosingArchives(data.raw_data.items);
      } else {
        setClosingArchives([]);
      }
    } catch (err) {
      console.warn('Gagal membaca riwayat tutup buku:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArchives();
  }, [fetchArchives]);

  // Execute closing
  const handleExecuteClosing = async () => {
    setExecuting(true);
    try {
      const now = new Date().toISOString();
      const newArchive: ClosingArchive = {
        id: `close_${period.key}_${Date.now()}`,
        periodKey: period.key,
        periodLabel: period.label,
        closedAt: now,
        closedBy: adminEmail,
        netRevenue: IS.netRevenue,
        cogs: IS.cogs,
        opex: IS.opex,
        netIncome: IS.netIncome,
        closingCash: CF.closingBalance,
        closingInventory: inventoryValue,
        totalAssets: CF.closingBalance + inventoryValue,
        retainedEarningsTransfer: IS.netIncome,
        status: 'LOCKED',
        notes: closingNotes || `Tutup buku akhir bulan ${period.label} selesai dengan sukses.`,
      };

      // 1. Post Closing Jurnals to double-entry ledger
      if (IS.netIncome !== 0) {
        // Jurnal penutup: pindahkan laba/rugi ke Capital (Modal/Laba Ditahan)
        await postJournal({
          debitAccount: IS.netIncome >= 0 ? 'Sales' : 'Capital',
          creditAccount: IS.netIncome >= 0 ? 'Capital' : 'COGS',
          amount: Math.abs(IS.netIncome),
          memo: `Jurnal Penutup Periode ${period.label}: Pemindahan Laba/Rugi Bersih ke Modal/Laba Ditahan`,
          refType: 'MONTHLY_CLOSING',
          refId: newArchive.id,
          postedBy: adminEmail,
        });
      }

      // 2. Save archive into settings table
      const updatedList = [newArchive, ...closingArchives.filter(a => a.periodKey !== period.key)];
      
      const { data: existing } = await supabaseAdmin
        .from('settings')
        .select('id')
        .eq('key', 'monthly_closings_history')
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from('settings')
          .update({
            raw_data: { items: updatedList, updatedAt: now },
            updated_at: now,
          })
          .eq('key', 'monthly_closings_history');
      } else {
        await supabaseAdmin
          .from('settings')
          .insert({
            id: `set_monthly_closings_${Date.now()}`,
            key: 'monthly_closings_history',
            raw_data: { items: updatedList, createdAt: now, updatedAt: now },
            created_at: now,
            updated_at: now,
          });
      }

      setClosingArchives(updatedList);
      setShowConfirmModal(false);
      setClosingNotes('');
      notify.success(`Buku bulan ${period.label} resmi DITUTUP! Saldo akhir telah dikunci sebagai Saldo Awal 1 ${period.nextMonthLabel}.`);
      onRefreshParent();
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'Gagal menjalankan tutup buku.');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* BANNER STATUS PERIODE */}
      <div className={`p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isPeriodClosed
          ? 'bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border-emerald-800 text-white'
          : 'bg-white border-slate-100 text-slate-900'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1.5 ${
              isPeriodClosed
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {isPeriodClosed ? <Lock size={12} /> : <CalendarCheck size={12} />}
              {isPeriodClosed ? `TERKUNCI & SUDAH DITUTUP` : `PERIODE BERJALAN (BELUM DITUTUP)`}
            </span>
            <span className="text-xs font-bold text-slate-400">Periode: {period.label}</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight">
            Transisi Tanggal 1 & Penutupan Buku Akhir Bulan
          </h2>
          <p className={`text-xs md:text-sm font-bold ${isPeriodClosed ? 'text-slate-300' : 'text-slate-500'}`}>
            Jembatan tutup buku: menolkan akun sementara (Pendapatan & Beban), memindahkan laba ke Modal, serta mengunci Saldo Awal resmi per 1 {period.nextMonthLabel}.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!isPeriodClosed ? (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-200"
            >
              <Lock size={15} />
              Tutup Buku Bulan Ini
            </button>
          ) : (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-black flex items-center gap-2">
              <CheckCircle2 size={16} />
              Ditutup oleh {currentPeriodArchive?.closedBy}
            </div>
          )}
        </div>
      </div>

      {/* 3 TAHAPAN VISUAL AKUNTANSI DAGANG */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* LANGKAH 1 */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 font-black flex items-center justify-center text-sm shadow-sm">
            1
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Jurnal Penutup (Akhir Bulan)</h3>
            <p className="text-xs text-slate-400 font-bold mt-0.5">Akun nominal pendapatan & beban dinolkan (0)</p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-bold">Total Pendapatan:</span>
              <span className="font-black text-slate-900">Rp {IS.netRevenue.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-bold">Beban Pokok (HPP):</span>
              <span className="font-black text-rose-600">-Rp {IS.cogs.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-bold">Beban Operasional:</span>
              <span className="font-black text-rose-600">-Rp {IS.opex.toLocaleString('id-ID')}</span>
            </div>
            <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between items-center font-black">
              <span className="text-slate-700">Laba Bersih Ditransfer:</span>
              <span className={IS.netIncome >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                {IS.netIncome >= 0 ? '+' : ''}Rp {IS.netIncome.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl text-[11px] font-bold text-slate-500 leading-relaxed">
            💡 Saldo laba bersih dipindahkan ke akun <strong>Modal / Laba Ditahan</strong> sehingga di bulan baru akun pendapatan & beban mulai dari angka <strong>0</strong>.
          </div>
        </div>

        {/* LANGKAH 2 */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 font-black flex items-center justify-center text-sm shadow-sm">
            2
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Neraca Saldo Penutupan</h3>
            <p className="text-xs text-slate-400 font-bold mt-0.5">Hanya menyisakan akun-akun riil (Aset, Kas, Stok)</p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-bold">Kas & Bank Akhir:</span>
              <span className="font-black text-emerald-700">Rp {CF.closingBalance.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-bold">Persediaan Akhir (Stok):</span>
              <span className="font-black text-blue-700">Rp {inventoryValue.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-bold">Kewajiban / Utang Usaha:</span>
              <span className="font-black text-slate-600">Rp 0</span>
            </div>
            <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between items-center font-black">
              <span className="text-slate-700">Total Aset Riil Akhir:</span>
              <span className="text-slate-900">Rp {(CF.closingBalance + inventoryValue).toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl text-[11px] font-bold text-slate-500 leading-relaxed">
            🛡️ Akun-akun riil ini tidak dinolkan. Saldo inilah yang menjadi kekayaan bersih riil toko Anda di penutupan buku.
          </div>
        </div>

        {/* LANGKAH 3 */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 font-black flex items-center justify-center text-sm shadow-sm">
            3
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Mulai Baru di Tanggal 1</h3>
            <p className="text-xs text-slate-400 font-bold mt-0.5">Otomatis menjadi Saldo Awal bulan berikutnya</p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-bold">Saldo Awal Kas (1 {period.nextMonthLabel}):</span>
              <span className="font-black text-emerald-700">Rp {CF.closingBalance.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-bold">Persediaan Awal Bulan Baru:</span>
              <span className="font-black text-blue-700">Rp {inventoryValue.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-bold">Pendapatan Awal (1 {period.nextMonthLabel}):</span>
              <span className="font-black text-slate-400">Rp 0 (Reset Baru)</span>
            </div>
            <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between items-center font-black">
              <span className="text-slate-700">Status Siklus Baru:</span>
              <span className="text-emerald-600 uppercase tracking-widest text-[11px]">Siap Berjalan ✅</span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl text-[11px] font-bold leading-relaxed border border-emerald-100">
            ✨ Siklus akuntansi kembali berputar ke Tahap 1. Rumus HPP bulan depan akan menggunakan angka Persediaan Awal ini!
          </div>
        </div>

      </div>

      {/* RIWAYAT PENUTUPAN BUKU (ARCHIVES) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900">Arsip Penutupan Buku Bulanan</h3>
            <p className="text-xs text-slate-400 font-bold">Daftar periode yang telah resmi dikunci dan dibukukan.</p>
          </div>
          <button
            onClick={fetchArchives}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
            title="Refresh Arsip"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {closingArchives.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-2xl">
            Belum ada arsip penutupan buku bulanan. Klik tombol "Tutup Buku Bulan Ini" di atas untuk membuat penutupan pertama.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-widest font-black">
                  <th className="py-3 px-4">Periode Bulan</th>
                  <th className="py-3 px-4">Tanggal Ditutup</th>
                  <th className="py-3 px-4 text-right">Pendapatan Bersih</th>
                  <th className="py-3 px-4 text-right">HPP (Modal Terjual)</th>
                  <th className="py-3 px-4 text-right">Laba Bersih Ditutup</th>
                  <th className="py-3 px-4 text-right">Saldo Kas Awal Baru</th>
                  <th className="py-3 px-4 text-right">Persediaan Awal Baru</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {closingArchives.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-4 font-black text-slate-900">
                      {a.periodLabel}
                    </td>
                    <td className="py-4 px-4 text-slate-500 font-bold">
                      <p>{new Date(a.closedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      <span className="text-[10px] text-slate-400 font-mono">By: {a.closedBy}</span>
                    </td>
                    <td className="py-4 px-4 text-right font-black text-slate-800">
                      Rp {a.netRevenue.toLocaleString('id-ID')}
                    </td>
                    <td className="py-4 px-4 text-right font-black text-rose-600">
                      Rp {a.cogs.toLocaleString('id-ID')}
                    </td>
                    <td className="py-4 px-4 text-right font-black text-emerald-600">
                      +{a.netIncome.toLocaleString('id-ID')}
                    </td>
                    <td className="py-4 px-4 text-right font-black text-emerald-700">
                      Rp {a.closingCash.toLocaleString('id-ID')}
                    </td>
                    <td className="py-4 px-4 text-right font-black text-blue-700">
                      Rp {a.closingInventory.toLocaleString('id-ID')}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-200">
                        <Lock size={10} /> Terkunci
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL KONFIRMASI TUTUP BUKU */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="p-3 bg-emerald-50 rounded-2xl">
                <Lock size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Konfirmasi Tutup Buku {period.label}</h3>
                <p className="text-xs text-slate-400 font-bold">Pastikan seluruh transaksi kas & stok bulan ini sudah final.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
              <p className="font-black text-slate-700 uppercase tracking-wide">Ringkasan yang Akan Dikunci:</p>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-bold">Laba Bersih Bulan Ini:</span>
                <span className="font-black text-emerald-600">Rp {IS.netIncome.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-bold">Saldo Akhir Kas & Bank:</span>
                <span className="font-black text-slate-900">Rp {CF.closingBalance.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-bold">Nilai Persediaan Akhir:</span>
                <span className="font-black text-slate-900">Rp {inventoryValue.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-bold">Akan Menjadi Saldo Awal:</span>
                <span className="font-black text-blue-700">1 {period.nextMonthLabel}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-slate-400">Catatan Penutupan Buku (Opsional)</label>
              <textarea
                rows={2}
                value={closingNotes}
                onChange={e => setClosingNotes(e.target.value)}
                placeholder="Misal: Seluruh rekonsiliasi kasir dan opname stok fisik akhir bulan telah tuntas..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={executing}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteClosing}
                disabled={executing}
                className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-emerald-200 disabled:opacity-50"
              >
                {executing ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                Kunci & Selesaikan Tutup Buku
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
