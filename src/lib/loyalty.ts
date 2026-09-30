/**
 * Logika domain untuk poin loyalitas & dompet digital.
 *
 * Modul ini SENGAJA bebas dari React/Supabase agar bisa diuji sebagai fungsi
 * murni (lihat `loyalty.test.ts`). Semua akses database ada di
 * `src/lib/actions/loyalty.actions.ts`.
 *
 * Catatan bentuk data: tabel `point_logs` / `wallet_logs` di Supabase adalah
 * hasil impor dari Firestore. Semula seluruh isinya hanya ada di kolom
 * `raw_data` (kunci camelCase) sementara kolom bertipe NULL. Migrasi
 * `20261002_loyalty_wallet_hardening.sql` mengisi kolom bertipe itu.
 * Karena itu setiap pembacaan di bawah memakai kolom asli lebih dulu dan
 * jatuh ke `raw_data` bila kolomnya masih kosong — sehingga UI tetap benar
 * baik sebelum maupun sesudah migrasi dijalankan.
 */

/** Jumlah baris ledger yang ditampilkan pada halaman admin. */
export const LEDGER_LIMIT = 50;

/** Jumlah pengguna pada daftar "saldo teratas". */
export const TOP_USER_LIMIT = 10;

/** Batas atas satu kali penyesuaian, untuk menangkap salah ketik. */
export const MAX_ADJUSTMENT = 1_000_000_000;

/** Panjang maksimum alasan penyesuaian (dibatasi agar ledger tetap rapi). */
export const MAX_REASON_LENGTH = 200;

export type PointAdjustmentKind = 'BONUS' | 'PENALTY';
export type WalletAdjustmentKind = 'TOPUP_ADMIN' | 'WITHDRAW_ADMIN';

export const POINT_ADJUSTMENT_KINDS: readonly PointAdjustmentKind[] = ['BONUS', 'PENALTY'];
export const WALLET_ADJUSTMENT_KINDS: readonly WalletAdjustmentKind[] = [
  'TOPUP_ADMIN',
  'WITHDRAW_ADMIN',
];

export const DEFAULT_POINT_REASON: Record<PointAdjustmentKind, string> = {
  BONUS: 'Bonus Admin',
  PENALTY: 'Penalti Kecurangan',
};

export const DEFAULT_WALLET_REASON: Record<WalletAdjustmentKind, string> = {
  TOPUP_ADMIN: 'Top-up oleh Admin',
  WITHDRAW_ADMIN: 'Penarikan oleh Admin',
};

/** Tipe ledger yang menambah saldo. Sisanya dianggap mengurangi. */
const EARNING_POINT_TYPES = new Set(['EARN', 'BONUS', 'TOPUP', 'REFUND']);

export const UNKNOWN_LEDGER_TYPE = 'UNKNOWN';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Validasi masukan
// ---------------------------------------------------------------------------

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface PointAdjustmentInput {
  userId: string;
  kind: PointAdjustmentKind;
  /** Selalu positif; tandanya ditentukan oleh `kind`. */
  amount: number;
  reason: string;
}

export interface WalletAdjustmentInput {
  userId: string;
  kind: WalletAdjustmentKind;
  amount: number;
  reason: string;
}

function validateUserId(userId: unknown): ValidationResult<string> {
  const value = typeof userId === 'string' ? userId.trim() : '';
  if (!value) {
    return { ok: false, error: 'UID pengguna wajib diisi.' };
  }
  if (!UUID_PATTERN.test(value)) {
    return { ok: false, error: 'UID pengguna tidak valid (harus berupa UUID).' };
  }
  return { ok: true, value: value.toLowerCase() };
}

function validateAmount(
  amount: unknown,
  { integer, label }: { integer: boolean; label: string }
): ValidationResult<number> {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return { ok: false, error: `${label} harus berupa angka.` };
  }
  if (amount <= 0) {
    return { ok: false, error: `${label} harus lebih besar dari 0.` };
  }
  if (amount > MAX_ADJUSTMENT) {
    return { ok: false, error: `${label} melebihi batas wajar (maks ${MAX_ADJUSTMENT}).` };
  }
  if (integer && !Number.isInteger(amount)) {
    return { ok: false, error: `${label} harus berupa bilangan bulat.` };
  }
  if (!integer) {
    // Buang derau floating point (mis. 0.1 + 0.2) tanpa mengubah nilai asli.
    return { ok: true, value: Math.round(amount * 100) / 100 };
  }
  return { ok: true, value: amount };
}

