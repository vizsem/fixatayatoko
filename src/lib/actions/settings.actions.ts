'use server';

import { revalidatePath } from 'next/cache';

import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin, requireStaff } from '@/lib/actions/session';
import { describeDatabaseError } from '@/lib/actions/guard';
import {
  sbDeleteDoc,
  sbGetDoc,
  sbGetDocs,
  sbInsertDoc,
  sbUpdateDoc,
  sbUpsertDoc,
} from '@/lib/supabase-helpers';

/**
 * Aksi server untuk halaman pengaturan (`admin/settings`).
 *
 * Halaman itu sebelumnya membaca dan menulis `settings`, `categories`,
 * `employees`, `banners`, dan `warehouses` langsung dari browser. Di browser
 * klien tersebut jatuh ke kunci anon tanpa sesi pengguna, sehingga RLS
 * menolaknya dan seluruh halaman gagal memuat data.
 *
 * Ada DUA daftar izin yang terpisah dan sengaja dibedakan:
 *
 *   - `SETTINGS_TABLES` untuk keperluan halaman ini sehari-hari (staf).
 *   - `BACKUP_TABLES` untuk fitur ekspor/impor yang memang menyentuh tabel
 *     lebih luas, dan hanya boleh dijalankan admin.
 *
 * Pemisahan ini penting: fitur impor MENGHAPUS seluruh isi sebuah tabel
 * sebelum menulis ulang, jadi tidak boleh berada dalam jangkauan staf biasa.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Tabel yang boleh disentuh operasi harian halaman pengaturan. */
const SETTINGS_TABLES = new Set([
  'settings',
  'categories',
  'employees',
  'banners',
  'warehouses',
]);

/** Tabel yang boleh diekspor/diimpor oleh fitur backup. Hanya admin. */
const BACKUP_TABLES = new Set([
  'products',
  'orders',
  'customers',
  'suppliers',
  'categories',
  'employees',
  'banners',
  'settings',
  'warehouses',
  'inventory_logs',
]);

function assertSettingsTable(table: string): void {
  if (!SETTINGS_TABLES.has(table)) {
    throw new Error(`Tabel "${table}" tidak termasuk pengaturan.`);
  }
}

function assertBackupTable(table: string): void {
  if (!BACKUP_TABLES.has(table)) {
    throw new Error(`Tabel "${table}" tidak termasuk daftar backup.`);
  }
}

const SETTINGS_DOC_IDS = new Set(['system', 'points']);

function assertSettingsDocId(id: string): void {
  if (!SETTINGS_DOC_IDS.has(id)) {
    throw new Error(`Dokumen pengaturan "${id}" tidak dikenal.`);
  }
}

// ---------------------------------------------------------------------------
// Pembacaan
// ---------------------------------------------------------------------------

export async function getSettingsDoc(
  id: string
): Promise<ActionResult<Record<string, unknown> | null>> {
  await requireStaff();
  try {
    assertSettingsDocId(id);
    const doc = await sbGetDoc('settings', id);
    return { ok: true, data: doc.exists() ? doc.data() : null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal memuat pengaturan' };
  }
}

export async function listTable(table: string): Promise<ActionResult<Record<string, unknown>[]>> {
  await requireStaff();
  try {
    assertSettingsTable(table);
    const snapshot = await sbGetDocs({ table });
    // `id` disertakan supaya bentuknya sama seperti `docs.map(d => ({id, ...d.data()}))`
    // yang dipakai halaman sebelumnya.
    return { ok: true, data: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal memuat data' };
  }
}

export type SettingsPageData = {
  system: Record<string, unknown> | null;
  points: Record<string, unknown> | null;
  categories: Record<string, unknown>[];
  employees: Record<string, unknown>[];
  banners: Record<string, unknown>[];
  warehouses: Record<string, unknown>[];
};

/**
 * Seluruh data yang dibutuhkan halaman pengaturan, dalam SATU panggilan.
 *
 * MENGAPA DIGABUNG (performa)
 * ---------------------------
 * Sebelumnya halaman memanggil enam Server Action sekaligus
 * (`getSettingsDoc` ×2 + `listTable` ×4). Setiap Server Action adalah satu
 * permintaan POST tersendiri DAN memverifikasi token ke Supabase sekali lagi
 * (`requireStaff` -> `authorize` -> `auth.getUser`). Jadi satu kali buka
 * halaman = 6 respons jaringan ke aplikasi + 6 verifikasi token + 6 kueri role.
 *
 * Dengan digabung: 1 permintaan, 1 verifikasi token, lalu kueri-kueri kecilnya
 * dijalankan paralel di server (jaringan server -> Supabase jauh lebih cepat
 * daripada peramban -> server -> Supabase).
 */
export async function getSettingsPageData(): Promise<ActionResult<SettingsPageData>> {
  await requireStaff();
  try {
    const [system, points, categories, employees, banners, warehouses] = await Promise.all([
      sbGetDoc('settings', 'system'),
      sbGetDoc('settings', 'points'),
      sbGetDocs({ table: 'categories' }),
      sbGetDocs({ table: 'employees' }),
      sbGetDocs({ table: 'banners' }),
      sbGetDocs({ table: 'warehouses' }),
    ]);

    const baris = (snapshot: { docs: Array<{ id: string; data: () => unknown }> }) =>
      snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }));

    return {
      ok: true,
      data: {
        system: system.exists() ? (system.data() as Record<string, unknown>) : null,
        points: points.exists() ? (points.data() as Record<string, unknown>) : null,
        categories: baris(categories),
        employees: baris(employees),
        banners: baris(banners),
        warehouses: baris(warehouses),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Gagal memuat data pengaturan',
    };
  }
}

