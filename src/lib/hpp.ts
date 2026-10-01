/**
 * Perhitungan HPP (harga pokok penjualan) per baris item penjualan.
 *
 * MENGAPA TERPISAH DARI HALAMAN LAPORAN
 * -------------------------------------
 * Rumus ini sebelumnya ditulis dua kali di dalam
 * `src/app/admin/reports/finance/page.tsx` (loop penjualan dan loop retur) dan
 * tidak bisa diuji. Perhitungan uang harus punya SATU definisi dan unit test.
 *
 * KESALAHAN YANG PERNAH TERJADI
 * -----------------------------
 * 1. Konversi satuan hilang. Item dijual per CTN (mis. 15 CTN × 12 pcs), tetapi
 *    HPP dihitung 15 × harga-per-pcs saja — "laba bersih" melonjak
 *    (Rp3.445.005 padahal seharusnya Rp90.060).
 * 2. Fallback dari pembelian tidak pernah kena karena peta biaya dikunci dengan
 *    `item.id` (id baris pembelian) padahal dicari dengan id produk.
 *
 * URUTAN SUMBER HPP (dari yang paling dipercaya)
 *   0. `SNAPSHOT` — modal per pcs yang DICATAT SAAT TRANSAKSI (`item.hppPerPcs`).
 *                   Nilai ini tidak pernah berubah, sehingga laba historis stabil
 *                   walau Modal produk diubah belakangan.
 *   1. `MASTER`   — `cost_price` produk (Modal terkini yang dipelihara toko).
 *   2. `ITEM`     — modal yang tersimpan di baris order itu sendiri. Order lama
 *                   hasil impor menyimpan `Modal`/`purchasePrice`, dan nilainya
 *                   yang benar UNTUK TRANSAKSI ITU (master bisa sudah berubah).
 *   3. `PEMBELIAN`— harga per pcs dari Purchase Order terakhir produk tersebut.
 *   4. `ESTIMASI` — tidak ada data sama sekali: 85% dari harga jual. Ini BUKAN
 *                   laba nyata; pemanggil wajib menghitung dan menandainya.
 */

export type SumberHpp = 'SNAPSHOT' | 'MASTER' | 'ITEM' | 'PEMBELIAN' | 'ESTIMASI';

export type ItemPenjualan = {
  id?: string;
  productId?: string;
  /** Harga jual per SATUAN jual (bukan per pcs). */
  price?: number | string;
  quantity?: number | string;
  unit?: string;
  /** Jumlah pcs untuk seluruh baris, terekam saat transaksi (paling akurat). */
  baseQuantity?: number | string;
  /** Isi satu satuan jual dalam pcs, terekam saat transaksi. */
  containsPerUnit?: number | string;
  /** Modal yang terekam di baris order (order lama). */
  purchasePrice?: number | string;
  Modal?: number | string;
  /**
   * Modal per pcs yang direkam SAAT TRANSAKSI (`createMarketplaceOrder` dkk).
   * Ini yang membuat laba historis tidak berubah saat Modal produk diubah.
   */
  hppPerPcs?: number | string;
  /**
   * Modal per pcs versi order KASIR (field `cost`). Sama-sama direkam saat
   * transaksi, hanya namanya berbeda — jangan sampai terbaca sebagai estimasi.
   */
  cost?: number | string;
  /** Isi satu satuan jual dalam pcs, versi order kasir. */
  contains?: number | string;
};

export type ProdukUntukHpp = {
  cost_price?: number | string | null;
  raw_data?: Record<string, any> | null;
} | null | undefined;

/** Satuan yang umum dipakai untuk karton; dipakai sebagai cadangan pencocokan. */
const SATUAN_KARTON = ['CTN', 'KARTON', 'DUS', 'BOX'];

/**
 * Cari "contains" sebuah satuan pada daftar satuan produk.
 *
 * Dicocokkan ke `code` lalu `name` (tidak peka huruf besar/kecil). Cadangan
 * terakhir untuk satuan karton: ambil satuan karton apa pun yang terdaftar,
 * karena kode di order bisa berbeda (mis. `DUS` vs `CTN`).
 */
export function cariContainsSatuan(unit: unknown, units: any[] | undefined): number {
  const dicari = String(unit ?? '').trim().toUpperCase();
  if (!dicari || dicari === 'PCS') return 1;

  const daftar = Array.isArray(units) ? units : [];
  const sama = (nilai: unknown) => String(nilai ?? '').trim().toUpperCase() === dicari;

  const langsung = daftar.find((u) => sama(u?.code) || sama(u?.name));
  if (langsung && Number(langsung.contains) > 0) return Number(langsung.contains);

  if (SATUAN_KARTON.includes(dicari)) {
    const karton = daftar.find(
      (u) =>
        SATUAN_KARTON.includes(String(u?.code ?? '').toUpperCase()) && Number(u?.contains) > 0
    );
    if (karton) return Number(karton.contains);
  }

  return 1;
}

