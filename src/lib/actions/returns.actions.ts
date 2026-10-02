'use server';

import { revalidatePath } from 'next/cache';

import { supabaseAdmin } from '@/lib/supabase';
import { cekAksesAdmin, cekAksesStaf } from '@/lib/actions/access';
import { describeDatabaseError, type ActionErrorCode } from '@/lib/actions/guard';
import { toPlainRow, toPlainRows } from '@/lib/db-schema';
import { sbGetDocs, sbInsertDoc } from '@/lib/supabase-helpers';
import { addStock, deductStockFEFO } from '@/lib/inventory';
import {
  akunJurnalRetur,
  keDaftarRetur,
  keRetur,
  normalisasiItems,
  normalisasiJenis,
  normalisasiPenyelesaian,
  ringkasRetur,
  totalDariItems,
  validasiReturBaru,
  labelStatus,
  type ItemRetur,
  type JenisRetur,
  type PenyelesaianRetur,
  type Retur,
  type RingkasanRetur,
} from '@/lib/returns';

/**
 * Retur penjualan & pembelian — SATU-SATUNYA jalur tulis.
 *
 * MENGAPA DIPINDAH KE SERVER (2026-10-02)
 * ---------------------------------------
 * Halaman lama menulis dari peramban memakai `supabaseAdmin`, yang di peramban
 * hanyalah klien ANON tanpa sesi. Akibatnya:
 *   1. `addStockTx`/`deductStockTx` (`src/lib/inventory.ts` memakai service role)
 *      DITOLAK RLS -> "retur disetujui" tetapi stok tidak pernah berubah;
 *   2. `postJournal` menulis dengan klien anon -> jurnal tidak pernah tercatat;
 *   3. `runTransaction` bridge TIDAK atomik -> status bisa berubah tanpa stok;
 *   4. semua kegagalan itu hanya masuk `console.error` (kegagalan senyap).
 *
 * Sekarang: verifikasi peran -> klaim status (idempoten) -> stok -> jurnal.
 * Bila penyesuaian stok gagal, status DIKEMBALIKAN ke PENDING supaya bisa
 * diulang, sehingga tidak ada "retur disetujui" yang menggantung.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: ActionErrorCode };

const BATAS_RETUR = 500;

export interface DataHalamanRetur {
  daftar: Retur[];
  ringkasan: RingkasanRetur;
}

/** Seluruh data halaman retur dalam SATU panggilan. */
export async function getReturnsPageData(): Promise<ActionResult<DataHalamanRetur>> {
  const tolak = await cekAksesStaf();
  if (tolak) return tolak;

  try {
    const snapshot = await sbGetDocs({
      table: 'returns',
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      limit: BATAS_RETUR,
    });

    // `toPlainRows` wajib: baris memuat `createdAt` bergaya Firestore yang
    // berisi FUNGSI, dan serializer Server Action menolaknya (React #441).
    const baris = toPlainRows(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    const daftar = keDaftarRetur(baris);

    return { ok: true, data: { daftar, ringkasan: ringkasRetur(daftar) } };
  } catch (error) {
    return {
      ok: false,
      code: 'INTERNAL',
      error: error instanceof Error ? error.message : 'Gagal memuat data retur.',
    };
  }
}

export interface ProdukUntukRetur {
  id: string;
  name: string;
  price: number;
  stock: number;
  unit: string;
}

/**
 * Cari produk untuk formulir retur — dicari di DATABASE, bukan dengan
 * mengunduh seluruh tabel `products` (yang berukuran ~5 MB) ke peramban.
 */
export async function cariProdukUntukRetur(kata: string): Promise<ActionResult<ProdukUntukRetur[]>> {
  const tolak = await cekAksesStaf();
  if (tolak) return tolak;

  try {
    // Buang karakter yang punya arti khusus di PostgREST supaya pencarian
    // tidak bisa dipakai menyusupkan filter lain.
    const bersih = String(kata ?? '')
      .trim()
      .replace(/[%_,()*\\]/g, ' ')
      .slice(0, 40);

    let builder = supabaseAdmin
      .from('products')
      .select('id,name,price,stock,unit')
      .order('name', { ascending: true })
      .limit(8);

    if (bersih) {
      builder = builder.or(`name.ilike.%${bersih}%,sku.ilike.%${bersih}%,barcode.ilike.%${bersih}%`);
    }

    const { data, error } = await builder;
    if (error) throw new Error(error.message);

    const produk = (data ?? []).map((p: Record<string, unknown>) => ({
      id: String(p.id ?? ''),
      name: String(p.name ?? 'Produk'),
      price: Number(p.price ?? 0) || 0,
      stock: Number(p.stock ?? 0) || 0,
      unit: String(p.unit ?? 'pcs'),
    }));

    return { ok: true, data: produk };
  } catch (error) {
    return {
      ok: false,
      code: 'INTERNAL',
      error: error instanceof Error ? error.message : 'Gagal mencari produk.',
    };
  }
}

export interface InputReturBaru {
  jenis: JenisRetur;
  refId: string;
  pihak: string;
  alasan: string;
  items: ItemRetur[];
  penyelesaian?: PenyelesaianRetur;
}

/**
 * Buat permintaan retur baru.
 *
 * Harga dan nama produk diambil ULANG dari master data: nilai kiriman klien
 * tidak dipercaya, karena totalnya menentukan jurnal keuangan saat disetujui.
 */
export async function buatRetur(input: InputReturBaru): Promise<ActionResult<{ id: string; totalNilai: number }>> {
  const tolak = await cekAksesStaf();
  if (tolak) return tolak;

  try {
    const jenis = normalisasiJenis(input?.jenis);
    const itemsMasuk = normalisasiItems(input?.items ?? []);
    const pihak = String(input?.pihak ?? '').trim();
    const refId = String(input?.refId ?? '').trim();
    const alasan = String(input?.alasan ?? '').trim();
    const penyelesaian = normalisasiPenyelesaian(input?.penyelesaian);

    const pesan = validasiReturBaru({ jenis, refId, pihak, alasan, items: itemsMasuk });
    if (pesan) return { ok: false, code: 'INVALID_INPUT', error: pesan };

    // Ambil harga & nama resmi dari master produk.
    const ids = Array.from(new Set(itemsMasuk.map((i) => i.productId).filter(Boolean)));
    const petaProduk = new Map<string, { name: string; price: number }>();

    if (ids.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('products')
        .select('id,name,price')
        .in('id', ids);
      if (error) throw new Error(error.message);
      for (const p of (data ?? []) as Array<Record<string, unknown>>) {
        petaProduk.set(String(p.id), {
          name: String(p.name ?? 'Produk'),
          price: Number(p.price ?? 0) || 0,
        });
      }
    }

    const items: ItemRetur[] = itemsMasuk.map((item) => {
      const master = petaProduk.get(item.productId);
      if (!master) return item;
      return {
        productId: item.productId,
        productName: master.name,
        quantity: item.quantity,
        price: master.price > 0 ? master.price : item.price,
      };
    });

    const totalNilai = totalDariItems(items);
    const now = new Date().toISOString();

    const hasil = await sbInsertDoc('returns', {
      type: jenis,
      refId,
      customerOrSupplierName: pihak,
      reason: alasan,
      items,
      totalValue: totalNilai,
      status: 'PENDING',
      penyelesaian,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath('/admin/returns');
    return { ok: true, data: { id: hasil.id, totalNilai } };
  } catch (error) {
    return { ok: false, code: 'INTERNAL', error: describeDatabaseError(error).message };
  }
}

export type AksiRetur = 'SETUJUI' | 'TOLAK';

export interface HasilProsesRetur {
  status: 'APPROVED' | 'REJECTED';
  stokDisesuaikan: number;
  itemDilewati: string[];
  jurnalDicatat: boolean;
  peringatan: string[];
}

/** Catat jurnal double-entry dengan service role (Server Action tidak punya sesi). */
async function catatJurnal(params: {
  debit: string;
  kredit: string;
  amount: number;
  memo: string;
  refId: string;
  oleh: string;
}): Promise<string | null> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('ledger_entries').insert({
    id: `ledg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    created_at: now,
    updated_at: now,
    raw_data: {
      date: now,
      debitAccount: params.debit,
      creditAccount: params.kredit,
      amount: params.amount,
      memo: params.memo,
      refType: 'RETURN',
      refId: params.refId,
      postedBy: params.oleh,
      extra: {},
      createdAt: now,
      updatedAt: now,
    },
  });

  return error?.message ?? null;
}

/**
 * Simpan status baru pada sebuah retur.
 *
 * `hanyaBilaPending` memakai filter JSONB `raw_data->>status=eq.PENDING` supaya
 * dua orang yang menekan tombol bersamaan TIDAK memproses retur yang sama dua
 * kali (stok bertambah dua kali).
 */
async function tulisStatus(params: {
  id: string;
  rawData: Record<string, unknown>;
  patch: Record<string, unknown>;
  hanyaBilaPending: boolean;
}): Promise<{ ok: true } | { ok: false; error: string; code: ActionErrorCode }> {
  const now = new Date().toISOString();

  let builder = supabaseAdmin
    .from('returns')
    .update(
      { raw_data: { ...params.rawData, ...params.patch, updatedAt: now }, updated_at: now },
      { count: 'exact' }
    )
    .eq('id', params.id);

  if (params.hanyaBilaPending) builder = builder.eq('raw_data->>status', 'PENDING');

  const { data, error } = await builder.select('id');
  if (error) return { ok: false, code: 'INTERNAL', error: error.message };
  if (!data || data.length === 0) {
    return {
      ok: false,
      code: 'CONFLICT',
      error: 'Retur ini sudah diproses orang lain. Muat ulang halaman untuk melihat status terbaru.',
    };
  }
  return { ok: true };
}

/**
 * Setujui atau tolak sebuah retur.
 *
 * MENYETUJUI berarti: stok disesuaikan (kembali ke gudang untuk retur
 * penjualan, keluar untuk retur pembelian), lalu jurnal dicatat bila
 * penyelesaiannya melibatkan uang.
 */
export async function prosesRetur(
  id: string,
  aksi: AksiRetur,
  penyelesaian?: PenyelesaianRetur,
  catatanProses?: string
): Promise<ActionResult<HasilProsesRetur>> {
  const tolak = await cekAksesAdmin();
  if (tolak) return tolak;

  try {
    const returId = String(id ?? '').trim();
    if (!returId) return { ok: false, code: 'INVALID_INPUT', error: 'ID retur tidak valid.' };

    const oleh = 'admin';
    const catatan = String(catatanProses ?? '').trim();

    const { data: row, error: bacaError } = await supabaseAdmin
      .from('returns')
      .select('*')
      .eq('id', returId)
      .maybeSingle();

    if (bacaError) throw new Error(bacaError.message);
    if (!row) return { ok: false, code: 'NOT_FOUND', error: 'Retur tidak ditemukan.' };

    const rawData = (row as Record<string, unknown>).raw_data as Record<string, unknown> | null;
    const retur = keRetur({
      id: (row as Record<string, unknown>).id,
      ...(rawData ?? {}),
      created_at: (row as Record<string, unknown>).created_at,
    });

    if (retur.status !== 'PENDING') {
      return {
        ok: false,
        code: 'CONFLICT',
        error: `Retur ini sudah ${labelStatus(retur.status).toLowerCase()}.`,
      };
    }

    const now = new Date().toISOString();

    // ---- MENOLAK: cukup ubah status, tidak ada stok/uang yang bergerak. ----
    if (aksi === 'TOLAK') {
      const hasil = await tulisStatus({
        id: returId,
        rawData: rawData ?? {},
        patch: {
          status: 'REJECTED',
          processedAt: now,
          processedBy: oleh,
          processNote: catatan,
        },
        hanyaBilaPending: true,
      });
      if (!hasil.ok) return hasil;

      revalidatePath('/admin/returns');
      return {
        ok: true,
        data: {
          status: 'REJECTED',
          stokDisesuaikan: 0,
          itemDilewati: [],
          jurnalDicatat: false,
          peringatan: [],
        },
      };
    }

    // ---- MENYETUJUI ----
    const penyelesaianFinal = normalisasiPenyelesaian(penyelesaian ?? retur.penyelesaian);

    // 1. KLAIM status lebih dulu: ini penjaga idempoten (dua klik = satu proses).
    const klaim = await tulisStatus({
      id: returId,
      rawData: rawData ?? {},
      patch: {
        status: 'APPROVED',
        penyelesaian: penyelesaianFinal,
        processedAt: now,
        processedBy: oleh,
        processNote: catatan,
      },
      hanyaBilaPending: true,
    });
    if (!klaim.ok) return klaim;

    const peringatan: string[] = [];
    const itemDilewati: string[] = [];
    let stokDisesuaikan = 0;

    try {
      // 2. Sesuaikan stok. Item tanpa `productId` (warisan impor marketplace)
      //    TIDAK ditebak — dilaporkan ke pengguna.
      for (const item of retur.items) {
        if (!item.productId) {
          itemDilewati.push(item.productName);
          continue;
        }

        if (retur.jenis === 'SALES_RETURN') {
          await addStock({
            productId: item.productId,
            amount: item.quantity,
            reference: `RETUR-${returId}`,
            notes: `Retur penjualan #${retur.refId || returId}`,
            source: 'MANUAL',
          });
        } else {
          await deductStockFEFO({
            productId: item.productId,
            amount: item.quantity,
            reference: `RETUR-${returId}`,
            notes: `Retur pembelian #${retur.refId || returId}`,
            source: 'MANUAL',
          });
        }

        stokDisesuaikan += 1;
      }

      // 3. Jurnal. Bila gagal, JANGAN gagalkan retur: stok sudah benar dan
      //    jurnal bisa disusulkan (sama seperti alur kasir).
      const akun = akunJurnalRetur(retur.jenis, penyelesaianFinal);
      let jurnalDicatat = false;

      if (akun && retur.totalNilai > 0) {
        const pesanJurnal = await catatJurnal({
          debit: akun.debit,
          kredit: akun.kredit,
          amount: retur.totalNilai,
          memo:
            retur.jenis === 'SALES_RETURN'
              ? `Refund retur penjualan #${retur.refId || returId}`
              : `Retur pembelian #${retur.refId || returId}`,
          refId: returId,
          oleh,
        });

        if (pesanJurnal) {
          console.error('Gagal mencatat jurnal retur:', pesanJurnal);
          peringatan.push('Stok sudah disesuaikan, tetapi jurnal gagal dicatat. Catat manual.');
        } else {
          jurnalDicatat = true;
        }
      }

      if (itemDilewati.length > 0) {
        peringatan.push(
          `${itemDilewati.length} item tidak punya ID produk sehingga stoknya TIDAK disesuaikan: ` +
            itemDilewati.join(', ')
        );
      }

      revalidatePath('/admin/returns');
      revalidatePath('/admin/reports/finance');
      revalidatePath('/admin/audit');

      return {
        ok: true,
        data: { status: 'APPROVED', stokDisesuaikan, itemDilewati, jurnalDicatat, peringatan },
      };
    } catch (error) {
      // 4. Stok gagal -> kembalikan status ke PENDING supaya bisa diulang.
      //    Tanpa ini, retur "disetujui" tanpa stok yang benar-benar bergerak.
      const pesan = error instanceof Error ? error.message : 'Penyesuaian stok gagal.';
      const balik = await tulisStatus({
        id: returId,
        rawData: rawData ?? {},
        patch: {
          status: 'PENDING',
          processNote: `Gagal disetujui: ${pesan}`,
        },
        hanyaBilaPending: false,
      });

      if (!balik.ok) {
        console.error('Gagal mengembalikan status retur ke PENDING:', balik.error);
      }

      return { ok: false, code: 'INTERNAL', error: `Stok tidak berubah: ${pesan}` };
    }
  } catch (error) {
    return { ok: false, code: 'INTERNAL', error: describeDatabaseError(error).message };
  }
}

/** Dipakai halaman untuk memastikan koneksi service role hidup. */
export async function pingReturnsBackend(): Promise<boolean> {
  const tolak = await cekAksesStaf();
  if (tolak) return false;
  const { error } = await supabaseAdmin.from('returns').select('id').limit(1);
  return !error;
}