// ---------------------------------------------------------------------------
// Penulisan
// ---------------------------------------------------------------------------

export async function saveSettingsDoc(
  id: string,
  data: Record<string, unknown>
): Promise<ActionResult> {
  await requireAdmin();
  try {
    assertSettingsDocId(id);
    await sbUpsertDoc('settings', id, { ...data, updatedAt: new Date().toISOString() });
    revalidatePath('/admin/settings');
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: describeDatabaseError(error).message };
  }
}

export async function createInTable(
  table: string,
  data: Record<string, unknown>
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  try {
    assertSettingsTable(table);
    const result = await sbInsertDoc(table, data);
    revalidatePath('/admin/settings');
    return { ok: true, data: { id: result.id } };
  } catch (error) {
    return { ok: false, error: describeDatabaseError(error).message };
  }
}

export async function updateInTable(
  table: string,
  id: string,
  patch: Record<string, unknown>
): Promise<ActionResult> {
  await requireAdmin();
  try {
    assertSettingsTable(table);
    await sbUpdateDoc(table, id, patch);
    revalidatePath('/admin/settings');
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: describeDatabaseError(error).message };
  }
}

export async function deleteFromTable(table: string, id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    assertSettingsTable(table);
    await sbDeleteDoc(table, id);
    revalidatePath('/admin/settings');
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: describeDatabaseError(error).message };
  }
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

/** Nama tabel yang boleh diekspor/diimpor, agar UI dan server sepakat. */
export async function getBackupTableNames(): Promise<ActionResult<string[]>> {
  await requireStaff();
  return { ok: true, data: [...BACKUP_TABLES] };
}

/**
 * Ambil seluruh isi tabel backup dalam satu panggilan.
 *
 * Dijalankan di server karena halaman sebelumnya membaca tabel-tabel itu satu
 * per satu dari browser (dan gagal karena RLS). Fitur ekspor memang perlu
 * membaca banyak tabel, jadi jangkauannya dibatasi `BACKUP_TABLES` dan
 * hanya untuk admin.
 */
export async function getBackupData(): Promise<
  ActionResult<Record<string, Record<string, unknown>[]>>
> {
  await requireAdmin();

  const result: Record<string, Record<string, unknown>[]> = {};
  for (const table of BACKUP_TABLES) {
    if (table === 'settings') {
      const rows: Record<string, unknown>[] = [];
      for (const id of SETTINGS_DOC_IDS) {
        const doc = await sbGetDoc('settings', id);
        if (doc.exists()) rows.push({ id, ...doc.data() });
      }
      result[table] = rows;
      continue;
    }

    const snapshot = await sbGetDocs({ table });
    result[table] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  return { ok: true, data: result };
}

/**
 * Tulis data hasil impor ke sebuah tabel.
 *
 * DESTRUKTIF pada mode `replace`: baris lama dihapus lebih dulu. Karena itu
 * hanya admin yang boleh memanggilnya.
 *
 * Mode `merge` hanya menimpa baris dengan id yang sama dan membiarkan baris
 * lain utuh. Ini penting untuk `settings`: impor lama hanya melakukan upsert,
 * sehingga menghapus lebih dulu akan membuang dokumen pengaturan yang tidak
 * ada di berkas backup.
 */
export async function replaceTableContents(
  table: string,
  rows: Record<string, unknown>[],
  mode: 'replace' | 'merge' = 'replace'
): Promise<ActionResult<{ written: number }>> {
  await requireAdmin();

  try {
    assertBackupTable(table);
    if (!Array.isArray(rows)) {
      return { ok: false, error: 'Data impor tidak valid.' };
    }

    if (mode === 'replace') {
      const existing = await sbGetDocs({ table, limit: 100000 });
      for (const doc of existing.docs) {
        await sbDeleteDoc(table, doc.id);
      }
    }

    let written = 0;
    for (const row of rows) {
      const { id, ...rest } = row as Record<string, unknown> & { id?: unknown };
      const rowId = typeof id === 'string' && id ? id : undefined;
      if (rowId) {
        await sbUpsertDoc(table, rowId, rest);
      } else {
        await sbInsertDoc(table, rest);
      }
      written += 1;
    }

    revalidatePath('/admin/settings');
    return { ok: true, data: { written } };
  } catch (error) {
    return { ok: false, error: describeDatabaseError(error).message };
  }
}

/** Hapus satu tabel backup (dipakai impor untuk tabel yang isinya diganti). */
export async function clearTable(table: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    assertBackupTable(table);
    const existing = await sbGetDocs({ table, limit: 100000 });
    for (const doc of existing.docs) {
      await sbDeleteDoc(table, doc.id);
    }
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: describeDatabaseError(error).message };
  }
}

/** Dipakai halaman untuk memastikan koneksi service role hidup. */
export async function pingSettingsBackend(): Promise<boolean> {
  await requireStaff();
  const { error } = await supabaseAdmin.from('settings').select('id').limit(1);
  return !error;
}
