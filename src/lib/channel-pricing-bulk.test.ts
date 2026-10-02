import { describe, expect, it } from 'vitest';
import { applyBulkPriceAdjustment, type BulkPricingMode } from './channel-pricing-bulk';

describe('channel-pricing-bulk', () => {
  it('menetapkan harga baru secara nominal', () => {
    const currentPrice = 120000;
    const next = applyBulkPriceAdjustment(currentPrice, 'set-nominal', 150000);
    expect(next).toBe(150000);
  });

  it('menambah harga berdasarkan persentase', () => {
    const currentPrice = 200000;
    const next = applyBulkPriceAdjustment(currentPrice, 'add-percent', 10);
    expect(next).toBe(220000);
  });

  it('mengurangi harga berdasarkan nominal dengan minimum aman', () => {
    const currentPrice = 90000;
    const next = applyBulkPriceAdjustment(currentPrice, 'subtract-nominal', 15000, 50000);
    expect(next).toBe(75000);
  });

  it('mencegah harga turun di bawah minimum aman', () => {
    const currentPrice = 60000;
    const next = applyBulkPriceAdjustment(currentPrice, 'subtract-nominal', 20000, 50000);
    expect(next).toBe(50000);
  });

  it('menyimpan mode valid', () => {
    const modes: BulkPricingMode[] = ['set-nominal', 'add-nominal', 'subtract-nominal', 'set-percent', 'add-percent', 'subtract-percent'];
    expect(modes).toHaveLength(6);
  });
});