/**
 * Banyaknya pcs yang benar-benar keluar untuk satu baris item.
 *
 * Prioritas: `baseQuantity` > `containsPerUnit` / `contains` (ketiganya snapshot
 * SAAT TRANSAKSI, jadi tidak berubah kalau isi satuan produk diubah) > daftar
 * satuan produk master.
 */
export function hitungPcsItem(item: ItemPenjualan, unitsProduk?: any[]): number {
  const base = Number(item?.baseQuantity ?? 0);
  if (Number.isFinite(base) && base > 0) return base;

  const qty = Number(item?.quantity ?? 1);
  const jumlah = Number.isFinite(qty) && qty > 0 ? qty : 1;

  const containsItem = Number(item?.containsPerUnit ?? item?.contains ?? 0);
  if (Number.isFinite(containsItem) && containsItem > 0) return jumlah * containsItem;

  return jumlah * cariContainsSatuan(item?.unit, unitsProduk);
}

/**
 * Ambil modal per PCS dari sumber yang tersedia.
 *
 * `costPembelianPerPcs` diisi pemanggil dari Purchase Order terakhir produk ini
 * (lihat `hitungPetaModalPembelian`).
 */
export function ambilHppPerPcs(params: {
  item: ItemPenjualan;
  produk?: ProdukUntukHpp;
  costPembelianPerPcs?: number;
}): { costPerPcs: number; sumber: SumberHpp } {
  const { item, produk, costPembelianPerPcs } = params;
  const raw = (produk?.raw_data || {}) as Record<string, any>;

  // 0. Snapshot saat transaksi — paling dipercaya dan tidak pernah berubah.
  //    `hppPerPcs` dipakai order marketplace/website, `cost` dipakai order kasir.
  const dariSnapshot = Number(item?.hppPerPcs ?? item?.cost ?? 0);
  if (Number.isFinite(dariSnapshot) && dariSnapshot > 0) {
    return { costPerPcs: dariSnapshot, sumber: 'SNAPSHOT' };
  }

  // 1. Modal terkini dari master produk.
  const dariMaster = Number(
    produk?.cost_price ?? raw.costPrice ?? raw.Modal ?? raw.purchasePrice ?? 0
  );
  if (Number.isFinite(dariMaster) && dariMaster > 0) {
    return { costPerPcs: dariMaster, sumber: 'MASTER' };
  }

  // 2. Modal yang terekam di baris order itu sendiri (akurat untuk transaksi lama).
  const dariItem = Number(item?.purchasePrice ?? item?.Modal ?? 0);
  if (Number.isFinite(dariItem) && dariItem > 0) {
    return { costPerPcs: dariItem, sumber: 'ITEM' };
  }

  // 3. Harga per pcs dari pembelian terakhir produk ini.
  const dariPembelian = Number(costPembelianPerPcs ?? 0);
  if (Number.isFinite(dariPembelian) && dariPembelian > 0) {
    return { costPerPcs: dariPembelian, sumber: 'PEMBELIAN' };
  }

  return { costPerPcs: 0, sumber: 'ESTIMASI' };
}

export type HasilHppItem = {
  /** Pendapatan baris ini (harga jual × jumlah satuan jual). */
  pendapatan: number;
  /** Harga pokok untuk baris ini. */
  hpp: number;
  /** Jumlah pcs (hasil konversi satuan). */
  pcs: number;
  costPerPcs: number;
  sumber: SumberHpp;
};

/**
 * Hitung pendapatan & HPP satu baris item penjualan.
 *
 * Bila tidak ada data modal sama sekali, HPP memakai estimasi 85% dari harga
 * jual per pcs — dan `sumber` bernilai `ESTIMASI` supaya pemanggil bisa
 * memperingatkan pengguna bahwa angka itu BUKAN laba nyata.
 */
export function hitungHppItem(params: {
  item: ItemPenjualan;
  produk?: ProdukUntukHpp;
  costPembelianPerPcs?: number;
}): HasilHppItem {
  const { item } = params;
  const price = Number(item?.price ?? 0);
  const qty = Number(item?.quantity ?? 1);
  const satuan = Number.isFinite(qty) && qty > 0 ? qty : 1;

  const pcs = hitungPcsItem(item, (params.produk?.raw_data as any)?.units);
  const { costPerPcs, sumber } = ambilHppPerPcs(params);

  return {
    pendapatan: (Number.isFinite(price) ? price : 0) * satuan,
    hpp: sumber === 'ESTIMASI' ? price * 0.85 * pcs : costPerPcs * pcs,
    pcs,
    costPerPcs,
    sumber,
  };
}

export type RingkasanLaba = {
  /** Nilai penjualan seluruh baris (harga jual × jumlah satuan jual). */
  pendapatan: number;
  /** HPP baris yang modalnya NYATA. */
  hppDipercaya: number;
  /** HPP baris yang modalnya hanya perkiraan — bukan angka akuntansi. */
  hppEstimasi: number;
  /** Laba dari baris yang modalnya nyata. INI angka yang boleh dipakai. */
  labaDipercaya: number;
  /** Laba dari baris yang modalnya perkiraan. Ditampilkan terpisah. */
  labaEstimasi: number;
  itemTotal: number;
  itemEstimasi: number;
};

