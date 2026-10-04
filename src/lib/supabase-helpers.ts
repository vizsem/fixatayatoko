import { supabase, supabaseAdmin as _supabaseAdmin } from '@/lib/supabase';
import { isAdminRole, isAuthorizedAdmin, isStaffOrAdmin } from '@/lib/auth-helpers';
import {
  TABLES_WITH_RAW_DATA,
  TABLE_COLUMNS,
  CAMEL_TO_SNAKE,
  resolveQueryField,
  parseFirestoreTimestamp,
  extractTableColumns,
  generateId,
  mergeRowWithRawData,
  toFilterValue,
  INCREMENT_MARKER,
} from '@/lib/db-schema';

/**
 * Klien mana yang dipakai untuk membaca/menulis.
 *
 * MASALAH YANG DIPERBAIKI DI SINI:
 * `supabaseAdmin` dibuat dengan `persistSession: false` dan `autoRefreshToken: false`,
 * sehingga ia TIDAK PERNAH melampirkan token pengguna. Di browser, memakainya berarti
 * setiap permintaan dikirim sebagai peran `anon`; RLS lalu menolak hampir semua tabel
 * dan halaman admin tampak "kosong" tanpa pesan error apa pun — termasuk untuk admin
 * yang sudah login. Itu sebabnya variasi yang bergantung pada opsi `useAdmin` (yang
 * default-nya `true`) sangat menyesatkan.
 *
 * Di browser kita wajib memakai klien bersesi (`supabase`) supaya RLS melihat peran
 * `authenticated` dan policy berbasis peran dapat bekerja.
 *
 * Di server perilakunya TIDAK berubah: `supabaseAdmin` tetap klien service role yang
 * melewati RLS. Setiap jalur di server sudah memakai pemeriksaan izin eksplisit
 * (`requireAdmin()`/`requireStaff()`), jadi bypass di server memang yang diinginkan.
 *
 * Catatan keamanan: kunci service role TIDAK ikut ke browser. `SUPABASE_SERVICE_ROLE_KEY`
 * tidak berprefix `NEXT_PUBLIC_`, jadi di bundel klien nilainya `undefined`.
 */
const isBrowser = typeof window !== 'undefined';
const supabaseAdmin = isBrowser ? supabase : _supabaseAdmin;

// Sumber kebenaran tunggal ada di `@/lib/db-schema`.
// Di-reekspor agar konsumen lama tetap bekerja.
export {
  TABLES_WITH_RAW_DATA,
  TABLE_COLUMNS,
  CAMEL_TO_SNAKE,
  resolveQueryField,
  parseFirestoreTimestamp,
  extractTableColumns,
  generateId,
};

export interface NormalizedTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
  toISOString: () => string;
  toString: () => string;
  toLocaleString: (loc?: string, opt?: any) => string;
}

export function createNormalizedTimestamp(date: Date): NormalizedTimestamp {
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: (date.getTime() % 1000) * 1e6,
    toDate: () => date,
    toISOString: () => date.toISOString(),
    toString: () => date.toISOString(),
    toLocaleString: (loc?: string, opt?: any) => date.toLocaleString(loc || 'id-ID', opt),
  };
}

/**
 * Ratakan satu baris tabel menjadi bentuk dokumen gaya Firestore.
 *
 * `table` WAJIB diisi bila diketahui: aturan urutan kolom ↔ `raw_data` bergantung
 * padanya (lihat `mergeRowWithRawData` di `@/lib/db-schema`). Tanpa `table`, semua
 * kolom diperlakukan sebagai otoritatif dan bug kolom DEFAULT importer dapat
 * muncul lagi.
 */
export function normalizeRow(row: any, table?: string): any {
  if (!row) return {};
  const raw = row.raw_data || {};
  const merged: any = mergeRowWithRawData(row, table);

  const createdDate = row.created_at
    ? new Date(row.created_at)
    : parseFirestoreTimestamp(raw.createdAt);

  merged.createdAt = createNormalizedTimestamp(createdDate);

  if (row.full_name !== undefined) {
    merged.name = merged.name || row.full_name;
    merged.displayName = merged.displayName || row.full_name;
  }
  if (row.role !== undefined) {
    merged.role = row.role;
  }
  if (row.wallet_balance !== undefined) {
    merged.walletBalance = merged.walletBalance ?? row.wallet_balance;
  }

  merged.customerName = merged.customerName || merged.customer_name || merged.name || 'Pelanggan';
  merged.customerPhone = merged.customerPhone || merged.customer_phone || merged.phone || '';
  merged.orderId = merged.orderId || merged.order_id || row.id;

  return merged;
}

