import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TABLES_WITH_RAW_DATA,
  TABLE_COLUMNS,
  resolveQueryField,
  extractTableColumns,
  generateId,
  parseFirestoreTimestamp,
} from './db-schema';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('db-schema: resolveQueryField', () => {
  it('memetakan id dan __name__ ke kolom id', () => {
    expect(resolveQueryField('products', 'id')).toEqual({ targetField: 'id' });
    expect(resolveQueryField('products', '__name__')).toEqual({ targetField: 'id' });
  });

  it('products.isActive -> kolom is_active', () => {
    expect(resolveQueryField('products', 'isActive')).toEqual({ targetField: 'is_active' });
    expect(resolveQueryField('products', 'is_active')).toEqual({ targetField: 'is_active' });
  });

  it('users.name -> kolom full_name', () => {
    expect(resolveQueryField('users', 'name')).toEqual({ targetField: 'full_name' });
    expect(resolveQueryField('users', 'displayName')).toEqual({ targetField: 'full_name' });
  });

  it('costPrice -> kolom asli cost_price', () => {
    expect(resolveQueryField('products', 'costPrice')).toEqual({ targetField: 'cost_price' });
  });

  it('product_cost_logs.changeDate -> kolom asli camelCase, BUKAN raw_data', () => {
    // Regresi: dulu supabase-helpers memetakan ini ke `raw_data->>changeDate`
    // sementara firebase.ts ke kolom asli. Sekarang harus seragam.
    expect(resolveQueryField('product_cost_logs', 'changeDate')).toEqual({ targetField: 'changeDate' });
  });

  it('tabel ber-raw_data memakai raw_data->>field untuk field yang tak dikenal', () => {
    expect(resolveQueryField('settings', 'sesuatuYangUnik')).toEqual({
      targetField: 'raw_data->>sesuatuYangUnik',
    });
  });

  it('tabel tanpa raw_data (users) memakai field apa adanya', () => {
    expect(resolveQueryField('users', 'nickname')).toEqual({ targetField: 'nickname' });
  });
});

describe('db-schema: extractTableColumns', () => {
  it('mengembalikan objek kosong untuk data non-objek', () => {
    expect(extractTableColumns('products', null)).toEqual({});
    expect(extractTableColumns('products', 'bukan objek')).toEqual({});
  });

  it('products: mempromosikan kolom inti dan mengkonversi angka', () => {
    expect(
      extractTableColumns('products', { name: 'Beras', price: '15000', costPrice: '12000', stock: '7' })
    ).toEqual({ name: 'Beras', price: 15000, cost_price: 12000, stock: 7 });
  });

  it('products: nama kolom gaya Indonesia dipetakan', () => {
    expect(extractTableColumns('products', { Nama: 'Gula', Ecer: 10000, Modal: 8000 })).toEqual({
      name: 'Gula',
      price: 10000,
      cost_price: 8000,
    });
  });

  it('products: Status numerik -> is_active boolean', () => {
    expect(extractTableColumns('products', { Status: 1 })).toEqual({ is_active: true });
    expect(extractTableColumns('products', { Status: 0 })).toEqual({ is_active: false });
  });

  it('product_cost_logs: menulis kolom camelCase sesuai skema migrasi', () => {
    expect(
      extractTableColumns('product_cost_logs', {
        productId: 'p1',
        newCost: '98700',
        reason: 'PURCHASE_AVG_CALCULATION',
        source: 'SYSTEM',
      })
    ).toEqual({
      productId: 'p1',
      newCost: 98700,
      notes: 'PURCHASE_AVG_CALCULATION',
      source: 'SYSTEM',
    });
  });

  it('tabel tanpa cabang khusus hanya mengandalkan raw_data', () => {
    expect(extractTableColumns('warehouses', { name: 'Gudang A' })).toEqual({});
  });
});

describe('db-schema: konstanta', () => {
  it('setiap tabel di TABLE_COLUMNS mendaftarkan kolom id', () => {
    for (const [table, cols] of Object.entries(TABLE_COLUMNS)) {
      expect(cols.has('id'), `${table} harus punya kolom id`).toBe(true);
    }
  });

  it('tabel ber-raw_data mendaftarkan kolom raw_data di TABLE_COLUMNS bila tabelnya terdaftar', () => {
    for (const table of TABLES_WITH_RAW_DATA) {
      const cols = TABLE_COLUMNS[table];
      if (cols) expect(cols.has('raw_data'), `${table} harus punya kolom raw_data`).toBe(true);
    }
  });

  it('inventory_transactions & product_cost_logs terdaftar sebagai tabel ber-raw_data', () => {
    expect(TABLES_WITH_RAW_DATA.has('inventory_transactions')).toBe(true);
    expect(TABLES_WITH_RAW_DATA.has('product_cost_logs')).toBe(true);
  });

  it('users TIDAK terdaftar sebagai tabel ber-raw_data', () => {
    expect(TABLES_WITH_RAW_DATA.has('users')).toBe(false);
  });
});

describe('db-schema: helper', () => {
  it('generateId memakai 4 huruf pertama nama tabel', () => {
    expect(generateId('products')).toMatch(/^prod_\d+_[a-z0-9]+$/);
    expect(generateId('orders')).toMatch(/^orde_\d+_[a-z0-9]+$/);
  });

  it('parseFirestoreTimestamp menangani objek _seconds/_nanoseconds', () => {
    const d = parseFirestoreTimestamp({ _seconds: 1773524424, _nanoseconds: 594000000 });
    expect(d.getTime()).toBe(1773524424594);
  });

  it('parseFirestoreTimestamp menangani ISO string', () => {
    expect(parseFirestoreTimestamp('2026-03-15T00:00:00.000Z').toISOString()).toBe(
      '2026-03-15T00:00:00.000Z'
    );
  });
});

/**
 * Guard anti-duplikasi.
 *
 * Konstanta skema pernah disalin ke dua modul lalu menyimpang. Test ini membaca
 * sumbernya sebagai teks dan memastikan tidak ada modul lain yang mendeklarasikan
 * ulang. Jika seseorang menyalin lagi, test ini akan gagal.
 */
describe('anti-duplikasi: skema hanya boleh didefinisikan di db-schema.ts', () => {
  const FORBIDDEN_PATTERNS = [
    'const TABLES_WITH_RAW_DATA',
    'const TABLE_COLUMNS',
    'const CAMEL_TO_SNAKE',
    'function resolveQueryField',
    'function extractTableColumns',
    'function parseFirestoreTimestamp',
    'function generateId',
  ];

  const CONSUMERS = ['firebase.ts', 'supabase-helpers.ts'];

  for (const file of CONSUMERS) {
    it(`${file} tidak mendeklarasikan ulang konstanta skema`, () => {
      const source = readFileSync(join(HERE, file), 'utf8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(
          source.includes(pattern),
          `${file} mendeklarasikan ulang "${pattern}". Impor dari @/lib/db-schema.`
        ).toBe(false);
      }
    });
  }

  it('db-schema.ts adalah satu-satunya pemilik deklarasi tersebut', () => {
    const source = readFileSync(join(HERE, 'db-schema.ts'), 'utf8');
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(source.includes(pattern), `db-schema.ts harus mendefinisikan "${pattern}"`).toBe(true);
    }
  });
});
