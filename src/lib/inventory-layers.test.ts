import { describe, it, expect } from 'vitest';
import {
  pushLayer,
  consumeFifo,
  reconstructLayersFromLogs,
  tsMs,
  isInboundType,
  isOutboundType,
} from './inventory-layers';

describe('pushLayer', () => {
  it('menambahkan batch baru di belakang antrean', () => {
    const base = [{ qty: 10, costPerPcs: 1000 }];
    const next = pushLayer(base, { qty: 5, costPerPcs: 1200 });
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ qty: 5, costPerPcs: 1200 });
  });

  it('mengabaikan qty non-positif', () => {
    expect(pushLayer([], { qty: 0, costPerPcs: 100 })).toEqual([]);
    expect(pushLayer([], { qty: -3, costPerPcs: 100 })).toEqual([]);
  });
});

describe('consumeFifo', () => {
  const layers = [
    { qty: 10, costPerPcs: 1000 },
    { qty: 5, costPerPcs: 2000 },
  ];

  it('memakan batch tertua lebih dulu', () => {
    const res = consumeFifo(layers, 12);
    expect(res.consumedQty).toBe(12);
    expect(res.consumedCost).toBe(10 * 1000 + 2 * 2000); // 14000
    expect(res.shortage).toBe(0);
    expect(res.remaining).toHaveLength(1);
    expect(res.remaining[0]).toMatchObject({ qty: 3, costPerPcs: 2000 });
  });

  it('mencatat kekurangan bila layer tidak cukup', () => {
    const res = consumeFifo(layers, 20);
    expect(res.consumedQty).toBe(15);
    expect(res.shortage).toBe(5);
    expect(res.remaining).toEqual([]);
  });

  it('membulatkan biaya termakan', () => {
    const res = consumeFifo([{ qty: 1, costPerPcs: 10.6 }], 1);
    expect(res.consumedCost).toBe(11);
  });
});

describe('reconstructLayersFromLogs', () => {
  it('menyusun layer FIFO dari aliran log masuk/keluar', () => {
    const logs = [
      { type: 'MASUK', amount: 10, costPerPcs: 1000, ts: '2026-01-01T00:00:00Z' },
      { type: 'MASUK', amount: 5, costPerPcs: 2000, ts: '2026-02-01T00:00:00Z' },
      { type: 'KELUAR', amount: 12, ts: '2026-03-01T00:00:00Z' },
    ];
    const layers = reconstructLayersFromLogs(logs);
    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatchObject({ qty: 3, costPerPcs: 2000 });
  });

  it('mengabaikan tipe log yang tidak dikenali (mis. MUTASI)', () => {
    const logs = [
      { type: 'MASUK', amount: 10, costPerPcs: 1000, ts: 1000 },
      { type: 'MUTASI', amount: 4, ts: 2000 },
    ];
    expect(reconstructLayersFromLogs(logs)).toHaveLength(1);
  });

  it('memakai fallbackCost untuk batch masuk tanpa harga', () => {
    const logs = [{ type: 'MASUK', amount: 7, ts: 1000 }];
    const layers = reconstructLayersFromLogs(logs, () => 1500);
    expect(layers[0].costPerPcs).toBe(1500);
  });
});

describe('helpers', () => {
  it('tsMs memahami string ISO, epoch, dan objek {seconds}', () => {
    expect(tsMs('2026-01-01T00:00:00.000Z')).toBe(Date.parse('2026-01-01T00:00:00.000Z'));
    expect(tsMs(5000)).toBe(5000);
    expect(tsMs({ seconds: 3, nanoseconds: 0 })).toBe(3000);
    expect(tsMs(undefined)).toBe(0);
  });

  it('isInboundType/isOutboundType case-insensitive', () => {
    expect(isInboundType('masuk')).toBe(true);
    expect(isInboundType('IN')).toBe(true);
    expect(isOutboundType('keluar')).toBe(true);
    expect(isOutboundType('ORDER')).toBe(true);
    expect(isInboundType('MUTASI')).toBe(false);
    expect(isOutboundType('MUTASI')).toBe(false);
  });
});
