'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { sbDeleteDoc, sbGetDoc, sbGetDocs, sbInsertDoc, sbUpdateDoc, sbUpsertDoc } from '@/lib/supabase-helpers';
import { authorize } from '@/lib/actions/guard';
import { resolveAccessToken } from '@/lib/actions/session';
import { isAdminRole } from '@/lib/auth-helpers';
import { increment, INCREMENT_MARKER } from '@/lib/firebase';

/**
 * Lapisan data untuk modul HR/payroll (`admin/employees`).
 *
 * KENAPA ADA
 * Halaman `admin/employees` mengakses basis data langsung dari browser
 * lewat `sbGetDocs` dan bridge `@/lib/firebase`. Di browser, `supabaseAdmin`
 * jatuh ke kunci anon tanpa sesi pengguna sehingga RLS menolaknya — itulah
 * sebabnya halaman tersebut selalu tampak kosong.
 *
 * Modul ini memindahkan seluruh akses itu ke server, tempat kunci service
 * role benar-benar tersedia, dan memeriksa identitas pemanggil terlebih
 * dahulu (lihat `assertHrAccess`).
 *
 * KENAPA GENERIK
 * Halaman itu punya ~39 titik akses data di dalam 2871 baris. Agar perubahan
 * di sisi halaman sekecil mungkin (hanya menukar berkas impor), fungsi di
 * sini dibuat generik dengan bentuk yang sama seperti helper lama. Batas
 * keamanannya bukan pada bentuk fungsi, melainkan pada:
 *   1. setiap fungsi memverifikasi token + peran lebih dulu, dan
 *   2. `HR_TABLES` membatasi tabel mana yang boleh disentuh.
 *
 * Tanpa daftar tabel itu, fungsi generik semacam ini akan menjadi pintu
 * belakang untuk mengubah tabel apa pun memakai kunci service role.
 */

/** Tabel yang boleh diakses modul HR. Selain ini ditolak. */
const HR_TABLES = new Set([
  // Inti HR
  'employees',
  'attendance_records',
  'payroll_slips',
  'payroll_settings',
  'payroll_runs',
  'payroll_adjustments',
  'leave_requests',
  'shift_templates',
  'shift_assignments',
  // Kesejahteraan & penilaian
  'employee_loans',
  'employee_reimbursements',
  'employee_petty_cash',
  'employee_petty_cash_transactions',
  'kpi_scores',
  'candidates',
  // Ikut ditulis halaman ini untuk pembukuan absensi/petty cash
  'operational_expenses',
  'audit_logs',
]);

/** Peran yang boleh memakai modul HR: admin/owner, plus HR dan supervisor. */
const HR_ROLES = ['hr', 'supervisor', 'super_admin', 'super-admin'];

export type HrFailure = { ok: false; error: string };
export type HrSuccess<T> = { ok: true; data: T };
export type HrResult<T> = HrSuccess<T> | HrFailure;

/**
 * Verifikasi pemanggil dan batasi tabelnya.
 * Melempar bila tidak berhak, sehingga aksi menolak secara aman (fail-closed).
 */
async function assertHrAccess(table: string): Promise<void> {
  if (!HR_TABLES.has(table)) {
    throw new Error(`Tabel "${table}" tidak termasuk cakupan modul HR.`);
  }

  const token = await resolveAccessToken();
  const result = await authorize(token, 'staff');
  if (!result.ok) {
    throw new Error(result.message);
  }

  const role = (result.identity.role || '').trim().toLowerCase();
  if (!isAdminRole(role) && !HR_ROLES.includes(role)) {
    throw new Error('Akun Anda tidak memiliki izin untuk data kepegawaian.');
  }
}

export interface HrDocSnapshot<T = Record<string, unknown>> {
  id: string;
  exists: boolean;
  data: T;
}

export interface HrQuerySnapshot<T = Record<string, unknown>> {
  docs: HrDocSnapshot<T>[];
  empty: boolean;
  size: number;
}

export interface HrQueryParams {
  table: string;
  where?: Array<{ field: string; op: string; val: unknown }>;
  orderBy?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
  limit?: number;
}

/** Baca banyak baris. Mengembalikan data polos agar bisa dikirim ke klien. */
export async function hrFetchDocs<T = Record<string, unknown>>(
  params: HrQueryParams
): Promise<HrQuerySnapshot<T>> {
  await assertHrAccess(params.table);

  const snapshot = await sbGetDocs({
    table: params.table,
    where: params.where as never,
    orderBy: params.orderBy as never,
    limit: params.limit,
  });

  const docs = snapshot.docs.map((doc) => ({
    id: doc.id,
    exists: doc.exists(),
    data: doc.data() as T,
  }));

  return { docs, empty: docs.length === 0, size: docs.length };
}

/** Baca satu baris berdasarkan id. */
export async function hrFetchDoc<T = Record<string, unknown>>(
  table: string,
  id: string
): Promise<HrDocSnapshot<T>> {
  await assertHrAccess(table);

  const doc = await sbGetDoc(table, id);
  return { id: doc.id, exists: doc.exists(), data: doc.data() as T };
}

/**
 * Ubah penanda `{ __increment: n }` menjadi penanda increment milik bridge.
 *
 * Symbol tidak dapat menyeberangi batas Server Action, jadi sisi klien
 * mengirim objek biasa dan diterjemahkan di sini.
 */
function reviveIncrements(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && '__increment' in (value as Record<string, unknown>)) {
      const delta = Number((value as Record<string, unknown>).__increment);
      const marker = increment(delta) as Record<symbol, unknown>;
      // Pertahankan penanda asli agar dikenali `buildWritePayload`.
      Object.defineProperty(marker, INCREMENT_MARKER, { value: true, enumerable: false });
      out[key] = marker;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function hrInsert(
  table: string,
  data: Record<string, unknown>
): Promise<{ id: string }> {
  await assertHrAccess(table);
  return sbInsertDoc(table, data);
}

export async function hrUpdate(
  table: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  await assertHrAccess(table);
  await sbUpdateDoc(table, id, reviveIncrements(data));
}

export async function hrUpsert(
  table: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  await assertHrAccess(table);
  await sbUpsertDoc(table, id, data);
}

export async function hrDelete(table: string, id: string): Promise<void> {
  await assertHrAccess(table);
  await sbDeleteDoc(table, id);
}

/** Dipakai `setDoc` pada shim klien; setara upsert/merge. */
export async function hrSetDoc(
  table: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  await assertHrAccess(table);
  await sbUpsertDoc(table, id, data);
}

/**
 * Jumlah karyawan beserta jumlah baris tiap tabel HR.
 * Berguna untuk memastikan migrasi 20261003 sudah diterapkan.
 */
export async function hrSchemaStatus(): Promise<HrResult<Record<string, number>>> {
  const token = await resolveAccessToken();
  const result = await authorize(token, 'staff');
  if (!result.ok) return { ok: false, error: result.message };

  const counts: Record<string, number> = {};
  for (const table of ['employees', 'payroll_runs', 'leave_requests', 'shift_templates']) {
    const res = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true });
    counts[table] = res.error ? -1 : (res.count ?? 0);
  }
  return { ok: true, data: counts };
}
