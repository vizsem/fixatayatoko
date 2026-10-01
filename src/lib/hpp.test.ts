import { describe, it, expect } from 'vitest';

import {
  ambilHppPerPcs,
  cariContainsSatuan,
  hitungHppItem,
  hitungItemOrder,
  hitungPcsItem,
  hitungPetaModalPembelian,
  nilaiSnapshotHpp,
  ringkasLabaItem,
} from '@/lib/hpp';

/**
 * HPP / laba bersih kotor penjualan.
 *
 * Semua angka di bawah diambil APA ADANYA dari data produksi 1 Okt 2026 —
 * hari ketika pemilik melaporkan "laba bersih salah hitung":
 *   mkt_1790864796550_m745 : FORTUNE BANTAL 1L, 15 CTN @Rp250.000
 *   mkt_1790846344433_bv2g : TOP COFFEE TOP MINI 6G, 1 CTN @Rp155.000
 */

const PRODUK_BANTAL = {
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

describe('cariContainsSatuan', () => {
  it('mencocokkan kode satuan', () => {
    expect(cariContainsSatuan('CTN', PRODUK_BANTAL.raw_data.units)).toBe(12);
    expect(cariContainsSatuan('ctn', PRODUK_KOPI.raw_data.units)).toBe(200);
    expect(cariContainsSatuan('PCS', PRODUK_KOPI.raw_data.units)).toBe(1);
  });

  it('mencocokkan nama satuan bila kodenya berbeda', () => {
    const units = [{ code: 'X1', name: 'Dus', contains: 24 }];
    expect(cariContainsSatuan('DUS', units)).toBe(24);
  });

  it('satuan karton bisa jatuh ke kode karton lain', () => {
    // Order menulis "DUS" sementara master produk memakai "CTN".
    expect(cariContainsSatuan('DUS', PRODUK_BANTAL.raw_data.units)).toBe(12);
  });

  it('satuan tak dikenal dianggap 1 pcs (jangan mengarang konversi)', () => {
    expect(cariContainsSatuan('LUSIN', PRODUK_BANTAL.raw_data.units)).toBe(1);
    expect(cariContainsSatuan('', PRODUK_BANTAL.raw_data.units)).toBe(1);
    expect(cariContainsSatuan('CTN', undefined)).toBe(1);
  });
});

describe('hitungPcsItem', () => {
  it('memakai baseQuantity (terekam saat transaksi) bila ada', () => {
    expect(
      hitungPcsItem({ quantity: 15, unit: 'CTN', baseQuantity: 180, containsPerUnit: 12 })
    ).toBe(180);
  });

  it('memakai containsPerUnit bila baseQuantity tidak ada', () => {
    expect(hitungPcsItem({ quantity: 7, unit: 'CTN', containsPerUnit: 40 })).toBe(280);
  });

  it('memakai `contains` (order kasir) bila field snapshot lain tidak ada', () => {
    expect(hitungPcsItem({ quantity: 15, unit: 'CTN', contains: 12 })).toBe(180);
  });

  it('memakai daftar satuan produk sebagai cadangan', () => {
    expect(hitungPcsItem({ quantity: 15, unit: 'CTN' }, PRODUK_BANTAL.raw_data.units)).toBe(180);
  });

  it('tanpa info satuan: jumlah satuan jual dipakai apa adanya', () => {
    expect(hitungPcsItem({ quantity: 6, unit: 'PCS' })).toBe(6);
    expect(hitungPcsItem({ quantity: 2, unit: 'LUSIN' })).toBe(2);
  });
});

describe('ambilHppPerPcs', () => {
  it('snapshot saat transaksi menang atas Modal terkini', () => {
    // Modal produk sudah diubah jadi 30.000, tetapi transaksinya terjadi saat
    // modalnya masih 20.333 — laba order lama TIDAK boleh ikut berubah.
    const hasil = ambilHppPerPcs({
      item: { hppPerPcs: 20333 },
      produk: { cost_price: 30000, raw_data: {} },
    });
    expect(hasil).toEqual({ costPerPcs: 20333, sumber: 'SNAPSHOT' });
  });

  it('master produk menang bila tidak ada snapshot', () => {
    const hasil = ambilHppPerPcs({ item: {}, produk: PRODUK_BANTAL });
    expect(hasil).toEqual({ costPerPcs: 20333, sumber: 'MASTER' });
  });

  it('modal dari order KASIR (field `cost`) dianggap snapshot, bukan estimasi', () => {
    const hasil = ambilHppPerPcs({
      item: { cost: 81000, contains: 1 },
      produk: { cost_price: 0, raw_data: {} },
    });
    expect(hasil).toEqual({ costPerPcs: 81000, sumber: 'SNAPSHOT' });
  });

  it('Modal di baris order dipakai bila master kosong (order lama)', () => {
    const hasil = ambilHppPerPcs({ item: { Modal: 15000 }, produk: { cost_price: 0, raw_data: {} } });
    expect(hasil).toEqual({ costPerPcs: 15000, sumber: 'ITEM' });
  });

  it('harga pembelian terakhir dipakai bila dua sumber di atas kosong', () => {
    const hasil = ambilHppPerPcs({ item: {}, produk: undefined, costPembelianPerPcs: 1200 });
    expect(hasil).toEqual({ costPerPcs: 1200, sumber: 'PEMBELIAN' });
  });

  it('tanpa data apa pun ditandai ESTIMASI, bukan diam-diam 0', () => {
    expect(ambilHppPerPcs({ item: {}, produk: undefined }).sumber).toBe('ESTIMASI');
  });
});

describe('hitungHppItem — dua order nyata 1 Okt', () => {
  it('FORTUNE BANTAL 1L: 15 CTN x 12 pcs x Rp20.333', () => {
    const hasil = hitungHppItem({
      item: {
        id: 'sqfNNBIbJuvv0I6kMSuW',
        price: 250000,
        quantity: 15,
        unit: 'CTN',
        baseQuantity: 180,
        containsPerUnit: 12,
      },
      produk: PRODUK_BANTAL,
    });

    expect(hasil.pcs).toBe(180);
    expect(hasil.pendapatan).toBe(3750000);
    expect(hasil.hpp).toBe(3659940);
    expect(hasil.pendapatan - hasil.hpp).toBe(90060);
    expect(hasil.sumber).toBe('MASTER');
  });

  it('TOP COFFEE TOP MINI 6G: 1 CTN x 200 pcs x Rp665', () => {
    const hasil = hitungHppItem({
      item: {
        id: 'prod_1790689091832_k783v',
        price: 155000,
        quantity: 1,
        unit: 'CTN',
        baseQuantity: 200,
        containsPerUnit: 200,
      },
      produk: PRODUK_KOPI,
    });

    expect(hasil.pendapatan).toBe(155000);
    expect(hasil.hpp).toBe(133000);
    expect(hasil.pendapatan - hasil.hpp).toBe(22000);
  });

  it('satuan PCS tidak berubah', () => {
    const hasil = hitungHppItem({
      item: { price: 18200, quantity: 6, unit: 'PCS', baseQuantity: 6, containsPerUnit: 1 },
      produk: { cost_price: 17500, raw_data: {} },
    });
    expect(hasil.pcs).toBe(6);
    expect(hasil.hpp).toBe(105000);
  });

  it('tanpa Modal: HPP estimasi 85% dan sumbernya ditandai', () => {
    const hasil = hitungHppItem({
      item: { price: 10000, quantity: 2, unit: 'PCS' },
      produk: { cost_price: 0, raw_data: {} },
    });
    expect(hasil.sumber).toBe('ESTIMASI');
    expect(hasil.hpp).toBe(17000); // 2 x (85% x Rp10.000)
  });
});

describe('hitungPetaModalPembelian', () => {
  it('dikunci dengan id PRODUK, bukan id baris pembelian', () => {
    // Bug lama: kuncinya `item.id` (item_0_...) sehingga pencarian selalu gagal.
    const peta = hitungPetaModalPembelian([
      {
        createdAt: '2026-10-01T00:00:00.000Z',
        items: [{ id: 'item_0_1790', productId: 'p1', purchasePrice: 83000, conversion: 12 }],
      },
    ]);

    expect(peta.has('item_0_1790')).toBe(false);
    expect(peta.get('p1')?.costPerPcs).toBeCloseTo(83000 / 12);
  });

  it('mengambil pembelian TERBARU per produk', () => {
    const peta = hitungPetaModalPembelian([
      {
        createdAt: '2026-01-01T00:00:00.000Z',
        items: [{ productId: 'p1', purchasePrice: 1000, conversion: 1 }],
      },
      {
        createdAt: '2026-09-01T00:00:00.000Z',
        items: [{ productId: 'p1', purchasePrice: 1500, conversion: 1 }],
      },
    ]);

    expect(peta.get('p1')?.costPerPcs).toBe(1500);
  });

  it('mengabaikan baris tanpa productId atau tanpa harga', () => {
    const peta = hitungPetaModalPembelian([
      { createdAt: '2026-10-01T00:00:00.000Z', items: [{ id: 'x', purchasePrice: 900, conversion: 1 }] },
      { createdAt: '2026-10-01T00:00:00.000Z', items: [{ productId: 'p2', purchasePrice: 0 }] },
    ]);

    expect(peta.size).toBe(0);
  });
});

describe('ringkasLabaItem — laba nyata dipisah dari laba estimasi', () => {
  it('memisahkan baris bermodal nyata dari baris tanpa Modal', () => {
    const { ringkasan } = hitungItemOrder({
      items: [
        { id: 'p1', price: 10000, quantity: 2, unit: 'PCS' }, // modal ada
        { id: 'p2', price: 20000, quantity: 1, unit: 'PCS' }, // modal kosong
      ],
      produkDari: (pid) =>
        pid === 'p1' ? { cost_price: 6000, raw_data: {} } : { cost_price: 0, raw_data: {} },
    });

    expect(ringkasan.itemTotal).toBe(2);
    expect(ringkasan.itemEstimasi).toBe(1);
    expect(ringkasan.pendapatan).toBe(40000);
    // Baris bermodal: 20.000 - 12.000 = 8.000 (ini angka yang boleh dipakai)
    expect(ringkasan.labaDipercaya).toBe(8000);
    // Baris tanpa modal: 20.000 - 17.000 = 3.000 (hanya perkiraan)
    expect(ringkasan.labaEstimasi).toBe(3000);
  });

  it('ringkasan kosong tetap berbentuk angka nol', () => {
    expect(ringkasLabaItem([])).toEqual({
      pendapatan: 0,
      hppDipercaya: 0,
      hppEstimasi: 0,
      labaDipercaya: 0,
      labaEstimasi: 0,
      itemTotal: 0,
      itemEstimasi: 0,
    });
  });
});

describe('nilaiSnapshotHpp — apa yang direkam saat order dibuat', () => {
  it('merekam modal per pcs bila sumbernya nyata', () => {
    const hasil = nilaiSnapshotHpp({
      item: { price: 250000, quantity: 15, unit: 'CTN', baseQuantity: 180 },
      produk: PRODUK_BANTAL,
    });

    expect(hasil.sumber).toBe('MASTER');
    expect(hasil.hppPerPcs).toBe(20333);
    expect(hasil.hppTotal).toBe(3659940);
    expect(hasil.pcs).toBe(180);
  });

  it('TIDAK merekam angka estimasi (jangan membekukan angka karangan)', () => {
    const hasil = nilaiSnapshotHpp({
      item: { price: 10000, quantity: 1, unit: 'PCS' },
      produk: { cost_price: 0, raw_data: {} },
    });

    expect(hasil.sumber).toBe('ESTIMASI');
    expect(hasil.hppPerPcs).toBeUndefined();
    expect(hasil.hppTotal).toBe(0);
  });
});
