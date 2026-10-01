import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  pembayaranKeluarUang,
  ringkasMutasi,
  hitungSaldoModal,
  hitungPenyesuaian,
  susunKeterangan,
  rekonsiliasiMutasiModal,
  catatMutasiModalPO,
} from '@/lib/capital-ledger';

/**
 * Bug yang dijaga test ini (nyata, terverifikasi ke database produksi).
 *
 * Pencatatan keluar-masuk modal untuk PO dulu dilakukan di PERAMBAN lewat
 * `writeBatch`, di dalam try/catch yang hanya `console.warn`. Sejak pembuatan PO
 * pindah ke Server Action, blok itu selalu gagal tanpa suara:
 *
 *   - SEMUA baris "Pembelian Stok (CASH): ..." di `capital_transactions`
 *     bertanggal <= 2026-07-29, padahal PO baru (id `po_*`) muncul sejak
 *     2026-09-30 -> pembelian tunai tidak pernah mengurangi saldo modal.
 *   - Blok itu juga menulis ULANG baris `purchases`, sehingga PO bisa tercatat
 *     dua kali.
 *
 * Penggantinya: `rekonsiliasiMutasiModal()` membandingkan POSISI modal per PO
 * dengan nilai yang seharusnya, lalu menulis satu penyesuaian atau tidak sama
 * sekali (idempoten).
 */

const state = vi.hoisted(() => ({
  rows: [] as any[],
  inserts: [] as any[],
  filters: [] as [string, any][],
  selectError: null as any,
  insertError: null as any,
}));

vi.mock('@/lib/supabase', () => {
  const client = {
    from: (table: string) => {
      if (table !== 'capital_transactions') {
        throw new Error(`Akses tabel tak terduga: ${table}`);
      }
      const builder: any = {};
      builder.select = () => builder;
      builder.order = () => builder;
      builder.limit = () => builder;
      builder.eq = (col: string, val: any) => {
        state.filters.push([col, val]);
        return builder;
      };
      builder.insert = (payload: any) => {
        state.inserts.push(payload);
        return Promise.resolve({ data: null, error: state.insertError });
      };
      builder.then = (resolve: any) =>
        Promise.resolve({ data: state.rows, error: state.selectError }).then(resolve);
      return builder;
    },
  };
  return { supabase: client, supabaseAdmin: client };
});

beforeEach(() => {
  state.rows = [];
  state.inserts = [];
  state.filters = [];
  state.selectError = null;
  state.insertError = null;
});

/** Baris `capital_transactions` nyata: kolomnya kosong, isinya di raw_data. */
const barisMutasi = (type: 'INJECTION' | 'WITHDRAWAL', amount: number) => ({
  id: `cap-${type}-${amount}`,
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
  type: null,
  amount: 0,
  raw_data: { type, amount, description: 'uji', referenceId: 'po_1' },
});

describe('pembayaranKeluarUang', () => {
  it('hanya LUNAS + CASH/TRANSFER yang mengeluarkan uang', () => {
    expect(pembayaranKeluarUang('LUNAS', 'CASH')).toBe(true);
    expect(pembayaranKeluarUang('LUNAS', 'TRANSFER')).toBe(true);
    expect(pembayaranKeluarUang('lunas', 'transfer')).toBe(true);
  });

  it('tempo/HUTANG tidak pernah mengeluarkan uang', () => {
    expect(pembayaranKeluarUang('LUNAS', 'HUTANG')).toBe(false);
    expect(pembayaranKeluarUang('HUTANG', 'CASH')).toBe(false);
    expect(pembayaranKeluarUang(undefined, undefined)).toBe(false);
  });
});

