-- ============================================================================
-- 20261004_rls_staff_policies.sql
--
-- TUJUAN
-- Mengembalikan akses halaman admin yang sekarang gagal memuat data, TANPA
-- membuka data ke publik.
--
-- LATAR BELAKANG (hasil pengukuran, bukan dugaan)
-- Audit RLS pada 59 tabel yang terekspos PostgREST menunjukkan:
--   * anon          bisa baca 5 tabel : categories, products, promotions,
--                                      settings, warehouses
--   * authenticated bisa baca 6 tabel : 5 tabel di atas + users
--   * 53 tabel lain  DIBLOKIR total, termasuk untuk admin yang sudah login
--
-- Artinya: RLS memang bekerja, tetapi tidak ada satu pun policy untuk tabel
-- operasional. Karena itu halaman admin tampak kosong tanpa pesan error.
--
-- PRASYARAT YANG HARUS SELESAI DULU (sudah dikerjakan di kode)
-- `src/lib/supabase-helpers.ts` sebelumnya memakai `supabaseAdmin` dari browser.
-- Klien itu dibuat dengan `persistSession: false`, jadi ia TIDAK PERNAH mengirim
-- token pengguna dan RLS selalu melihat peran `anon`. Policy di bawah ini hanya
-- akan berlaku setelah kode memakai klien bersesi dari browser. Tanpa perbaikan
-- itu, menjalankan SQL ini tidak akan mengubah apa pun.
--
-- SIFAT PERUBAHAN
-- Hanya MENAMBAH policy dan GRANT. Tidak menghapus tabel, kolom, atau baris.
-- Blok ROLLBACK tersedia di bagian akhir.
--
-- CARA MENJALANKAN
-- Salin seluruh isi berkas ini ke Supabase SQL Editor, lalu Run.
-- Aman dijalankan berulang kali (idempoten).
-- ============================================================================


-- ============================================================================
-- BAGIAN 1 — Fungsi bantu penentu peran
--
-- PENTING: policy pada `public.users` tidak boleh membaca `public.users` secara
-- langsung, karena akan memicu rekursi RLS. Karena itu fungsi ini SECURITY
-- DEFINER dan search_path-nya dipaku.
--
-- Nilai peran yang BENAR-BENAR ada di `users.role` saat audit:
--   superadmin, owner, staff, cashier, warehouse
-- Peran ini dinormalkan agar sejalan dengan `ADMIN_ROLES` di src/lib/auth-helpers.ts
-- ('admin', 'superadmin', 'super_admin', 'owner', 'super-admin').
-- ============================================================================

create or replace function public.ataya_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select nullif(
           lower(regexp_replace(coalesce(u.role, ''), '[\s\-]+', '_', 'g')),
           ''
         )
  from public.users u
  where u.id = auth.uid()::text
  limit 1;
$$;

comment on function public.ataya_role() is
  'Peran pengguna yang sedang login, dinormalkan. SECURITY DEFINER untuk menghindari rekursi RLS pada public.users.';

create or replace function public.ataya_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
           public.ataya_role() in ('admin', 'superadmin', 'super_admin', 'owner'),
           false
         );
$$;

comment on function public.ataya_is_admin() is
  'True bila pengguna login berperan admin/owner/superadmin.';

create or replace function public.ataya_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
           public.ataya_role() in (
             'admin', 'superadmin', 'super_admin', 'owner',
             'staff', 'kasir', 'cashier', 'warehouse', 'gudang',
             'hr', 'supervisor', 'manager'
           ),
           false
         );
$$;

comment on function public.ataya_is_staff() is
  'True bila pengguna login termasuk staf atau admin. Dipakai policy tabel operasional.';

-- Hanya peran yang sudah login yang boleh memanggilnya.
-- `anon` tetap diberi hak panggil agar PostgREST tidak error; hasilnya selalu false
-- karena auth.uid() bernilai null.
revoke all on function public.ataya_role() from public;
revoke all on function public.ataya_is_admin() from public;
revoke all on function public.ataya_is_staff() from public;
grant execute on function public.ataya_role() to anon, authenticated, service_role;
grant execute on function public.ataya_is_admin() to anon, authenticated, service_role;
grant execute on function public.ataya_is_staff() to anon, authenticated, service_role;


