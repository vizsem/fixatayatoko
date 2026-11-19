import { describe, expect, it } from 'vitest';
import { findPricesBelowTarget } from '@/lib/pricing-review';

describe('product price review (Skema 1 & 2)', () => {
  it('flags units sold at or below cost price (loss / Skema 1)', () => {
    const findings = findPricesBelowTarget({
      name: 'Minyak Goreng 1L',
      category: 'Sembako',
      unit: 'PCS',
      costPrice: 15000,
      priceEcer: 14000, // Jual di bawah modal (rugi)
      units: [
        { code: 'PCS', contains: 1, price: 14000 },
        { code: 'DUS', contains: 12, price: 170000 }, // Modal dus: 180.000, jual 170.000 (rugi)
      ],
    });

    expect(findings.length).toBe(2);
    expect(findings[0].unitCode).toBe('PCS');
    expect(findings[0].currentPrice).toBe(14000);
    expect(findings[1].unitCode).toBe('DUS');
    expect(findings[1].currentPrice).toBe(170000);
  });

  it('does not flag products when price is above cost even with thin margin (Skema 1)', () => {
    const findings = findPricesBelowTarget({
      name: 'Beras SPHP 5kg',
      category: 'Sembako',
      unit: 'PCS',
      costPrice: 10000,
      priceEcer: 10500, // Untung tipis Rp500 (5%), tidak boleh dianggap "Perlu naik" agar tidak kemahalan
      units: [
        { code: 'PCS', contains: 1, price: 10500 },
        { code: 'DUS', contains: 12, price: 122000 }, // Modal: 120.000, jual 122.000 (untung)
      ],
    });

    expect(findings).toEqual([]);
  });

  it('does not flag products when isHppLocked is true or mode is manual (Skema 2)', () => {
    // Meskipun jual di bawah modal, jika dikunci manual (isHppLocked), sistem menghormati penetapan admin
    const findingsLocked = findPricesBelowTarget({
      name: 'Promo Cuci Gudang',
      category: 'Umum',
      unit: 'PCS',
      costPrice: 20000,
      priceEcer: 15000,
      isHppLocked: true,
      units: [{ code: 'PCS', contains: 1, price: 15000 }],
    });

    expect(findingsLocked).toEqual([]);

    const findingsManual = findPricesBelowTarget({
      name: 'Produk Manual',
      category: 'Umum',
      unit: 'PCS',
      costPrice: 20000,
      priceEcer: 15000,
      pricingStrategy: { mode: 'manual' },
      units: [{ code: 'PCS', contains: 1, price: 15000 }],
    });

    expect(findingsManual).toEqual([]);
  });

  it('uses custom margin when explicitly configured by admin', () => {
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
