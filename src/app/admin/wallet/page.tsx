'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  AlertTriangle,
  History,
  Loader2,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  User as UserIcon,
  Users,
  Wallet,
} from 'lucide-react';

import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

import { getAccessToken } from '@/lib/auth-client';
import { adjustWallet, getWalletDashboard } from '@/lib/actions/loyalty.actions';
import {
  formatRupiah,
  formatSignedRupiah,
  ledgerTypeLabel,
  type LedgerSummary,
  type WalletLedgerUser,
  type WalletLog,
} from '@/lib/loyalty';

/**
 * Halaman admin pengendalian saldo dompet.
 *
 * Perubahan dari versi sebelumnya:
 *   - seluruh pembacaan/penulisan dipindahkan ke Server Action
 *     (`src/lib/actions/loyalty.actions.ts`)
 *   - penyesuaian saldo kini atomik. Versi lama membaca saldo, menghitung di
 *     browser, lalu menulis nilai absolut — pola yang kehilangan pembaruan bila
 *     dua admin mengubah saldo bersamaan. Sekarang pengecekan saldo dan
 *     penulisan ledger terjadi di dalam satu transaksi di basis data.
 *   - `onSnapshot` (Realtime) diganti tombol "Muat Ulang" plus pemuatan ulang
 *     otomatis setelah setiap perubahan.
 */

interface AdjustForm {
  userId: string;
  amount: number;
  reason: string;
  kind: 'TOPUP_ADMIN' | 'WITHDRAW_ADMIN';
}

const EMPTY_FORM: AdjustForm = { userId: '', amount: 0, reason: '', kind: 'TOPUP_ADMIN' };
const EMPTY_STATS: LedgerSummary = { totalIn: 0, totalOut: 0, circulating: 0 };

function formatLogTime(iso: string | null): string {
  if (!iso) return '...';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '...';
  return format(date, 'dd MMM HH:mm', { locale: localeID });
}

