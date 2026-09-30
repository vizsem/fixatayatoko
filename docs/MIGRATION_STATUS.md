# Status Migrasi Firebase → Supabase

> Terakhir diverifikasi: 2026-10-01
> Verifikasi ulang dengan: `npm run verify:schema`

## Ringkasan

Aplikasi ini **sudah menggunakan Supabase Postgres sebagai data layer**, tetapi sebagian
besar kode masih memanggilnya melalui *compatibility bridge* yang meniru API Firestore.
Paket `firebase` **sudah tidak terpasang** — bridge murni menerjemahkan panggilan ke Supabase.

```
┌──────────────────────────┐
│  src/app/**  (96 file)   │  ← 76 client component + 20 server module
└────────────┬─────────────┘
             │ import { collection, getDocs, ... } from '@/lib/firebase'
             ▼
┌──────────────────────────┐
│  src/lib/firebase.ts     │  Compatibility bridge (Firestore API → PostgREST)
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  src/lib/supabase.ts     │  supabase (publishable) + supabaseAdmin (secret)
└────────────┬─────────────┘
             ▼
      Supabase Postgres
```

## Angka Saat Ini

| Metrik | Jumlah |
|---|---|
| File mengimpor `@/lib/firebase` (bridge) | **96** |
| — sebagai client component (`"use client"`) | 76 |
| — sebagai server module | 20 |
| File mengimpor `@supabase/*` langsung | 2 (`lib/supabase.ts`, `types/supabase.d.ts`) |
| File mengimpor Prisma | 1 (`lib/prisma.ts`) |
| Feature code yang memakai Supabase langsung | **0** |
| Paket `firebase` di `package.json` | tidak ada |

Artinya: **tidak ada satu pun fitur yang berbicara ke Supabase secara native.** Semuanya
lewat bridge. Ini titik utama utang teknis migrasi.

## ⚠️ Risiko Utama: Batas Client/Server

`src/lib/firebase.ts` membuat client dengan **service role key** untuk melewati RLS:

```ts
import { supabase, supabaseAdmin } from '@/lib/supabase';
const db_client = supabaseAdmin;
```

Masalahnya, file ini diimpor oleh **76 client component**.

1. Modul bridge ikut ter-bundle ke JavaScript browser.
2. Di browser, `SUPABASE_SERVICE_ROLE_KEY` tidak tersedia (tanpa prefix `NEXT_PUBLIC_`),
   sehingga klien admin tidak mungkin terbentuk.
3. Query dari client berjalan sebagai `anon` → **RLS aktif** → berpotensi ditolak
   atau mengembalikan data kosong tanpa pesan error yang jelas.

**Sudah diperbaiki sebagian (2026-10-01):** `src/lib/firebase.ts` sekarang memilih klien
secara eksplisit — `supabaseAdmin` di server, `supabase` di browser — dan
`src/lib/supabase.ts` memperingatkan bila `SUPABASE_SERVICE_ROLE_KEY` tidak di-set di server.
Perilaku runtime tidak berubah (sebelumnya pun fallback ke publishable key), tetapi sekarang
niatnya jelas dan salah konfigurasi tidak lagi senyap.

**Belum diperbaiki:** 76 client component masih mengimpor bridge untuk operasi data.
Sampai dipindahkan ke Server Action / Route Handler, RLS adalah satu-satunya pengaman.

## ⚠️ Konvensi RLS & Temuan

Seluruh migrasi memakai pola yang sama:

```sql
USING (auth.jwt()->>'role' IN ('admin', 'cashier'))
```

**Penting:** klaim `role` pada JWT bawaan Supabase bernilai `anon` atau `authenticated` —
bukan peran bisnis. Agar policy di atas berfungsi, harus ada **Auth Hook kustom** di
Supabase Dashboard yang menyuntikkan `users.role` ke dalam JWT. Ini tidak terlihat dari
kode, jadi **wajib diverifikasi manual** di Dashboard → Authentication → Hooks.

Tanpa hook tersebut, seluruh policy berbasis peran akan selalu gagal.

### Temuan: `product_cost_logs` RLS tidak aktif

Diverifikasi lewat REST API: tabel ini **dapat dibaca memakai publishable key**, padahal
policy-nya membatasi ke `admin`/`owner`/`superadmin`. Kesimpulannya tabel ini dibuat manual
di luar migrasi dan **`ENABLE ROW LEVEL SECURITY` belum pernah dijalankan**. Perlu dicek di
Dashboard → Table Editor → RLS.

## Rencana Migrasi Bertahap

### Fase 1 — Amankan batas client/server (prioritas tertinggi)
- [x] Pilih klien Supabase secara eksplisit berdasarkan lingkungan di `src/lib/firebase.ts`.
- [x] Peringatan saat `SUPABASE_SERVICE_ROLE_KEY` tidak di-set di server.
- [ ] Verifikasi Auth Hook yang menyuntikkan `users.role` ke klaim `role` JWT.
- [ ] Audit 76 client component: pindahkan operasi data ke Server Action / Route Handler.
- [ ] Pastikan `SUPABASE_SERVICE_ROLE_KEY` hanya hidup di jalur server.