export function normalizeRows(rows: any[], table?: string): any[] {
  return (rows || []).map((row) => normalizeRow(row, table));
}

// --- Auth helpers (Supabase-native) ---

export interface SupabaseUserAdapter {
  id: string;
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
  isAnonymous?: boolean;
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
}

export function adaptSupabaseUser(user: any): SupabaseUserAdapter | null {
  if (!user) return null;

  // PERINGATAN KEAMANAN: `user_metadata` dapat ditulis sendiri oleh pengguna
  // (terbukti dengan `PUT /auth/v1/user`), dan email bisa didaftarkan dengan
  // awalan apa pun. Menurunkan peran dari keduanya berarti siapa pun dapat
  // menjadikan dirinya admin. Sumber peran yang sah hanya `public.users.role`
  // dan `app_metadata` (hanya bisa ditulis service role).
  const role = user.app_metadata?.role as string | undefined;

  return {
    ...user,
    id: user.id,
    uid: user.id,
    role,
    app_metadata: user.app_metadata || {},
    user_metadata: user.user_metadata || {},
    displayName: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
    photoURL: user.user_metadata?.avatar_url || null,
  };
}

export interface UserRoleCheck {
  user: SupabaseUserAdapter | null;
  userDocData?: any;
  isAdmin: boolean;
  isStaff: boolean;
  role?: string;
}

export async function getUserAndRole(): Promise<UserRoleCheck> {
  const { data: { user: sbUser } } = await supabase.auth.getUser();
  const user = adaptSupabaseUser(sbUser);
  if (!user) {
    return { user: null, isAdmin: false, isStaff: false };
  }

  let userDocData: any = null;
  try {
    const { data } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (data) {
      userDocData = normalizeRow(data, 'users');
    }
  } catch {
    // ignore
  }

  // `userDocData` berasal dari `public.users` dan merupakan satu-satunya sumber
  // peran yang sah. `app_metadata` hanya bisa ditulis service role, jadi aman
  // sebagai cadangan. `user_metadata` SENGAJA tidak dipakai karena dapat ditulis
  // sendiri oleh pengguna (jalur naik-ke-admin).
  const candidateRoles = [
    userDocData?.role,
    user.app_metadata?.role,
  ];
  const role = candidateRoles.find(Boolean);

  return {
    user,
    userDocData,
    isAdmin: isAuthorizedAdmin(user as any, userDocData),
    isStaff: isStaffOrAdmin(role),
    role,
  };
}

export function getRoleFromUser(user: any, userDocData?: any): string | undefined {
  if (!user) return undefined;

  // Hanya `public.users.role` dan `app_metadata`. Awalan email dan
  // `user_metadata` tidak dipakai: keduanya dapat dikendalikan pengguna.
  return userDocData?.role || user.app_metadata?.role;
}

// --- Build write payload helper ---

