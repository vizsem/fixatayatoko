-- ============================================================================
-- 20261005_users_self_access.sql
--
-- TUJUAN
-- Menutup jalur naik-ke-admin (privilege escalation) yang terbukti bisa
-- dilakukan oleh pelanggan biasa, dan membatasi pembacaan tabel `users`
-- hanya ke baris milik sendiri (kecuali staf/admin).
--
-- BUKTI MASALAH (hasil uji langsung ke proyek, bukan dugaan)
--   1. Akun pelanggan dapat menjalankan
--        PATCH /rest/v1/users?id=eq.<uid>  body: {"role":"admin"}
--      dan menerima HTTP 200 dengan role benar-benar berubah menjadi admin.
--      Artinya siapa pun yang mendaftar bisa menjadi admin dalam satu permintaan.
--   2. Akun pelanggan dapat menulis `user_metadata.role = 'admin'` lewat
--      `PUT /auth/v1/user`, dan `src/lib/actions/guard.ts` memakai
--      `user_metadata.role` sebagai cadangan, sehingga `requireAdmin()` lolos.
--   3. Akun baru yang SENGAJA tidak punya baris di `public.users` tetap bisa
--      membaca SEMUA 8 baris users, termasuk kolom `role`, `wallet_balance`,
--      dan `points` milik orang lain.
--
-- Perbaikan sisi kode (metadata tidak lagi dipercaya) ada di commit yang sama.
-- Berkas ini menutup jalur di sisi basis data, sehingga tetap tertutup walau
-- kode klien dimanipulasi.
--
-- SIFAT PERUBAHAN
-- Menghapus policy lama pada `public.users`, lalu membuat policy baru yang ketat.
-- Tidak menghapus baris maupun kolom.
--
-- CARA MENJALANKAN
-- Salin seluruh isi berkas ini ke Supabase SQL Editor, lalu Run.
-- Aman dijalankan berulang kali (idempoten).
-- ============================================================================


-- ============================================================================
-- BAGIAN 0 — Prasyarat: fungsi penentu peran
--
-- Disalin dari 20261004 agar berkas ini bisa dijalankan sendiri, tanpa harus
-- menjalankan migrasi itu lebih dulu. Kalau 20261004 sudah dijalankan, definisi
-- di bawah hanya menimpanya dengan isi yang sama.
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
  where u.id = auth.uid()
  limit 1;
$$;

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

revoke all on function public.ataya_role() from public;
revoke all on function public.ataya_is_admin() from public;
revoke all on function public.ataya_is_staff() from public;
grant execute on function public.ataya_role() to anon, authenticated, service_role;
grant execute on function public.ataya_is_admin() to anon, authenticated, service_role;
grant execute on function public.ataya_is_staff() to anon, authenticated, service_role;


-- ============================================================================
-- BAGIAN 1 — Hapus policy lama pada `public.users`
--
-- Nama-namanya diambil dari riwayat migration di repo (`20240913_init.sql`),
-- BUKAN ditebak. Ada lima, dan dua di antaranya yang bermasalah:
--
--   "users can list (authenticated users only)"
--       USING (auth.uid() IS NOT NULL)
--       -> setiap pengguna yang login boleh membaca SELURUH baris `users`.
--          Inilah sebabnya akun pelanggan bisa melihat role, wallet_balance,
--          dan points milik orang lain.
--
--   "users can update own or staff"
--       USING/WITH CHECK (auth.uid() = id OR auth.jwt()->>'role' IN ('admin','cashier'))
--       -> RLS membatasi BARIS, bukan KOLOM. Pemilik baris karena itu boleh
--          menulis kolom apa pun, termasuk `role`. Inilah jalur naik-ke-admin.
--
-- CATATAN PENTING soal `auth.jwt()->>'role'`:
-- di Supabase klaim itu berisi peran POSTGRES (`anon`, `authenticated`,
-- `service_role`), BUKAN peran aplikasi. Jadi setiap perbandingan
-- `= 'admin'` atau `IN ('admin','cashier')` selalu bernilai SALAH. Akibatnya
-- semua policy berlabel "staff" di `20240913_init.sql` tidak pernah memberi
-- akses sama sekali — itu juga sebabnya 53 tabel tampak kosong pada audit.
--
-- Policy lama dihapus satu per satu (bukan disapu borongan) supaya tidak ada
-- policy tak dikenal yang ikut hilang diam-diam. Definisi aslinya dicatat di
-- BAGIAN 5 agar bisa dipulihkan.
-- ============================================================================

alter table public.users enable row level security;

drop policy if exists "users can read own or admin" on public.users;
drop policy if exists "users can list (authenticated users only)" on public.users;
drop policy if exists "users can create own profile" on public.users;
drop policy if exists "users can update own or staff" on public.users;
drop policy if exists "only admin can delete users" on public.users;


-- ============================================================================
-- BAGIAN 2 — Policy baru untuk `public.users`
--
-- Ringkas:
--   SELECT : baris sendiri, atau seluruh baris bila staf/admin
--   UPDATE : baris sendiri, atau seluruh baris bila staf/admin
--   INSERT : hanya boleh membuat baris dengan id = auth.uid()
--   DELETE : tidak ada policy  -> hanya service role lewat Server Action
-- ============================================================================

