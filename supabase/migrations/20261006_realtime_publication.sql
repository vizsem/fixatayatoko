-- ============================================================================
-- 20261006_realtime_publication.sql
--
-- TUJUAN
-- Mengaktifkan Supabase Realtime untuk tabel-tabel yang sudah lama
-- dilanggani kode, sehingga UI benar-benar menerima pembaruan.
--
-- BUKTI MASALAH (hasil uji langsung ke proyek cnxuzqlcmosymcwcraoa)
--   1. `useProducts` (src/lib/hooks/useProducts.ts) dan `onSnapshot` di
--      src/lib/firebase.ts berlangganan `postgres_changes` pada tabel
--      `products`. Itu SATU-SATUNYA mekanisme refresh daftar produk.
--   2. Uji: buka channel `postgres_changes` untuk `products`, lalu UPDATE
--      satu baris (`updated_at` ditulis ulang dengan nilai yang sama).
--      Langganan diterima server (SUBSCRIBED), tetapi TIDAK ADA event yang
--      datang — diuji dengan anon key maupun service role, jadi bukan RLS.
--   3. Akibatnya setelah PO diterima, stok di database bertambah tetapi layar
--      tetap menampilkan angka lama sampai halaman di-reload manual. Ini
--      penyebab keluhan "stok tidak bertambah setelah PO".
--   4. Sebelum migrasi ini, TIDAK ADA tabel yang ditambahkan ke publication
--      `supabase_realtime` di migrasi mana pun.
--
-- DAFTAR TABEL DIAMBIL DARI KODE, BUKAN TEBAKAN
--   `node scripts/audit-realtime-coverage.mjs` memindai src/ untuk:
--     a. `'postgres_changes', { ... table: '<nama>' }`
--     b. `onSnapshot(...)` lewat bridge (termasuk argumen berupa variabel dan
--        subcollection, yang dipetakan ke segmen path TERAKHIR)
--   lalu membandingkannya dengan tabel yang benar-benar ada di remote.
--
-- CATATAN
--   - Idempoten: tabel yang sudah terdaftar akan dilewati.
--   - `inventory_logs`, `messages`, dan `reviews` SENGAJA TIDAK didaftarkan:
--       * `inventory_logs` ada di remote tetapi TIDAK ada kode yang berlangganan
--         Realtime ke sana — mempublish-nya hanya menambah beban WAL tanpa ada
--         yang mendengarkan.
--       * `messages` dilanggani 4 komponen chat, tetapi TABELNYA TIDAK ADA di
--         remote (HTTP 404). Temuan terpisah: chat lewat bridge memetakan
--         `collection(db, 'chats', id, 'messages')` ke tabel `messages`, sehingga
--         daftar pesan tidak pernah termuat. Perlu perbaikan tersendiri, bukan
--         sekadar publikasi Realtime.
--       * `reviews` hanya diambil sekali dengan `getDocs`, bukan langganan.
--   - REPLICA IDENTITY FULL tidak diubah. Filter yang dipakai kode memakai kolom
--     primary key (`id=eq.`) dan itu sudah terkirim dengan replica identity
--     default. Satu-satunya langganan ber-filter kolom NON-primary key adalah
--     `useStockSync` (`filter: productId=eq.` pada `stockSyncLogs`), dan hook itu
--     TIDAK dipakai halaman mana pun saat ini (yang dipakai langsung hanya
--     `stockSyncService`). Bila nanti hook itu dipasang, jalankan:
--       ALTER TABLE public."stockSyncLogs" REPLICA IDENTITY FULL;
--   - Realtime tetap tunduk pada RLS: pengguna hanya menerima event untuk baris
--     yang boleh mereka baca.
-- ============================================================================

DO $$
DECLARE
  nama_tabel text;
  daftar text[] := ARRAY[
    'activity_logs',   -- app/admin/audit-logs/page.tsx
    'chats',           -- app/cashier/page.tsx
    'orders',          -- cashier, app/orders, app/profil, BuyerHeaderActions
    'products',        -- cashier, lib/hooks/useProducts.ts
    'promotions',      -- app/admin/promotions/page.tsx
    'returns',         -- app/admin/returns/page.tsx
    'stockSyncLogs',   -- lib/hooks/useStockSync.ts
    'stock_logs',      -- app/admin/layout.tsx
    'suppliers',       -- app/admin/purchases/add + edit/[id]
    'users',           -- app/profil, app/profil/edit, BuyerHeaderActions
    'warehouseStock',  -- lib/stockSyncService.ts
    'warehouses'       -- admin/products, admin/products/add, purchases/add, purchases/edit
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'Publication supabase_realtime tidak ditemukan. '
                 'Aktifkan Realtime untuk proyek ini dulu di Dashboard Supabase.';
    RETURN;
  END IF;

  FOREACH nama_tabel IN ARRAY daftar LOOP
    -- Lewati tabel yang belum ada di remote.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = nama_tabel
    ) THEN
      RAISE NOTICE 'Dilewati (tabel belum ada): %', nama_tabel;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = nama_tabel
    ) THEN
      RAISE NOTICE 'Sudah terdaftar, dilewati: %', nama_tabel;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', nama_tabel);
    RAISE NOTICE 'Ditambahkan ke supabase_realtime: %', nama_tabel;
  END LOOP;
END $$;

-- Verifikasi setelah dijalankan:
--   SELECT tablename FROM pg_publication_tables
--   WHERE pubname = 'supabase_realtime' ORDER BY tablename;
-- Atau dari repo:
--   node scripts/audit-realtime-coverage.mjs