describe('ringkasMutasi', () => {
  it('membaca type/amount dari raw_data, bukan dari kolom DEFAULT importer', () => {
    const hasil = ringkasMutasi([barisMutasi('WITHDRAWAL', 2600000)]);
    expect(hasil.withdrawal).toBe(2600000);
    expect(hasil.injection).toBe(0);
    expect(hasil.count).toBe(1);
  });

  it('mengabaikan baris rusak atau bernilai nol', () => {
    const hasil = ringkasMutasi([
      { id: 'a', raw_data: { type: 'WITHDRAWAL', amount: 'bukan angka' } },
      { id: 'b', raw_data: { type: 'INJECTION', amount: 0 } },
      { id: 'c', raw_data: null },
    ]);
    expect(hasil.injection).toBe(0);
    expect(hasil.withdrawal).toBe(0);
  });
});

describe('hitungSaldoModal', () => {
  it('menghitung saldo dari seluruh baris, bukan 100 baris pertama', () => {
    const rows = [barisMutasi('INJECTION', 1000000), barisMutasi('WITHDRAWAL', 250000)];
    expect(hitungSaldoModal(rows)).toEqual({
      injection: 1000000,
      withdrawal: 250000,
      balance: 750000,
      count: 2,
    });
  });
});

describe('hitungPenyesuaian', () => {
  it('tidak menulis apa pun bila posisi modal sudah cocok (idempoten)', () => {
    expect(hitungPenyesuaian(100000, { injection: 0, withdrawal: 100000, count: 1 })).toBeNull();
  });

  it('menarik modal saat PO tunai baru dibuat', () => {
    expect(hitungPenyesuaian(250000, { injection: 0, withdrawal: 0, count: 0 })).toEqual({
      type: 'WITHDRAWAL',
      amount: 250000,
    });
  });

  it('mengembalikan modal saat PO diubah menjadi HUTANG atau dibatalkan', () => {
    expect(hitungPenyesuaian(0, { injection: 0, withdrawal: 400000, count: 1 })).toEqual({
      type: 'INJECTION',
      amount: 400000,
    });
  });

  it('hanya mencatat SELISIH saat nominal PO diedit', () => {
    expect(hitungPenyesuaian(900000, { injection: 0, withdrawal: 400000, count: 1 })).toEqual({
      type: 'WITHDRAWAL',
      amount: 500000,
    });
    expect(hitungPenyesuaian(100000, { injection: 0, withdrawal: 400000, count: 1 })).toEqual({
      type: 'INJECTION',
      amount: 300000,
    });
  });
});

describe('susunKeterangan', () => {
  it('meniru format lama pada mutasi pertama agar laporan lama tetap terbaca', () => {
    expect(
      susunKeterangan({
        type: 'WITHDRAWAL',
        sudahAdaMutasiSebelumnya: false,
        label: 'beras wilis',
        paymentMethod: 'CASH',
        itemCount: 2,
      })
    ).toBe('Pembelian Stok (CASH): beras wilis (2 items)');
  });

  it('menandai penyesuaian berikutnya dan pengembalian modal', () => {
    expect(
      susunKeterangan({
        type: 'WITHDRAWAL',
        sudahAdaMutasiSebelumnya: true,
        label: 'beras wilis',
        paymentMethod: 'CASH',
      })
    ).toBe('Penyesuaian PO (CASH): beras wilis');

    expect(
      susunKeterangan({ type: 'INJECTION', sudahAdaMutasiSebelumnya: true, label: 'beras wilis' })
    ).toBe('Pengembalian Modal PO: beras wilis');
  });
});

