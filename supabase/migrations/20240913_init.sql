-- 1️⃣ Skema tabel
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  wallet_balance NUMERIC DEFAULT 0,
  role          TEXT    DEFAULT 'user',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.carts (
  user_id   UUID REFERENCES auth.users NOT NULL,
  product_id UUID,
  qty       INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users NOT NULL,
  status       TEXT,
  total        NUMERIC,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT,
  description TEXT,
  price       NUMERIC,
  stock       INTEGER,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT,
  email       TEXT,
  phone       TEXT,
  address     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT,
  contact     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id),
  total       NUMERIC,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID REFERENCES public.products(id),
  qty_change  INTEGER,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID REFERENCES public.products(id),
  qty_before  INTEGER,
  qty_after   INTEGER,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.warehouses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT,
  location    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promotions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT,
  discount    NUMERIC,
  start_date  DATE,
  end_date    DATE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE,
  value       JSONB,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.point_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  points      INTEGER,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallet_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  amount      NUMERIC,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2️⃣ Aktifkan Row‑Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_logs ENABLE ROW LEVEL SECURITY;

-- 3️⃣ Kebijakan (Policies) – meniru Firestore rules
CREATE POLICY "users can read own or admin" ON public.users FOR SELECT USING (auth.uid() = id OR auth.jwt()->>'role' = 'admin');
CREATE POLICY "users can list (authenticated users only)" ON public.users FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "users can create own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users can update own or staff" ON public.users FOR UPDATE USING (auth.uid() = id OR auth.jwt()->>'role' IN ('admin','cashier')) WITH CHECK (auth.uid() = id OR auth.jwt()->>'role' IN ('admin','cashier'));
CREATE POLICY "only admin can delete users" ON public.users FOR DELETE USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "carts: only owner can read/write" ON public.carts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "order_owner" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "staff can read any order" ON public.orders FOR SELECT USING (auth.jwt()->>'role' IN ('admin','cashier'));
CREATE POLICY "staff can create orders" ON public.orders FOR INSERT WITH CHECK (auth.jwt()->>'role' IN ('admin','cashier'));
CREATE POLICY "staff can update orders" ON public.orders FOR UPDATE USING (auth.jwt()->>'role' IN ('admin','cashier'));
CREATE POLICY "owner can mark order SELESAI" ON public.orders FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (status = 'SELESAI');
CREATE POLICY "admin can delete orders" ON public.orders FOR DELETE USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "anyone can read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "staff can write products" ON public.products FOR ALL USING (auth.jwt()->>'role' IN ('admin','cashier'));

CREATE POLICY "staff can read/write customers" ON public.customers FOR ALL USING (auth.jwt()->>'role' IN ('admin','cashier'));

CREATE POLICY "staff can read suppliers" ON public.suppliers FOR SELECT USING (auth.jwt()->>'role' IN ('admin','cashier'));
CREATE POLICY "admin can write suppliers" ON public.suppliers FOR ALL USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "staff can read purchases" ON public.purchases FOR SELECT USING (auth.jwt()->>'role' IN ('admin','cashier'));
CREATE POLICY "admin can write purchases" ON public.purchases FOR ALL USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "staff can read/write inventory transactions" ON public.inventory_transactions FOR ALL USING (auth.jwt()->>'role' IN ('admin','cashier'));

CREATE POLICY "staff can read/create stock logs_select" ON public.stock_logs FOR SELECT USING (auth.jwt()->>'role' IN ('admin','cashier'));
CREATE POLICY "staff can read/create stock logs_insert" ON public.stock_logs FOR INSERT WITH CHECK (auth.jwt()->>'role' IN ('admin','cashier'));
CREATE POLICY "admin can update/delete stock logs_update" ON public.stock_logs FOR UPDATE USING (auth.jwt()->>'role' = 'admin');
CREATE POLICY "admin can update/delete stock logs_delete" ON public.stock_logs FOR DELETE USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "anyone can read warehouses" ON public.warehouses FOR SELECT USING (true);
CREATE POLICY "admin can write warehouses" ON public.warehouses FOR ALL USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "anyone can read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "staff can write categories" ON public.categories FOR ALL USING (auth.jwt()->>'role' IN ('admin','cashier'));

CREATE POLICY "anyone can read promotions" ON public.promotions FOR SELECT USING (true);
CREATE POLICY "admin can write promotions" ON public.promotions FOR ALL USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "anyone can read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "admin can write settings" ON public.settings FOR ALL USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "point_logs read own or staff" ON public.point_logs FOR SELECT USING (auth.uid() = user_id OR auth.jwt()->>'role' IN ('admin','cashier'));
CREATE POLICY "point_logs create (authenticated users)" ON public.point_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "point_logs admin update/delete_update" ON public.point_logs FOR UPDATE USING (auth.jwt()->>'role' = 'admin');
CREATE POLICY "point_logs admin update/delete_delete" ON public.point_logs FOR DELETE USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "wallet_logs read own or staff" ON public.wallet_logs FOR SELECT USING (auth.uid() = user_id OR auth.jwt()->>'role' IN ('admin','cashier'));
CREATE POLICY "wallet_logs create (staff only)" ON public.wallet_logs FOR INSERT WITH CHECK (auth.jwt()->>'role' IN ('admin','cashier'));
CREATE POLICY "wallet_logs admin update/delete_update" ON public.wallet_logs FOR UPDATE USING (auth.jwt()->>'role' = 'admin');
CREATE POLICY "wallet_logs admin update/delete_delete" ON public.wallet_logs FOR DELETE USING (auth.jwt()->>'role' = 'admin');

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('CREATE POLICY admin_all ON public.%I FOR ALL USING (auth.jwt()->>''role'' = ''admin'');', r.tablename);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