### Fase 2 — Standarkan akses data
- [ ] Pilih satu arah: Supabase native (`.from().select()`) **atau** Prisma untuk ERP.
      Saat ini `prisma/schema.prisma` (model `User`, `Cart`, `Promotion`, dll.) hanya
      dipakai oleh 1 file, sementara bridge dan PostgREST jalan sendiri-sendiri.
- [ ] Buat helper query bersama + tipe hasil dari `src/types/supabase.d.ts`.

### Fase 3 — Migrasi per domain
Urutan yang disarankan (dari risiko rendah ke tinggi):
1. `products`, `categories`, `settings` — read-heavy, sedikit mutasi.
2. `orders`, `purchases`, `inventory` — butuh transaksi/atomicity, migrasi bersama test.
3. `users`, `auth`, `vouchers`, `wallet` — sensitif, terakhir.
- [ ] Setiap domain: ganti bridge → Supabase native, hapus import `@/lib/firebase`.
- [ ] Jaga `src/lib/*.test.ts` tetap hijau (saat ini 17 file / 86 test lulus).

### Fase 4 — Bersihkan
- [ ] Hapus `src/lib/firebase.ts` setelah 0 importer.
- [ ] Hapus variabel `NEXT_PUBLIC_FIREBASE_*` dan `GCP_SERVICE_ACCOUNT_KEY` dari env.
- [ ] Hapus `firestore.rules`, `firestore.indexes.json`, `firebase.json` bila tak terpakai.
- [ ] Hapus script migrasi satu kali di `scripts/` dan `scripts/*firebase*`.

## Catatan Skema

`supabase/migrations/` berisi 4 file yang mendefinisikan **32 tabel**.
Kondisi remote saat verifikasi terakhir: **26 ada, 6 belum di-apply**.

Tabel yang belum ada (semuanya dari `20260930_missing_tables.sql`):

| Tabel | Dipakai oleh |
|---|---|
| `marketplace_orders` | halaman admin marketplace-orders |
| `bri_webhook_logs` | webhook pembayaran BRI |
| `warehouseStock` | stok per gudang |
| `activity_logs` | log aktivitas admin |
| `operational_expenses_proofs` | bukti pengeluaran operasional |
| `stockValidationLogs` | log validasi stok |

**Cara apply:**
```bash
# Opsi A - SQL Editor (tercepat)
# Supabase Dashboard > SQL Editor > tempel isi file > Run

# Opsi B - Supabase CLI
supabase link --project-ref <project-ref>
supabase db push
```

> File `20260930_missing_tables.sql` kini **idempoten** (`CREATE TABLE/INDEX IF NOT EXISTS`
> dan `DROP POLICY IF EXISTS` sebelum tiap `CREATE POLICY`), sehingga aman dijalankan ulang
> bila eksekusi pertama terputus di tengah jalan.

**Cara verifikasi:**
```bash
npm run verify:schema          # ringkas
npm run verify:schema:verbose  # tampilkan jumlah baris per tabel
```

> Catatan: verifikasi di atas memakai REST API. Agar akurat, gunakan
> `SUPABASE_SERVICE_ROLE_KEY` di `.env.local`. Dengan publishable key, tabel yang
> dilindungi RLS akan tampak kosong.

## Kualitas Kode

### React Compiler tidak aktif
`next.config.ts` tidak menyetel `reactCompiler`, paket `babel-plugin-react-compiler`
tidak terpasang, dan tidak ada directive `"use memo"`. Karena itu aturan
`react-hooks/purity`, `react-hooks/static-components`, dan
`react-hooks/preserve-manual-memoization` bersifat **advisory** — tidak memengaruhi build.

Meski demikian, per 2026-10-01 seluruh pelanggarannya sudah diperbaiki (bukan di-*disable*):

| Perbaikan | File |
|---|---|
| Fungsi impure dipindah ke module scope (`msUntilExpiry`) | `admin/inventory/page.tsx` |
| `ProfitBadge` dipindah keluar dari render | `admin/products/edit/[id]/page.tsx` |
| `isoDateInDays()` untuk `priceValidUntil` JSON-LD | `produk/[id]/page.tsx` |
| `validateCart()` diekstrak agar memo bisa dipertahankan | `cart/page.tsx` |
| Generator ID terpusat di `src/lib/ids.ts` | `cashier`, `vouchers`, `admin/marketplace-orders` |

`src/lib/ids.ts` sengaja dibuat agar `Date.now()` / `Math.random()` tidak lagi dipanggil
di dalam render — mencegah hydration mismatch dan membuat format ID konsisten.

### Status lint
| | Sebelum | Sesudah |
|---|---|---|
| Error | 117 | **0** |
| Warning | 1223 | 602 |

Turunnya angka ini sebagian besar karena `.kilo/` (nested git worktree berisi salinan
repo) sudah dikeluarkan dari proses lint.