export default function AdminWalletDashboard() {
  const [logs, setLogs] = useState<WalletLog[]>([]);
  const [topUsers, setTopUsers] = useState<WalletLedgerUser[]>([]);
  const [stats, setStats] = useState<LedgerSummary>(EMPTY_STATS);
  const [schemaReady, setSchemaReady] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adjustData, setAdjustData] = useState<AdjustForm>(EMPTY_FORM);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'refresh') => {
    if (mode === 'initial') setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const token = await getAccessToken();
      const result = await getWalletDashboard(token);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setLogs(result.data.logs);
      setTopUsers(result.data.topUsers);
      setStats(result.data.stats);
      setSchemaReady(result.data.schemaReady);
    } catch {
      toast.error('Gagal memuat data dompet.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load('initial');
  }, [load]);

  const handleAdjustment = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const token = await getAccessToken();
      const result = await adjustWallet(token, adjustData);

      if (!result.ok) {
        toast.error(result.message);
        if (result.code === 'SCHEMA_NOT_READY') setSchemaReady(false);
        return;
      }

      toast.success(`Saldo diperbarui. Saldo baru: ${formatRupiah(result.data.newBalance)}`);
      setShowModal(false);
      setAdjustData(EMPTY_FORM);
      await load();
    } catch {
      toast.error('Gagal memproses data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyUid = async (uid: string) => {
    try {
      await navigator.clipboard.writeText(uid);
      toast.success('UID Berhasil disalin!');
    } catch {
      toast.error('Gagal menyalin UID.');
    }
  };

  return (
    <div className="p-3 md:p-4 bg-gray-50 min-h-screen font-sans text-black">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Wallet size={22} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Digital Wallet Control</h1>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Audit &amp; Manajemen Saldo</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void load()}
              disabled={isRefreshing}
              title="Muat ulang data"
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:border-black hover:text-black disabled:opacity-50"
            >
              {isRefreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Muat Ulang
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg"
            >
              <AlertTriangle size={16} /> Penyesuaian Manual
            </button>
          </div>
        </div>

        {!schemaReady && (
          <div className="mb-8 flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-900 p-5 rounded-2xl">
            <AlertTriangle size={20} className="mt-0.5 flex-shrink-0" />
            <div className="text-xs font-bold leading-relaxed">
              <p className="uppercase tracking-widest mb-1">Basis data belum siap</p>
              <p className="font-medium normal-case">
                Fungsi transaksi saldo belum ada, sehingga penyesuaian tidak akan tersimpan secara atomik.
                Jalankan <span className="font-mono">supabase/migrations/20261002_loyalty_wallet_hardening.sql</span> di
                Supabase SQL Editor, lalu muat ulang halaman ini.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 text-white">
          <div className="bg-black p-5 md:p-6 rounded-[2rem] shadow-xl relative overflow-hidden">
            <Wallet className="absolute right-[-10px] bottom-[-10px] text-white/10" size={100} />
            <p className="text-xs font-black uppercase tracking-widest opacity-60 mb-2">Total Dana Masuk</p>
            <h2 className="text-3xl md:text-4xl font-black italic">{formatRupiah(stats.totalIn)}</h2>
          </div>
          <div className="bg-white text-black border border-gray-100 p-5 md:p-6 rounded-[2rem] shadow-sm">
            <p className="text-xs font-black uppercase text-gray-400 mb-2 tracking-widest">Total Dana Keluar</p>
            <h2 className="text-3xl md:text-4xl font-black italic text-red-600">{formatRupiah(stats.totalOut)}</h2>
          </div>
          <div className="bg-blue-600 p-5 md:p-6 rounded-[2rem] shadow-lg">
            <p className="text-xs font-black uppercase tracking-widest opacity-60 mb-2">Saldo Aktif Beredar</p>
            <h2 className="text-3xl md:text-4xl font-black italic">{formatRupiah(stats.circulating)}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h3 className="text-xs font-black uppercase mb-6 flex items-center gap-2 border-b pb-4 tracking-widest text-blue-600">
              <Users size={16} /> Pengguna Saldo Teratas
            </h3>
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-gray-400">
                  <Loader2 className="animate-spin" size={20} />
                </div>
              ) : topUsers.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-xs font-bold uppercase">
                  Belum ada pengguna
                </div>
              ) : (
                topUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 rounded-2xl border bg-gray-50 border-transparent">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center bg-white text-gray-400">
                        <UserIcon size={18} />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-black uppercase truncate">{user.displayName}</p>
                        <button
                          type="button"
                          className="flex items-center gap-1 cursor-pointer group text-left"
                          onClick={() => void copyUid(user.id)}
                        >
                          <p className="text-xs font-bold text-blue-500 uppercase font-mono tracking-tighter truncate">
                            UID: {user.id}
                          </p>
                          <span className="text-xs bg-blue-100 text-blue-600 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Copy</span>
                        </button>
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <p className="text-xs font-black text-blue-600">{formatRupiah(user.walletBalance)}</p>
                      <p className="text-xs font-bold text-gray-300 uppercase italic">Saldo</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-7 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h3 className="text-xs font-black uppercase mb-6 flex items-center gap-2 tracking-widest">
              <History size={16} className="text-gray-400" /> Riwayat Transaksi Dompet
            </h3>
            <div className="overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {logs.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-xs font-bold uppercase">
                    Belum ada riwayat transaksi
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <div className="flex justify-between items-start mb-2">
                         <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">
                              {formatLogTime(log.createdAt)}
                            </p>
                            <p className="text-xs font-black uppercase mt-0.5">UID: {log.userId?.slice(0, 8)}</p>
                         </div>
                         <div className={`font-black text-xs ${log.amountChanged > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatSignedRupiah(log.amountChanged)}
                         </div>
                      </div>

                      <div className="space-y-2">
                         <span className={`inline-block px-2 py-0.5 rounded text-xs font-black uppercase tracking-tighter ${
                            log.amountChanged > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                          }`}>
                            {ledgerTypeLabel(log.type)}
                         </span>
                         <p className="text-xs text-gray-600 font-bold uppercase italic leading-tight">{log.description}</p>
                         {log.orderId && <p className="text-xs text-blue-500 font-mono">Order: {log.orderId}</p>}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table View */}
              <table className="hidden md:table w-full">
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="group">
                      <td className="py-4">
                        <p className="text-xs font-bold text-gray-400 uppercase">
                          {formatLogTime(log.createdAt)}
                        </p>
                        <p className="text-xs font-black uppercase">UID: {log.userId?.slice(0, 8)}</p>
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-black uppercase tracking-tighter ${
                          log.amountChanged > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {ledgerTypeLabel(log.type)}
                        </span>
                        <p className="text-xs text-gray-400 font-bold mt-1 uppercase italic leading-tight">{log.description}</p>
                        {log.orderId && <p className="text-xs text-blue-500 font-mono mt-1">Order: {log.orderId}</p>}
                      </td>
                      <td className="py-4 text-right">
                        <div className={`font-black text-xs ${log.amountChanged > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatSignedRupiah(log.amountChanged)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl scale-in-center">
              <h2 className="text-xl font-black uppercase italic mb-6">Penyesuaian Saldo</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="target-user-id-wallet" className="text-xs font-black uppercase text-gray-400">Target User ID</label>
                  <input
                    id="target-user-id-wallet"
                    type="text"
                    className="w-full p-4 bg-gray-50 rounded-2xl mt-1 font-bold outline-none border-2 border-transparent focus:border-black"
                    placeholder="Tempel UID (format UUID)..."
                    value={adjustData.userId}
                    onChange={(e) => setAdjustData({ ...adjustData, userId: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setAdjustData({ ...adjustData, kind: 'TOPUP_ADMIN' })}
                    className={`p-4 rounded-2xl font-black text-xs uppercase border-2 transition-all ${adjustData.kind === 'TOPUP_ADMIN' ? 'bg-green-50 border-green-600 text-green-600' : 'border-gray-100 text-gray-400'}`}>
                    <PlusCircle className="mx-auto mb-1" size={18} /> Top-up
                  </button>
                  <button onClick={() => setAdjustData({ ...adjustData, kind: 'WITHDRAW_ADMIN' })}
                    className={`p-4 rounded-2xl font-black text-xs uppercase border-2 transition-all ${adjustData.kind === 'WITHDRAW_ADMIN' ? 'bg-red-50 border-red-600 text-red-600' : 'border-gray-100 text-gray-400'}`}>
                    <MinusCircle className="mx-auto mb-1" size={18} /> Penarikan
                  </button>
                </div>
                <div>
                  <label htmlFor="nominal-wallet" className="text-xs font-black uppercase text-gray-400">Nominal (Rp)</label>
                  <input id="nominal-wallet" type="number" className="w-full p-4 bg-gray-50 rounded-2xl mt-1 font-black outline-none" placeholder="0"
                    value={adjustData.amount || ''}
                    onChange={(e) => setAdjustData({ ...adjustData, amount: Number(e.target.value) })} />
                </div>
                <div>
                  <label htmlFor="adjustment-reason-wallet" className="text-xs font-black uppercase text-gray-400">Alasan Penyesuaian</label>
                  <textarea id="adjustment-reason-wallet" className="w-full p-4 bg-gray-50 rounded-2xl mt-1 font-bold outline-none resize-none" rows={3}
                    placeholder="Contoh: Koreksi saldo..."
                    value={adjustData.reason}
                    onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })} />
                </div>
                <div className="flex gap-4 mt-6">
                  <button onClick={() => setShowModal(false)} className="flex-1 p-4 font-black text-xs uppercase text-gray-400 hover:text-black">Batal</button>
                  <button
                    onClick={() => void handleAdjustment()}
                    disabled={isSubmitting || !schemaReady}
                    className="flex-1 p-4 bg-black text-white rounded-2xl font-black text-xs uppercase shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                    Konfirmasi
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
