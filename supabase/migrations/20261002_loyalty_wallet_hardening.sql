-- =============================================================================
-- 20261002_loyalty_wallet_hardening.sql
-- Memperbaiki subsistem POIN & DOMPET yang selama ini tidak berfungsi.
--
-- LATAR BELAKANG (temuan 2026-10-01, diverifikasi langsung ke DB remote)
--
--   1. `public.users` TIDAK punya kolom `points` maupun `is_points_frozen`.
--      Akibatnya:
--        * `admin/points` mengurutkan user dengan `order=points.desc`
--          -> ERROR 42703 -> daftar user SELALU KOSONG.
--        * Tombol "Bekukan Poin" & "Penyesuaian Manual" tidak mengubah apa pun,
--          tetapi tetap menampilkan notifikasi SUKSES (kegagalan senyap).
--        * `cart`, `vouchers`, `profil` membaca `userData.points` -> selalu 0,
--          sehingga poin tidak pernah bisa ditukar.
--
--   2. Kolom bertipe `point_logs.user_id/points/description` dan
--      `wallet_logs.user_id/amount/description` SEMUANYA NULL. Seluruh isi
--      sebenarnya berada di `raw_data` (sisa impor Firestore), sehingga tidak
--      bisa diindeks, difilter, atau dijumlahkan oleh SQL.
--
--   3. Drift skema: migrasi `20240913_init.sql` mendeklarasikan
--      `point_logs.id` dan `wallet_logs.id` sebagai UUID, tetapi di remote
--      keduanya TEXT (berisi id gaya Firestore seperti 'DQG7jFOtoOjLnNbMKhgw').
--      Karena itu migrasi ini TIDAK mengubah tipe kolom, dan fungsi baru
--      memakai `gen_random_uuid()` yang valid untuk kolom UUID maupun TEXT.
--
--   4. Seluruh baris ledger yang ada adalah data YATIM: `raw_data.userId`
--      berisi UID Firebase ('a1BAutHIUigczzWns0Ra5T3sL8D3') yang TIDAK ada di
--      `public.users` (semua id di sana UUID). Baris tersebut dibiarkan apa
--      adanya; lihat blok verifikasi di bagian bawah untuk cara menemukannya.
--
-- Semua pernyataan IDEMPOTEN: aman dijalankan berulang kali.
-- Tidak ada DROP TABLE / DROP COLUMN / DELETE, dan tidak ada data yang hilang.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- A. Kolom yang hilang pada `users`
-- -----------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_points_frozen boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.points IS
  'Saldo poin loyalitas. Ini sumber kebenaran; `point_logs` adalah ledger-nya.';
COMMENT ON COLUMN public.users.is_points_frozen IS
  'Bila true, pelanggan tidak boleh menukar poin (mis. indikasi kecurangan).';

-- -----------------------------------------------------------------------------
-- B. Kolom yang hilang pada tabel ledger
-- -----------------------------------------------------------------------------
ALTER TABLE public.point_logs  ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.wallet_logs ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.wallet_logs ADD COLUMN IF NOT EXISTS order_id text;

COMMENT ON COLUMN public.point_logs.type IS
  'EARN | BONUS | REDEEM | PENALTY';
COMMENT ON COLUMN public.wallet_logs.type IS
  'TOPUP_ADMIN | WITHDRAW_ADMIN | REFUND_STOCK | WALLET_PAYMENT | ...';