export function buildWritePayload(table: string, data: any, opts?: { isInsert?: boolean; isUpdate?: boolean; existingRaw?: any }): Record<string, any> {
  const now = new Date().toISOString();
  const hasRawData = TABLES_WITH_RAW_DATA.has(table);

  // Separate increment markers from regular data before processing
  const incrementFields: Record<string, number> = {};
  const regularData: Record<string, any> = {};
  if (data && typeof data === 'object') {
    for (const [key, val] of Object.entries(data)) {
      if (val && typeof val === 'object' && (val as any)[INCREMENT_MARKER as any]) {
        incrementFields[key] = (val as any).delta;
      } else {
        regularData[key] = val;
      }
    }
  } else {
    Object.assign(regularData, data);
  }

  const extractedCols = extractTableColumns(table, regularData);

  let raw_data: any = undefined;
  if (hasRawData) {
    raw_data = { ...regularData, updatedAt: now };
    if (opts?.isInsert) raw_data.createdAt = regularData.createdAt || now;
    if (opts?.existingRaw) {
      raw_data = { ...opts.existingRaw, ...raw_data };
    }
    if (!opts?.isInsert && opts?.isUpdate && opts?.existingRaw?.createdAt) {
      raw_data.createdAt = opts.existingRaw.createdAt;
    }
    // Apply increment deltas to raw_data fields
    for (const [key, delta] of Object.entries(incrementFields)) {
      const current = Number(raw_data[key] ?? opts?.existingRaw?.[key] ?? 0);
      raw_data[key] = current + delta;
    }
  }

  const payload: Record<string, any> = {
    ...extractedCols,
    updated_at: now,
  };
  if (hasRawData) payload.raw_data = raw_data;
  if (opts?.isInsert) {
    payload.created_at = now;
    if (!regularData.id) payload.id = generateId(table);
    else payload.id = regularData.id;
  }
  // Attach increment metadata for callers that apply db-level increments natively
  if (Object.keys(incrementFields).length > 0) {
    (payload as any).__increments = incrementFields;
  }
  return payload;
}

// --- Data access convenience wrappers (return normalized shape like the bridge) ---

export async function sbGetDoc(table: string, id: string, useAdmin = true): Promise<{ exists: () => boolean; data: () => any; id: string }> {
  const client = useAdmin ? supabaseAdmin : supabase;
  if (table === 'orders') {
    // 1. Coba cari berdasarkan primary key `id` langsung (memakai indeks B-tree, sangat cepat).
    const { data: byId } = await client.from('orders').select('*').eq('id', id).maybeSingle();
    if (byId) {
      const row = normalizeRow(byId, table);
      return { exists: () => true, data: () => row, id: byId.id || id };
    }
    // 2. Fallback: jika id yang dipass adalah nomor order (order_id / SO-xxx).
    const { data: byOrderId, error } = await client.from('orders').select('*').eq('order_id', id).maybeSingle();
    if (error || !byOrderId) {
      return { exists: () => false, data: () => ({}), id };
    }
    const row = normalizeRow(byOrderId, table);
    return { exists: () => true, data: () => row, id: byOrderId.id || id };
  }

  const { data, error } = await client.from(table).select('*').eq('id', id).maybeSingle();
  if (error || !data) {
    return { exists: () => false, data: () => ({}), id };
  }
  const row = normalizeRow(data, table);
  return { exists: () => true, data: () => row, id: data.id || id };
}

export interface SbDocSnapshot<T = any> {
  data: () => T;
  id: string;
  exists: () => boolean;
  get: (field: string) => any;
}

export interface SbQuerySnapshot<T = any> {
  size: number;
  empty: boolean;
  docs: Array<SbDocSnapshot<T>>;
  forEach: (cb: (doc: SbDocSnapshot<T>, index: number) => void) => void;
  map: <U>(cb: (doc: SbDocSnapshot<T>, index: number) => U) => U[];
  filter: (cb: (doc: SbDocSnapshot<T>, index: number) => boolean) => Array<SbDocSnapshot<T>>;
  reduce: <U>(cb: (acc: U, doc: SbDocSnapshot<T>, index: number) => U, init: U) => U;
  [Symbol.iterator]: () => IterableIterator<SbDocSnapshot<T>>;
  length: number;
}

