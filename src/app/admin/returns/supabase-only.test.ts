import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Penjaga migrasi Firestore → Supabase untuk modul RETUR.
 *
 * Versi lama menulis data langsung dari peramban memakai `supabaseAdmin` yang
 * di peramban hanyalah klien ANON tanpa sesi. Akibatnya persetujuan retur
 * SELALU gagal tanpa pesan apa pun:
 *   - `addStockTx`/`deductStockTx` (`src/lib/inventory.ts` memakai service role)
 *     ditolak RLS -> stok tidak pernah berubah;
 *   - `postJournal` (`src/lib/ledger.ts` memakai klien anon) -> jurnal tidak
 *     pernah tercatat;
 *   - `runTransaction` bridge tidak atomik -> status berubah tanpa stok.
 *
 * Aturan modul ini sekarang:
 *   - halaman: HANYA Server Action (tidak menyentuh Supabase langsung);
 *   - action: Supabase lewat klien service role, tanpa bridge/ledger anon.
 */

const HALAMAN_RETUR = path.join(process.cwd(), 'src/app/admin/returns');
const ACTION_RETUR = path.join(process.cwd(), 'src/lib/actions/returns.actions.ts');

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

const TERLARANG_DI_HALAMAN = [
  { pola: /from '@\/lib\/firebase'/, alasan: 'bridge bergaya Firestore' },
  { pola: /from '@\/lib\/supabase'/, alasan: 'akses Supabase langsung dari peramban' },
  { pola: /from '@\/lib\/supabase-helpers'/, alasan: 'helper data di sisi klien' },
  { pola: /from '@\/lib\/inventory'/, alasan: 'mutasi stok harus di server' },
  { pola: /from '@\/lib\/ledger'/, alasan: 'jurnal harus memakai service role' },
  { pola: /\brunTransaction\s*\(/, alasan: 'transaksi bridge tidak atomik' },
];

const TERLARANG_DI_ACTION = [
  { pola: /from '@\/lib\/firebase'/, alasan: 'bridge bergaya Firestore' },
  { pola: /from '@\/lib\/ledger'/, alasan: 'postJournal memakai klien anon -> jurnal tidak tercatat' },
  { pola: /\bwriteBatch\s*\(/, alasan: 'tulis batch gaya Firestore' },
  { pola: /\bTimestamp\.fromDate\s*\(/, alasan: 'Timestamp Firestore, bukan timestamptz' },
];

describe('modul Retur hanya memakai Supabase', () => {
  const halaman = berkasSumber(HALAMAN_RETUR);

  it('menemukan berkas halaman retur', () => {
    expect(halaman.length).toBeGreaterThan(0);
  });

  it('halaman tidak menyentuh Supabase/bridge secara langsung', () => {
    const pelanggar: string[] = [];

    for (const file of halaman) {
      const sumber = readFileSync(file, 'utf8');
      for (const { pola, alasan } of TERLARANG_DI_HALAMAN) {
        if (pola.test(sumber)) {
          pelanggar.push(`${path.relative(process.cwd(), file)} -> ${alasan}`);
        }
      }
    }

    expect(
      pelanggar,
      'Halaman retur harus memakai Server Action dari `src/lib/actions/returns.actions.ts`. ' +
        'Akses data langsung dari peramban berjalan sebagai `anon` (tanpa sesi), sehingga RLS ' +
        'menolaknya dan kegagalannya senyap — inilah sebab retur tidak pernah berfungsi.'
    ).toEqual([]);
  });

  it('action retur tidak memakai sisa API bergaya Firestore/klien anon', () => {
    const sumber = readFileSync(ACTION_RETUR, 'utf8');
    const pelanggar = TERLARANG_DI_ACTION.filter(({ pola }) => pola.test(sumber)).map((t) => t.alasan);

    expect(pelanggar).toEqual([]);
  });

  it('action memakai klien service role untuk menulis jurnal', () => {
    const sumber = readFileSync(ACTION_RETUR, 'utf8');
    expect(sumber).toContain("from('ledger_entries')");
    expect(sumber).toMatch(/supabaseAdmin/);
  });
});
