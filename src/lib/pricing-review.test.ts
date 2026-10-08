import { describe, expect, it } from 'vitest';
import { findPricesBelowTarget } from '@/lib/pricing-review';

describe('product price review', () => {
  it('flags only units below their category recommendation', () => {
    const findings = findPricesBelowTarget({
      name: 'Beras SPHP 5kg',
      category: 'Sembako',
      unit: 'PCS',
      costPrice: 10000,
      priceEcer: 10500,
      units: [
        { code: 'PCS', contains: 1, price: 10500 },
        { code: 'DUS', contains: 12, price: 120000 },
      ],
    });

    expect(findings).toEqual([
      { unitCode: 'PCS', currentPrice: 10500, recommendedPrice: 10300, marginPercent: 3 },
      { unitCode: 'DUS', currentPrice: 120000, recommendedPrice: 123600, marginPercent: 3 },
    ].filter((item) => item.currentPrice < item.recommendedPrice));
  });

  it('does not flag products whose base and pack prices already meet the target', () => {
    const findings = findPricesBelowTarget({
      name: 'Beras SPHP 5kg',
      category: 'Sembako',
      unit: 'PCS',
      costPrice: 10000,
      priceEcer: 11000,
      units: [
        { code: 'PCS', contains: 1, price: 11000 },
        { code: 'DUS', contains: 12, price: 130000 },
      ],
    });

    expect(findings).toEqual([]);
  });

  it('uses a saved product margin and ignores wholesale quantity tiers', () => {
    const findings = findPricesBelowTarget({
      name: 'Produk custom',
      category: 'Umum',
      unit: 'PCS',
      costPrice: 10000,
      priceEcer: 12000,
      pricingStrategy: { mode: 'margin', ruleKey: 'CUSTOM', marginPercent: 30, roundingStep: 100 },
      units: [
        { code: 'PCS', contains: 1, price: 12000 },
        { code: 'PCS', contains: 1, price: 11000, minQty: 12 },
      ],
    });

    expect(findings).toEqual([
      { unitCode: 'PCS', currentPrice: 12000, recommendedPrice: 13000, marginPercent: 30 },
    ]);
  });
});