export async function sbGetDocs(params: {
  table: string;
  where?: Array<{ field: string; op: string; val: any }>;
  orderBy?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
  limit?: number;
  useAdmin?: boolean;
  /**
   * Proyeksi kolom PostgREST, mis. `'id,name'` atau
   * `'id,cost_price,units:raw_data->units'`. Default `'*'`.
   *
   * Dipakai halaman yang hanya butuh beberapa kolom: mengambil seluruh kolom
   * `products` berarti ikut mengunduh `raw_data` dan `image_url` sehingga satu
   * tabel bisa berukuran MEGABYTE padahal angkanya hanya butuh ~10% dari itu.
   */
  columns?: string;
}): Promise<SbQuerySnapshot> {
  const {
    table,
    where: wheres,
    orderBy: orderBys,
    limit: lim,
    useAdmin = true,
    columns,
  } = params;
  const client = useAdmin ? supabaseAdmin : supabase;
  let builder: any = client.from(table).select(columns || '*');

  for (const w of wheres || []) {
    const resolved = resolveQueryField(table, w.field);
    const field = resolved.targetField || w.field;
    // Nilai tanggal WAJIB diubah ke ISO: PostgREST membalas 400 untuk bentuk
    // `Fri Oct 02 2026 ...` hasil `String(new Date())`.
    const val = toFilterValue(w.val);
    if (w.op === '==' || w.op === '===') builder = builder.eq(field, val);
    else if (w.op === '!=') builder = builder.neq(field, val);
    else if (w.op === '>') builder = builder.gt(field, val);
    else if (w.op === '>=') builder = builder.gte(field, val);
    else if (w.op === '<') builder = builder.lt(field, val);
    else if (w.op === '<=') builder = builder.lte(field, val);
    else if (w.op === 'in') builder = builder.in(field, Array.isArray(val) ? val : [val]);
    else if (w.op === 'array-contains') builder = builder.contains(field, [val]);
  }
  for (const ob of orderBys || []) {
    const resolved = resolveQueryField(table, ob.field);
    const field = resolved.targetField || ob.field;
    builder = builder.order(field, { ascending: ob.direction !== 'desc' });
  }
  if (lim !== undefined) builder = builder.limit(lim);

  const { data, error } = await builder;
  if (error) console.error(`sbGetDocs Supabase error on "${table}":`, error);
  const rows = normalizeRows(data || [], table);
  const docs: Array<SbDocSnapshot> = rows.map((r) => ({
    data: () => r,
    id: r?.id || r?.uid || r?.skuid || '',
    exists: () => !!r,
    get: (field: string) => (r && r[field] !== undefined ? r[field] : undefined),
  }));
  const snapshot: SbQuerySnapshot = {
    size: docs.length,
    empty: docs.length === 0,
    docs,
    forEach: (cb: (doc: SbDocSnapshot, index: number) => void) => docs.forEach(cb),
    map: <U>(cb: (doc: SbDocSnapshot, index: number) => U): U[] => docs.map(cb),
    filter: (cb: (doc: SbDocSnapshot, index: number) => boolean) => docs.filter(cb),
    reduce: <U>(cb: (acc: U, doc: SbDocSnapshot, index: number) => U, init: U): U => docs.reduce(cb, init),
    [Symbol.iterator]: () => docs[Symbol.iterator](),
    get length() { return docs.length; },
  };
  return snapshot;
}

export async function sbUpdateDoc(table: string, id: string, data: any, useAdmin = true): Promise<void> {
  const client = useAdmin ? supabaseAdmin : supabase;

  const incrementFields: Record<string, number> = {};
  if (data && typeof data === 'object') {
    for (const [key, val] of Object.entries(data)) {
      if (val && typeof val === 'object' && (val as any)[INCREMENT_MARKER as any]) {
        incrementFields[key] = (val as any).delta;
      }
    }
  }

  let currentRow: any = undefined;
  let existingRaw: any = undefined;
  const hasRawData = TABLES_WITH_RAW_DATA.has(table);

  if (hasRawData || Object.keys(incrementFields).length > 0) {
    const selectCols = hasRawData && Object.keys(incrementFields).length === 0 ? 'raw_data' : '*';
    const { data: existing } = await client
      .from(table)
      .select(selectCols)
      .eq('id', id)
      .maybeSingle();
    if (existing) {
      currentRow = existing;
      existingRaw = existing.raw_data || undefined;
    }
  }

  let resolvedData = data;
  if (Object.keys(incrementFields).length > 0) {
    resolvedData = { ...data };
    for (const [key, delta] of Object.entries(incrementFields)) {
      let currentVal: number = 0;
      if (currentRow && currentRow[key] !== undefined && typeof currentRow[key] !== 'object') {
        currentVal = Number(currentRow[key]);
      } else if (currentRow?.raw_data && currentRow.raw_data[key] !== undefined) {
        currentVal = Number(currentRow.raw_data[key]);
      } else if (existingRaw && existingRaw[key] !== undefined) {
        currentVal = Number(existingRaw[key]);
      }
      if (isNaN(currentVal)) currentVal = 0;
      resolvedData[key] = currentVal + delta;
    }
  }

  const payload = buildWritePayload(table, resolvedData, { isUpdate: true, existingRaw });
  if (hasRawData && payload.raw_data) {
    for (const [key, delta] of Object.entries(incrementFields)) {
      const cur = Number(payload.raw_data[key] ?? 0);
      payload.raw_data[key] = isNaN(cur) ? delta : cur;
    }
  }

  const { error } = await client.from(table).update(payload).eq('id', id);
  if (error) {
    console.error(`sbUpdateDoc error on ${table}/${id}:`, error);
    throw error;
  }
}

