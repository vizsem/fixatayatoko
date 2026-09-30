-- ==============================================================================
-- Migrasi: Tabel-Tabel yang Belum Ada di Supabase
-- Tanggal: 2026-09-30 (direvisi 2026-10-01)
-- Deskripsi: Menambahkan 7 tabel yang dipakai kode tapi belum terdefinisi.
--
-- SIFAT: IDEMPOTEN & SELF-HEALING — aman dijalankan berulang kali.
--   - CREATE TABLE / CREATE INDEX memakai IF NOT EXISTS
--   - Tiap tabel diikuti ADD COLUMN IF NOT EXISTS, sehingga tabel yang sudah
--     terlanjur ada dengan skema parsial tetap dilengkapi.
--     (Kasus nyata: product_cost_logs hanya punya `id` + `raw_data`, sehingga
--      CREATE INDEX ... ("productId") gagal dengan error 42703.)
--   - CREATE POLICY didahului DROP POLICY IF EXISTS
--
-- Diverifikasi terhadap PostgreSQL 16 (2026-10-01):
--   skenario tabel kosong OK | lanjut-setelah-gagal OK | dijalankan 3x berturut OK
-- ==============================================================================

-- ============================================================
-- 1. MARKETPLACE ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id               TEXT PRIMARY KEY DEFAULT ('mpo_' || substr(md5(random()::text), 1, 10)),
  source           TEXT NOT NULL,
  product_id       TEXT,
  product_name     TEXT,
  qty              INTEGER NOT NULL DEFAULT 1,
  price            NUMERIC DEFAULT 0,
  total            NUMERIC DEFAULT 0,
  status           TEXT DEFAULT 'PENDING',
  customer_name    TEXT,
  customer_phone   TEXT,
  notes            TEXT,
  raw_data         JSONB,
  recorded_by      TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Pastikan kolom ada bila tabel sudah terlanjur dibuat dengan skema parsial.
