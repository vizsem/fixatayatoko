import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/firebase', () => {
  const M = Symbol('supabase_increment');
  return {
    db: {},
    INCREMENT_MARKER: M,
    increment: (n: any) => ({ [M]: true, delta: n }),
  };
});
import { computeAverageCost } from './inventory';

import { db } from '@/lib/firebase';
describe('computeAverageCost', () => {
  it('calculates weighted average cost with conversion', () => {
    const avg = computeAverageCost(100, 1000, 5, 15000, 10);
    expect(avg).toBe(1167);
  });

  it('falls back to incoming cost when old cost not set', () => {
    const avg = computeAverageCost(0, 0, 2, 2000, 1);
    expect(avg).toBe(2000);
  });
});
