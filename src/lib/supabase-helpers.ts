import { supabase, supabaseAdmin } from '@/lib/supabase';
import { isAdminRole, isAuthorizedAdmin, isStaffOrAdmin } from '@/lib/auth-helpers';
import { INCREMENT_MARKER } from '@/lib/firebase';

// --- Constants (mirror src/lib/firebase.ts) ---

export const TABLES_WITH_RAW_DATA = new Set([
  'products', 'orders', 'customers', 'suppliers', 'purchases',
  'warehouses', 'categories', 'cashier_shifts', 'inventory_logs', 'stock_logs',
  'chats', 'ledger_entries', 'capital_transactions', 'wallet_logs', 'notifications', 'settings',
  'operational_expenses', 'inventory_transactions', 'product_cost_logs',
]);

export const TABLE_COLUMNS: Record<string, Set<string>> = {
  products: new Set(['id', 'name', 'description', 'price', 'stock', 'created_at', 'updated_at', 'sku', 'category', 'unit', 'cost_price', 'image_url', 'barcode', 'is_active', 'raw_data']),
  orders: new Set(['id', 'user_id', 'status', 'total', 'created_at', 'updated_at', 'order_id', 'customer_name', 'customer_phone', 'items', 'payment', 'delivery', 'raw_data']),
  customers: new Set(['id', 'name', 'email', 'phone', 'address', 'created_at', 'updated_at', 'raw_data']),
  suppliers: new Set(['id', 'name', 'contact', 'created_at', 'updated_at', 'raw_data']),
  purchases: new Set(['id', 'supplier_id', 'total', 'status', 'created_at', 'updated_at', 'raw_data']),
  warehouses: new Set(['id', 'name', 'location', 'created_at', 'updated_at', 'raw_data']),
  categories: new Set(['id', 'name', 'created_at', 'updated_at', 'raw_data']),
  users: new Set(['id', 'full_name', 'avatar_url', 'wallet_balance', 'role', 'created_at', 'updated_at']),
  cashier_shifts: new Set(['id', 'created_at', 'updated_at', 'raw_data']),
  inventory_logs: new Set(['id', 'created_at', 'updated_at', 'raw_data']),
  stock_logs: new Set(['id', 'product_id', 'qty_before', 'qty_after', 'created_at', 'updated_at', 'raw_data']),
  chats: new Set(['id', 'created_at', 'updated_at', 'raw_data']),
  ledger_entries: new Set(['id', 'created_at', 'updated_at', 'raw_data']),
  capital_transactions: new Set(['id', 'created_at', 'updated_at', 'raw_data']),
  wallet_logs: new Set(['id', 'user_id', 'amount', 'description', 'created_at', 'raw_data']),
  notifications: new Set(['id', 'created_at', 'updated_at', 'raw_data']),
  settings: new Set(['id', 'key', 'value', 'created_at', 'updated_at', 'raw_data']),
  operational_expenses: new Set(['id', 'created_at', 'updated_at', 'raw_data']),
};

export const CAMEL_TO_SNAKE: Record<string, string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  orderId: 'order_id',
  userId: 'user_id',
  customerId: 'customer_id',
  customerName: 'customer_name',
  customerPhone: 'customer_phone',
  supplierId: 'supplier_id',
  productId: 'product_id',
  warehouseId: 'warehouse_id',
  costPrice: 'cost_price',
  imageUrl: 'image_url',
  walletBalance: 'wallet_balance',
  fullName: 'full_name',
  shiftId: 'shift_id',
  Barcode: 'barcode',
  barcode: 'barcode',
  Status: 'status',
  status: 'status',
  isActive: 'is_active',
};

export function parseFirestoreTimestamp(ts: any): Date {
  if (!ts) return new Date();
  if (typeof ts === 'object' && ts !== null) {
    const seconds = ts._seconds ?? ts.seconds;
    const nanoseconds = ts._nanoseconds ?? ts.nanoseconds ?? 0;
    if (typeof seconds === 'number') {
      return new Date(seconds * 1000 + nanoseconds / 1e6);
    }
  }
  const d = new Date(ts);
  return isNaN(d.getTime()) ? new Date() : d;
}

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

export function resolveQueryField(table: string, field: string): { targetField?: string; ignore?: boolean } {
  if (field === '__name__' || field === 'id') return { targetField: 'id' };
  if (table === 'products' && (field === 'isActive' || field === 'is_active')) {
    return { targetField: 'is_active' };
  }
  if (table === 'users' && (field === 'name' || field === 'displayName')) {
    return { targetField: 'full_name' };
  }
  const normalized = CAMEL_TO_SNAKE[field] || field;
  const cols = TABLE_COLUMNS[table];
  if (cols && cols.has(normalized)) {
    return { targetField: normalized };
  }
  if (TABLES_WITH_RAW_DATA.has(table)) {
    return { targetField: `raw_data->>${field}` };
  }
  return { targetField: normalized };
}