-- ============================================================================
-- BAGIAN 2 — Tabel operasional: staf & admin boleh penuh (SELECT/INSERT/UPDATE/DELETE)
--
-- Ini data yang memang dipegang kasir/gudang/staf di lapangan.
-- ============================================================================

do $$
declare
  t text;
  staff_tables text[] := array[
    -- penjualan & pelanggan
    'orders', 'customers', 'carts', 'user_carts',
    -- persediaan & gudang
    'inventory_logs', 'inventory_transactions', 'stock_logs', 'warehouseStock',
    'stockValidations', 'stockValidationLogs', 'stockSyncLogs', 'stock_sync_logs',
    -- kasir
    'cashier_shifts', 'shift_assignments', 'shift_templates',
    -- pembelian & pengembalian
    'purchases', 'returns', 'suppliers',
    -- biaya operasional
    'operational_expenses', 'operational_expenses_proofs', 'operational_costs',
    -- pesanan marketplace
    'marketplace_orders', 'marketplace_transactions',
    -- komunikasi
    'chats', 'notifications',
    -- kehadiran & cuti (dipakai di toko)
    'attendance_records', 'leave_requests',
    -- pengaturan tampilan toko
    'store_settings'
  ];
begin
  foreach t in array staff_tables loop
    if to_regclass(format('public.%I', t)) is null then
      raise notice 'Dilewati (tabel tidak ada): %', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('drop policy if exists ataya_staff_full on public.%I', t);
    execute format($f$
      create policy ataya_staff_full on public.%I
        as permissive for all to authenticated
        using (public.ataya_is_staff())
        with check (public.ataya_is_staff())
    $f$, t);
  end loop;
end $$;


-- ============================================================================
-- BAGIAN 3 — Tabel sensitif: HANYA admin (uang, penggajian, akuntansi, HR)
--
-- Staf biasa TIDAK boleh membaca isi tabel di bawah ini.
-- ============================================================================

do $$
declare
  t text;
  admin_tables text[] := array[
    -- buku besar & modal
    'ledger_entries', 'capital_transactions', 'loans',
    -- saldo akun marketplace
    'marketplace_accounts',
    -- harga pokok pembelian (jangan sampai terlihat staf)
    'product_cost_logs',
    -- loyalitas & dompet: nilai uang, tidak boleh diubah staf
    'points', 'point_logs', 'wallet_logs', 'user_vouchers',
    -- HR & penggajian
    'employees', 'candidates', 'kpi_scores',
    'employee_loans', 'employee_petty_cash', 'employee_petty_cash_transactions',
    'employee_reimbursements',
    'payroll_settings', 'payroll_runs', 'payroll_slips', 'payroll_adjustments'
  ];
begin
  foreach t in array admin_tables loop
    if to_regclass(format('public.%I', t)) is null then
      raise notice 'Dilewati (tabel tidak ada): %', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('drop policy if exists ataya_admin_full on public.%I', t);
    execute format($f$
      create policy ataya_admin_full on public.%I
        as permissive for all to authenticated
        using (public.ataya_is_admin())
        with check (public.ataya_is_admin())
    $f$, t);
  end loop;
end $$;


-- ============================================================================
-- BAGIAN 4 — Tabel log: staf boleh MENULIS, hanya admin boleh MEMBACA
--
-- `logActivity()` dipanggil dari halaman admin oleh staf, jadi INSERT harus
-- diizinkan. Sebaliknya, log audit tidak boleh dibaca staf biasa.
-- ============================================================================

do $$
declare
  t text;
  log_tables text[] := array['activity_logs', 'audit_logs'];
begin
  foreach t in array log_tables loop
    if to_regclass(format('public.%I', t)) is null then
      raise notice 'Dilewati (tabel tidak ada): %', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert on table public.%I to authenticated', t);

    -- hapus policy lama kita, bila ada
    execute format('drop policy if exists ataya_log_insert on public.%I', t);
    execute format('drop policy if exists ataya_log_select on public.%I', t);

    execute format($f$
      create policy ataya_log_insert on public.%I
        as permissive for insert to authenticated
        with check (public.ataya_is_staff())
    $f$, t);

    execute format($f$
      create policy ataya_log_select on public.%I
        as permissive for select to authenticated
        using (public.ataya_is_admin())
    $f$, t);

    -- Cegah perubahan/penghapusan log oleh siapa pun lewat API.
    execute format('revoke update, delete on table public.%I from authenticated', t);
  end loop;