function validateReason(
  reason: unknown,
  fallback: string
): ValidationResult<string> {
  const raw = typeof reason === 'string' ? reason.trim() : '';
  const value = raw || fallback;
  if (value.length > MAX_REASON_LENGTH) {
    return {
      ok: false,
      error: `Alasan maksimal ${MAX_REASON_LENGTH} karakter (saat ini ${value.length}).`,
    };
  }
  return { ok: true, value };
}

export function validatePointAdjustment(
  input: Partial<PointAdjustmentInput>
): ValidationResult<PointAdjustmentInput> {
  const kind = input.kind;
  if (kind !== 'BONUS' && kind !== 'PENALTY') {
    return { ok: false, error: 'Jenis penyesuaian poin tidak dikenal.' };
  }

  const user = validateUserId(input.userId);
  if (!user.ok) return user;

  const amount = validateAmount(input.amount, { integer: true, label: 'Jumlah poin' });
  if (!amount.ok) return amount;

  const reason = validateReason(input.reason, DEFAULT_POINT_REASON[kind]);
  if (!reason.ok) return reason;

  return {
    ok: true,
    value: { userId: user.value, kind, amount: amount.value, reason: reason.value },
  };
}

export function validateWalletAdjustment(
  input: Partial<WalletAdjustmentInput>
): ValidationResult<WalletAdjustmentInput> {
  const kind = input.kind;
  if (kind !== 'TOPUP_ADMIN' && kind !== 'WITHDRAW_ADMIN') {
    return { ok: false, error: 'Jenis penyesuaian saldo tidak dikenal.' };
  }

  const user = validateUserId(input.userId);
  if (!user.ok) return user;

  const amount = validateAmount(input.amount, { integer: false, label: 'Nominal' });
  if (!amount.ok) return amount;

  const reason = validateReason(input.reason, DEFAULT_WALLET_REASON[kind]);
  if (!reason.ok) return reason;

  return {
    ok: true,
    value: { userId: user.value, kind, amount: amount.value, reason: reason.value },
  };
}

/** Delta poin: BONUS menambah, PENALTY mengurangi. */
export function pointDelta(kind: PointAdjustmentKind, amount: number): number {
  return kind === 'BONUS' ? Math.abs(amount) : -Math.abs(amount);
}

/** Delta saldo: TOPUP menambah, WITHDRAW mengurangi. */
export function walletDelta(kind: WalletAdjustmentKind, amount: number): number {
  return kind === 'TOPUP_ADMIN' ? Math.abs(amount) : -Math.abs(amount);
}

// ---------------------------------------------------------------------------
// Normalisasi baris ledger
// ---------------------------------------------------------------------------

export interface PointLog {
  id: string;
  userId: string;
  /** Selisih poin (positif menambah, negatif mengurangi). */
  pointsChanged: number;
  type: string;
  description: string;
  /** ISO 8601, atau null bila tidak ada tanggal yang bisa dibaca. */
  createdAt: string | null;
}

export interface WalletLog {
  id: string;
  userId: string;
  /** Selisih saldo (positif menambah, negatif mengurangi). */
  amountChanged: number;
  type: string;
  description: string;
  orderId: string | null;
  createdAt: string | null;
}

/** Baris pengguna pada daftar "saldo poin teratas" di halaman admin. */
export interface PointLedgerUser {
  id: string;
  displayName: string;
  points: number;
  isPointsFrozen: boolean;
}

/** Baris pengguna pada daftar "saldo dompet teratas" di halaman admin. */
export interface WalletLedgerUser {
  id: string;
  displayName: string;
  walletBalance: number;
}

type Row = Record<string, unknown>;

function asRow(value: unknown): Row {
  return value && typeof value === 'object' ? (value as Row) : {};
}

/** Ambil nilai pertama yang "ada isinya" (bukan undefined/null/''/NaN). */
function pick(...values: unknown[]): unknown {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'number' && Number.isNaN(value)) continue;
    return value;
  }
  return undefined;
}

