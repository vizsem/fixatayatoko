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

> **Ini kini risiko aktif.** Sejak migrasi di-apply, RLS benar-benar menyala di 7 tabel
> baru. Akibatnya: operasi lewat `supabaseAdmin` (service role) tetap jalan karena
> mem-bypass RLS, tetapi operasi dari **client component** (publishable key, berperan
> `anon`) langsung ditolak HTTP 401. Untuk user yang login, klaim `role` berisi
> `authenticated` — yang juga **tidak cocok** dengan daftar peran bisnis di policy.
>
> Karena itu, verifikasi Auth Hook ini adalah prioritas berikutnya sebelum halaman
> admin yang membaca tabel baru tersebut dipakai.

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
- [x] Definisi tabel & kolom dipusatkan di `src/lib/db-schema.ts` (satu sumber kebenaran).
- [ ] Buat helper query bersama + tipe hasil dari `src/types/supabase.d.ts`.

### Fase 3 — Migrasi per domain
Urutan yang disarankan (dari risiko rendah ke tinggi):
1. `products`, `categories`, `settings` — read-heavy, sedikit mutasi.
2. `orders`, `purchases`, `inventory` — butuh transaksi/atomicity, migrasi bersama test.
3. `users`, `auth`, `vouchers`, `wallet` — sensitif, terakhir.
- [ ] Setiap domain: ganti bridge → Supabase native, hapus import `@/lib/firebase`.
- [ ] Jaga `src/lib/*.test.ts` tetap hijau (saat ini 18 file / 109 test lulus).

### Fase 4 — Bersihkan
- [ ] Hapus `src/lib/firebase.ts` setelah 0 importer.
- [ ] Hapus variabel `NEXT_PUBLIC_FIREBASE_*` dan `GCP_SERVICE_ACCOUNT_KEY` dari env.
- [ ] Hapus `firestore.rules`, `firestore.indexes.json`, `firebase.json` bila tak terpakai.
- [ ] Hapus script migrasi satu kali di `scripts/` dan `scripts/*firebase*`.

## Catatan Skema

`supabase/migrations/` berisi 4 file yang mendefinisikan **32 tabel**.
Kondisi remote saat verifikasi terakhir (**2026-10-01**): **32 ada, 0 belum — LENGKAP.** ✅

`20260930_missing_tables.sql` sudah di-apply. Ketujuh tabelnya kini ada:

| Tabel | Dipakai oleh |
|---|---|
| `marketplace_orders` | halaman admin marketplace-orders |
| `bri_webhook_logs` | webhook pembayaran BRI |
| `warehouseStock` | stok per gudang |
| `activity_logs` | log aktivitas admin |
| `operational_expenses_proofs` | bukti pengeluaran operasional |
| `stockValidationLogs` | log validasi stok |
| `product_cost_logs` | riwayat perubahan HPP (sudah ada sebelumnya, kini dilengkapi kolom asli) |

**Hasil verifikasi pasca-apply:**

- Seluruh kolom pada 7 tabel tersebut ada ✅
- Backfill berhasil: **36 baris** `product_cost_logs` yang datanya sebelumnya terkubur
  di `raw_data` kini punya kolom `productId`, `oldCost`, `newCost`, `changeDate`,
  `adminEmail`, `notes` yang terisi ✅
- **RLS aktif**: `anon` kini menerima **HTTP 401** untuk `product_cost_logs`,
  `warehouseStock`, dan `activity_logs` — lubang keamanan sebelumnya (anon bisa
  membaca `product_cost_logs`) sudah tertutup ✅

**Cara apply ulang (bila suatu saat diperlukan):**
```bash
# Opsi A - SQL Editor (tercepat)
# Supabase Dashboard > SQL Editor > tempel isi file > Run

# Opsi B - Supabase CLI
supabase link --project-ref cnxuzqlcmosymcwcraoa
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

### Kasus `product_cost_logs` (bentuk ganda)

Tabel ini **sudah ada** di remote dengan bentuk minimal — hanya `id` + `raw_data`
(JSONB), sisa ekspor Firestore. Karena `CREATE TABLE IF NOT EXISTS` dilewati untuk
tabel yang sudah ada, perintah `CREATE INDEX ... ("productId", "changeDate")`
berikutnya gagal dengan:

```
ERROR: 42703: column "productId" does not exist
```

Akibatnya seluruh migrasi batal. Penyebab ini sudah direproduksi dan diperbaiki pada
2026-10-01 — migrasi kini menambahkan kolom yang hilang via `ADD COLUMN IF NOT EXISTS`,
lalu **memulihkan data lama dari `raw_data`**.

Saat ini ada **dua jalur penulisan** ke tabel yang sama, dan keduanya harus jalan:

| Jalur | Bentuk data | Contoh |
|---|---|---|
| Bridge `addDoc()` | `{ id, raw_data: {...}, created_at }` | `pricing-hpp/page.tsx` |
| `supabaseAdmin.from(...).insert()` | kolom asli camelCase | `product.actions.ts` (3 tempat) |

Migrasi menyatukan keduanya: kolom asli dibuat, dan baris lama di-*backfill* dari
`raw_data`. Backfill hanya menyentuh baris legacy (`"productId" IS NULL`) sehingga
aman diulang.

### ✅ Divergensi konstanta skema — SUDAH DIPERBAIKI (2026-10-01)

Sebelumnya konstanta skema **diduplikasi** dan menyimpang:

| Konstanta | `firebase.ts` | `supabase-helpers.ts` |
|---|---|---|
| `TABLES_WITH_RAW_DATA` | 17 entri | 19 entri |
| `CAMEL_TO_SNAKE` | tanpa `isActive` | dengan `isActive` |
| `extractTableColumns` | tanpa `Status → is_active` | dengan |

Dampaknya nyata: `inventory_transactions` ditulis ke `raw_data` oleh `sbInsertDoc`
tetapi **tidak** oleh bridge `setDoc`, karena hanya salah satu modul yang
mendaftarkannya — sehingga sebagian baris kehilangan data.

**Perbaikan:** seluruh 7 deklarasi yang terduplikasi dipindahkan ke
`src/lib/db-schema.ts` sebagai satu sumber kebenaran; `firebase.ts` dan
`supabase-helpers.ts` kini mengimpor dari sana (−295 baris).

Nilai yang dipakai adalah gabungan yang **diverifikasi terhadap skema remote**:

| Keputusan | Alasan |
|---|---|
| `inventory_transactions` **dimasukkan** ke `TABLES_WITH_RAW_DATA` | Terbukti punya kolom `raw_data` di remote |
| `isActive` **dimasukkan** ke `CAMEL_TO_SNAKE` | Menyelaraskan kedua modul |
| `Status → is_active` **dimasukkan** ke `extractTableColumns` | Melengkapi pemetaan produk |
| `product_cost_logs` **ditambahkan** ke `TABLE_COLUMNS` + `extractTableColumns` | Agar konsisten dengan migrasi 20260930; tanpa ini baris baru dari bridge tidak muncul di halaman audit yang mengurutkan `changeDate` |

**Guard:** `src/lib/db-schema.test.ts` membaca kedua modul sebagai teks dan gagal
bila konstanta tersebut dideklarasikan ulang di tempat lain.

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
