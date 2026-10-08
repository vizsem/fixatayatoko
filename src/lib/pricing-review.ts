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
};

export type PriceReviewFinding = {
  unitCode: string;
  currentPrice: number;
  recommendedPrice: number;
  marginPercent: number;
};

export function findPricesBelowTarget(product: PriceReviewProduct): PriceReviewFinding[] {
  const baseUnit = product.unit.trim().toUpperCase();
  const strategy = product.pricingStrategy;
  const priceUnits = product.units?.length
    ? product.units
    : [{ code: baseUnit, contains: 1, price: product.priceEcer }];
  const checkedUnits = new Set<string>();
  const findings: PriceReviewFinding[] = [];

  for (const unit of priceUnits) {
    const unitCode = String(unit.code || '').trim().toUpperCase();
    if (!unitCode || checkedUnits.has(unitCode) || Number(unit.minQty || 0) > 1) continue;
    checkedUnits.add(unitCode);

    const contains = unitCode === baseUnit ? 1 : Math.max(1, Number(unit.contains || 1));
    const currentPrice = unitCode === baseUnit
      ? Number(product.priceEcer || unit.price || 0)
      : Number(unit.price || 0);
    const recommendation = recommendSellingPrice({
      cost: Number(product.costPrice || 0) * contains,
      name: product.name,
      category: product.category,
      ruleKey: strategy?.mode === 'margin' ? strategy.ruleKey : 'AUTO',
      marginPercent: strategy?.mode === 'margin' ? strategy.marginPercent : undefined,
      roundingStep: strategy?.mode === 'margin' ? strategy.roundingStep : 100,
    });

    if (!recommendation || currentPrice >= recommendation.recommendedPrice) continue;

    findings.push({
      unitCode,
      currentPrice,
      recommendedPrice: recommendation.recommendedPrice,
      marginPercent: recommendation.marginPercent,
    });
  }

  if (!checkedUnits.has(baseUnit)) {
    const recommendation = recommendSellingPrice({
      cost: Number(product.costPrice || 0),
      name: product.name,
      category: product.category,
      ruleKey: strategy?.mode === 'margin' ? strategy.ruleKey : 'AUTO',
      marginPercent: strategy?.mode === 'margin' ? strategy.marginPercent : undefined,
      roundingStep: strategy?.mode === 'margin' ? strategy.roundingStep : 100,
    });
    const currentPrice = Number(product.priceEcer || 0);
    if (recommendation && currentPrice < recommendation.recommendedPrice) {
      findings.unshift({
        unitCode: baseUnit,
        currentPrice,
        recommendedPrice: recommendation.recommendedPrice,
        marginPercent: recommendation.marginPercent,
      });
    }
  }

  return findings;
}