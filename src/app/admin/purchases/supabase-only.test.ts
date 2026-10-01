import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Penjaga migrasi Firestore → Supabase untuk modul Pembelian (PO).
 *
 * Seluruh data PO sudah hidup di Supabase Postgres. Modul ini dulu masih memakai
 * API bergaya Firestore dari `@/lib/firebase` (bridge), dan dua di antaranya
 * menimbulkan bug nyata:
 *
 *   1. `writeBatch` di halaman tambah/edit PO menulis ULANG baris `purchases`
 *      (duplikat) dan selalu gagal dengan senyap, sehingga pembelian tunai tidak
 *      pernah mengurangi saldo modal.
 *   2. `Timestamp.fromDate()` menulis objek `{ seconds, nanoseconds }` ke kolom
 *      `created_at` Supabase yang bertipe `timestamptz`.
 *
 * Sekarang modul ini hanya boleh memakai jalur Supabase: `supabaseAdmin` di
 * Server Action, `sbGetDoc`/`sbGetDocs`/`sbUpdateDoc` di klien, dan `supabase`
 * hanya untuk Realtime. Uji ini mencegah bridge itu masuk lagi.
 */

const MODUL_PEMBELIAN = path.join(process.cwd(), 'src/app/admin/purchases');

/** Bridge Firestore ada di nama modul ini. */
const TERLARANG = [
  { pola: /from '@\/lib\/firebase'/, alasan: 'impor bridge bergaya Firestore' },
  { pola: /\bwriteBatch\s*\(/, alasan: 'tulis batch gaya Firestore' },
  { pola: /\bTimestamp\.fromDate\s*\(/, alasan: 'Timestamp Firestore, bukan timestamptz' },
];

function berkasSumber(dir: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(dir)) {
    const lengkap = path.join(dir, nama);
    if (statSync(lengkap).isDirectory()) {
      hasil.push(...berkasSumber(lengkap));
    } else if (/^(?!.*\.test\.).*\.(ts|tsx)$/.test(nama)) {
      // Berkas uji dilewati: pola terlarang ditulis di dalamnya sebagai regex,
      // sehingga uji ini akan mendeteksi dirinya sendiri.
      hasil.push(lengkap);
    }
  }
  return hasil;
}

describe('modul Pembelian hanya memakai Supabase', () => {
  const berkas = berkasSumber(MODUL_PEMBELIAN);

  it('menemukan berkas modul pembelian', () => {
    expect(berkas.length).toBeGreaterThan(3);
  });

  it('tidak ada lagi sisa API bergaya Firestore', () => {
    const pelanggar: string[] = [];

    for (const file of berkas) {
      const source = readFileSync(file, 'utf8');
      for (const { pola, alasan } of TERLARANG) {
        if (pola.test(source)) {
          pelanggar.push(`${path.relative(process.cwd(), file)} -> ${alasan}`);
        }
      }
    }

    expect(
      pelanggar,
      'Modul pembelian sudah bermigrasi penuh ke Supabase. Jangan kembalikan API ' +
        'bergaya Firestore (bridge `@/lib/firebase`, `writeBatch`, `Timestamp`). ' +
        'Pakai `supabaseAdmin` di Server Action atau helper `sb*` di klien.'
    ).toEqual([]);
  });

  it('Server Action PO dan buku besar modal tidak memakai bridge', () => {
    const berkasWajib = [
      'src/lib/actions/purchase.actions.ts',
      'src/lib/capital-ledger.ts',
    ];
    const pelanggar = berkasWajib.filter((rel) =>
      /from '@\/lib\/firebase'/.test(readFileSync(path.join(process.cwd(), rel), 'utf8'))
    );
    expect(pelanggar).toEqual([]);
  });
});
