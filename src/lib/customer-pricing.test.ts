import { describe, it, expect } from 'vitest';
import {
  calculateCustomerTierPrices,
  resolveCustomerUnitPrice,
  roundToStep,
  calcMarginPct,
} from './customer-pricing';

describe('customer-pricing', () => {
  it('roundToStep membulatkan ke kelipatan step dengan benar', () => {
    expect(roundToStep(1234, 100)).toBe(1200);
    expect(roundToStep(1260, 100)).toBe(1300);
    expect(roundToStep(1234, 500)).toBe(1000);
    expect(roundToStep(1350, 500)).toBe(1500);
  });

  it('calcMarginPct menghitung persentase margin terhadap modal', () => {
    expect(calcMarginPct(15000, 10000)).toBe(50);
    expect(calcMarginPct(12000, 10000)).toBe(20);
    expect(calcMarginPct(0, 10000)).toBe(0);
    expect(calcMarginPct(10000, 0)).toBe(0);
  });

  it('calculateCustomerTierPrices menghitung tier proporsional secara otomatis', () => {
    const res = calculateCustomerTierPrices({
      costPrice: 10000,
      priceEcer: 15000,
    });

    expect(res.priceEcer).toBe(15000);
    // Ecer 15000 * 0.93 = 13950 -> rounded to 14000
    expect(res.priceSemiGrosir).toBe(14000);
    // Ecer 15000 * 0.86 = 12900 -> rounded to 12900
    expect(res.priceGrosir).toBe(12900);

    expect(res.marginEcerPct).toBe(50);
    expect(res.marginSemiGrosirPct).toBe(40);
    expect(res.marginGrosirPct).toBe(29);
  });

  it('calculateCustomerTierPrices menjaga batas aman modal (anti-boncos)', () => {
    const res = calculateCustomerTierPrices({
      costPrice: 10000,
      priceEcer: 10500, // margin sangat tipis
    });

    expect(res.priceEcer).toBe(10500);
    // Grosir & Semi-grosir tidak boleh di bawah min modal aman
    expect(res.priceGrosir).toBeGreaterThanOrEqual(10300);
    expect(res.priceSemiGrosir).toBeGreaterThanOrEqual(10500);
  });

  it('resolveCustomerUnitPrice mengaplikasikan harga sesuai tipe pelanggan', () => {
    // 1. Pelanggan Retail
    const retail = resolveCustomerUnitPrice({
      baseEcer: 15000,
      priceSemiGrosir: 14000,
      priceGrosir: 13000,
      customerType: 'Retail',
      contains: 1,
    });
    expect(retail.effectivePrice).toBe(15000);
    expect(retail.appliedTier).toBe('Retail');
    expect(retail.discountAmount).toBe(0);

    // 2. Pelanggan Semi-Grosir
    const semi = resolveCustomerUnitPrice({
      baseEcer: 15000,
      priceSemiGrosir: 14000,
      priceGrosir: 13000,
      customerType: 'Semi-Grosir',
      contains: 1,
    });
    expect(semi.effectivePrice).toBe(14000);
    expect(semi.appliedTier).toBe('Semi-Grosir');
    expect(semi.discountAmount).toBe(1000);

    // 3. Pelanggan Grosir multi satuan (misal isi 10)
    const grosir = resolveCustomerUnitPrice({
      baseEcer: 15000,
      priceSemiGrosir: 14000,
      priceGrosir: 13000,
      customerType: 'Grosir',
      contains: 10,
    });
    expect(grosir.effectivePrice).toBe(130000);
    expect(grosir.appliedTier).toBe('Grosir');
    expect(grosir.discountAmount).toBe(20000);
  });
});