describe('rekonsiliasiMutasiModal', () => {
  it('menulis satu WITHDRAWAL lengkap dengan referenceId PO', async () => {
    const hasil = await rekonsiliasiMutasiModal({
      referenceId: 'po_123',
      diharapkan: 615000,
      label: 'PT. Super indo grosir',
      paymentMethod: 'CASH',
      itemCount: 3,
    });

    expect(hasil).toEqual({ success: true, disesuaikan: 615000, type: 'WITHDRAWAL' });
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0].raw_data).toMatchObject({
      type: 'WITHDRAWAL',
      amount: 615000,
      referenceId: 'po_123',
      recordedBy: 'system',
      source: 'PURCHASE_ORDER',
    });
    expect(state.inserts[0].raw_data.description).toBe(
      'Pembelian Stok (CASH): PT. Super indo grosir (3 items)'
    );
    // Filter WAJIB per PO, bukan membaca seluruh tabel lalu menyaring di memori.
    expect(state.filters).toContainEqual(['raw_data->>referenceId', 'po_123']);
  });

  it('tidak menulis apa pun bila dijalankan dua kali untuk PO yang sama', async () => {
    state.rows = [barisMutasi('WITHDRAWAL', 615000)];
    const hasil = await rekonsiliasiMutasiModal({
      referenceId: 'po_123',
      diharapkan: 615000,
      label: 'PT. Super indo grosir',
      paymentMethod: 'CASH',
    });

    expect(hasil).toEqual({ success: true, disesuaikan: 0 });
    expect(state.inserts).toHaveLength(0);
  });

  it('mengembalikan dana saat PO dibatalkan', async () => {
    state.rows = [barisMutasi('WITHDRAWAL', 615000)];
    const hasil = await rekonsiliasiMutasiModal({
      referenceId: 'po_123',
      diharapkan: 0,
      label: 'PT. Super indo grosir',
    });

    expect(hasil).toMatchObject({ success: true, type: 'INJECTION', disesuaikan: 615000 });
    expect(state.inserts[0].raw_data.type).toBe('INJECTION');
  });

  it('melaporkan kegagalan tulis sebagai error, bukan sukses palsu', async () => {
    state.insertError = { message: 'permission denied' };
    const hasil = await rekonsiliasiMutasiModal({
      referenceId: 'po_123',
      diharapkan: 100000,
      label: 'Supplier',
    });
    expect(hasil).toEqual({ success: false, error: 'permission denied' });
  });
});

describe('catatMutasiModalPO', () => {
  it('PO tempo tidak menyentuh tabel modal sama sekali', async () => {
    const peringatan = await catatMutasiModalPO({
      poId: 'po_9',
      total: 1000000,
      paymentStatus: 'HUTANG',
      paymentMethod: 'HUTANG',
      label: 'Supplier',
    });
    expect(peringatan).toBeNull();
    expect(state.inserts).toHaveLength(0);
  });

  it('PO tunai menarik modal dan mengembalikan null saat berhasil', async () => {
    const peringatan = await catatMutasiModalPO({
      poId: 'po_9',
      total: 1000000,
      paymentStatus: 'LUNAS',
      paymentMethod: 'CASH',
      label: 'Supplier',
    });
    expect(peringatan).toBeNull();
    expect(state.inserts[0].raw_data).toMatchObject({ type: 'WITHDRAWAL', amount: 1000000 });
  });

  it('mengembalikan pesan peringatan (bukan melempar) saat pencatatan modal gagal', async () => {
    state.insertError = { message: 'koneksi terputus' };
    const peringatan = await catatMutasiModalPO({
      poId: 'po_9',
      total: 1000000,
      paymentStatus: 'LUNAS',
      paymentMethod: 'TRANSFER',
      label: 'Supplier',
    });
    expect(peringatan).toContain('pencatatan mutasi modal gagal');
    expect(peringatan).toContain('koneksi terputus');
  });

  it('mengembalikan dana tunai milik PO yang dibatalkan', async () => {
    state.rows = [barisMutasi('WITHDRAWAL', 250000)];
    const peringatan = await catatMutasiModalPO({
      poId: 'po_1',
      total: 250000,
      paymentStatus: 'LUNAS',
      paymentMethod: 'CASH',
      label: 'Supplier',
      dibatalkan: true,
    });
    expect(peringatan).toBeNull();
    expect(state.inserts[0].raw_data).toMatchObject({ type: 'INJECTION', amount: 250000 });
  });
});
