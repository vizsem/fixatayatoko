-- ============================================================================
-- 20261008_chat_owner_policy.sql
--
-- TUJUAN
-- Memberi pelanggan akses ke percakapan chat MILIKNYA SENDIRI.
--
-- BUKTI MASALAH
--   `chats` terdaftar di `staff_tables` (20261004) sehingga hanya staf/admin
--   yang punya policy. Akibatnya komponen chat pelanggan
--   (CustomerChat, CustomerChatWidget) tidak bisa membaca percakapannya
--   sendiri maupun memperbarui metadata-nya: `sbGetDoc('chats', id)` selalu
--   kosong dan `sbUpsertDoc('chats', ...)` selalu ditolak.
--
--   Tabel `messages` sudah punya `message_owner_manage` (20261007) dengan
--   syarat yang sama, jadi policy ini melengkapinya: pemilik percakapan boleh
--   mengakses thread-nya DAN pesan di dalamnya.
--
-- PEMILIK DITENTUKAN DARI MANA
--   `chats.raw_data->>'userId'`. Kolom itu yang dipakai aplikasi sejak awal
--   (lihat contoh baris di tabel chats) dan sudah dipakai policy
--   `message_owner_manage` di migrasi 20261007.
--
-- CATATAN
--   - Idempoten.
--   - Policy ini bersifat MENAMBAH. `app_staff_manage` tetap berlaku, jadi
--     staf/admin tidak kehilangan akses.
--   - `anon` tetap tidak mendapat akses: `auth.uid()` bernilai NULL tanpa sesi.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chats' AND policyname = 'chat_owner_manage'
  ) THEN
    CREATE POLICY chat_owner_manage ON public.chats FOR ALL
      USING ((raw_data->>'userId') = auth.uid()::text)
      WITH CHECK ((raw_data->>'userId') = auth.uid()::text);
    RAISE NOTICE 'Policy chat_owner_manage ditambahkan pada public.chats';
  ELSE
    RAISE NOTICE 'Policy chat_owner_manage sudah ada, dilewati';
  END IF;
END $$;

-- Verifikasi:
--   SELECT policyname FROM pg_policies
--   WHERE schemaname='public' AND tablename='chats' ORDER BY policyname;
