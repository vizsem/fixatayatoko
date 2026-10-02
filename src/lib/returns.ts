/**
 * Retur penjualan & pembelian — logika murni (tanpa jaringan, tanpa React).
 *
 * Halaman `admin/returns` sebelumnya menulis langsung dari peramban memakai
 * `supabaseAdmin` (yang di peramban hanya kunci anon tanpa sesi) sehingga
 * persetujuan retur SELALU gagal: stok tidak pernah bertambah dan jurnal tidak
 * pernah tercatat — kegagalannya ditelan `console.error`. Modul ini memuat
 * aturan yang dipakai bersama oleh Server Action (`returns.actions.ts`) dan
 * halaman, supaya keduanya tidak mungkin berbeda tafsir.
 *
 * Bentuk baris di Supabase (terverifikasi 2026-10-02): tabel `returns` hanya
 * punya kolom `id`, `raw_data`, `created_at`, `updated_at`. Seluruh isi retur
 * ada di dalam `raw_data`, dan sebagian berisi timestamp gaya Firestore
 * (`{ _seconds, _nanoseconds }`) karena warisan impor.
 */

export type JenisRetur = 'SALES_RETURN' | 'PURCHASE_RETURN';
export type StatusRetur = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Bagaimana uang diselesaikan saat retur disetujui.
 *
 * SENGAJA bisa "tidak dirincikan": banyak retur datang dari marketplace
 * (Shopee/TikTok) yang pengembalian dananya dipotong dari pencairan, sehingga
 * TIDAK ada kas yang keluar dari toko. Menulis "Cash" untuk kasus itu akan
 * membuat neraca salah — dan itu jauh lebih berbahaya daripada tidak menulis
 * jurnal sama sekali.
 */
export type PenyelesaianRetur =
  | 'TIDAK_DIRINCIKAN'
  | 'TUNAI'
  | 'DOMPET'
  | 'POTONG_HUTANG';

export interface ItemRetur {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Retur {
  id: string;
  jenis: JenisRetur;
  refId: string;
  pihak: string;
  alasan: string;
  status: StatusRetur;
  items: ItemRetur[];
  totalNilai: number;
  penyelesaian: PenyelesaianRetur;
  dibuatPada: string | null;
  diprosesPada: string | null;
  diprosesOleh: string;
  catatanProses: string;
}

export const JENIS_RETUR: JenisRetur[] = ['SALES_RETURN', 'PURCHASE_RETURN'];
export const STATUS_RETUR: StatusRetur[] = ['PENDING', 'APPROVED', 'REJECTED'];
export const PENYELESAIAN_RETUR: PenyelesaianRetur[] = [
  'TIDAK_DIRINCIKAN',
  'TUNAI',
  'DOMPET',
  'POTONG_HUTANG',
];

const LABEL_JENIS: Record<JenisRetur, string> = {
  SALES_RETURN: 'Retur Penjualan',
  PURCHASE_RETURN: 'Retur Pembelian',
};

const LABEL_JENIS_PENDEK: Record<JenisRetur, string> = {
  SALES_RETURN: 'RETUR JUAL',
  PURCHASE_RETURN: 'RETUR BELI',
};

const LABEL_STATUS: Record<StatusRetur, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
};

const LABEL_PENYELESAIAN: Record<PenyelesaianRetur, string> = {
  TIDAK_DIRINCIKAN: 'Tanpa jurnal (dana tidak dari kas)',
  TUNAI: 'Tunai dari kas',
  DOMPET: 'Masuk ke dompet pelanggan',
  POTONG_HUTANG: 'Memotong hutang ke supplier',
};

export function labelJenis(jenis: JenisRetur): string {
  return LABEL_JENIS[jenis] ?? 'Retur';
}

export function labelJenisPendek(jenis: JenisRetur): string {
  return LABEL_JENIS_PENDEK[jenis] ?? 'RETUR';
}

export function labelStatus(status: StatusRetur): string {
  return LABEL_STATUS[status] ?? status;
}

export function labelPenyelesaian(penyelesaian: PenyelesaianRetur): string {
  return LABEL_PENYELESAIAN[penyelesaian] ?? penyelesaian;
}

/** Retur hanya boleh diproses sekali: dari PENDING ke APPROVED/REJECTED. */
export function bolehDiproses(status: StatusRetur): boolean {
  return status === 'PENDING';
}

/**
 * Akun jurnal untuk sebuah retur.
 *
 * `null` berarti retur tetap dicatat (stok disesuaikan) tetapi TIDAK ada
 * perpindahan uang yang boleh dikarang-karang.
 */
