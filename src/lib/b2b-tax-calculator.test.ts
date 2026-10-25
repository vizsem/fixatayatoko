import { describe, it, expect } from 'vitest';
import {
  calculateB2bHppAndPricing,
  autoDetectCategory,
  B2bTaxInput,
} from './b2b-tax-calculator';

describe('B2B Tax Calculator & Anti-Boncos Engine', () => {
  it('identifies Kategori A (Beras / Sembako) with 0% PPN', () => {
    const input: B2bTaxInput = {
      productName: 'Beras Pandan Wangi 5kg',
      categoryType: 'KATEGORI_A',
      factoryPurchasePrice: 60000,
      factoryPpnStatus: 'BELUM_PPN',
      shippingCostPerUnit: 2000,
      handlingCostPerUnit: 500,
      packagingCostPerUnit: 1500,
      buyerTaxStatus: 'NON_PKP',
      targetMarginPct: 15,
      marginType: 'MARKUP_FROM_COST',
      marketplaceFeePct: 6.5,
      annualTurnoverTier: 'UNDER_500M',
    };

    const result = calculateB2bHppAndPricing(input);

    // Kategori A is tax exempt: PPN = 0
    expect(result.costBreakdown.ppnMasukanPerUnit).toBe(0);
    expect(result.costBreakdown.ppnCapitalizedToHpp).toBe(0);
    expect(result.costBreakdown.totalLandedCostPerUnit).toBe(4000);
    // HPP = 60000 + 4000 = 64000
    expect(result.costBreakdown.cleanHppPerUnit).toBe(64000);

    // Offline selling price with 15% markup = 64000 * 1.15 = 73600
    expect(result.pricing.recommendedOfflinePrice).toBe(73600);

    // Marketplace recommendation must cover 6.5% fee
    // Price = 73600 / (1 - 0.065) = ~78717
    expect(result.pricing.recommendedMarketplacePrice).toBeGreaterThan(73600);
    expect(result.pricing.netRevenueAfterPlatformFee).toBeGreaterThanOrEqual(73590);
    expect(result.pricing.expectedOnlineProfitNominal).toBeGreaterThanOrEqual(9500);

    // PPh Final UMKM under 500M is exempt
    expect(result.taxProjection.isExemptFromPphFinal).toBe(true);
    expect(result.taxProjection.pphFinalNominalPerUnit).toBe(0);
  });

  it('correctly capitalizes PPN 11% into HPP for NON-PKP buyer on Kategori B', () => {
    const input: B2bTaxInput = {
      productName: 'Minyak Goreng Botol 2L',
      categoryType: 'KATEGORI_B',
      factoryPurchasePrice: 28000,
      factoryPpnStatus: 'BELUM_PPN', // Exclude PPN 11%
      shippingCostPerUnit: 1000,
      handlingCostPerUnit: 200,
      packagingCostPerUnit: 0,
      buyerTaxStatus: 'NON_PKP', // Non-PKP absorbs PPN into cost
      targetMarginPct: 20,
      marginType: 'MARKUP_FROM_COST',
      marketplaceFeePct: 7,
      annualTurnoverTier: '500M_TO_4_8B',
    };

    const result = calculateB2bHppAndPricing(input);

    // DPP = 28000
    expect(result.costBreakdown.dppPerUnit).toBe(28000);
    // PPN 11% = 3080
    expect(result.costBreakdown.ppnMasukanPerUnit).toBe(3080);
    // Non-PKP must capitalize PPN into cost!
    expect(result.costBreakdown.ppnCapitalizedToHpp).toBe(3080);
    // Clean HPP = 28000 + 3080 + 1200 = 32280
    expect(result.costBreakdown.cleanHppPerUnit).toBe(32280);

    // Warning about PPN capitalized should be present
    expect(result.warnings.some(w => w.severity === 'DANGER')).toBe(true);

    // Turnover > 500M has 0.5% PPh final
    expect(result.taxProjection.isExemptFromPphFinal).toBe(false);
    expect(result.taxProjection.pphFinalRatePct).toBe(0.5);
  });

  it('keeps PPN out of HPP when buyer is PKP (creditable input tax)', () => {
    const input: B2bTaxInput = {
      productName: 'Sabun Cuci Deterjen 1kg',
      categoryType: 'KATEGORI_B',
      factoryPurchasePrice: 33300,
      factoryPpnStatus: 'SUDAH_PPN', // Inclusive PPN 11%
      shippingCostPerUnit: 1000,
      buyerTaxStatus: 'PKP', // PKP credits PPN Masukan
      targetMarginPct: 15,
      marketplaceFeePct: 5,
      annualTurnoverTier: 'UNDER_500M',
    };

    const result = calculateB2bHppAndPricing(input);

    // DPP = 33300 / 1.11 = 30000
    expect(result.costBreakdown.dppPerUnit).toBe(30000);
    expect(result.costBreakdown.ppnMasukanPerUnit).toBe(3300);
    // PKP does NOT capitalize PPN into HPP
    expect(result.costBreakdown.ppnCapitalizedToHpp).toBe(0);
    // Clean HPP = 30000 + 1000 = 31000
    expect(result.costBreakdown.cleanHppPerUnit).toBe(31000);
  });

  it('calculates PPh 22 for Kategori C (Industry Semen 0.25%)', () => {
    const input: B2bTaxInput = {
      productName: 'Semen Gresik 50kg',
      categoryType: 'KATEGORI_C',
      industryType: 'SEMEN',
      factoryPurchasePrice: 60000,
      factoryPpnStatus: 'BELUM_PPN',
      buyerTaxStatus: 'NON_PKP',
      shippingCostPerUnit: 5000,
      targetMarginPct: 10,
      marketplaceFeePct: 0,
      annualTurnoverTier: '500M_TO_4_8B',
    };

    const result = calculateB2bHppAndPricing(input);

    // PPh 22 Semen = 0.25% of 60,000 = 150
    expect(result.costBreakdown.pph22PerUnit).toBe(150);
  });

  it('auto detects category correctly', () => {
    expect(autoDetectCategory('Beras Ramos Setra 10kg').category).toBe('KATEGORI_A');
    expect(autoDetectCategory('Daging Sapi Segar').category).toBe('KATEGORI_A');
    expect(autoDetectCategory('Semen Holcim 40kg').category).toBe('KATEGORI_C');
    expect(autoDetectCategory('Baja Ringan Galvalum').category).toBe('KATEGORI_C');
    expect(autoDetectCategory('Sabun Mandi Lifebuoy').category).toBe('KATEGORI_B');
  });
});
