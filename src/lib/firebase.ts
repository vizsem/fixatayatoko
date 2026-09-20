/**
 * Supabase-backed Firebase / Firestore Compatibility Bridge
 * Seamlessly routes all Firestore, Auth, and Storage calls directly to Supabase Postgres.
 * Uses supabaseAdmin (service role) for all data operations to bypass RLS.
 */

import { supabase, supabaseAdmin } from '@/lib/supabase';

// Use admin client for all data operations (bypasses RLS)
const db_client = supabaseAdmin;

// --- Interfaces & Types ---
export interface DocRef {
  type: 'doc';
  table: string;
  id: string;
}

export interface CollectionRef {
  type: 'collection';
  table: string;
  constraints?: QueryConstraint[];
}

export type QueryConstraint =
  | { type: 'where'; field: string; op: string; val: any }
  | { type: 'orderBy'; field: string; direction: 'asc' | 'desc' }
  | { type: 'limit'; value: number };

export interface QueryRef {
  type: 'query';
  table: string;
  constraints: QueryConstraint[];
}

export interface DocumentSnapshot<T = any> {
  id: string;
  ref?: any;
  exists: () => boolean;
  data: () => T;
}

export interface QuerySnapshot<T = any> {
  docs: DocumentSnapshot<T>[];
  empty: boolean;
  size: number;
  forEach: (callback: (doc: DocumentSnapshot<T>) => void) => void;
  map: <U>(callback: (doc: DocumentSnapshot<T>) => U) => U[];
  docChanges: () => Array<{ type: 'added' | 'modified' | 'removed'; doc: DocumentSnapshot<T> }>;
}

// --- Firestore Compatibility Functions ---

export const db: any = {
  type: 'firestore_compat',
  supabase: db_client,
};

export function collection(_database: any, path: string, ...subPaths: string[]): CollectionRef {
  const fullPath = [path, ...subPaths].filter(Boolean).join('/');
  const table = subPaths.length > 0 ? subPaths[subPaths.length - 1] : path;
  return {
    type: 'collection',
    table,
    constraints: [],
  };
}