export function akunJurnalRetur(
  jenis: JenisRetur,
  penyelesaian: PenyelesaianRetur
): { debit: string; kredit: string } | null {
  if (penyelesaian === 'TIDAK_DIRINCIKAN') return null;

  if (jenis === 'SALES_RETURN') {
    // Penjualan dibatalkan (debit Sales sebagai kontra-pendapatan), dan uangnya
    // keluar dari kas atau dari dompet pelanggan.
    if (penyelesaian === 'TUNAI') return { debit: 'Sales', kredit: 'Cash' };
    if (penyelesaian === 'DOMPET') return { debit: 'Sales', kredit: 'CustomerWallet' };
    return null;
  }

  // Retur pembelian: barang keluar ke supplier, nilainya mengurangi persediaan.
  if (penyelesaian === 'TUNAI') return { debit: 'Cash', kredit: 'Inventory' };
  if (penyelesaian === 'POTONG_HUTANG') {
    return { debit: 'AccountsPayable', kredit: 'Inventory' };
  }
  return null;
}

/** Ubah berbagai bentuk tanggal (ISO, Date, Firestore `{_seconds}`) ke ISO. */
export function tanggalKeIso(nilai: unknown): string | null {
  if (!nilai) return null;

  if (nilai instanceof Date) {
    return isNaN(nilai.getTime()) ? null : nilai.toISOString();
  }

  if (typeof nilai === 'number') {
    // Detik vs milidetik: nilai wajar epoch detik < 1e12.
    const ms = nilai < 1e12 ? nilai * 1000 : nilai;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (typeof nilai === 'string') {
    const d = new Date(nilai);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (typeof nilai === 'object') {
    const rec = nilai as Record<string, unknown>;
    const detik = rec._seconds ?? rec.seconds;
    if (typeof detik === 'number') {
      const nanos = Number(rec._nanoseconds ?? rec.nanoseconds ?? 0);
      const d = new Date(detik * 1000 + nanos / 1e6);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (typeof rec.toISOString === 'function') {
      try {
        const iso = (rec.toISOString as () => unknown).call(rec);
        if (typeof iso === 'string') return iso;
      } catch {
        return null;
      }
    }
  }

  return null;
}

export function normalisasiJenis(nilai: unknown): JenisRetur {
  return nilai === 'PURCHASE_RETURN' ? 'PURCHASE_RETURN' : 'SALES_RETURN';
}

export function normalisasiStatus(nilai: unknown): StatusRetur {
  const teks = String(nilai ?? '').trim().toUpperCase();
  if (teks === 'APPROVED' || teks === 'DISETUJUI') return 'APPROVED';
  if (teks === 'REJECTED' || teks === 'DITOLAK') return 'REJECTED';
  return 'PENDING';
}

export function normalisasiPenyelesaian(nilai: unknown): PenyelesaianRetur {
  const teks = String(nilai ?? '').trim().toUpperCase();
  if (teks === 'TUNAI' || teks === 'CASH') return 'TUNAI';
  if (teks === 'DOMPET' || teks === 'WALLET') return 'DOMPET';
  if (teks === 'POTONG_HUTANG' || teks === 'AP') return 'POTONG_HUTANG';
  return 'TIDAK_DIRINCIKAN';
}

/** Bersihkan satu baris item dari data apa pun (data lama kerap tidak lengkap). */
export function normalisasiItem(nilai: unknown): ItemRetur | null {
  if (!nilai || typeof nilai !== 'object') return null;
  const rec = nilai as Record<string, unknown>;

  const nama = String(rec.productName ?? rec.name ?? '').trim();
  const quantity = Math.floor(Number(rec.quantity ?? rec.qty ?? 0));
  const price = Number(rec.price ?? 0);

  if (!nama && !rec.productId) return null;
  if (!Number.isFinite(quantity) || quantity < 1) return null;

  return {
    productId: String(rec.productId ?? '').trim(),
    productName: nama || 'Produk tanpa nama',
    quantity,
    price: Number.isFinite(price) && price > 0 ? price : 0,
  };
}

export function normalisasiItems(nilai: unknown): ItemRetur[] {
  if (!Array.isArray(nilai)) return [];
  return nilai.map(normalisasiItem).filter((i): i is ItemRetur => i !== null);
}

export function totalDariItems(items: ItemRetur[]): number {
  return (items || []).reduce((acc, i) => acc + i.quantity * i.price, 0);
}

/**
 * Ubah baris tabel `returns` (sudah diratakan `mergeRowWithRawData`) menjadi
 * bentuk yang dipakai halaman.
 */
export function keRetur(baris: Record<string, any> | null | undefined): Retur {
  const raw = (baris ?? {}) as Record<string, any>;
  const items = normalisasiItems(raw.items);

  // Total SELALU dihitung ulang dari item: nilai yang tersimpan bisa saja
  // warisan impor yang tidak konsisten (atau hasil hitungan klien yang salah).
  const totalTersimpan = Number(raw.totalValue ?? raw.total ?? 0);
  const totalNilai = items.length > 0 ? totalDariItems(items) : totalTersimpan;

  return {
    id: String(raw.id ?? ''),
    jenis: normalisasiJenis(raw.type ?? raw.jenis),
    refId: String(raw.refId ?? raw.referenceId ?? '').trim(),
    pihak: String(raw.customerOrSupplierName ?? raw.pihak ?? '').trim() || '—',
    alasan: String(raw.reason ?? raw.alasan ?? '').trim(),
    status: normalisasiStatus(raw.status),
    items,
    totalNilai: Number.isFinite(totalNilai) ? totalNilai : 0,
    penyelesaian: normalisasiPenyelesaian(raw.penyelesaian),
    dibuatPada: tanggalKeIso(raw.created_at ?? raw.createdAt),
    diprosesPada: tanggalKeIso(raw.processedAt ?? raw.diprosesPada),
    diprosesOleh: String(raw.processedBy ?? raw.diprosesOleh ?? '').trim(),
    catatanProses: String(raw.processNote ?? raw.catatanProses ?? '').trim(),
  };
}

export function keDaftarRetur(baris: Array<Record<string, any>>): Retur[] {
  return (baris || []).map(keRetur);
}

export interface RingkasanRetur {
  jumlah: number;
  menunggu: number;
  disetujui: number;
  ditolak: number;
  nilaiMenunggu: number;
  nilaiDisetujui: number;
  itemTanpaProduk: number;
}

export function ringkasRetur(daftar: Retur[]): RingkasanRetur {
  const ringkasan: RingkasanRetur = {
    jumlah: daftar.length,
    menunggu: 0,
    disetujui: 0,
    ditolak: 0,
    nilaiMenunggu: 0,
    nilaiDisetujui: 0,
    itemTanpaProduk: 0,
  };

  for (const retur of daftar) {
    if (retur.status === 'PENDING') {
      ringkasan.menunggu += 1;
      ringkasan.nilaiMenunggu += retur.totalNilai;
    } else if (retur.status === 'APPROVED') {
      ringkasan.disetujui += 1;
      ringkasan.nilaiDisetujui += retur.totalNilai;
    } else {
      ringkasan.ditolak += 1;
    }
    if (retur.status === 'PENDING') {
      ringkasan.itemTanpaProduk += itemTanpaProduk(retur.items).length;
    }
  }

  return ringkasan;
}

/**
 * Item yang TIDAK punya `productId` tidak bisa disesuaikan stoknya.
 *
 * Data warisan impor kerap begini (mis. retur Shopee hanya menyimpan nama
 * produk). Menyesuaikan stok tanpa id produk = menebak; itu dilarang. Item
 * seperti ini tetap tercatat pada retur, dan jumlahnya DITAMPILKAN ke pengguna.
 */
export function itemTanpaProduk(items: ItemRetur[]): ItemRetur[] {
  return (items || []).filter((i) => !i.productId);
}

export interface FilterRetur {
  status?: StatusRetur | 'SEMUA';
  jenis?: JenisRetur | 'SEMUA';
  kata?: string;
}

export function saringRetur(daftar: Retur[], filter: FilterRetur = {}): Retur[] {
  const kata = (filter.kata ?? '').trim().toLowerCase();

  return (daftar || []).filter((retur) => {
    if (filter.status && filter.status !== 'SEMUA' && retur.status !== filter.status) return false;
    if (filter.jenis && filter.jenis !== 'SEMUA' && retur.jenis !== filter.jenis) return false;
    if (!kata) return true;

    const bahan = [
      retur.refId,
      retur.pihak,
      retur.alasan,
      ...retur.items.map((i) => i.productName),
    ]
      .join(' ')
      .toLowerCase();

    return bahan.includes(kata);
  });
}

export interface InputReturBaru {
  jenis: JenisRetur;
  refId: string;
  pihak: string;
  alasan: string;
  items: ItemRetur[];
}

/** Pesan kesalahan pertama, atau `null` bila valid. */
export function validasiReturBaru(input: Partial<InputReturBaru>): string | null {
  if (!input.jenis || !JENIS_RETUR.includes(input.jenis)) return 'Jenis retur tidak dikenal.';
  if (!String(input.refId ?? '').trim()) return 'Nomor referensi (order / pembelian) wajib diisi.';
  if (!String(input.pihak ?? '').trim()) {
    return input.jenis === 'SALES_RETURN'
      ? 'Nama pelanggan wajib diisi.'
      : 'Nama supplier wajib diisi.';
  }

  const items = normalisasiItems(input.items ?? []);
  if (items.length === 0) return 'Tambahkan minimal satu produk.';
  if (items.some((i) => i.quantity < 1)) return 'Jumlah setiap produk minimal 1.';
  if (items.some((i) => i.price <= 0)) return 'Harga produk belum terbaca. Pilih produk dari daftar.';

  return null;
}

export function formatRupiah(nilai: number): string {
  const angka = Number.isFinite(nilai) ? nilai : 0;
  return `Rp ${Math.round(angka).toLocaleString('id-ID')}`;
}

/** Tanggal + jam dalam zona waktu toko, mis. "2 Okt 2026, 09.15". */
export function formatTanggalRetur(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
