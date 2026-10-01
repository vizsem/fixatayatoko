import { describe, it, expect } from 'vitest';

import {
  bandingkanPO,
  bacaJenisMutasi,
  bacaNominalMutasi,
  bacaWaktuPO,
  kebutuhanModalPO,
  pembayaranKeluarUang,
  petakanMutasiMentah,
  petakanPOUntukRekonsiliasi,
  posisiTercatat,
  ringkasMutasiPerPO,
  ringkasRekonsiliasi,
  type MutasiTercatat,
  type POUntukRekonsiliasi,
} from '@/lib/capital-reconcile';

/**
 * Aturan rekonsiliasi PO ↔ buku besar modal.
 *
 * Dipakai TIGA tempat yang harus sepakat: Server Action halaman
 * `/admin/capital/rekonsiliasi`, skrip `npm run reconcile:capital-po`, dan
 * penjaga test ini.
 */

const po = (ubah: Partial<POUntukRekonsiliasi> = {}): POUntukRekonsiliasi => ({
  id: 'po_1',
  poNumber: 'PO-1',
  createdAt: '2026-10-01T00:00:00.000Z',
  supplierName: 'Supplier',
  paymentStatus: 'LUNAS',
  paymentMethod: 'CASH',
  total: 100000,
  ...ubah,
});

const tercatat = (injection: number, withdrawal: number): MutasiTercatat => ({
  injection,
  withdrawal,
  count: injection || withdrawal ? 1 : 0,
});

describe('pembayaranKeluarUang', () => {
  it('hanya LUNAS + CASH/TRANSFER', () => {
    expect(pembayaranKeluarUang('LUNAS', 'CASH')).toBe(true);
    expect(pembayaranKeluarUang('lunas', 'transfer')).toBe(true);
    expect(pembayaranKeluarUang('LUNAS', 'HUTANG')).toBe(false);
    expect(pembayaranKeluarUang('HUTANG', 'CASH')).toBe(false);
    expect(pembayaranKeluarUang(undefined, undefined)).toBe(false);
  });
});

describe('bacaJenisMutasi & bacaNominalMutasi', () => {
  it('menerima huruf besar/kecil dan spasi', () => {
    expect(bacaJenisMutasi(' withdrawal ')).toBe('WITHDRAWAL');
    expect(bacaJenisMutasi('INJECTION')).toBe('INJECTION');
    expect(bacaJenisMutasi('TRANSFER')).toBeNull();
    expect(bacaJenisMutasi(null)).toBeNull();
  });

  it('mengabaikan nominal yang tidak masuk akal', () => {
    expect(bacaNominalMutasi('2500')).toBe(2500);
    expect(bacaNominalMutasi(0)).toBe(0);
    expect(bacaNominalMutasi(-5)).toBe(0);
    expect(bacaNominalMutasi('bukan angka')).toBe(0);
    expect(bacaNominalMutasi(null)).toBe(0);
  });
});

describe('posisiTercatat', () => {
  it('positif berarti uang sudah keluar', () => {
    expect(posisiTercatat(tercatat(0, 500))).toBe(500);
    expect(posisiTercatat(tercatat(200, 500))).toBe(300);
    expect(posisiTercatat(undefined)).toBe(0);
  });
});

describe('kebutuhanModalPO', () => {
  it('sebesar total hanya bila PO dibayar tunai/transfer', () => {
    expect(kebutuhanModalPO(po())).toBe(100000);
    expect(kebutuhanModalPO(po({ paymentStatus: 'HUTANG', paymentMethod: 'HUTANG' }))).toBe(0);
  });

  it('total kosong/tidak masuk akal dianggap nol', () => {
    expect(kebutuhanModalPO(po({ total: 0 }))).toBe(0);
    expect(kebutuhanModalPO(po({ total: Number.NaN }))).toBe(0);
  });
});

