import { describe, it, expect } from 'vitest';
import { computeAverageCost } from './inventory';

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
