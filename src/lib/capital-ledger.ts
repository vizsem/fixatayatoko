/**
 * Pencatatan mutasi modal (`capital_transactions`) — SATU pintu untuk alur PO.
 *
 * MENGAPA MODUL INI ADA
 * ---------------------
 * Sebelumnya pencatatan keluar-masuk modal untuk Purchase Order dilakukan di
 * peramban (`src/app/admin/purchases/add/page.tsx` dan
 * `.../edit/[id]/page.tsx` memakai `writeBatch`) — bukan di Server Action.
 * Akibatnya, sejak aplikasi memakai Server Action untuk membuat PO:
 *
 *   1. Uang tunai/transfer TIDAK pernah tercatat keluar. Terbukti di database
 *      produksi: seluruh baris "Pembelian Stok (CASH): ..." bertanggal
 *      <= 2026-07-29, sementara PO baru (ber-id `po_*`) muncul sejak
 *      2026-09-30. Saldo modal tidak pernah berkurang walau barang dibeli tunai.
 *   2. Kegagalan itu SENYAP: blok peramban dibungkus try/catch yang hanya
 *      memanggil `console.warn`, jadi pengguna tetap melihat pesan sukses.
 *   3. Blok itu juga menulis ULANG baris `purchases` (id baru) sehingga PO
 *      berpotensi tercatat dua kali.
 *
 * Sekarang seluruh mutasi modal ditulis dari server (service role) lewat
 * `rekonsiliasiMutasiModal()` yang IDEMPOTEN: setiap PO hanya boleh punya satu
 * posisi modal bersih. Aman dipanggil berulang, dan otomatis mengembalikan uang
 * (INJECTION) ketika PO diubah menjadi HUTANG atau dibatalkan.
 *
 * Dipanggil dari Server Action (`purchase.actions.ts`) yang sudah memeriksa
 * peran. Jangan impor modul ini dari komponen klien.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { mergeRowWithRawData } from '@/lib/db-schema';
import {
  bacaJenisMutasi,
  bacaNominalMutasi,
  bandingkanPO,
  pembayaranKeluarUang,
  petakanMutasiMentah,
  petakanPOUntukRekonsiliasi,
  posisiTercatat,
  ringkasMutasiPerPO,
  ringkasRekonsiliasi,
  type BarisRekonsiliasi,
  type CapitalEntryType,
  type MutasiTercatat,
} from '@/lib/capital-reconcile';

// Aturan "PO mana yang mengeluarkan uang" dan pembacaan jenis/nominal mutasi
// hidup di `@/lib/capital-reconcile` (modul murni tanpa impor) supaya Server
// Action, skrip terminal, dan unit test memakai definisi yang sama.
// Di-reekspor agar pemanggil lama tetap bekerja.
export { pembayaranKeluarUang, type CapitalEntryType };

/** Bentuk ringkasan mutasi (alias agar API lama tetap jalan). */
export type RingkasanMutasi = MutasiTercatat;

/**
 * Hitung mutasi modal yang SUDAH tercatat.
 *
 * Memakai `mergeRowWithRawData` karena `type`/`amount` pada tabel ini hidup di
 * kolom JSONB `raw_data` (kolom aslinya masih berisi nilai DEFAULT importer).
 */
export function ringkasMutasi(rows: Record<string, any>[]): RingkasanMutasi {
  let injection = 0;
  let withdrawal = 0;

  for (const row of rows || []) {
    const data = mergeRowWithRawData(row, 'capital_transactions');
    const jenis = bacaJenisMutasi(data.type);
    const nominal = bacaNominalMutasi(data.amount);

    if (jenis === 'INJECTION') injection += nominal;
    else if (jenis === 'WITHDRAWAL') withdrawal += nominal;
  }

  return { injection, withdrawal, count: (rows || []).length };
}

/**
 * Saldo modal dari sekumpulan baris `capital_transactions`.
 *
 * Ini SATU-SATUNYA rumus saldo modal di seluruh aplikasi: dipakai halaman Modal,
 * validasi pembelian di halaman PO (`getCapitalBalance`), dan `adjustTotalCapital`.
 *
 * Rumusnya hidup di sini (bukan di `actions/capital.actions.ts`) karena berkas
 * Server Action hanya boleh mengekspor fungsi `async` — fungsi murni yang
 * diekspor dari sana membuat build produksi GAGAL
 * ("Server Actions must be async functions").
 */
