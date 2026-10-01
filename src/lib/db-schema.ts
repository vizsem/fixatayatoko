/**
 * Skema database bersama — SATU SUMBER KEBENARAN.
 * ================================================
 * Konstanta dan helper di bawah ini sebelumnya DIDUPLIKASI di dua modul:
 *   - `src/lib/firebase.ts`        (bridge Firestore → Supabase)
 *   - `src/lib/supabase-helpers.ts` (helper `sb*` untuk akses langsung)
 *
 * Keduanya perlahan menyimpang sehingga tabel yang sama ditulis dengan bentuk
 * berbeda tergantung API yang dipakai. Contoh nyata sebelum penyatuan ini:
 *
 *   | Konstanta                | firebase.ts | supabase-helpers.ts |
 *   |--------------------------|-------------|---------------------|
 *   | TABLES_WITH_RAW_DATA     | 17 entri    | 19 entri            |
 *   | CAMEL_TO_SNAKE           | tanpa isActive | dengan isActive  |
 *   | extractTableColumns      | tanpa Status→is_active | dengan  |
 *
 * **Jangan menyalin isi file ini ke modul lain.** Impor dari sini.
 *
 * Catatan bentuk tabel:
 * - Tabel "raw_data" menyimpan payload Firestore apa adanya di kolom JSONB
 *   `raw_data`, sementara beberapa kolom penting di-*promosikan* menjadi kolom
 *   asli agar bisa di-query/di-index (lihat `extractTableColumns`).
 * - `TABLE_COLUMNS` didaftarkan LEBIH DULU daripada fallback `raw_data->>field`
 *   di `resolveQueryField`, jadi kolom asli selalu menang.
 */

/** Tabel yang memiliki kolom JSONB `raw_data`. */
export const TABLES_WITH_RAW_DATA = new Set([
  'products', 'orders', 'customers', 'suppliers', 'purchases',
  'warehouses', 'categories', 'cashier_shifts', 'inventory_logs', 'stock_logs',
  'chats', 'ledger_entries', 'capital_transactions', 'wallet_logs', 'notifications', 'settings',
  'operational_expenses',
  // Terverifikasi punya kolom raw_data di Supabase remote (2026-10-01):
  'inventory_transactions',
  // Dibuat oleh migrasi 20261007. `messages` menampung pesan chat (dulu
  // subcollection Firestore `chats/{id}/messages`), `carts` menampung keranjang
  // per pengguna. Keduanya ditulis lewat bridge, jadi harus terdaftar di sini
  // agar `buildWritePayload` benar-benar menuliskan `raw_data`.
  'messages',
  'carts',
  // Bentuk historisnya hanya `id` + `raw_data`; migrasi 20260930 menambahkan
  // kolom asli di sampingnya (lihat TABLE_COLUMNS di bawah).
  'product_cost_logs',
  // Modul HR/payroll (`admin/employees`). Seluruh tabel ini berbentuk
  // `id`, `raw_data`, `created_at`, `updated_at` saja — datanya memang
  // disimpan di `raw_data`, sehingga wajib terdaftar di sini agar
  // `buildWritePayload` benar-benar menuliskan `raw_data`.
  //
  // Tanpa pendaftaran ini, penyimpanan karyawan menghasilkan baris berisi
  // `id`/`created_at`/`updated_at` saja dan seluruh isinya hilang.
  //
  // `employees`, `attendance_records`, dan `payroll_slips` sudah ada di remote
  // sejak awal; 12 sisanya dibuat oleh migrasi 20261003.
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
]);

/**
 * Kolom asli yang benar-benar ada di tiap tabel.
 * Dipakai `resolveQueryField` untuk memutuskan apakah sebuah field dipetakan
 * ke kolom asli atau ke `raw_data->>field`.
 */
