/**
 * Perhitungan metrik laporan operasional.
 *
 * Murni (tanpa I/O) agar bisa diuji; Server Action di
 * `actions/operations-report.actions.ts` hanya bertugas mengambil data mentah.
 *
 * Manfaat pemindahan ke server: halaman ini dulu mengunduh SELURUH isi 7 tabel
 * ke browser (employees, users, warehouses, products, orders,
 * inventory_transactions, operational_expenses) hanya untuk menghitung 8 angka.
 * Sekarang yang dikirim hanya 8 baris metrik.
 */

export interface OperationalMetric {
  id: string;
  name: string;
  category: string;
  value: number | string;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  description: string;
}

export interface OperationsMetricsInput {
  employees: Record<string, any>[];
  users: Record<string, any>[];
  warehouses: Record<string, any>[];
  products: Record<string, any>[];
  orders: Record<string, any>[];
  expenses: Record<string, any>[];
  /** Batas waktu untuk menghitung user aktif (epoch ms). */
  activeUserCutoff: number;
}

/** Jendela "user aktif" dalam hari. */
export const ACTIVE_USER_WINDOW_DAYS = 7;

/** Ambang stok rendah (unit). */
export const LOW_STOCK_THRESHOLD = 10;

/**
 * Ubah nilai apa pun menjadi angka terbatas. Nilai tidak valid (null, string
 * non-numerik, NaN) menjadi 0.
 *
 * Tanpa ini, satu nilai gaji yang rusak akan membuat SELURUH total menjadi NaN
 * (`0 + 3_000_000 + NaN = NaN`) — perilaku kode lama yang diperbaiki di sini.
 */
function toFiniteNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Hitung batas waktu user aktif dari waktu sekarang. */
export function activeUserCutoffFrom(nowMs: number): number {
  return nowMs - ACTIVE_USER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function buildOperationsMetrics(input: OperationsMetricsInput): OperationalMetric[] {
  const { employees, users, warehouses, products, orders, expenses, activeUserCutoff } = input;

  const activeEmployees = employees.filter(
    (e) => String(e.status).toUpperCase() === 'AKTIF'
  );
  const totalPayroll = activeEmployees.reduce((s, e) => s + toFiniteNumber(e.manualSalary), 0);

  const activeUsers = users.filter(
    (u) => u.lastActive && new Date(u.lastActive).getTime() > activeUserCutoff
  ).length;

  const fullWarehouses = warehouses.filter(
    (wh) => (Number(wh.usedCapacity) / Number(wh.capacity)) >= 0.9
  ).length;

  const outOfStock = products.filter((p) => Number(p.stock) === 0).length;
  const lowStock = products.filter(
    (p) => Number(p.stock) > 0 && Number(p.stock) <= LOW_STOCK_THRESHOLD
  ).length;

  const pendingOrders = orders.filter((o) => o.status === 'MENUNGGU').length;
  const totalExpenses = expenses.reduce((s, e) => s + toFiniteNumber(e.amount), 0);

  return [
    { id: 'emp-1', name: 'Active Personnel', category: 'Karyawan', value: activeEmployees.length, unit: 'pax', status: activeEmployees.length > 0 ? 'good' : 'warning', description: 'Currently active workforce' },
    { id: 'emp-2', name: 'Payroll Exposure', category: 'Karyawan', value: totalPayroll, unit: 'Rp', status: 'good', description: 'Monthly salary accumulation' },
    { id: 'user-1', name: 'User Retention', category: 'Pengguna', value: activeUsers, unit: 'users', status: activeUsers > 0 ? 'good' : 'warning', description: 'Active in last 7 days' },
    { id: 'wh-1', name: 'Capacity Alert', category: 'Gudang', value: fullWarehouses, unit: 'units', status: fullWarehouses > 0 ? 'critical' : 'good', description: 'Warehouses >90% full' },
    { id: 'inv-1', name: 'Critical Stock', category: 'Inventory', value: outOfStock, unit: 'SKUs', status: outOfStock > 0 ? 'critical' : 'good', description: 'Out of stock products' },
    { id: 'inv-2', name: 'Low Stock SKU', category: 'Inventory', value: lowStock, unit: 'SKUs', status: lowStock > 5 ? 'critical' : 'warning', description: 'Stock below 10 units' },
    { id: 'ord-1', name: 'Pending Pipeline', category: 'Pesanan', value: pendingOrders, unit: 'orders', status: pendingOrders > 5 ? 'critical' : 'warning', description: 'Orders awaiting process' },
    { id: 'exp-1', name: 'OpEx Total', category: 'Expenses', value: totalExpenses, unit: 'Rp', status: 'good', description: 'Total operational cost' },
  ];
}
