'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Info,
  Loader2,
  Package,
  PackageCheck,
  PackageSearch,
  PackageX,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';

import notify from '@/lib/notify';
import {
  buatRetur,
  cariProdukUntukRetur,
  getReturnsPageData,
  prosesRetur,
  type AksiRetur,
  type ProdukUntukRetur,
} from '@/lib/actions/returns.actions';
import {
  akunJurnalRetur,
  formatRupiah,
  formatTanggalRetur,
  itemTanpaProduk,
  labelJenis,
  labelJenisPendek,
  labelPenyelesaian,
  labelStatus,
  normalisasiItems,
  ringkasRetur,
  saringRetur,
  totalDariItems,
  type ItemRetur,
  type JenisRetur,
  type PenyelesaianRetur,
  type Retur,
  type RingkasanRetur,
  type StatusRetur,
} from '@/lib/returns';

/**
 * Manajemen Retur — Supabase penuh (tanpa bridge Firestore).
 *
 * Sebelumnya halaman ini menulis LANGSUNG dari peramban dengan `supabaseAdmin`
 * (di peramban = klien anon tanpa sesi), sehingga persetujuan retur selalu
 * gagal tanpa pesan: stok tidak bertambah, jurnal tidak tercatat. Seluruh
 * operasi kini lewat Server Action `src/lib/actions/returns.actions.ts`.
 *
 * Yang membuat halaman ini "fungsional":
 *   - daftar & ringkasan dibaca dari Supabase (bukan Firestore/anon),
 *   - pencarian produk dilayani database (tidak mengunduh 4.500 produk),
 *   - setujui/tolak benar-benar menggerakkan stok + jurnal, dan bisa diulang,
 *   - item tanpa ID produk DILAPORKAN, tidak ditebak.
 */

const FILTER_STATUS: Array<{ nilai: StatusRetur | 'SEMUA'; label: string }> = [
  { nilai: 'SEMUA', label: 'Semua' },
  { nilai: 'PENDING', label: 'Menunggu' },
  { nilai: 'APPROVED', label: 'Disetujui' },
  { nilai: 'REJECTED', label: 'Ditolak' },
];

const FILTER_JENIS: Array<{ nilai: JenisRetur | 'SEMUA'; label: string }> = [
  { nilai: 'SEMUA', label: 'Semua Tipe' },
  { nilai: 'SALES_RETURN', label: 'Retur Penjualan' },
  { nilai: 'PURCHASE_RETURN', label: 'Retur Pembelian' },
];

/** Pilihan penyelesaian dana, dibedakan menurut jenis retur. */
function opsiPenyelesaian(jenis: JenisRetur): PenyelesaianRetur[] {
  return jenis === 'SALES_RETURN'
    ? ['TIDAK_DIRINCIKAN', 'TUNAI', 'DOMPET']
    : ['TIDAK_DIRINCIKAN', 'POTONG_HUTANG', 'TUNAI'];
}

const WARNA_STATUS: Record<StatusRetur, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-100',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-100',
};

