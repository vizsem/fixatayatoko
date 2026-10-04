-- ============================================================================
-- Migrasi: Optimasi Indeks Tabel Orders
-- Tujuan : Mempercepat query order detail (order_id), sorting created_at,
--          dan filter status pada halaman daftar pesanan (/admin/orders).
-- ============================================================================

-- 1. Indeks pada order_id (untuk lookup nomor order SO-xxx yang cepat)
CREATE INDEX IF NOT EXISTS idx_orders_order_id
  ON public.orders (order_id);

-- 2. Indeks pada created_at DESC (untuk sorting pesanan terbaru)
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders (created_at DESC);

-- 3. Indeks pada status (untuk filtering tab SEMUA, DIPROSES, SELESAI, dll.)
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON public.orders (status);