/**
 * Gabungkan hasil per item menjadi satu ringkasan laba.
 *
 * WAJIB dipakai semua halaman (Dashboard, Laporan Keuangan, Audit) supaya
 * ketiganya menampilkan angka yang sama persis. Laba dari baris tanpa Modal
 * DIPISAH — tidak dicampur ke angka utama, karena itu bukan laba nyata.
 */
export function ringkasLabaItem(hasil: HasilHppItem[]): RingkasanLaba {
  const ringkas: RingkasanLaba = {
    pendapatan: 0,
    hppDipercaya: 0,
    hppEstimasi: 0,
    labaDipercaya: 0,
    labaEstimasi: 0,
    itemTotal: 0,
    itemEstimasi: 0,
  };

  for (const h of hasil || []) {
    ringkas.pendapatan += h.pendapatan;
    ringkas.itemTotal += 1;

    if (h.sumber === 'ESTIMASI') {
      ringkas.itemEstimasi += 1;
      ringkas.hppEstimasi += h.hpp;
      ringkas.labaEstimasi += h.pendapatan - h.hpp;
    } else {
      ringkas.hppDipercaya += h.hpp;
      ringkas.labaDipercaya += h.pendapatan - h.hpp;
    }
  }

  return ringkas;
}

/** Hitung seluruh baris satu order dengan sumber modal yang diberikan pemanggil. */
export function hitungItemOrder(params: {
  items: ItemPenjualan[];
  produkDari: (productId: string) => ProdukUntukHpp;
  costPembelianDari?: (productId: string) => number | undefined;
}): { hasil: HasilHppItem[]; ringkasan: RingkasanLaba } {
  const hasil: HasilHppItem[] = [];

  for (const item of params.items || []) {
    const productId = String((item as any)?.id || (item as any)?.productId || '');
    hasil.push(
      hitungHppItem({
        item,
        produk: productId ? params.produkDari(productId) : undefined,
        costPembelianPerPcs: productId ? params.costPembelianDari?.(productId) : undefined,
      })
    );
  }

  return { hasil, ringkasan: ringkasLabaItem(hasil) };
}

/**
 * Nilai snapshot modal yang HARUS direkam saat order dibuat.
 *
 * Mengembalikan `hppPerPcs` hanya bila sumbernya nyata (bukan estimasi):
 * merekam angka estimasi berarti membekukan angka karangan selamanya. Bila
 * modal belum ada, biarkan kosong supaya baris itu tetap ditandai "estimasi"
 * dan otomatis membaik begitu Modal produk diisi.
 */
export function nilaiSnapshotHpp(params: {
  item: ItemPenjualan;
  produk?: ProdukUntukHpp;
  costPembelianPerPcs?: number;
}): { hppPerPcs?: number; hppTotal: number; pcs: number; sumber: SumberHpp } {
  const { costPerPcs, sumber } = ambilHppPerPcs(params);
  const pcs = hitungPcsItem(params.item, (params.produk?.raw_data as any)?.units);

  if (sumber === 'ESTIMASI') {
    return { hppTotal: 0, pcs, sumber };
  }

  return {
    hppPerPcs: costPerPcs,
    hppTotal: costPerPcs * pcs,
    pcs,
    sumber,
  };
}

/**
 * Peta "modal per pcs dari pembelian terakhir" untuk sekumpulan Purchase Order.
 *
 * PERBAIKAN PENTING: kuncinya adalah **id produk** (`item.productId`), bukan
 * `item.id`. Sebelumnya dipakai `item.id` — id BARIS pembelian (`item_0_...)` —
 * sehingga pencarian dengan id produk SELALU gagal dan fallback dari pembelian
 * tidak pernah terpakai. Bukti di data nyata: 0 dari 21 baris pembelian punya
 * `id` yang sama dengan `productId`.
 */
export function hitungPetaModalPembelian(
  purchases: any[]
): Map<string, { costPerPcs: number; ts: number }> {
  const peta = new Map<string, { costPerPcs: number; ts: number }>();

  for (const po of purchases || []) {
    const data = po?.data ? po.data() : po;
    const waktu = new Date(data?.createdAt ?? data?.created_at ?? 0).getTime();
    const ts = Number.isFinite(waktu) ? waktu : 0;

    for (const item of data?.items || []) {
      // `productId` wajib: tanpa itu baris ini tidak bisa dipakai untuk apa pun.
      const productId = String(item?.productId ?? item?.product_id ?? '').trim();
      if (!productId) continue;

      const contains = Number(item?.conversion ?? item?.contains ?? 1);
      const pembagi = Number.isFinite(contains) && contains > 0 ? contains : 1;
      const hargaSatuan = Number(item?.purchasePrice ?? item?.unitPrice ?? 0);
      if (!(hargaSatuan > 0)) continue;

      const costPerPcs = hargaSatuan / pembagi;
      const sekarang = peta.get(productId);
      if (!sekarang || ts > sekarang.ts) {
        peta.set(productId, { costPerPcs, ts });
      }
    }
  }

  return peta;
}
