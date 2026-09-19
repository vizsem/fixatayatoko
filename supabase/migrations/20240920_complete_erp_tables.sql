-- ==============================================================================
-- Migrasi: Kelengkapan Tabel ERP & Marketplace Terintegrasi
-- Tanggal: 2024-09-20
-- Deskripsi: Melengkapi tabel permodalan (capital), pinjaman (loans),
--            akun marketplace, pengeluaran operasional, jurnal buku besar,
--            promosi/voucher, log inventory, serta log sinkronisasi stok.
-- ==============================================================================

-- 1️⃣ PERMODALAN (Capital Transactions)
CREATE TABLE IF NOT EXISTS public.capital_transactions (
  id          TEXT PRIMARY KEY DEFAULT ('cap_' || substr(md5(random()::text), 1, 10)),
  type        TEXT NOT NULL, -- INJECTION, WITHDRAWAL
  amount      NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  recorded_by TEXT,
  date        TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2️⃣ PINJAMAN MODAL (Loans)
CREATE TABLE IF NOT EXISTS public.loans (
  id               TEXT PRIMARY KEY DEFAULT ('loan_' || substr(md5(random()::text), 1, 10)),
  lender_name      TEXT NOT NULL,
  amount           NUMERIC NOT NULL DEFAULT 0,
  remaining_amount NUMERIC NOT NULL DEFAULT 0,
  description      TEXT,
  loan_type        TEXT DEFAULT 'STANDARD',
  interest_rate    NUMERIC DEFAULT 0,
  status           TEXT DEFAULT 'ACTIVE', -- ACTIVE, PAID
  start_date       TIMESTAMPTZ DEFAULT now(),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- 3️⃣ AKUN MARKETPLACE (Shopee, TikTok, Tokopedia, dll)
CREATE TABLE IF NOT EXISTS public.marketplace_accounts (
  id              TEXT PRIMARY KEY DEFAULT ('mp_acc_' || substr(md5(random()::text), 1, 10)),
  name            TEXT NOT NULL,
  store_name      TEXT,
  active_balance  NUMERIC DEFAULT 0,
  pending_balance NUMERIC DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 4️⃣ MUTASI SALDO MARKETPLACE
CREATE TABLE IF NOT EXISTS public.marketplace_transactions (
  id             TEXT PRIMARY KEY DEFAULT ('mp_tx_' || substr(md5(random()::text), 1, 10)),
  account_id     TEXT NOT NULL,
  name           TEXT NOT NULL,
  store_name     TEXT,
  type           TEXT NOT NULL, -- ADJUST, WITHDRAWAL, DEPOSIT
  amount         NUMERIC,
  active_change  NUMERIC,
  pending_change NUMERIC,
  recorded_by    TEXT,
  note           TEXT,
  date           TIMESTAMPTZ DEFAULT now(),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- 5️⃣ PENGELUARAN OPERASIONAL (Operational Expenses)
CREATE TABLE IF NOT EXISTS public.operational_expenses (
  id               TEXT PRIMARY KEY DEFAULT ('exp_' || substr(md5(random()::text), 1, 10)),
  category         TEXT NOT NULL,
  amount           NUMERIC NOT NULL DEFAULT 0,
  description      TEXT,
  date             TIMESTAMPTZ DEFAULT now(),
  proof_of_payment TEXT,
  recorded_by      TEXT,
  raw_data         JSONB,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- 6️⃣ BUKU BESAR / JURNAL AKUNTANSI (Ledger Entries)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id             TEXT PRIMARY KEY DEFAULT ('ledg_' || substr(md5(random()::text), 1, 10)),
  debit_account  TEXT,
  credit_account TEXT,
  amount         NUMERIC NOT NULL DEFAULT 0,
  memo           TEXT,
  ref_type       TEXT,
  ref_id         TEXT,
  posted_by      TEXT DEFAULT 'system',
  raw_data       JSONB,
  date           TIMESTAMPTZ DEFAULT now(),
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- 7️⃣ AUDIT LOG INVENTORY (Inventory Logs)
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id                TEXT PRIMARY KEY DEFAULT ('inv_' || substr(md5(random()::text), 1, 10)),
  product_id        TEXT,
  product_name      TEXT,
  warehouse_id      TEXT,
  from_warehouse_id TEXT,
  to_warehouse_id   TEXT,
  type              TEXT, -- IN, OUT, ADJUSTMENT, OPNAME, TRANSFER
  source            TEXT,
  amount            NUMERIC,
  quantity          INTEGER,
  prev_stock        INTEGER,
  next_stock        INTEGER,
  reference_id      TEXT,
  order_id          TEXT,
  admin_id          TEXT,
  note              TEXT,
  raw_data          JSONB,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- 8️⃣ PROMOSI & USER VOUCHERS
CREATE TABLE IF NOT EXISTS public.user_vouchers (
  id           TEXT PRIMARY KEY DEFAULT ('vchr_' || substr(md5(random()::text), 1, 10)),
  user_id      TEXT,
  promotion_id TEXT,
  code         TEXT,
  value        NUMERIC DEFAULT 0,
  status       TEXT DEFAULT 'ACTIVE', -- ACTIVE, USED, EXPIRED
  used_at      TIMESTAMPTZ,
  raw_data     JSONB,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 9️⃣ LOG SINKRONISASI STOK & VALIDASI STOK
CREATE TABLE IF NOT EXISTS public."stockSyncLogs" (
  id             TEXT PRIMARY KEY DEFAULT ('sync_' || substr(md5(random()::text), 1, 10)),
  "productId"    TEXT NOT NULL,
  "productName"  TEXT,
  "warehouseId"  TEXT NOT NULL,
  "warehouseName" TEXT,
  type           TEXT NOT NULL,
  status         TEXT DEFAULT 'SUCCESS',
  quantity       INTEGER,
  "previousStock" INTEGER,
  "newStock"     INTEGER,
  difference     INTEGER,
  "systemStock"  INTEGER,
  reason         TEXT,
  synced         BOOLEAN DEFAULT true,
  "syncError"    TEXT,
  "executionTime" NUMERIC,
  operator       TEXT,
  timestamp      TIMESTAMPTZ DEFAULT now(),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."stockValidations" (
  id              TEXT PRIMARY KEY DEFAULT ('val_' || substr(md5(random()::text), 1, 10)),
  "productId"     TEXT NOT NULL,
  "warehouseId"   TEXT NOT NULL,
  "systemStock"   INTEGER NOT NULL DEFAULT 0,
  "physicalStock" INTEGER NOT NULL DEFAULT 0,
  difference      INTEGER NOT NULL DEFAULT 0,
  status          TEXT DEFAULT 'VALID',
  "lastSync"      TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_product_warehouse UNIQUE ("productId", "warehouseId")
);

-- 🔟 INDEKS OPTIMASI QUERY
CREATE INDEX IF NOT EXISTS idx_capital_tx_created ON public.capital_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans (status);
CREATE INDEX IF NOT EXISTS idx_mp_tx_account ON public.marketplace_transactions (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.operational_expenses (category);
CREATE INDEX IF NOT EXISTS idx_expenses_created ON public.operational_expenses (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON public.ledger_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON public.inventory_logs (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created ON public.inventory_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_product ON public."stockSyncLogs" ("productId", timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_user ON public.user_vouchers (user_id);

-- 1️⃣1️⃣ AKTIFKAN RLS (Row Level Security)
ALTER TABLE public.capital_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."stockSyncLogs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."stockValidations" ENABLE ROW LEVEL SECURITY;

-- 1️⃣2️⃣ KEBIJAKAN (POLICIES) AKSES RLS
-- Staff/Admin access for internal ERP tables
CREATE POLICY "staff_read_write_capital" ON public.capital_transactions
  FOR ALL USING (auth.jwt()->>'role' IN ('admin', 'cashier', 'owner', 'staff'));

CREATE POLICY "staff_read_write_loans" ON public.loans
  FOR ALL USING (auth.jwt()->>'role' IN ('admin', 'cashier', 'owner', 'staff'));

CREATE POLICY "staff_read_write_mp_accounts" ON public.marketplace_accounts
  FOR ALL USING (auth.jwt()->>'role' IN ('admin', 'cashier', 'owner', 'staff'));

CREATE POLICY "staff_read_write_mp_tx" ON public.marketplace_transactions
  FOR ALL USING (auth.jwt()->>'role' IN ('admin', 'cashier', 'owner', 'staff'));

CREATE POLICY "staff_read_write_expenses" ON public.operational_expenses
  FOR ALL USING (auth.jwt()->>'role' IN ('admin', 'cashier', 'owner', 'staff'));

CREATE POLICY "staff_read_write_ledger" ON public.ledger_entries
  FOR ALL USING (auth.jwt()->>'role' IN ('admin', 'cashier', 'owner', 'staff'));

CREATE POLICY "staff_read_write_inv_logs" ON public.inventory_logs
  FOR ALL USING (auth.jwt()->>'role' IN ('admin', 'cashier', 'owner', 'staff', 'warehouse'));

CREATE POLICY "staff_read_write_sync_logs" ON public."stockSyncLogs"
  FOR ALL USING (auth.jwt()->>'role' IN ('admin', 'cashier', 'owner', 'staff', 'warehouse'));

CREATE POLICY "staff_read_write_validations" ON public."stockValidations"
  FOR ALL USING (auth.jwt()->>'role' IN ('admin', 'cashier', 'owner', 'staff', 'warehouse'));

CREATE POLICY "user_read_own_vouchers" ON public.user_vouchers
  FOR SELECT USING (auth.uid()::text = user_id OR auth.jwt()->>'role' IN ('admin', 'cashier', 'owner', 'staff'));

CREATE POLICY "staff_write_user_vouchers" ON public.user_vouchers
  FOR ALL USING (auth.jwt()->>'role' IN ('admin', 'cashier', 'owner', 'staff'));