export function normalizeRow(row: any): any {
  if (!row) return {};
  const raw = row.raw_data || {};
  const merged: any = { ...raw, ...row };

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

export function normalizeRows(rows: any[]): any[] {
  return (rows || []).map(normalizeRow);
}

export function extractTableColumns(table: string, data: any): Record<string, any> {
  const cols: Record<string, any> = {};
  if (!data || typeof data !== 'object') return cols;

  if (table === 'products') {
    if (data.stock !== undefined) cols.stock = Number(data.stock);
    if (data.name !== undefined) cols.name = data.name;
    else if (data.Nama !== undefined) cols.name = data.Nama;
    if (data.price !== undefined) cols.price = Number(data.price);
    else if (data.Ecer !== undefined) cols.price = Number(data.Ecer);
    if (data.unit !== undefined) cols.unit = data.unit;
    else if (data.Satuan !== undefined) cols.unit = data.Satuan;
    if (data.category !== undefined) cols.category = data.category;
    else if (data.Kategori !== undefined) cols.category = data.Kategori;
    if (data.sku !== undefined) cols.sku = data.sku;
    else if (data.Barcode !== undefined) cols.sku = data.Barcode;
    if (data.barcode !== undefined) cols.barcode = data.barcode;
    else if (data.Barcode !== undefined) cols.barcode = data.Barcode;
    if (data.costPrice !== undefined) cols.cost_price = Number(data.costPrice);
    else if (data.Modal !== undefined) cols.cost_price = Number(data.Modal);
    if (data.imageUrl !== undefined) cols.image_url = data.imageUrl;
    else if (data.Link_Foto !== undefined) cols.image_url = data.Link_Foto;
    if (data.isActive !== undefined) cols.is_active = data.isActive;
    else if (data.Status !== undefined) cols.is_active = data.Status === 1;
  } else if (table === 'orders') {
    if (data.status !== undefined) cols.status = data.status;
    if (data.total !== undefined) cols.total = Number(data.total);
    else if (data.totalAmount !== undefined) cols.total = Number(data.totalAmount);
    if (data.orderId !== undefined) cols.order_id = data.orderId;
    if (data.userId !== undefined) cols.user_id = data.userId;
    if (data.customerName !== undefined) cols.customer_name = data.customerName;
    else if (data.name !== undefined) cols.customer_name = data.name;
    if (data.customerPhone !== undefined) cols.customer_phone = data.customerPhone;
    else if (data.phone !== undefined) cols.customer_phone = data.phone;
    if (data.items !== undefined) cols.items = data.items;
  } else if (table === 'users') {
    if (data.walletBalance !== undefined) cols.wallet_balance = Number(data.walletBalance);
    if (data.name !== undefined) cols.full_name = data.name;
    else if (data.displayName !== undefined) cols.full_name = data.displayName;
  } else if (table === 'customers') {
    if (data.name !== undefined) cols.name = data.name;
    if (data.email !== undefined) cols.email = data.email;
    if (data.phone !== undefined) cols.phone = data.phone;
    if (data.address !== undefined) cols.address = data.address;
  } else if (table === 'suppliers') {
    if (data.name !== undefined) cols.name = data.name;
    if (data.contact !== undefined) cols.contact = data.contact;
    else if (data.contactPerson !== undefined) cols.contact = data.contactPerson;
  } else if (table === 'purchases') {
    if (data.total !== undefined) cols.total = Number(data.total);
    if (data.status !== undefined) cols.status = data.status;
  }
  return cols;
}

export function generateId(table: string): string {
  return `${table.slice(0, 4)}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
  const email = (user.email || '').toLowerCase();
  const metaRole = user.user_metadata?.role || user.app_metadata?.role;
  const role = metaRole || (
    email.startsWith('admin') || email.includes('hadzikoh')
      ? 'superadmin'
      : email.startsWith('kasir')
        ? 'cashier'
        : undefined
  );
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
      userDocData = normalizeRow(data);
    }
  } catch {
    // ignore
  }

  const candidateRoles = [
    userDocData?.role,
    user.role,
    user.app_metadata?.role,
    user.user_metadata?.role,
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
  const email = (user.email || '').toLowerCase();
  if (email.startsWith('admin') || email.includes('hadzikoh')) return 'superadmin';
  if (email.startsWith('kasir')) return 'cashier';
  return (
    userDocData?.role ||
    user.role ||
    user.app_metadata?.role ||
    user.user_metadata?.role
  );
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
  let query = client.from(table).select('*');
  if (table === 'orders') {
    query = query.or(`id.eq.${id},order_id.eq.${id}`) as any;
  } else {
    query = query.eq('id', id) as any;
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    return { exists: () => false, data: () => ({}), id };
  }
  const row = normalizeRow(data);
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
}): Promise<SbQuerySnapshot> {
  const { table, where: wheres, orderBy: orderBys, limit: lim, useAdmin = true } = params;
  const client = useAdmin ? supabaseAdmin : supabase;
  let builder: any = client.from(table).select('*');

  for (const w of wheres || []) {
    const resolved = resolveQueryField(table, w.field);
    const field = resolved.targetField || w.field;
    if (w.op === '==' || w.op === '===') builder = builder.eq(field, w.val);
    else if (w.op === '!=') builder = builder.neq(field, w.val);
    else if (w.op === '>') builder = builder.gt(field, w.val);
    else if (w.op === '>=') builder = builder.gte(field, w.val);
    else if (w.op === '<') builder = builder.lt(field, w.val);
    else if (w.op === '<=') builder = builder.lte(field, w.val);
    else if (w.op === 'in') builder = builder.in(field, Array.isArray(w.val) ? w.val : [w.val]);
    else if (w.op === 'array-contains') builder = builder.contains(field, [w.val]);
  }
  for (const ob of orderBys || []) {
    const resolved = resolveQueryField(table, ob.field);
    const field = resolved.targetField || ob.field;
    builder = builder.order(field, { ascending: ob.direction !== 'desc' });
  }
  if (lim !== undefined) builder = builder.limit(lim);

  const { data, error } = await builder;
  if (error) console.error(`sbGetDocs Supabase error on "${table}":`, error);
  const rows = normalizeRows(data || []);
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
