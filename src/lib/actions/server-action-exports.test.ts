import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * Penjaga aturan berkas `'use server'` (Server Action).
 *
 * Next.js mensyaratkan SETIAP nilai yang diekspor dari berkas `'use server'`
 * adalah fungsi `async`. Melanggarnya TIDAK terlihat di `tsc`, tidak terlihat di
 * ESLint, dan baru muncul sebagai kegagalan BUILD produksi:
 *
 *   "Server Actions must be async functions."
 *
 * Ini pernah terjadi: `hitungSaldoModal` (fungsi murni) diekspor dari
 * `src/lib/actions/capital.actions.ts`. Seluruh test lulus, tetapi `next build`
 * gagal. Uji ini menangkapnya lebih awal — test lebih cepat daripada build.
 *
 * Cara memperbaiki bila uji ini gagal: pindahkan fungsi murni itu ke modul biasa
 * (mis. `src/lib/capital-ledger.ts`) lalu impor dari berkas action.
 */

const DIR = path.join(process.cwd(), 'src/lib/actions');

interface Pelanggaran {
  file: string;
  nama: string;
  sebab: string;
}

/**
 * Kumpulkan setiap ekspor yang BUKAN fungsi `async`.
 *
 * - `export type` / `export interface` diabaikan: tipe dihapus saat kompilasi.
 * - `export const f = async () => {}` diterima.
 * - `export const X = 5` ditolak (nilai, bukan fungsi).
 */
function eksporBermasalah(file: string, source: string): Pelanggaran[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const out: Pelanggaran[] = [];

  for (const node of sf.statements) {
    const mods = node.modifiers ?? [];
    const exported = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;

    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) continue;

    if (ts.isFunctionDeclaration(node)) {
      const isAsync = mods.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
      if (!isAsync) {
        out.push({ file, nama: node.name?.text ?? '(anonim)', sebab: 'fungsi non-async' });
      }
      continue;
    }

    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        const nama = decl.name.getText(sf);
        const init: any = decl.initializer;
        const isAsyncFn =
          init &&
          (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) &&
          (init.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
        if (!isAsyncFn) {
          out.push({ file, nama, sebab: 'nilai/konstanta, bukan fungsi async' });
        }
      }
      continue;
    }

    out.push({ file, nama: node.getText(sf).slice(0, 40), sebab: 'ekspor tidak dikenal' });
  }

  return out;
}

describe("ekspor berkas 'use server'", () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.actions.ts'));

  it('menemukan berkas action untuk diperiksa', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it('semua ekspor berupa fungsi async', () => {
    const pelanggaran: Pelanggaran[] = [];

    for (const file of files) {
      const source = readFileSync(path.join(DIR, file), 'utf8');
      if (!/^['"]use server['"]/m.test(source.slice(0, 200))) continue;
      pelanggaran.push(...eksporBermasalah(file, source));
    }

    expect(
      pelanggaran,
      "Berkas 'use server' hanya boleh mengekspor fungsi async — kalau tidak, " +
        'build produksi gagal ("Server Actions must be async functions"). ' +
        'Pindahkan fungsi murni ke modul biasa.'
    ).toEqual([]);
  });
});
