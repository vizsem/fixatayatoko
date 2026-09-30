-- =============================================================================
-- 20261003_hr_payroll_tables.sql
-- Melengkapi tabel yang dibutuhkan modul HR/payroll (`admin/employees`).
--
-- LATAR BELAKANG (temuan 2026-10-01)
--
-- `src/app/admin/employees/page.tsx` (8 tab: STAFF, SHIFT, ABSENSI, PAYROLL,
-- CUTI, KPI, REKRUTMEN, PETTY_CASH) merujuk 12 tabel yang TIDAK ADA di basis
-- data. Setiap query-nya gagal dan galatnya ditelan `try/catch`, sehingga
-- halaman tampak kosong tanpa pesan error apa pun.
--
-- Ditemukan juga dua masalah yang lebih dalam:
--
--   * `employees`, `attendance_records`, dan `payroll_slips` SUDAH ada, tetapi
--     hanya punya kolom `id`, `raw_data`, `created_at`, `updated_at` — seluruh
--     isinya berada di `raw_data`. Ketiganya juga belum terdaftar sebagai tabel
--     ber-`raw_data` di `src/lib/db-schema.ts`, sehingga `buildWritePayload`
--     tidak menuliskan `raw_data` sama sekali dan penyimpanan karyawan
--     kehilangan datanya. Itu diperbaiki di sisi kode, bukan di migrasi ini.
--
--   * Halaman itu membaca data lewat `sbGetDocs` yang memakai `supabaseAdmin`.
--     Di browser klien tersebut jatuh ke kunci anon tanpa sesi pengguna,
--     sehingga RLS menolaknya dan hasilnya kosong. Perbaikannya adalah
--     memindahkan akses data halaman ke Server Action, bukan membuka RLS
--     untuk `anon` — data HR/payroll tidak boleh dibaca publik.
--
-- Karena itu migrasi ini membuat tabel dengan RLS AKTIF dan TANPA policy:
-- hanya `service_role` (dipakai Server Action di server) yang dapat
-- mengaksesnya. Pola `raw_data` sengaja dipertahankan agar cocok dengan bentuk
-- data yang sudah ada dan dengan `normalizeRow` di `supabase-helpers`.
--
-- Semua pernyataan IDEMPOTEN dan tidak ada data yang dihapus.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- A. Tabel baru
--
-- Bentuk seragam: id TEXT (kode memakai id buatan sendiri seperti
-- '2026-10_<employeeId>'), raw_data JSONB, created_at, updated_at.
-- `created_at` dan `updated_at` WAJIB ada karena `buildWritePayload` selalu
-- menuliskan keduanya pada setiap insert/update.
-- -----------------------------------------------------------------------------

