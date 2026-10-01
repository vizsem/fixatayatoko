/**
 * Aturan rekonsiliasi Purchase Order ↔ buku besar modal.
 *
 * FUNGSI MODUL INI
 * ----------------
 * Membandingkan, untuk setiap PO, berapa uang yang SEHARUSNYA sudah keluar dari
 * modal dengan berapa yang SUDAH tercatat di `capital_transactions`. Selisihnya
 * ditampilkan di halaman `/admin/capital/rekonsiliasi` dan bisa diterapkan lewat
 * skrip `npm run reconcile:capital-po`.
 *
 * Penyebab selisihnya adalah bug nyata: pencatatan modal untuk PO dulu dilakukan
 * di peramban lewat `writeBatch` yang selalu gagal dengan senyap, sehingga
 * pembelian tunai tidak pernah mengurangi saldo modal (lihat `capital-ledger.ts`).
 *
 * MENGAPA TANPA IMPOR SAMA SEKALI
 * -------------------------------
 * Modul ini dipakai tiga tempat:
 *   1. Server Action (`src/lib/actions/capital-reconcile.actions.ts`),
 *   2. skrip terminal `scripts/reconcile-capital-po.mjs` — Node menjalankan
 *      berkas `.ts` ini langsung (type stripping), dan Node TIDAK mengenal alias
 *      `@/`, sehingga modul ini tidak boleh mengimpor apa pun,
 *   3. unit test.
 *
 * Jadi: JANGAN menambahkan `import` di berkas ini. Aturan mainnya murni.
 */

export type CapitalEntryType = 'INJECTION' | 'WITHDRAWAL';

/**
 * Metode pembayaran yang benar-benar mengeluarkan uang saat PO dibuat.
 *
 * Nilai ini sengaja PERSIS SAMA dengan pilihan di formulir PO
 * (`CASH`/`TRANSFER`/`HUTANG`) dan dengan perilaku aplikasi sebelum migrasi,
 * supaya tidak ada perubahan arti akuntansi secara diam-diam. Pembayaran
 * `HUTANG` (tempo) tidak menyentuh modal sampai nanti dilunasi.
 */
export const METODE_KELUAR_UANG: readonly string[] = ['CASH', 'TRANSFER'];

/** Apakah PO ini mengeluarkan uang tunai/transfer saat dibuat? */
export function pembayaranKeluarUang(
  paymentStatus?: string | null,
  paymentMethod?: string | null
): boolean {
  const status = String(paymentStatus ?? '').trim().toUpperCase();
  const metode = String(paymentMethod ?? '').trim().toUpperCase();
  return status === 'LUNAS' && METODE_KELUAR_UANG.includes(metode);
}

/** Normalkan jenis mutasi apa pun menjadi `INJECTION`/`WITHDRAWAL`/`null`. */
export function bacaJenisMutasi(nilai: unknown): CapitalEntryType | null {
  const teks = String(nilai ?? '').trim().toUpperCase();
  if (teks === 'INJECTION') return 'INJECTION';
  if (teks === 'WITHDRAWAL') return 'WITHDRAWAL';
  return null;
}

/**
 * Nominal mutasi yang layak dihitung.
 *
 * Nilai kosong, bukan angka, atau <= 0 dianggap 0 — baris seperti itu tidak
 * mengubah apa pun dan tidak boleh membuat saldo melompat.
 */
export function bacaNominalMutasi(nilai: unknown): number {
  const angka = Number(nilai);
  return Number.isFinite(angka) && angka > 0 ? angka : 0;
}

export type MutasiTercatat = {
  /** Total uang yang masuk kembali / ditambahkan ke modal. */
  injection: number;
  /** Total uang yang keluar dari modal. */
  withdrawal: number;
  /** Jumlah baris yang diperiksa. */
  count: number;
};

/** Posisi bersih: positif berarti uang sudah keluar dari modal. */
export function posisiTercatat(mutasi: MutasiTercatat | undefined): number {
  if (!mutasi) return 0;
  return mutasi.withdrawal - mutasi.injection;
}

