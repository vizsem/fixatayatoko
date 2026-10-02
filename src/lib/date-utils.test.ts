import { describe, it, expect } from 'vitest';
import { coerceDate, isWithinRange } from './date-utils';

describe('date-utils', () => {
  it('menerjemahkan string ISO menjadi Date', () => {
    const date = coerceDate('2024-06-10T08:30:00.000Z');
    expect(date).toBeInstanceOf(Date);
    expect(date?.getUTCFullYear()).toBe(2024);
    expect(date?.getUTCMonth()).toBe(5);
  });

  it('menerjemahkan timestamp Firestore-like menjadi Date', () => {
    const date = coerceDate({ seconds: 1717999200, nanoseconds: 0 });
    expect(date).toBeInstanceOf(Date);
    expect(date?.toISOString().startsWith('2024-06-10T')).toBe(true);
  });

  it('membandingkan tanggal dengan rentang yang benar untuk data kasir', () => {
    const start = new Date('2024-06-01T00:00:00.000Z');
    const end = new Date('2024-06-30T23:59:59.999Z');
    expect(isWithinRange('2024-06-15T10:00:00.000Z', start, end)).toBe(true);
    expect(isWithinRange('2024-07-01T00:00:00.000Z', start, end)).toBe(false);
  });
});
