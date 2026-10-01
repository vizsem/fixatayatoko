-- ============================================================================
-- 20261007_messages_carts_tables.sql
--
-- TUJUAN
-- Membuat dua tabel yang sudah lama dirujuk kode tetapi tidak pernah ada di
-- database, sehingga fitur terkait gagal:
--   * `messages` — daftar pesan chat. 4 komponen (AdminChatInterface,
--     CustomerChat, CustomerChatWidget, admin/messages) membaca/menulis ke
--     tabel ini lewat bridge. Tanpa tabel ini: HTTP 404, daftar pesan tidak
--     pernah termuat, dan `addDoc` pesan gagal.
--   * `carts` — keranjang tersimpan per pengguna. Dirujuk `CartContext`,
--     `cart/page.tsx`, `ProductDetailClient.tsx`, dan `api/orders/create`.
--     Tanpa tabel ini: HTTP 400 dan keranjang tidak tersimpan.
--
-- BUKTI MASALAH (hasil uji langsung ke proyek cnxuzqlcmosymcwcraoa)
--   - GET /rest/v1/messages -> 404 (PGRST205: tabel tidak ada)
--   - GET /rest/v1/carts    -> 400
--   - Namun keduanya SUDAH direncanakan:
--       * `prisma/schema.prisma` mendefinisikan model `Cart` (@@map("carts"))
--         dengan kolom `user_id` (unique) dan `items` (Json).
--       * `supabase/migrations/20261004_rls_staff_policies.sql` sudah
--         mencantumkan 'carts' di daftar `staff_tables`.
--     Jadi tabelnya memang tertinggal, bukan sengaja dihapus.
--
-- BENTUK `messages` — kenapa ada `chat_id`
--   Kode memanggil `collection(db, 'chats', chatId, 'messages')`. Bridge
--   memetakan subcollection ke SEGMEN TERAKHIR saja, sehingga tanpa kolom
--   penaut, pesan dari semua percakapan akan tercampur jadi satu. `chat_id`
--   ditambahkan sebagai penaut, dan bridge (src/lib/firebase.ts) diubah untuk
--   ikut menyertakan/menyaring kolom ini.
--
-- BENTUK `carts` — mendukung DUA jalur tulis yang sudah ada
--   1. `CartContext`  : upsert { user_id, items, updated_at } dengan
--                       onConflict 'user_id'  -> butuh `id` punya DEFAULT.
--   2. `sbUpsertDoc`  : upsert dengan `id = userId` -> butuh `user_id` ikut
--                       terisi (lihat `extractTableColumns` di db-schema.ts).
--   Agar keduanya menghasilkan baris yang sama, `id` dan `user_id` sengaja
--   dibuat sama oleh pemanggil, dan `user_id` diberi UNIQUE sebagai penjaga.
--
-- CATATAN
--   - Idempoten: aman dijalankan berulang.
--   - `messages` ikut didaftarkan ke publication `supabase_realtime` karena
--     keempat komponen chat berlangganan `postgres_changes` ke tabel itu.
--     `carts` TIDAK didaftarkan: tidak ada yang berlangganan.
--   - TIDAK ada langganan ber-filter kolom non-primary key pada `messages`,
--     jadi REPLICA IDENTITY FULL belum diperlukan.
-- ============================================================================

-- ============================================================================
-- 1. TABEL
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.carts (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    text NOT NULL,
  items      jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Bridge (buildWritePayload) menulis payload asli ke raw_data untuk tabel
  -- yang terdaftar di TABLES_WITH_RAW_DATA. Kolom ini disediakan agar jalur
  -- `sbUpsertDoc('carts', ...)` tidak kehilangan data.
  raw_data   jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Satu keranjang per pengguna. Ini juga target `onConflict: 'user_id'`.
CREATE UNIQUE INDEX IF NOT EXISTS carts_user_id_key ON public.carts (user_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  -- Percakapan induk. Diisi oleh bridge dari path subcollection Firestore.
  chat_id    text NOT NULL,
  text       text NOT NULL DEFAULT '',
  sender_id  text,
  type       text NOT NULL DEFAULT 'text',
  image_url  text,
  is_read    boolean NOT NULL DEFAULT false,
  raw_data   jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Semua pembacaan pesan selalu per percakapan, diurutkan waktu.
CREATE INDEX IF NOT EXISTS messages_chat_created_idx
  ON public.messages (chat_id, created_at);

-- ============================================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.carts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Staf & admin: penuh (pola yang sama dengan tabel operasional lain).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['carts', 'messages']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'app_staff_manage'
    ) THEN
      EXECUTE format(
        'CREATE POLICY app_staff_manage ON public.%I FOR ALL '
        'USING (public.current_app_role() = ANY (ARRAY[''admin'',''superadmin'',''super_admin'',''owner'',''super-admin'',''cashier'',''kasir'',''staff'',''warehouse'',''employee'',''sales'',''driver''])) '
        'WITH CHECK (public.current_app_role() = ANY (ARRAY[''admin'',''superadmin'',''super_admin'',''owner'',''super-admin'',''cashier'',''kasir'',''staff'',''warehouse'',''employee'',''sales'',''driver'']))',
        t);
    END IF;
  END LOOP;
END $$;

-- Pelanggan: hanya baris miliknya sendiri.
-- carts  -> user_id harus sama dengan uid pemanggil.
-- messages -> percakapan (chats.raw_data.userId) harus milik pemanggil.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'carts' AND policyname = 'cart_owner_manage'
  ) THEN
    CREATE POLICY cart_owner_manage ON public.carts FOR ALL
      USING (user_id = auth.uid()::text)
      WITH CHECK (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'message_owner_manage'
  ) THEN
    CREATE POLICY message_owner_manage ON public.messages FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.chats c
          WHERE c.id = messages.chat_id
            AND (c.raw_data->>'userId') = auth.uid()::text
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.chats c
          WHERE c.id = messages.chat_id
            AND (c.raw_data->>'userId') = auth.uid()::text
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 3. GRANT
-- ============================================================================
-- Migrasi 20261001 hanya memberi grant pada tabel yang ada SAAT ITU. Tabel baru
-- perlu grant sendiri. `anon` sengaja TIDAK diberi apa pun: pesan chat dan
-- keranjang bukan data publik.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carts    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.carts    TO service_role;
GRANT ALL ON public.messages TO service_role;

-- ============================================================================
-- 4. REALTIME
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    RAISE NOTICE 'Ditambahkan ke supabase_realtime: messages';
  END IF;
END $$;

-- Verifikasi setelah dijalankan:
--   SELECT tablename FROM pg_publication_tables
--   WHERE pubname = 'supabase_realtime' AND tablename IN ('messages','carts');
-- Atau dari repo: npm run audit:realtime
