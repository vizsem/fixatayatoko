'use server';

import { supabaseAdmin } from '@/lib/supabase';
import {
  authorize,
  describeDatabaseError,
  fail,
  succeed,
  type ActionResult,
} from '@/lib/actions/guard';
import {
  LEDGER_LIMIT,
  TOP_USER_LIMIT,
  normalizePointLog,
  normalizeWalletLog,
  pointDelta,
  summarizePointLogs,
  summarizeWalletLogs,
  validatePointAdjustment,
  validateWalletAdjustment,
  walletDelta,
  type LedgerSummary,
  type PointAdjustmentInput,
  type PointLedgerUser,
  type PointLog,
  type WalletAdjustmentInput,
  type WalletLedgerUser,
  type WalletLog,
} from '@/lib/loyalty';

/**
 * Server Action untuk `admin/points` dan `admin/wallet`.
 *
 * Sebelumnya kedua halaman membaca `users`, `point_logs`, dan `wallet_logs`
 * langsung dari browser memakai kunci anon, lalu menulis dengan pola
 * baca-lalu-tulis yang rawan kehilangan pembaruan (lost update). Sekarang:
 *
 *   - pembacaan memakai service role di server; klien hanya menerima hasilnya
 *   - penulisan memakai fungsi SQL atomik `adjust_user_points` /
 *     `adjust_user_wallet` sehingga perubahan saldo dan baris ledger selalu
 *     berada dalam satu transaksi
 *   - setiap action memverifikasi token akses Supabase + peran pengguna
 *     (lihat `src/lib/actions/guard.ts`)
 *
 * Sebelum migrasi `20261002_loyalty_wallet_hardening.sql` dijalankan, kolom
 * `users.points` belum ada. Dalam keadaan itu action pembacaan tetap berfungsi
 * (memakai `raw_data`) dan mengembalikan `schemaReady: false`, sementara action
 * penulisan menolak dengan pesan yang menjelaskan migrasi mana yang harus
 * dijalankan — bukan gagal secara senyap.
 */

const MIGRATION_HINT =
  'Fungsi/kolom baru belum ada. Jalankan supabase/migrations/20261002_loyalty_wallet_hardening.sql di Supabase SQL Editor.';

export interface PointsDashboard {
  logs: PointLog[];
  topUsers: PointLedgerUser[];
  stats: LedgerSummary;
  /**
   * `false` bila migrasi 20261002 belum dijalankan. UI memakainya untuk
   * menampilkan peringatan, bukan untuk menyembunyikan data.
   */
  schemaReady: boolean;
}

export interface WalletDashboard {
  logs: WalletLog[];
  topUsers: WalletLedgerUser[];
  stats: LedgerSummary;
  schemaReady: boolean;
}

function displayNameOf(id: string, fullName: unknown): string {
  const name = typeof fullName === 'string' ? fullName.trim() : '';
  return name || `Tanpa Nama (${id.slice(0, 8)})`;
}

// ---------------------------------------------------------------------------
// Pembacaan
// ---------------------------------------------------------------------------

async function loadPointUsers(): Promise<{ users: PointLedgerUser[]; ready: boolean }> {
  const withPoints = await supabaseAdmin
    .from('users')
    .select('id, full_name, points, is_points_frozen')
    .order('points', { ascending: false })
    .limit(TOP_USER_LIMIT);

  if (!withPoints.error) {
    return {
      ready: true,
      users: (withPoints.data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        displayName: displayNameOf(String(row.id), row.full_name),
        points: Number(row.points ?? 0),
        isPointsFrozen: Boolean(row.is_points_frozen),
      })),
    };
  }

  // Kolom `points` belum ada (migrasi belum dijalankan). Tetap tampilkan
  // daftar pengguna agar halaman tidak kosong seperti sebelumnya.
  const fallback = await supabaseAdmin
    .from('users')
    .select('id, full_name')
    .limit(TOP_USER_LIMIT);

  if (fallback.error) {
    throw new Error(`Gagal memuat daftar pengguna: ${fallback.error.message}`);
  }

  return {
    ready: false,
    users: (fallback.data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      displayName: displayNameOf(String(row.id), row.full_name),
      points: 0,
      isPointsFrozen: false,
    })),
  };
}