/** PO sebagaimana dibutuhkan rekonsiliasi (sudah dinormalkan pemanggil). */
export type POUntukRekonsiliasi = {
  id: string;
  poNumber: string;
  createdAt: string;
  supplierName: string;
  paymentStatus: string;
  paymentMethod: string;
  /** Nominal PO. */
  total: number;
};

/** Baris hasil perbandingan yang ditampilkan ke pengguna. */
export type BarisRekonsiliasi = {
  poId: string;
  poNumber: string;
  createdAt: string;
  supplierName: string;
  paymentMethod: string;
  /** Uang yang SEHARUSNYA sudah keluar untuk PO ini (0 bila tempo/batal). */
  diharapkan: number;
  /** Uang yang SUDAH tercatat keluar untuk PO ini. */
  tercatat: number;
  /** Positif = modal belum dipotong; negatif = modal terpotong lebih besar. */
  selisih: number;
};

/** Uang yang seharusnya sudah keluar untuk sebuah PO. */
export function kebutuhanModalPO(po: {
  total: number;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
}): number {
  if (!pembayaranKeluarUang(po.paymentStatus, po.paymentMethod)) return 0;
  const total = Number(po.total);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

/** Satu baris mutasi yang sudah diratakan pemanggil (tanpa `raw_data`). */
export type MutasiMentah = {
  referenceId?: string | null;
  type?: unknown;
  amount?: unknown;
};

/**
 * Kelompokkan mutasi modal per `referenceId` (id PO).
 *
 * Baris tanpa `referenceId` (mis. penyesuaian modal manual) memang diabaikan —
 * baris itu tidak dimiliki PO mana pun.
 */
export function ringkasMutasiPerPO(
  baris: MutasiMentah[]
): Map<string, MutasiTercatat> {
  const perPO = new Map<string, MutasiTercatat>();

  for (const b of baris || []) {
    const ref = String(b?.referenceId ?? '').trim();
    if (!ref) continue;

    const jenis = bacaJenisMutasi(b.type);
    const nominal = bacaNominalMutasi(b.amount);

    const cur = perPO.get(ref) ?? { injection: 0, withdrawal: 0, count: 0 };
    cur.count += 1;
    if (jenis === 'INJECTION') cur.injection += nominal;
    else if (jenis === 'WITHDRAWAL') cur.withdrawal += nominal;
    perPO.set(ref, cur);
  }

  return perPO;
}

/**
 * Bandingkan daftar PO dengan mutasi modal yang tercatat.
 *
 * Hanya baris yang selisihnya BUKAN nol yang dikembalikan, terbaru lebih dulu.
 */
export function bandingkanPO(
  pos: POUntukRekonsiliasi[],
  tercatat: Map<string, MutasiTercatat>
): BarisRekonsiliasi[] {
  const hasil: BarisRekonsiliasi[] = [];

  for (const po of pos || []) {
    const diharapkan = Math.round(kebutuhanModalPO(po));
    const adaTercatat = posisiTercatat(tercatat.get(po.id));
    const selisih = diharapkan - adaTercatat;
    if (selisih === 0) continue;

    hasil.push({
      poId: po.id,
      poNumber: po.poNumber,
      createdAt: po.createdAt,
      supplierName: po.supplierName,
      paymentMethod: String(po.paymentMethod ?? '').toUpperCase(),
      diharapkan,
      tercatat: adaTercatat,
      selisih,
    });
  }

  hasil.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return hasil;
}

/**
 * Baca waktu dari berbagai bentuk menjadi ISO string ('' bila tidak terbaca).
 *
 * Baris hasil impor Firestore menyimpan tanggal sebagai objek
 * `{ _seconds, _nanoseconds }`. Tanpa normalisasi, `String(objek)` menghasilkan
 * `"[object Object]"` sehingga pengurutan dan filter tanggal jadi kacau.
 */
export function bacaWaktuPO(nilai: unknown): string {
  if (!nilai) return '';

  if (nilai instanceof Date) {
    return isNaN(nilai.getTime()) ? '' : nilai.toISOString();
  }

  if (typeof nilai === 'object') {
    const obj = nilai as Record<string, any>;
    const detik = typeof obj._seconds === 'number' ? obj._seconds : typeof obj.seconds === 'number' ? obj.seconds : undefined;
    if (detik !== undefined) return new Date(detik * 1000).toISOString();
    if (typeof obj.toDate === 'function') {
      try {
        const d = obj.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) return d.toISOString();
      } catch {
        /* jatuh ke bawah */
      }
    }
    return '';
  }

  const d = new Date(String(nilai));
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

/**
 * Ubah satu baris tabel `purchases` menjadi bentuk rekonsiliasi.
 *
 * PENTING: memakai BENTUK dan NILAI DEFAULT YANG SAMA dengan
 * `getPurchaseOrders()` di `src/lib/actions/purchase.actions.ts` — tanpa
 * `paymentStatus`/`paymentMethod`, PO dianggap `LUNAS` + `CASH` (perilaku lama).
 * Kalau salah satu berubah, yang lain wajib ikut.
 */
export function petakanPOUntukRekonsiliasi(
  row: Record<string, any>
): POUntukRekonsiliasi {
  const raw = (row?.raw_data && typeof row.raw_data === 'object' ? row.raw_data : {}) as Record<string, any>;
  const total = Number(row?.total ?? raw.total ?? raw.totalAmount ?? 0);
  const id = String(row?.id ?? '');

  return {
    id,
    poNumber: String(
      raw.poNumber || raw.invoiceNumber || `PO-${id.slice(0, 8).toUpperCase()}`
    ),
    createdAt: bacaWaktuPO(raw.createdAt) || bacaWaktuPO(row?.created_at),
    supplierName: String(raw.supplierName || 'Supplier Umum'),
    paymentStatus: String(raw.paymentStatus || 'LUNAS').toUpperCase(),
    paymentMethod: String(raw.paymentMethod || 'CASH').toUpperCase(),
    total: Number.isFinite(total) ? total : 0,
  };
}

/**
 * Ratakan baris `capital_transactions` menjadi bentuk yang bisa dikelompokkan.
 *
 * HANYA `raw_data` yang dibaca: pada tabel ini kolom `type`/`amount` masih berisi
 * nilai DEFAULT importer (NULL dan 0) untuk SELURUH 171 baris yang ada, sedangkan
 * nilai sebenarnya selalu ada di dalam `raw_data`.
 */
export function petakanMutasiMentah(rows: Record<string, any>[]): MutasiMentah[] {
  return (rows || []).map((row) => {
    const raw = (row?.raw_data && typeof row.raw_data === 'object' ? row.raw_data : {}) as Record<string, any>;
    return {
      referenceId: raw.referenceId ?? null,
      type: raw.type,
      amount: raw.amount,
    };
  });
}

/** Ringkasan daftar baris rekonsiliasi — dipakai kartu di halaman Modal. */export function ringkasRekonsiliasi(baris: BarisRekonsiliasi[]): {
  jumlah: number;
  /** Total modal yang BELUM dipotong (hanya selisih positif). */
  kurangPotong: number;
  /** Total modal yang kelebihan dipotong (nilai absolut selisih negatif). */
  lebihPotong: number;
  jumlahKurangPotong: number;
  jumlahLebihPotong: number;
} {
  let kurangPotong = 0;
  let lebihPotong = 0;
  let jumlahKurangPotong = 0;
  let jumlahLebihPotong = 0;

  for (const b of baris || []) {
    if (b.selisih > 0) {
      kurangPotong += b.selisih;
      jumlahKurangPotong += 1;
    } else if (b.selisih < 0) {
      lebihPotong += -b.selisih;
      jumlahLebihPotong += 1;
    }
  }

  return {
    jumlah: (baris || []).length,
    kurangPotong,
    lebihPotong,
    jumlahKurangPotong,
    jumlahLebihPotong,
  };
}
