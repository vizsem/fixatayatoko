import { describe, it, expect, vi, beforeEach } from 'vitest';

import { lengkapiSnapshotHpp } from '@/lib/hpp-server';

/**
 * Perekaman modal saat transaksi — inti dari "angka laba tidak berubah-ubah".
 *
 * Kalau `hppPerPcs` tidak ikut tersimpan, laba order ini akan terus mengikuti
 * Modal terkini produk, sehingga setiap kali Modal diperbaiki angka laporan
 * lama ikut berubah.
 */

const state = vi.hoisted(() => ({
  produk: [] as any[],
  error: null as any,
  tabelDiminta: [] as string[],
}));

vi.mock('@/lib/supabase', () => {
  const builder: any = {};
  builder.select = () => builder;
  builder.in = () => builder;
  builder.then = (resolve: any) =>
    Promise.resolve({ data: state.error ? null : state.produk, error: state.error }).then(resolve);
  const client = {
    from: (table: string) => {
      state.tabelDiminta.push(table);
      return builder;
    },
  };
  return { supabase: client, supabaseAdmin: client };
});

beforeEach(() => {
  state.produk = [];
  state.error = null;
  state.tabelDiminta = [];
});

describe('lengkapiSnapshotHpp', () => {
  it('menempelkan modal per pcs + total ke baris item', async () => {
    state.produk = [
      {
        id: 'p1',
        cost_price: 20333,
        raw_data: { units: [{ code: 'PCS', contains: 1 }, { code: 'CTN', contains: 12 }] },
      },
    ];

    const hasil = await lengkapiSnapshotHpp([
      { id: 'p1', price: 250000, quantity: 15, unit: 'CTN', baseQuantity: 180 },
    ]);

    expect(hasil[0].hppPerPcs).toBe(20333);
    expect(hasil[0].hppTotal).toBe(3659940);
    // Item aslinya tidak diubah.
    expect(hasil[0].quantity).toBe(15);
  });

  it('tidak merekam apa pun bila Modal produk kosong', async () => {
    state.produk = [{ id: 'p2', cost_price: 0, raw_data: {} }];

    const hasil = await lengkapiSnapshotHpp([{ id: 'p2', price: 10000, quantity: 1, unit: 'PCS' }]);

    expect(hasil[0].hppPerPcs).toBeUndefined();
    expect(hasil[0].hppTotal).toBeUndefined();
  });

  it('order tetap jalan (tanpa snapshot) bila pembacaan produk gagal', async () => {
    state.error = { message: 'koneksi terputus' };

    const hasil = await lengkapiSnapshotHpp([{ id: 'p3', price: 5000, quantity: 2, unit: 'PCS' }]);

    expect(hasil).toHaveLength(1);
    expect(hasil[0].hppPerPcs).toBeUndefined();
    expect(hasil[0].price).toBe(5000);
  });

  it('daftar kosong tidak menyentuh basis data', async () => {
    const hasil = await lengkapiSnapshotHpp([]);
    expect(hasil).toEqual([]);
    expect(state.tabelDiminta).toHaveLength(0);
  });
});