-- -----------------------------------------------------------------------------
-- C. Helper sementara: cast teks -> angka/uuid yang TIDAK pernah melempar error.
--
--    Diperlukan karena `raw_data` berisi data lama yang kotor: `userId` berupa
--    UID Firebase (bukan UUID) dan nilai bisa kosong/berisi teks. Tanpa helper
--    ini, satu baris buruk akan menggagalkan SELURUH migrasi.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pg_temp_try_uuid(p_text text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_text::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.pg_temp_try_int(p_text text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN NULL;
  END IF;
  RETURN trunc(p_text::numeric)::integer;
EXCEPTION
  WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.pg_temp_try_numeric(p_text text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_text::numeric;
EXCEPTION
  WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN NULL;
END;
$$;

-- -----------------------------------------------------------------------------
-- D. Backfill kolom bertipe dari `raw_data`
--    Hanya menyentuh kolom yang masih NULL, jadi nilai yang sudah benar tidak
--    akan tertimpa. Baris dengan UID Firebase tetap NULL di `user_id` karena
--    memang tidak bisa dipetakan ke user mana pun.
-- -----------------------------------------------------------------------------
UPDATE public.point_logs
SET
  user_id     = COALESCE(user_id, public.pg_temp_try_uuid(raw_data->>'userId')),
  points      = COALESCE(points,  public.pg_temp_try_int(raw_data->>'pointsChanged')),
  type        = COALESCE(type,        NULLIF(raw_data->>'type', '')),
  description = COALESCE(description, NULLIF(raw_data->>'description', ''))
WHERE raw_data IS NOT NULL
  AND (user_id IS NULL OR points IS NULL OR type IS NULL OR description IS NULL);

UPDATE public.wallet_logs
SET
  user_id     = COALESCE(user_id, public.pg_temp_try_uuid(raw_data->>'userId')),
  amount      = COALESCE(amount,  public.pg_temp_try_numeric(raw_data->>'amountChanged')),
  type        = COALESCE(type,        NULLIF(raw_data->>'type', '')),
  description = COALESCE(description, NULLIF(raw_data->>'description', '')),
  order_id    = COALESCE(order_id,    NULLIF(raw_data->>'orderId', ''))
WHERE raw_data IS NOT NULL
  AND (user_id IS NULL OR amount IS NULL OR type IS NULL OR description IS NULL);

-- -----------------------------------------------------------------------------
-- E. Indeks pendukung
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_point_logs_user_id     ON public.point_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_point_logs_created_at  ON public.point_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_logs_user_id    ON public.wallet_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_logs_created_at ON public.wallet_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_points           ON public.users (points DESC);

-- -----------------------------------------------------------------------------
-- F. Operasi atomik (ubah saldo + catat ledger dalam SATU transaksi)
--
--    Tanpa ini, pola baca-lalu-tulis di sisi aplikasi rawan kehilangan
--    pembaruan (lost update) bila dua admin mengubah saldo bersamaan, dan
--    saldo bisa berubah tanpa jejak audit bila penulisan ledger gagal.
--
--    SECURITY DEFINER + EXECUTE hanya untuk `service_role`: fungsi ini dipanggil
--    dari Server Action yang sudah memverifikasi peran admin. Peran `anon` dan
--    `authenticated` TIDAK boleh memanggilnya.
--
--    `gen_random_uuid()` dipakai (bukan prefiks teks) supaya cocok baik untuk
--    kolom UUID (fresh install) maupun TEXT (remote saat ini).
-- -----------------------------------------------------------------------------

-- Ubah saldo poin. Mengembalikan saldo akhir.
-- Delta negatif (PENALTY) TIDAK akan membuat saldo negatif: delta dipangkas
-- agar jumlah di ledger selalu sama dengan saldo sebenarnya.
CREATE OR REPLACE FUNCTION public.adjust_user_points(
  p_user_id     uuid,
  p_delta       integer,
  p_type        text,
  p_description text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current integer;
  v_delta   integer := p_delta;
  v_new     integer;
BEGIN
  IF p_delta = 0 THEN
    RAISE EXCEPTION 'Perubahan poin tidak boleh 0' USING ERRCODE = '22023';
  END IF;

  IF p_type IS NULL OR btrim(p_type) = '' THEN
    RAISE EXCEPTION 'Jenis penyesuaian poin wajib diisi' USING ERRCODE = '22023';
  END IF;

  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RAISE EXCEPTION 'Alasan penyesuaian wajib diisi' USING ERRCODE = '22023';
  END IF;

  -- Kunci baris agar aman terhadap penyesuaian bersamaan.
  SELECT points INTO v_current
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengguna % tidak ditemukan', p_user_id USING ERRCODE = 'P0002';
  END IF;

  IF p_delta < 0 THEN
    v_delta := GREATEST(p_delta, -v_current);
  END IF;

  -- Saldo sudah 0 dan hanya diminta pengurangan: jangan catat baris ledger palsu.
  IF v_delta = 0 THEN
    RETURN v_current;
  END IF;

  UPDATE public.users
  SET points = points + v_delta, updated_at = now()
  WHERE id = p_user_id
  RETURNING points INTO v_new;

  INSERT INTO public.point_logs (id, user_id, points, type, description, created_at)
  VALUES (gen_random_uuid(), p_user_id, v_delta, upper(p_type), p_description, now());

  RETURN v_new;
END;
$$;

-- Ubah saldo dompet. Mengembalikan saldo akhir.
-- Berbeda dengan poin, saldo dompet adalah UANG: bila saldo tidak mencukupi,
-- fungsi ini GAGAL (tidak dipangkas diam-diam) supaya kesalahan tidak tersembunyi.
CREATE OR REPLACE FUNCTION public.adjust_user_wallet(
  p_user_id     uuid,
  p_delta       numeric,
  p_type        text,
  p_description text,
  p_order_id    text DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current numeric;
  v_new     numeric;
BEGIN
  IF p_delta = 0 THEN
    RAISE EXCEPTION 'Perubahan saldo tidak boleh 0' USING ERRCODE = '22023';
  END IF;

  IF p_type IS NULL OR btrim(p_type) = '' THEN
    RAISE EXCEPTION 'Jenis penyesuaian saldo wajib diisi' USING ERRCODE = '22023';
  END IF;

  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RAISE EXCEPTION 'Alasan penyesuaian wajib diisi' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(wallet_balance, 0) INTO v_current
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengguna % tidak ditemukan', p_user_id USING ERRCODE = 'P0002';
  END IF;

  IF v_current + p_delta < 0 THEN
    RAISE EXCEPTION 'Saldo tidak mencukupi. Saldo saat ini: %', v_current
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.users
  SET wallet_balance = COALESCE(wallet_balance, 0) + p_delta, updated_at = now()
  WHERE id = p_user_id
  RETURNING wallet_balance INTO v_new;

  INSERT INTO public.wallet_logs (id, user_id, amount, type, description, order_id, created_at)
  VALUES (gen_random_uuid(), p_user_id, p_delta, upper(p_type), p_description, p_order_id, now());

  RETURN v_new;
END;
$$;

-- Ringkasan seluruh ledger. Dijalankan sebagai agregat di dalam basis data
-- supaya halaman admin tidak perlu mengunduh seluruh isi tabel hanya untuk
-- menampilkan tiga angka.
CREATE OR REPLACE FUNCTION public.ledger_totals()
RETURNS TABLE (
  point_in   bigint,
  point_out  bigint,
  wallet_in  numeric,
  wallet_out numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH p AS (
    SELECT
      COALESCE(SUM(points) FILTER (WHERE points > 0), 0)   AS pin,
      COALESCE(SUM(-points) FILTER (WHERE points < 0), 0)  AS pout
    FROM public.point_logs
  ), w AS (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0)   AS win,
      COALESCE(SUM(-amount) FILTER (WHERE amount < 0), 0)  AS wout
    FROM public.wallet_logs
  )
  SELECT p.pin, p.pout, w.win, w.wout FROM p, w;
$$;

-- Hanya service_role (dipakai Server Action) yang boleh mengeksekusi.
REVOKE ALL ON FUNCTION public.ledger_totals() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_user_points(uuid, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_user_wallet(uuid, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ledger_totals() TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_user_points(uuid, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_user_wallet(uuid, numeric, text, text, text) TO service_role;
-- Helper sementara tidak diperlukan lagi setelah backfill selesai.
DROP FUNCTION IF EXISTS public.pg_temp_try_uuid(text);
DROP FUNCTION IF EXISTS public.pg_temp_try_int(text);
DROP FUNCTION IF EXISTS public.pg_temp_try_numeric(text);

COMMIT;

-- =============================================================================
-- VERIFIKASI SETELAH MENJALANKAN
-- =============================================================================
-- 1) Backfill berjalan (baris yatim akan tetap NULL di user_id — itu wajar):
--      SELECT count(*) FILTER (WHERE points IS NULL)  AS points_null,
--             count(*) FILTER (WHERE user_id IS NULL) AS user_id_null
--      FROM public.point_logs;
--
--      SELECT count(*) FILTER (WHERE amount IS NULL)   AS amount_null
--      FROM public.wallet_logs;
--
-- 2) Daftar pengguna beserta saldo:
--      SELECT id, full_name, role, points, wallet_balance
--      FROM public.users ORDER BY points DESC;
--
-- 3) Baris ledger YATIM (warisan Firebase, tidak bisa dipetakan ke user).
--    Ini normal dan bukan error:
--      SELECT 'point' AS asal, id, raw_data->>'userId' AS uid_lama
--      FROM public.point_logs WHERE user_id IS NULL
--      UNION ALL
--      SELECT 'wallet', id, raw_data->>'userId'
--      FROM public.wallet_logs WHERE user_id IS NULL;
--
-- 4) Uji fungsi atomik (ganti UUID di bawah dengan id user sungguhan):
--      SELECT public.adjust_user_points(
--        '999a2a0d-a717-4bcc-9f23-c56f039c41ac', 10, 'BONUS', 'Uji coba migrasi');
--      SELECT public.adjust_user_wallet(
--        '999a2a0d-a717-4bcc-9f23-c56f039c41ac', 5000, 'TOPUP_ADMIN', 'Uji coba migrasi');
--    Lalu batalkan bila hanya ingin mencoba:
--      -- (jalankan dalam satu transaksi dengan ROLLBACK)
-- =============================================================================
