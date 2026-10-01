import { describe, it, expect, vi, beforeEach } from 'vitest';

// `src/test/setup.ts` memasang mock global untuk @/lib/firebase. Kedua test di
// bawah justru menguji implementasi aslinya, jadi mock itu dilepas.
vi.unmock('@/lib/firebase');

import { mergeRowWithRawData } from '@/lib/db-schema';
import { collection, getDocs } from '@/lib/firebase';
import { normalizeRow, sbGetDocs } from '@/lib/supabase-helpers';

/**
 * Bug yang dijaga oleh test ini (nyata, terverifikasi ke database produksi).
 *
 * Importer massal Firestore → Postgres mengisi `raw_data`, `created_at`, dan
 * `updated_at`, tetapi membiarkan kolom tambahan pada nilai DEFAULT-nya:
 *
 *   capital_transactions : 171/171 baris `type = NULL`, `amount = 0`
 *   ledger_entries       : 167/167 baris `amount = 0`
 *   operational_expenses :  46/46 baris `amount = 0`
 *
 * Nilai sebenarnya ada di `raw_data`. Karena pembacaan memakai
 * `{ ...raw, ...row }`, kolom DEFAULT itu menimpa data asli sehingga saldo modal
 * terbaca Rp0 dan pembelian tunai ditolak dengan "Saldo Modal Tidak Cukup".
 *
 * Aturan penggantinya: kolom yang DIKELOLA bridge (`TABLE_COLUMNS[table]`)
 * selalu menang; kolom di luar itu tidak boleh menimpa `raw_data`.
 */

const state = vi.hoisted(() => ({ rows: [] as any[] }));

