#!/usr/bin/env node
/**
 * Tutup selisih antara Purchase Order dan buku besar modal (CLI).
 *
 * Ini pasangan terminal dari halaman `/admin/capital/rekonsiliasi`. Keduanya
 * memakai ATURAN YANG SAMA dari `src/lib/capital-reconcile.ts` (Node menjalankan
 * berkas `.ts` itu langsung, jadi tidak ada logika yang disalin).
 *
 * Pemakaian
 *   node scripts/reconcile-capital-po.mjs                       # lihat saja (dry run)
 *   node scripts/reconcile-capital-po.mjs --since=2026-09-20    # batasi tanggal PO
 *   node scripts/reconcile-capital-po.mjs --apply --confirm     # TULIS perubahan
 *   node scripts/reconcile-capital-po.mjs --apply --confirm --since=2026-09-20
 *
 * AMAN SECARA DEFAULT: tanpa `--apply` + `--confirm`, skrip ini hanya membaca.
 *
 * PERINGATAN: menjalankan `--apply` MENULIS ke tabel `capital_transactions`.
 * Jangan terapkan pada PO yang selisihnya sudah pernah ditutup lewat tombol
 * "Penyesuaian Modal Total" di halaman Modal — nanti terhitung dua kali.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  bandingkanPO,
  petakanMutasiMentah,
  petakanPOUntukRekonsiliasi,
  ringkasMutasiPerPO,
  ringkasRekonsiliasi,
} from '../src/lib/capital-reconcile.ts';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function muatEnv() {
  const env = {};
  try {
    const teks = readFileSync(path.join(AKAR, '.env.local'), 'utf8');
    for (const baris of teks.split('\n')) {
      const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    /* .env.local opsional bila env sudah ada di proses */
  }
  return { ...env, ...process.env };
}

const env = muatEnv();
const URL_SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const KUNCI = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;

if (!URL_SUPABASE || !KUNCI) {
  console.error('URL/Service key Supabase tidak ditemukan. Isi .env.local dulu.');
  process.exit(1);
}

const args = process.argv.slice(2);
const argNilai = (nama) => {
  const ketemu = args.find((a) => a.startsWith(`--${nama}=`));
  return ketemu ? ketemu.slice(nama.length + 3) : undefined;
};
const TERAPKAN = args.includes('--apply');
const KONFIRMASI = args.includes('--confirm');
const SEJAK = argNilai('since');

const rupiah = (nilai) => `Rp ${Math.round(Number(nilai) || 0).toLocaleString('id-ID')}`;

async function ambilSemua(tabel) {
  const halaman = 1000;
  const hasil = [];
  for (let offset = 0; ; offset += halaman) {
    const res = await fetch(
      `${URL_SUPABASE}/rest/v1/${tabel}?select=*&order=created_at.asc&limit=${halaman}&offset=${offset}`,
      { headers: { apikey: KUNCI, Authorization: `Bearer ${KUNCI}` } }
    );
    const baris = await res.json();
    if (!Array.isArray(baris)) {
      throw new Error(`${tabel}: HTTP ${res.status} -> ${JSON.stringify(baris).slice(0, 200)}`);
    }
    hasil.push(...baris);
    if (baris.length < halaman) break;
  }
  return hasil;
}

async function tulisPenyesuaian(baris) {
  const now = new Date().toISOString();
  const jenis = baris.selisih > 0 ? 'WITHDRAWAL' : 'INJECTION';
  const payload = {
    id: `cap_${baris.poId}_${Date.now()}`.slice(0, 64),
    created_at: now,
    updated_at: now,
    raw_data: {
      date: now,
      type: jenis,
      amount: Math.abs(baris.selisih),
      description: `Penyesuaian Selisih Modal PO ${baris.poNumber}`,
      recordedBy: 'system',
      referenceId: baris.poId,
      source: 'PURCHASE_ORDER',
    },
  };

  const res = await fetch(`${URL_SUPABASE}/rest/v1/capital_transactions`, {
    method: 'POST',
    headers: {
      apikey: KUNCI,
      Authorization: `Bearer ${KUNCI}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
  }
  return jenis;
}

async function main() {
  console.log('Membaca Purchase Order dan buku besar modal dari Supabase…\n');

  const [purchaseRows, modalRows] = await Promise.all([
    ambilSemua('purchases'),
    ambilSemua('capital_transactions'),
  ]);

  const semua = bandingkanPO(
    purchaseRows.map(petakanPOUntukRekonsiliasi),
    ringkasMutasiPerPO(petakanMutasiMentah(modalRows))
  );

  const baris = SEJAK ? semua.filter((b) => String(b.createdAt) >= SEJAK) : semua;
  const ringkasan = ringkasRekonsiliasi(baris);

  console.log(`purchases: ${purchaseRows.length} | capital_transactions: ${modalRows.length}`);
  if (SEJAK) console.log(`difilter: PO dengan tanggal >= ${SEJAK}`);
  console.log(
    `PO berselisih: ${ringkasan.jumlah} (${ringkasan.jumlahKurangPotong} belum dipotong ${rupiah(
      ringkasan.kurangPotong
    )}, ${ringkasan.jumlahLebihPotong} kelebihan potong ${rupiah(ringkasan.lebihPotong)})\n`
  );

  if (baris.length === 0) {
    console.log('Tidak ada selisih. Buku besar modal sudah cocok dengan semua PO.');
    return;
  }

  for (const b of baris) {
    const tanda = b.selisih > 0 ? '+' : '-';
    console.log(
      `${String(b.createdAt).slice(0, 10)} | ${b.poNumber.padEnd(22)} | ${b.paymentMethod.padEnd(
        8
      )} | seharusnya ${rupiah(b.diharapkan).padStart(16)} | tercatat ${rupiah(b.tercatat).padStart(
        16
      )} | selisih ${tanda}${rupiah(Math.abs(b.selisih))} | ${b.supplierName}`
    );
  }

  if (!TERAPKAN) {
    console.log('\nDRY RUN — tidak ada yang ditulis.');
    console.log('Untuk menerapkan: tambahkan --apply --confirm (opsional --since=YYYY-MM-DD).');
    return;
  }

  if (!KONFIRMASI) {
    console.error('\nDITOLAK: --apply wajib disertai --confirm.');
    console.error('Contoh: node scripts/reconcile-capital-po.mjs --apply --confirm --since=2026-09-20');
    process.exit(1);
  }

  console.log(`\nMenulis ${baris.length} penyesuaian ke capital_transactions…`);
  let berhasil = 0;
  const gagal = [];

  for (const b of baris) {
    try {
      const jenis = await tulisPenyesuaian(b);
      berhasil += 1;
      console.log(`  OK   ${b.poNumber} -> ${jenis} ${rupiah(Math.abs(b.selisih))}`);
    } catch (e) {
      gagal.push(`${b.poNumber}: ${e.message}`);
      console.error(`  GAGAL ${b.poNumber}: ${e.message}`);
    }
  }

  console.log(`\nSelesai: ${berhasil} berhasil, ${gagal.length} gagal.`);
  console.log('Buka /admin/capital untuk melihat saldo barunya.');
  if (gagal.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('Gagal menjalankan rekonsiliasi:', e?.message || e);
  process.exit(1);
});
