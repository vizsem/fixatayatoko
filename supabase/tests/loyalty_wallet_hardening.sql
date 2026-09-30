-- =============================================================================
-- Uji migrasi 20261002_loyalty_wallet_hardening.sql
--
-- Jalankan pada DATABASE KOSONG sekali pakai (skrip ini membuat & menghapus
-- tabel di schema `public`). Contoh:
--
--   createdb -h /tmp -p 55435 -U postgres loyalty_test
--   psql -h /tmp -p 55435 -U postgres -d loyalty_test \
--        -v ON_ERROR_STOP=1 -f supabase/tests/loyalty_wallet_hardening.sql
--
-- Skrip mereplikasi bentuk tabel yang ADA DI REMOTE (bukan yang tertulis di
-- 20240913_init.sql), termasuk penyimpangan yang nyata:
--   * `point_logs.id` / `wallet_logs.id` bertipe TEXT, bukan UUID.
--   * `point_logs.user_id` / `wallet_logs.user_id` bertipe UUID dan NULL.
--   * Data asli hanya ada di `raw_data`, dengan UID gaya Firebase.
-- =============================================================================

\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- 0. Prasyarat peran (dibuat bila belum ada; abaikan error bila sudah ada)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Replikasi skema remote
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);

DROP TABLE IF EXISTS public.point_logs;
DROP TABLE IF EXISTS public.wallet_logs;
DROP TABLE IF EXISTS public.users;