export const TABLE_COLUMNS: Record<string, Set<string>> = {
  products: new Set(['id', 'name', 'description', 'price', 'stock', 'created_at', 'updated_at', 'sku', 'category', 'unit', 'cost_price', 'image_url', 'barcode', 'is_active', 'raw_data']),
  orders: new Set(['id', 'user_id', 'status', 'total', 'created_at', 'updated_at', 'order_id', 'customer_name', 'customer_phone', 'items', 'payment', 'delivery', 'raw_data']),
  customers: new Set(['id', 'name', 'email', 'phone', 'address', 'created_at', 'updated_at', 'raw_data']),
  suppliers: new Set(['id', 'name', 'contact', 'created_at', 'updated_at', 'raw_data']),
  purchases: new Set(['id', 'supplier_id', 'total', 'status', 'created_at', 'updated_at', 'raw_data']),
  warehouses: new Set(['id', 'name', 'location', 'created_at', 'updated_at', 'raw_data']),
  categories: new Set(['id', 'name', 'created_at', 'updated_at', 'raw_data']),
  // users TIDAK punya kolom raw_data
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
  // Dibuat oleh migrasi 20261007.
  // `carts`: id dan user_id dibuat sama oleh pemanggil supaya dua jalur tulis
  // (CartContext lewat onConflict user_id, dan sbUpsertDoc lewat id) mengarah
  // ke baris yang sama.
  carts: new Set(['id', 'user_id', 'items', 'raw_data', 'created_at', 'updated_at']),
  // `messages`: chat_id adalah penaut ke percakapan induk. Bridge mengisinya
  // dari path subcollection Firestore `chats/{chatId}/messages`.
  messages: new Set(['id', 'chat_id', 'text', 'sender_id', 'type', 'image_url', 'is_read', 'raw_data', 'created_at', 'updated_at']),
  operational_expenses: new Set(['id', 'created_at', 'updated_at', 'raw_data']),
  // Kolom camelCase (dibuat oleh migrasi 20260930). Sengaja dipertahankan
  // camelCase karena `product.actions.ts` menulis `insert({ productId, ... })`.
  product_cost_logs: new Set(['id', 'productId', 'productName', 'oldCost', 'newCost', 'adminEmail', 'changeDate', 'notes', 'source', 'created_at', 'raw_data']),
};

/** Pemetaan nama field gaya Firestore/camelCase → nama kolom snake_case. */
export const CAMEL_TO_SNAKE: Record<string, string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  orderId: 'order_id',
  userId: 'user_id',
  chatId: 'chat_id',
  senderId: 'sender_id',
  isRead: 'is_read',
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

/**
 * Tentukan nama kolom target untuk sebuah field pada sebuah tabel.
 *
 * Urutan: id → kolom asli (TABLE_COLUMNS) → `raw_data->>field` → apa adanya.
 */
export function resolveQueryField(table: string, field: string): { targetField?: string; ignore?: boolean } {
  if (field === '__name__' || field === 'id') return { targetField: 'id' };

  // products punya kolom is_active
  if (table === 'products' && (field === 'isActive' || field === 'is_active')) {
    return { targetField: 'is_active' };
  }

  // users memakai full_name, bukan name
  if (table === 'users' && (field === 'name' || field === 'displayName')) {
    return { targetField: 'full_name' };
  }

  const normalized = CAMEL_TO_SNAKE[field] || field;
  const cols = TABLE_COLUMNS[table];

  if (cols && cols.has(normalized)) {
    return { targetField: normalized };
  }

  // Kolom asli juga bisa ditulis langsung dalam camelCase (mis. product_cost_logs)
  if (cols && cols.has(field)) {
    return { targetField: field };
  }

  // Hanya pakai raw_data->>field bila tabel benar-benar punya kolom raw_data
  if (TABLES_WITH_RAW_DATA.has(table)) {
    return { targetField: `raw_data->>${field}` };
  }

  // Tabel tanpa raw_data (mis. users): pakai field apa adanya
  return { targetField: normalized };
}

/**
 * Gabungkan kolom asli dengan `raw_data` saat sebuah baris DIBACA.
 *
 * URUTAN PRIORITAS
 *   1. Kolom asli yang dikelola bridge (`TABLE_COLUMNS[table]`) — selalu menang,
 *      jadi `products.stock` tetap dibaca dari kolom yang memang di-update.
 *   2. `raw_data` — menang atas kolom yang TIDAK dikelola bridge.
 *   3. Kolom non-bridge dipakai hanya bila `raw_data` tidak punya field itu.
 *   Di semua kasus, kolom bernilai NULL/undefined dianggap "tidak berisi" dan
 *   tidak boleh menghapus nilai yang ada di `raw_data`.
 *
 * MENGAPA URUTAN INI PENTING (bug nyata, diverifikasi ke database 2026-10-01)
 * Importer massal Firestore → Postgres mengisi `raw_data`, `created_at`, dan
 * `updated_at`, tetapi membiarkan kolom tambahan pada nilai DEFAULT-nya:
 *
 *   capital_transactions : 171/171 baris punya `type = NULL` dan `amount = 0`
 *                          di kolom, padahal `raw_data` berisi
 *                          `type = 'WITHDRAWAL'`, `amount = 2600000`.
 *   ledger_entries       : 167/167 baris `amount = 0`.
 *   operational_expenses : 46/46 baris `amount = 0`.
 *
 * Dengan urutan lama — `{ ...raw, ...row }` — kolom DEFAULT itu MENIMPA nilai
 * sebenarnya. Akibatnya saldo modal terbaca Rp0 sehingga setiap pembelian tunai
 * ditolak dengan "Saldo Modal Tidak Cukup", dan laporan keuangan menampilkan
 * arus kas Rp0. Kolom `date` pada ketiga tabel itu juga masih berisi waktu
 * INSERT importer, bukan tanggal transaksi.
 *
 * Kolom yang TIDAK dikelola bridge tidak dipercaya karena bridge tidak pernah
 * menulisnya: nilai awalnya berasal dari DEFAULT kolom saat impor, atau diisi
 * di luar aplikasi. Sebaliknya kolom yang dikelola selalu ditulis bridge pada
 * setiap `setDoc`/`updateDoc`, jadi nilainya otoritatif.
 */
