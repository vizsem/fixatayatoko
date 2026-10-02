import { describe, it, expect } from 'vitest';

import { normalizeRow } from '@/lib/supabase-helpers';
import { toPlainRow } from '@/lib/db-schema';
import {
  akunJurnalRetur,
  formatRupiah,
  formatTanggalRetur,
  itemTanpaProduk,
  keRetur,
  normalisasiItem,
  normalisasiItems,
  ringkasRetur,
  saringRetur,
  tanggalKeIso,
  totalDariItems,
  validasiReturBaru,
  type Retur,
} from '@/lib/returns';

/**
 * Uji ini memakai BENTUK BARIS NYATA dari tabel `returns` Supabase
 * (diverifikasi 2026-10-02): hanya kolom `id`, `raw_data`, `created_at`,
 * `updated_at`, dan sebagian timestamp di dalamnya masih gaya Firestore
 * (`{ _seconds, _nanoseconds }`) karena warisan impor.
 */

const BARIS_1 = {
  id: 'Wci7VQhYz51L8nlxMgli',
  created_at: '2026-05-27T17:08:34.815+00:00',
  updated_at: '2026-09-27T21:58:50.247+00:00',
  raw_data: {
    type: 'SALES_RETURN',
    items: [
      {
        price: 22999,
        quantity: 150,
        productId: '2hesToZOlgCiR2jIhUuH',
        productName: 'PAKET ISI 5 PCS INDOMIE GORENG',
      },
    ],
    refId: 'xx',
    reason: '',
    status: 'PENDING',
    createdAt: { _seconds: 1779901714, _nanoseconds: 815000000 },
    updatedAt: { _seconds: 1779901714, _nanoseconds: 815000000 },
    totalValue: 3449850,
    customerOrSupplierName: 'shopee',
  },
};

/** Sama seperti di produksi: item TIDAK punya productId (warisan marketplace). */
const BARIS_2 = {
  id: 'RPXnLANvLxOaNvfJq7tj',
  created_at: '2026-07-09T18:12:23.403+00:00',
  raw_data: {
    type: 'SALES_RETURN',
    items: [{ price: 122000, quantity: 35, productId: '', productName: 'SEDAAP GORENG (40)' }],
    refId: 'vwSScjIo5XV9c9gntOzs',
    reason: 'cencel',
    status: 'PENDING',
    totalValue: 4270000,
    customerOrSupplierName: 'Customer TIKTOK',
  },
};

/** Jalankan baris melalui pipeline yang sama seperti Server Action. */
function lewat(baris: Record<string, any>): Retur {
  return keRetur(toPlainRow(normalizeRow(baris, 'returns')));
}

describe('keRetur — baris nyata dari Supabase', () => {
  it('membaca retur penjualan dan menghitung total dari item', () => {
    const retur = lewat(BARIS_1);

    expect(retur.id).toBe('Wci7VQhYz51L8nlxMgli');
    expect(retur.jenis).toBe('SALES_RETURN');
    expect(retur.status).toBe('PENDING');
    expect(retur.pihak).toBe('shopee');
    expect(retur.items).toHaveLength(1);
    expect(retur.totalNilai).toBe(22999 * 150);
    expect(retur.dibuatPada).toBe('2026-05-27T17:08:34.815Z');
  });

  it('tetap aman untuk item tanpa productId (dan melaporkannya)', () => {
    const retur = lewat(BARIS_2);

    expect(retur.totalNilai).toBe(122000 * 35);
    expect(itemTanpaProduk(retur.items)).toHaveLength(1);
    expect(retur.pihak).toBe('Customer TIKTOK');
  });

  it('menerima tanggal gaya Firestore maupun ISO', () => {
    const gayaFirestore = keRetur({
      id: 'x',
      createdAt: { _seconds: 1779901714, _nanoseconds: 815000000 },
    });
    expect(gayaFirestore.dibuatPada).toBe(new Date(1779901714 * 1000 + 815).toISOString());

    const gayaIso = keRetur({ id: 'y', createdAt: '2026-07-09T18:12:23.403Z' });
    expect(gayaIso.dibuatPada).toBe('2026-07-09T18:12:23.403Z');
  });
});

describe('tanggalKeIso', () => {
  it('menangani ISO, Date, epoch detik, dan objek Firestore', () => {
    expect(tanggalKeIso('2026-01-02T03:04:05.000Z')).toBe('2026-01-02T03:04:05.000Z');
    expect(tanggalKeIso(new Date('2026-01-02T03:04:05.000Z'))).toBe('2026-01-02T03:04:05.000Z');
    expect(tanggalKeIso(1767323045)).toBe(new Date(1767323045 * 1000).toISOString());
    expect(tanggalKeIso({ seconds: 1767323045, nanoseconds: 0 })).toBe(
      new Date(1767323045 * 1000).toISOString()
    );
  });

  it('mengembalikan null untuk nilai kosong / tidak masuk akal', () => {
    expect(tanggalKeIso(null)).toBeNull();
    expect(tanggalKeIso('')).toBeNull();
    expect(tanggalKeIso('bukan tanggal')).toBeNull();
    expect(tanggalKeIso({})).toBeNull();
  });
});