CREATE TABLE public.users (
  id             uuid PRIMARY KEY,
  full_name      text,
  avatar_url     text,
  wallet_balance numeric DEFAULT 0,
  role           text DEFAULT 'user',
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- Sengaja TEXT, meniru remote.
CREATE TABLE public.point_logs (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     uuid,
  points      integer,
  description text,
  created_at  timestamptz DEFAULT now(),
  raw_data    jsonb
);

CREATE TABLE public.wallet_logs (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     uuid,
  amount      numeric,
  description text,
  created_at  timestamptz DEFAULT now(),
  raw_data    jsonb
);

INSERT INTO public.users (id, full_name, role, wallet_balance) VALUES
  ('999a2a0d-a717-4bcc-9f23-c56f039c41ac', 'Hadzikoh Admin', 'superadmin', 0),
  ('b842c85a-232c-4dba-beda-87a29460308a', 'Kasir Utama',    'cashier',    0);

-- Data ledger apa adanya dari remote: kolom bertipe NULL, isi di raw_data,
-- dan `userId` berupa UID Firebase yang tidak mungkin dikonversi ke UUID.
INSERT INTO public.point_logs (id, raw_data) VALUES
  ('DQG7jFOtoOjLnNbMKhgw', '{"type":"BONUS","userId":"a1BAutHIUigczzWns0Ra5T3sL8D3","description":"Bonus Admin","pointsChanged":5}'),
  ('qhVlubtK4Co8x93lNtLy', '{"type":"REDEEM","userId":"a1BAutHIUigczzWns0Ra5T3sL8D3","description":"Checkout Order #ATY-NFS5X","pointsChanged":-5}'),
  -- Baris rusak: menguji guard cast agar migrasi tidak ikut gagal.
  ('RUSAK001',             '{"type":"???","userId":"bukan-uuid","pointsChanged":"abc"}');

INSERT INTO public.wallet_logs (id, raw_data) VALUES
  ('0X9R9s2rT2yaCBN7IXXa', '{"type":"WITHDRAW_ADMIN","userId":"a1BAutHIUigczzWns0Ra5T3sL8D3","description":"kesalahan sistem","amountChanged":-165000}'),
  ('KHf2qomLJCbykLzdrc8z', '{"type":"REFUND_STOCK","userId":"a1BAutHIUigczzWns0Ra5T3sL8D3","orderId":"OOB0xxuX8KyrADSra0xe","description":"Pengembalian dana","amountChanged":208900}'),
  ('RUSAK002',             '{"type":"???","userId":"bukan-uuid","amountChanged":"abc"}');

-- -----------------------------------------------------------------------------
-- 2. Jalankan migrasi
-- -----------------------------------------------------------------------------
\echo '>>> menerapkan migrasi 20261002...'
\ir ../migrations/20261002_loyalty_wallet_hardening.sql

-- Dijalankan dua kali untuk membuktikan idempoten.
\echo '>>> menerapkan ulang migrasi (uji idempoten)...'
\ir ../migrations/20261002_loyalty_wallet_hardening.sql

-- -----------------------------------------------------------------------------
-- 3. Assertion
-- -----------------------------------------------------------------------------
\echo '>>> memeriksa hasil...'

DO $$
DECLARE
  v_count   integer;
  v_balance integer;
  v_wallet  numeric;
BEGIN
  -- 3a. Kolom baru ada pada users.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'points'
  ) THEN
    RAISE EXCEPTION 'GAGAL: kolom users.points tidak dibuat';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_points_frozen'
  ) THEN
    RAISE EXCEPTION 'GAGAL: kolom users.is_points_frozen tidak dibuat';
  END IF;

  -- 3b. Backfill point_logs: nilai valid terisi, baris rusak dibiarkan NULL
  --     (bukan menggagalkan migrasi).
  SELECT count(*) INTO v_count FROM public.point_logs WHERE points = 5 AND type = 'BONUS';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GAGAL: point_logs BONUS +5 tidak ter-backfill (dapat %)', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.point_logs WHERE points = -5 AND type = 'REDEEM';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GAGAL: point_logs REDEEM -5 tidak ter-backfill (dapat %)', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.point_logs WHERE id = 'RUSAK001' AND points IS NULL;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GAGAL: baris rusak seharusnya tetap NULL, bukan error';
  END IF;

  -- 3c. UID Firebase tidak boleh terkonversi menjadi uuid palsu.
  SELECT count(*) INTO v_count FROM public.point_logs WHERE user_id IS NOT NULL;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GAGAL: user_id seharusnya kosong untuk UID Firebase (dapat %)', v_count;
  END IF;

  -- 3d. Backfill wallet_logs.
  SELECT count(*) INTO v_count FROM public.wallet_logs WHERE amount = 208900 AND type = 'REFUND_STOCK';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GAGAL: wallet_logs REFUND_STOCK tidak ter-backfill';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.wallet_logs
  WHERE id = 'KHf2qomLJCbykLzdrc8z' AND order_id = 'OOB0xxuX8KyrADSra0xe';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GAGAL: wallet_logs.order_id tidak ter-backfill';
  END IF;

  -- 3e. idempoten: jumlah baris tidak berubah setelah migrasi dijalankan 2x.
  SELECT count(*) INTO v_count FROM public.point_logs;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'GAGAL: idempoten dilanggar, point_logs berisi % baris', v_count;
  END IF;

  -- 3f. Fungsi atomik: BONUS menambah saldo DAN menulis ledger.
  v_balance := public.adjust_user_points(
    '999a2a0d-a717-4bcc-9f23-c56f039c41ac', 10, 'BONUS', 'Uji bonus');

  IF v_balance <> 10 THEN
    RAISE EXCEPTION 'GAGAL: saldo setelah bonus seharusnya 10, dapat %', v_balance;
  END IF;

  SELECT points INTO v_count
  FROM public.point_logs
  WHERE user_id = '999a2a0d-a717-4bcc-9f23-c56f039c41ac' AND type = 'BONUS' AND points = 10;

  IF v_count IS NULL THEN
    RAISE EXCEPTION 'GAGAL: ledger BONUS tidak tercatat';
  END IF;

  -- 3g. PENALTY dipangkas pada 0 dan ledger memakai delta yang sama.
  v_balance := public.adjust_user_points(
    '999a2a0d-a717-4bcc-9f23-c56f039c41ac', -999, 'PENALTY', 'Uji penalti');

  IF v_balance <> 0 THEN
    RAISE EXCEPTION 'GAGAL: penalti berlebih seharusnya berhenti di 0, dapat %', v_balance;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.point_logs
    WHERE user_id = '999a2a0d-a717-4bcc-9f23-c56f039c41ac' AND type = 'PENALTY' AND points = -10
  ) THEN
    RAISE EXCEPTION 'GAGAL: ledger PENALTY harus -10 agar sama dengan perubahan saldo';
  END IF;

  -- 3h. Saldo dompet: top-up, lalu penarikan melebihi saldo HARUS gagal.
  v_wallet := public.adjust_user_wallet(
    '999a2a0d-a717-4bcc-9f23-c56f039c41ac', 5000, 'TOPUP_ADMIN', 'Uji top-up');

  IF v_wallet <> 5000 THEN
    RAISE EXCEPTION 'GAGAL: saldo dompet seharusnya 5000, dapat %', v_wallet;
  END IF;

  BEGIN
    PERFORM public.adjust_user_wallet(
      '999a2a0d-a717-4bcc-9f23-c56f039c41ac', -9999, 'WITHDRAW_ADMIN', 'Uji saldo kurang');
    RAISE EXCEPTION 'GAGAL: penarikan melebihi saldo seharusnya ditolak';
  EXCEPTION
    WHEN check_violation THEN
      NULL; -- diharapkan
  END;

  -- Saldo tidak boleh berubah setelah percobaan yang gagal.
  SELECT wallet_balance INTO v_wallet
  FROM public.users WHERE id = '999a2a0d-a717-4bcc-9f23-c56f039c41ac';
  IF v_wallet <> 5000 THEN
    RAISE EXCEPTION 'GAGAL: saldo berubah menjadi % setelah operasi yang gagal', v_wallet;
  END IF;

  -- 3i. Validasi masukan.
  BEGIN
    PERFORM public.adjust_user_points(
      '999a2a0d-a717-4bcc-9f23-c56f039c41ac', 5, 'BONUS', '   ');
    RAISE EXCEPTION 'GAGAL: deskripsi kosong seharusnya ditolak';
  EXCEPTION
    WHEN invalid_parameter_value THEN NULL; -- diharapkan
  END;

  BEGIN
    PERFORM public.adjust_user_points(
      '999a2a0d-a717-4bcc-9f23-c56f039c41ac', 0, 'BONUS', 'nol');
    RAISE EXCEPTION 'GAGAL: delta 0 seharusnya ditolak';
  EXCEPTION
    WHEN invalid_parameter_value THEN NULL; -- diharapkan
  END;

  BEGIN
    PERFORM public.adjust_user_points(
      '00000000-0000-0000-0000-000000000000', 5, 'BONUS', 'user hantu');
    RAISE EXCEPTION 'GAGAL: user tidak dikenal seharusnya ditolak';
  EXCEPTION
    WHEN no_data_found THEN NULL; -- diharapkan
  END;

  -- 3j. Agregat ledger. Data yang ada:
  --     point_logs  -> +5 (BONUS lama), -5 (REDEEM lama), +10, -10  => in 15, out 15
  --     wallet_logs -> -165000 (lama), +208900 (lama), +5000        => in 213900, out 165000
  DECLARE
    v_point_in   bigint;
    v_point_out  bigint;
    v_wallet_in  numeric;
    v_wallet_out numeric;
  BEGIN
    SELECT point_in, point_out, wallet_in, wallet_out
    INTO v_point_in, v_point_out, v_wallet_in, v_wallet_out
    FROM public.ledger_totals();

    IF v_point_in <> 15 OR v_point_out <> 15 THEN
      RAISE EXCEPTION 'GAGAL: agregat poin seharusnya 15/15, dapat %/%',
        v_point_in, v_point_out;
    END IF;

    IF v_wallet_in <> 213900 OR v_wallet_out <> 165000 THEN
      RAISE EXCEPTION 'GAGAL: agregat dompet seharusnya 213900/165000, dapat %/%',
        v_wallet_in, v_wallet_out;
    END IF;
  END;

  RAISE NOTICE 'SEMUA ASSERTION LULUS';
END $$;

-- -----------------------------------------------------------------------------
-- 4. Ringkasan
-- -----------------------------------------------------------------------------
\echo ''
\echo '--- users -------------------------------------------------------------'
SELECT id, full_name, role, points, wallet_balance FROM public.users ORDER BY points DESC;
\echo '--- point_logs --------------------------------------------------------'
SELECT id, user_id, points, type, description FROM public.point_logs ORDER BY created_at;
\echo '--- wallet_logs -------------------------------------------------------'
SELECT id, user_id, amount, type, order_id FROM public.wallet_logs ORDER BY created_at;
\echo ''
\echo '>>> SELESAI — semua pemeriksaan lulus.'