async function loadWalletUsers(): Promise<WalletLedgerUser[]> {
  // `wallet_balance` sudah ada sejak awal, jadi tidak perlu jalur cadangan.
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, full_name, wallet_balance')
    .order('wallet_balance', { ascending: false })
    .limit(TOP_USER_LIMIT);

  if (error) {
    throw new Error(`Gagal memuat daftar pengguna: ${error.message}`);
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    displayName: displayNameOf(String(row.id), row.full_name),
    walletBalance: Number(row.wallet_balance ?? 0),
  }));
}

/**
 * Ringkasan ledger.
 *
 * Memakai agregat SQL `ledger_totals()` supaya tidak perlu mengunduh seluruh
 * isi tabel. Bila fungsi itu belum ada (migrasi belum dijalankan), jumlahkan
 * di server dari seluruh baris — perilaku yang sama dengan kode lama, tetapi
 * tetap di server.
 */
async function loadPointStats(): Promise<{ stats: LedgerSummary; ready: boolean }> {
  const { data, error } = await supabaseAdmin.rpc('ledger_totals');

  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (!error && row) {
    const totalIn = Number(row.point_in ?? 0);
    const totalOut = Number(row.point_out ?? 0);
    return { ready: true, stats: { totalIn, totalOut, circulating: totalIn - totalOut } };
  }

  const { data: rows, error: rowsError } = await supabaseAdmin.from('point_logs').select('*');
  if (rowsError) {
    throw new Error(`Gagal memuat ringkasan poin: ${rowsError.message}`);
  }
  return { ready: false, stats: summarizePointLogs((rows ?? []).map(normalizePointLog)) };
}

async function loadWalletStats(): Promise<{ stats: LedgerSummary; ready: boolean }> {
  const { data, error } = await supabaseAdmin.rpc('ledger_totals');

  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (!error && row) {
    const totalIn = Number(row.wallet_in ?? 0);
    const totalOut = Number(row.wallet_out ?? 0);
    return { ready: true, stats: { totalIn, totalOut, circulating: totalIn - totalOut } };
  }

  const { data: rows, error: rowsError } = await supabaseAdmin.from('wallet_logs').select('*');
  if (rowsError) {
    throw new Error(`Gagal memuat ringkasan dompet: ${rowsError.message}`);
  }
  return { ready: false, stats: summarizeWalletLogs((rows ?? []).map(normalizeWalletLog)) };
}

