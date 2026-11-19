import { recommendSellingPrice, type PricingStrategy } from '@/lib/normalize';

export type PriceReviewUnit = {
  code: string;
  contains?: number;
  price?: number;
  minQty?: number;
};

export type PriceReviewProduct = {
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  priceEcer: number;
  units?: PriceReviewUnit[];
  pricingStrategy?: PricingStrategy;
  isHppLocked?: boolean;
};

export type PriceReviewFinding = {
  unitCode: string;
  currentPrice: number;
  recommendedPrice: number;
  marginPercent: number;
};

/**
 * Mencari satuan atau produk yang harganya di bawah modal (Rugi) atau di bawah target margin custom.
 *
 * SKEMA 1: Jika tidak ada target margin custom eksplisit dari admin, HANYA beri peringatan
 * jika harga jual DI BAWAH atau SAMA DENGAN modal HPP (Rugi).
 * Selama currentPrice > unitCost (masih ada untung, meskipun tipis), JANGAN tampilkan "Perlu naik"
 * agar harga jual di toko tidak kemahalan dan tetap kompetitif di pasar.
 *
 * SKEMA 2: Jika produk dikunci manual (isHppLocked = true) atau mode strategi 'manual',
 * sistem menghormati penetapan manual admin dan mengabaikan peringatan ini.
 */
export function findPricesBelowTarget(product: PriceReviewProduct): PriceReviewFinding[] {
  // Skema 2: Kunci HPP / Mode Manual -> Bebas peringatan "Perlu naik"
  if (product.isHppLocked || product.pricingStrategy?.mode === 'manual') {
    return [];
  }

  const baseUnit = product.unit.trim().toUpperCase();
  const strategy = product.pricingStrategy;
  const priceUnits = product.units?.length
    ? product.units
    : [{ code: baseUnit, contains: 1, price: product.priceEcer }];
  const checkedUnits = new Set<string>();
  const findings: PriceReviewFinding[] = [];

  // Apakah admin sengaja menentukan target margin custom untuk produk ini?
  const hasCustomMargin = strategy?.mode === 'margin' && Number(strategy.marginPercent || 0) > 0;

  for (const unit of priceUnits) {
    const unitCode = String(unit.code || '').trim().toUpperCase();
    if (!unitCode || checkedUnits.has(unitCode) || Number(unit.minQty || 0) > 1) continue;
    checkedUnits.add(unitCode);

    const contains = unitCode === baseUnit ? 1 : Math.max(1, Number(unit.contains || 1));
    const currentPrice = unitCode === baseUnit
      ? Number(product.priceEcer || unit.price || 0)
      : Number(unit.price || 0);
    const unitCost = Number(product.costPrice || 0) * contains;

    // Skema 1: Selama masih ada keuntungan (currentPrice > unitCost), jangan beri peringatan
    if (!hasCustomMargin) {
      if (unitCost <= 0 || currentPrice > unitCost) continue;
    }

    const recommendation = recommendSellingPrice({
      cost: unitCost,
      name: product.name,
      category: product.category,
      ruleKey: strategy?.mode === 'margin' ? strategy.ruleKey : 'AUTO',
      marginPercent: strategy?.mode === 'margin' ? strategy.marginPercent : undefined,
      roundingStep: strategy?.mode === 'margin' ? strategy.roundingStep : 100,
    });

    if (!recommendation) continue;

    // Untuk custom margin: bandingkan ke target yang ditentukan admin
    if (hasCustomMargin && currentPrice >= recommendation.recommendedPrice) continue;

    findings.push({
      unitCode,
      currentPrice,
      recommendedPrice: recommendation.recommendedPrice,
      marginPercent: recommendation.marginPercent,
    });
  }

  if (!checkedUnits.has(baseUnit)) {
    const unitCost = Number(product.costPrice || 0);
    const currentPrice = Number(product.priceEcer || 0);

    const isLoss = unitCost > 0 && currentPrice <= unitCost;
    if (isLoss || hasCustomMargin) {
      const recommendation = recommendSellingPrice({
        cost: unitCost,
        name: product.name,
        category: product.category,
        ruleKey: strategy?.mode === 'margin' ? strategy.ruleKey : 'AUTO',
        marginPercent: strategy?.mode === 'margin' ? strategy.marginPercent : undefined,
        roundingStep: strategy?.mode === 'margin' ? strategy.roundingStep : 100,
      });

      if (recommendation) {
        if (!hasCustomMargin || currentPrice < recommendation.recommendedPrice) {
          findings.unshift({
            unitCode: baseUnit,
            currentPrice,
            recommendedPrice: recommendation.recommendedPrice,
            marginPercent: recommendation.marginPercent,
          });
        }
      }
    }
  }

  return findings;
}
