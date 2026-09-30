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

> **Risiko ini sudah dimitigasi** oleh
> `supabase/migrations/20261001_auth_hook_and_rls_hardening.sql`, yang memindahkan
> seluruh policy ke resolver `public.current_app_role()`. Lihat bagian
> [Hardening RLS](#-hardening-rls--auth-hook-2026-10-01).
>
> Catatan lama (tetap berlaku sebagai latar belakang): operasi lewat `supabaseAdmin`
> (service role) tidak terpengaruh karena mem-bypass RLS, sedangkan operasi dari client
> component bergantung pada klaim peran di JWT.

### 🔴 Temuan: RLS tidak aktif pada 7 tabel berisi data sensitif

Hasil audit REST API dengan kunci `anon` (yang **dipublikasikan ke browser**), 2026-10-01:

| Tabel | Terbaca oleh anon | Isi |
|---|---|---|
| `orders` | **154 baris** | seluruh pesanan pelanggan |
| `purchases` | **179 baris** | data pembelian |
| `stock_logs` | **45 baris** | pergerakan stok |
| `suppliers` | **27 baris** | data pemasok |
| `customers` | **5 baris** | data pelanggan |
| `wallet_logs` | **4 baris** | mutasi saldo dompet |
| `point_logs` | **2 baris** | mutasi poin |

Policy di `20240913_init.sql` untuk tabel-tabel ini bersifat **membatasi**
(`auth.jwt()->>'role' IN ('admin','cashier')`). Karena anon tetap bisa membaca seluruh
baris, artinya **`ENABLE ROW LEVEL SECURITY` belum dijalankan** pada tabel-tabel tersebut.
Kemungkinan besar tabel ini dibuat di luar migrasi (mis. oleh skrip impor Firestore).

**Sebagai pembanding,** tabel berikut memang boleh dibaca publik dan itu sesuai desain
(policy `USING (true)`): `products`, `categories`, `promotions`, `settings`, `warehouses`.

Sisi baiknya: tabel lain seperti `users`, `capital_transactions`, `ledger_entries`,
`inventory_logs`, `marketplace_*`, dan `product_cost_logs` **sudah ber-RLS** (anon = 0 baris).

**Sudah diperbaiki** oleh `supabase/migrations/20261001_auth_hook_and_rls_hardening.sql`
— lihat bagian [Hardening RLS](#-hardening-rls--auth-hook-2026-10-01) di bawah.

### Temuan: `product_cost_logs` RLS tidak aktif — ✅ SUDAH DIPERBAIKI

Dulu tabel ini **dapat dibaca memakai kunci anon** (36 baris), padahal policy-nya membatasi
ke `admin`/`owner`/`superadmin` — artinya `ENABLE ROW LEVEL SECURITY` belum pernah
dijalankan.

Sejak `20260930_missing_tables.sql` di-apply (2026-10-01), RLS menyala dan anon kini
melihat **0 baris**. Service role tetap melihat 36 baris.

## 🔐 Hardening RLS + Auth Hook (2026-10-01)

`supabase/migrations/20261001_auth_hook_and_rls_hardening.sql`

### Tiga akar masalah yang diperbaiki

1. **Klaim `role` tidak pernah berisi peran bisnis.** Supabase memakai klaim `role` untuk
   peran *Postgres* (`anon`/`authenticated`) supaya PostgREST bisa `SET ROLE`. Jadi
   `auth.jwt()->>'role' IN ('admin','cashier',...)` tidak akan pernah cocok.
2. **`= 'admin'` tidak cocok dengan siapa pun.** Peran yang benar-benar dipakai di
   `public.users` adalah `superadmin` (4), `owner`, `cashier`, `staff`, `warehouse` —
   tidak ada satu pun `admin`. Padahal `ADMIN_ROLES` di `src/lib/auth-helpers.ts` =
   `['admin','superadmin','super_admin','owner','super-admin']`.
3. **RLS mati pada 7 tabel sensitif** (lihat bagian di atas).

### Cara kerja

Policy tidak lagi membaca klaim JWT secara langsung, melainkan lewat resolver:

```sql
public.current_app_role()  -- klaim user_role bila ada, jika tidak baca public.users
```

Keuntungannya: **migration ini aman diterapkan sebelum Auth Hook didaftarkan**, tanpa
jendela waktu di mana staf tiba-tiba tidak bisa melihat data.

### Verifikasi (PostgreSQL 16, 2026-10-01)

Seluruh migrasi lama + migrasi ini diterapkan pada database bersih, lalu diuji per peran:

| Skenario | `orders` (3 baris) | Hasil |
|---|---|---|
| `anon` | 0 | ✅ lubang tertutup |
| `anon` / `products` | 1 | ✅ katalog publik tetap terbuka |
| Staf login **tanpa** klaim (fallback) | 3 | ✅ fallback bekerja |
| Pelanggan (bukan staf) | 1 | ✅ hanya pesanannya sendiri |
| Tanpa `sub` | 0 | ✅ |
| `user_role` = superadmin / cashier / warehouse | 3 | ✅ |

Idempotensi: dijalankan 3× berturut-turut → tanpa error.

Hasil akhir: **0 policy** memakai `auth.jwt()->>'role'`, **86 policy** memakai
`current_app_role()`, 11 policy berbasis `auth.uid()` dan 5 policy publik (`true`)
tidak tersentuh, dan **0 tabel** tanpa RLS.

### Cara apply

1. Jalankan file migrasinya (SQL Editor atau `supabase db push`).
2. *(Opsional, untuk performa)* Daftarkan hook di
   **Authentication → Hooks → Customize Access Token (JWT) Claims** → pilih schema
   `public`, function `custom_access_token_hook` → **Enable**.
   Tanpa langkah ini pun aplikasi tetap berfungsi, hanya ada satu query tambahan
   ke `public.users` per evaluasi policy.
3. Setelah hook aktif, minta pengguna login ulang agar JWT-nya memuat klaim baru.
4. Verifikasi dengan `npm run verify:schema` dan uji satu halaman admin dari browser.

> **Catatan:** mengaktifkan RLS di 7 tabel tersebut menutup akses `anon`, sehingga
> halaman yang membacanya **harus** diakses oleh pengguna yang sudah login. Halaman
> publik (`products`, `categories`, `promotions`, `settings`, `warehouses`) tidak
> terpengaruh.

## Rencana Migrasi Bertahap

### Fase 1 — Amankan batas client/server (prioritas tertinggi)
- [x] Pilih klien Supabase secara eksplisit berdasarkan lingkungan di `src/lib/firebase.ts`.
- [x] Peringatan saat `SUPABASE_SERVICE_ROLE_KEY` tidak di-set di server.
- [x] Resolver peran `current_app_role()` + Auth Hook — policy RLS kini benar-benar berlaku.
- [ ] Audit **69** client component yang mengakses data langsung (lihat inventaris di bawah):
      pindahkan operasi data ke Server Action / Route Handler.
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
- **RLS aktif**: `anon` kini menerima **200 dengan 0 baris** untuk `product_cost_logs`
  (sebelumnya 36 baris terbaca) — lubang keamanan sebelumnya sudah tertutup ✅
  > Catatan: bukan HTTP 401. RLS bekerja dengan *memfilter baris*, bukan menolak
> permintaan, sehingga dari sisi klien hasilnya adalah data kosong — bukan error.
> Ini penting untuk debugging: query yang ditolak RLS akan terlihat "tidak ada data".

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

## 🔴 Tabel yang Dirujuk Kode tapi TIDAK ADA di Database

Hasil audit 2026-10-01 — membandingkan semua nama tabel yang dirujuk kode dengan
kondisi Supabase remote:

> **55 tabel dirujuk · 41 ada · 14 tidak ada**

| Tabel yang tidak ada (14) | Modul |
|---|---|
| `payroll_runs`, `payroll_settings`, `payroll_adjustments` | payroll |
| `leave_requests`, `shift_templates`, `shift_assignments` | absensi & shift |
| `employee_loans`, `employee_reimbursements`, `employee_petty_cash`, `employee_petty_cash_transactions` | kasbon & reimburse |
| `kpi_scores`, `candidates` | penilaian & rekrutmen |
| `messages` | chat |
| `vouchers` | voucher |

Sebagai pembanding, tabel berikut **memang ada**: `employees`, `payroll_slips`,
`attendance_records`, `banners`, `chats`, `returns`, `notifications`, `audit_logs`.

**Dampak:** hampir seluruh modul **`admin/employees`** (yang menyentuh 17 tabel) merujuk
14 tabel yang tidak ada. Fitur HR/payroll, absensi, shift, kasbon, dan KPI **tidak bisa
berfungsi** — query-nya gagal dan ditelan oleh `try/catch`, sehingga halaman tampak
kosong tanpa pesan error.

**Implikasi untuk migrasi:** memindahkan `admin/employees` ke Server Action **tidak ada
gunanya** sampai tabel-tabelnya dibuat. Perlu keputusan produk dulu: modul ini akan
dilanjutkan (buat tabelnya) atau dibuang.

---

## Inventaris Akses Data dari Client

Hasil pemindaian 2026-10-01: **69 client component** (`"use client"`) mengimpor bridge
dan mengakses sekitar 47 tabel langsung dari browser. Tabel yang paling sering diakses:

| Tabel | File | Tabel | File |
|---|---|---|---|
| `products` | 24 | `chats` | 4 |
| `users` | 13 | `categories` | 3 |
| `orders` | 12 | `product_cost_logs` | 3 |
| `settings` | 12 | `purchases` | 3 |
| `warehouses` | 11 | `wallet_logs` | 3 |
| `operational_expenses` | 6 | `customers` | 2 |
| `inventory_logs` | 4 | `stock_logs` | 2 |
| `capital_transactions` | 3 | `point_logs` | 2 |

File dengan akses terbanyak — kandidat prioritas untuk dimigrasikan:

| File | Tabel yang disentuh |
|---|---|
| `app/admin/employees/page.tsx` | 17 tabel (payroll, absensi, shift) |
| `app/admin/settings/page.tsx` | 5 (settings, categories, employees, banners, warehouses) |
| `app/admin/audit/page.tsx` | 7 (inventory_logs, orders, cashier_shifts, dst.) |
| `app/page.tsx` | 8 (users, orders, products, notifications, dst.) |
| `app/admin/reports/operations/page.tsx` | 7 |

**Catatan penting:** setelah hardening RLS, komponen-komponen ini **tetap berfungsi** selama
pengguna login (peran dibaca lewat `current_app_role()`). Migrasi ke Server Action tetap
disarankan untuk mengurangi permukaan serangan dan agar akses `anon` tidak pernah
diperlukan — tetapi sekarang bukan lagi prasyarat agar aplikasi jalan.

### Progres: pola migrasi (percontohan)

Migrasi dilakukan **per file**, bukan borongan, dengan pola berikut:

1. Logika murni dipindah ke modul biasa agar bisa diuji (`src/lib/*.ts`).
2. Server Action ber-`'use server'` membaca dengan `supabaseAdmin` lalu memanggil logika itu.
3. Komponen klien memanggil action tersebut; import bridge dihapus.
4. Tipe hasil dipakai bersama klien + server (tidak ada duplikasi tipe).

| File | Status | Tabel yang dibebaskan dari akses klien |
|---|---|---|
| `app/admin/inventory/sync-monitor/page.tsx` | ✅ **selesai** | `products`, `warehouses`, `warehouseStock` |
| `app/admin/reports/operations/page.tsx` | ✅ **selesai** | `employees`, `users`, `warehouses`, `products`, `orders`, `operational_expenses` |

Hasilnya bukan sekadar perpindahan: payload ke browser mengecil (hanya matriks hasil,
bukan seluruh tabel mentah) dan logika perbandingannya kini punya 10 unit test
(`src/lib/stock-sync-matrix.test.ts`).

**Belum dimigrasikan: 68 file.** Dari pemindaian, **32 di antaranya read-only** (tier paling
aman); sisanya mengandung operasi tulis.

#### Dua file yang sengaja DITUNDA (butuh keputusan, bukan sekadar refactor)

| File | Alasan ditunda |
|---|---|
| `app/admin/audit/page.tsx` | 8 tab dengan agregasi **pajak & laba** (PPN/PPh, HPP, diskon). Memindahkannya terburu-buru berisiko mengubah angka keuangan. Perlu migrasi tersendiri + uji perhitungan. |
| `app/admin/audit-logs/page.tsx` | Bergantung pada `onSnapshot` (Realtime). Memindah ke Server Action berarti **menghilangkan pembaruan langsung** — itu keputusan produk, bukan sekadar pemindahan kode. |

Urutan yang disarankan (dari aman ke berisiko):

1. **Tier 1 — read-only, kecil** (32 file): `admin/audit-logs`, `semua-kategori`, `wishlist`,
   `admin/reports/*`, `admin/operational-expenses/add`, `admin/products/print-label/*`.
2. **Tier 2 — read-only, besar**: `admin/employees` (17 tabel), `admin/settings` (5 tabel).
3. **Tier 3 — ada tulis**: `admin/points`, `admin/wallet`, `admin/purchases/*`.
   Wajib hati-hati: bridge punya semantik `increment()` khusus yang harus dipertahankan.
4. **Tier 4 — agregasi finansial**: `admin/audit`, `admin/reports/finance`.
   Butuh uji perhitungan tersendiri sebelum diserahkan.

> ⚠️ **Celah yang belum ditutup:** tidak ada satu pun Server Action di `src/lib/actions/*`
> yang memeriksa peran di dalam action-nya. Saat ini mereka mengandalkan middleware
> `/admin/*` (action dipanggil via POST ke route halaman, sehingga middleware tetap jalan).
> Menutupnya butuh klien Supabase yang sadar-cookie untuk membaca sesi di server.

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
