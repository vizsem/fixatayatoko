'use client';

import { generateId } from '@/lib/db-schema';
import * as hr from '@/lib/actions/hr-data.actions';

/**
 * Penyesuai (adapter) tipis untuk halaman `admin/employees`.
 *
 * KENAPA ADA
 * Halaman itu mengakses basis data langsung dari browser memakai
 * `sbGetDocs` dan bridge `@/lib/firebase`. Di browser, `supabaseAdmin`
 * jatuh ke kunci anon tanpa sesi pengguna sehingga RLS menolaknya — itulah
 * sebab halaman tersebut selalu kosong.
 *
 * Modul ini mempertahankan BENTUK API yang sama persis, tetapi setiap
 * panggilan kini diteruskan ke Server Action (`hr-data.actions.ts`) yang
 * berjalan di server dengan kunci service role dan memeriksa identitas
 * pemanggil lebih dulu. Dengan begitu halaman tidak perlu ditulis ulang,
 * sementara browser tidak lagi menyentuh basis data.
 *
 * Keterbatasan yang diwarisi dan sengaja tidak diubah di sini:
 *   - `runTransaction` TIDAK benar-benar transaksional. Implementasi bridge
 *     yang lama pun hanya menjalankan baca-lalu-tulis secara berurutan.
 *     Menjadikannya atomik perlu memindahkan logika perhitungannya ke SQL,
 *     yang merupakan pekerjaan tersendiri.
 *   - `arrayUnion` hanya mengembalikan array, sehingga nilai lama tetap
 *     tertimpa (sama seperti perilaku bridge sebelumnya).
 */

// --- Deskriptor query --------------------------------------------------------

export const db: { readonly __db: true } = { __db: true };

export interface CollectionRef {
  __table: string;
}

export interface DocRef {
  __table: string;
  __id: string;
}

interface WhereConstraint {
  __c: 'where';
  field: string;
  op: string;
  val: unknown;
}

interface OrderByConstraint {
  __c: 'orderBy';
  field: string;
  direction: 'asc' | 'desc';
}

export function collection(_database: unknown, table: string): CollectionRef {
  return { __table: table };
}

/**
 * Mendukung dua bentuk seperti bridge lama:
 *   doc(db, 'employees', id)      -> menunjuk baris tertentu
 *   doc(collection(db, 'x'))      -> id baru yang belum disimpan
 */
export function doc(target: unknown, tableOrId?: string, id?: string): DocRef {
  const fromCollection = target as CollectionRef | undefined;
  if (fromCollection && typeof fromCollection.__table === 'string') {
    return {
      __table: fromCollection.__table,
      __id: tableOrId ?? generateId(fromCollection.__table),
    };
  }
  return { __table: String(tableOrId), __id: String(id) };
}

export function where(field: string, op: string, val: unknown): WhereConstraint {
  return { __c: 'where', field, op, val };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): OrderByConstraint {
  return { __c: 'orderBy', field, direction };
}

export interface QueryRef {
  table: string;
  where: Array<{ field: string; op: string; val: unknown }>;
  orderBy: Array<{ field: string; direction?: 'asc' | 'desc' }>;
  limit?: number;
}

export function query(target: CollectionRef, ...constraints: unknown[]): QueryRef {
  const result: QueryRef = { table: target.__table, where: [], orderBy: [] };

  for (const constraint of constraints) {
    const c = constraint as WhereConstraint | OrderByConstraint;
    if (c?.__c === 'where') {
      result.where.push({ field: c.field, op: c.op, val: c.val });
    } else if (c?.__c === 'orderBy') {
      result.orderBy.push({ field: c.field, direction: c.direction });
    }
  }

  return result;
}

export function limit(value: number): { __c: 'limit'; value: number } {
  return { __c: 'limit', value };
}

// --- Bentuk hasil yang ditiru ------------------------------------------------

export interface DocSnapshot<T = Record<string, unknown>> {
  id: string;
  exists: () => boolean;
  data: () => T;
  get: (field: string) => unknown;
}

export interface QuerySnapshot<T = Record<string, unknown>> {
  docs: Array<DocSnapshot<T>>;
  empty: boolean;
  size: number;
  length: number;
  forEach: (cb: (doc: DocSnapshot<T>, index: number) => void) => void;
  map: <U>(cb: (doc: DocSnapshot<T>, index: number) => U) => U[];
}

function toDocSnapshot<T>(row: { id: string; exists: boolean; data: T }): DocSnapshot<T> {
  const data = (row.data ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    exists: () => row.exists,
    data: () => row.data,
    get: (field: string) => data[field],
  };
}

function toQuerySnapshot<T>(snapshot: hr.HrQuerySnapshot<T>): QuerySnapshot<T> {
  const docs = (snapshot.docs ?? []).map(toDocSnapshot);
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    length: docs.length,
    forEach: (cb) => docs.forEach(cb),
    map: (cb) => docs.map(cb),
  };
}

