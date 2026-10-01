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
