import { describe, it, expect } from 'vitest';
import {
  buildOperationsMetrics,
  activeUserCutoffFrom,
  ACTIVE_USER_WINDOW_DAYS,
  type OperationsMetricsInput,
} from './operations-metrics';

const NOW = Date.parse('2026-10-01T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function makeInput(over: Partial<OperationsMetricsInput> = {}): OperationsMetricsInput {
  return {
    employees: [],
    users: [],
    warehouses: [],
    products: [],
    orders: [],
    expenses: [],
    activeUserCutoff: activeUserCutoffFrom(NOW),
    ...over,
  };
}

const metric = (rows: ReturnType<typeof buildOperationsMetrics>, id: string) =>
  rows.find((m) => m.id === id)!;

describe('activeUserCutoffFrom', () => {
  it('memundurkan waktu sebesar jendela hari', () => {
    expect(activeUserCutoffFrom(NOW)).toBe(NOW - ACTIVE_USER_WINDOW_DAYS * DAY);
  });
});

describe('buildOperationsMetrics', () => {
  it('menghitung karyawan aktif dan mengabaikan nilai gaji yang rusak', () => {
    const rows = buildOperationsMetrics(
      makeInput({
        employees: [
          { status: 'AKTIF', manualSalary: 3_000_000 },
          { status: 'aktif', manualSalary: 'tidak-valid' }, // diabaikan, bukan meracuni total
          { status: 'NONAKTIF', manualSalary: 9_999_999 },
        ],
      })
    );

    // Kedua baris dihitung aktif (perbandingan huruf besar)
    expect(metric(rows, 'emp-1').value).toBe(2);
    expect(metric(rows, 'emp-1').status).toBe('good');
    // Nilai rusak dianggap 0, sehingga total tetap angka wajar (bukan NaN)
    expect(metric(rows, 'emp-2').value).toBe(3_000_000);
  });

  it('menandai warning bila tidak ada karyawan aktif', () => {
    const rows = buildOperationsMetrics(makeInput({ employees: [{ status: 'NONAKTIF' }] }));
    expect(metric(rows, 'emp-1').value).toBe(0);
    expect(metric(rows, 'emp-1').status).toBe('warning');
  });

  it('menghitung user aktif hanya yang melewati batas waktu', () => {
    const rows = buildOperationsMetrics(
      makeInput({
        users: [
          { lastActive: new Date(NOW - 1 * DAY).toISOString() }, // aktif
          { lastActive: new Date(NOW - 10 * DAY).toISOString() }, // lama
          { lastActive: null }, // tidak pernah
        ],
      })
    );
    expect(metric(rows, 'user-1').value).toBe(1);
    expect(metric(rows, 'user-1').status).toBe('good');
  });

  it('menghitung gudang yang terisi >= 90%', () => {
    const rows = buildOperationsMetrics(
      makeInput({
        warehouses: [
          { usedCapacity: 90, capacity: 100 }, // 90% -> terhitung
          { usedCapacity: 89, capacity: 100 }, // di bawah ambang
          { usedCapacity: 10, capacity: 0 }, // Infinity -> terhitung
        ],
      })
    );
    expect(metric(rows, 'wh-1').value).toBe(2);
    expect(metric(rows, 'wh-1').status).toBe('critical');
  });

  it('menghitung stok habis dan stok rendah secara terpisah', () => {
    const rows = buildOperationsMetrics(
      makeInput({
        products: [
          { stock: 0 }, { stock: 0 }, // habis
          { stock: 1 }, { stock: 10 }, // rendah
          { stock: 11 }, // normal
        ],
      })
    );
    expect(metric(rows, 'inv-1').value).toBe(2);
    expect(metric(rows, 'inv-1').status).toBe('critical');
    expect(metric(rows, 'inv-2').value).toBe(2);
    expect(metric(rows, 'inv-2').status).toBe('warning');
  });

  it('menandai stok rendah kritis bila lebih dari 5 SKU', () => {
    const products = Array.from({ length: 6 }, () => ({ stock: 3 }));
    const rows = buildOperationsMetrics(makeInput({ products }));
    expect(metric(rows, 'inv-2').value).toBe(6);
    expect(metric(rows, 'inv-2').status).toBe('critical');
  });

  it('hanya menghitung pesanan berstatus MENUNGGU', () => {
    const rows = buildOperationsMetrics(
      makeInput({ orders: [{ status: 'MENUNGGU' }, { status: 'MENUNGGU' }, { status: 'SELESAI' }] })
    );
    expect(metric(rows, 'ord-1').value).toBe(2);
    expect(metric(rows, 'ord-1').status).toBe('warning');
  });

  it('menandai pipeline pesanan kritis bila lebih dari 5', () => {
    const orders = Array.from({ length: 6 }, () => ({ status: 'MENUNGGU' }));
    const rows = buildOperationsMetrics(makeInput({ orders }));
    expect(metric(rows, 'ord-1').status).toBe('critical');
  });

  it('menjumlahkan biaya operasional', () => {
    const rows = buildOperationsMetrics(
      makeInput({ expenses: [{ amount: 1500 }, { amount: '2500' }, { amount: null }] })
    );
    expect(metric(rows, 'exp-1').value).toBe(4000);
  });

  it('selalu mengembalikan 8 metrik walau semua data kosong', () => {
    const rows = buildOperationsMetrics(makeInput());
    expect(rows).toHaveLength(8);
    expect(rows.every((m) => m.category && m.unit)).toBe(true);
  });
});