-- `CREATE TABLE IF NOT EXISTS` akan DILEWATI untuk tabel yang sudah ada,
-- sehingga kolom di bawah ini tidak akan terbentuk tanpa pernyataan berikut.
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS source          TEXT;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS product_id      TEXT;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS product_name    TEXT;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS qty             INTEGER DEFAULT 1;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS price           NUMERIC DEFAULT 0;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS total           NUMERIC DEFAULT 0;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT 'PENDING';
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS customer_name   TEXT;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS customer_phone  TEXT;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS notes           TEXT;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS raw_data        JSONB;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS recorded_by     TEXT;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_mp_orders_source     ON public.marketplace_orders (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_orders_product    ON public.marketplace_orders (product_id);
CREATE INDEX IF NOT EXISTS idx_mp_orders_status     ON public.marketplace_orders (status);
CREATE INDEX IF NOT EXISTS idx_mp_orders_created    ON public.marketplace_orders (created_at DESC);

-- ============================================================
-- 2. BRI WEBHOOK LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bri_webhook_logs (
  id               TEXT PRIMARY KEY DEFAULT ('bri_' || substr(md5(random()::text), 1, 10)),
  type             TEXT DEFAULT 'QRIS',
  status           TEXT DEFAULT 'RECEIVED',
  order_id         TEXT,
  partner_ref      TEXT,
  original_ref     TEXT,
  external_id      TEXT,
  amount           NUMERIC DEFAULT 0,
  verified         BOOLEAN DEFAULT false,
  raw_data         JSONB,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bri_webhook_logs ADD COLUMN IF NOT EXISTS type            TEXT DEFAULT 'QRIS';
ALTER TABLE public.bri_webhook_logs ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT 'RECEIVED';
ALTER TABLE public.bri_webhook_logs ADD COLUMN IF NOT EXISTS order_id        TEXT;
ALTER TABLE public.bri_webhook_logs ADD COLUMN IF NOT EXISTS partner_ref     TEXT;
ALTER TABLE public.bri_webhook_logs ADD COLUMN IF NOT EXISTS original_ref    TEXT;
ALTER TABLE public.bri_webhook_logs ADD COLUMN IF NOT EXISTS external_id     TEXT;
ALTER TABLE public.bri_webhook_logs ADD COLUMN IF NOT EXISTS amount          NUMERIC DEFAULT 0;
ALTER TABLE public.bri_webhook_logs ADD COLUMN IF NOT EXISTS verified        BOOLEAN DEFAULT false;
ALTER TABLE public.bri_webhook_logs ADD COLUMN IF NOT EXISTS raw_data        JSONB;
ALTER TABLE public.bri_webhook_logs ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_bri_logs_created     ON public.bri_webhook_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bri_logs_order       ON public.bri_webhook_logs (order_id);
CREATE INDEX IF NOT EXISTS idx_bri_logs_partner_ref ON public.bri_webhook_logs (partner_ref);

-- ============================================================
-- 3. WAREHOUSE STOCK (warehouseStock)
-- ============================================================
CREATE TABLE IF NOT EXISTS public."warehouseStock" (
  id               TEXT PRIMARY KEY DEFAULT ('ws_' || substr(md5(random()::text), 1, 10)),
  "productId"      TEXT NOT NULL,
  "productName"    TEXT,
  "warehouseId"    TEXT NOT NULL,
  "warehouseName"  TEXT,
  quantity         INTEGER NOT NULL DEFAULT 0,
  reserved         INTEGER DEFAULT 0,
  last_updated     TIMESTAMPTZ DEFAULT now(),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_warehouse_product UNIQUE ("productId", "warehouseId")
);

ALTER TABLE public."warehouseStock" ADD COLUMN IF NOT EXISTS "productId"     TEXT;
ALTER TABLE public."warehouseStock" ADD COLUMN IF NOT EXISTS "productName"   TEXT;
ALTER TABLE public."warehouseStock" ADD COLUMN IF NOT EXISTS "warehouseId"   TEXT;
ALTER TABLE public."warehouseStock" ADD COLUMN IF NOT EXISTS "warehouseName" TEXT;
ALTER TABLE public."warehouseStock" ADD COLUMN IF NOT EXISTS quantity        INTEGER DEFAULT 0;
ALTER TABLE public."warehouseStock" ADD COLUMN IF NOT EXISTS reserved        INTEGER DEFAULT 0;
ALTER TABLE public."warehouseStock" ADD COLUMN IF NOT EXISTS last_updated    TIMESTAMPTZ DEFAULT now();
ALTER TABLE public."warehouseStock" ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT now();
ALTER TABLE public."warehouseStock" ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();

-- Unique constraint tidak punya bentuk "IF NOT EXISTS", jadi dibungkus DO block.
-- Kegagalan (mis. ada baris duplikat) tidak menghentikan migrasi.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_warehouse_product'
  ) THEN
    BEGIN
      ALTER TABLE public."warehouseStock"
        ADD CONSTRAINT uq_warehouse_product UNIQUE ("productId", "warehouseId");
    EXCEPTION WHEN unique_violation OR duplicate_object OR duplicate_table THEN
      RAISE NOTICE 'Lewati uq_warehouse_product: %', SQLERRM;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wh_stock_product   ON public."warehouseStock" ("productId");
CREATE INDEX IF NOT EXISTS idx_wh_stock_warehouse ON public."warehouseStock" ("warehouseId");

-- ============================================================
-- 4. ACTIVITY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id               TEXT PRIMARY KEY DEFAULT ('act_' || substr(md5(random()::text), 1, 10)),
  type             TEXT NOT NULL,
  admin_id         TEXT,
  admin_name       TEXT,
  target_id        TEXT,
  target_name      TEXT,
  description      TEXT,
  metadata         JSONB,
  ip_address       TEXT,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS type          TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS admin_id      TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS admin_name    TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS target_id     TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS target_name   TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS description   TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS metadata      JSONB;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS ip_address    TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS user_agent    TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_activity_logs_admin   ON public.activity_logs (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type    ON public.activity_logs (type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_target  ON public.activity_logs (target_id);

-- ============================================================
-- 5. OPERATIONAL EXPENSES PROOFS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.operational_expenses_proofs (
  id               TEXT PRIMARY KEY DEFAULT ('proof_' || substr(md5(random()::text), 1, 10)),
  expense_id       TEXT,
  file_name        TEXT NOT NULL,
  file_path        TEXT NOT NULL,
  file_url         TEXT,
  file_type        TEXT,
  file_size        INTEGER,
  uploaded_by      TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.operational_expenses_proofs ADD COLUMN IF NOT EXISTS expense_id   TEXT;
ALTER TABLE public.operational_expenses_proofs ADD COLUMN IF NOT EXISTS file_name    TEXT;
ALTER TABLE public.operational_expenses_proofs ADD COLUMN IF NOT EXISTS file_path    TEXT;
ALTER TABLE public.operational_expenses_proofs ADD COLUMN IF NOT EXISTS file_url     TEXT;
ALTER TABLE public.operational_expenses_proofs ADD COLUMN IF NOT EXISTS file_type    TEXT;
ALTER TABLE public.operational_expenses_proofs ADD COLUMN IF NOT EXISTS file_size    INTEGER;
ALTER TABLE public.operational_expenses_proofs ADD COLUMN IF NOT EXISTS uploaded_by  TEXT;
ALTER TABLE public.operational_expenses_proofs ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_expense_proofs_expense ON public.operational_expenses_proofs (expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_proofs_created ON public.operational_expenses_proofs (created_at DESC);

-- ============================================================
-- 6. STOCK VALIDATION LOGS (stockValidationLogs)
-- ============================================================
CREATE TABLE IF NOT EXISTS public."stockValidationLogs" (
  id               TEXT PRIMARY KEY DEFAULT ('svl_' || substr(md5(random()::text), 1, 10)),
  "productId"      TEXT NOT NULL,
  "warehouseId"    TEXT NOT NULL,
  "systemStock"    INTEGER DEFAULT 0,
  "physicalStock"  INTEGER DEFAULT 0,
  difference       INTEGER DEFAULT 0,
  status           TEXT DEFAULT 'VALID',
  type             TEXT DEFAULT 'STOCK_VALIDATION',
  error            TEXT,
  "executionTime"  NUMERIC,
  timestamp        TIMESTAMPTZ DEFAULT now(),
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public."stockValidationLogs" ADD COLUMN IF NOT EXISTS "productId"      TEXT;
ALTER TABLE public."stockValidationLogs" ADD COLUMN IF NOT EXISTS "warehouseId"    TEXT;
ALTER TABLE public."stockValidationLogs" ADD COLUMN IF NOT EXISTS "systemStock"    INTEGER DEFAULT 0;
ALTER TABLE public."stockValidationLogs" ADD COLUMN IF NOT EXISTS "physicalStock"  INTEGER DEFAULT 0;
ALTER TABLE public."stockValidationLogs" ADD COLUMN IF NOT EXISTS difference       INTEGER DEFAULT 0;
ALTER TABLE public."stockValidationLogs" ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'VALID';
ALTER TABLE public."stockValidationLogs" ADD COLUMN IF NOT EXISTS type             TEXT DEFAULT 'STOCK_VALIDATION';
ALTER TABLE public."stockValidationLogs" ADD COLUMN IF NOT EXISTS error            TEXT;
ALTER TABLE public."stockValidationLogs" ADD COLUMN IF NOT EXISTS "executionTime"  NUMERIC;
ALTER TABLE public."stockValidationLogs" ADD COLUMN IF NOT EXISTS timestamp        TIMESTAMPTZ DEFAULT now();
ALTER TABLE public."stockValidationLogs" ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_svl_product   ON public."stockValidationLogs" ("productId", timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_svl_warehouse ON public."stockValidationLogs" ("warehouseId");
CREATE INDEX IF NOT EXISTS idx_svl_status    ON public."stockValidationLogs" (status);

-- ============================================================
-- 7. PRODUCT COST LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_cost_logs (
  id               TEXT PRIMARY KEY DEFAULT ('pcl_' || substr(md5(random()::text), 1, 10)),
  "productId"      TEXT NOT NULL,
  "productName"    TEXT,
  "oldCost"        NUMERIC DEFAULT 0,
  "newCost"        NUMERIC NOT NULL DEFAULT 0,
  "adminEmail"     TEXT,
  "changeDate"     TIMESTAMPTZ DEFAULT now(),
  notes            TEXT,
  source           TEXT DEFAULT 'MANUAL',
  raw_data         JSONB,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- PENTING: tabel ini sudah ada di project remote dengan bentuk minimal
-- (hanya `id` + `raw_data`), sehingga CREATE TABLE IF NOT EXISTS di atas DILEWATI.
-- Kolom berikut wajib ditambahkan eksplisit, karena kode aplikasi menulis
-- `insert({ productId, productName, oldCost, newCost, adminEmail, changeDate, notes })`.
ALTER TABLE public.product_cost_logs ADD COLUMN IF NOT EXISTS "productId"    TEXT;
ALTER TABLE public.product_cost_logs ADD COLUMN IF NOT EXISTS "productName"  TEXT;
ALTER TABLE public.product_cost_logs ADD COLUMN IF NOT EXISTS "oldCost"      NUMERIC DEFAULT 0;
ALTER TABLE public.product_cost_logs ADD COLUMN IF NOT EXISTS "newCost"      NUMERIC DEFAULT 0;
ALTER TABLE public.product_cost_logs ADD COLUMN IF NOT EXISTS "adminEmail"   TEXT;
ALTER TABLE public.product_cost_logs ADD COLUMN IF NOT EXISTS "changeDate"   TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.product_cost_logs ADD COLUMN IF NOT EXISTS notes          TEXT;
ALTER TABLE public.product_cost_logs ADD COLUMN IF NOT EXISTS source         TEXT DEFAULT 'MANUAL';
ALTER TABLE public.product_cost_logs ADD COLUMN IF NOT EXISTS raw_data       JSONB;
ALTER TABLE public.product_cost_logs ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ DEFAULT now();

-- Pulihkan baris lama yang datanya masih terkubur di dalam `raw_data`
-- (format ekspor Firestore). Baris legacy dikenali dari `"productId" IS NULL`,
-- sehingga UPDATE ini aman dijalankan berulang kali.
--
-- Catatan: kolom numerik/tanggal ditimpa langsung (bukan COALESCE) karena
-- `ADD COLUMN ... DEFAULT` sudah mengisinya dengan nilai default, sehingga
-- COALESCE akan mempertahankan nilai default alih-alih nilai asli.
-- Setiap cast dijaga regex + exception handler agar tak pernah menggagalkan migrasi.
DO $$
BEGIN
  UPDATE public.product_cost_logs SET
    "productId"   = COALESCE("productId", raw_data->>'productId'),
    "productName" = COALESCE("productName", raw_data->>'productName'),
    "adminEmail"  = COALESCE("adminEmail", raw_data->>'adminId'),
    notes         = COALESCE(notes, raw_data->>'reason'),
    "oldCost"     = CASE WHEN raw_data->>'oldCost' ~ '^-?[0-9]+(\.[0-9]+)?$'
                         THEN (raw_data->>'oldCost')::numeric ELSE "oldCost" END,
    "newCost"     = CASE WHEN raw_data->>'newCost' ~ '^-?[0-9]+(\.[0-9]+)?$'
                         THEN (raw_data->>'newCost')::numeric ELSE "newCost" END,
    "changeDate"  = CASE WHEN raw_data->'changeDate'->>'_seconds' ~ '^[0-9]+$'
                         THEN to_timestamp((raw_data->'changeDate'->>'_seconds')::bigint)
                         ELSE "changeDate" END
  WHERE raw_data IS NOT NULL
    AND "productId" IS NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Lewati backfill product_cost_logs: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_pcl_product     ON public.product_cost_logs ("productId", "changeDate" DESC);
CREATE INDEX IF NOT EXISTS idx_pcl_change_date ON public.product_cost_logs ("changeDate" DESC);
CREATE INDEX IF NOT EXISTS idx_pcl_source      ON public.product_cost_logs (source);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.marketplace_orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bri_webhook_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."warehouseStock"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_expenses_proofs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."stockValidationLogs"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_cost_logs             ENABLE ROW LEVEL SECURITY;

-- marketplace_orders
DROP POLICY IF EXISTS "staff_manage_marketplace_orders" ON public.marketplace_orders;
CREATE POLICY "staff_manage_marketplace_orders" ON public.marketplace_orders
  FOR ALL USING (auth.jwt()->>'role' IN ('admin', 'cashier', 'owner', 'staff', 'superadmin'));

-- bri_webhook_logs
DROP POLICY IF EXISTS "admin_read_bri_logs" ON public.bri_webhook_logs;
CREATE POLICY "admin_read_bri_logs" ON public.bri_webhook_logs
  FOR ALL USING (auth.jwt()->>'role' IN ('admin', 'owner', 'superadmin'));

-- warehouseStock
DROP POLICY IF EXISTS "staff_manage_warehouse_stock" ON public."warehouseStock";
CREATE POLICY "staff_manage_warehouse_stock" ON public."warehouseStock"
  FOR ALL USING (auth.jwt()->>'role' IN ('admin', 'cashier', 'owner', 'staff', 'warehouse', 'superadmin'));

-- activity_logs
DROP POLICY IF EXISTS "admin_read_activity_logs" ON public.activity_logs;
CREATE POLICY "admin_read_activity_logs" ON public.activity_logs
  FOR SELECT USING (auth.jwt()->>'role' IN ('admin', 'owner', 'superadmin'));

DROP POLICY IF EXISTS "system_insert_activity_logs" ON public.activity_logs;
CREATE POLICY "system_insert_activity_logs" ON public.activity_logs
  FOR INSERT WITH CHECK (true);

-- operational_expenses_proofs
DROP POLICY IF EXISTS "staff_manage_expense_proofs" ON public.operational_expenses_proofs;
CREATE POLICY "staff_manage_expense_proofs" ON public.operational_expenses_proofs
  FOR ALL USING (auth.jwt()->>'role' IN ('admin', 'cashier', 'owner', 'staff', 'superadmin'));

-- stockValidationLogs
DROP POLICY IF EXISTS "staff_read_stock_validation_logs" ON public."stockValidationLogs";
CREATE POLICY "staff_read_stock_validation_logs" ON public."stockValidationLogs"
  FOR SELECT USING (auth.jwt()->>'role' IN ('admin', 'cashier', 'owner', 'staff', 'warehouse', 'superadmin'));

DROP POLICY IF EXISTS "system_insert_stock_validation_logs" ON public."stockValidationLogs";
CREATE POLICY "system_insert_stock_validation_logs" ON public."stockValidationLogs"
  FOR INSERT WITH CHECK (true);

-- product_cost_logs
DROP POLICY IF EXISTS "admin_read_product_cost_logs" ON public.product_cost_logs;
CREATE POLICY "admin_read_product_cost_logs" ON public.product_cost_logs
  FOR SELECT USING (auth.jwt()->>'role' IN ('admin', 'owner', 'superadmin'));

DROP POLICY IF EXISTS "system_insert_product_cost_logs" ON public.product_cost_logs;
CREATE POLICY "system_insert_product_cost_logs" ON public.product_cost_logs
  FOR INSERT WITH CHECK (true);