export default function ReturnsPage() {
  const [daftar, setDaftar] = useState<Retur[]>([]);
  const [ringkasan, setRingkasan] = useState<RingkasanRetur>(() => ringkasRetur([]));
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<StatusRetur | 'SEMUA'>('SEMUA');
  const [filterJenis, setFilterJenis] = useState<JenisRetur | 'SEMUA'>('SEMUA');
  const [kataKunci, setKataKunci] = useState('');
  const [barisTerbuka, setBarisTerbuka] = useState<string | null>(null);

  // --- Formulir retur baru ---
  const [modalBuat, setModalBuat] = useState(false);
  const [jenis, setJenis] = useState<JenisRetur>('SALES_RETURN');
  const [refId, setRefId] = useState('');
  const [pihak, setPihak] = useState('');
  const [alasan, setAlasan] = useState('');
  const [penyelesaian, setPenyelesaian] = useState<PenyelesaianRetur>('TIDAK_DIRINCIKAN');
  const [nomorResi, setNomorResi] = useState('');
  const [ekspedisi, setEkspedisi] = useState('');
  const [items, setItems] = useState<ItemRetur[]>([]);
  const [cariKata, setCariKata] = useState('');
  const [hasilCari, setHasilCari] = useState<ProdukUntukRetur[]>([]);
  const [mencari, setMencari] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  // --- Modal proses (setujui / tolak) ---
  const [modalProses, setModalProses] = useState<{
    retur: Retur;
    aksi: AksiRetur;
    penyelesaian: PenyelesaianRetur;
    catatan: string;
  } | null>(null);
  const [memproses, setMemproses] = useState(false);

  const muatData = useCallback(async () => {
    setMemuat(true);
    try {
      const hasil = await getReturnsPageData();
      if (!hasil.ok) {
        setGalat(hasil.error);
        notify.admin.error(hasil.error);
        return;
      }
      setGalat(null);
      setDaftar(hasil.data.daftar);
      setRingkasan(hasil.data.ringkasan);
    } catch (error) {
      const pesan = error instanceof Error ? error.message : 'Gagal memuat data retur.';
      setGalat(pesan);
      notify.admin.error(pesan);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muatData();
  }, [muatData]);

  const terlihat = useMemo(
    () => saringRetur(daftar, { status: filterStatus, jenis: filterJenis, kata: kataKunci }),
    [daftar, filterStatus, filterJenis, kataKunci]
  );

  const totalItemTanpaProduk = useMemo(() => ringkasRetur(daftar).itemTanpaProduk, [daftar]);
  const totalFormulir = useMemo(() => totalDariItems(items), [items]);

  // --- Pencarian produk (di server) ---
  const cariProduk = useCallback(async (kata: string) => {
    if (kata.trim().length < 2) {
      setHasilCari([]);
      return;
    }
    setMencari(true);
    try {
      const hasil = await cariProdukUntukRetur(kata);
      setHasilCari(hasil.ok ? hasil.data : []);
      if (!hasil.ok) notify.admin.error(hasil.error);
    } finally {
      setMencari(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void cariProduk(cariKata), 300);
    return () => clearTimeout(timer);
  }, [cariKata, cariProduk]);

  const tambahItem = (produk: ProdukUntukRetur) => {
    setItems((lama) => {
      const opsiSatuan =
        produk.units && produk.units.length > 0
          ? produk.units
          : [{ code: (produk.unit || 'PCS').toUpperCase(), contains: 1, price: produk.price }];

      const unitAwal = opsiSatuan[0];
      const unitCode = unitAwal.code.toUpperCase();
      const unitPrice =
        unitAwal.price != null && unitAwal.price > 0
          ? unitAwal.price
          : (unitAwal.contains && unitAwal.contains > 1 ? produk.price * unitAwal.contains : produk.price);

      const sudahAdaIndex = lama.findIndex(
        (i) => i.productId === produk.id && (i.unit || '').toUpperCase() === unitCode
      );

      if (sudahAdaIndex >= 0) {
        return lama.map((i, idx) => (idx === sudahAdaIndex ? { ...i, quantity: i.quantity + 1 } : i));
      }

      return [
        ...lama,
        {
          productId: produk.id,
          productName: produk.name,
          quantity: 1,
          price: unitPrice,
          unit: unitCode,
          contains: unitAwal.contains || 1,
          availableUnits: opsiSatuan,
        },
      ];
    });
    setCariKata('');
    setHasilCari([]);
  };

  const ubahQty = (index: number, qty: number) => {
    const jumlah = Math.max(1, Math.floor(qty || 1));
    setItems((lama) => lama.map((i, idx) => (idx === index ? { ...i, quantity: jumlah } : i)));
  };

  const ubahUnit = (index: number, newUnitCode: string) => {
    setItems((lama) =>
      lama.map((item, idx) => {
        if (idx !== index) return item;
        const target = item.availableUnits?.find(
          (u) => u.code.toUpperCase() === newUnitCode.trim().toUpperCase()
        );
        const contains = target?.contains || 1;
        let newPrice = target?.price != null && target.price > 0 ? target.price : undefined;
        if (newPrice == null) {
          const currentContains = item.contains || 1;
          const basePrice = currentContains > 0 ? item.price / currentContains : item.price;
          newPrice = Math.round(basePrice * contains);
        }
        return {
          ...item,
          unit: target?.code.toUpperCase() || newUnitCode.trim().toUpperCase(),
          contains,
          price: newPrice,
        };
      })
    );
  };

  const hapusItem = (index: number) => {
    setItems((lama) => lama.filter((_, idx) => idx !== index));
  };

  const resetFormulir = () => {
    setJenis('SALES_RETURN');
    setRefId('');
    setPihak('');
    setAlasan('');
    setPenyelesaian('TIDAK_DIRINCIKAN');
    setNomorResi('');
    setEkspedisi('');
    setItems([]);
    setCariKata('');
    setHasilCari([]);
  };

  const simpanRetur = async () => {
    setMenyimpan(true);
    try {
      const hasil = await buatRetur({
        jenis,
        refId,
        pihak,
        alasan,
        items: normalisasiItems(items),
        penyelesaian,
        nomorResi,
        ekspedisi,
      });

      if (!hasil.ok) {
        notify.admin.error(hasil.error);
        return;
      }

      notify.admin.success(
        `Retur ${formatRupiah(hasil.data.totalNilai)} dibuat (menunggu persetujuan).`
      );
      setModalBuat(false);
      resetFormulir();
      await muatData();
    } finally {
      setMenyimpan(false);
    }
  };

  const jalankanProses = async () => {
    if (!modalProses) return;
    setMemproses(true);
    try {
      const hasil = await prosesRetur(
        modalProses.retur.id,
        modalProses.aksi,
        modalProses.penyelesaian,
        modalProses.catatan
      );

      if (!hasil.ok) {
        notify.admin.error(hasil.error);
        await muatData();
        return;
      }

      if (modalProses.aksi === 'TOLAK') {
        notify.admin.success('Retur ditolak. Stok tidak berubah.');
      } else if (hasil.data.peringatan.length > 0) {
        notify.admin.success('Retur disetujui.');
        for (const pesan of hasil.data.peringatan) notify.admin.error(pesan);
      } else {
        notify.admin.success(
          `Retur disetujui. ${hasil.data.stokDisesuaikan} produk disesuaikan stoknya` +
            (hasil.data.jurnalDicatat ? ' dan jurnal dicatat.' : '.')
        );
      }

      setModalProses(null);
      await muatData();
    } finally {
      setMemproses(false);
    }
  };

  // Hitung persentase pending dari total
  const pctPending =
    ringkasan.jumlah > 0 ? Math.round((ringkasan.menunggu / ringkasan.jumlah) * 100) : 0;
  const pctApproved =
    ringkasan.jumlah > 0 ? Math.round((ringkasan.disetujui / ringkasan.jumlah) * 100) : 0;
  const pctRejected =
    ringkasan.jumlah > 0 ? Math.round((ringkasan.ditolak / ringkasan.jumlah) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50/80">
      <Toaster position="top-center" />

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold mb-2">
              <span>Admin</span>
              <ChevronDown size={12} className="-rotate-90" />
              <span className="text-slate-600 font-bold">Manajemen Retur</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-200">
                <RotateCcw size={20} className="text-white" />
              </div>
              Manajemen Retur
            </h1>
            <p className="text-sm text-slate-500 font-medium pl-1">
              Pengembalian barang dari pelanggan &amp; ke supplier — stok dan jurnal tercatat otomatis.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => void muatData()}
              disabled={memuat}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-all shadow-sm"
            >
              <RefreshCcw size={14} className={memuat ? 'animate-spin' : ''} />
              Muat Ulang
            </button>
            <button
              onClick={() => setModalBuat(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-purple-200 hover:from-violet-700 hover:to-purple-700 active:scale-95 transition-all"
            >
              <Plus size={15} />
              Buat Retur
            </button>
          </div>
        </div>

        {/* ── Kartu ringkasan ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Menunggu */}
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-50/60 to-transparent pointer-events-none" />
            <div className="flex items-start justify-between gap-2 relative">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Menunggu</p>
                <p className="text-3xl font-black text-slate-900">{ringkasan.menunggu}</p>
                <p className="text-xs font-semibold text-slate-500 mt-1">{formatRupiah(ringkasan.nilaiMenunggu)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Clock size={18} className="text-amber-600" />
              </div>
            </div>
            {ringkasan.jumlah > 0 && (
              <div className="mt-4 relative">
                <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${pctPending}%` }}
                  />
                </div>
                <p className="text-[10px] font-bold text-amber-600 mt-1">{pctPending}% dari total</p>
              </div>
            )}
          </div>

          {/* Disetujui */}
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/60 to-transparent pointer-events-none" />
            <div className="flex items-start justify-between gap-2 relative">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Disetujui</p>
                <p className="text-3xl font-black text-slate-900">{ringkasan.disetujui}</p>
                <p className="text-xs font-semibold text-slate-500 mt-1">{formatRupiah(ringkasan.nilaiDisetujui)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <PackageCheck size={18} className="text-emerald-600" />
              </div>
            </div>
            {ringkasan.jumlah > 0 && (
              <div className="mt-4 relative">
                <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${pctApproved}%` }}
                  />
                </div>
                <p className="text-[10px] font-bold text-emerald-600 mt-1">{pctApproved}% dari total</p>
              </div>
            )}
          </div>

          {/* Ditolak */}
          <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-50/60 to-transparent pointer-events-none" />
            <div className="flex items-start justify-between gap-2 relative">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Ditolak</p>
                <p className="text-3xl font-black text-slate-900">{ringkasan.ditolak}</p>
                <p className="text-xs font-semibold text-slate-500 mt-1">Stok tidak berubah</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                <PackageX size={18} className="text-rose-600" />
              </div>
            </div>
            {ringkasan.jumlah > 0 && (
              <div className="mt-4 relative">
                <div className="h-1.5 bg-rose-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-400 rounded-full transition-all"
                    style={{ width: `${pctRejected}%` }}
                  />
                </div>
                <p className="text-[10px] font-bold text-rose-600 mt-1">{pctRejected}% dari total</p>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50/60 to-transparent pointer-events-none" />
            <div className="flex items-start justify-between gap-2 relative">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Total Data</p>
                <p className="text-3xl font-black text-slate-900">{ringkasan.jumlah}</p>
                <p className="text-xs font-semibold text-slate-500 mt-1">500 terbaru dimuat</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Package size={18} className="text-slate-500" />
              </div>
            </div>
            <div className="mt-4 relative">
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1.5 bg-amber-200 rounded-full" style={{ flexBasis: `${pctPending}%` }} />
                <div className="flex-1 h-1.5 bg-emerald-300 rounded-full" style={{ flexBasis: `${pctApproved}%` }} />
                <div className="flex-1 h-1.5 bg-rose-300 rounded-full" style={{ flexBasis: `${pctRejected}%` }} />
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-1">Distribusi status</p>
            </div>
          </div>
        </div>

        {/* ── Peringatan ── */}
        {totalItemTanpaProduk > 0 && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800">
                {totalItemTanpaProduk} item retur tanpa ID produk
              </p>
              <p className="text-xs font-medium text-amber-700 mt-0.5">
                Warisan impor marketplace. Saat disetujui, item tersebut <b>tidak</b> mengubah stok — sistem menolak menebak produknya.
              </p>
            </div>
          </div>
        )}

        {galat && (
          <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-2xl p-4">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
              <XCircle size={16} className="text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-800">Gagal memuat data</p>
              <p className="text-xs font-medium text-rose-700 mt-0.5">{galat}</p>
            </div>
          </div>
        )}

        {/* ── Filter & pencarian ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="relative flex-1 min-w-[260px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={kataKunci}
                onChange={(e) => setKataKunci(e.target.value)}
                placeholder="Cari referensi, pelanggan, supplier, atau produk…"
                className="w-full bg-slate-50 border border-slate-200 focus:border-violet-400 focus:bg-white rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            <select
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value as JenisRetur | 'SEMUA')}
              className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl py-2.5 px-3 text-sm font-semibold outline-none transition-all cursor-pointer"
            >
              {FILTER_JENIS.map((f) => (
                <option key={f.nilai} value={f.nilai}>
                  {f.label}
                </option>
              ))}
            </select>
            <p className="text-xs font-semibold text-slate-400 ml-auto whitespace-nowrap">
              {terlihat.length} dari {daftar.length} retur
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTER_STATUS.map((f) => {
              const count =
                f.nilai === 'PENDING'
                  ? ringkasan.menunggu
                  : f.nilai === 'APPROVED'
                    ? ringkasan.disetujui
                    : f.nilai === 'REJECTED'
                      ? ringkasan.ditolak
                      : null;
              return (
                <button
                  key={f.nilai}
                  onClick={() => setFilterStatus(f.nilai)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterStatus === f.nilai
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                  {count !== null && (
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                        filterStatus === f.nilai ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tabel retur ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[920px]">
              <thead>
                <tr className="border-b border-slate-100">
                  {[
                    { label: 'Tanggal', cls: 'w-36' },
                    { label: 'Tipe & Referensi', cls: 'w-44' },
                    { label: 'Pihak', cls: '' },
                    { label: 'Item', cls: 'w-28' },
                    { label: 'Nilai', cls: 'w-36' },
                    { label: 'Status', cls: 'w-28' },
                    { label: 'Aksi', cls: 'w-28 text-right' },
                  ].map((h) => (
                    <th
                      key={h.label}
                      className={`px-5 py-3.5 text-[11px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/80 ${h.cls}`}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {memuat ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="animate-pulse">
                      <td className="px-5 py-4">
                        <div className="h-3 bg-slate-100 rounded-full w-20" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-3 bg-slate-100 rounded-full w-24" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-3 bg-slate-100 rounded-full w-32" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-3 bg-slate-100 rounded-full w-12" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-3 bg-slate-100 rounded-full w-24" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-5 bg-slate-100 rounded-lg w-20" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-7 bg-slate-100 rounded-lg w-20 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : terlihat.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <PackageSearch size={28} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-bold text-slate-400">
                        {daftar.length === 0
                          ? 'Belum ada retur tercatat'
                          : 'Tidak ada retur yang cocok dengan filter'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {daftar.length === 0
                          ? 'Buat retur pertama dengan tombol di atas.'
                          : 'Coba ubah filter atau kata kunci pencarian.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  terlihat.map((retur) => {
                    const terbuka = barisTerbuka === retur.id;
                    const tanpaId = itemTanpaProduk(retur.items).length;
                    return (
                      <BarisRetur
                        key={retur.id}
                        retur={retur}
                        terbuka={terbuka}
                        tanpaId={tanpaId}
                        onToggle={() => setBarisTerbuka(terbuka ? null : retur.id)}
                        onProses={(aksi) =>
                          setModalProses({
                            retur,
                            aksi,
                            penyelesaian: aksi === 'SETUJUI' ? retur.penyelesaian : 'TIDAK_DIRINCIKAN',
                            catatan: '',
                          })
                        }
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer tabel */}
          {!memuat && terlihat.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/50 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400">
                Menampilkan {terlihat.length} retur
              </p>
              <p className="text-xs font-semibold text-slate-400">
                ✓ Disetujui = stok + jurnal bergerak · ✗ Ditolak = status saja
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ================= Modal: buat retur ================= */}
      {modalBuat && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[92vh] overflow-hidden">
            {/* Header modal */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between gap-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <RotateCcw size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Buat Permintaan Retur</h2>
                  <p className="text-xs font-semibold text-slate-400">Stok baru berubah setelah disetujui admin</p>
                </div>
              </div>
              <button
                onClick={() => setModalBuat(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                aria-label="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body modal */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Tipe & referensi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    Tipe Retur
                  </label>
                  <select
                    value={jenis}
                    onChange={(e) => {
                      setJenis(e.target.value as JenisRetur);
                      setPenyelesaian('TIDAK_DIRINCIKAN');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-violet-400 focus:bg-white p-3 rounded-xl text-sm font-semibold outline-none transition-all"
                  >
                    <option value="SALES_RETURN">↩ Retur Penjualan (dari pelanggan)</option>
                    <option value="PURCHASE_RETURN">↪ Retur Pembelian (ke supplier)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    No. Referensi
                  </label>
                  <input
                    value={refId}
                    onChange={(e) => setRefId(e.target.value)}
                    placeholder="Order ID / Nomor PO…"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-violet-400 focus:bg-white p-3 rounded-xl text-sm font-semibold outline-none transition-all"
                  />
                </div>
              </div>

              {/* Nama pihak */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  {jenis === 'SALES_RETURN' ? 'Nama Pelanggan' : 'Nama Supplier'}
                </label>
                <input
                  value={pihak}
                  onChange={(e) => setPihak(e.target.value)}
                  placeholder={
                    jenis === 'SALES_RETURN' ? 'Contoh: Customer TikTok Shop' : 'Contoh: PT Sumber Jaya'
                  }
                  className="w-full bg-slate-50 border border-slate-200 focus:border-violet-400 focus:bg-white p-3 rounded-xl text-sm font-semibold outline-none transition-all"
                />
              </div>

              {/* Produk */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Produk yang Diretur
                </label>
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={cariKata}
                    onChange={(e) => setCariKata(e.target.value)}
                    placeholder="Ketik minimal 2 huruf untuk mencari produk…"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-violet-400 focus:bg-white p-3 pl-10 rounded-xl text-sm font-semibold outline-none transition-all"
                  />
                  {mencari && (
                    <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                  )}
                </div>

                {hasilCari.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 shadow-sm">
                    {hasilCari.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => tambahItem(p)}
                        className="w-full p-3 text-left hover:bg-violet-50 flex justify-between items-center gap-3 transition-colors"
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-sm font-bold text-slate-800 truncate">{p.name}</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-semibold text-slate-400">Satuan terdaftar:</span>
                            {p.units && p.units.length > 0 ? (
                              p.units.map((u) => (
                                <span
                                  key={u.code}
                                  className="bg-violet-50 border border-violet-200 text-violet-700 font-black px-1.5 py-0.5 rounded text-[10px] uppercase"
                                >
                                  {u.code}
                                  {u.contains > 1 ? ` (${u.contains})` : ''}
                                </span>
                              ))
                            ) : (
                              <span className="bg-slate-100 text-slate-600 font-black px-1.5 py-0.5 rounded text-[10px] uppercase">
                                {p.unit || 'PCS'}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap flex-shrink-0 flex items-center gap-1.5">
                          {formatRupiah(p.price)}
                          <span className="text-slate-300">·</span>
                          {p.stock} stok
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {items.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-3.5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Produk</th>
                          <th className="px-2 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider w-28">Satuan</th>
                          <th className="px-2 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center w-20">Qty</th>
                          <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right w-24">Harga</th>
                          <th className="px-3.5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right w-28">Subtotal</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {items.map((item, idx) => {
                          const units = item.availableUnits && item.availableUnits.length > 0
                            ? item.availableUnits
                            : [{ code: (item.unit || 'PCS').toUpperCase(), contains: item.contains || 1, price: item.price }];

                          return (
                            <tr key={`${item.productId}-${idx}`} className="bg-white hover:bg-slate-50/50">
                              <td className="px-3.5 py-2.5 font-semibold text-slate-800 text-sm">
                                <div>{item.productName}</div>
                                {item.contains && item.contains > 1 ? (
                                  <div className="text-[10px] text-violet-600 font-semibold mt-0.5">
                                    1 {item.unit} = {item.contains} unit dasar
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-2 py-2.5">
                                {units.length > 1 ? (
                                  <select
                                    value={(item.unit || 'PCS').toUpperCase()}
                                    onChange={(e) => ubahUnit(idx, e.target.value)}
                                    className="w-full bg-violet-50 text-violet-700 border border-violet-200 rounded-lg px-2 py-1.5 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-violet-300 cursor-pointer"
                                  >
                                    {units.map((u) => (
                                      <option key={u.code} value={u.code}>
                                        {u.code} {u.contains > 1 ? `(${u.contains})` : ''}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="inline-block bg-slate-100 text-slate-700 font-bold px-2 py-1 rounded text-xs uppercase">
                                    {item.unit || 'PCS'}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-2.5">
                                <input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(e) => ubahQty(idx, Number(e.target.value))}
                                  className="w-16 bg-white border border-slate-200 rounded-lg p-1.5 font-bold text-center text-sm outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-right font-medium text-slate-600 text-xs">
                                {formatRupiah(item.price)}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-bold text-slate-800 text-sm">
                                {formatRupiah(item.price * item.quantity)}
                              </td>
                              <td className="px-2 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => hapusItem(idx)}
                                  className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                  aria-label="Hapus item"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {items.length === 0 && cariKata.length < 2 && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <Package size={14} />
                    Belum ada produk ditambahkan. Cari produk di atas.
                  </div>
                )}
              </div>

              {/* Alasan */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Alasan Retur
                </label>
                <textarea
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Contoh: barang rusak saat pengiriman / salah kirim model / tidak sesuai pesanan"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-violet-400 focus:bg-white p-3 rounded-xl text-sm font-semibold outline-none h-20 resize-none transition-all"
                />
              </div>

              {/* Resi & ekspedisi */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Truck size={14} className="text-slate-400" />
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    Resi &amp; Ekspedisi Pengiriman Balik
                  </label>
                  <span className="text-[10px] font-semibold text-slate-300">(opsional)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Nomor resi — bisa scan barcode */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400 px-1">Nomor Resi</label>
                    <div className="relative">
                      <input
                        id="input-nomor-resi"
                        type="text"
                        value={nomorResi}
                        onChange={(e) => setNomorResi(e.target.value)}
                        placeholder="Scan barcode atau ketik…"
                        autoComplete="off"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-violet-400 focus:bg-white p-3 pr-10 rounded-xl text-sm font-mono font-semibold outline-none transition-all placeholder:font-sans placeholder:font-normal"
                      />
                      {/* Indikator scanner — input ini bisa menerima input barcode scanner langsung */}
                      <span
                        title="Arahkan barcode scanner ke sini"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 select-none cursor-default"
                      >
                        ▦
                      </span>
                    </div>
                    <p className="text-[10px] font-semibold text-slate-400 px-1 flex items-center gap-1">
                      <span>⌨</span> Klik field lalu tembak barcode scanner
                    </p>
                  </div>

                  {/* Nama ekspedisi */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400 px-1">Nama Ekspedisi</label>
                    <select
                      value={ekspedisi}
                      onChange={(e) => setEkspedisi(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-violet-400 focus:bg-white p-3 rounded-xl text-sm font-semibold outline-none transition-all"
                    >
                      <option value="">— Pilih ekspedisi —</option>
                      <option value="JNE">JNE</option>
                      <option value="J&T">J&amp;T Express</option>
                      <option value="SiCepat">SiCepat</option>
                      <option value="TIKI">TIKI</option>
                      <option value="Pos Indonesia">Pos Indonesia</option>
                      <option value="Anteraja">Anteraja</option>
                      <option value="Ninja Xpress">Ninja Xpress</option>
                      <option value="SAP">SAP Express</option>
                      <option value="Lion Parcel">Lion Parcel</option>
                      <option value="Lalamove">Lalamove</option>
                      <option value="GrabExpress">GrabExpress</option>
                      <option value="GoSend">GoSend</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                </div>

                {/* Preview jika sudah diisi */}
                {(nomorResi || ekspedisi) && (
                  <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl p-3">
                    <Truck size={14} className="text-violet-500 flex-shrink-0" />
                    <p className="text-xs font-bold text-violet-700">
                      {ekspedisi && <span>{ekspedisi} </span>}
                      {nomorResi && <span className="font-mono">{nomorResi}</span>}
                    </p>
                  </div>
                )}
              </div>

              {/* Penyelesaian dana */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Penyelesaian Dana
                </label>
                <select
                  value={penyelesaian}
                  onChange={(e) => setPenyelesaian(e.target.value as PenyelesaianRetur)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-violet-400 focus:bg-white p-3 rounded-xl text-sm font-semibold outline-none transition-all"
                >
                  {opsiPenyelesaian(jenis).map((p) => (
                    <option key={p} value={p}>
                      {labelPenyelesaian(p)}
                    </option>
                  ))}
                </select>
                <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <Info size={13} className="mt-0.5 shrink-0 text-slate-400" />
                  <p className="text-xs font-semibold text-slate-500">
                    Jurnal hanya dibuat bila dananya benar-benar bergerak. Retur marketplace yang dipotong dari pencairan pilih &quot;Tanpa jurnal&quot;.
                  </p>
                </div>
              </div>

            </div>

            {/* Footer modal */}
            <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 flex-shrink-0">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Nilai Retur</p>
                <p className="text-2xl font-black text-slate-900">{formatRupiah(totalFormulir)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalBuat(false)}
                  className="px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => void simpanRetur()}
                  disabled={menyimpan || items.length === 0}
                  className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-purple-200 hover:from-violet-700 hover:to-purple-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {menyimpan && <Loader2 size={15} className="animate-spin" />}
                  Simpan Retur
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= Modal: proses retur ================= */}
      {modalProses && (
        <ModalProses
          data={modalProses}
          busy={memproses}
          onUbah={(patch) => setModalProses((lama) => (lama ? { ...lama, ...patch } : lama))}
          onTutup={() => setModalProses(null)}
          onJalankan={() => void jalankanProses()}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Komponen kecil
// ---------------------------------------------------------------------------

function BarisRetur({
  retur,
  terbuka,
  tanpaId,
  onToggle,
  onProses,
}: {
  retur: Retur;
  terbuka: boolean;
  tanpaId: number;
  onToggle: () => void;
  onProses: (aksi: AksiRetur) => void;
}) {
  return (
    <>
      <tr className={`hover:bg-slate-50/80 transition-colors align-top ${terbuka ? 'bg-violet-50/30' : ''}`}>
        {/* Tanggal */}
        <td className="px-5 py-4">
          <p className="text-sm font-semibold text-slate-700 whitespace-nowrap">
            {formatTanggalRetur(retur.dibuatPada)}
          </p>
        </td>

        {/* Tipe & Ref */}
        <td className="px-5 py-4">
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-1 rounded-lg border ${
              retur.jenis === 'SALES_RETURN'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-orange-50 text-orange-700 border-orange-200'
            }`}
          >
            {retur.jenis === 'SALES_RETURN' ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
            {labelJenisPendek(retur.jenis)}
          </span>
          <div className="mt-1.5 text-[11px] font-mono font-semibold text-slate-400">
            {retur.refId ? `#${retur.refId.slice(-10)}` : '—'}
          </div>
        </td>

        {/* Pihak */}
        <td className="px-5 py-4">
          <p className="text-sm font-bold text-slate-800">{retur.pihak || '—'}</p>
        </td>

        {/* Item */}
        <td className="px-5 py-4">
          <button
            onClick={onToggle}
            className={`flex items-center gap-1.5 text-sm font-bold transition-colors ${
              terbuka ? 'text-violet-600' : 'text-slate-600 hover:text-violet-600'
            }`}
          >
            <Package size={13} />
            {retur.items.length} item
            {terbuka ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {tanpaId > 0 && (
            <div className="mt-1 text-[10px] font-bold text-amber-600 flex items-center gap-1">
              <AlertTriangle size={10} /> {tanpaId} tanpa ID
            </div>
          )}
        </td>

        {/* Nilai */}
        <td className="px-5 py-4">
          <p className="text-sm font-black text-slate-900 whitespace-nowrap">
            {formatRupiah(retur.totalNilai)}
          </p>
        </td>

        {/* Status */}
        <td className="px-5 py-4">
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-black uppercase px-2.5 py-1 rounded-lg border ${WARNA_STATUS[retur.status]}`}
          >
            {retur.status === 'PENDING' && <Clock size={11} />}
            {retur.status === 'APPROVED' && <CheckCircle2 size={11} />}
            {retur.status === 'REJECTED' && <XCircle size={11} />}
            {labelStatus(retur.status)}
          </span>
        </td>

        {/* Aksi */}
        <td className="px-5 py-4">
          {retur.status === 'PENDING' ? (
            <div className="flex justify-end gap-2">
              <button
                title="Setujui retur"
                onClick={() => onProses('SETUJUI')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-all"
              >
                <CheckCircle2 size={13} />
                Setujui
              </button>
              <button
                title="Tolak retur"
                onClick={() => onProses('TOLAK')}
                className="p-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-100 transition-all"
              >
                <XCircle size={14} />
              </button>
            </div>
          ) : (
            <div className="text-right text-xs font-semibold text-slate-400">
              {formatTanggalRetur(retur.diprosesPada)}
            </div>
          )}
        </td>
      </tr>

      {/* Baris detail (expandable) */}
      {terbuka && (
        <tr className="bg-violet-50/20 border-l-2 border-violet-300">
          <td colSpan={7} className="px-5 py-4">
            <div className="space-y-3 max-w-4xl">
              {/* Alasan */}
              {retur.alasan && (
                <div className="flex items-start gap-2">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider pt-0.5 whitespace-nowrap">Alasan:</span>
                  <p className="text-sm font-semibold text-slate-700">{retur.alasan}</p>
                </div>
              )}

              {/* Tabel item */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Produk</th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center w-16">Qty</th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right w-28">Harga Satuan</th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {retur.items.map((item, idx) => (
                      <tr key={`${retur.id}-item-${idx}`} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-semibold text-slate-800">
                          {item.productName}
                          {item.unit && (
                            <span className="ml-1.5 text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                              {item.unit}
                            </span>
                          )}
                          {!item.productId && (
                            <span className="ml-2 text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 uppercase">
                              tanpa ID
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-slate-700">
                          <span>{item.quantity}</span>
                          {item.unit && (
                            <span className="ml-1 text-xs font-semibold text-slate-500 uppercase">{item.unit}</span>
                          )}
                          {item.contains && item.contains > 1 ? (
                            <span className="block text-[10px] font-semibold text-violet-600">
                              ({item.quantity * item.contains} unit dasar)
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-600">
                          {formatRupiah(item.price)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                          {formatRupiah(item.price * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="text-slate-400">Penyelesaian:</span>
                  <span className="font-bold text-slate-700">{labelPenyelesaian(retur.penyelesaian)}</span>
                </span>
                {retur.catatanProses && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-slate-400">Catatan:</span>
                    <span className="font-bold text-slate-700">{retur.catatanProses}</span>
                  </span>
                )}
                {(retur.nomorResi || retur.ekspedisi) && (
                  <span className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1">
                    <Truck size={12} className="text-violet-500 flex-shrink-0" />
                    <span className="font-bold text-violet-700">
                      {retur.ekspedisi && <span>{retur.ekspedisi} </span>}
                      {retur.nomorResi && <span className="font-mono">{retur.nomorResi}</span>}
                    </span>
                  </span>
                )}
                {retur.refId && retur.jenis === 'SALES_RETURN' && (
                  <Link
                    href={`/admin/orders/${retur.refId}`}
                    className="flex items-center gap-1 text-violet-600 hover:text-violet-700 font-bold transition-colors"
                  >
                    <ExternalLink size={12} />
                    Lihat pesanan
                  </Link>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ModalProses({
  data,
  busy,
  onUbah,
  onTutup,
  onJalankan,
}: {
  data: { retur: Retur; aksi: AksiRetur; penyelesaian: PenyelesaianRetur; catatan: string };
  busy: boolean;
  onUbah: (patch: Partial<{ penyelesaian: PenyelesaianRetur; catatan: string }>) => void;
  onTutup: () => void;
  onJalankan: () => void;
}) {
  const { retur, aksi } = data;
  const tanpaId = itemTanpaProduk(retur.items);
  const akun = akunJurnalRetur(retur.jenis, data.penyelesaian);
  const menyetujui = aksi === 'SETUJUI';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`p-5 sm:p-6 border-b ${menyetujui ? 'border-emerald-100 bg-emerald-50/50' : 'border-rose-100 bg-rose-50/50'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${menyetujui ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                {menyetujui ? (
                  <CheckCircle2 size={20} className="text-emerald-600" />
                ) : (
                  <XCircle size={20} className="text-rose-600" />
                )}
              </div>
              <div>
                <h2 className={`text-base font-black ${menyetujui ? 'text-emerald-900' : 'text-rose-900'}`}>
                  {menyetujui ? 'Setujui' : 'Tolak'} {labelJenis(retur.jenis)}
                </h2>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  {retur.pihak} · {retur.refId ? `#${retur.refId.slice(-10)}` : 'tanpa referensi'} · {formatRupiah(retur.totalNilai)}
                </p>
              </div>
            </div>
            <button
              onClick={onTutup}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white/80 rounded-lg transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Info dampak */}
          <div className={`rounded-xl p-4 border ${menyetujui ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
            <p className={`text-sm font-bold mb-2 ${menyetujui ? 'text-emerald-800' : 'text-rose-800'}`}>
              {menyetujui
                ? retur.jenis === 'SALES_RETURN'
                  ? '↩ Barang kembali ke gudang — stok bertambah'
                  : '↪ Barang keluar dari gudang — stok berkurang'
                : '✕ Stok & jurnal tidak akan berubah'}
            </p>
            <ul className="space-y-1">
              {retur.items.slice(0, 6).map((item, idx) => {
                const multiplier = Number(item.contains || 1);
                const totalFisik = item.quantity * multiplier;
                return (
                  <li key={idx} className="text-xs font-semibold text-slate-600 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${menyetujui ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <span className="truncate">{item.productName}</span>
                      {!item.productId && (
                        <span className="text-amber-600 font-bold text-[10px]">(tanpa ID)</span>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="font-bold text-slate-800">
                        {item.quantity} {item.unit || 'pcs'}
                        {multiplier > 1 && (
                          <span className="text-violet-600 font-semibold ml-1">({totalFisik} unit)</span>
                        )}
                      </span>
                      <span className="text-slate-400 font-normal ml-1.5">× {formatRupiah(item.price)}</span>
                    </div>
                  </li>
                );
              })}
              {retur.items.length > 6 && (
                <li className="text-xs font-semibold text-slate-400 pl-3.5">
                  … dan {retur.items.length - 6} item lainnya
                </li>
              )}
            </ul>
          </div>

          {/* Peringatan item tanpa ID */}
          {menyetujui && tanpaId.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs font-semibold text-amber-800">
                {tanpaId.length} item tidak punya ID produk — stoknya <strong>tidak akan</strong> disesuaikan.
              </p>
            </div>
          )}

          {/* Penyelesaian dana (hanya saat setujui) */}
          {menyetujui && (
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                Penyelesaian Dana
              </label>
              <select
                value={data.penyelesaian}
                onChange={(e) => onUbah({ penyelesaian: e.target.value as PenyelesaianRetur })}
                className="w-full bg-slate-50 border border-slate-200 focus:border-violet-400 p-3 rounded-xl text-sm font-semibold outline-none transition-all"
              >
                {opsiPenyelesaian(retur.jenis).map((p) => (
                  <option key={p} value={p}>
                    {labelPenyelesaian(p)}
                  </option>
                ))}
              </select>
              <div className={`text-xs font-semibold px-1 rounded-lg py-2 ${akun ? 'text-slate-600' : 'text-slate-400'}`}>
                {akun
                  ? `📒 Jurnal: Debit ${akun.debit} / Kredit ${akun.kredit} — ${formatRupiah(retur.totalNilai)}`
                  : '📭 Tanpa jurnal — tidak ada perpindahan uang yang dicatat.'}
              </div>
            </div>
          )}

          {/* Catatan */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              Catatan <span className="normal-case font-semibold text-slate-400">(opsional)</span>
            </label>
            <input
              value={data.catatan}
              onChange={(e) => onUbah({ catatan: e.target.value })}
              placeholder={menyetujui ? 'Contoh: barang diterima lengkap' : 'Contoh: barang sudah dipakai'}
              className="w-full bg-slate-50 border border-slate-200 focus:border-violet-400 p-3 rounded-xl text-sm font-semibold outline-none transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 sm:p-6 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={onTutup}
            className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
          >
            Batal
          </button>
          <button
            onClick={onJalankan}
            disabled={busy}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg disabled:opacity-50 active:scale-95 transition-all ${
              menyetujui
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
            }`}
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {menyetujui ? '✓ Setujui & Sesuaikan Stok' : '✕ Tolak Retur'}
          </button>
        </div>
      </div>
    </div>
  );
}
