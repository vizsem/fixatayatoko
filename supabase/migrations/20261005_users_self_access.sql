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
  where u.id = auth.uid()::text
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
-- BAGIAN 1 — Catat lalu hapus SEMUA policy lama pada `public.users`
--
-- Policy lama itu yang membiarkan pelanggan menulis `role` miliknya sendiri.
-- Nama policy-nya dicatat lewat NOTICE supaya ada jejak sebelum dihapus.
-- ============================================================================

do $$
declare
  pol record;
  jumlah int := 0;
begin
  for pol in
    select policyname, cmd, roles, qual, with_check
    from pg_policies
    where schemaname = 'public' and tablename = 'users'
    order by policyname
  loop
    jumlah := jumlah + 1;
    raise notice 'Policy lama pada users: % | cmd=% | roles=% | using=% | check=%',
      pol.policyname, pol.cmd, pol.roles, pol.qual, pol.with_check;
  end loop;

  raise notice 'Total policy lama pada users: %', jumlah;

  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'users'
  loop
    execute format('drop policy %I on public.users', pol.policyname);
  end loop;
end $$;


-- ============================================================================
-- BAGIAN 2 — Policy baru untuk `public.users`
--
-- Ringkas:
--   SELECT : baris sendiri, atau seluruh baris bila staf/admin
--   UPDATE : baris sendiri, atau seluruh baris bila staf/admin
--   INSERT : hanya boleh membuat baris dengan id = auth.uid()
--   DELETE : tidak ada policy  -> hanya service role lewat Server Action
-- ============================================================================

alter table public.users enable row level security;

drop policy if exists users_select_self_or_staff on public.users;
create policy users_select_self_or_staff on public.users
  as permissive for select to authenticated
  using (public.ataya_is_staff() or id = auth.uid()::text);

drop policy if exists users_update_self_or_staff on public.users;
create policy users_update_self_or_staff on public.users
  as permissive for update to authenticated
  using (public.ataya_is_staff() or id = auth.uid()::text)
  with check (public.ataya_is_staff() or id = auth.uid()::text);

drop policy if exists users_insert_self on public.users;
create policy users_insert_self on public.users
  as permissive for insert to authenticated
  with check (id = auth.uid()::text);


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
-- Peringatan: policy lama yang dihapus di Bagian 1 TIDAK dapat dipulihkan oleh
-- blok ini, karena isinya tidak diketahui. NOTICE di Bagian 1 mencetak definisinya
-- — simpan keluaran itu bila Anda mungkin perlu kembali ke keadaan sebelumnya.
-- ============================================================================

-- revoke insert, update on table public.users from authenticated;
-- grant select, insert, update, delete on table public.users to authenticated;
-- drop policy if exists users_select_self_or_staff on public.users;
-- drop policy if exists users_update_self_or_staff on public.users;
-- drop policy if exists users_insert_self on public.users;