function pickString(...values: unknown[]): string {
  const value = pick(...values);
  return value === undefined ? '' : String(value);
}

function pickNumber(...values: unknown[]): number {
  const value = pick(...values);
  if (value === undefined) return 0;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function pickIsoDate(...values: unknown[]): string | null {
  const value = pick(...values);
  if (value === undefined) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Ubah baris `point_logs` menjadi bentuk yang dipakai UI.
 * Kolom asli diutamakan; `raw_data` hanya dipakai bila kolomnya masih kosong.
 */
export function normalizePointLog(row: unknown): PointLog {
  const r = asRow(row);
  const raw = asRow(r.raw_data);
  return {
    id: pickString(r.id),
    userId: pickString(r.user_id, r.userId, raw.userId),
    pointsChanged: pickNumber(r.points, r.pointsChanged, raw.pointsChanged),
    type: pickString(r.type, raw.type) || UNKNOWN_LEDGER_TYPE,
    description: pickString(r.description, raw.description),
    createdAt: pickIsoDate(r.created_at, r.createdAt, raw.createdAt),
  };
}

export function normalizeWalletLog(row: unknown): WalletLog {
  const r = asRow(row);
  const raw = asRow(r.raw_data);
  return {
    id: pickString(r.id),
    userId: pickString(r.user_id, r.userId, raw.userId),
    amountChanged: pickNumber(r.amount, r.amountChanged, raw.amountChanged),
    type: pickString(r.type, raw.type) || UNKNOWN_LEDGER_TYPE,
    description: pickString(r.description, raw.description),
    orderId: pickString(r.order_id, r.orderId, raw.orderId) || null,
    createdAt: pickIsoDate(r.created_at, r.createdAt, raw.createdAt),
  };
}

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------

export interface LedgerSummary {
  /** Total nilai yang menambah saldo. Selalu >= 0. */
  totalIn: number;
  /** Total nilai yang mengurangi saldo. Selalu >= 0. */
  totalOut: number;
  /** Saldo yang seharusnya beredar (totalIn - totalOut). */
  circulating: number;
}

function summarize(
  rows: readonly { amount: number }[]
): LedgerSummary {
  let totalIn = 0;
  let totalOut = 0;

  for (const row of rows) {
    const amount = Number.isFinite(row.amount) ? row.amount : 0;
    if (amount > 0) totalIn += amount;
    else if (amount < 0) totalOut += Math.abs(amount);
  }

  return { totalIn, totalOut, circulating: totalIn - totalOut };
}

export function summarizePointLogs(rows: readonly PointLog[]): LedgerSummary {
  return summarize(rows.map((row) => ({ amount: row.pointsChanged })));
}

export function summarizeWalletLogs(rows: readonly WalletLog[]): LedgerSummary {
  return summarize(rows.map((row) => ({ amount: row.amountChanged })));
}

// ---------------------------------------------------------------------------
// Tampilan
// ---------------------------------------------------------------------------

export function isEarningPointType(type: string): boolean {
  return EARNING_POINT_TYPES.has(type.trim().toUpperCase());
}

/**
 * Ubah tipe ledger menjadi label yang enak dibaca: `TOPUP_ADMIN` -> `TOPUP ADMIN`.
 * Berbeda dari `replace('_', ' ')` yang hanya mengganti pemisah pertama.
 */
export function ledgerTypeLabel(type: string): string {
  return type.trim().replace(/_+/g, ' ').toUpperCase();
}

/** `1234567` -> `1.234.567` (tanpa prefix, mengikuti locale Indonesia). */
export function formatNumber(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('id-ID');
}

/** `1234567` -> `Rp1.234.567`; nilai negatif menjadi `-Rp1.234.567`. */
export function formatRupiah(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe < 0 ? '-' : '';
  return `${sign}Rp${Math.abs(safe).toLocaleString('id-ID')}`;
}

/** `5` -> `+5`; `-5` -> `-5`. */
export function formatSigned(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe > 0 ? `+${safe}` : String(safe);
}

/** `208900` -> `+Rp208.900`; `-165000` -> `-Rp165.000`. */
export function formatSignedRupiah(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (safe === 0) return formatRupiah(0);
  return safe > 0 ? `+${formatRupiah(safe)}` : formatRupiah(safe);
}