describe('normalisasi item & total', () => {
  it('membuang qty nol/negatif dan menjaga harga', () => {
    expect(normalisasiItem({ productName: 'A', quantity: 0, price: 100 })).toBeNull();
    expect(normalisasiItem({ productName: 'A', quantity: -2, price: 100 })).toBeNull();
    expect(normalisasiItem({ productName: 'A', quantity: 2, price: 100 })).toEqual({
      productId: '',
      productName: 'A',
      quantity: 2,
      price: 100,
    });
  });

  it('menerima alias qty dan name', () => {
    expect(normalisasiItems([{ name: 'B', qty: 3, price: 500 }])).toEqual([
      { productId: '', productName: 'B', quantity: 3, price: 500 },
    ]);
  });

  it('menghitung total dari item', () => {
    expect(
      totalDariItems([
        { productId: 'p', productName: 'A', quantity: 2, price: 1000 },
        { productId: 'q', productName: 'B', quantity: 3, price: 250 },
      ])
    ).toBe(2750);
  });
});

describe('akunJurnalRetur', () => {
  it('retur penjualan: debit Sales, kredit kas/dompet', () => {
    expect(akunJurnalRetur('SALES_RETURN', 'TUNAI')).toEqual({ debit: 'Sales', kredit: 'Cash' });
    expect(akunJurnalRetur('SALES_RETURN', 'DOMPET')).toEqual({
      debit: 'Sales',
      kredit: 'CustomerWallet',
    });
  });

  it('retur pembelian: mengurangi persediaan', () => {
    expect(akunJurnalRetur('PURCHASE_RETURN', 'TUNAI')).toEqual({
      debit: 'Cash',
      kredit: 'Inventory',
    });
    expect(akunJurnalRetur('PURCHASE_RETURN', 'POTONG_HUTANG')).toEqual({
      debit: 'AccountsPayable',
      kredit: 'Inventory',
    });
  });

  it('tanpa perpindahan uang -> tidak ada jurnal (jangan mengarang)', () => {
    expect(akunJurnalRetur('SALES_RETURN', 'TIDAK_DIRINCIKAN')).toBeNull();
    expect(akunJurnalRetur('PURCHASE_RETURN', 'TIDAK_DIRINCIKAN')).toBeNull();
  });
});

describe('ringkasRetur', () => {
  it('memisahkan hitungan dan nilai per status', () => {
    const menunggu = { ...lewat(BARIS_1), status: 'PENDING' as const };
    const disetujui = { ...lewat(BARIS_2), status: 'APPROVED' as const };
    const ditolak = { ...lewat(BARIS_1), id: 'z', status: 'REJECTED' as const };

    const ringkasan = ringkasRetur([menunggu, disetujui, ditolak]);

    expect(ringkasan.jumlah).toBe(3);
    expect(ringkasan.menunggu).toBe(1);
    expect(ringkasan.disetujui).toBe(1);
    expect(ringkasan.ditolak).toBe(1);
    expect(ringkasan.nilaiMenunggu).toBe(3449850);
    expect(ringkasan.nilaiDisetujui).toBe(4270000);
    // Hanya retur menunggu yang itemnya dihitung untuk peringatan.
    expect(ringkasan.itemTanpaProduk).toBe(0);
  });

  it('menghitung item menunggu yang tidak punya ID produk', () => {
    expect(ringkasRetur([lewat(BARIS_2)]).itemTanpaProduk).toBe(1);
  });
});

describe('saringRetur', () => {
  const daftar = [lewat(BARIS_1), lewat(BARIS_2)];

  it('menyaring menurut status dan jenis', () => {
    expect(saringRetur(daftar, { status: 'PENDING' })).toHaveLength(2);
    expect(saringRetur(daftar, { status: 'APPROVED' })).toHaveLength(0);
    expect(saringRetur(daftar, { jenis: 'PURCHASE_RETURN' })).toHaveLength(0);
  });

  it('mencari di referensi, pihak, dan nama produk', () => {
    expect(saringRetur(daftar, { kata: 'shopee' })).toHaveLength(1);
    expect(saringRetur(daftar, { kata: 'sedaap' })).toHaveLength(1);
    expect(saringRetur(daftar, { kata: 'indomie' })).toHaveLength(1);
    expect(saringRetur(daftar, { kata: 'tidak-ada' })).toHaveLength(0);
  });
});

describe('validasiReturBaru', () => {
  const dasar = {
    jenis: 'SALES_RETURN' as const,
    refId: 'ORD-1',
    pihak: 'Budi',
    alasan: '',
    items: [{ productId: 'p1', productName: 'A', quantity: 1, price: 1000 }],
  };

  it('lolos untuk data lengkap', () => {
    expect(validasiReturBaru(dasar)).toBeNull();
  });

  it('menolak referensi, pihak, dan item yang kosong', () => {
    expect(validasiReturBaru({ ...dasar, refId: '  ' })).toMatch(/referensi/i);
    expect(validasiReturBaru({ ...dasar, pihak: '' })).toMatch(/pelanggan/i);
    expect(validasiReturBaru({ ...dasar, items: [] })).toMatch(/produk/i);
  });

  it('menolak harga yang belum terbaca (mencegah jurnal Rp0)', () => {
    expect(
      validasiReturBaru({ ...dasar, items: [{ productId: 'p', productName: 'A', quantity: 1, price: 0 }] })
    ).toMatch(/harga/i);
  });
});

describe('format tampilan', () => {
  it('format rupiah memakai pemisah ribuan Indonesia', () => {
    expect(formatRupiah(3449850)).toBe('Rp 3.449.850');
    expect(formatRupiah(0)).toBe('Rp 0');
  });

  it('format tanggal memakai zona waktu toko dan aman untuk nilai kosong', () => {
    expect(formatTanggalRetur('2026-05-27T17:08:34.815Z')).toContain('2026');
    expect(formatTanggalRetur(null)).toBe('—');
    expect(formatTanggalRetur('bukan tanggal')).toBe('—');
  });
});
