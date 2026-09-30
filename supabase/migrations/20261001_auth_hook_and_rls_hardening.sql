-- ==============================================================================
-- Migrasi: Auth Hook + Perbaikan Klaim Peran pada RLS
-- Tanggal: 2026-10-01
-- ==============================================================================
-- MASALAH YANG DIPERBAIKI
--
-- 1. Seluruh policy RLS memakai `auth.jwt()->>'role' IN ('admin','cashier',...)`.
--    Padahal klaim `role` pada JWT Supabase adalah PERAN POSTGRES (`anon` /
--    `authenticated`) yang dipakai PostgREST untuk `SET ROLE` — bukan peran bisnis.
--    Akibatnya policy berbasis peran TIDAK PERNAH cocok untuk user yang login.
--
-- 2. Policy gaya `= 'admin'` tidak cocok dengan user mana pun, karena peran yang
--    benar-benar dipakai di `public.users` adalah: superadmin, owner, cashier,
--    staff, warehouse (lihat ADMIN_ROLES di src/lib/auth-helpers.ts).
--
-- 3. RLS belum aktif pada sebagian tabel berisi data sensitif (orders, customers,
--    purchases, suppliers, stock_logs, wallet_logs, point_logs), sehingga kunci
--    `anon` — yang dikirim ke browser — bisa membacanya.
--
-- SOLUSI
--   - Auth Hook menyuntikkan klaim `user_role` (dan `user_id`) ke JWT.
--   - Semua policy dipindahkan dari `'role'` ke `'user_role'`.
--   - Pemeriksaan `= 'admin'` diperluas ke seluruh peran admin yang dipakai aplikasi.
--   - RLS diaktifkan di semua tabel public, dengan policy staff yang seragam.
--
-- ⚠️ WAJIB: setelah menjalankan file ini, DAFTARKAN hook-nya di Dashboard:
--    Authentication → Hooks → "Customize Access Token (JWT) Claims"
--    → pilih schema `public`, function `custom_access_token_hook` → Enable.
--    Tanpa langkah itu, klaim `user_role` tidak akan pernah muncul di JWT.
--
-- SIFAT: IDEMPOTEN & SELF-HEALING — aman dijalankan berulang kali.
-- ==============================================================================

-- ============================================================
-- 1. AUTH HOOK — menyuntikkan klaim `user_role`
-- ============================================================
-- Dipanggil Supabase Auth setiap kali token dibuat/di-refresh.
-- Mengembalikan `event` dengan `claims.user_role` terisi dari public.users.role.
--
-- Sengaja TIDAK menyentuh klaim `role` (peran Postgres) — mengubahnya akan
-- membuat PostgREST gagal `SET ROLE`.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb := coalesce(event->'claims', '{}'::jsonb);
  v_role text;
BEGIN
  SELECT u.role INTO v_role
  FROM public.users u
  WHERE u.id::text = event->>'user_id';

  IF v_role IS NOT NULL AND btrim(v_role) <> '' THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(btrim(v_role)));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
EXCEPTION
  -- Hook yang error akan menggagalkan SEMUA login. Jadi kegagalan apa pun
  -- dikembalikan sebagai event apa adanya (tanpa klaim tambahan).
  WHEN OTHERS THEN
    RAISE WARNING 'custom_access_token_hook gagal: %', SQLERRM;
    RETURN event;
END;
$$;

-- Hanya role internal Supabase Auth yang boleh memanggil hook ini.
REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT SELECT ON public.users TO supabase_auth_admin;

-- ============================================================
-- 1b. RESOLVER PERAN — fallback bila hook belum didaftarkan
-- ============================================================
-- Policy TIDAK memakai klaim JWT secara langsung, melainkan lewat
-- `public.current_app_role()`:
--   - bila klaim `user_role` ada di JWT (hook aktif)  -> pakai itu (tanpa query)
--   - bila belum ada (hook belum didaftarkan)         -> baca public.users
--
-- Dengan begitu migration ini aman diterapkan lebih dulu, tanpa jendela waktu
-- di mana staf tiba-tiba tidak bisa melihat data apa pun.
CREATE OR REPLACE FUNCTION public.app_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.role FROM public.users u WHERE u.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(auth.jwt()->>'user_role', ''),
    public.app_user_role()
  );
$$;

-- Dibutuhkan agar policy dapat memanggilnya sebagai anon/authenticated.
GRANT EXECUTE ON FUNCTION public.app_user_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.app_user_role() FROM PUBLIC;

