-- ==============================================================================
-- Migrasi Opsional: Tambah kolom payment_status & payment_method pada public.purchases
-- ==============================================================================
--
-- Kode aplikasi menyimpan seluruh data transaksi (status, paymentStatus,
-- paymentMethod, items, poNumber, notes, dll) di dalam kolom JSONB `raw_data`.
--
-- Script ini bersifat opsional untuk menambahkan kolom fisik bila ingin
-- melakukan query SQL langsung atau indexing di dashboard Supabase.

ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'LUNAS',
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'CASH';

-- Sinkronkan data yang sudah ada dari raw_data ke kolom fisik
UPDATE public.purchases
SET
  payment_status = COALESCE(raw_data->>'paymentStatus', 'LUNAS'),
  payment_method = COALESCE(raw_data->>'paymentMethod', 'CASH')
WHERE payment_status IS NULL OR payment_method IS NULL;
