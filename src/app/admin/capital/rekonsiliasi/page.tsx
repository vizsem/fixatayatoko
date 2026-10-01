'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCcw,
  Scale,
} from 'lucide-react';
import notify from '@/lib/notify';
import {
  applyCapitalReconciliation,
  getCapitalReconciliation,
  type CapitalReconciliationResult,
} from '@/lib/actions/capital-reconcile.actions';
import type { BarisRekonsiliasi } from '@/lib/capital-reconcile';

type Ringkasan = Extract<CapitalReconciliationResult, { success: true }>['data']['ringkasan'];

const RINGKASAN_KOSONG: Ringkasan = {
  jumlah: 0,
  kurangPotong: 0,
  lebihPotong: 0,
  jumlahKurangPotong: 0,
  jumlahLebihPotong: 0,
};

const rupiah = (nilai: number) => `Rp ${Math.round(Number(nilai) || 0).toLocaleString('id-ID')}`;

const tanggal = (nilai: string) => {
  if (!nilai) return '-';
  const d = new Date(nilai);
  return isNaN(d.getTime())
    ? '-'
    : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Halaman rekonsiliasi Purchase Order ↔ buku besar modal.
 *
 * Menampilkan PO yang uangnya belum tercatat (atau kelebihan tercatat) di
 * `capital_transactions`, lalu memungkinkan menutup selisihnya per PO —
 * dengan persetujuan eksplisit, karena ini menyentuh angka keuangan.
 */
export default function CapitalReconciliationPage() {
  const [loading, setLoading] = useState(true);
  const [menerapkan, setMenerapkan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baris, setBaris] = useState<BarisRekonsiliasi[]>([]);
  const [ringkasan, setRingkasan] = useState<Ringkasan>(RINGKASAN_KOSONG);
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'semua' | 'era-supabase' | 'belum-dipotong'>('semua');

  const muat = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCapitalReconciliation();
      if (res.success) {
        setBaris(res.data.baris);
        setRingkasan(res.data.ringkasan);
        setTerpilih(new Set());
      } else {
        setError(res.error);
        notify.admin.error(res.error);
      }
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat data');
      notify.admin.error(e?.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  const tampil = useMemo(() => {
    if (filter === 'era-supabase') return baris.filter((b) => b.poId.startsWith('po_'));
    if (filter === 'belum-dipotong') return baris.filter((b) => b.selisih > 0);
    return baris;
  }, [baris, filter]);

  const jumlahEraSupabase = useMemo(() => baris.filter((b) => b.poId.startsWith('po_')).length, [baris]);

  const totalTerpilih = useMemo(
    () =>
      baris
        .filter((b) => terpilih.has(b.poId))
        .reduce((sum, b) => sum + Math.abs(b.selisih), 0),
    [baris, terpilih]
  );

  const toggleSatu = (poId: string) => {
    setTerpilih((prev) => {
      const next = new Set(prev);
      if (next.has(poId)) next.delete(poId);
      else next.add(poId);
      return next;
    });
  };

  const pilihSemuaTampil = () => setTerpilih(new Set(tampil.map((b) => b.poId)));
  const kosongkanPilihan = () => setTerpilih(new Set());

  const terapkan = async () => {
    const ids = Array.from(terpilih);
    if (ids.length === 0) return;

    const yakin = confirm(
      `Tutup selisih modal untuk ${ids.length} PO (total ${rupiah(totalTerpilih)})?\n\n` +
        'Setiap PO dicatat SATU penyesuaian di buku besar modal:\n' +
        '  • modal belum dipotong -> WITHDRAWAL (modal berkurang)\n' +
        '  • modal kelebihan dipotong -> INJECTION (modal bertambah)\n\n' +
        'Jangan pilih PO yang selisihnya sudah pernah Anda tutup lewat ' +
        '"Penyesuaian Modal Total", supaya tidak terhitung dua kali.'
    );
    if (!yakin) return;

    setMenerapkan(true);
    try {
      const res = await applyCapitalReconciliation(ids);
      if (!res.success) {
        notify.admin.error(res.error || 'Gagal menerapkan rekonsiliasi');
        return;
      }

      const { diproses, disesuaikan, gagal } = res.data!;
      const pesan = `${diproses} PO disesuaikan (total ${rupiah(disesuaikan)}).`;
      if (gagal.length > 0) {
        notify.admin.warning(`${pesan} ${gagal.length} PO gagal: ${gagal.slice(0, 3).join('; ')}`);
      } else {
        notify.admin.success(pesan);
      }
      await muat();
    } catch (e: any) {
      notify.admin.error(e?.message || 'Gagal menerapkan rekonsiliasi');
    } finally {
      setMenerapkan(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 bg-slate-50">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Scale className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600" />
            Rekonsiliasi Modal &amp; Purchase Order
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Bandingkan uang yang seharusnya keluar untuk setiap PO dengan yang tercatat di buku besar modal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={muat}
            disabled={loading || menerapkan}
            className="p-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl transition active:scale-95"
            title="Muat ulang"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
          <Link
            href="/admin/capital"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl shadow-xs text-xs font-bold transition active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali ke Modal
          </Link>
        </div>
      </div>

      {/* Penjelasan — dibuat sejelas mungkin supaya tidak salah tekan */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex gap-3">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-amber-900 space-y-1.5 leading-relaxed">
          <p className="font-semibold">Kenapa ada selisih?</p>
          <p>
            Sampai 1 Okt 2026, pencatatan keluar-masuk modal untuk PO dilakukan di peramban dan
            <strong> selalu gagal tanpa pesan error</strong>. Akibatnya pembelian tunai/transfer tidak
            mengurangi saldo modal. Penulisannya sudah diperbaiki untuk PO baru; daftar di bawah adalah
            PO lama yang masih berselisih.
          </p>
          <p>
            <strong>Selisih positif</strong> = modal belum dipotong (uang sudah keluar, catatan belum).
            <strong> Selisih negatif</strong> = modal terpotong lebih besar dari nilai PO.
          </p>
          <p>
            Periksa dulu apakah selisihnya sudah pernah Anda tutup lewat tombol
            <strong> &ldquo;Penyesuaian Modal Total&rdquo;</strong> di halaman Modal. Kalau sudah,
            jangan dipilih lagi di sini — nanti terhitung dua kali.
          </p>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/80">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">PO berselisih</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{ringkasan.jumlah}</p>
          <p className="text-[11px] text-slate-500 mt-1">dari seluruh PO di database</p>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/80">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Belum dipotong</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{rupiah(ringkasan.kurangPotong)}</p>
          <p className="text-[11px] text-slate-500 mt-1">{ringkasan.jumlahKurangPotong} PO</p>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/80">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Kelebihan potong</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{rupiah(ringkasan.lebihPotong)}</p>
          <p className="text-[11px] text-slate-500 mt-1">{ringkasan.jumlahLebihPotong} PO</p>
        </div>
      </div>

      {/* Daftar */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'semua', label: `Semua (${baris.length})` },
                { id: 'era-supabase', label: `Era Supabase (${jumlahEraSupabase})` },
                { id: 'belum-dipotong', label: `Belum dipotong (${ringkasan.jumlahKurangPotong})` },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filter === f.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={pilihSemuaTampil}
              disabled={tampil.length === 0 || menerapkan}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition"
            >
              Pilih semua yang tampil
            </button>
            <button
              onClick={kosongkanPilihan}
              disabled={terpilih.size === 0 || menerapkan}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition"
            >
              Kosongkan
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center text-slate-500 gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Memeriksa selisih…
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">Gagal memuat data</p>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
            <button
              onClick={muat}
              className="mt-4 px-3.5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
            >
              Coba lagi
            </button>
          </div>
        ) : tampil.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">
              {baris.length === 0 ? 'Tidak ada selisih. Buku besar modal sudah cocok dengan semua PO.' : 'Tidak ada PO pada filter ini.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/60 border-b border-slate-100">
                <tr>
                  <th className="px-3 py-3 w-10"></th>
                  <th className="px-3 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Tanggal</th>
                  <th className="px-3 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">No. PO</th>
                  <th className="px-3 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Supplier</th>
                  <th className="px-3 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Bayar</th>
                  <th className="px-3 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 text-right">Seharusnya</th>
                  <th className="px-3 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 text-right">Tercatat</th>
                  <th className="px-3 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 text-right">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tampil.map((b) => {
                  const dipilih = terpilih.has(b.poId);
                  return (
                    <tr
                      key={b.poId}
                      onClick={() => toggleSatu(b.poId)}
                      className={`cursor-pointer transition ${dipilih ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={dipilih}
                          onChange={() => toggleSatu(b.poId)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 accent-indigo-600 cursor-pointer"
                          aria-label={`Pilih PO ${b.poNumber}`}
                        />
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold text-slate-600 whitespace-nowrap">{tanggal(b.createdAt)}</td>
                      <td className="px-3 py-3">
                        <p className="text-xs font-bold text-slate-800">{b.poNumber}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{b.poId}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700">{b.supplierName}</td>
                      <td className="px-3 py-3">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-slate-100 text-slate-600">
                          {b.paymentMethod || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700 text-right whitespace-nowrap">{rupiah(b.diharapkan)}</td>
                      <td className="px-3 py-3 text-xs text-slate-700 text-right whitespace-nowrap">{rupiah(b.tercatat)}</td>
                      <td
                        className={`px-3 py-3 text-xs font-bold text-right whitespace-nowrap ${
                          b.selisih > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {b.selisih > 0 ? '+' : '−'}
                        {rupiah(Math.abs(b.selisih)).replace('Rp ', '')}
                        <span className="block text-[10px] font-medium text-slate-500">
                          {b.selisih > 0 ? 'belum dipotong' : 'kelebihan potong'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bilah aksi — hanya muncul bila ada yang dipilih */}
      {terpilih.size > 0 && (
        <div className="sticky bottom-4 z-10 bg-slate-900 text-white rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs sm:text-sm">
            <p className="font-bold">
              {terpilih.size} PO dipilih · total selisih {rupiah(totalTerpilih)}
            </p>
            <p className="text-slate-300 text-[11px] mt-0.5">
              Setiap PO mendapat satu penyesuaian; PO yang sudah cocok tidak diubah.
            </p>
          </div>
          <button
            onClick={terapkan}
            disabled={menerapkan}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-xl text-xs font-black uppercase tracking-widest transition active:scale-95"
          >
            {menerapkan ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {menerapkan ? 'Menerapkan…' : 'Tutup selisih terpilih'}
          </button>
        </div>
      )}
    </div>
  );
}