-- ============================================================
-- 2. PINDAHKAN SEMUA POLICY: 'role' -> 'user_role'
-- ============================================================
-- Ditulis ulang secara programatik agar mencakup SEMUA policy yang ada —
-- termasuk yang dibuat di luar file migrasi. Ekspresi diambil dari
-- pg_policies.qual / with_check (hasil deparse pg_get_expr) lalu diparse ulang,
-- sehingga semantiknya identik selain penggantian nama klaim.
DO $$
DECLARE
  p        record;
  new_qual text;
  new_chk  text;
  role_list text;
  stmt     text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual, '') LIKE '%>> ''role''%' OR coalesce(with_check, '') LIKE '%>> ''role''%')
  LOOP
    -- Ganti nama klaim
    new_qual := replace(p.qual,       '>> ''role''', '>> ''user_role''');
    new_chk  := replace(p.with_check, '>> ''role''', '>> ''user_role''');

    -- Arahkan ke resolver bersama (klaim JWT -> fallback public.users)
    new_qual := replace(new_qual, '(auth.jwt() ->> ''user_role''::text)', 'public.current_app_role()');
    new_chk  := replace(new_chk,  '(auth.jwt() ->> ''user_role''::text)', 'public.current_app_role()');

    -- Perluas pemeriksaan admin tunggal ke seluruh peran admin aplikasi,
    -- karena tidak ada user yang benar-benar ber-role 'admin'.
    new_qual := replace(new_qual, 'public.current_app_role() = ''admin''::text',
      'public.current_app_role() = ANY (ARRAY[''admin'', ''superadmin'', ''super_admin'', ''owner'', ''super-admin''])');
    new_chk := replace(new_chk, 'public.current_app_role() = ''admin''::text',
      'public.current_app_role() = ANY (ARRAY[''admin'', ''superadmin'', ''super_admin'', ''owner'', ''super-admin''])');

    role_list := (SELECT string_agg(quote_ident(r), ', ') FROM unnest(p.roles) AS r);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);

    stmt := format('CREATE POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF p.permissive = 'RESTRICTIVE' THEN
      stmt := stmt || ' AS RESTRICTIVE';
    END IF;
    stmt := stmt || format(' FOR %s', p.cmd);
    IF role_list IS NOT NULL AND role_list <> '' THEN
      stmt := stmt || ' TO ' || role_list;
    END IF;
    IF new_qual IS NOT NULL AND new_qual <> '' THEN
      stmt := stmt || ' USING (' || new_qual || ')';
    END IF;
    IF new_chk IS NOT NULL AND new_chk <> '' THEN
      stmt := stmt || ' WITH CHECK (' || new_chk || ')';
    END IF;

    EXECUTE stmt;
  END LOOP;
END $$;

-- ============================================================
-- 3. PASTIKAN SETIAP TABEL PUNYA POLICY UNTUK STAF
-- ============================================================
-- 3a. Policy admin menyeluruh (pengganti `admin_all` lama yang memakai 'role'
--     dan hanya cocok untuk role 'admin' yang tidak dipakai).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = r.tablename AND policyname = 'admin_all'
    ) THEN
      EXECUTE format(
        'CREATE POLICY admin_all ON public.%I FOR ALL '
        'USING (public.current_app_role() = ANY (ARRAY[''admin'',''superadmin'',''super_admin'',''owner'',''super-admin''])) '
        'WITH CHECK (public.current_app_role() = ANY (ARRAY[''admin'',''superadmin'',''super_admin'',''owner'',''super-admin'']))',
        r.tablename);
    END IF;
  END LOOP;
END $$;

-- 3b. Policy staf untuk tabel sensitif yang sebelumnya terbuka bagi anon.
--     Tanpa ini, mengaktifkan RLS akan mengunci staf dari tabel tersebut.
DO $$
DECLARE
  t text;
  staff_roles text := '''admin'',''superadmin'',''super_admin'',''owner'',''super-admin'',''cashier'',''kasir'',''staff'',''warehouse'',''employee'',''sales'',''driver''';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'orders', 'customers', 'purchases', 'suppliers',
    'stock_logs', 'wallet_logs', 'point_logs'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t)
       AND NOT EXISTS (
         SELECT 1 FROM pg_policies
         WHERE schemaname='public' AND tablename=t AND policyname='app_staff_manage'
       )
    THEN
      EXECUTE format(
        'CREATE POLICY app_staff_manage ON public.%I FOR ALL '
        'USING (public.current_app_role() = ANY (ARRAY[%s])) '
        'WITH CHECK (public.current_app_role() = ANY (ARRAY[%s]))',
        t, staff_roles, staff_roles);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 4. AKTIFKAN RLS DI SEMUA TABEL PUBLIC
-- ============================================================
-- Idempoten. Setelah ini anon tidak lagi bisa membaca tabel yang sebelumnya
-- terbuka (orders, customers, purchases, suppliers, stock_logs, wallet_logs,
-- point_logs) — tetapi staf yang login tetap bisa lewat policy di atas.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;

-- ============================================================
-- 5. GRANT (agar role anon/authenticated bisa menyentuh tabel sama sekali;
--    pembatasan baris tetap ditentukan RLS)
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
