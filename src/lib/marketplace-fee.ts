/**
 * Biaya admin marketplace (Shopee/TikTok/Tokopedia/Lazada) — aturan murni.
 *
 * DUA CARA MENGISI HARGA (dipilih kasir/admin per order)
 * -----------------------------------------------------
 *   `AUTO`   — yang diisi adalah HARGA JUAL di marketplace (bruto). Sistem
 *              memotong biaya admin memakai tarif dari Settings, dan yang
 *              tercatat sebagai pendapatan bersih = bruto − biaya.
 *   `MANUAL` — yang diisi adalah HARGA BERSIH hasil potongan admin (mis. angka
 *              dari menu settlement marketplace). Biaya admin TIDAK dihitung
 *              lagi di sini — kalau dihitung, potongannya terjadi dua kali.
 *
 * Modul ini sengaja TANPA impor supaya bisa dipakai Server Action, halaman
 * klien, dan unit test dengan definisi yang sama.
 */

export type ModeHargaMarketplace = 'AUTO' | 'MANUAL';

export type TarifMarketplace = {
  shopee: number;
  tiktok: number;
  tokopedia: number;
  lazada: number;
};

/** Dipakai bila setelan di Settings belum ada / tidak terbaca. */
export const TARIF_DEFAULT: TarifMarketplace = {
  shopee: 6.5,
  tiktok: 4.5,
  tokopedia: 5,
  lazada: 6,
};

/** Samakan penulisan channel dari berbagai sumber menjadi kunci tarif. */
export function kunciChannel(channel?: string | null): keyof TarifMarketplace | null {
  const bersih = String(channel ?? '').trim().toLowerCase();
  if (bersih === 'shopee') return 'shopee';
  if (bersih === 'tiktok' || bersih === 'tik tok') return 'tiktok';
  if (bersih === 'tokopedia') return 'tokopedia';
  if (bersih === 'lazada') return 'lazada';
  return null;
}

/** Tarif (%) untuk sebuah channel. 0 berarti channel-nya tidak dikenai biaya. */
export function tarifUntuk(
  channel: string | null | undefined,
  tarif: Partial<TarifMarketplace> = TARIF_DEFAULT
): number {
  const kunci = kunciChannel(channel);
  if (!kunci) return 0;
  const nilai = Number((tarif as any)?.[kunci]);
  if (!Number.isFinite(nilai) || nilai < 0) return 0;
  // Lebih dari 100% pasti salah input; jangan sampai membuat pendapatan negatif.
  return Math.min(nilai, 100);
}

export type HasilBiayaAdmin = {
  /** Biaya admin yang harus dicatat sebagai beban. */
  biaya: number;
  /** Uang yang benar-benar diterima (sudah bersih). */
  bersih: number;
  /** Tarif yang dipakai (%). */
  tarif: number;
  /** Mode yang dipakai, diteruskan apa adanya. */
  mode: ModeHargaMarketplace;
};

/**
 * Hitung biaya admin & uang bersih dari sebuah order marketplace.
 *
 * `jumlahDiisi` = nilai yang dimasukkan pengguna (bruto untuk AUTO, bersih untuk
 * MANUAL).
 */
export function hitungBiayaAdmin(params: {
  mode?: string | null;
  jumlahDiisi: number;
  channel?: string | null;
  tarif?: Partial<TarifMarketplace>;
}): HasilBiayaAdmin {
  const jumlah = Math.max(0, Number(params.jumlahDiisi) || 0);
  const mode: ModeHargaMarketplace = String(params.mode ?? 'AUTO').toUpperCase() === 'MANUAL'
    ? 'MANUAL'
    : 'AUTO';

  if (mode === 'MANUAL') {
    // Angka yang diisi SUDAH bersih hasil potongan marketplace.
    return { biaya: 0, bersih: jumlah, tarif: 0, mode };
  }

  const tarif = tarifUntuk(params.channel, params.tarif ?? TARIF_DEFAULT);
  const biaya = Math.round((jumlah * tarif) / 100);
  return { biaya, bersih: Math.max(0, jumlah - biaya), tarif, mode };
}

/**
 * Kalimat singkat untuk ditampilkan di kartu ringkasan order.
 */
export function keteranganMode(mode: ModeHargaMarketplace, tarif: number): string {
  if (mode === 'MANUAL') {
    return 'Harga yang diisi = uang bersih diterima (biaya admin sudah dipotong marketplace).';
  }
  return `Harga yang diisi = harga jual di marketplace; sistem memotong biaya admin ${tarif}%.`;
}