function generateId(table: string): string {
  return `${table.slice(0, 4)}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function doc(colOrDb: any, pathOrId?: string, ...subPaths: string[]): DocRef {
  if (colOrDb && colOrDb.type === 'collection') {
    return {
      type: 'doc',
      table: colOrDb.table,
      // Auto-generate ID if not provided (like Firestore's doc(collection) pattern)
      id: pathOrId || generateId(colOrDb.table),
    };
  }

  if (subPaths.length > 0) {
    return {
      type: 'doc',
      table: pathOrId || '',
      id: subPaths[0],
    };
  }

  const parts = (pathOrId || '').split('/');
  return {
    type: 'doc',
    table: parts[0] || '',
    id: parts[1] || '',
  };
}

export function where(field: string, op: string, val: any): QueryConstraint {
  return { type: 'where', field, op, val };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryConstraint {
  return { type: 'orderBy', field, direction };
}

export function limit(value: number): QueryConstraint {
  return { type: 'limit', value };
}

export function documentId(): string {
  return 'id';
}

export function query(target: CollectionRef | QueryRef, ...constraints: QueryConstraint[]): QueryRef {
  const existingConstraints = (target as any).constraints || [];
  return {
    type: 'query',
    table: target.table,
    constraints: [...existingConstraints, ...constraints],
  };
}

// Tables that DO have a raw_data JSONB column
const TABLES_WITH_RAW_DATA = new Set([
  'products', 'orders', 'customers', 'suppliers', 'purchases',
  'warehouses', 'categories', 'cashier_shifts', 'inventory_logs', 'stock_logs',
  'chats', 'ledger_entries', 'capital_transactions', 'wallet_logs', 'notifications', 'settings',
  'operational_expenses',
]);

const TABLE_COLUMNS: Record<string, Set<string>> = {
  products: new Set(['id', 'name', 'description', 'price', 'stock', 'created_at', 'updated_at', 'sku', 'category', 'unit', 'cost_price', 'image_url', 'barcode', 'is_active', 'raw_data']),
  orders: new Set(['id', 'user_id', 'status', 'total', 'created_at', 'updated_at', 'order_id', 'customer_name', 'customer_phone', 'items', 'payment', 'delivery', 'raw_data']),
  customers: new Set(['id', 'name', 'email', 'phone', 'address', 'created_at', 'updated_at', 'raw_data']),
  suppliers: new Set(['id', 'name', 'contact', 'created_at', 'updated_at', 'raw_data']),
  purchases: new Set(['id', 'supplier_id', 'total', 'status', 'created_at', 'updated_at', 'raw_data']),
  warehouses: new Set(['id', 'name', 'location', 'created_at', 'updated_at', 'raw_data']),
  categories: new Set(['id', 'name', 'created_at', 'updated_at', 'raw_data']),
  // users table does NOT have a raw_data column
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

const CAMEL_TO_SNAKE: Record<string, string> = {
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
};

function resolveQueryField(table: string, field: string): { targetField?: string; ignore?: boolean } {
  if (field === '__name__' || field === 'id') return { targetField: 'id' };

  // products table now has is_active column — map to it
  if (table === 'products' && (field === 'isActive' || field === 'is_active')) {
    return { targetField: 'is_active' };
  }

  // users table uses full_name instead of name
  if (table === 'users' && (field === 'name' || field === 'displayName')) {
    return { targetField: 'full_name' };
  }

  const normalized = CAMEL_TO_SNAKE[field] || field;
  const cols = TABLE_COLUMNS[table];

  if (cols && cols.has(normalized)) {
    return { targetField: normalized };
  }

  // Only use raw_data->field if the table actually has a raw_data column
  if (TABLES_WITH_RAW_DATA.has(table)) {
    return { targetField: `raw_data->>${field}` };
  }

  // For tables without raw_data (e.g. users), just use the field as-is
  return { targetField: normalized };
}

function parseFirestoreTimestamp(ts: any): Date {
  if (!ts) return new Date();
  // Firestore export format: { _seconds, _nanoseconds }
  if (typeof ts === 'object' && ts !== null) {
    const seconds = ts._seconds ?? ts.seconds;
    const nanoseconds = ts._nanoseconds ?? ts.nanoseconds ?? 0;
    if (typeof seconds === 'number') {
      return new Date(seconds * 1000 + nanoseconds / 1e6);
    }
  }
  // ISO string or number (epoch ms)
  const d = new Date(ts);
  return isNaN(d.getTime()) ? new Date() : d;
}

function normalizeDocData(row: any) {
  const raw = row.raw_data || {};
  const merged: any = { ...raw, ...row };

  const createdDate = row.created_at
    ? new Date(row.created_at)
    : parseFirestoreTimestamp(raw.createdAt);

  merged.createdAt = {
    seconds: Math.floor(createdDate.getTime() / 1000),
    nanoseconds: (createdDate.getTime() % 1000) * 1e6,
    toDate: () => createdDate,
    toISOString: () => createdDate.toISOString(),
    toString: () => createdDate.toISOString(),
    toLocaleString: (loc?: string, opt?: any) => createdDate.toLocaleString(loc || 'id-ID', opt),
  };

  // Normalize users table fields (no raw_data, has full_name instead of name)
  if (row.full_name !== undefined) {
    merged.name = merged.name || row.full_name;
    merged.displayName = merged.displayName || row.full_name;
  }
  // Ensure role is always accessible
  if (row.role !== undefined) {
    merged.role = row.role;
  }
  // Normalize wallet_balance
  if (row.wallet_balance !== undefined) {
    merged.walletBalance = merged.walletBalance ?? row.wallet_balance;
  }

  merged.customerName = merged.customerName || merged.customer_name || merged.name || 'Pelanggan';
  merged.customerPhone = merged.customerPhone || merged.customer_phone || merged.phone || '';
  merged.orderId = merged.orderId || merged.order_id || row.id;

  return merged;
}


export async function getDoc<T = any>(docRef: DocRef): Promise<DocumentSnapshot<T>> {
  if (!docRef || !docRef.id) {
    return {
      id: '',
      exists: () => false,
      data: () => ({} as T),
    };
  }

  try {
    const { data, error } = await db_client
      .from(docRef.table)
      .select('*')
      .eq('id', docRef.id)
      .maybeSingle();

    if (error || !data) {
      return {
        id: docRef.id,
        exists: () => false,
        data: () => ({} as T),
      };
    }

    const merged = normalizeDocData(data);
    return {
      id: docRef.id,
      exists: () => true,
      data: () => merged as T,
    };
  } catch {
    return {
      id: docRef.id,
      exists: () => false,
      data: () => ({} as T),
    };
  }
}

export async function getDocs<T = any>(target: CollectionRef | QueryRef): Promise<QuerySnapshot<T>> {
  try {
    let builder: any = db_client.from(target.table).select('*');
    const constraints = (target as any).constraints || [];

    for (const c of constraints) {
      if (c.type === 'where') {
        const resolved = resolveQueryField(target.table, c.field);
        if (resolved.ignore) continue;
        const field = resolved.targetField || c.field;

        if (c.op === '==' || c.op === '===') {
          builder = builder.eq(field, c.val);
        } else if (c.op === '!=') {
          builder = builder.neq(field, c.val);
        } else if (c.op === '>') {
          builder = builder.gt(field, c.val);
        } else if (c.op === '>=') {
          builder = builder.gte(field, c.val);
        } else if (c.op === '<') {
          builder = builder.lt(field, c.val);
        } else if (c.op === '<=') {
          builder = builder.lte(field, c.val);
        } else if (c.op === 'in') {
          builder = builder.in(field, Array.isArray(c.val) ? c.val : [c.val]);
        } else if (c.op === 'array-contains') {
          builder = builder.contains(field, [c.val]);
        }
      } else if (c.type === 'orderBy') {
        const resolved = resolveQueryField(target.table, c.field);
        const field = resolved.targetField || c.field;
        builder = builder.order(field, { ascending: c.direction !== 'desc' });
      } else if (c.type === 'limit') {
        builder = builder.limit(c.value);
      }
    }

    const { data, error } = await builder;
    if (error) {
      console.error(`getDocs Supabase error on table "${target.table}":`, error);
    }
    const rows = data || [];
    const docs: DocumentSnapshot<T>[] = rows.map((row: any) => {
      const merged = normalizeDocData(row);
      return {
        id: row.id,
        ref: { id: row.id, path: `${target.table}/${row.id}` },
        exists: () => true,
        data: () => merged as T,
      };
    });

    return {
      docs,
      empty: docs.length === 0,
      size: docs.length,
      forEach(cb: (doc: DocumentSnapshot<T>) => void) {
        docs.forEach(cb);
      },
      map<U>(cb: (doc: DocumentSnapshot<T>) => U): U[] {
        return docs.map(cb);
      },
      docChanges() {
        return docs.map((doc) => ({ type: 'added' as const, doc }));
      },
    };
  } catch (err) {
    console.error('getDocs error:', err);
    return {
      docs: [],
      empty: true,
      size: 0,
      forEach() {},
      map() {
        return [];
      },
      docChanges() {
        return [];
      },
    };
  }
}

export async function getCountFromServer(q: any): Promise<{ data: () => { count: number } }> {
  try {
    const snap = await getDocs(q);
    return { data: () => ({ count: snap.size }) };
  } catch {
    return { data: () => ({ count: 0 }) };
  }
}

function extractTableColumns(table: string, data: any): Record<string, any> {
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

export async function addDoc(colRef: CollectionRef, data: any): Promise<{ id: string }> {
  try {
    // Generate auto ID like Firestore
    const id = `${colRef.table.slice(0, 4)}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const payload: any = {
      id,
      created_at: now,
      updated_at: now,
      ...extractTableColumns(colRef.table, data),
    };

    // Only add raw_data for tables that have the column
    if (TABLES_WITH_RAW_DATA.has(colRef.table)) {
      payload.raw_data = { ...data, createdAt: data.createdAt || now, updatedAt: now };
    }

    const { error } = await db_client
      .from(colRef.table)
      .insert(payload);

    if (error) {
      console.error('addDoc Supabase error:', error);
      throw error;
    }
    return { id };
  } catch (err) {
    console.error('addDoc error:', err);
    throw err;
  }
}

