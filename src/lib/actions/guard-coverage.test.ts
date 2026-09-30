import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * Penjaga anti-regresi untuk otorisasi Server Action.
 *
 * Dokumentasi Next.js (`01-app/02-guides/data-security.md`) menyatakan bahwa
 * Server Action adalah endpoint POST publik dan pemeriksaan di tingkat halaman
 * maupun middleware TIDAK berlaku untuknya:
 *
 *   "Always re-verify inside the action."
 *
 * Seluruh `src/lib/actions/*.actions.ts` memakai `supabaseAdmin`, yang MELEWATI
 * RLS. Tanpa pemeriksaan di dalam action, siapa pun yang tahu ID action dapat
 * membaca atau menghapus data. Uji ini memastikan setiap action baru ikut
 * diperiksa, sehingga celah yang pernah ada tidak terulang.
 */

const DIR = path.join(process.cwd(), 'src/lib/actions');

/**
 * Action yang SENGAJA dibiarkan tanpa pemeriksaan peran.
 * Setiap pengecualian wajib punya alasan yang jelas.
 */
const ALLOWED_WITHOUT_GUARD = new Map<string, string>([
  [
    'getProducts',
    'Dipakai halaman publik (useProducts, productService). Menambahkan ' +
      'pemeriksaan peran akan merusak toko. Perlu penanganan tersendiri: ' +
      'memakai klien anon dan menyaring harga modal.',
  ],
  [
    'getCategories',
    'Sama seperti getProducts: kategori dibaca halaman publik.',
  ],
]);

/** Action yang sudah memeriksa lewat argumen token, bukan cookie. */
const GUARD_PATTERNS = [
  /await\s+requireAdmin\s*\(/,
  /await\s+requireStaff\s*\(/,
  /await\s+requireIdentity\s*\(/,
  /await\s+authorize\s*\(/,
  /const\s+\w+\s*=\s*await\s+authorize\s*\(/,
  // Pemeriksaan yang diangkat ke fungsi tersendiri agar tidak diulang di
  // setiap action. `assertHrAccess` memverifikasi token + peran sekaligus
  // membatasi nama tabelnya (lihat `src/lib/actions/hr-data.actions.ts`).
  /await\s+assert\w*Access\s*\(/,
];

function actionFiles(): string[] {
  return readdirSync(DIR).filter((f) => f.endsWith('.actions.ts'));
}

function usesServiceRole(source: string): boolean {
  return /supabaseAdmin/.test(source);
}

interface ActionInfo {
  file: string;
  name: string;
  guarded: boolean;
}

function collectActions(file: string, source: string): ActionInfo[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const out: ActionInfo[] = [];

  for (const node of sf.statements) {
    if (!ts.isFunctionDeclaration(node) || !node.name || !node.body) continue;

    const mods = node.modifiers ?? [];
    const exported = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const isAsync = mods.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
    if (!exported || !isAsync) continue;

    const bodyStart = node.body.getStart(sf);
    // 400 karakter pertama badan fungsi sudah cukup untuk menangkap
    // pemeriksaan yang diletakkan di awal (konvensi proyek ini).
    const head = source.slice(bodyStart, bodyStart + 400);

    out.push({
      file,
      name: node.name.text,
      guarded: GUARD_PATTERNS.some((re) => re.test(head)),
    });
  }

  return out;
}

describe('otorisasi Server Action', () => {
  const files = actionFiles();

  it('menemukan berkas action untuk diperiksa', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it('setiap action yang memakai service role memeriksa otorisasi', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(path.join(DIR, file), 'utf8');
      if (!usesServiceRole(source)) continue;

      for (const action of collectActions(file, source)) {
        if (action.guarded) continue;
        if (ALLOWED_WITHOUT_GUARD.has(action.name)) continue;
        offenders.push(`${action.file} -> ${action.name}()`);
      }
    }

    expect(
      offenders,
      'Action berikut memakai supabaseAdmin (melewati RLS) tanpa memeriksa ' +
        'otorisasi. Tambahkan `await requireAdmin()` atau `await requireStaff()` ' +
        'di awal badan fungsi, atau daftarkan di ALLOWED_WITHOUT_GUARD beserta alasannya.'
    ).toEqual([]);
  });

  it('setiap pengecualian punya alasan yang bisa dibaca', () => {
    for (const [name, reason] of ALLOWED_WITHOUT_GUARD) {
      expect(reason.length, `alasan untuk ${name} terlalu pendek`).toBeGreaterThan(20);
    }
  });

  it('pengecualian hanya untuk action yang benar-benar ada', () => {
    const existing = new Set<string>();
    for (const file of files) {
      const source = readFileSync(path.join(DIR, file), 'utf8');
      for (const action of collectActions(file, source)) existing.add(action.name);
    }

    for (const name of ALLOWED_WITHOUT_GUARD.keys()) {
      expect(existing.has(name), `pengecualian "${name}" tidak cocok dengan action mana pun`).toBe(true);
    }
  });
});