vi.mock('@/lib/supabase', () => {
  const builder = () => {
    const b: any = {};
    b.select = () => b;
    b.eq = () => b;
    b.neq = () => b;
    b.gt = () => b;
    b.gte = () => b;
    b.lt = () => b;
    b.lte = () => b;
    b.in = () => b;
    b.contains = () => b;
    b.or = () => b;
    b.order = () => b;
    b.limit = () => b;
    b.single = async () => ({ data: null, error: null });
    b.maybeSingle = async () => ({ data: state.rows[0] ?? null, error: null });
    b.insert = async () => ({ error: null });
    b.upsert = async () => ({ error: null });
    b.then = (resolve: any) => Promise.resolve({ data: state.rows, error: null }).then(resolve);
    return b;
  };

  const client = {
    from: builder,
    auth: {
      getUser: async () => ({ data: { user: null } }),
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    channel: () => ({ on: () => ({ subscribe: () => {} }) }),
    removeChannel: vi.fn(),
  };

  return { supabase: client, supabaseAdmin: { ...client, auth: { ...client.auth, admin: {} } } };
});

/** Baris `capital_transactions` persis seperti hasil impor di produksi. */
const BARIS_MODAL = {
  id: '5ivvo9g6cty9Y3bvJrn8',
  created_at: '2026-06-10T15:35:48.480+00:00',
  updated_at: '2026-06-10T15:35:48.480+00:00',
  type: null,
  amount: 0,
  description: null,
  recorded_by: null,
  date: '2026-09-19T16:01:12.949982+00:00',
  raw_data: {
    date: { _seconds: 1781105748, _nanoseconds: 480000000 },
    type: 'WITHDRAWAL',
    amount: 2600000,
    recordedBy: 'system',
    description: 'Pembelian Stok (CASH): beras wilis (1 items)',
  },
};

beforeEach(() => {
  state.rows = [];
});

describe('mergeRowWithRawData', () => {
  it('kolom DEFAULT (null/0) tidak menimpa nilai di raw_data', () => {
    const merged = mergeRowWithRawData(BARIS_MODAL, 'capital_transactions');
    expect(merged.type).toBe('WITHDRAWAL');
    expect(merged.amount).toBe(2600000);
    expect(merged.description).toBe('Pembelian Stok (CASH): beras wilis (1 items)');
  });

  it('kolom yang dikelola bridge tetap menang atas raw_data', () => {
    // products.stock memang di-update lewat kolom oleh addStock, jadi kolom
    // harus dipercaya meskipun raw_data tertinggal.
    const baris = {
      id: 'p1',
      name: 'Beras',
      stock: 240,
      is_active: true,
      raw_data: { name: 'Beras', stock: 0 },
    };
    expect(mergeRowWithRawData(baris, 'products').stock).toBe(240);
  });

  it('kolom non-bridge tanpa padanan di raw_data tetap terpakai', () => {
    const baris = {
      id: 'e1',
      category: 'GAJI_KARYAWAN',
      amount: 0,
      raw_data: { amount: 35000, description: 'Gaji harian' },
    };
    const merged = mergeRowWithRawData(baris, 'operational_expenses');
    expect(merged.category).toBe('GAJI_KARYAWAN');
    expect(merged.amount).toBe(35000);
  });

  it('tanpa nama tabel, perilaku lama dipertahankan (kolom menang)', () => {
    // Pemanggil lama yang belum meneruskan nama tabel tidak boleh berubah diam-diam.
    expect(mergeRowWithRawData({ id: 'x', amount: 0, raw_data: { amount: 5 } }).amount).toBe(0);
  });

  it('membiarkan nilai 0 di raw_data tetap 0, bukan hilang', () => {
    const merged = mergeRowWithRawData(
      { id: 'z', amount: null, raw_data: { amount: 0 } },
      'ledger_entries'
    );
    expect(merged.amount).toBe(0);
  });
});

describe('pembacaan lewat bridge dan sbGetDocs', () => {
  it('getDocs menghasilkan amount & type sebenarnya untuk capital_transactions', async () => {
    state.rows = [BARIS_MODAL];
    const snap = await getDocs(collection({}, 'capital_transactions'));
    const data = snap.docs[0].data() as any;

    expect(data.type).toBe('WITHDRAWAL');
    expect(data.amount).toBe(2600000);

    // Perhitungan saldo modal di halaman PO harus melihat angka ini, bukan 0.
    const saldo = data.type === 'WITHDRAWAL' ? -data.amount : data.amount;
    expect(saldo).toBe(-2600000);
  });

  it('normalizeRow memakai aturan yang sama', () => {
    const data = normalizeRow(BARIS_MODAL, 'capital_transactions');
    expect(data.amount).toBe(2600000);
    expect(data.type).toBe('WITHDRAWAL');
  });

  it('sbGetDocs (dipakai laporan keuangan) juga membaca amount sebenarnya', async () => {
    state.rows = [BARIS_MODAL];
    const snap = await sbGetDocs({ table: 'capital_transactions' });
    const data = snap.docs[0].data() as any;

    expect(data.amount).toBe(2600000);
    expect(data.type).toBe('WITHDRAWAL');
  });
});

/**
 * REGRESI 2026-10-01 — "laba bersih salah hitung".
 *
 * `mergeRowWithRawData` meratakan ISI `raw_data` ke permukaan (supaya `data.units`
 * bisa dibaca), tetapi awalnya LUPA mempertahankan properti `raw_data` itu
 * sendiri. Padahal banyak pembaca memakai bentuk `const raw = data.raw_data || {}`
 * — tanpa properti itu `raw` menjadi objek kosong dan hasilnya DIAM-DIAM salah:
 * konversi satuan (CTN -> pcs) hilang sehingga HPP dihitung per satuan jual,
 * bukan per pcs.
 *
 * Dua contoh NYATA dari 1 Okt (data produksi, harga & satuan apa adanya):
 *   - mkt_1790864796550_m745 : FORTUNE BANTAL 1L, 15 CTN @Rp250.000
 *     HPP benar 3.659.940 (15 × 12 pcs × Rp20.333) -> laba Rp90.060
 *     HPP salah   304.995 (15 pcs saja)             -> "laba" Rp3.445.005
 *   - mkt_1790846344433_bv2g : TOP COFFEE TOP MINI 6G, 1 CTN @Rp155.000
 *     HPP benar   133.000 (200 pcs × Rp665)         -> laba Rp22.000
 *     HPP salah       665 (1 pcs saja)              -> "laba" Rp154.335
 */

/** Produk apa adanya dari tabel `products` (hanya kolom yang dipakai laporan). */
const PRODUK_BANTAL = {
  id: 'sqfNNBIbJuvv0I6kMSuW',
  name: 'FORTUNE BANTAL 1L',
  price: 23000,
  unit: 'PCS',
  cost_price: 20333,
  raw_data: {
    Modal: 20333,
    units: [
      { code: 'PCS', contains: 1, price: 23000 },
      { code: 'CTN', contains: 12, price: 280400 },
    ],
  },
};

const PRODUK_KOPI = {
  id: 'prod_1790689091832_k783v',
  name: 'TOP COFFEE TOP MINI 6G',
  price: 800,
  unit: 'PCS',
  cost_price: 665,
  raw_data: {
    Modal: 665,
    units: [
      { code: 'PCS', contains: 1, price: 800 },
      { code: 'RTG', contains: 10, price: 8000 },
      { code: 'CTN', contains: 200, price: 733000 },
    ],
  },
};

/**
 * Rumus HPP yang dipakai tabel mutasi di `src/app/admin/reports/finance/page.tsx`
 * (diringkas ke bagian yang relevan). Kalau halaman itu berubah, test ini wajib
 * ikut disesuaikan.
 */
function hppDanLaba(
  produk: any,
  item: { price: number; quantity: number; unit?: string }
) {
  const raw = produk?.raw_data || {};

  let conv = 1;
  const itemUnit = (item.unit || '').toUpperCase();
  if (itemUnit && itemUnit !== 'PCS') {
    const uObj = (raw.units || []).find(
      (x: any) => (x.code || '').toUpperCase() === itemUnit
    );
    if (uObj?.contains) conv = Number(uObj.contains);
  }

  const cost = Number(produk?.cost_price ?? raw.Modal ?? 0);
  const pendapatan = item.price * item.quantity;
  const hpp = cost * (item.quantity * conv);
  return { pendapatan, hpp, laba: pendapatan - hpp };
}

describe('raw_data tetap ada setelah perataan (regresi HPP / laba bersih)', () => {
  it('properti raw_data tidak hilang', () => {
    const merged = mergeRowWithRawData(PRODUK_BANTAL, 'products');
    expect(merged.raw_data).toEqual(PRODUK_BANTAL.raw_data);
    // Isinya juga tetap diratakan ke permukaan.
    expect(merged.units).toHaveLength(2);
  });

  it('getDocs: FORTUNE BANTAL 15 CTN dihitung 180 pcs, bukan 15', async () => {
    state.rows = [PRODUK_BANTAL];
    const snap = await getDocs(collection({}, 'products'));
    const produk = snap.docs[0].data() as any;

    const { pendapatan, hpp, laba } = hppDanLaba(produk, {
      price: 250000,
      quantity: 15,
      unit: 'CTN',
    });

    expect(pendapatan).toBe(3750000);
    expect(hpp).toBe(20333 * 15 * 12);
    expect(hpp).toBe(3659940);
    expect(laba).toBe(90060);
  });

  it('normalizeRow: TOP COFFEE 1 CTN dihitung 200 pcs, bukan 1', () => {
    const produk = normalizeRow(PRODUK_KOPI, 'products');

    const { pendapatan, hpp, laba } = hppDanLaba(produk, {
      price: 155000,
      quantity: 1,
      unit: 'CTN',
    });

    expect(pendapatan).toBe(155000);
    expect(hpp).toBe(665 * 200);
    expect(hpp).toBe(133000);
    expect(laba).toBe(22000);
  });

  it('sbGetDocs: satuan PCS tetap dihitung apa adanya', async () => {
    state.rows = [PRODUK_KOPI];
    const snap = await sbGetDocs({ table: 'products' });
    const produk = snap.docs[0].data() as any;

    const { hpp } = hppDanLaba(produk, { price: 800, quantity: 10, unit: 'PCS' });
    expect(hpp).toBe(6650);
  });
});