export async function sbInsertDoc(table: string, data: any, useAdmin = true): Promise<{ id: string }> {
  const client = useAdmin ? supabaseAdmin : supabase;
  const payload = buildWritePayload(table, data, { isInsert: true });
  const { error } = await client.from(table).insert(payload);
  if (error) {
    console.error(`sbInsertDoc error on ${table}:`, error);
    throw error;
  }
  return { id: payload.id };
}

export async function sbUpsertDoc(
  table: string,
  id: string,
  data: any,
  optionsOrUseAdmin: boolean | { merge?: boolean; useAdmin?: boolean } = true
): Promise<void> {
  const useAdmin = typeof optionsOrUseAdmin === 'boolean' ? optionsOrUseAdmin : (optionsOrUseAdmin?.useAdmin ?? true);
  const client = useAdmin ? supabaseAdmin : supabase;
  const payload = buildWritePayload(table, { ...data, id }, { isInsert: true });
  const { error } = await client.from(table).upsert(payload);
  if (error) {
    console.error(`sbUpsertDoc error on ${table}/${id}:`, error);
    throw error;
  }
}

export const sbSetDoc = sbUpsertDoc;

export async function sbDeleteDoc(table: string, id: string, useAdmin = true): Promise<void> {
  const client = useAdmin ? supabaseAdmin : supabase;
  const { error } = await client.from(table).delete().eq('id', id);
  if (error) {
    console.error(`sbDeleteDoc error on ${table}/${id}:`, error);
    throw error;
  }
}

export interface BatchOp {
  type: 'set' | 'update' | 'delete' | 'upsert';
  table: string;
  id?: string;
  data?: any;
}

export async function sbRunBatch(ops: BatchOp[], useAdmin = true): Promise<void> {
  const client = useAdmin ? supabaseAdmin : supabase;
  for (const op of ops) {
    switch (op.type) {
      case 'set': {
        if (!op.id) throw new Error('set requires id');
        const payload = buildWritePayload(op.table, { ...(op.data || {}), id: op.id }, { isInsert: true });
        const { error } = await client.from(op.table).upsert(payload);
        if (error) { console.error(`sbRunBatch set error on ${op.table}/${op.id}:`, error); throw error; }
        break;
      }
      case 'upsert': {
        if (!op.id) throw new Error('upsert requires id');
        const payload = buildWritePayload(op.table, { ...(op.data || {}), id: op.id }, { isInsert: true });
        const { error } = await client.from(op.table).upsert(payload);
        if (error) { console.error(`sbRunBatch upsert error on ${op.table}/${op.id}:`, error); throw error; }
        break;
      }
      case 'update': {
        if (!op.id) throw new Error('update requires id');
        await sbUpdateDoc(op.table, op.id, op.data, useAdmin);
        break;
      }
      case 'delete': {
        if (!op.id) throw new Error('delete requires id');
        await sbDeleteDoc(op.table, op.id, useAdmin);
        break;
      }
    }
  }
}

export function sbUpsertMany(table: string, rowsWithIds: Array<{ id: string; [k: string]: any }>, useAdmin = true): Promise<void> {
  const ops: BatchOp[] = rowsWithIds.map(r => ({ type: 'upsert', table, id: r.id, data: r }));
  return sbRunBatch(ops, useAdmin);
}
