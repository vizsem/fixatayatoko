export type TaxMode = 'DISABLED' | 'PT_PKP' | 'UMKM_FINAL';

export type TaxPricingMode = 'INCLUSIVE' | 'EXCLUSIVE';

export interface TaxSettings {
  enabled: boolean;
  mode: TaxMode; // 'PT_PKP' (PPN 11%) or 'UMKM_FINAL' (PPh Final 0.5%)
  ppnRate: number; // e.g. 11 (%)
  pphFinalRate: number; // e.g. 0.5 (%)
  pricingMode: TaxPricingMode; // 'INCLUSIVE' or 'EXCLUSIVE'
  nonTaxableCategories: string[]; // Categories exempted from PPN (e.g. Sembako, Beras, Telur)
}

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  enabled: false,
  mode: 'UMKM_FINAL',
  ppnRate: 11,
  pphFinalRate: 0.5,
  pricingMode: 'INCLUSIVE',
  nonTaxableCategories: [
    'SEMBAKO', 'BERAS', 'TELUR', 'DAGING', 'SAYUR', 'BUAH', 'SUKU_CADANG_DASAR', 'GULA_PASIR', 'MINYAK_GORENG_CURAH'
  ]
};

/**
 * Check if a product category is exempt from PPN (e.g. Sembako)
 */
export function isCategoryTaxExempt(categoryName?: string, exemptList = DEFAULT_TAX_SETTINGS.nonTaxableCategories): boolean {
  if (!categoryName) return false;
  const norm = categoryName.trim().toUpperCase();
  return exemptList.some(item => norm.includes(item.toUpperCase()));
}

/**
 * Calculate tax breakdown for a price amount
 */
export function calculateTaxBreakdown(opts: {
  amount: number;
  category?: string;
  taxSettings?: Partial<TaxSettings>;
}) {
  const settings: TaxSettings = { ...DEFAULT_TAX_SETTINGS, ...(opts.taxSettings || {}) };
  const amount = Number(opts.amount || 0);

  if (!settings.enabled || amount <= 0) {
    return {
      isExempt: true,
      dpp: amount,
      taxAmount: 0,
      totalWithTax: amount,
      effectiveRate: 0,
      taxLabel: 'Non-Pajak (0%)'
    };
  }

  const isExempt = isCategoryTaxExempt(opts.category, settings.nonTaxableCategories);

  if (isExempt) {
    return {
      isExempt: true,
      dpp: amount,
      taxAmount: 0,
      totalWithTax: amount,
      effectiveRate: 0,
      taxLabel: 'Bebas PPN (0% Sembako / UU HPP)'
    };
  }

  if (settings.mode === 'PT_PKP') {
    const rate = settings.ppnRate / 100;
    if (settings.pricingMode === 'INCLUSIVE') {
      // DPP = Price / (1 + Rate)
      const dpp = Math.round(amount / (1 + rate));
      const taxAmount = amount - dpp;
      return {
        isExempt: false,
        dpp,
        taxAmount,
        totalWithTax: amount,
        effectiveRate: settings.ppnRate,
        taxLabel: `Inc. PPN ${settings.ppnRate}%`
      };
    } else {
      // EXCLUSIVE: Tax added on top
      const taxAmount = Math.round(amount * rate);
      const totalWithTax = amount + taxAmount;
      return {
        isExempt: false,
        dpp: amount,
        taxAmount,
        totalWithTax,
        effectiveRate: settings.ppnRate,
        taxLabel: `+ PPN ${settings.ppnRate}%`
      };
    }
  } else {
    // UMKM_FINAL (PPh Final 0.5%)
    const rate = settings.pphFinalRate / 100;
    const taxAmount = Math.round(amount * rate);
    return {
      isExempt: false,
      dpp: amount,
      taxAmount,
      totalWithTax: amount, // Internal tax absorbed by business
      effectiveRate: settings.pphFinalRate,
      taxLabel: `PPh Final UMKM ${settings.pphFinalRate}%`
    };
  }
}