-- CATATAN TIPE KOLOM: `public.users.id` bertipe `uuid` (berbeda dari tabel
-- lain yang memakai `text`). Karena itu perbandingannya adalah `id = auth.uid()`
-- TANPA cast. Menuliskan `auth.uid()::text` akan gagal dengan
-- "operator does not exist: uuid = text".

alter table public.users enable row level security;

drop policy if exists users_select_self_or_staff on public.users;
create policy users_select_self_or_staff on public.users
  as permissive for select to authenticated
  using (public.ataya_is_staff() or id = auth.uid());

drop policy if exists users_update_self_or_staff on public.users;
create policy users_update_self_or_staff on public.users
  as permissive for update to authenticated
  using (public.ataya_is_staff() or id = auth.uid())
  with check (public.ataya_is_staff() or id = auth.uid());

drop policy if exists users_insert_self on public.users;
create policy users_insert_self on public.users
  as permissive for insert to authenticated
  with check (id = auth.uid());


-- ============================================================================
-- BAGIAN 3 — Kunci kolom: INI BAGIAN YANG PALING PENTING
--
-- Policy di atas membatasi BARIS, bukan KOLOM. Tanpa langkah ini, pemilik baris
-- masih boleh menulis `role`, `wallet_balance`, `points`, dan
-- `is_points_frozen` miliknya sendiri — persis celah yang terbukti di atas.
--
-- RLS tidak bisa membatasi kolom, jadi pembatasannya lewat GRANT tingkat kolom:
-- peran `authenticated` hanya boleh mengubah `full_name` dan `avatar_url`.
--
-- Perubahan `role`, `wallet_balance`, `points`, dan `is_points_frozen` HANYA
-- boleh lewat service role (Server Action yang sudah memanggil `requireAdmin()`).
-- ============================================================================

-- Hapus dulu hak tulis menyeluruh, supaya tidak ada sisa dari GRANT bawaan.
revoke insert, update on table public.users from authenticated;

-- `anon` tidak punya policy sama sekali, jadi RLS sudah menolaknya. Pencabutan
-- ini hanya lapisan tambahan agar hak tulis tidak menggantung tanpa guna.
revoke insert, update on table public.users from anon;

-- Pengguna hanya boleh menyunting nama tampilan dan avatar miliknya sendiri.
grant update (full_name, avatar_url) on table public.users to authenticated;

-- Saat membuat barisnya sendiri, hanya kolom aman ini yang boleh diisi.
-- `role` dan saldo tidak termasuk, sehingga tidak bisa ditebak-tebak saat daftar.
grant insert (id, full_name, avatar_url) on table public.users to authenticated;


-- ============================================================================
-- BAGIAN 4 — VERIFIKASI
-- ============================================================================

-- 4a. Harapan: 3 policy (SELECT, UPDATE, INSERT) dan TIDAK ada DELETE.
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'users'
order by cmd, policyname;

-- 4b. Harapan: peran `authenticated` HANYA punya SELECT pada kolom sensitif,
--     dan hak UPDATE hanya pada full_name serta avatar_url.
--     Kalau `role` muncul di kolom `update_grants`, perbaikan ini belum berlaku.
select
  privilege_type,
  string_agg(column_name, ', ' order by column_name) as update_grants
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'users'
  and grantee = 'authenticated'
  and privilege_type in ('INSERT', 'UPDATE')
group by privilege_type
order by privilege_type;

-- 4c. Harapan: 2 baris — kolom sensitif hanya punya hak SELECT.
select column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'users'
  and grantee = 'authenticated'
  and column_name in ('role', 'wallet_balance', 'points', 'is_points_frozen')
order by column_name, privilege_type;


-- ============================================================================
-- BAGIAN 5 — ROLLBACK
--
-- Policy lama dihapus dengan nama yang pasti, jadi bisa dipulihkan persis.
-- Definisi aslinya dari `20240913_init.sql` disertakan di bawah.
-- ============================================================================

-- drop policy if exists users_select_self_or_staff on public.users;
-- drop policy if exists users_update_self_or_staff on public.users;
-- drop policy if exists users_insert_self on public.users;
-- revoke insert, update on table public.users from authenticated, anon;
-- grant select, insert, update, delete on table public.users to authenticated;
--
-- -- Mengembalikan policy lama (PERINGATAN: ini membuka kembali dua celah
-- -- keamanan yang baru saja ditutup, jangan dijalankan tanpa alasan jelas):
-- create policy "users can read own or admin" on public.users
--   for select using (auth.uid() = id or auth.jwt()->>'role' = 'admin');
-- create policy "users can list (authenticated users only)" on public.users
--   for select using (auth.uid() is not null);
-- create policy "users can create own profile" on public.users
--   for insert with check (auth.uid() = id);
-- create policy "users can update own or staff" on public.users
--   for update using (auth.uid() = id or auth.jwt()->>'role' in ('admin','cashier'))
--   with check (auth.uid() = id or auth.jwt()->>'role' in ('admin','cashier'));
-- create policy "only admin can delete users" on public.users
--   for delete using (auth.jwt()->>'role' = 'admin');
