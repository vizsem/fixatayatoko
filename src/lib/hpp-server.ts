/**
 * Perekaman modal (HPP) SAAT TRANSAKSI — bagian yang butuh akses basis data.
 *
 * MENGAPA INI ADA
 * ---------------
 * Rumus HPP di `src/lib/hpp.ts` semula memakai Modal TERKINI dari master produk.
 * Akibatnya setiap kali pemilik memperbaiki "Modal" sebuah produk, laba SELURUH
 * transaksi lama ikut berubah — angka laporan jadi terasa "berubah-ubah" dan
 * tidak bisa dipercaya.
 *
 * Solusinya: ketika order DIBUAT, modal per pcs dicatat ke dalam baris item
 * (`hppPerPcs` + `hppTotal`). Nilai itu tidak pernah berubah lagi, sehingga laba
 * historis stabil. Order lama yang belum punya snapshot tetap memakai Modal
 * terkini karena data masa lalunya memang tidak ada.
 *
 * Snapshot hanya direkam bila sumbernya NYATA. Kalau Modal produk masih kosong,
 * `hppPerPcs` sengaja tidak diisi supaya baris itu tetap ditandai "estimasi" di
 * laporan dan otomatis membaik begitu Modal produk diisi.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { nilaiSnapshotHpp, type ItemPenjualan, type ProdukUntukHpp, type SumberHpp } from '@/lib/hpp';

export type ItemDenganSnapshot<T> = T & {
  hppPerPcs?: number;
  hppTotal?: number;
  hppSumber?: SumberHpp;
};

/** Ukuran potongan permintaan ke PostgREST supaya URL tidak kepanjangan. */
const POTONGAN_ID = 150;

/** Ambil kolom modal produk untuk sekumpulan id (tanpa pernah melempar). */
export async function ambilProdukUntukHpp(ids: string[]): Promise<Map<string, ProdukUntukHpp>> {
  const unik = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.trim())));
  const peta = new Map<string, ProdukUntukHpp>();
  if (unik.length === 0) return peta;

  try {
    for (let i = 0; i < unik.length; i += POTONGAN_ID) {
      const bagian = unik.slice(i, i + POTONGAN_ID);
      const { data, error } = await supabaseAdmin
        .from('products')
        .select('id, cost_price, raw_data')
        .in('id', bagian);

      if (error) {
        console.error('ambilProdukUntukHpp gagal:', error.message);
        continue;
      }
      for (const p of data || []) {
        peta.set(String(p.id), { cost_price: p.cost_price, raw_data: p.raw_data });
      }
    }
  } catch (e: any) {
    console.error('ambilProdukUntukHpp error:', e?.message || e);
  }

  return peta;
}

/**
 * Tempelkan snapshot modal ke setiap baris item order.
 *
 * Dipakai SEMUA jalur pembuatan order (marketplace, sales order, pesanan
 * website) supaya laba tiap penjualan terekam pada saat kejadiannya.
 *
 * Tidak pernah melempar dan tidak pernah mengubah order: kalau produknya tidak
 * ketemu atau kolom modalnya kosong, item dikembalikan apa adanya.
 */
export async function lengkapiSnapshotHpp<T extends ItemPenjualan>(
  items: T[]
): Promise<ItemDenganSnapshot<T>[]> {
  const daftar = Array.isArray(items) ? items : [];
  if (daftar.length === 0) return [];

  const ids = daftar.map((it: any) => String(it?.id || it?.productId || '')).filter(Boolean);
  const produk = await ambilProdukUntukHpp(ids);

  return daftar.map((item: any) => {
    const productId = String(item?.id || item?.productId || '');
    const dataProduk = productId ? produk.get(productId) : undefined;

    const snapshot = nilaiSnapshotHpp({ item, produk: dataProduk });
    if (snapshot.sumber === 'ESTIMASI') {
      // Modal belum ada: jangan bekukan angka karangan.
      return { ...item };
    }

    return { ...item, hppPerPcs: snapshot.hppPerPcs, hppTotal: snapshot.hppTotal };
  });
}
