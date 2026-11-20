export type CustomerType = 'Retail' | 'Semi-Grosir' | 'Grosir' | 'Umum' | string;

export interface CustomerTierPrices {
  priceEcer: number;
  priceSemiGrosir: number;
  priceGrosir: number;
  marginEcerPct: number;
  marginSemiGrosirPct: number;
  marginGrosirPct: number;
}

/**
 * Membulatkan angka ke atas atau ke bawah ke kelipatan step terdekat (default Rp100).
 */
export function roundToStep(amount: number, step = 100): number {
  if (step <= 1) return Math.round(amount);
  return Math.round(amount / step) * step;
}

/**
 * Menghitung margin persen terhadap modal (HPP).
 */
export function calcMarginPct(price: number, costPrice: number): number {
  if (costPrice <= 0 || price <= 0) return 0;
  return Number((((price - costPrice) / costPrice) * 100).toFixed(1));
}

/**
 * Hitung rekomendasi tier harga pelanggan secara proporsional dan anti-boncos.
 * - Retail: Sesuai harga ecer yang ditentukan
 * - Semi-Grosir: Diskon ~7% dari Ecer atau margin ~15% di atas modal (min. modal + 5%)
 * - Grosir: Diskon ~14% dari Ecer atau margin ~8% di atas modal (min. modal + 3%)
 */
export function calculateCustomerTierPrices({
  costPrice,
  priceEcer,
  customSemiGrosir,
  customGrosir,
  roundingStep = 100,
}: {
  costPrice: number;
  priceEcer: number;
  customSemiGrosir?: number;
  customGrosir?: number;
  roundingStep?: number;
}): CustomerTierPrices {
  const modal = Math.max(0, costPrice || 0);
  const ecer = Math.max(0, priceEcer || 0);

  // Batas bawah keselamatan (Anti-Boncos)
  // Harga Grosir dan Semi-Grosir TIDAK BOLEH SAMA DENGAN ATAU DI BAWAH MODAL (HPP)
  const minSemiGrosirSafe = modal > 0 ? Math.max(roundToStep(modal * 1.07, roundingStep), modal + roundingStep) : 0;
  const minGrosirSafe = modal > 0 ? Math.max(roundToStep(modal * 1.04, roundingStep), modal + roundingStep) : 0;

  // 1. Semi-Grosir
  let semiGrosir = Number(customSemiGrosir || 0);
  if (semiGrosir <= 0 && ecer > 0) {
    // Default: diskon 7% dari Ecer
    const calculated = roundToStep(ecer * 0.93, roundingStep);
    semiGrosir = Math.max(calculated, minSemiGrosirSafe);
  } else if (modal > 0 && semiGrosir <= modal) {
    // Cegah harga semi grosir sama dengan atau di bawah modal
    semiGrosir = minSemiGrosirSafe;
  }

  // 2. Grosir
  let grosir = Number(customGrosir || 0);
  if (grosir <= 0 && ecer > 0) {
    // Default: diskon 14% dari Ecer
    const calculated = roundToStep(ecer * 0.86, roundingStep);
    grosir = Math.max(calculated, minGrosirSafe);
  } else if (modal > 0 && grosir <= modal) {
    // Cegah harga grosir sama dengan atau di bawah modal
    grosir = minGrosirSafe;
  }

  // Pastikan hirarki harga logis: Modal < Grosir <= Semi-Grosir <= Ecer
  if (modal > 0) {
    if (grosir <= modal) grosir = minGrosirSafe;
    if (semiGrosir <= modal) semiGrosir = minSemiGrosirSafe;
  }
  if (ecer > 0) {
    if (grosir > ecer) grosir = ecer;
    if (semiGrosir > ecer) semiGrosir = ecer;
    if (grosir > semiGrosir) grosir = semiGrosir;
  }

  return {
    priceEcer: ecer,
    priceSemiGrosir: semiGrosir,
    priceGrosir: grosir,
    marginEcerPct: calcMarginPct(ecer, modal),
    marginSemiGrosirPct: calcMarginPct(semiGrosir, modal),
    marginGrosirPct: calcMarginPct(grosir, modal),
  };
}

/**
 * Menentukan harga jual produk yang berlaku untuk seorang pelanggan tertentu di POS / Kasir.
 */
export function resolveCustomerUnitPrice({
  baseEcer,
  priceSemiGrosir,
  priceGrosir,
  customerType,
  contains = 1,
  unitPriceOverride,
}: {
  baseEcer: number;
  priceSemiGrosir?: number | null;
  priceGrosir?: number | null;
  customerType?: string | null;
  contains?: number;
  unitPriceOverride?: number | null;
}): {
  effectivePrice: number;
  originalPrice: number;
  appliedTier: 'Retail' | 'Semi-Grosir' | 'Grosir';
  discountAmount: number;
} {
  const mult = contains > 0 ? contains : 1;
  const originalPrice = (unitPriceOverride && unitPriceOverride > 0)
    ? unitPriceOverride
    : baseEcer * mult;

  const type = (customerType || 'Retail').toLowerCase().trim();

  // Tier Grosir
  if (type === 'grosir') {
    const grosirBase = Number(priceGrosir || 0);
    if (grosirBase > 0) {
      const effectivePrice = grosirBase * mult;
      return {
        effectivePrice,
        originalPrice,
        appliedTier: 'Grosir',
        discountAmount: Math.max(0, originalPrice - effectivePrice),
      };
    }
  }

  // Tier Semi-Grosir
  if (type === 'semi-grosir' || type === 'semigrosir' || type === 'warung') {
    const semiBase = Number(priceSemiGrosir || 0);
    if (semiBase > 0) {
      const effectivePrice = semiBase * mult;
      return {
        effectivePrice,
        originalPrice,
        appliedTier: 'Semi-Grosir',
        discountAmount: Math.max(0, originalPrice - effectivePrice),
      };
    }
  }

  // Default: Retail / Eceran
  return {
    effectivePrice: originalPrice,
    originalPrice,
    appliedTier: 'Retail',
    discountAmount: 0,
  };
}
