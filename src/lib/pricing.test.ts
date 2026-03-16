import { describe, it, expect } from 'vitest';
import { recommendSellingPrice } from './normalize';

describe('recommendSellingPrice', () => {
  it('returns null when cost is not positive', () => {
    expect(recommendSellingPrice({ cost: 0, name: 'Beras' })).toBeNull();
  });

  it('picks Beras SPHP rule and computes rounded recommendation', () => {
    const rec = recommendSellingPrice({ cost: 10000, name: 'Beras SPHP 5kg', ruleKey: 'AUTO', roundingStep: 100 });
    expect(rec?.rule.key).toBe('BERAS_SPHP');
    expect(rec?.marginPercent).toBe(3);
    expect(rec?.recommendedPrice).toBe(10300);
  });

  it('rounds up to step and reports effective margin', () => {
    const rec = recommendSellingPrice({ cost: 10000, name: 'Rokok filter', ruleKey: 'AUTO', roundingStep: 100 });
    expect(rec?.rule.key).toBe('ROKOK');
    expect(rec?.recommendedPrice).toBe(10700);
    expect(rec?.effectiveMarginPercent).toBeCloseTo(7, 6);
  });

  it('clamps marginPercent to rule range', () => {
    const rec = recommendSellingPrice({ cost: 10000, ruleKey: 'ROKOK', marginPercent: 1, roundingStep: 100 });
    expect(rec?.marginPercent).toBe(5);
    expect(rec?.recommendedPrice).toBe(10500);
  });
});