// --- Pembacaan ---------------------------------------------------------------

export async function getDocs(q: QueryRef): Promise<QuerySnapshot> {
  return toQuerySnapshot(await hr.hrFetchDocs(q));
}

export async function sbGetDocs(params: {
  table: string;
  where?: Array<{ field: string; op: string; val: unknown }>;
  orderBy?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
  limit?: number;
  /** Diabaikan: server selalu memakai kunci service role setelah memeriksa peran. */
  useAdmin?: boolean;
}): Promise<QuerySnapshot> {
  return toQuerySnapshot(await hr.hrFetchDocs(params));
}

export async function sbGetDoc(
  table: string,
  id: string,
  /** Diabaikan (lihat catatan pada `sbGetDocs`). */
  _useAdmin?: boolean
): Promise<{ id: string; exists: () => boolean; data: () => Record<string, unknown> }> {
  const result = await hr.hrFetchDoc(table, id);
  const snapshot = toDocSnapshot(result);
  return { id: snapshot.id, exists: snapshot.exists, data: snapshot.data };
}

// --- Penulisan ---------------------------------------------------------------

export async function sbInsertDoc(
  table: string,
  data: Record<string, unknown>,
  /** Diabaikan (lihat catatan pada `sbGetDocs`). */
  _useAdmin?: boolean
): Promise<{ id: string }> {
  return hr.hrInsert(table, data);
}

export async function sbUpdateDoc(
  table: string,
  id: string,
  data: Record<string, unknown>,
  /** Diabaikan (lihat catatan pada `sbGetDocs`). */
  _useAdmin?: boolean
): Promise<void> {
  return hr.hrUpdate(table, id, data);
}

export async function sbUpsertDoc(
  table: string,
  id: string,
  data: Record<string, unknown>,
  /** Diabaikan: opsi `merge` dan `useAdmin` tidak lagi bermakna di server. */
  _optionsOrUseAdmin?: boolean | { merge?: boolean; useAdmin?: boolean }
): Promise<void> {
  return hr.hrUpsert(table, id, data);
}

export async function sbDeleteDoc(
  table: string,
  id: string,
  /** Diabaikan (lihat catatan pada `sbGetDocs`). */
  _useAdmin?: boolean
): Promise<void> {
  return hr.hrDelete(table, id);
}

export async function setDoc(
  ref: DocRef,
  data: Record<string, unknown>,
  /** Diabaikan: opsi `merge` tidak bermakna karena penulisan selalu berupa upsert. */
  _options?: { merge?: boolean }
): Promise<void> {
  return hr.hrSetDoc(ref.__table, ref.__id, data);
}

// --- Nilai khusus ------------------------------------------------------------

/**
 * Penanda penambahan nilai.
 *
 * Bridge lama memakai Symbol sebagai penanda, dan Symbol tidak dapat
 * menyeberangi batas Server Action. Sisi server menerjemahkan objek ini
 * kembali menjadi penanda asli (lihat `reviveIncrements`).
 */
export function increment(n: number): { __increment: number } {
  return { __increment: n };
}

/** Sama seperti bridge lama: hanya mengembalikan array nilai. */
export function arrayUnion(...items: unknown[]): unknown[] {
  return items;
}

export function arrayRemove(...items: unknown[]): unknown[] {
  return items;
}

// --- Transaksi ---------------------------------------------------------------

export interface ShimTransaction {
  get: (ref: DocRef) => Promise<DocSnapshot>;
  set: (ref: DocRef, data: Record<string, unknown>, options?: { merge?: boolean }) => Promise<void>;
  update: (ref: DocRef, data: Record<string, unknown>) => Promise<void>;
  delete: (ref: DocRef) => Promise<void>;
}

/**
 * Menjalankan callback dengan transaksi tiruan, sama seperti bridge lama
 * (baca-lalu-tulis berurutan, bukan transaksi basis data sungguhan).
 * Bedanya, setiap operasi kini melewati Server Action sehingga
 * terautentikasi dan benar-benar tersimpan.
 */
export async function runTransaction<T>(
  _database: unknown,
  updateFunction: (tx: ShimTransaction) => Promise<T>
): Promise<T> {
  const tx: ShimTransaction = {
    async get(ref) {
      return toDocSnapshot(await hr.hrFetchDoc(ref.__table, ref.__id));
    },
    set: (ref, data) => hr.hrSetDoc(ref.__table, ref.__id, data),
    update: (ref, data) => hr.hrUpdate(ref.__table, ref.__id, data),    delete: (ref) => hr.hrDelete(ref.__table, ref.__id),
  };

  return updateFunction(tx);
}

export { generateId };