-- Pengaturan payroll global. Diakses dengan id 'default'.
CREATE TABLE IF NOT EXISTS public.payroll_settings (
  id         TEXT PRIMARY KEY,
  raw_data   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Satu baris per periode payroll. Id-nya adalah bulan, mis. '2026-10'.
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id         TEXT PRIMARY KEY,
  raw_data   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Penyesuaian manual per karyawan per bulan. Id: '<bulan>_<employeeId>'.
CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
  id         TEXT PRIMARY KEY,
  raw_data   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pengajuan cuti/izin/sakit.
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id         TEXT PRIMARY KEY,
  raw_data   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Template jam kerja (mis. Shift Pagi 07:00-14:00) beserta aturan lembur.
CREATE TABLE IF NOT EXISTS public.shift_templates (
  id         TEXT PRIMARY KEY,
  raw_data   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Penugasan shift ke karyawan pada tanggal tertentu.
CREATE TABLE IF NOT EXISTS public.shift_assignments (
  id         TEXT PRIMARY KEY,
  raw_data   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pinjaman karyawan beserta sisa dan cicilan bulanannya.
CREATE TABLE IF NOT EXISTS public.employee_loans (
  id         TEXT PRIMARY KEY,
  raw_data   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Penggantian biaya (reimbursement) yang diajukan karyawan.
CREATE TABLE IF NOT EXISTS public.employee_reimbursements (
  id         TEXT PRIMARY KEY,
  raw_data   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Saldo kas kecil per karyawan. Id-nya adalah employeeId.
CREATE TABLE IF NOT EXISTS public.employee_petty_cash (
  id         TEXT PRIMARY KEY,
  raw_data   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Mutasi kas kecil (TOPUP / SPEND / REIMBURSE).
CREATE TABLE IF NOT EXISTS public.employee_petty_cash_transactions (
  id         TEXT PRIMARY KEY,
  raw_data   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Nilai KPI per karyawan per bulan, beserta bonusnya.
CREATE TABLE IF NOT EXISTS public.kpi_scores (
  id         TEXT PRIMARY KEY,
  raw_data   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pelamar kerja dan tahapan rekrutmennya.
CREATE TABLE IF NOT EXISTS public.candidates (
  id         TEXT PRIMARY KEY,
  raw_data   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- B. Tabel HR yang SUDAH ada di remote tetapi belum pernah dibuat oleh migrasi
--
-- Ketiganya nyata di basis data produksi (bentuknya persis `id`, `raw_data`,
-- `created_at`, `updated_at`) tetapi tidak ada satu pun berkas migrasi yang
-- membuatnya. Akibatnya skema tidak dapat direproduksi dari nol, dan
-- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` di bagian D gagal pada basis data
-- baru. Pernyataan di bawah hanya bekerja pada basis data baru; pada basis data
-- yang sudah berisi tabel ini, `IF NOT EXISTS` membuatnya dilewati.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
  id         TEXT PRIMARY KEY,
  raw_data   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id         TEXT PRIMARY KEY,
  raw_data   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payroll_slips (
  id         TEXT PRIMARY KEY,
  raw_data   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- C. Indeks untuk kolom yang sering dipakai sebagai filter.
--
-- Karena data berada di `raw_data`, indeks dibuat atas ekspresi JSON.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_leave_requests_start        ON public.leave_requests ((raw_data->>'startDate'));
CREATE INDEX IF NOT EXISTS idx_leave_requests_end          ON public.leave_requests ((raw_data->>'endDate'));
CREATE INDEX IF NOT EXISTS idx_leave_requests_status       ON public.leave_requests ((raw_data->>'status'));
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee     ON public.leave_requests ((raw_data->>'employeeId'));

CREATE INDEX IF NOT EXISTS idx_shift_assignments_date      ON public.shift_assignments ((raw_data->>'date'));
CREATE INDEX IF NOT EXISTS idx_shift_assignments_employee  ON public.shift_assignments ((raw_data->>'employeeId'));

CREATE INDEX IF NOT EXISTS idx_reimbursements_date         ON public.employee_reimbursements ((raw_data->>'date'));
CREATE INDEX IF NOT EXISTS idx_reimbursements_status       ON public.employee_reimbursements ((raw_data->>'status'));
CREATE INDEX IF NOT EXISTS idx_reimbursements_employee     ON public.employee_reimbursements ((raw_data->>'employeeId'));

CREATE INDEX IF NOT EXISTS idx_petty_cash_tx_date          ON public.employee_petty_cash_transactions ((raw_data->>'date'));
CREATE INDEX IF NOT EXISTS idx_petty_cash_tx_employee      ON public.employee_petty_cash_transactions ((raw_data->>'employeeId'));

CREATE INDEX IF NOT EXISTS idx_kpi_scores_month            ON public.kpi_scores ((raw_data->>'month'));
CREATE INDEX IF NOT EXISTS idx_kpi_scores_employee         ON public.kpi_scores ((raw_data->>'employeeId'));

CREATE INDEX IF NOT EXISTS idx_employee_loans_employee     ON public.employee_loans ((raw_data->>'employeeId'));
CREATE INDEX IF NOT EXISTS idx_employee_loans_status       ON public.employee_loans ((raw_data->>'status'));

CREATE INDEX IF NOT EXISTS idx_candidates_stage            ON public.candidates ((raw_data->>'stage'));

-- -----------------------------------------------------------------------------
-- D. Row Level Security
--
-- RLS diaktifkan TANPA policy: hanya `service_role` yang dapat mengakses.
-- Akses dari halaman admin dilakukan lewat Server Action di server, sehingga
-- tidak ada kebutuhan membuka tabel ini untuk `anon` atau `authenticated`.
-- -----------------------------------------------------------------------------
ALTER TABLE public.payroll_settings                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_adjustments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_templates                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_assignments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_loans                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_reimbursements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_petty_cash              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_petty_cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_scores                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates                       ENABLE ROW LEVEL SECURITY;

-- Tabel HR yang sudah ada sebelumnya juga dipastikan terkunci.
ALTER TABLE public.employees            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_slips        ENABLE ROW LEVEL SECURITY;

COMMIT;

-- =============================================================================
-- VERIFIKASI SETELAH MENJALANKAN
-- =============================================================================
-- 1) Kedua belas tabel sudah ada (harus 12 baris):
--      SELECT table_name FROM information_schema.tables
--      WHERE table_schema = 'public'
--        AND table_name IN (
--          'payroll_settings','payroll_runs','payroll_adjustments','leave_requests',
--          'shift_templates','shift_assignments','employee_loans',
--          'employee_reimbursements','employee_petty_cash',
--          'employee_petty_cash_transactions','kpi_scores','candidates')
--      ORDER BY table_name;
--
-- 2) RLS aktif di semuanya (harus true semua):
--      SELECT relname, relrowsecurity FROM pg_class
--      WHERE relname IN ('employees','attendance_records','payroll_slips',
--        'payroll_settings','payroll_runs','payroll_adjustments','leave_requests',
--        'shift_templates','shift_assignments','employee_loans',
--        'employee_reimbursements','employee_petty_cash',
--        'employee_petty_cash_transactions','kpi_scores','candidates')
--      ORDER BY relname;
--
-- 3) Uji tulis lewat jalur aplikasi (bukan SQL):
--      buka /admin/employees, tambah satu karyawan, lalu pastikan barisnya
--      muncul kembali setelah halaman dimuat ulang.
-- =============================================================================