export function hitungSaldoModal(rows: Record<string, any>[]): {
  injection: number;
  withdrawal: number;
  balance: number;
  count: number;
} {
  const ringkas = ringkasMutasi(rows);
  return {
    injection: ringkas.injection,
    withdrawal: ringkas.withdrawal,
    balance: ringkas.injection - ringkas.withdrawal,
    count: ringkas.count,
  };
}

/**
 * Tentukan satu penyesuaian yang diperlukan agar modal mencerminkan `diharapkan`.
 *
 * Yang dibandingkan adalah POSISI BERSIH, bukan transaksi terakhir:
 *
 *   uangKeluarTercatat = Σ WITHDRAWAL − Σ INJECTION
 *   selisih            = diharapkan − uangKeluarTercatat
 *
 * `null` berarti sudah cocok (idempoten: pemanggilan ulang tidak menulis apa pun).
 */
export function hitungPenyesuaian(
  diharapkan: number,
  tercatat: RingkasanMutasi
): { type: CapitalEntryType; amount: number } | null {
  const target = Math.round(Number(diharapkan) || 0);
  const selisih = target - Math.round(posisiTercatat(tercatat));

  if (selisih === 0) return null;
  return selisih > 0
    ? { type: 'WITHDRAWAL', amount: selisih }
    : { type: 'INJECTION', amount: -selisih };
}

/** Keterangan yang tampil di halaman Modal — dibuat mudah dibaca. */
export function susunKeterangan(params: {
  type: CapitalEntryType;
  sudahAdaMutasiSebelumnya: boolean;
  label: string;
  paymentMethod?: string | null;
  itemCount?: number;
  keterangan?: string;
}): string {
  if (params.keterangan) return params.keterangan;

  if (params.type === 'INJECTION') {
    return `Pengembalian Modal PO: ${params.label}`;
  }

  const metode = String(params.paymentMethod ?? 'CASH').toUpperCase();
  if (params.sudahAdaMutasiSebelumnya) {
    return `Penyesuaian PO (${metode}): ${params.label}`;
  }
  const jumlahItem = params.itemCount ?? 0;
  return `Pembelian Stok (${metode}): ${params.label} (${jumlahItem} items)`;
}

export type RekonsiliasiResult =
  | { success: true; disesuaikan: number; type?: CapitalEntryType }
  | { success: false; error: string };

/**
 * Samakan catatan modal milik satu PO dengan nilai yang seharusnya.
 *
 * `diharapkan` = jumlah uang yang seharusnya SUDAH keluar untuk PO ini
 * (0 bila PO dibatalkan, diubah menjadi HUTANG, atau memang tempo).
 */
