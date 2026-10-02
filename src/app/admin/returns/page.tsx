'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  PackageSearch,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
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
  { nilai: 'SEMUA', label: 'Semua tipe' },
  { nilai: 'SALES_RETURN', label: 'Retur Jual' },
  { nilai: 'PURCHASE_RETURN', label: 'Retur Beli' },
];

/** Pilihan penyelesaian dana, dibedakan menurut jenis retur. */
function opsiPenyelesaian(jenis: JenisRetur): PenyelesaianRetur[] {
  return jenis === 'SALES_RETURN'
    ? ['TIDAK_DIRINCIKAN', 'TUNAI', 'DOMPET']
    : ['TIDAK_DIRINCIKAN', 'POTONG_HUTANG', 'TUNAI'];
}

const WARNA_STATUS: Record<StatusRetur, string> = {
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-100 text-rose-700 border-rose-200',
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
      // Server Action bisa gagal sebelum sampai ke server (mis. jaringan).
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
      const sudahAda = lama.find((i) => i.productId === produk.id);
      if (sudahAda) {
        return lama.map((i) => (i.productId === produk.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...lama,
        { productId: produk.id, productName: produk.name, quantity: 1, price: produk.price },
      ];
    });
    setCariKata('');
    setHasilCari([]);
  };

  const ubahQty = (productId: string, qty: number) => {
    const jumlah = Math.max(1, Math.floor(qty || 1));
    setItems((lama) => lama.map((i) => (i.productId === productId ? { ...i, quantity: jumlah } : i)));
  };

  const hapusItem = (productId: string) => {
    setItems((lama) => lama.filter((i) => i.productId !== productId));
  };

  const resetFormulir = () => {
    setJenis('SALES_RETURN');
    setRefId('');
    setPihak('');
    setAlasan('');
    setPenyelesaian('TIDAK_DIRINCIKAN');
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

  return (
    <div className="p-3 md:p-4 bg-slate-50/70 text-slate-800">
      <Toaster position="top-center" />
      <div className="max-w-6xl mx-auto space-y-4">
        {/* --- Kepala halaman --- */}
        <div className="flex flex-wrap justify-between items-end gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <RefreshCcw size={22} className="text-purple-600" /> Manajemen Retur
            </h1>
            <p className="text-[11px] uppercase font-bold text-slate-500 mt-1 tracking-wide">
              Pengembalian barang dari pelanggan &amp; ke supplier — stok dan jurnal tercatat otomatis saat
              disetujui.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void muatData()}
              disabled={memuat}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50 transition-all"
            >
              <RefreshCcw size={14} className={memuat ? 'animate-spin' : ''} /> Muat ulang
            </button>
            <button
              onClick={() => setModalBuat(true)}
              className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-slate-200 active:scale-95 transition-all"
            >
              <Plus size={15} /> Buat Retur
            </button>
          </div>
        </div>

        {/* --- Ringkasan --- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KartuRingkasan
            judul="Menunggu"
            nilai={String(ringkasan.menunggu)}
            catatan={formatRupiah(ringkasan.nilaiMenunggu)}
            warna="amber"
          />
          <KartuRingkasan
            judul="Disetujui"
            nilai={String(ringkasan.disetujui)}
            catatan={formatRupiah(ringkasan.nilaiDisetujui)}
            warna="emerald"
          />
          <KartuRingkasan judul="Ditolak" nilai={String(ringkasan.ditolak)} catatan="Tidak mengubah stok" warna="rose" />
          <KartuRingkasan judul="Total Data" nilai={String(ringkasan.jumlah)} catatan="500 terbaru" warna="slate" />
        </div>

        {totalItemTanpaProduk > 0 && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs font-semibold text-amber-800">
              {totalItemTanpaProduk} item retur menunggu <b>tidak punya ID produk</b> (warisan impor
              marketplace). Saat disetujui, item seperti itu <b>tidak</b> mengubah stok — sistem menolak
              menebak produknya.
            </p>
          </div>
        )}

        {galat && (
          <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-2xl p-4">
            <XCircle size={18} className="text-rose-600 mt-0.5 shrink-0" />
            <p className="text-xs font-semibold text-rose-800">{galat}</p>
          </div>
        )}

        {/* --- Penyaring --- */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                value={kataKunci}
                onChange={(e) => setKataKunci(e.target.value)}
                placeholder="Cari no. referensi, pelanggan, supplier, atau nama produk…"
                className="w-full bg-slate-50 border border-transparent focus:border-purple-400 rounded-2xl py-3 pl-11 pr-4 text-xs font-semibold outline-none transition-all"
              />
            </div>
            <select
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value as JenisRetur | 'SEMUA')}
              className="bg-slate-50 border border-transparent rounded-2xl py-3 px-4 text-xs font-black uppercase tracking-wide outline-none"
            >
              {FILTER_JENIS.map((f) => (
                <option key={f.nilai} value={f.nilai}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTER_STATUS.map((f) => (
              <button
                key={f.nilai}
                onClick={() => setFilterStatus(f.nilai)}
                className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide border transition-all ${
                  filterStatus === f.nilai
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
                {f.nilai !== 'SEMUA' && (
                  <span className="ml-1.5 opacity-70">
                    {f.nilai === 'PENDING'
                      ? ringkasan.menunggu
                      : f.nilai === 'APPROVED'
                        ? ringkasan.disetujui
                        : ringkasan.ditolak}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* --- Daftar retur --- */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[880px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Tanggal', 'Tipe / Ref', 'Pihak', 'Item', 'Nilai', 'Status', 'Aksi'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {memuat ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="animate-pulse">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="h-3 bg-slate-100 rounded-full" />
                      </td>
                    </tr>
                  ))
                ) : terlihat.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center">
                      <PackageSearch size={28} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        {daftar.length === 0
                          ? 'Belum ada retur tercatat.'
                          : 'Tidak ada retur yang cocok dengan filter.'}
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
        </div>

        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
          Disetujui = stok bergerak + jurnal dicatat (bila melibatkan uang) · Ditolak = status saja
        </p>
      </div>

      {/* ================= Modal: buat retur ================= */}
      {modalBuat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black text-slate-900">Buat Permintaan Retur</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Stok baru berubah setelah disetujui
                </p>
              </div>
              <button
                onClick={() => setModalBuat(false)}
                className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                aria-label="Tutup"
              >
                <XCircle size={22} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    Tipe Retur
                  </label>
                  <select
                    value={jenis}
                    onChange={(e) => {
                      setJenis(e.target.value as JenisRetur);
                      setPenyelesaian('TIDAK_DIRINCIKAN');
                    }}
                    className="w-full bg-slate-50 p-3.5 rounded-2xl text-xs font-black outline-none border border-transparent focus:border-purple-400"
                  >
                    <option value="SALES_RETURN">Retur Penjualan (dari pelanggan)</option>
                    <option value="PURCHASE_RETURN">Retur Pembelian (ke supplier)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    No. Referensi
                  </label>
                  <input
                    value={refId}
                    onChange={(e) => setRefId(e.target.value)}
                    placeholder="Order ID / PO number"
                    className="w-full bg-slate-50 p-3.5 rounded-2xl text-xs font-bold outline-none border border-transparent focus:border-purple-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  {jenis === 'SALES_RETURN' ? 'Nama Pelanggan' : 'Nama Supplier'}
                </label>
                <input
                  value={pihak}
                  onChange={(e) => setPihak(e.target.value)}
                  placeholder={jenis === 'SALES_RETURN' ? 'Contoh: Customer TikTok' : 'Contoh: PT Sumber Jaya'}
                  className="w-full bg-slate-50 p-3.5 rounded-2xl text-xs font-bold outline-none border border-transparent focus:border-purple-400"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Produk
                </label>
                <div className="relative">
                  <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    value={cariKata}
                    onChange={(e) => setCariKata(e.target.value)}
                    placeholder="Ketik minimal 2 huruf untuk mencari produk…"
                    className="w-full bg-slate-50 p-3.5 pl-11 rounded-2xl text-xs font-bold outline-none border border-transparent focus:border-purple-400"
                  />
                  {mencari && (
                    <Loader2
                      size={15}
                      className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                    />
                  )}
                </div>

                {hasilCari.length > 0 && (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50">
                    {hasilCari.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => tambahItem(p)}
                        className="w-full p-3 text-left hover:bg-slate-50 flex justify-between items-center gap-3"
                      >
                        <span className="text-xs font-black text-slate-800">{p.name}</span>
                        <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
                          {formatRupiah(p.price)} · stok {p.stock}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {items.length > 0 && (
                  <div className="bg-slate-50 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/60">
                        <tr>
                          <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase">Produk</th>
                          <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase text-center w-20">
                            Qty
                          </th>
                          <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase text-right w-28">
                            Subtotal
                          </th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item, idx) => (
                          <tr key={`${item.productId}-${idx}`} className="bg-white">
                            <td className="px-3 py-2 font-black text-slate-700">{item.productName}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => ubahQty(item.productId, Number(e.target.value))}
                                className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-black text-center outline-none focus:ring-1 focus:ring-purple-400"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-black text-slate-800">
                              {formatRupiah(item.price * item.quantity)}
                            </td>
                            <td className="px-2 py-2 text-right">
                              <button
                                onClick={() => hapusItem(item.productId)}
                                className="p-1.5 text-slate-300 hover:text-rose-500 transition-all"
                                aria-label="Hapus item"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Alasan Retur
                </label>
                <textarea
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Contoh: barang rusak saat pengiriman / salah kirim model"
                  className="w-full bg-slate-50 p-3.5 rounded-2xl text-xs font-semibold outline-none border border-transparent focus:border-purple-400 h-20 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Penyelesaian Dana (saat disetujui)
                </label>
                <select
                  value={penyelesaian}
                  onChange={(e) => setPenyelesaian(e.target.value as PenyelesaianRetur)}
                  className="w-full bg-slate-50 p-3.5 rounded-2xl text-xs font-bold outline-none border border-transparent focus:border-purple-400"
                >
                  {opsiPenyelesaian(jenis).map((p) => (
                    <option key={p} value={p}>
                      {labelPenyelesaian(p)}
                    </option>
                  ))}
                </select>
                <p className="flex items-start gap-1.5 text-[10px] font-semibold text-slate-400 px-1 pt-1">
                  <Info size={12} className="mt-0.5 shrink-0" />
                  Jurnal hanya dibuat bila dananya benar-benar bergerak. Retur marketplace (dipotong dari
                  pencairan) pilih &quot;Tanpa jurnal&quot;.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex flex-wrap justify-between items-center gap-3">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Nilai Retur</p>
                <p className="text-xl font-black text-slate-900">{formatRupiah(totalFormulir)}</p>
              </div>
              <button
                onClick={() => void simpanRetur()}
                disabled={menyimpan}
                className="flex items-center gap-2 bg-purple-600 text-white px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-purple-100 hover:bg-purple-700 active:scale-95 disabled:opacity-60 transition-all"
              >
                {menyimpan && <Loader2 size={15} className="animate-spin" />} Simpan Retur
              </button>
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

const WARNA_KARTU: Record<string, string> = {
  amber: 'text-amber-600 bg-amber-50 border-amber-100',
  emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  rose: 'text-rose-600 bg-rose-50 border-rose-100',
  slate: 'text-slate-600 bg-slate-50 border-slate-100',
};

function KartuRingkasan({
  judul,
  nilai,
  catatan,
  warna,
}: {
  judul: string;
  nilai: string;
  catatan: string;
  warna: string;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{judul}</p>
        <span
          className={`px-2 py-0.5 rounded-lg border text-[10px] font-black ${
            WARNA_KARTU[warna] ?? WARNA_KARTU.slate
          }`}
        >
          {nilai}
        </span>
      </div>
      <p className="mt-2 text-xs font-bold text-slate-600">{catatan}</p>
    </div>
  );
}

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
      <tr className="hover:bg-slate-50/70 align-top">
        <td className="px-4 py-3 text-[11px] font-bold text-slate-600 whitespace-nowrap">
          {formatTanggalRetur(retur.dibuatPada)}
        </td>
        <td className="px-4 py-3">
          <span
            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${
              retur.jenis === 'SALES_RETURN'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-orange-50 text-orange-700 border-orange-200'
            }`}
          >
            {labelJenisPendek(retur.jenis)}
          </span>
          <div className="mt-1 text-[11px] font-mono font-bold text-slate-500">
            {retur.refId ? `#${retur.refId.slice(-10)}` : '—'}
          </div>
        </td>
        <td className="px-4 py-3 text-xs font-black text-slate-800">{retur.pihak}</td>
        <td className="px-4 py-3">
          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-purple-600 transition-all"
          >
            {retur.items.length} produk
            {terbuka ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {tanpaId > 0 && (
            <div className="mt-1 text-[10px] font-black text-amber-600 uppercase">{tanpaId} tanpa ID produk</div>
          )}
        </td>
        <td className="px-4 py-3 text-xs font-black text-slate-900 whitespace-nowrap">
          {formatRupiah(retur.totalNilai)}
        </td>
        <td className="px-4 py-3">
          <span
            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${WARNA_STATUS[retur.status]}`}
          >
            {labelStatus(retur.status)}
          </span>
        </td>
        <td className="px-4 py-3">
          {retur.status === 'PENDING' ? (
            <div className="flex justify-end gap-1.5">
              <button
                title="Setujui"
                onClick={() => onProses('SETUJUI')}
                className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 border border-emerald-200 transition-all"
              >
                <CheckCircle2 size={15} />
              </button>
              <button
                title="Tolak"
                onClick={() => onProses('TOLAK')}
                className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 border border-rose-200 transition-all"
              >
                <XCircle size={15} />
              </button>
            </div>
          ) : (
            <div className="text-right text-[10px] font-bold text-slate-400">
              {formatTanggalRetur(retur.diprosesPada)}
            </div>
          )}
        </td>
      </tr>

      {terbuka && (
        <tr className="bg-slate-50/60">
          <td colSpan={7} className="px-4 py-4 space-y-3">
            <p className="text-[11px] font-bold text-slate-500">
              <span className="uppercase tracking-widest font-black text-slate-400">Alasan: </span>
              {retur.alasan || '—'}
            </p>
            <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[520px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 font-black text-slate-400 uppercase text-[10px]">Produk</th>
                    <th className="px-3 py-2 font-black text-slate-400 uppercase text-[10px] text-center w-20">
                      Qty
                    </th>
                    <th className="px-3 py-2 font-black text-slate-400 uppercase text-[10px] text-right w-32">
                      Harga
                    </th>
                    <th className="px-3 py-2 font-black text-slate-400 uppercase text-[10px] text-right w-32">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {retur.items.map((item, idx) => (
                    <tr key={`${retur.id}-item-${idx}`}>
                      <td className="px-3 py-2 font-bold text-slate-700">
                        {item.productName}
                        {!item.productId && (
                          <span className="ml-2 text-[9px] font-black text-amber-600 uppercase">tanpa ID</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center font-black">{item.quantity}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-600">
                        {formatRupiah(item.price)}
                      </td>
                      <td className="px-3 py-2 text-right font-black text-slate-800">
                        {formatRupiah(item.price * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-4 text-[11px] font-semibold text-slate-500">
              <span>
                Penyelesaian: <b className="text-slate-700">{labelPenyelesaian(retur.penyelesaian)}</b>
              </span>
              {retur.catatanProses && (
                <span>
                  Catatan proses: <b className="text-slate-700">{retur.catatanProses}</b>
                </span>
              )}
              {retur.refId && retur.jenis === 'SALES_RETURN' && (
                <Link href={`/admin/orders/${retur.refId}`} className="text-blue-600 hover:underline font-black">
                  Buka pesanan →
                </Link>
              )}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-black text-slate-900">
            {menyetujui ? 'Setujui' : 'Tolak'} {labelJenis(retur.jenis)}
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
            {retur.pihak} · {retur.refId ? `#${retur.refId}` : 'tanpa referensi'} ·{' '}
            {formatRupiah(retur.totalNilai)}
          </p>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-xs">
            <p className="font-bold text-slate-600">
              {menyetujui
                ? retur.jenis === 'SALES_RETURN'
                  ? 'Barang kembali ke gudang utama (stok bertambah).'
                  : 'Barang keluar dari gudang (stok berkurang).'
                : 'Stok & jurnal TIDAK berubah.'}
            </p>
            <ul className="space-y-1 text-[11px] font-semibold text-slate-500 list-disc list-inside">
              {retur.items.slice(0, 6).map((item, idx) => (
                <li key={idx}>
                  {item.productName} — {item.quantity} × {formatRupiah(item.price)}
                  {!item.productId && <b className="text-amber-600"> (tanpa ID produk)</b>}
                </li>
              ))}
              {retur.items.length > 6 && <li>… dan {retur.items.length - 6} item lainnya</li>}
            </ul>
          </div>

          {menyetujui && tanpaId.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-2xl p-3">
              <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[11px] font-semibold text-amber-800">
                {tanpaId.length} item tidak punya ID produk — stoknya tidak akan disesuaikan.
              </p>
            </div>
          )}

          {menyetujui && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                Penyelesaian Dana
              </label>
              <select
                value={data.penyelesaian}
                onChange={(e) => onUbah({ penyelesaian: e.target.value as PenyelesaianRetur })}
                className="w-full bg-slate-50 p-3.5 rounded-2xl text-xs font-bold outline-none border border-transparent focus:border-purple-400"
              >
                {opsiPenyelesaian(retur.jenis).map((p) => (
                  <option key={p} value={p}>
                    {labelPenyelesaian(p)}
                  </option>
                ))}
              </select>
              <p className="text-[10px] font-bold text-slate-400 px-1 pt-0.5">
                {akun
                  ? `Jurnal: Debit ${akun.debit} / Kredit ${akun.kredit} ${formatRupiah(retur.totalNilai)}`
                  : 'Tanpa jurnal — tidak ada perpindahan uang yang dicatat.'}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
              Catatan (opsional)
            </label>
            <input
              value={data.catatan}
              onChange={(e) => onUbah({ catatan: e.target.value })}
              placeholder={menyetujui ? 'Contoh: barang diterima lengkap' : 'Contoh: barang sudah dipakai'}
              className="w-full bg-slate-50 p-3.5 rounded-2xl text-xs font-semibold outline-none border border-transparent focus:border-purple-400"
            />
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-2">
          <button
            onClick={onTutup}
            className="px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
          >
            Batal
          </button>
          <button
            onClick={onJalankan}
            disabled={busy}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white disabled:opacity-60 transition-all ${
              menyetujui ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {menyetujui ? 'Setujui & Sesuaikan Stok' : 'Tolak Retur'}
          </button>
        </div>
      </div>
    </div>
  );
}