export function mergeRowWithRawData(
  row: Record<string, any>,
  table?: string
): Record<string, any> {
  const raw =
    row.raw_data && typeof row.raw_data === 'object' ? (row.raw_data as Record<string, any>) : {};
  const managed = table ? TABLE_COLUMNS[table] : undefined;
  // Isi `raw_data` diratakan ke permukaan supaya `data.units`, `data.Modal`,
  // `data.channelPricing`, dst. bisa dibaca langsung.
  const merged: Record<string, any> = { ...raw };

  // TAPI properti `raw_data` itu sendiri HARUS TETAP ADA.
  //
  // Banyak pembaca memakai bentuk `const raw = data.raw_data || {}` (laporan
  // keuangan, perhitungan satuan/konversi, HPP). Kalau properti ini hilang,
  // `raw` menjadi objek kosong dan pembacaannya DIAM-DIAM salah — bukan error.
  // Contoh nyata (regresi 2026-10-01): HPP FORTUNE BANTAL 1L terbaca
  // Rp304.995 (15 CTN dihitung 15 pcs) padahal seharusnya Rp3.659.940
  // (15 × 12 pcs × Rp20.333), sehingga "laba bersih" melonjak jadi Rp3.445.005.
  merged.raw_data = raw;

  for (const [key, value] of Object.entries(row)) {
    // `raw_data` sudah ditangani di atas (isinya diratakan, propertinya disimpan).
    if (key === 'raw_data') continue;
    // NULL/undefined tidak membawa informasi: jangan menghapus isi raw_data.
    if (value === null || value === undefined) continue;
    // Kolom di luar kendali bridge jangan menimpa raw_data.
    if (managed && !managed.has(key) && key in raw) continue;
    merged[key] = value;
  }

  return merged;
}

/**
 * Konversi timestamp Firestore (objek `{ _seconds, _nanoseconds }`) atau
 * ISO string / epoch ms menjadi `Date`.
 */
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

/**
 * Ambil kolom asli dari sebuah payload tulis (promosi dari `raw_data`).
 * Tabel yang tidak punya cabang di sini hanya mengandalkan `raw_data`.
 */
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
  } else if (table === 'carts') {
    if (data.userId !== undefined) cols.user_id = data.userId;
    if (data.items !== undefined) cols.items = data.items;
  } else if (table === 'messages') {
    if (data.chatId !== undefined) cols.chat_id = data.chatId;
    if (data.text !== undefined) cols.text = data.text;
    if (data.senderId !== undefined) cols.sender_id = data.senderId;
    if (data.type !== undefined) cols.type = data.type;
    if (data.imageUrl !== undefined) cols.image_url = data.imageUrl;
    if (data.isRead !== undefined) cols.is_read = data.isRead;
  } else if (table === 'product_cost_logs') {
    // Kolom camelCase — lihat catatan di TABLE_COLUMNS.
    if (data.productId !== undefined) cols.productId = data.productId;
    if (data.productName !== undefined) cols.productName = data.productName;
    if (data.oldCost !== undefined) cols.oldCost = Number(data.oldCost);
    if (data.newCost !== undefined) cols.newCost = Number(data.newCost);
    if (data.adminEmail !== undefined) cols.adminEmail = data.adminEmail;
    else if (data.adminId !== undefined) cols.adminEmail = data.adminId;
    if (data.changeDate !== undefined) cols.changeDate = data.changeDate;
    if (data.notes !== undefined) cols.notes = data.notes;
    else if (data.reason !== undefined) cols.notes = data.reason;
    if (data.source !== undefined) cols.source = data.source;
  }
  return cols;
}

/** ID bergaya Firestore: `<4 huruf pertama tabel>_<epoch>_<acak>`. */
export function generateId(table: string): string {
  return `${table.slice(0, 4)}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
