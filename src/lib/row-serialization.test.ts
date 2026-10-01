import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { normalizeRow } from '@/lib/supabase-helpers';
import { toFilterValue, toPlainData, toPlainRow, toPlainRows } from '@/lib/db-schema';

/**
 * Serialisasi Server Action.
 *
 * LATAR BELAKANG (kejadian nyata 2026-10-02)
 * -----------------------------------------
 * `normalizeRow` menempelkan `createdAt` sebagai objek bergaya Firestore yang
 * berisi FUNGSI (`toDate`, `toISOString`, ...) — bentuk itu dipakai luas oleh
 * pembaca di sisi klien sehingga tidak boleh diubah. Masalahnya, Server Action
 * mengirim nilainya lewat serializer React Server Components, dan serializer
 * itu MENOLAK fungsi.
 *
 * Akibatnya server melempar, respons berisi error, dan peramban hanya melihat
 * "An error occurred in the Server Components render..." (React #441) tanpa
 * keterangan. Halaman `/admin/settings` tampak TIDAK BISA DIBUKA, spinner
 * berputar selamanya, dan tidak ada satu pun petunjuk di layar.
 *
 * Uji ini mengunci dua hal: (1) alat pembersihnya benar, dan (2) setiap action
 * yang mengembalikan baris database benar-benar memakainya.
 */

/** Cari nilai yang tidak bisa menyeberangi batas Server Action. */
function fungsiTersisa(value: unknown, jalur = 'akar'): string[] {
  if (typeof value === 'function') return [jalur];
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => fungsiTersisa(item, `${jalur}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => fungsiTersisa(v, `${jalur}.${k}`));
  }
  return [];
}

/** Bentuk `createdAt` persis seperti yang dibuat `normalizeRow`. */
function timestampGayaFirestore() {
  const date = new Date('2026-10-02T03:00:00.000Z');
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => date,
    toISOString: () => date.toISOString(),
    toString: () => date.toISOString(),
    toLocaleString: () => '2/10/2026, 10.00.00',
  };
}

describe('toPlainData', () => {
  it('mengubah objek ber-toISOString (Timestamp) menjadi string ISO', () => {
    const hasil = toPlainData({ createdAt: timestampGayaFirestore() }) as Record<string, unknown>;
    expect(hasil.createdAt).toBe('2026-10-02T03:00:00.000Z');
  });

  it('membuang fungsi di mana pun', () => {
    const hasil = toPlainData({
      id: 'x',
      nested: { a: 1, fn: () => 1 },
      arr: [1, { fn: () => 2 }, 'teks'],
    });

    expect(fungsiTersisa(hasil)).toEqual([]);
    expect(hasil).toEqual({ id: 'x', nested: { a: 1 }, arr: [1, {}, 'teks'] });
  });

  it('mengubah Date menjadi ISO dan BigInt menjadi string', () => {
    expect(toPlainData(new Date('2026-01-02T00:00:00.000Z'))).toBe('2026-01-02T00:00:00.000Z');
    expect(toPlainData({ n: 10n })).toEqual({ n: '10' });
  });

  it('Date tidak valid tidak membuat error', () => {
    expect(fungsiTersisa(toPlainData({ d: new Date('bukan tanggal') }))).toEqual([]);
  });

  it('nilai primitif dan null diteruskan apa adanya', () => {
    expect(toPlainData(null)).toBeNull();
    expect(toPlainData(undefined)).toBeUndefined();
    expect(toPlainData('a')).toBe('a');
    expect(toPlainData(0)).toBe(0);
    expect(toPlainData(false)).toBe(false);
  });
});

describe('toPlainRow / toPlainRows pada baris hasil normalizeRow', () => {
  const baris = normalizeRow(
    {
      id: 'ord_1',
      created_at: '2026-10-02T03:00:00.000Z',
      total: 3750000,
      raw_data: { items: [{ productId: 'p1', quantity: 15, unit: 'CTN' }] },
    },
    'orders'
  );

  it('baris mentah MEMANG tidak bisa dikirim ke klien (penyebab React #441)', () => {
    expect(fungsiTersisa(baris).length).toBeGreaterThan(0);
    // Bukti independen: `structuredClone` memakai aturan yang sama seperti
    // serializer Server Action — objek berisi FUNGSI ditolak.
    expect(() => structuredClone(baris)).toThrow();
  });

  it('setelah dibersihkan tidak ada lagi fungsi yang tersisa', () => {
    const bersih = toPlainRow(baris);
    expect(fungsiTersisa(bersih)).toEqual([]);
    expect(() => structuredClone(bersih)).not.toThrow();
    expect(bersih.createdAt).toBe('2026-10-02T03:00:00.000Z');
    expect(bersih.id).toBe('ord_1');
  });

  it('isi data tetap utuh (units, items, dan properti raw_data)', () => {
    const bersih = toPlainRow(baris) as Record<string, any>;
    expect(bersih.total).toBe(3750000);
    expect(bersih.raw_data.items[0].unit).toBe('CTN');
  });

  it('toPlainRows membersihkan setiap baris', () => {
    const bersih = toPlainRows([baris, baris]);
    expect(bersih).toHaveLength(2);
    expect(fungsiTersisa(bersih)).toEqual([]);
  });
});

describe('toFilterValue', () => {
  it('mengubah Date menjadi ISO (bukan "Fri Oct 02 2026 ...")', () => {
    const nilai = toFilterValue(new Date('2026-10-02T00:00:00.000Z'));
    expect(nilai).toBe('2026-10-02T00:00:00.000Z');
    expect(String(nilai)).not.toContain('GMT');
  });

  it('mengubah Timestamp dan daftar tanggal', () => {
    expect(toFilterValue(timestampGayaFirestore())).toBe('2026-10-02T03:00:00.000Z');
    expect(
      toFilterValue([new Date('2026-01-01T00:00:00.000Z'), new Date('2026-02-01T00:00:00.000Z')])
    ).toEqual(['2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z']);
  });

  it('nilai non-tanggal tidak diubah', () => {
    expect(toFilterValue('SELESAI')).toBe('SELESAI');
    expect(toFilterValue(10)).toBe(10);
    expect(toFilterValue(true)).toBe(true);
    expect(toFilterValue(['A', 'B'])).toEqual(['A', 'B']);
  });
});

/**
 * Penjaga anti-regresi: action yang mengembalikan `doc.data()` WAJIB
 * membersihkannya lebih dulu. Tanpa ini, halaman yang memakainya akan kembali
 * gagal terbuka tanpa pesan apa pun.
 */
describe('action yang mengembalikan baris database', () => {
  const DIR = path.join(process.cwd(), 'src/lib/actions');

  it('selalu membersihkan baris dengan toPlainRow/toPlainRows', () => {
    const berkas = readdirSync(DIR).filter((f) => f.endsWith('.actions.ts'));
    expect(berkas.length).toBeGreaterThan(5);

    const pelanggar: string[] = [];
    for (const nama of berkas) {
      const sumber = readFileSync(path.join(DIR, nama), 'utf8');
      if (!/doc\.data\(\)/.test(sumber)) continue;
      if (/toPlain(Row|Rows|Data)/.test(sumber)) continue;
      pelanggar.push(nama);
    }

    expect(
      pelanggar,
      'Action berikut mengembalikan `doc.data()` tanpa `toPlainRow()`/`toPlainRows()`. ' +
        'Baris memuat `createdAt` bergaya Firestore yang berisi FUNGSI, dan serializer ' +
        'Server Action menolaknya — peramban hanya melihat React #441 tanpa keterangan.'
    ).toEqual([]);
  });
});