export async function getPointsDashboard(
  accessToken: string | null
): Promise<ActionResult<PointsDashboard>> {
  const auth = await authorize(accessToken, 'staff');
  if (!auth.ok) return auth;

  try {
    const [logsRes, users, stats] = await Promise.all([
      supabaseAdmin
        .from('point_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(LEDGER_LIMIT),
      loadPointUsers(),
      loadPointStats(),
    ]);

    if (logsRes.error) {
      return fail('INTERNAL', `Gagal memuat riwayat poin: ${logsRes.error.message}`);
    }

    return succeed({
      logs: (logsRes.data ?? []).map(normalizePointLog),
      topUsers: users.users,
      stats: stats.stats,
      schemaReady: users.ready && stats.ready,
    });
  } catch (error) {
    return fail('INTERNAL', error instanceof Error ? error.message : 'Gagal memuat data poin.');
  }
}

export async function getWalletDashboard(
  accessToken: string | null
): Promise<ActionResult<WalletDashboard>> {
  const auth = await authorize(accessToken, 'staff');
  if (!auth.ok) return auth;

  try {
    const [logsRes, topUsers, stats] = await Promise.all([
      supabaseAdmin
        .from('wallet_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(LEDGER_LIMIT),
      loadWalletUsers(),
      loadWalletStats(),
    ]);

    if (logsRes.error) {
      return fail('INTERNAL', `Gagal memuat riwayat dompet: ${logsRes.error.message}`);
    }

    return succeed({
      logs: (logsRes.data ?? []).map(normalizeWalletLog),
      topUsers,
      stats: stats.stats,
      schemaReady: stats.ready,
    });
  } catch (error) {
    return fail('INTERNAL', error instanceof Error ? error.message : 'Gagal memuat data dompet.');
  }
}

// ---------------------------------------------------------------------------
// Penulisan
// ---------------------------------------------------------------------------

export interface AdjustmentResult {
  /** Saldo setelah perubahan. */
  newBalance: number;
  /** Deskripsi yang benar-benar tersimpan di ledger. */
  description: string;
}

/**
 * Tambah/kurangi poin pengguna.
 *
 * Delta dan penulisan ledger dilakukan oleh satu fungsi SQL, sehingga saldo
 * tidak mungkin berubah tanpa catatan audit.
 */
export async function adjustPoints(
  accessToken: string | null,
  input: Partial<PointAdjustmentInput>
): Promise<ActionResult<AdjustmentResult>> {
  const auth = await authorize(accessToken, 'admin');
  if (!auth.ok) return auth;

  const parsed = validatePointAdjustment(input);
  if (!parsed.ok) {
    return fail('INVALID_INPUT', parsed.error);
  }

  const { userId, kind, amount, reason } = parsed.value;

  const { data, error } = await supabaseAdmin.rpc('adjust_user_points', {
    p_user_id: userId,
    p_delta: pointDelta(kind, amount),
    p_type: kind,
    p_description: reason,
  });

  if (error) {
    const described = describeDatabaseError(error);
    // Jaring pengaman bila pesan error tidak dikenali tetapi fungsinya memang
    // belum ada (PostgREST mengembalikan 404 tanpa kode yang konsisten).
    if (described.code === 'INTERNAL' && /function/i.test(error.message)) {
      return fail('SCHEMA_NOT_READY', MIGRATION_HINT);
    }
    return described;
  }

  return succeed({ newBalance: Number(data ?? 0), description: reason });
}

/** Bekukan / aktifkan penukaran poin milik pengguna. */
export async function setPointsFrozen(
  accessToken: string | null,
  userId: string,
  frozen: boolean
): Promise<ActionResult<{ isPointsFrozen: boolean }>> {
  const auth = await authorize(accessToken, 'admin');
  if (!auth.ok) return auth;

  const uuid =
    typeof userId === 'string' ? userId.trim().toLowerCase() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) {
    return fail('INVALID_INPUT', 'UID pengguna tidak valid (harus berupa UUID).');
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ is_points_frozen: Boolean(frozen), updated_at: new Date().toISOString() })
    .eq('id', uuid)
    .select('is_points_frozen')
    .maybeSingle();

  if (error) {
    return describeDatabaseError(error);
  }

  if (!data) {
    return fail('NOT_FOUND', 'Pengguna tidak ditemukan.');
  }

  return succeed({ isPointsFrozen: Boolean(data.is_points_frozen) });
}

/** Tambah/kurangi saldo dompet pengguna. */
export async function adjustWallet(
  accessToken: string | null,
  input: Partial<WalletAdjustmentInput>
): Promise<ActionResult<AdjustmentResult>> {
  const auth = await authorize(accessToken, 'admin');
  if (!auth.ok) return auth;

  const parsed = validateWalletAdjustment(input);
  if (!parsed.ok) {
    return fail('INVALID_INPUT', parsed.error);
  }

  const { userId, kind, amount, reason } = parsed.value;

  const { data, error } = await supabaseAdmin.rpc('adjust_user_wallet', {
    p_user_id: userId,
    p_delta: walletDelta(kind, amount),
    p_type: kind,
    p_description: reason,
  });

  if (error) {
    const described = describeDatabaseError(error);
    if (described.code === 'INTERNAL' && /function/i.test(error.message)) {
      return fail('SCHEMA_NOT_READY', MIGRATION_HINT);
    }
    return described;
  }

  return succeed({ newBalance: Number(data ?? 0), description: reason });
}
