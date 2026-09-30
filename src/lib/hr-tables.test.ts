import { describe, it, expect } from 'vitest';
import { TABLES_WITH_RAW_DATA } from './db-schema';
import { buildWritePayload } from './supabase-helpers';

/**
 * Penjaga untuk modul HR/payroll.
 *
 * Seluruh tabel HR menyimpan datanya di kolom `raw_data` dan hanya punya
 * kolom `id`, `raw_data`, `created_at`, `updated_at`. `buildWritePayload`
 * hanya menuliskan `raw_data` bila tabelnya terdaftar di
 * `TABLES_WITH_RAW_DATA`.
 *
 * Sebelum tabel-tabel ini didaftarkan, MENYIMPAN KARYAWAN menghasilkan baris
 * berisi `id`/`created_at`/`updated_at` saja — seluruh isinya hilang tanpa
 * pesan error apa pun. Uji ini memastikan hal itu tidak terulang.
 */

const HR_TABLES = [
  'employees',
  'attendance_records',
  'payroll_slips',
  'payroll_settings',
  'payroll_runs',
  'payroll_adjustments',
  'leave_requests',
  'shift_templates',
  'shift_assignments',
  'employee_loans',
  'employee_reimbursements',
  'employee_petty_cash',
  'employee_petty_cash_transactions',
  'kpi_scores',
  'candidates',
] as const;

describe('tabel HR terdaftar sebagai tabel ber-raw_data', () => {
  it.each(HR_TABLES)('%s ada di TABLES_WITH_RAW_DATA', (table) => {
    expect(
      TABLES_WITH_RAW_DATA.has(table),
      `${table} tidak terdaftar. Tanpa pendaftaran ini, penyimpanan ke tabel ` +
        'tersebut tidak menuliskan raw_data dan seluruh datanya hilang.'
    ).toBe(true);
  });

  it.each(HR_TABLES)('buildWritePayload menyertakan raw_data untuk %s', (table) => {
    const payload = buildWritePayload(
      table,
      { catatanUji: 'nilai', employeeId: 'emp-1' },
      { isInsert: true }
    );

    expect(
      payload.raw_data,
      `payload untuk ${table} tidak memiliki raw_data`
    ).toBeTruthy();
    expect(payload.raw_data.catatanUji).toBe('nilai');
  });

  it('menyertakan id dan stempel waktu yang diwajibkan tabel', () => {
    const payload = buildWritePayload('employees', { name: 'Ani' }, { isInsert: true });
    // Ketiga kolom ini harus ada di setiap tabel HR, kalau tidak insert gagal.
    expect(payload.id).toBeTruthy();
    expect(payload.created_at).toBeTruthy();
    expect(payload.updated_at).toBeTruthy();
  });

  it('mempertahankan data lama saat memperbarui', () => {
    const payload = buildWritePayload(
      'employees',
      { name: 'Ani' },
      { isUpdate: true, existingRaw: { name: 'Ani Lama', npwp: '123' } }
    );

    expect(payload.raw_data.name).toBe('Ani');
    // Kunci yang tidak dikirim formulir tidak boleh hilang.
    expect(payload.raw_data.npwp).toBe('123');
  });

  it('tabel di luar daftar tidak ikut mendapat raw_data', () => {
    // Contoh pembanding: `users` memang TIDAK punya kolom raw_data, jadi
    // pendaftaran tabel HR tidak boleh melebar ke sana tanpa sengaja.
    expect(TABLES_WITH_RAW_DATA.has('users')).toBe(false);

    const payload = buildWritePayload('users', { full_name: 'Budi' }, { isInsert: true });
    expect(payload.raw_data).toBeUndefined();
  });
});