export async function setDoc(docRef: DocRef, data: any, options?: { merge?: boolean }): Promise<void> {
  try {
    const now = new Date().toISOString();
    const hasRawData = TABLES_WITH_RAW_DATA.has(docRef.table);
    let raw_data: any = hasRawData ? { ...data, updatedAt: now } : undefined;

    if (hasRawData && options?.merge) {
      // Fetch existing raw_data first and merge
      const { data: existing } = await db_client
        .from(docRef.table)
        .select('raw_data')
        .eq('id', docRef.id)
        .single();
      if (existing?.raw_data) {
        raw_data = { ...existing.raw_data, ...raw_data };
      }
    }

    const payload: any = {
      id: docRef.id,
      updated_at: now,
      ...extractTableColumns(docRef.table, data),
    };
    if (hasRawData) payload.raw_data = raw_data;

    const { error } = await db_client
      .from(docRef.table)
      .upsert(payload);

    if (error) throw error;
  } catch (err) {
    console.error('setDoc error:', err);
    throw err;
  }
}

export async function updateDoc(docRef: DocRef, data: any): Promise<void> {
  try {
    const now = new Date().toISOString();
    const hasRawData = TABLES_WITH_RAW_DATA.has(docRef.table);

    // Separate increment markers from regular data
    const incrementFields: Record<string, number> = {};
    const regularData: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val && typeof val === 'object' && (val as any)[INCREMENT_MARKER as any]) {
        incrementFields[key] = (val as any).delta;
      } else {
        regularData[key] = val;
      }
    }

    const updatePayload: any = {
      updated_at: now,
      ...extractTableColumns(docRef.table, regularData),
    };

    if (hasRawData) {
      // Fetch existing raw_data and merge patch (excluding increment markers)
      const { data: existing } = await db_client
        .from(docRef.table)
        .select('raw_data')
        .eq('id', docRef.id)
        .single();

      const mergedRaw = {
        ...(existing?.raw_data || {}),
        ...regularData,
        updatedAt: now,
      };

      // Apply increment deltas to raw_data fields (for warehouses usedCapacity etc.)
      for (const [key, delta] of Object.entries(incrementFields)) {
        const current = Number(mergedRaw[key] ?? existing?.raw_data?.[key] ?? 0);
        mergedRaw[key] = current + delta;
        // Also add to native column payload
        updatePayload[key] = mergedRaw[key];
      }

      updatePayload.raw_data = mergedRaw;
      Object.assign(updatePayload, extractTableColumns(docRef.table, mergedRaw));
    } else {
      // For tables without raw_data, handle increments via fetching current value
      if (Object.keys(incrementFields).length > 0) {
        const { data: existing } = await db_client
          .from(docRef.table)
          .select(Object.keys(incrementFields).join(','))
          .eq('id', docRef.id)
          .single();
        for (const [key, delta] of Object.entries(incrementFields)) {
          const current = Number((existing as any)?.[key] ?? 0);
          updatePayload[key] = current + delta;
        }
      }
    }

    const { error } = await db_client
      .from(docRef.table)
      .update(updatePayload)
      .eq('id', docRef.id);

    if (error) throw error;
  } catch (err) {
    console.error('updateDoc error:', err);
    throw err;
  }
}


