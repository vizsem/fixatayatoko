'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Landmark,
  Wallet,
  CreditCard,
  Banknote,
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  PlusCircle,
  FileSpreadsheet,
  CheckCircle2,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { getCapitalData } from '@/lib/actions/capital.actions';
import notify from '@/lib/notify';

export default function FinanceHubPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getCapitalData();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        notify.admin.error('Gagal memuat ringkasan keuangan');
      }
    } catch (err) {
      console.error(err);
      notify.admin.error('Terjadi kesalahan saat memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const capital = data?.capitalSummary || {};
  const asset = data?.assetSummary || {};
  const mpAccounts = data?.marketplaceAccounts || [];
  const transactions = (data?.transactions || []).slice(0, 8);

  const totalMpActive = mpAccounts.reduce((sum: number, a: any) => sum + (Number(a.activeBalance) || 0), 0);
  const totalMpPending = mpAccounts.reduce((sum: number, a: any) => sum + (Number(a.pendingBalance) || 0), 0);
  const totalCashBank = Number(capital.cashBalance || 0);
  const totalModal = Number(capital.balance || 0);

  return (
    <div className="p-3 md:p-6 space-y-6 max-w-7xl mx-auto font-sans pb-28 md:pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Landmark size={20} />
            </span>
            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
              Pusat Keuangan & Kas Toko
            </h1>
          </div>
          <p className="text-xs font-bold text-gray-500">
            Monitoring arus kas terpadu, modal aktif, saldo marketplace, dan biaya operasional
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 rounded-2xl text-xs font-black uppercase tracking-wider transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>
          <Link
            href="/admin/capital"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-600/20 transition-all"
          >
            <PlusCircle size={14} />
            <span>Kelola Modal</span>
          </Link>
        </div>
      </div>

      {/* 4 Kartu Metrik Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Kas & Bank */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-3xl shadow-lg shadow-emerald-900/10 relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Kas & Bank Tersedia</span>
            <span className="p-2 bg-white/10 rounded-xl">
              <Banknote size={18} />
            </span>
          </div>
          <p className="text-2xl font-black tracking-tight mb-1">
            Rp {loading ? '...' : totalCashBank.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-emerald-100/90 font-medium">Saldo kas operasional siap pakai</p>
        </div>

        {/* Modal Aktif */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Modal Usaha</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Wallet size={18} />
            </span>
          </div>
          <p className="text-2xl font-black text-gray-900 tracking-tight mb-1">
            Rp {loading ? '...' : totalModal.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-gray-500 font-medium">Total modal disetor & akumulasi</p>
        </div>

        {/* Saldo Marketplace */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dompet Marketplace</span>
            <span className="p-2 bg-orange-50 text-orange-600 rounded-xl">
              <CreditCard size={18} />
            </span>
          </div>
          <p className="text-2xl font-black text-gray-900 tracking-tight mb-1">
            Rp {loading ? '...' : totalMpActive.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-orange-600 font-bold">
            + Rp {loading ? '...' : totalMpPending.toLocaleString('id-ID')} tertahan
          </p>
        </div>

        {/* Nilai Persediaan */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nilai Aset Stok</span>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileSpreadsheet size={18} />
            </span>
          </div>
          <p className="text-2xl font-black text-gray-900 tracking-tight mb-1">
            Rp {loading ? '...' : Number(asset.stockValue || 0).toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-gray-500 font-medium">
            {loading ? '...' : Number(asset.totalStockUnits || 0).toLocaleString('id-ID')} unit barang aktif
          </p>
        </div>
      </div>

      {/* 4 Pilar Navigasi Cepat Keuangan */}
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3 px-1">
          Modul Keuangan Terintegrasi
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/capital"
            className="group bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Wallet size={20} />
              </div>
              <h3 className="font-black text-sm text-gray-900 mb-1">Modal & Aset Toko</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Kelola setoran modal pemilik, kas kecil, dan saldo dompet marketplace.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-black text-blue-600 mt-4">
              <span>Buka Modal</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            href="/admin/operational-expenses"
            className="group bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-rose-200 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Banknote size={20} />
              </div>
              <h3 className="font-black text-sm text-gray-900 mb-1">Biaya & Pengeluaran</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Catat pengeluaran harian, listrik, sewa, bensin, dan perlengkapan warung.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-black text-rose-600 mt-4">
              <span>Catat Biaya</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            href="/admin/finance/bank-reconciliation"
            className="group bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <CreditCard size={20} />
              </div>
              <h3 className="font-black text-sm text-gray-900 mb-1">Rekonsiliasi Bank</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Pencocokan mutasi rekening bank BCA/Mandiri/BRI dengan sistem.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-black text-emerald-600 mt-4">
              <span>Cek Rekonsiliasi</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            href="/admin/reports/finance"
            className="group bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <BarChart3 size={20} />
              </div>
              <h3 className="font-black text-sm text-gray-900 mb-1">Laporan Laba & Rugi</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Analisa laba kotor, HPP, margin per kategori, dan laba bersih bulanan.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-black text-indigo-600 mt-4">
              <span>Lihat Laporan</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>

      {/* Saldo Akun Marketplace & Mutasi Terakhir */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Marketplace Balances */}
        <div className="bg-white p-5 md:p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">
              Integrasi Saldo Marketplace
            </h3>
            <span className="text-[10px] font-bold text-gray-400">{mpAccounts.length} Akun</span>
          </div>
          {mpAccounts.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">Belum ada akun marketplace terhubung.</p>
          ) : (
            <div className="space-y-3">
              {mpAccounts.map((acc: any) => (
                <div key={acc.id} className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-gray-800">{acc.name} {acc.storeName ? `(${acc.storeName})` : ''}</p>
                    <p className="text-[10px] text-gray-400">Tertahan: Rp {Number(acc.pendingBalance || 0).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-emerald-600">Rp {Number(acc.activeBalance || 0).toLocaleString('id-ID')}</p>
                    <span className="text-[9px] font-bold text-gray-400">Siap Tarik</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Riwayat Mutasi Modal Terakhir */}
        <div className="lg:col-span-2 bg-white p-5 md:p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">
              Mutasi Modal Terakhir
            </h3>
            <Link href="/admin/capital" className="text-xs font-black text-blue-600 hover:underline">
              Lihat Semua
            </Link>
          </div>
          {transactions.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">Belum ada riwayat transaksi modal.</p>
          ) : (
            <div className="divide-y divide-gray-50 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    <th className="pb-3">Tipe</th>
                    <th className="pb-3">Keterangan</th>
                    <th className="pb-3 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs">
                  {transactions.map((tx: any) => {
                    const isMasuk = tx.type === 'DEPOSIT' || tx.type === 'IN' || tx.type === 'INITIAL';
                    return (
                      <tr key={tx.id} className="hover:bg-gray-50/50">
                        <td className="py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                            isMasuk ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {isMasuk ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-2.5 font-medium text-gray-700 max-w-[200px] truncate">
                          {tx.description || tx.note || '-'}
                        </td>
                        <td className={`py-2.5 text-right font-black ${isMasuk ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isMasuk ? '+' : '-'} Rp {Number(tx.amount || 0).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