export async function rekonsiliasiMutasiModal(params: {
  referenceId: string;
  diharapkan: number;
  label: string;
  paymentMethod?: string | null;
  itemCount?: number;
  keterangan?: string;
}): Promise<RekonsiliasiResult> {
  try {
    // Filter JSON PostgREST: `raw_data->>referenceId=eq.<id>`.
    const { data, error } = await supabaseAdmin
      .from('capital_transactions')
      .select('*')
      .eq('raw_data->>referenceId', params.referenceId);

    if (error) return { success: false, error: error.message };

    const tercatat = ringkasMutasi(data ?? []);
    const penyesuaian = hitungPenyesuaian(params.diharapkan, tercatat);
    if (!penyesuaian) return { success: true, disesuaikan: 0 };

    const now = new Date().toISOString();
    const payload = {
      id: `cap_${params.referenceId}_${Date.now()}`.slice(0, 64),
      created_at: now,
      updated_at: now,
      // `type`/`amount` disimpan di `raw_data` supaya bentuknya sama dengan
      // seluruh baris lain di tabel ini (kolom aslinya penuh nilai DEFAULT
      // importer dan sengaja tidak dipakai).
      raw_data: {
        date: now,
        type: penyesuaian.type,
        amount: penyesuaian.amount,
        description: susunKeterangan({
          type: penyesuaian.type,
          sudahAdaMutasiSebelumnya: tercatat.count > 0,
          label: params.label,
          paymentMethod: params.paymentMethod,
          itemCount: params.itemCount,
          keterangan: params.keterangan,
        }),
        recordedBy: 'system',
        referenceId: params.referenceId,
        source: 'PURCHASE_ORDER',
      },
    };

    const { error: insertError } = await supabaseAdmin
      .from('capital_transactions')
      .insert(payload);

    if (insertError) return { success: false, error: insertError.message };

    return {
      success: true,
      disesuaikan: penyesuaian.amount,
      type: penyesuaian.type,
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Gagal mencatat mutasi modal' };
  }
}

/**
 * Pembungkus untuk alur PO.
 *
 * Mengembalikan pesan peringatan (atau `null` bila tidak ada masalah) — BUKAN
 * melempar error. PO dan stok sudah tersimpan; kegagalan pencatatan modal tidak
 * boleh membuat pengguna mengira PO-nya gagal dibuat, tetapi juga tidak boleh
 * disembunyikan seperti pada blok peramban yang lama.
 */
export async function catatMutasiModalPO(params: {
  poId: string;
  total: number;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  label: string;
  itemCount?: number;
  dibatalkan?: boolean;
}): Promise<string | null> {
  const diharapkan = params.dibatalkan
    ? 0
    : pembayaranKeluarUang(params.paymentStatus, params.paymentMethod)
      ? Number(params.total) || 0
      : 0;

  const hasil = await rekonsiliasiMutasiModal({
    referenceId: params.poId,
    diharapkan,
    label: params.label,
    paymentMethod: params.paymentMethod,
    itemCount: params.itemCount,
    keterangan: params.dibatalkan
      ? `Pengembalian Modal: PO dibatalkan (${params.poId})`
      : undefined,
  });

  if (hasil.success) return null;

  return (
    `PO tersimpan, tetapi pencatatan mutasi modal gagal (${hasil.error}). ` +
    'Periksa halaman Modal dan sesuaikan bila perlu.'
  );
}

/**
 * Ambil SELURUH baris sebuah tabel dengan paging eksplisit.
 *
 * Batas bawaan PostgREST (`db-max-rows`, 1000 baris) memotong `select()` tanpa
 * error apa pun. Paging di sini memastikan perhitungan keuangan tidak pernah
 * diam-diam terpotong saat data bertambah.
 */
async function ambilSemuaBaris(table: string): Promise<Record<string, any>[]> {
  const PAGE = 1000;
  const rows: Record<string, any>[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`${table}: ${error.message}`);
    const batch = (data || []) as Record<string, any>[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }

  return rows;
}

/** Seluruh baris `capital_transactions` (sumber saldo modal). */
export function ambilSemuaBarisModal(): Promise<Record<string, any>[]> {
  return ambilSemuaBaris('capital_transactions');
}

/** Seluruh Purchase Order. */
export function ambilSemuaPurchaseOrder(): Promise<Record<string, any>[]> {
  return ambilSemuaBaris('purchases');
}

/**
 * Hitung selisih antara Purchase Order dan buku besar modal.
 *
 * Dipakai halaman `/admin/capital/rekonsiliasi` (lihat
 * `src/lib/actions/capital-reconcile.actions.ts`). Hanya MEMBACA.
 */
export async function hitungRekonsiliasiModal(): Promise<{
  baris: BarisRekonsiliasi[];
  ringkasan: ReturnType<typeof ringkasRekonsiliasi>;
}> {
  const [purchaseRows, modalRows] = await Promise.all([
    ambilSemuaPurchaseOrder(),
    ambilSemuaBarisModal(),
  ]);

  const baris = bandingkanPO(
    purchaseRows.map(petakanPOUntukRekonsiliasi),
    ringkasMutasiPerPO(petakanMutasiMentah(modalRows))
  );

  return { baris, ringkasan: ringkasRekonsiliasi(baris) };
}
