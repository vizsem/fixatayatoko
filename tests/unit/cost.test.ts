import { describe, it, expect } from 'vitest';
import { computeAverageCost } from '@/lib/inventory';

describe('computeAverageCost', () => {
  it('calculates weighted average cost with conversion', () => {
    // Old: 100 pcs @ 1000
    // New: 5 cartons, each 10 pcs, unit cost 15000 per carton => 1500/pcs
    const avg = computeAverageCost(100, 1000, 5, 15000, 10);
    // ((100*1000) + (5*15000)) / (100 + 50) = (100000 + 75000)/150 = 1167
    expect(avg).toBe(1167);
  });

  it('falls back to incoming cost when old cost not set', () => {
    const avg = computeAverageCost(0, 0, 2, 2000, 1);
    expect(avg).toBe(2000);
  });
});
