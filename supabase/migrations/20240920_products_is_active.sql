-- ==============================================================================
-- Migrasi: Tambah kolom is_active + sku + unit + category + cost_price + image_url + barcode
-- pada tabel products agar bisa difilter langsung di query
-- ==============================================================================

-- Tambah kolom-kolom yang belum ada
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku        TEXT,
  ADD COLUMN IF NOT EXISTS unit       TEXT,
  ADD COLUMN IF NOT EXISTS category   TEXT,
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url  TEXT,
  ADD COLUMN IF NOT EXISTS barcode    TEXT,
  ADD COLUMN IF NOT EXISTS is_active  BOOLEAN NOT NULL DEFAULT true;

-- Isi is_active dari raw_data untuk produk yang sudah ada
-- Produk diarsip jika: raw_data->>'isActive' = 'false', Status = '1', atau status = 'ARCHIVED'
UPDATE public.products
SET is_active = CASE
  WHEN raw_data->>'isActive' = 'false'    THEN false
  WHEN raw_data->>'status'   = 'ARCHIVED' THEN false
  WHEN (raw_data->>'Status')::int         = 1  THEN false
  ELSE true
END
WHERE raw_data IS NOT NULL;

-- Index agar filter is_active cepat
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_category  ON public.products (category);
CREATE INDEX IF NOT EXISTS idx_products_sku       ON public.products (sku);