describe('bacaWaktuPO', () => {
  it('membaca objek Timestamp gaya Firestore (hasil impor)', () => {
    // Tanpa ini, `String(objek)` = "[object Object]" dan filter tanggal kacau.
    expect(bacaWaktuPO({ _seconds: 1781105748, _nanoseconds: 480000000 })).toBe(
      new Date(1781105748 * 1000).toISOString()
    );
    expect(bacaWaktuPO({ seconds: 1781105748 })).toBe(new Date(1781105748 * 1000).toISOString());
  });

  it('membaca ISO string, Date, dan menolak yang tidak terbaca', () => {
    expect(bacaWaktuPO('2026-10-01T00:00:00.000Z')).toBe('2026-10-01T00:00:00.000Z');
    expect(bacaWaktuPO(new Date('2026-10-01T00:00:00.000Z'))).toBe('2026-10-01T00:00:00.000Z');
    expect(bacaWaktuPO(null)).toBe('');
    expect(bacaWaktuPO('bukan tanggal')).toBe('');
    expect(bacaWaktuPO({})).toBe('');
  });
});

describe('petakanPOUntukRekonsiliasi', () => {
  it('memakai nilai default LUNAS + CASH seperti daftar PO', () => {
    const hasil = petakanPOUntukRekonsiliasi({ id: 'po_x', total: 5000, raw_data: {} });
    expect(hasil).toMatchObject({
      id: 'po_x',
      total: 5000,
      paymentStatus: 'LUNAS',
      paymentMethod: 'CASH',
      supplierName: 'Supplier Umum',
    });
  });

  it('mengutamakan kolom created_at bila raw_data tidak punya tanggal terbaca', () => {
    const hasil = petakanPOUntukRekonsiliasi({
      id: 'po_y',
      total: 1,
      created_at: '2026-03-01T00:00:00.000Z',
      raw_data: {},
    });
    expect(hasil.createdAt).toBe('2026-03-01T00:00:00.000Z');
  });
});

describe('petakanMutasiMentah & ringkasMutasiPerPO', () => {
  it('membaca dari raw_data dan mengabaikan baris tanpa referenceId', () => {
    const mutasi = ringkasMutasiPerPO(
      petakanMutasiMentah([
        { id: 'a', raw_data: { referenceId: 'po_1', type: 'WITHDRAWAL', amount: 5000 } },
        { id: 'b', raw_data: { referenceId: 'po_1', type: 'INJECTION', amount: 1000 } },
        // Penyesuaian modal manual: tidak dimiliki PO mana pun.
        { id: 'c', raw_data: { type: 'INJECTION', amount: 999999 } },
      ])
    );

    expect(mutasi.get('po_1')).toEqual({ injection: 1000, withdrawal: 5000, count: 2 });
    expect(mutasi.has('')).toBe(false);
    expect(mutasi.size).toBe(1);
  });
});

describe('bandingkanPO', () => {
  it('hanya mengembalikan PO yang selisihnya bukan nol, terbaru lebih dulu', () => {
    const hasil = bandingkanPO(
      [
        po({ id: 'po_lama', poNumber: 'PO-LAMA', createdAt: '2026-03-01T00:00:00.000Z' }),
        po({ id: 'po_baru', poNumber: 'PO-BARU', createdAt: '2026-10-01T00:00:00.000Z' }),
        po({ id: 'po_cocok' }),
      ],
      new Map([
        ['po_lama', tercatat(0, 100000)], // sudah cocok
        ['po_cocok', tercatat(0, 100000)], // sudah cocok
      ])
    );

    expect(hasil).toHaveLength(1);
    expect(hasil[0]).toMatchObject({ poId: 'po_baru', selisih: 100000 });
  });

  it('menandai kelebihan potong sebagai selisih negatif', () => {
    const hasil = bandingkanPO(
      [po({ paymentStatus: 'HUTANG', paymentMethod: 'HUTANG' })],
      new Map([['po_1', tercatat(0, 40000)]])
    );

    expect(hasil[0]).toMatchObject({ diharapkan: 0, tercatat: 40000, selisih: -40000 });
  });
});

describe('ringkasRekonsiliasi', () => {
  it('memisahkan yang belum dipotong dan yang kelebihan dipotong', () => {
    const ringkas = ringkasRekonsiliasi(
      bandingkanPO(
        [
          po({ id: 'a', poNumber: 'A' }),
          po({ id: 'b', poNumber: 'B', paymentStatus: 'HUTANG', paymentMethod: 'HUTANG' }),
        ],
        new Map([['b', tercatat(0, 25000)]])
      )
    );

    expect(ringkas).toEqual({
      jumlah: 2,
      kurangPotong: 100000,
      lebihPotong: 25000,
      jumlahKurangPotong: 1,
      jumlahLebihPotong: 1,
    });
  });
});