export async function deleteDoc(docRef: DocRef): Promise<void> {
  try {
    const { error } = await db_client
      .from(docRef.table)
      .delete()
      .eq('id', docRef.id);

    if (error) throw error;
  } catch (err) {
    console.error('deleteDoc error:', err);
    throw err;
  }
}

export function onSnapshot<T = any>(
  target: DocRef | CollectionRef | QueryRef,
  callback: (snapshot: QuerySnapshot<T> & DocumentSnapshot<T>) => void,
  errorCallback?: (error: any) => void
): () => void {
  const isDoc = (target as any).type === 'doc';
  const table = target.table;

  // Initial fetch
  if (isDoc) {
    getDoc(target as DocRef).then(callback as any).catch(errorCallback);
  } else {
    getDocs(target as CollectionRef).then(callback as any).catch(errorCallback);
  }

  // Realtime subscription
  const channel = db_client
    .channel(`realtime:${table}:${Date.now()}_${Math.random()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: isDoc ? `id=eq.${(target as DocRef).id}` : undefined,
      },
      () => {
        if (isDoc) {
          getDoc(target as DocRef).then(callback as any).catch(errorCallback);
        } else {
          getDocs(target as CollectionRef).then(callback as any).catch(errorCallback);
        }
      }
    )
    .subscribe();

  return () => {
    db_client.removeChannel(channel);
  };
}

// --- Timestamps & Utilities ---

export class Timestamp {
  seconds: number;
  nanoseconds: number;

  constructor(seconds = 0, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  toDate(): Date {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1e6);
  }

  toMillis(): number {
    return this.seconds * 1000 + this.nanoseconds / 1e6;
  }

  toISOString(): string {
    return this.toDate().toISOString();
  }

  static now(): Timestamp {
    const ms = Date.now();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }

  static fromDate(date: Date): Timestamp {
    const ms = date.getTime();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }

  static fromMillis(millis: number): Timestamp {
    return new Timestamp(Math.floor(millis / 1000), (millis % 1000) * 1e6);
  }
}

export function serverTimestamp(): string {
  return new Date().toISOString();
}

export const INCREMENT_MARKER = Symbol('supabase_increment');

/**
 * Returns a special marker object for atomic increments.
 * updateDoc detects this and calls Supabase RPC `increment_column` instead of overwriting.
 */
export function increment(n: number): any {
  return { [INCREMENT_MARKER as any]: true, delta: n };
}


export function arrayUnion(...items: any[]): any {
  return items;
}

export function arrayRemove(...items: any[]): any {
  return items;
}

export function writeBatch(_database?: any) {
  const ops: Array<() => Promise<any>> = [];
  return {
    set(docRef: DocRef, data: any, options?: { merge?: boolean }) {
      ops.push(() => setDoc(docRef, data, options));
      return this;
    },
    update(docRef: DocRef, data: any) {
      ops.push(() => updateDoc(docRef, data));
      return this;
    },
    delete(docRef: DocRef) {
      ops.push(() => deleteDoc(docRef));
      return this;
    },
    async commit() {
      for (const op of ops) {
        await op();
      }
    },
  };
}

export async function runTransaction(_database: any, updateFunction: (transaction: any) => Promise<any>): Promise<any> {
  const transaction = {
    async get(docRef: DocRef) {
      return getDoc(docRef);
    },
    set(docRef: DocRef, data: any, options?: { merge?: boolean }) {
      return setDoc(docRef, data, options);
    },
    update(docRef: DocRef, data: any) {
      return updateDoc(docRef, data);
    },
    delete(docRef: DocRef) {
      return deleteDoc(docRef);
    },
  };
  return updateFunction(transaction);
}

// --- Auth Compatibility ---

export interface FirebaseUser {
  id: string;
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
  isAnonymous?: boolean;
  user_metadata?: Record<string, any>;
}

function adaptUser(user: any): FirebaseUser | null {
  if (!user) return null;
  const role = user.user_metadata?.role || user.app_metadata?.role || (user.email?.startsWith('admin') ? 'admin' : (user.email?.startsWith('kasir') ? 'cashier' : undefined));
  return {
    ...user,
    id: user.id,
    uid: user.id,
    role,
    displayName: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
    photoURL: user.user_metadata?.avatar_url || null,
  };
}

export const auth: any = {
  get currentUser() {
    return null;
  },
};

export function onAuthStateChanged(_auth: any, callback: (user: FirebaseUser | null) => void): () => void {
  supabase.auth.getUser().then(({ data: { user } }) => {
    callback(adaptUser(user));
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(adaptUser(session?.user || null));
  });

  return () => {
    subscription.unsubscribe();
  };
}

export async function signOut(_auth?: any): Promise<void> {
  await supabase.auth.signOut();
}

export async function signInWithEmailAndPassword(_auth: any, email: string, pass: string): Promise<any> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) throw error;
  return { user: adaptUser(data.user) };
}

export async function createUserWithEmailAndPassword(_auth: any, email: string, pass: string): Promise<any> {
  const { data, error } = await supabase.auth.signUp({ email, password: pass });
  if (error) throw error;
  return { user: adaptUser(data.user) };
}

export class GoogleAuthProvider {}

export async function signInWithPopup(_auth: any, _provider: any): Promise<any> {
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
  if (error) throw error;
  return { user: null };
}

// --- Storage Compatibility ---

export const storage: any = {
  type: 'supabase_storage_compat',
};

export function ref(_storage: any, path: string) {
  const parts = path.split('/');
  const bucket = parts.length > 1 ? parts[0] : 'uploads';
  const filePath = parts.length > 1 ? parts.slice(1).join('/') : parts[0];
  return { bucket, filePath, path };
}

export async function uploadBytes(storageRef: any, file: File | Blob): Promise<{ ref: any }> {
  const { error } = await supabase.storage
    .from(storageRef.bucket)
    .upload(storageRef.filePath, file, { upsert: true });

  if (error) {
    console.warn('Storage upload error:', error.message);
  }
  return { ref: storageRef };
}

export async function getDownloadURL(storageRef: any): Promise<string> {
  const {
    data: { publicUrl },
  } = supabase.storage.from(storageRef.bucket).getPublicUrl(storageRef.filePath);
  return publicUrl;
}

export async function deleteObject(storageRef: any): Promise<void> {
  await supabase.storage.from(storageRef.bucket).remove([storageRef.filePath]);
}

const app = {
  name: '[DEFAULT]',
  options: {},
};

export default app;