end $$;


-- ============================================================================
-- BAGIAN 5 — SENGAJA DIBIARKAN TERTUTUP (service role saja)
--
-- JANGAN tambahkan policy untuk dua tabel ini.
--
--   action_keys       -> menyimpan kunci/token aksi; membocorkannya = ambil alih sistem
--   bri_webhook_logs  -> muatan webhook bank, memuat data transaksi keuangan
--
-- Keduanya hanya diakses dari Server Action / Route Handler yang memakai
-- `supabaseAdmin` dan sudah diperiksa izinnya.
-- ============================================================================


-- ============================================================================
-- BAGIAN 6 — PERLU TINDAK LANJUT (belum ditangani di sini, sengaja)
--
-- 1. `public.users` saat ini bisa dibaca oleh SEMUA pengguna yang login.
--    Artinya pelanggan mana pun berpotensi membaca `wallet_balance`, `points`,
--    dan `role` pengguna lain. Scope-nya belum diukur (perlu uji "self only"
--    vs "semua baris" sebelum menulis policy pengganti), jadi sengaja tidak
--    diubah di sini agar halaman admin yang membutuhkan daftar pengguna tidak
--    ikut rusak.
--
-- 2. `public.settings` bisa dibaca `anon`. Audit tidak menemukan kunci API di
--    dalamnya (yang terdeteksi hanya kolom bernama `key` dan `periodKey`, itu
--    positif palsu). Tapi tabel ini menyimpan konfigurasi toko, sehingga rahasia
--    baru jangan pernah ditulis ke sana. Sebaiknya dipindah ke tabel terpisah.
--
-- 3. `chats` dan `notifications` kini hanya bisa diakses staf. Sisi pelanggan
--    memerlukan policy berbasis kepemilikan (mis. `user_id = auth.uid()`) atau
--    dipindah ke Server Action. Perlu keputusan produk sebelum diubah, karena
--    policy kepemilikan yang salah akan membuat pelanggan bisa membaca obrolan
--    orang lain.
-- ============================================================================


-- ============================================================================
-- BAGIAN 7 — VERIFIKASI
-- Jalankan setelah bagian 1-4 untuk memastikan hasilnya.
-- ============================================================================

-- 7a. Ringkasan policy: tabel mana punya policy apa.
--     Harapan: 28 policy `ataya_staff_full`, 20 `ataya_admin_full`,
--     dan 4 policy log (ataya_log_insert + ataya_log_select pada 2 tabel).
--     Total 52 policy baru.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and policyname like 'ataya%'
order by tablename, policyname;

-- 7b. Pastikan TIDAK ADA policy pada dua tabel yang harus tetap tertutup.
--     Harapan: 0 baris.
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('action_keys', 'bri_webhook_logs');

-- 7c. Pastikan RLS menyala di semua tabel publik.
--     Harapan: 0 baris (tidak ada tabel tanpa RLS).
select c.relname as tabel_tanpa_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false
order by 1;

-- 7d. Cek fungsi bantu terpasang dan bertipe boolean.
--     Harapan: dua baris dengan return_type = boolean.
select p.proname, pg_catalog.format_type(p.prorettype, null) as return_type, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('ataya_role', 'ataya_is_admin', 'ataya_is_staff')
order by 1;


-- ============================================================================
-- BAGIAN 8 — ROLLBACK
-- Jalankan HANYA bila ingin membatalkan policy dari berkas ini.
-- ============================================================================

-- do $$
-- declare t text;
-- begin
--   for t in
--     select tablename from pg_policies
--     where schemaname = 'public' and policyname like 'ataya%'
--   loop
--     execute format('drop policy if exists ataya_staff_full on public.%I', t);
--     execute format('drop policy if exists ataya_admin_full on public.%I', t);
--     execute format('drop policy if exists ataya_log_insert on public.%I', t);
--     execute format('drop policy if exists ataya_log_select on public.%I', t);
--     execute format('revoke select, insert, update, delete on table public.%I from authenticated', t);
--   end loop;
-- end $$;
--
-- drop function if exists public.ataya_is_staff();
-- drop function if exists public.ataya_is_admin();
-- drop function if exists public.ataya_role();
